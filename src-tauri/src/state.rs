use std::ops::Deref;
use std::sync::Arc;
use std::sync::Mutex;

use crate::adapters::ipc::{IpcEventSink, IpcServer};
use crate::adapters::log_watcher::LogWatcherCompatBridge;
use crate::error::AppError;
use vrcx_0_runtime_host::{RuntimeHostOptions, RuntimeHostState};

pub const BACKGROUND_MODE_RESUME_ROUTE_STORAGE_KEY: &str = "VRCX_BackgroundModeResumeRoute";

pub struct AppState {
    pub runtime: RuntimeHostState,
    pub log_watcher_compat_bridge: LogWatcherCompatBridge,
    pub ipc: IpcServer,
    background_resume_route: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Result<Self, AppError> {
        let launched_from_autostart = std::env::args().any(|arg| arg == "--autostart");
        let runtime = RuntimeHostState::new(RuntimeHostOptions {
            realtime_origin: realtime_origin(),
            launched_from_autostart,
        })?;
        let ipc_sink: Arc<dyn IpcEventSink> = runtime.game_client_runtime.clone();
        let ipc = IpcServer::new(Some(ipc_sink));
        let log_watcher_compat_bridge = LogWatcherCompatBridge::new();

        Ok(Self {
            runtime,
            log_watcher_compat_bridge,
            ipc,
            background_resume_route: Mutex::new(None),
        })
    }

    pub fn set_background_resume_route(&self, route: Option<String>) {
        if let Ok(mut slot) = self.background_resume_route.lock() {
            *slot = route;
        }
    }

    pub fn take_background_resume_route(&self) -> Option<String> {
        self.background_resume_route.lock().ok()?.take()
    }
}

impl Deref for AppState {
    type Target = RuntimeHostState;

    fn deref(&self) -> &Self::Target {
        &self.runtime
    }
}

fn realtime_origin() -> String {
    if cfg!(debug_assertions) {
        "http://localhost:9000".into()
    } else {
        "http://tauri.localhost".into()
    }
}
