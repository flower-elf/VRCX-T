use std::path::PathBuf;

use crate::domain::auto_launch::AutoAppLaunchManager;
use crate::domain::database::DatabaseService;
use crate::domain::image_cache::ImageCache;
use crate::domain::ipc::IpcServer;
use crate::domain::log_watcher::LogWatcher;
use crate::domain::ovrtoolkit::OvrToolkit;
use crate::domain::process_monitor::ProcessMonitor;
use crate::domain::screenshot::MetadataCacheDb;
use crate::domain::storage::StorageService;
use crate::domain::update::UpdateManager;
use crate::domain::web_client::WebClient;
use crate::error::AppError;

pub struct AppPaths {
    pub app_data: PathBuf,
    pub db_file: PathBuf,
    pub config_file: PathBuf,
    pub image_cache: PathBuf,
}

pub struct AppState {
    pub paths: AppPaths,
    pub storage: StorageService,
    pub db: DatabaseService,
    pub process_monitor: ProcessMonitor,
    pub log_watcher: LogWatcher,
    pub web: WebClient,
    pub image_cache: ImageCache,
    pub update_manager: UpdateManager,
    pub ovrtoolkit: OvrToolkit,
    pub ipc: IpcServer,
    pub screenshot_cache: MetadataCacheDb,

    pub auto_launch: AutoAppLaunchManager,
}

impl AppState {
    pub fn new() -> Result<Self, AppError> {
        let app_data = dirs::config_dir()
            .ok_or_else(|| AppError::Custom("cannot resolve AppData".into()))?
            .join("VRCX-0");

        std::fs::create_dir_all(&app_data)?;

        let paths = AppPaths {
            db_file: app_data.join("VRCX-0.sqlite3"),
            config_file: app_data.join("VRCX-0.json"),
            image_cache: app_data.join("ImageCache"),
            app_data,
        };

        try_copy_legacy_vrcx_data(&paths)?;

        let storage = StorageService::new(&paths.config_file)?;

        let db_path = storage
            .get("VRCX-0_DatabaseLocation")
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| paths.db_file.clone());

        let db = DatabaseService::new(&db_path)?;
        let process_monitor = ProcessMonitor::new();
        let log_watcher = LogWatcher::new();
        let web = WebClient::new(&storage, &db)?;
        let image_cache =
            ImageCache::new(paths.image_cache.clone(), web.cookie_jar(), web.proxy_url())?;
        let update_manager = UpdateManager::new(paths.app_data.clone(), web.proxy_url());
        let ovrtoolkit = OvrToolkit::new();
        let ipc = IpcServer::new();
        let screenshot_cache = MetadataCacheDb::new(&paths.app_data.join("metadataCache.db"))
            .map_err(|e| AppError::Custom(format!("screenshot cache: {e}")))?;

        let auto_launch = AutoAppLaunchManager::new(&paths.app_data);

        Ok(Self {
            paths,
            storage,
            db,
            process_monitor,
            log_watcher,
            web,
            image_cache,
            update_manager,
            ovrtoolkit,
            ipc,
            screenshot_cache,
            auto_launch,
        })
    }
}

fn try_copy_legacy_vrcx_data(paths: &AppPaths) -> Result<(), AppError> {
    if paths.db_file.exists() || paths.config_file.exists() {
        return Ok(());
    }

    let Some(base_app_data) = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(dirs::config_dir)
    else {
        return Ok(());
    };

    let legacy_dir = base_app_data.join("VRCX");
    if !legacy_dir.exists() {
        return Ok(());
    }

    copy_if_exists(legacy_dir.join("VRCX.sqlite3"), paths.db_file.clone())?;
    copy_if_exists(
        legacy_dir.join("VRCX.sqlite3-shm"),
        paths.app_data.join("VRCX-0.sqlite3-shm"),
    )?;
    copy_if_exists(
        legacy_dir.join("VRCX.sqlite3-wal"),
        paths.app_data.join("VRCX-0.sqlite3-wal"),
    )?;
    copy_if_exists(legacy_dir.join("VRCX.json"), paths.config_file.clone())?;

    Ok(())
}

fn copy_if_exists(from: PathBuf, to: PathBuf) -> Result<(), AppError> {
    if !from.exists() || to.exists() {
        return Ok(());
    }

    std::fs::copy(&from, &to)?;
    Ok(())
}
