use serde::Serialize;

use crate::error::AppError;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityStatus {
    pub supported: bool,
    pub enabled: bool,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostCapabilities {
    pub platform: String,
    pub arch: String,
    pub local_database: CapabilityStatus,
    pub websocket_runtime: CapabilityStatus,
    pub game_log_watcher: CapabilityStatus,
    pub game_process_monitor: CapabilityStatus,
    pub vrchat_path_discovery: CapabilityStatus,
    pub steam_library_discovery: CapabilityStatus,
    pub steam_runtime_integration: CapabilityStatus,
    pub registry_prefs: CapabilityStatus,
    pub game_launch: CapabilityStatus,
    pub ipc: CapabilityStatus,
    pub vrchat_launch_pipe: CapabilityStatus,
    pub screenshot_cache: CapabilityStatus,
}

#[derive(Clone, Copy, Debug)]
pub enum HostCapability {
    GameLogWatcher,
    GameProcessMonitor,
    VrchatPathDiscovery,
    RegistryPrefs,
    GameLaunch,
    Ipc,
    VrchatLaunchPipe,
    ScreenshotCache,
}

impl CapabilityStatus {
    fn available() -> Self {
        Self {
            supported: true,
            enabled: true,
            available: true,
            reason: None,
        }
    }

    #[cfg(target_os = "linux")]
    fn unavailable(reason: &str) -> Self {
        Self {
            supported: true,
            enabled: true,
            available: false,
            reason: Some(reason.to_string()),
        }
    }

    fn unsupported(label: &str, platform: &str) -> Self {
        Self {
            supported: false,
            enabled: false,
            available: false,
            reason: Some(format!("{label} is not supported on {platform}")),
        }
    }
}

impl HostCapabilities {
    fn status(&self, capability: HostCapability) -> &CapabilityStatus {
        match capability {
            HostCapability::GameLogWatcher => &self.game_log_watcher,
            HostCapability::GameProcessMonitor => &self.game_process_monitor,
            HostCapability::VrchatPathDiscovery => &self.vrchat_path_discovery,
            HostCapability::RegistryPrefs => &self.registry_prefs,
            HostCapability::GameLaunch => &self.game_launch,
            HostCapability::Ipc => &self.ipc,
            HostCapability::VrchatLaunchPipe => &self.vrchat_launch_pipe,
            HostCapability::ScreenshotCache => &self.screenshot_cache,
        }
    }
}

impl HostCapability {
    fn label(self) -> &'static str {
        match self {
            HostCapability::GameLogWatcher => "GameLog watcher",
            HostCapability::GameProcessMonitor => "Game process monitor",
            HostCapability::VrchatPathDiscovery => "VRChat path discovery",
            HostCapability::RegistryPrefs => "VRChat registry preferences",
            HostCapability::GameLaunch => "Game launch",
            HostCapability::Ipc => "IPC",
            HostCapability::VrchatLaunchPipe => "VRChat launch pipe",
            HostCapability::ScreenshotCache => "Screenshot cache",
        }
    }
}

pub fn current_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "unknown"
    }
}

pub fn current_arch() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        "unknown"
    }
}

pub fn current_host_capabilities() -> HostCapabilities {
    let platform = current_platform();
    let arch = current_arch();
    let available = CapabilityStatus::available();

    match platform {
        "windows" => HostCapabilities {
            platform: platform.to_string(),
            arch: arch.to_string(),
            local_database: available.clone(),
            websocket_runtime: available.clone(),
            game_log_watcher: available.clone(),
            game_process_monitor: available.clone(),
            vrchat_path_discovery: available.clone(),
            steam_library_discovery: available.clone(),
            steam_runtime_integration: available.clone(),
            registry_prefs: available.clone(),
            game_launch: available.clone(),
            ipc: available.clone(),
            vrchat_launch_pipe: available.clone(),
            screenshot_cache: available,
        },
        #[cfg(target_os = "linux")]
        "linux" => linux_host_capabilities(platform, &available),
        "macos" => HostCapabilities {
            platform: platform.to_string(),
            arch: arch.to_string(),
            local_database: available.clone(),
            websocket_runtime: available,
            game_log_watcher: CapabilityStatus::unsupported("GameLog watcher", "macOS"),
            game_process_monitor: CapabilityStatus::unsupported("Game process monitor", "macOS"),
            vrchat_path_discovery: CapabilityStatus::unsupported("VRChat path discovery", "macOS"),
            steam_library_discovery: CapabilityStatus::unsupported(
                "Steam library discovery",
                "macOS",
            ),
            steam_runtime_integration: CapabilityStatus::unsupported(
                "Steam runtime integration",
                "macOS",
            ),
            registry_prefs: CapabilityStatus::unsupported("VRChat registry preferences", "macOS"),
            game_launch: CapabilityStatus::unsupported("Game launch", "macOS"),
            ipc: CapabilityStatus::unsupported("IPC", "macOS"),
            vrchat_launch_pipe: CapabilityStatus::unsupported("VRChat launch pipe", "macOS"),
            screenshot_cache: CapabilityStatus::unsupported("Screenshot cache", "macOS"),
        },
        _ => HostCapabilities {
            platform: platform.to_string(),
            arch: arch.to_string(),
            local_database: available.clone(),
            websocket_runtime: available,
            game_log_watcher: CapabilityStatus::unsupported("GameLog watcher", platform),
            game_process_monitor: CapabilityStatus::unsupported("Game process monitor", platform),
            vrchat_path_discovery: CapabilityStatus::unsupported("VRChat path discovery", platform),
            steam_library_discovery: CapabilityStatus::unsupported(
                "Steam library discovery",
                platform,
            ),
            steam_runtime_integration: CapabilityStatus::unsupported(
                "Steam runtime integration",
                platform,
            ),
            registry_prefs: CapabilityStatus::unsupported("VRChat registry preferences", platform),
            game_launch: CapabilityStatus::unsupported("Game launch", platform),
            ipc: CapabilityStatus::unsupported("IPC", platform),
            vrchat_launch_pipe: CapabilityStatus::unsupported("VRChat launch pipe", platform),
            screenshot_cache: CapabilityStatus::unsupported("Screenshot cache", platform),
        },
    }
}

#[cfg(target_os = "linux")]
fn linux_host_capabilities(platform: &str, available: &CapabilityStatus) -> HostCapabilities {
    let steam_library_discovery =
        match crate::domain::vrchat_paths::discover_linux_steam_libraries() {
            Ok(_) => available.clone(),
            Err(reason) => CapabilityStatus::unavailable(&reason),
        };

    let vrchat_path_discovery = match crate::domain::vrchat_paths::discover_linux_vrchat_paths() {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&reason),
    };
    let game_log_watcher = match crate::domain::vrchat_paths::discover_linux_vrchat_log_paths() {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&reason),
    };
    let game_launch = match crate::domain::vrchat_paths::discover_linux_game_launch() {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&reason),
    };
    let registry_prefs = match crate::domain::linux_registry::discover_linux_registry_context() {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&reason),
    };
    let vrchat_launch_pipe = match crate::domain::linux_registry::discover_linux_registry_context()
    {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&format!(
            "VRChat launch pipe bridge unavailable: {reason}"
        )),
    };
    let screenshot_cache = match crate::domain::vrchat_paths::discover_linux_screenshot_cache() {
        Ok(_) => available.clone(),
        Err(reason) => CapabilityStatus::unavailable(&reason),
    };

    HostCapabilities {
        platform: platform.to_string(),
        arch: current_arch().to_string(),
        local_database: available.clone(),
        websocket_runtime: available.clone(),
        game_log_watcher,
        game_process_monitor: available.clone(),
        vrchat_path_discovery: vrchat_path_discovery.clone(),
        steam_library_discovery,
        steam_runtime_integration: CapabilityStatus::unsupported(
            "Steam runtime integration",
            "Linux",
        ),
        registry_prefs,
        game_launch,
        ipc: CapabilityStatus::unsupported("IPC", "Linux"),
        vrchat_launch_pipe,
        screenshot_cache,
    }
}

pub fn require_host_capability(capability: HostCapability) -> Result<(), AppError> {
    let capabilities = current_host_capabilities();
    let status = capabilities.status(capability);
    if status.available {
        return Ok(());
    }

    Err(AppError::Custom(status.reason.clone().unwrap_or_else(
        || {
            format!(
                "{} is unavailable on {}",
                capability.label(),
                capabilities.platform
            )
        },
    )))
}

pub fn require_host_capability_supported(capability: HostCapability) -> Result<(), AppError> {
    let capabilities = current_host_capabilities();
    let status = capabilities.status(capability);
    if status.supported && status.enabled {
        return Ok(());
    }

    Err(AppError::Custom(status.reason.clone().unwrap_or_else(
        || {
            format!(
                "{} is unsupported on {}",
                capability.label(),
                capabilities.platform
            )
        },
    )))
}

pub fn is_host_capability_available(capability: HostCapability) -> bool {
    current_host_capabilities().status(capability).available
}
