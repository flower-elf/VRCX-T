use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use serde::Serialize;
use serde_json::{json, Value};

use crate::{
    GameClientHostRuntime, GameLogEventSink, GameLogHostRuntime, HostFileAccess,
    HostLogLocationSnapshotScanner, LogWatcher, Result, RuntimeHostContext, RuntimeHostEventSink,
};
use vrcx_0_application::{
    build_friend_roster_baseline, record_login_success, saved_credential_login_start,
    saved_snapshot, BackendRuntime, BackendRuntimeMode, BackendRuntimePhase,
    BackendRuntimeSnapshot, BackendRuntimeTelemetry, GameProcessEventSink, ImageCache,
    LoginSuccessRecordInput, ProcessMonitor, RealtimeHostRuntime, RealtimeHostRuntimeDeps,
    RealtimeStopRequest, RuntimeEventSink, SavedCredentialLoginStartInput, SessionHostRuntime,
    SocialBaselineDeps, SocialFriendRosterBaselineInput, WebClient,
};
use vrcx_0_core::friends::FriendRecord;
use vrcx_0_core::json::RawJson;
use vrcx_0_host::app_paths::AppPaths;
use vrcx_0_host::auto_launch::AutoAppLaunchManager;
use vrcx_0_host::discord_rpc::DiscordRpc;
use vrcx_0_host::host_capabilities::{
    current_host_capabilities, is_host_capability_available, HostCapability,
};
use vrcx_0_persistence::legacy_migration::{
    cleanup_legacy_updater_files, consume_pending_legacy_migration, LegacyMigrationPaths,
};
use vrcx_0_persistence::legacy_vrcx::{LegacyVrcxMigrationStatus, LegacyVrcxSource};
use vrcx_0_persistence::screenshot_cache::MetadataCacheDb;
use vrcx_0_persistence::storage::StorageService;
use vrcx_0_persistence::DatabaseService;
use vrcx_0_vrchat_client::auth::{config_get_input, current_user_get_input};
use vrcx_0_vrchat_client::http_api::{
    normalize_vrchat_api_endpoint, ApiScope, HttpApiExecuteResponse,
};
use vrcx_0_vrchat_client::realtime::normalize_websocket_domain;

const SAVED_CREDENTIALS_KEY: &str = "savedCredentials";
const PROFILE_LOCK_FILE: &str = "runtime.lock";

pub struct RuntimeHostOptions {
    pub realtime_origin: String,
    pub launched_from_autostart: bool,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendRuntimeFrontendSessionSnapshot {
    pub authenticated: bool,
    pub user_id: String,
    pub display_name: String,
    pub endpoint: String,
    pub websocket: String,
    pub current_user_snapshot: Value,
}

pub struct RuntimeHostState {
    pub paths: AppPaths,
    pub storage: StorageService,
    pub db: Arc<DatabaseService>,
    pub discord_rpc: DiscordRpc,
    pub process_monitor: ProcessMonitor,
    pub log_watcher: LogWatcher,
    pub runtime_context: Arc<RuntimeHostContext>,
    pub backend_runtime: BackendRuntime,
    pub game_log_runtime: Arc<GameLogHostRuntime>,
    pub game_client_runtime: Arc<GameClientHostRuntime>,
    pub realtime_runtime: Arc<RealtimeHostRuntime>,
    pub session_runtime: Arc<SessionHostRuntime>,
    pub web: Arc<WebClient>,
    pub image_cache: Arc<ImageCache>,
    pub host_file_access: HostFileAccess,
    pub screenshot_cache: MetadataCacheDb,

    pub auto_launch: AutoAppLaunchManager,
    pub legacy_vrcx_available: bool,
    pub legacy_vrcx_source: Option<LegacyVrcxSource>,
    pub legacy_vrcx_migration_status: LegacyVrcxMigrationStatus,
    pub launched_from_autostart: bool,
    backend_starting: AtomicBool,
    backend_frontend_session: Mutex<Option<BackendRuntimeFrontendSessionSnapshot>>,
    _profile_lock: ProfileLock,
}

impl RuntimeHostState {
    pub fn new(options: RuntimeHostOptions) -> Result<Self> {
        let paths = AppPaths::resolve()?;
        cleanup_legacy_updater_files(&paths.app_data);

        let profile_lock = ProfileLock::acquire(&paths.app_data)?;

        let migration_paths = LegacyMigrationPaths::from_app_data(paths.app_data.clone());
        consume_pending_legacy_migration(&migration_paths)?;

        let (legacy_vrcx_source, legacy_vrcx_migration_status) =
            vrcx_0_persistence::legacy_vrcx::discover_legacy_vrcx_migration(
                &paths.db_file,
                &paths.config_file,
            );
        let legacy_vrcx_available = legacy_vrcx_migration_status.available;

        let storage = StorageService::new(&paths.config_file)?;

        let db = Arc::new(DatabaseService::new(&paths.db_file)?);
        let discord_rpc = DiscordRpc::new();
        let process_monitor = ProcessMonitor::new();
        let web = Arc::new(WebClient::new(&storage, &db, options.realtime_origin)?);
        let image_fetcher = web.image_fetcher()?;
        let image_cache = Arc::new(ImageCache::new(paths.image_cache.clone(), image_fetcher)?);
        let host_file_access = HostFileAccess::new();
        let runtime_context = Arc::new(RuntimeHostContext::new(
            Arc::clone(&db),
            Arc::clone(&web),
            Arc::clone(&image_cache),
        ));
        let backend_runtime = BackendRuntime::new();
        let game_log_runtime = Arc::new(GameLogHostRuntime::new(
            Arc::clone(&runtime_context),
            host_file_access.clone(),
            paths.clone(),
        ));
        let game_log_sink: Arc<dyn GameLogEventSink> = game_log_runtime.clone();
        let log_watcher = LogWatcher::new_with_location_snapshot_scanner(
            Some(game_log_sink),
            Arc::new(HostLogLocationSnapshotScanner),
        );
        let game_client_runtime = Arc::new(GameClientHostRuntime::new(
            Arc::clone(&runtime_context),
            log_watcher.clone(),
            host_file_access.clone(),
            paths.clone(),
        ));
        let realtime_runtime = Arc::new(RealtimeHostRuntime::new(RealtimeHostRuntimeDeps {
            db: Arc::clone(&runtime_context.db),
            web: Arc::clone(&runtime_context.web),
            event_bus: runtime_context.event_bus.clone(),
            sync: runtime_context.sync.clone(),
            tasks: runtime_context.tasks.clone(),
            session: runtime_context.session.clone(),
            game_log_snapshot: runtime_context.game_log_snapshot_handle(),
        }));
        let session_runtime = Arc::new(SessionHostRuntime::new(
            runtime_context.session.clone(),
            runtime_context.event_bus.clone(),
        ));
        let screenshot_cache = MetadataCacheDb::new(&paths.app_data.join("metadataCache.db"))?;

        let auto_launch = AutoAppLaunchManager::new(&paths.app_data);

        Ok(Self {
            paths,
            storage,
            db,
            discord_rpc,
            process_monitor,
            log_watcher,
            runtime_context,
            backend_runtime,
            game_log_runtime,
            game_client_runtime,
            realtime_runtime,
            session_runtime,
            web,
            image_cache,
            host_file_access,
            screenshot_cache,
            auto_launch,
            legacy_vrcx_available,
            legacy_vrcx_source,
            legacy_vrcx_migration_status,
            launched_from_autostart: options.launched_from_autostart,
            backend_starting: AtomicBool::new(false),
            backend_frontend_session: Mutex::new(None),
            _profile_lock: profile_lock,
        })
    }

    pub fn set_event_sink<S>(&self, sink: S)
    where
        S: RuntimeEventSink + 'static,
    {
        self.runtime_context
            .event_bus
            .set_sink(RuntimeHostEventSink::new(
                self.backend_runtime.clone(),
                sink,
            ));
    }

    pub fn snapshot_backend_runtime(&self) -> BackendRuntimeSnapshot {
        self.backend_runtime.snapshot()
    }

    pub fn backend_runtime_frontend_session_snapshot(
        &self,
    ) -> Option<BackendRuntimeFrontendSessionSnapshot> {
        let runtime = self.backend_runtime.snapshot();
        if runtime.phase != BackendRuntimePhase::Running
            || runtime.auth_status != "authenticated"
            || runtime.auth_user_id.is_empty()
        {
            return None;
        }

        let cached = self
            .backend_frontend_session
            .lock()
            .ok()
            .and_then(|snapshot| snapshot.clone());
        let auth_scope = self.runtime_context.auth_scope.snapshot();
        let current_user_snapshot = self
            .realtime_runtime
            .current_user_snapshot()
            .or_else(|| {
                cached
                    .as_ref()
                    .map(|snapshot| snapshot.current_user_snapshot.clone())
            })
            .unwrap_or_else(|| {
                json!({
                    "id": runtime.auth_user_id,
                    "displayName": runtime.auth_display_name,
                })
            });
        let friend_snapshot = self.realtime_runtime.friend_snapshot();

        Some(BackendRuntimeFrontendSessionSnapshot {
            authenticated: true,
            user_id: runtime.auth_user_id,
            display_name: runtime.auth_display_name,
            endpoint: friend_snapshot
                .as_ref()
                .map(|snapshot| snapshot.endpoint.clone())
                .filter(|endpoint| !endpoint.trim().is_empty())
                .or_else(|| {
                    if auth_scope.active {
                        Some(auth_scope.endpoint)
                    } else {
                        None
                    }
                })
                .or_else(|| cached.as_ref().map(|snapshot| snapshot.endpoint.clone()))
                .unwrap_or_default(),
            websocket: friend_snapshot
                .as_ref()
                .map(|snapshot| snapshot.websocket.clone())
                .filter(|websocket| !websocket.trim().is_empty())
                .or_else(|| cached.as_ref().map(|snapshot| snapshot.websocket.clone()))
                .unwrap_or_default(),
            current_user_snapshot,
        })
    }

    pub fn release_profile_lock(&self) {
        self._profile_lock.release();
    }

    pub fn start_shell_neutral_services(&self) {
        let host_capabilities = current_host_capabilities();
        tracing::info!(
            platform = %host_capabilities.platform,
            "host capabilities resolved"
        );
        self.runtime_context
            .runtime
            .set_host_services_started(true, "Runtime host services installed.");
        self.runtime_context
            .background_jobs
            .register_frontend_job_catalog();
        self.runtime_context.background_jobs.register_job(
            "startupRecovery",
            "rust-host",
            None,
            "checkpoint",
            "Rust runtime startup recovery checkpoint recorded; no durable recovery queue is configured.",
        );
        self.runtime_context.runtime.record_phase(
            "startupRecovery",
            "checkpoint",
            "Rust runtime startup recovery checkpoint recorded; no durable recovery queue is configured.",
        );
        self.runtime_context.sync.record(
            "startupRecovery",
            "observed",
            "Rust runtime startup recovery checkpoint recorded; no durable recovery queue is configured.",
            0,
        );
        self.runtime_context
            .background_jobs
            .start_database_optimize_loop(Arc::clone(&self.db), self.runtime_context.tasks.clone());

        if is_host_capability_available(HostCapability::GameProcessMonitor) {
            let game_process_sinks: Vec<Arc<dyn GameProcessEventSink>> = vec![
                self.session_runtime.clone(),
                self.game_log_runtime.clone(),
                self.game_client_runtime.clone(),
                self.realtime_runtime.clone(),
            ];
            self.process_monitor.start(
                crate::HostGameProcessMonitorActions::new(self.auto_launch.clone()),
                self.log_watcher.clone(),
                game_process_sinks,
            );
            self.runtime_context
                .background_jobs
                .mark_running("gameProcessMonitor", "Game process monitor is active.");
        } else {
            self.runtime_context.background_jobs.register_job(
                "gameProcessMonitor",
                "rust-host",
                None,
                "unavailable",
                "Game process monitor capability is unavailable.",
            );
        }

        self.start_log_watcher_for_current_platform(&host_capabilities);
    }

    pub fn stop_backend_runtime(&self, reason: impl Into<String>) -> BackendRuntimeSnapshot {
        let reason = reason.into();
        self.backend_runtime
            .set_phase(BackendRuntimePhase::Stopping);
        self.realtime_runtime.stop(RealtimeStopRequest::default());
        self.process_monitor.stop();
        self.log_watcher.stop();
        self.game_log_runtime.stop();
        self.game_client_runtime.stop();
        self.backend_runtime.set_ws_status("idle");
        self.backend_runtime.set_game_log_status("idle");
        self.backend_runtime.set_process_status("unknown");
        self.backend_runtime.set_phase(BackendRuntimePhase::Idle);
        self.emit_backend_runtime_telemetry("runtimeStopped", reason);
        self.backend_runtime.snapshot()
    }

    pub fn set_gui_backend_runtime_mode(&self, mode: BackendRuntimeMode) -> BackendRuntimeSnapshot {
        let current = self.backend_runtime.snapshot();
        if current.mode == BackendRuntimeMode::Headless || mode == BackendRuntimeMode::Headless {
            return current;
        }
        let snapshot = self.backend_runtime.set_mode(mode);
        let detail = match mode {
            BackendRuntimeMode::Foreground => "foreground",
            BackendRuntimeMode::Background => "background",
            BackendRuntimeMode::Headless => "headless",
        };
        self.emit_backend_runtime_telemetry_snapshot("modeChanged", detail, snapshot.clone());
        snapshot
    }

    pub async fn start_backend_runtime(
        &self,
        mode: BackendRuntimeMode,
    ) -> Result<BackendRuntimeSnapshot> {
        let Some(_start_guard) = BackendStartGuard::try_acquire(&self.backend_starting) else {
            return Ok(self.backend_runtime.snapshot());
        };
        let current = self.backend_runtime.snapshot();
        if matches!(
            current.phase,
            BackendRuntimePhase::Starting
                | BackendRuntimePhase::Authenticating
                | BackendRuntimePhase::Running
        ) {
            self.backend_runtime.set_mode(mode);
            return Ok(self.backend_runtime.snapshot());
        }

        self.backend_runtime.set_mode(mode);
        self.backend_runtime
            .set_phase(BackendRuntimePhase::Starting);
        self.start_shell_neutral_services();

        self.backend_runtime.set_authenticating();
        let auth_scope = self.runtime_context.auth_scope.snapshot();
        let auth_result = if auth_scope.active {
            self.current_user_from_cookie(auth_scope.endpoint.clone(), String::new())
                .await
        } else {
            self.authenticate_non_interactive().await
        };
        let session = match auth_result {
            Ok(session) => session,
            Err(NonInteractiveAuthError::InteractionRequired(reason)) => {
                self.backend_runtime
                    .set_auth_interaction_required(reason.clone());
                return Err(crate::Error::Custom(reason));
            }
            Err(NonInteractiveAuthError::Failed(reason)) => {
                self.backend_runtime.set_auth_error(reason.clone());
                return Err(crate::Error::Custom(reason));
            }
        };

        self.runtime_context
            .auth_scope
            .set(&session.user_id, &session.endpoint);
        vrcx_0_persistence::maintenance::user_tables_ensure(
            self.db.as_ref(),
            session.user_id.clone(),
        )?;
        let snapshot = self
            .backend_runtime
            .set_auth_success(session.user_id.clone(), session.display_name.clone());
        self.emit_backend_runtime_telemetry_snapshot(
            "authSuccess",
            session.display_name.clone(),
            snapshot,
        );

        let friends_by_id = match self.build_backend_friend_baseline(&session).await {
            Ok(friends_by_id) => friends_by_id,
            Err(error) => {
                tracing::warn!(error = %error, "failed to build backend friend baseline");
                HashMap::new()
            }
        };
        self.set_backend_frontend_session(&session);
        self.realtime_runtime.start(
            session.user_id,
            session.endpoint,
            session.websocket,
            0,
            session.current_user,
            friends_by_id,
        )?;
        self.backend_runtime.set_phase(BackendRuntimePhase::Running);
        Ok(self.backend_runtime.snapshot())
    }

    async fn authenticate_non_interactive(
        &self,
    ) -> std::result::Result<AuthenticatedRuntimeSession, NonInteractiveAuthError> {
        let snapshot = saved_snapshot(self.runtime_context.config())
            .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        let last_user = string_field(&snapshot, "lastUserLoggedIn").unwrap_or_default();
        if last_user.is_empty() {
            return Err(NonInteractiveAuthError::Failed(
                "No saved account is available for headless login.".into(),
            ));
        }

        let raw_saved_credentials = self
            .runtime_context
            .config()
            .get_json(SAVED_CREDENTIALS_KEY, serde_json::json!({}))
            .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        let saved_record = raw_saved_credentials.get(&last_user).cloned();
        let endpoint = saved_record
            .as_ref()
            .and_then(|record| record.get("loginParams"))
            .and_then(|login_params| string_field(login_params, "endpoint"))
            .unwrap_or_default();
        let websocket = saved_record
            .as_ref()
            .and_then(|record| record.get("loginParams"))
            .and_then(|login_params| string_field(login_params, "websocket"))
            .unwrap_or_default();

        if let Some(cookies) = saved_record
            .as_ref()
            .and_then(|record| record.get("cookies"))
            .and_then(serde_json::Value::as_str)
            .filter(|cookies| !cookies.trim().is_empty())
        {
            if let Err(error) = self.web.set_cookies(cookies) {
                tracing::warn!(error = %error, "failed to restore saved auth cookies");
            } else {
                match self
                    .current_user_from_cookie(endpoint.clone(), websocket.clone())
                    .await
                {
                    Ok(session) => return Ok(session),
                    Err(NonInteractiveAuthError::InteractionRequired(reason)) => {
                        return Err(NonInteractiveAuthError::InteractionRequired(reason));
                    }
                    Err(NonInteractiveAuthError::Failed(reason)) => {
                        tracing::warn!(reason, "saved cookie auth restore failed");
                    }
                }
            }
        }

        let fallback_available = snapshot
            .get("savedCredentialFallbackAvailable")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);
        if !fallback_available {
            return Err(NonInteractiveAuthError::Failed(
                "Saved credentials are not available for headless login.".into(),
            ));
        }

        let response = saved_credential_login_start(
            self.runtime_context.config(),
            self.web.as_ref(),
            self.db.as_ref(),
            SavedCredentialLoginStartInput {
                user_id: last_user,
                endpoint: endpoint.clone(),
            },
        )
        .await
        .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        let user = parse_current_user_response(response)?;
        record_login_success(
            self.runtime_context.config(),
            self.web.as_ref(),
            LoginSuccessRecordInput {
                user: user.clone(),
                login_params: serde_json::json!({
                    "endpoint": endpoint,
                    "websocket": websocket,
                }),
                stored_login_params: None,
                save_credentials: false,
            },
        )
        .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        Ok(AuthenticatedRuntimeSession::from_user(
            user, endpoint, websocket,
        ))
    }

    async fn current_user_from_cookie(
        &self,
        endpoint: String,
        websocket: String,
    ) -> std::result::Result<AuthenticatedRuntimeSession, NonInteractiveAuthError> {
        self.web
            .execute_api(
                config_get_input(endpoint.clone()),
                ApiScope::Vrchat,
                &self.db,
            )
            .await
            .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        let response = self
            .web
            .execute_api(
                current_user_get_input(endpoint.clone()),
                ApiScope::Vrchat,
                &self.db,
            )
            .await
            .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
        let user = parse_current_user_response(response)?;
        Ok(AuthenticatedRuntimeSession::from_user(
            user, endpoint, websocket,
        ))
    }

    async fn build_backend_friend_baseline(
        &self,
        session: &AuthenticatedRuntimeSession,
    ) -> Result<HashMap<String, FriendRecord>> {
        let output = build_friend_roster_baseline(
            SocialBaselineDeps {
                db: Arc::clone(&self.db),
                web: Arc::clone(&self.web),
                auth_scope: self.runtime_context.auth_scope.clone(),
                session: self.runtime_context.session.clone(),
            },
            SocialFriendRosterBaselineInput {
                user_id: session.user_id.clone(),
                endpoint: session.endpoint.clone(),
                current_user_snapshot: RawJson::from(session.current_user.clone()),
                explicit_add_intent_user_ids: Vec::new(),
            },
        )
        .await?;
        let Some(snapshot) = output.snapshot else {
            return Ok(HashMap::new());
        };
        let snapshot = snapshot.into_value();
        let friends_by_id = snapshot
            .get("friendsById")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));
        Ok(serde_json::from_value(friends_by_id)?)
    }

    fn set_backend_frontend_session(&self, session: &AuthenticatedRuntimeSession) {
        let snapshot = BackendRuntimeFrontendSessionSnapshot {
            authenticated: true,
            user_id: session.user_id.clone(),
            display_name: session.display_name.clone(),
            endpoint: session.endpoint.clone(),
            websocket: session.websocket.clone(),
            current_user_snapshot: session.current_user.clone(),
        };
        if let Ok(mut slot) = self.backend_frontend_session.lock() {
            *slot = Some(snapshot);
        }
    }

    fn start_log_watcher_for_current_platform(
        &self,
        _host_capabilities: &vrcx_0_host::host_capabilities::HostCapabilities,
    ) {
        #[cfg(target_os = "windows")]
        if is_host_capability_available(HostCapability::GameLogWatcher) {
            let local_low = std::env::var("LOCALAPPDATA")
                .map(|p| PathBuf::from(p).join("..\\LocalLow\\VRChat\\VRChat"))
                .unwrap_or_default();
            if let Err(error) = self.game_log_runtime.prime_log_watcher(&self.log_watcher) {
                tracing::warn!("failed to prime GameLog watcher from runtime DB: {error}");
            }
            self.log_watcher.start(local_low);
            self.runtime_context
                .background_jobs
                .mark_running("gameLogWatcher", "Windows GameLog watcher is active.");
            self.emit_game_log_watcher_status("running");
        }

        #[cfg(target_os = "windows")]
        if !is_host_capability_available(HostCapability::GameLogWatcher) {
            self.runtime_context.background_jobs.register_job(
                "gameLogWatcher",
                "rust-host",
                None,
                "unavailable",
                "GameLog watcher capability is unavailable.",
            );
            self.emit_game_log_watcher_status("unavailable");
        }

        #[cfg(target_os = "linux")]
        if is_host_capability_available(HostCapability::GameLogWatcher) {
            match vrcx_0_host::vrchat_paths::discover_linux_vrchat_log_paths() {
                Ok(paths) => {
                    let latest_log = paths
                        .latest_log
                        .as_ref()
                        .map(|path| path.display().to_string())
                        .unwrap_or_else(|| "pending".to_string());
                    tracing::info!(
                        log_dir = %paths.app_data.display(),
                        latest_log,
                        "starting Linux GameLog watcher"
                    );
                    if let Err(error) = self.game_log_runtime.prime_log_watcher(&self.log_watcher) {
                        tracing::warn!("failed to prime GameLog watcher from runtime DB: {error}");
                    }
                    self.log_watcher
                        .start_without_process_monitor(paths.app_data);
                    self.runtime_context
                        .background_jobs
                        .mark_running("gameLogWatcher", "Linux GameLog watcher is active.");
                    self.emit_game_log_watcher_status("running");
                }
                Err(reason) => {
                    tracing::warn!(reason, "Linux GameLog watcher is unavailable");
                    self.runtime_context.background_jobs.register_job(
                        "gameLogWatcher",
                        "rust-host",
                        None,
                        "unavailable",
                        reason,
                    );
                    self.emit_game_log_watcher_status("unavailable");
                }
            }
        }

        #[cfg(target_os = "linux")]
        if !is_host_capability_available(HostCapability::GameLogWatcher) {
            self.runtime_context.background_jobs.register_job(
                "gameLogWatcher",
                "rust-host",
                None,
                "unavailable",
                _host_capabilities
                    .game_log_watcher
                    .reason
                    .clone()
                    .unwrap_or_else(|| "GameLog watcher capability is unavailable.".into()),
            );
            self.emit_game_log_watcher_status("unavailable");
        }

        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        {
            let _ = _host_capabilities;
            self.runtime_context.background_jobs.register_job(
                "gameLogWatcher",
                "rust-host",
                None,
                "unavailable",
                "GameLog watcher is unavailable on this platform.",
            );
            self.emit_game_log_watcher_status("unavailable");
        }
    }

    fn emit_game_log_watcher_status(&self, status: &str) {
        let snapshot = self.backend_runtime.set_game_log_status(status);
        self.emit_backend_runtime_telemetry_snapshot("gameLogWatcher", status, snapshot);
    }

    fn emit_backend_runtime_telemetry(&self, kind: &str, detail: impl Into<String>) {
        self.emit_backend_runtime_telemetry_snapshot(kind, detail, self.backend_runtime.snapshot());
    }

    fn emit_backend_runtime_telemetry_snapshot(
        &self,
        kind: &str,
        detail: impl Into<String>,
        snapshot: BackendRuntimeSnapshot,
    ) {
        self.runtime_context.event_bus.emit(
            "backendRuntimeTelemetry",
            BackendRuntimeTelemetry {
                kind: kind.into(),
                detail: detail.into(),
                snapshot,
            },
        );
    }
}

struct ProfileLock {
    inner: Mutex<Option<ProfileLockGuard>>,
}

struct BackendStartGuard<'a> {
    flag: &'a AtomicBool,
}

impl<'a> BackendStartGuard<'a> {
    fn try_acquire(flag: &'a AtomicBool) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self { flag })
    }
}

impl Drop for BackendStartGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::Release);
    }
}

struct ProfileLockGuard {
    path: PathBuf,
    _file: File,
}

impl ProfileLock {
    fn acquire(app_data: &Path) -> Result<Self> {
        std::fs::create_dir_all(app_data)?;
        let path = app_data.join(PROFILE_LOCK_FILE);
        let mut file = open_profile_lock_file(&path)?;
        let _ = file.set_len(0);
        let _ = writeln!(file, "{}", std::process::id());
        Ok(Self {
            inner: Mutex::new(Some(ProfileLockGuard { path, _file: file })),
        })
    }

    fn release(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.take();
        }
    }
}

impl Drop for ProfileLockGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

#[cfg(target_os = "windows")]
fn open_profile_lock_file(path: &Path) -> Result<File> {
    use std::os::windows::fs::OpenOptionsExt as _;

    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .share_mode(0)
        .open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                crate::Error::Custom(format!(
                    "VRCX-0 profile is already in use: {}",
                    path.display()
                ))
            } else {
                crate::Error::Io(error)
            }
        })
}

#[cfg(not(target_os = "windows"))]
fn open_profile_lock_file(path: &Path) -> Result<File> {
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(file) => Ok(file),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            if profile_lock_pid_is_stale(path) {
                let _ = std::fs::remove_file(path);
                return OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(path)
                    .map_err(crate::Error::Io);
            }
            Err(crate::Error::Custom(format!(
                "VRCX-0 profile is already in use: {}",
                path.display()
            )))
        }
        Err(error) => Err(crate::Error::Io(error)),
    }
}

#[cfg(not(target_os = "windows"))]
fn profile_lock_pid_is_stale(path: &Path) -> bool {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return false;
    };
    let Ok(pid) = contents.trim().parse::<u32>() else {
        return false;
    };
    if pid == std::process::id() {
        return false;
    }
    !vrcx_0_host::process_status::is_process_running(pid)
}

struct AuthenticatedRuntimeSession {
    user_id: String,
    display_name: String,
    endpoint: String,
    websocket: String,
    current_user: serde_json::Value,
}

impl AuthenticatedRuntimeSession {
    fn from_user(user: serde_json::Value, endpoint: String, websocket: String) -> Self {
        let user_id = string_field(&user, "id").unwrap_or_default();
        let display_name = string_field(&user, "displayName")
            .or_else(|| string_field(&user, "username"))
            .unwrap_or_else(|| user_id.clone());
        Self {
            user_id,
            display_name,
            endpoint: normalize_vrchat_api_endpoint(Some(&endpoint)),
            websocket: normalize_websocket_domain(&websocket),
            current_user: user,
        }
    }
}

enum NonInteractiveAuthError {
    InteractionRequired(String),
    Failed(String),
}

fn parse_current_user_response(
    response: HttpApiExecuteResponse,
) -> std::result::Result<serde_json::Value, NonInteractiveAuthError> {
    let json = serde_json::from_str::<serde_json::Value>(&response.data)
        .map_err(|error| NonInteractiveAuthError::Failed(error.to_string()))?;
    if json
        .get("requiresTwoFactorAuth")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|methods| !methods.is_empty())
    {
        return Err(NonInteractiveAuthError::InteractionRequired(
            "需要 GUI 重新认证：账号需要 2FA/OTP。".into(),
        ));
    }
    if !(200..=399).contains(&response.status) {
        let message = string_field(&json, "message")
            .or_else(|| {
                json.get("error")
                    .and_then(|value| value.as_str())
                    .map(ToOwned::to_owned)
            })
            .unwrap_or_else(|| {
                format!("VRChat auth request failed with HTTP {}.", response.status)
            });
        return Err(NonInteractiveAuthError::Failed(message));
    }
    if string_field(&json, "id").unwrap_or_default().is_empty() {
        return Err(NonInteractiveAuthError::Failed(
            "The auth request did not return a current user payload.".into(),
        ));
    }
    Ok(json)
}

fn string_field(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .as_object()
        .and_then(|object| object.get(key))
        .and_then(|value| match value {
            serde_json::Value::String(value) => Some(value.trim().to_string()),
            serde_json::Value::Number(value) => Some(value.to_string()),
            serde_json::Value::Bool(value) => Some(value.to_string()),
            _ => None,
        })
        .filter(|value| !value.is_empty())
}
