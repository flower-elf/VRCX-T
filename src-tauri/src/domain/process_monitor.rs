use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter};

use super::auto_launch::AutoAppLaunchManager;
use super::log_watcher::LogWatcher;

pub struct ProcessMonitor {
    game_running: Arc<AtomicBool>,
    steamvr_running: Arc<AtomicBool>,
}

impl ProcessMonitor {
    pub fn new() -> Self {
        Self {
            game_running: Arc::new(AtomicBool::new(false)),
            steamvr_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(
        &self,
        app_handle: AppHandle,
        auto_launch: AutoAppLaunchManager,
        log_watcher: LogWatcher,
    ) {
        let game = Arc::clone(&self.game_running);
        let steamvr = Arc::clone(&self.steamvr_running);

        std::thread::spawn(move || {
            let mut sys = System::new();
            let mut first_poll = true;

            loop {
                sys.refresh_processes(ProcessesToUpdate::All, true);

                let mut game_found = false;
                let mut steamvr_found = false;

                for proc in sys.processes().values() {
                    let name = proc.name().to_string_lossy();
                    if !game_found && is_vrchat_process_name(&name) {
                        game_found = true;
                    }
                    if !steamvr_found && is_steamvr_process_name(&name) {
                        steamvr_found = true;
                    }
                    if game_found && steamvr_found {
                        break;
                    }
                }

                let prev_game = game.swap(game_found, Ordering::Relaxed);
                let prev_steamvr = steamvr.swap(steamvr_found, Ordering::Relaxed);

                if first_poll || prev_game != game_found {
                    log_watcher.set_game_running(game_found);
                }

                if prev_game != game_found || prev_steamvr != steamvr_found {
                    let _ = app_handle.emit(
                        "updateIsGameRunning",
                        serde_json::json!({
                            "isGameRunning": game_found,
                            "isSteamVRRunning": steamvr_found,
                        }),
                    );
                }

                if first_poll {
                    first_poll = false;
                } else if prev_game != game_found {
                    if game_found {
                        auto_launch.on_game_started(steamvr_found);
                    } else {
                        auto_launch.on_game_stopped();
                    }
                }

                std::thread::sleep(Duration::from_secs(1));
            }
        });
    }

    pub fn is_game_running(&self) -> bool {
        self.game_running.load(Ordering::Relaxed)
    }

    pub fn is_steamvr_running(&self) -> bool {
        self.steamvr_running.load(Ordering::Relaxed)
    }
}

#[cfg(target_os = "linux")]
fn is_vrchat_process_name(name: &str) -> bool {
    name == "VRChat.exe"
}

#[cfg(not(target_os = "linux"))]
fn is_vrchat_process_name(name: &str) -> bool {
    name.starts_with("VRChat")
}

#[cfg(target_os = "linux")]
fn is_steamvr_process_name(name: &str) -> bool {
    name == "vrmonitor" || name == "monado-service" || name.ends_with("wivrn-server")
}

#[cfg(not(target_os = "linux"))]
fn is_steamvr_process_name(name: &str) -> bool {
    name.starts_with("vrserver")
}

#[cfg(test)]
mod tests {
    use super::{is_steamvr_process_name, is_vrchat_process_name};

    #[test]
    #[cfg(target_os = "linux")]
    fn linux_vrchat_process_name_matches_vue_electron_backend() {
        assert!(is_vrchat_process_name("VRChat.exe"));
        assert!(!is_vrchat_process_name("VRChat"));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn linux_steamvr_process_name_matches_vue_electron_backend() {
        assert!(is_steamvr_process_name("vrmonitor"));
        assert!(is_steamvr_process_name("monado-service"));
        assert!(is_steamvr_process_name("WiVRn-wivrn-server"));
        assert!(!is_steamvr_process_name("vrserver"));
    }

    #[test]
    #[cfg(not(target_os = "linux"))]
    fn non_linux_process_name_matching_keeps_existing_behavior() {
        assert!(is_vrchat_process_name("VRChat.exe"));
        assert!(is_vrchat_process_name("VRChat"));
        assert!(is_steamvr_process_name("vrserver"));
        assert!(is_steamvr_process_name("vrserver.exe"));
    }
}
