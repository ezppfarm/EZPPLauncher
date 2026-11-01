use crate::config::ConfigError;
use hardware_id::get_id;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::io::Read;
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "macos"))]
use std::process::Stdio;
use sysinfo::System;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri::WindowEvent;
use tauri_plugin_fs::FsExt;
use tokio::fs;
use tokio::io::AsyncWriteExt;
#[cfg(not(target_os = "macos"))]
use tokio::process::Command;
#[cfg(not(target_os = "macos"))]
use tokio::time::{Duration, sleep};

use crate::logging;
use crate::osudb::parse_osudb;
use crate::presence;
use crate::state::AppState;
#[cfg(all(not(windows), not(target_os = "macos")))]
use crate::utils::get_osuwinello_path;
use crate::utils::{
    encrypt_password, get_osu_config, get_osu_user_config, is_net8_installed, is_osu_process,
    is_osuwinello_available, is_wmctrl_available, set_osu_config_vals, set_osu_user_config_vals,
};
#[cfg(not(target_os = "macos"))]
use crate::utils::{get_window_title_by_pid, is_osu_game_process, is_valid_osu_folder};

#[tauri::command]
pub fn opened_urls(app: tauri::AppHandle) -> Vec<PathBuf> {
    let args = app.state::<AppState>().opened_files.lock().unwrap().clone();
    app.state::<AppState>().opened_files.lock().unwrap().clear();

    args
}

#[tauri::command]
pub fn get_launcher_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Forward a webview console message to the launcher log file.
#[tauri::command]
pub fn log_frontend(level: String, message: String) {
    let message: String = message.chars().take(16_000).collect();

    match level.as_str() {
        "error" => log::error!(target: "launcher", "[webview] {message}"),
        "warn" => log::warn!(target: "launcher", "[webview] {message}"),
        "debug" => log::debug!(target: "launcher", "[webview] {message}"),
        "trace" => log::trace!(target: "launcher", "[webview] {message}"),
        _ => log::info!(target: "launcher", "[webview] {message}"),
    }
}

#[tauri::command]
pub fn set_logging_enabled(enabled: bool) {
    logging::set_logging_enabled(enabled);
}

#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let dir = logging::logs_directory();
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create the logs folder: {error}"))?;

    open::that(&dir).map_err(|error| format!("Failed to open the logs folder: {error}"))
}

/// Return the byte size of a regular file. Used by the theme editor to
/// validate and size picked assets without granting the webview broad fs reads.
#[tauri::command]
pub fn file_size(path: String) -> Option<u64> {
    let metadata = std::fs::metadata(path).ok()?;
    metadata.is_file().then_some(metadata.len())
}

#[tauri::command]
pub fn get_hwid() -> String {
    get_id()
        .unwrap_or("recorderinsandybridge".to_string())
}

/// Show the native macOS picker, which can select `osu!.app` bundles as files.
/// The regular Tauri dialog opens app bundles as folders on macOS.
#[tauri::command]
pub async fn pick_osu_installation(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(crate::macos::pick_osu_installation());
        })
        .map_err(|error| format!("Could not open the osu! picker: {error}"))?;

        let picked = tauri::async_runtime::spawn_blocking(move || rx.recv())
            .await
            .map_err(|error| format!("Could not open the osu! picker: {error}"))?;

        picked
            .map_err(|_| "The osu! picker closed unexpectedly".to_string())?
            .map(|path| path.map(|path| path.to_string_lossy().into_owned()))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn valid_osu_folder(folder: String) -> bool {
    normalized_osu_folder(&folder).is_some()
}

/// Resolve a selected path (osu! folder, `.app` wrapper, Wine prefix or drive_c)
/// to the actual osu! installation folder. Returns `None` if it is not valid.
#[tauri::command(rename_all = "snake_case")]
pub fn resolve_osu_folder(folder: String) -> Option<String> {
    normalized_osu_folder(&folder).map(|path| path.to_string_lossy().into_owned())
}

#[cfg(target_os = "macos")]
fn normalized_osu_folder(folder: &str) -> Option<PathBuf> {
    crate::macos::resolve_osu_folder(Path::new(folder))
}

#[cfg(not(target_os = "macos"))]
fn normalized_osu_folder(folder: &str) -> Option<PathBuf> {
    let path = PathBuf::from(folder);
    is_valid_osu_folder(&path).then_some(path)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallationDiagnostics {
    pub platform: String,
    pub os_version: Option<String>,
    pub os_arch: String,
    pub launcher_version: String,
    pub osu_folder: String,
    pub resolved_folder: Option<String>,
    pub osu_writable: Option<bool>,
    pub patcher_path: Option<String>,
    pub patcher_installed: bool,
    pub patcher_file_count: usize,
    pub patcher_total_size: u64,
    pub host_net8: bool,
    pub osuwinello: bool,
    pub wmctrl: bool,
    pub wine_prefix: Option<String>,
    pub wine_binary: Option<String>,
    pub wine_app_bundle: Option<String>,
    pub wine_version: Option<String>,
    pub wine_prefix_arch: Option<String>,
    pub wine_net8: Option<bool>,
    pub wine_error: Option<String>,
    pub ffmpeg_status: Option<String>,
    pub logs_directory: String,
}

fn directory_is_writable(path: &Path) -> bool {
    let probe = path.join(format!(".ezpplauncher-write-test-{}", std::process::id()));
    let _ = std::fs::remove_file(&probe);
    let writable = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .is_ok();
    let _ = std::fs::remove_file(&probe);
    writable
}

fn osu_install_writable(osu_folder: &Path) -> bool {
    if !directory_is_writable(osu_folder) {
        return false;
    }

    let support_folder = osu_folder.join("EZPPLauncher");
    !support_folder.is_dir() || directory_is_writable(&support_folder)
}

fn patcher_file_stats(osu_folder: &Path) -> (usize, u64) {
    let Ok(entries) = std::fs::read_dir(osu_folder.join("EZPPLauncher/patcher")) else {
        return (0, 0);
    };

    entries
        .flatten()
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            metadata.is_file().then_some(metadata.len())
        })
        .fold((0, 0), |(count, total), size| (count + 1, total + size))
}

/// Collect the installation details shown in Settings → Diagnostics.
#[tauri::command]
pub async fn installation_diagnostics(app: AppHandle, folder: String) -> InstallationDiagnostics {
    let resolved = normalized_osu_folder(&folder);
    let resolved_folder = resolved
        .as_ref()
        .map(|path| path.to_string_lossy().into_owned());
    let patcher_path = resolved
        .as_ref()
        .map(|path| path.join("EZPPLauncher/patcher/osu!.patcher.exe"));
    let (patcher_file_count, patcher_total_size) = resolved
        .as_deref()
        .map(patcher_file_stats)
        .unwrap_or_default();

    let mut diagnostics = InstallationDiagnostics {
        platform: std::env::consts::OS.to_string(),
        os_version: System::long_os_version(),
        os_arch: std::env::consts::ARCH.to_string(),
        launcher_version: app.package_info().version.to_string(),
        osu_folder: folder,
        resolved_folder,
        osu_writable: resolved.as_deref().map(osu_install_writable),
        patcher_installed: patcher_path
            .as_ref()
            .map(|path| path.is_file())
            .unwrap_or(false),
        patcher_file_count,
        patcher_total_size,
        patcher_path: patcher_path.map(|path| path.to_string_lossy().into_owned()),
        host_net8: is_net8_installed().await,
        osuwinello: is_osuwinello_available(),
        wmctrl: is_wmctrl_available(),
        wine_prefix: None,
        wine_binary: None,
        wine_app_bundle: None,
        wine_version: None,
        wine_prefix_arch: None,
        wine_net8: None,
        wine_error: None,
        ffmpeg_status: None,
        logs_directory: logging::logs_directory().to_string_lossy().into_owned(),
    };

    #[cfg(target_os = "macos")]
    if let Some(path) = resolved {
        match crate::macos::WineDiagnostics::for_osu_folder(&path) {
            Ok(wine) => {
                diagnostics.wine_prefix = Some(wine.prefix.to_string_lossy().into_owned());
                diagnostics.wine_binary = Some(wine.wine_bin.to_string_lossy().into_owned());
                diagnostics.wine_app_bundle = wine
                    .app_bundle
                    .map(|bundle| bundle.to_string_lossy().into_owned());
                diagnostics.wine_version = wine.wine_version;
                diagnostics.wine_prefix_arch = wine.prefix_arch;
                diagnostics.wine_net8 = Some(wine.net8_installed);
            }
            Err(error) => diagnostics.wine_error = Some(error),
        }

        diagnostics.ffmpeg_status = theme_ffmpeg_status();
    }

    diagnostics
}

#[tauri::command]
pub fn find_osu_installation() -> Option<String> {
    find_osu_installation_impl()
}

#[cfg(windows)]
fn find_osu_installation_impl() -> Option<String> {
    use winreg::RegKey;
    use winreg::enums::*;

    let hklm_registry_paths = ["SOFTWARE\\Classes\\osu\\DefaultIcon"];

    let hkcu_registry_paths = [
        "Software\\Classes\\osustable.File.osk\\DefaultIcon",
        "Software\\Classes\\osustable.File.osr\\DefaultIcon",
        "Software\\Classes\\osustable.File.osz\\DefaultIcon",
    ];

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    for reg_path in &hklm_registry_paths {
        if let Ok(subkey) = hklm.open_subkey_with_flags(reg_path, KEY_READ | KEY_WOW64_32KEY) {
            let value_names = [""];
            for value_name in &value_names {
                if let Ok(value) = subkey.get_value::<String, _>(value_name) {
                    let trimmed = value.trim_matches('"');
                    let stripped = trimmed.strip_suffix(",0").unwrap_or(trimmed);
                    let path = PathBuf::from(stripped.trim());
                    if let Some(parent) = path.parent() {
                        if is_valid_osu_folder(parent) {
                            return Some(parent.to_string_lossy().into());
                        }
                    }
                }
            }
        }
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for reg_path in &hkcu_registry_paths {
        if let Ok(subkey) = hkcu.open_subkey_with_flags(reg_path, KEY_READ | KEY_WOW64_32KEY) {
            let value_names = [""];
            for value_name in &value_names {
                if let Ok(value) = subkey.get_value::<String, _>(value_name) {
                    let trimmed = value.trim_matches('"');
                    let stripped = trimmed.strip_suffix(",1").unwrap_or(trimmed);
                    let path = PathBuf::from(stripped.trim());
                    if let Some(parent) = path.parent() {
                        if is_valid_osu_folder(parent) {
                            return Some(parent.to_string_lossy().into());
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn find_osu_installation_impl() -> Option<String> {
    crate::macos::find_osu_installation()
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn find_osu_installation_impl() -> Option<String> {
    None
}

#[tauri::command]
pub async fn get_beatmapsets_count(folder: String) -> Option<u64> {
    let path = PathBuf::from(folder);
    let osu_db_path = path.join("osu!.db");
    if !osu_db_path.exists() {
        return Some(0);
    }
    let osu_db_bytes = fs::read(osu_db_path).await.ok()?;
    let osu_db = parse_osudb(osu_db_bytes).ok()?;
    let beatmap_sets = osu_db
        .beatmaps
        .iter()
        .map(|b| b.beatmapset_id)
        .collect::<HashSet<_>>()
        .len();
    Some(beatmap_sets as u64)
}

#[tauri::command]
pub async fn get_skins_count(folder: String) -> Option<u64> {
    let path = PathBuf::from(folder);
    let skins_folder = path.join("Skins");

    if !skins_folder.exists() {
        return Some(0);
    }

    let mut count = 0;
    if let Ok(mut entries) = fs::read_dir(skins_folder).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(ft) = entry.file_type().await
                && ft.is_dir() {
                    let dir_path = entry.path();
                    let has_ini = tokio::fs::try_exists(dir_path.join("skin.ini"))
                        .await
                        .unwrap_or(false)
                        || tokio::fs::try_exists(dir_path.join("Skin.ini"))
                            .await
                            .unwrap_or(false);
                    if has_ini {
                        count += 1;
                    }
                }
        }
    }
    Some(count)
}

#[tauri::command]
pub fn get_osu_skin(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_user_config = get_osu_user_config(path);
    osu_user_config
        .and_then(|config| config.get("Skin").cloned())
        .unwrap_or_else(|| "Default".to_string())
}

#[tauri::command]
pub fn get_osu_version(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_user_config = get_osu_user_config(path);
    osu_user_config
        .and_then(|config| config.get("LastVersion").cloned())
        .unwrap_or_else(|| "failed".to_string())
}

#[tauri::command]
pub fn get_osu_release_stream(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_config = get_osu_config(path);
    osu_config
        .and_then(|config| config.get("_ReleaseStream").cloned())
        .unwrap_or_else(|| "Stable40".to_string())
}

#[derive(serde::Deserialize)]
pub struct ConfigEntry {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub fn set_osu_user_config_values(
    osu_folder_path: String,
    entries: Vec<ConfigEntry>,
) -> Result<bool, String> {
    let converted: Vec<(&str, Option<&str>)> = entries
        .iter()
        .map(|entry| (entry.key.as_str(), Some(entry.value.as_str())))
        .collect();
    Ok(set_osu_user_config_vals(&osu_folder_path, &converted).is_ok())
}

#[tauri::command]
pub fn set_osu_config_values(
    osu_folder_path: String,
    entries: Vec<ConfigEntry>,
) -> Result<bool, String> {
    let converted: Vec<(&str, Option<&str>)> = entries
        .iter()
        .map(|entry| (entry.key.as_str(), Some(entry.value.as_str())))
        .collect();
    Ok(set_osu_config_vals(&osu_folder_path, &converted).is_ok())
}

#[tauri::command]
pub async fn run_osu_updater(folder: String) -> Result<(), String> {
    log::info!(target: "osu", "Starting the osu! updater for {folder}");

    #[cfg(target_os = "macos")]
    crate::macos::run_osu_updater(&folder).await?;

    #[cfg(not(target_os = "macos"))]
    {
        let mut updater_process = {
            #[cfg(windows)]
            {
                const DETACHED_PROCESS: u32 = 0x00000008;
                const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
                let osu_exe_path = PathBuf::from(&folder).join("osu!.exe");
                Command::new(&osu_exe_path)
                    .arg("-repair")
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                    .spawn()
                    .map_err(|e| {
                        log::error!(target: "osu", "Failed to spawn the osu! updater: {e}");
                        format!("Failed to spawn updater: {}", e)
                    })?
            }

            #[cfg(not(windows))]
            {
                let osu_wine_path = get_osuwinello_path().expect("osu-wine was not found");
                Command::new(&osu_wine_path)
                    .arg("-repair")
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| {
                        log::error!(target: "osu", "Failed to spawn the osu! updater: {e}");
                        format!("Failed to spawn updater: {}", e)
                    })?
            }
        };

        if let Some(pid) = updater_process.id() {
            log::info!(target: "osu", "osu! updater started (pid {pid})");
        }
        crate::logging::capture_osu_output(&mut updater_process);

        sleep(Duration::from_millis(500)).await;

        let mut sys = System::new_all();

        loop {
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

            let mut found = false;

            for (_pid, process) in sys.processes() {
                if is_osu_game_process(process) {
                    let pid = process.pid();
                    let title = get_window_title_by_pid(pid);

                    if !title.is_empty() && !title.contains("updater") {
                        let _ = process.kill_and_wait();
                        found = true;
                        break;
                    }
                }
            }

            if found {
                break;
            }

            sleep(Duration::from_millis(500)).await;
        }

        match updater_process.wait().await {
            Ok(status) => log::info!(target: "osu", "osu! updater exited with {status}"),
            Err(error) => log::warn!(target: "osu", "Could not wait for the osu! updater: {error}"),
        }
    }

    let force_update_files = [".require_update", "help.txt", "_pending"];
    for update_file_name in &force_update_files {
        let path = PathBuf::from(&folder).join(update_file_name);
        if path.exists() {
            match std::fs::symlink_metadata(&path) {
                Ok(meta) => {
                    let res = if meta.is_dir() {
                        std::fs::remove_dir_all(&path)
                    } else {
                        std::fs::remove_file(&path)
                    };

                    if let Err(e) = res {
                        log::warn!(target: "osu", "Failed to remove {:?}: {}", path, e);
                    }
                }
                Err(e) => {
                    log::warn!(target: "osu", "Could not stat {:?}: {}", path, e);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn run_osu(
    folder: String,
    patch: bool,
    game_optimization: Option<bool>,
) -> Result<(), String> {
    let optimize = game_optimization.unwrap_or(false);
    log::info!(target: "osu", "Launching osu! from {folder} (patch={patch}, optimize={optimize})");

    #[cfg(target_os = "macos")]
    {
        return crate::macos::run_osu(&folder, patch, optimize).await;
    }

    #[cfg(not(target_os = "macos"))]
    {
        #[cfg(windows)]
        const DETACHED_PROCESS: u32 = 0x00000008;
        #[cfg(windows)]
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        #[cfg(windows)]
        if optimize {
            #[link(name = "winmm")]
            extern "system" {
                fn timeBeginPeriod(uPeriod: u32) -> u32;
            }
            unsafe {
                timeBeginPeriod(1);
            }
            log::info!(target: "osu", "Game optimization: requested 1ms timer resolution");
        }

        let mut game_process = {
            #[cfg(windows)]
            {
                let osu_exe_path = PathBuf::from(&folder).join("osu!.exe");
                Command::new(&osu_exe_path)
                    .arg("-devserver")
                    .arg("ez-pp.farm")
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                    .spawn()
                    .map_err(|e| {
                        log::error!(target: "osu", "Failed to spawn osu!: {e}");
                        format!("Failed to spawn osu: {}", e)
                    })?
            }

            #[cfg(not(windows))]
            {
                let osu_wine_path = get_osuwinello_path().expect("osu-wine was not found");
                Command::new(&osu_wine_path)
                    .arg("--devserver")
                    .arg("ez-pp.farm")
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| {
                        log::error!(target: "osu", "Failed to spawn osu!: {e}");
                        format!("Failed to spawn osu: {}", e)
                    })?
            }
        };

        if let Some(pid) = game_process.id() {
            log::info!(target: "osu", "osu! started (pid {pid})");

            #[cfg(windows)]
            if optimize {
                unsafe {
                    use winapi::um::processthreadsapi::{OpenProcess, SetPriorityClass};
                    use winapi::um::winbase::HIGH_PRIORITY_CLASS;
                    use winapi::um::winnt::PROCESS_SET_INFORMATION;
                    let handle = OpenProcess(PROCESS_SET_INFORMATION, 0, pid);
                    if !handle.is_null() {
                        if SetPriorityClass(handle, HIGH_PRIORITY_CLASS) != 0 {
                            log::info!(target: "osu", "Game optimization: boosted osu! process priority to High (pid {pid})");
                        }
                        winapi::um::handleapi::CloseHandle(handle);
                    }
                }
            }
        }
        crate::logging::capture_osu_output(&mut game_process);

        if patch {
            let patcher_exe_path = PathBuf::from(&folder)
                .join("EZPPLauncher")
                .join("patcher")
                .join("osu!.patcher.exe");

            if patcher_exe_path.exists() {
                let mut sys = System::new_all();

                loop {
                    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

                    let mut found = false;

                    for (_pid, process) in sys.processes() {
                        if process.name() == "osu!.exe" {
                            let pid = process.pid();
                            let title = get_window_title_by_pid(pid);

                            if !title.is_empty() && !title.contains("updater") {
                                found = true;
                                break;
                            }
                        }
                    }

                    if found {
                        break;
                    }

                    sleep(Duration::from_millis(500)).await;
                }
                log::info!(target: "patcher", "Starting the patcher from {}", patcher_exe_path.display());

                #[cfg(windows)]
                let mut patcher_process = Command::new(&patcher_exe_path)
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                    .spawn()
                    .map_err(|e| {
                        log::error!(target: "patcher", "Failed to start the patcher: {e}");
                        format!("Failed to run patcher: {e}")
                    })?;

                #[cfg(not(windows))]
                let mut patcher_process = {
                    use crate::utils::get_osuwinello_path;

                    let osu_wine_path = get_osuwinello_path().expect("osu-wine was not found");
                    Command::new(&osu_wine_path)
                        .arg("--wine")
                        .arg(&patcher_exe_path)
                        .stdin(Stdio::null())
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .spawn()
                        .map_err(|e| {
                            log::error!(target: "patcher", "Failed to start the patcher: {e}");
                            format!("Failed to run patcher: {}", e)
                        })?
                };

                if let Some(pid) = patcher_process.id() {
                    log::info!(target: "patcher", "Patcher started (pid {pid})");
                }
                crate::logging::capture_patcher_output(&mut patcher_process);
            } else {
                log::warn!(
                    target: "patcher",
                    "Patcher was requested but {} does not exist",
                    patcher_exe_path.display()
                );
            }
        }

        let wait_res = game_process.wait().await;

        #[cfg(windows)]
        if optimize {
            #[link(name = "winmm")]
            extern "system" {
                fn timeEndPeriod(uPeriod: u32) -> u32;
            }
            unsafe {
                timeEndPeriod(1);
            }
            log::info!(target: "osu", "Game optimization: restored timer resolution");
        }

        match wait_res {
            Ok(status) => log::info!(target: "osu", "osu! exited with {status}"),
            Err(error) => {
                log::warn!(target: "osu", "Could not wait for osu!: {error}");
                return Err(error.to_string());
            }
        }

        Ok(())
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFile {
    pub name: String,
    pub folder: String,
    pub url: String,
    pub size: usize,
    pub md5: String,
}

#[tauri::command]
pub async fn get_ezpp_launcher_update_files(
    folder: String,
    update_url: String,
    update_stream: String,
) -> Result<(Vec<UpdateFile>, Vec<UpdateFile>), String> {
    let osu_path = PathBuf::from(folder);
    let client = Client::new();

    let update_files = client
        .patch(update_url)
        .header("User-Agent", "EZPPLauncher")
        .query(&[("stream", update_stream)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<UpdateFile>>()
        .await
        .map_err(|e| e.to_string())?;

    let mut files_to_download = Vec::new();

    for file in &update_files {
        let file_path = osu_path.join(&file.folder).join(&file.name);
        if file_path.exists() {
            let data = fs::read(&file_path).await.map_err(|e| e.to_string())?;
            let hash = format!("{:x}", md5::compute(&data));
            let matches = hash.eq_ignore_ascii_case(&file.md5)
                || (cfg!(target_os = "macos")
                    && file.name == "osu!.patcher.exe"
                    && crate::utils::is_compatible_patcher(&data));
            if !matches {
                files_to_download.push(file.clone());
            }
        } else {
            files_to_download.push(file.clone());
        }
    }

    Ok((files_to_download, update_files))
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub file_name: String,
    pub downloaded: u64,
    pub size: usize,
    pub progress: f64,
}

#[tauri::command]
pub async fn download_ezpp_launcher_update_files(
    app: AppHandle,
    folder: String,
    update_files: Vec<UpdateFile>,
    all_files: Vec<UpdateFile>,
) -> Result<(), String> {
    let osu_path = PathBuf::from(folder);
    let client = Client::new();

    let valid_paths: HashSet<PathBuf> = all_files
        .iter()
        .map(|f| osu_path.join(&f.folder).join(&f.name))
        .collect();

    for folder in all_files
        .iter()
        .map(|f| osu_path.join(&f.folder))
        .collect::<HashSet<_>>()
    {
        if folder.exists() && folder != osu_path {
            let mut dir = fs::read_dir(&folder).await.map_err(|e| e.to_string())?;
            while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
                let path = entry.path();
                if !valid_paths.contains(&path) {
                    fs::remove_file(&path).await.ok();
                }
            }
        }
    }

    for file in update_files {
        let file_path = osu_path.join(&file.folder).join(&file.name);
        let parent = file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| e.to_string())?;
        }

        let mut response = client
            .get(&file.url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let mut file_out = fs::File::create(&file_path)
            .await
            .map_err(|e| e.to_string())?;
        let mut downloaded = 0u64;

        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            downloaded += chunk.len() as u64;
            file_out
                .write_all(&chunk)
                .await
                .map_err(|e| e.to_string())?;

            app.emit(
                "download-progress",
                UpdateStatus {
                    file_name: file.name.clone(),
                    downloaded,
                    size: file.size,
                    progress: ((downloaded as f64 / file.size as f64 * 100.0) * 100.0).trunc()
                        / 100.0,
                },
            )
            .unwrap_or_default();
        }
    }

    #[cfg(target_os = "macos")]
    {
        let patcher_exe = osu_path.join("EZPPLauncher").join("patcher").join("osu!.patcher.exe");
        if patcher_exe.is_file() {
            let _ = crate::utils::ensure_patcher_compatibility(&patcher_exe);
        }
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(tag = "type", content = "details")]
pub enum ReplaceUIError {
    FileNotFound(String),
    IoError(String),
}

#[tauri::command]
pub fn replace_ui_files(folder: String, revert: bool) -> Result<(), ReplaceUIError> {
    let osu_path = PathBuf::from(folder);
    let ezpp_ui = osu_path.join("EZPPLauncher").join("ezpp!ui.dll");
    let osu_ui = osu_path.join("osu!ui.dll");
    let ezpp_seasonal = osu_path.join("EZPPLauncher").join("ezpp!seasonal.dll");
    let osu_seasonal = osu_path.join("osu!seasonal.dll");
    let ezpp_gameplay = osu_path.join("EZPPLauncher").join("ezpp!gameplay.dll");
    let osu_gameplay = osu_path.join("osu!gameplay.dll");

    let osu_ui_bak = osu_path.join("osu!ui.dll.bak");
    let osu_seasonal_bak = osu_path.join("osu!seasonal.dll.bak");
    let osu_gameplay_bak = osu_path.join("osu!gameplay.dll.bak");

    let temp_file = osu_path.join(".ezpplauncher_files");

    let copy_file = |source: &PathBuf, dest: &PathBuf, name: &str| -> Result<(), ReplaceUIError> {
        if !source.exists() {
            return Err(ReplaceUIError::FileNotFound(source.display().to_string()));
        }

        if dest.exists() {
            std::fs::remove_file(dest).map_err(|e| {
                ReplaceUIError::IoError(format!("Failed to remove {}: {}", name, e))
            })?;
        }

        std::fs::copy(source, dest)
            .map_err(|e| ReplaceUIError::IoError(format!("Failed to copy {}: {}", name, e)))?;
        Ok(())
    };

    let restore_backup =
        |bak: &PathBuf, dest: &PathBuf, name: &str| -> Result<(), ReplaceUIError> {
            if bak.exists() {
                if dest.exists() {
                    std::fs::remove_file(dest).map_err(|e| {
                        ReplaceUIError::IoError(format!("Failed to remove {}: {}", name, e))
                    })?;
                }
                std::fs::rename(bak, dest).map_err(|e| {
                    ReplaceUIError::IoError(format!("Failed to rename {} from backup: {}", name, e))
                })?;
            }
            Ok(())
        };

    if !revert {
        if osu_ui.exists() && !osu_ui_bak.exists() {
            std::fs::rename(&osu_ui, &osu_ui_bak).map_err(|e| {
                ReplaceUIError::IoError(format!("Failed to backup osu!ui.dll: {}", e))
            })?;
        }
        if osu_seasonal.exists() && !osu_seasonal_bak.exists() {
            std::fs::rename(&osu_seasonal, &osu_seasonal_bak).map_err(|e| {
                ReplaceUIError::IoError(format!("Failed to backup osu!seasonal.dll: {}", e))
            })?;
        }
        if osu_gameplay.exists() && !osu_gameplay_bak.exists() {
            std::fs::rename(&osu_gameplay, &osu_gameplay_bak).map_err(|e| {
                ReplaceUIError::IoError(format!("Failed to backup osu!gameplay.dll: {}", e))
            })?;
        }

        copy_file(&ezpp_ui, &osu_ui, "osu!ui.dll")?;
        copy_file(&ezpp_seasonal, &osu_seasonal, "osu!seasonal.dll")?;
        copy_file(&ezpp_gameplay, &osu_gameplay, "osu!gameplay.dll")?;

        std::fs::write(&temp_file, b"1")
            .map_err(|e| ReplaceUIError::IoError(format!("Failed to write marker file: {}", e)))?;
    } else {
        restore_backup(&osu_ui_bak, &osu_ui, "osu!ui.dll")?;
        restore_backup(&osu_seasonal_bak, &osu_seasonal, "osu!seasonal.dll")?;
        restore_backup(&osu_gameplay_bak, &osu_gameplay, "osu!gameplay.dll")?;

        if osu_ui.exists() && osu_seasonal.exists() && osu_gameplay.exists() {
            std::fs::remove_file(&temp_file).map_err(|e| {
                ReplaceUIError::IoError(format!("Failed to remove marker file: {}", e))
            })?;
        }
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(tag = "type", content = "details")]
pub enum CorruptionCheckError {
    IoError(String),
    FileNotFound(String),
}

#[tauri::command]
pub async fn check_for_corruption(folder: String) -> Result<bool, CorruptionCheckError> {
    let osu_path = PathBuf::from(folder);
    let osu_ui = osu_path.join("osu!ui.dll");
    let osu_gameplay = osu_path.join("osu!gameplay.dll");
    let osu_seasonal = osu_path.join("osu!seasonal.dll");

    let osu_ui_bak = osu_path.join("osu!ui.dll.bak");
    let osu_gameplay_bak = osu_path.join("osu!gameplay.dll.bak");
    let osu_seasonal_bak = osu_path.join("osu!seasonal.dll.bak");

    let temp_file = osu_path.join(".ezpplauncher_files");

    if temp_file.exists() {
        if osu_ui_bak.exists() {
            if osu_ui.exists() {
                fs::remove_file(&osu_ui).await.map_err(|e| {
                    CorruptionCheckError::IoError(format!("Failed to remove osu!ui.dll: {}", e))
                })?;
            }

            fs::rename(&osu_ui_bak, &osu_ui).await.map_err(|e| {
                CorruptionCheckError::IoError(format!(
                    "Failed to restore osu!ui.dll from backup: {}",
                    e
                ))
            })?;
        }
        if osu_gameplay_bak.exists() {
            if osu_gameplay.exists() {
                fs::remove_file(&osu_gameplay).await.map_err(|e| {
                    CorruptionCheckError::IoError(format!(
                        "Failed to remove osu!gameplay.dll: {}",
                        e
                    ))
                })?;
            }

            fs::rename(&osu_gameplay_bak, &osu_gameplay)
                .await
                .map_err(|e| {
                    CorruptionCheckError::IoError(format!(
                        "Failed to restore osu!gameplay.dll from backup: {}",
                        e
                    ))
                })?;
        }
        if osu_seasonal_bak.exists() {
            if osu_seasonal.exists() {
                fs::remove_file(&osu_seasonal).await.map_err(|e| {
                    CorruptionCheckError::IoError(format!(
                        "Failed to remove osu!seasonal.dll: {}",
                        e
                    ))
                })?;
            }

            fs::rename(&osu_seasonal_bak, &osu_seasonal)
                .await
                .map_err(|e| {
                    CorruptionCheckError::IoError(format!(
                        "Failed to restore osu!seasonal.dll from backup: {}",
                        e
                    ))
                })?;
        }
        return Ok(false);
    }

    if !osu_ui.exists() || !osu_gameplay.exists() || !osu_seasonal.exists() {
        return Ok(true);
    }

    Ok(false)
}

#[tauri::command]
pub fn is_osu_running() -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in sys.processes().values() {
        if is_osu_process(process) {
            return true;
        }
    }

    false
}

#[tauri::command]
pub fn open_url_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
pub fn exit(app: AppHandle) {
    app.exit(0x0100);
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub async fn presence_connect() -> bool {
    presence::connect().await
}

#[tauri::command]
pub async fn presence_disconnect() {
    presence::disconnect().await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceStatus {
    state: Option<String>,
    details: Option<String>,
    large_image_key: Option<String>,
}

#[tauri::command]
pub async fn presence_update_status(status: PresenceStatus) {
    presence::update_status(
        status.state.as_deref(),
        status.details.as_deref(),
        status.large_image_key.as_deref(),
    );
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceUser {
    username: Option<String>,
    id: Option<String>,
}

#[tauri::command]
pub async fn presence_update_user(user: PresenceUser) {
    presence::update_user(user.username.as_deref(), user.id.as_deref());
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceButton {
    text: Option<String>,
    url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceActivityPayload {
    pub state: Option<String>,
    pub details: Option<String>,
    pub large_image_key: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_key: Option<Option<String>>,
    pub small_image_text: Option<Option<String>>,
    pub button1: Option<Option<presence::PresenceButton>>,
    pub button2: Option<Option<presence::PresenceButton>>,
    pub show_timestamp: Option<bool>,
}

#[tauri::command]
pub async fn presence_update_activity(activity: PresenceActivityPayload) {
    presence::update_activity(
        activity.state.as_deref(),
        activity.details.as_deref(),
        activity.large_image_key.as_deref(),
        activity.large_image_text.as_deref(),
        activity.small_image_key,
        activity.small_image_text,
        activity.button1,
        activity.button2,
        activity.show_timestamp,
    );
}

#[tauri::command]
pub async fn presence_update_button(button: PresenceButton) {
    match (button.text.as_deref(), button.url.as_deref()) {
        (Some(text), Some(url)) => presence::set_button(text, url),
        _ => presence::clear_button(),
    }
}

#[tauri::command]
pub async fn presence_is_connected() -> bool {
    presence::has_presence().await
}

#[tauri::command]
pub fn has_wmctrl() -> bool {
    is_wmctrl_available()
}

#[tauri::command]
pub fn has_osuwinello() -> bool {
    is_osuwinello_available()
}

#[tauri::command]
pub async fn has_net8() -> bool {
    is_net8_installed().await
}

#[tauri::command]
pub fn encrypt_string(string: String, entropy: String) -> String {
    encrypt_password(&string, &entropy).unwrap_or(string)
}

#[tauri::command]
pub async fn download_ezpp_launcher_update(app: AppHandle, url: String) -> Result<(), String> {
    let client = Client::new();

    let mut response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Failed to download update: {}", response.status()));
    }

    let temp_dir = app.path().temp_dir().expect("Failed to get temp directory");
    let file_path = temp_dir.join("ezpplauncher_update.exe");

    let mut file_out = fs::File::create(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut downloaded = 0u64;
    let size = response
        .content_length()
        .ok_or("Failed to get content length")? as usize;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        downloaded += chunk.len() as u64;
        file_out
            .write_all(&chunk)
            .await
            .map_err(|e| e.to_string())?;

        app.emit(
            "download-progress",
            UpdateStatus {
                file_name: "Update".to_string(),
                downloaded,
                size,
                progress: ((downloaded as f64 / size as f64 * 100.0) * 100.0).trunc() / 100.0,
            },
        )
        .unwrap_or_default();
    }

    Ok(())
}

#[tauri::command]
pub async fn install_ezpp_launcher_update(app: AppHandle) -> Result<(), String> {
    #[cfg(not(windows))]
    let _ = app;

    #[cfg(windows)]
    {
        let temp_dir = app.path().temp_dir().expect("Failed to get temp directory");
        let file_path = temp_dir.join("ezpplauncher_update.exe");
        if !file_path.exists() {
            return Err("Update file does not exist".to_string());
        }

        // run this app detached and exit

        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        Command::new(&file_path)
            .arg("/S")
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map_err(|e| format!("Failed to spawn updater: {}", e))?;

        sleep(Duration::from_millis(250)).await;

        app.exit(0x0100);
    }

    Ok(())
}

#[tauri::command]
pub async fn run_open_tablet_driver(path: String) -> Result<(), String> {
    let otd_path = PathBuf::from(&path);
    if !otd_path.exists() {
        return Err(format!("OpenTabletDriver not found at: {}", path));
    }

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new(&otd_path)
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start OpenTabletDriver: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_open_tablet_driver() -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut sys = System::new_all();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let process = sys
            .processes()
            .values()
            .find(|p| p.name().eq_ignore_ascii_case("OpenTabletDriver.Daemon.exe"))
            .ok_or("OpenTabletDriver is not running")?;

        process.kill();
    }

    Ok(())
}

#[tauri::command]
pub fn is_open_tablet_driver_running() -> bool {
    #[cfg(windows)]
    {
        let mut sys = System::new_all();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        sys.processes()
            .values()
            .any(|p| p.name().eq_ignore_ascii_case("OpenTabletDriver.Daemon.exe"))
    }

    #[cfg(not(windows))]
    {
        true
    }
}

#[tauri::command]
pub async fn is_open_tablet_driver_path_valid(app: AppHandle, path: String) -> bool {
    #[cfg(not(windows))]
    let _ = (&app, &path);

    #[cfg(windows)]
    {
        app.fs_scope().allow_file(&path).ok();
        let otd_path = PathBuf::from(&path);
        otd_path.exists()
    }

    #[cfg(not(windows))]
    {
        true
    }
}

#[derive(Serialize, Clone)]
pub struct ExtractProgress {
    pub theme_name: String,
    pub total: usize,
    pub extracted: usize,
    pub progress: f64,
    pub current_file: String,
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub theme_name: String,
    pub received: u64,
    pub total: u64,
    pub progress: f64,
}

#[tauri::command]
pub async fn download_and_extract_theme(
    app: AppHandle,
    download_url: String,
    expected_sha: String,
    theme_folder: String,
    theme_name: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("Failed to download theme: {}", e))?;

    let total = response.content_length().unwrap_or(0);
    let mut received: u64 = 0;
    let mut chunks: Vec<u8> = Vec::new();

    let mut stream = response.bytes_stream();
    while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
        received += chunk.len() as u64;
        chunks.extend_from_slice(&chunk);
        let _ = app.emit(
            "download_progress",
            DownloadProgress {
                theme_name: theme_name.clone(),
                received,
                total,
                progress: if total > 0 {
                    received as f64 / total as f64
                } else {
                    0.0
                },
            },
        );
    }

    let sha = tokio::task::spawn_blocking({
        let chunks = chunks.clone();
        move || {
            use sha1::{Digest, Sha1};
            let header = format!("blob {}\0", chunks.len());
            let mut hasher = Sha1::new();
            hasher.update(header.as_bytes());
            hasher.update(&chunks);
            hex::encode(hasher.finalize())
        }
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))?;

    if sha != expected_sha {
        return Err("Failed to verify downloaded theme file hash.".to_string());
    }

    // Parse zip on blocking thread
    let entries: Vec<(String, Vec<u8>, bool)> = tokio::task::spawn_blocking(move || {
        let cursor = std::io::Cursor::new(chunks);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to read zip archive: {}", e))?;

        let mut entries = Vec::new();
        for i in 0..archive.len() {
            let mut zip_entry = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;

            let name = match zip_entry.enclosed_name() {
                Some(p) => p.to_string_lossy().to_string(),
                None => continue,
            };

            let is_dir = zip_entry.is_dir();
            let mut buf = Vec::new();
            if !is_dir {
                std::io::copy(&mut zip_entry, &mut buf)
                    .map_err(|e| format!("Failed to read zip entry data: {}", e))?;
            }
            entries.push((name, buf, is_dir));
        }

        Ok::<_, String>(entries)
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))??;

    let total_files = entries.len();
    let mut extracted = 0;

    for (name, buf, is_dir) in entries {
        let entry_path = std::path::Path::new(&theme_folder).join(&name);

        if is_dir {
            tokio::fs::create_dir_all(&entry_path)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = entry_path.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            tokio::fs::write(&entry_path, &buf)
                .await
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }

        extracted += 1;
        let _ = app.emit(
            "extract_progress",
            ExtractProgress {
                theme_name: theme_name.clone(),
                total: total_files,
                extracted,
                progress: extracted as f64 / total_files as f64,
                current_file: name,
            },
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn extract_theme(
    app: AppHandle,
    file_path: String,
    theme_folder: String,
    theme_name: String,
) -> Result<(), String> {
    app.fs_scope().allow_file(&file_path).ok();
    let entries: Vec<(String, Vec<u8>, bool)> = tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&file_path)
            .map_err(|e| format!("Failed to open theme file: {}", e))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        let mut entries = Vec::new();
        for i in 0..archive.len() {
            let mut zip_entry = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;

            let name = match zip_entry.enclosed_name() {
                Some(p) => p.to_string_lossy().to_string(),
                None => continue,
            };

            let is_dir = zip_entry.is_dir();
            let mut buf = Vec::new();
            if !is_dir {
                zip_entry
                    .read_to_end(&mut buf)
                    .map_err(|e| format!("Failed to read zip entry data: {}", e))?;
            }
            entries.push((name, buf, is_dir));
        }

        Ok::<_, String>(entries)
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))??;

    let total = entries.len();
    let mut extracted = 0;

    for (name, buf, is_dir) in entries {
        let entry_path = std::path::Path::new(&theme_folder).join(&name);

        if is_dir {
            tokio::fs::create_dir_all(&entry_path)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = entry_path.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            tokio::fs::write(&entry_path, &buf)
                .await
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }

        extracted += 1;
        let _ = app.emit(
            "extract_progress",
            ExtractProgress {
                theme_name: theme_name.clone(),
                total,
                extracted,
                progress: extracted as f64 / total as f64,
                current_file: name,
            },
        );
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ThemeInfo {
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(rename = "apiVersion", default)]
    pub api_version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub nsfw: bool,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub style: String,
    #[serde(default)]
    pub preview: String,
}

#[tauri::command]
pub async fn read_theme_info(app: AppHandle, file_path: String) -> Result<ThemeInfo, String> {
    app.fs_scope().allow_file(&file_path).ok();
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&file_path)
            .map_err(|e| format!("Failed to open theme file: {}", e))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        let mut theme_config = archive
            .by_name("theme.json")
            .map_err(|_| "Theme config file not found".to_string())?;

        let mut contents = String::new();
        std::io::Read::read_to_string(&mut theme_config, &mut contents)
            .map_err(|e| format!("Failed to read theme config: {}", e))?;

        let theme_info: ThemeInfo = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse theme config: {}", e))?;

        Ok(theme_info)
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))?
}

pub(crate) fn theme_root() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not locate the home directory".to_string())?;
    let root = PathBuf::from(home).join(".ezpplauncher").join("themes");
    std::fs::create_dir_all(&root)
        .map_err(|e| format!("Failed to create the themes directory: {e}"))?;
    std::fs::canonicalize(&root).map_err(|e| format!("Failed to resolve the themes directory: {e}"))
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn loopback_theme_asset_base() -> String {
    if crate::theme_server::base_url().is_none()
        && let Ok(root) = theme_root() {
            match crate::theme_server::media_root() {
                Ok(media) => {
                    if let Err(error) = crate::theme_server::start(root, media) {
                        log::warn!(target: "launcher", "Could not start the theme asset server: {error}");
                    }
                }
                Err(error) => {
                    log::warn!(target: "launcher", "Could not prepare the media cache: {error}");
                }
            }
        }
    crate::theme_server::base_url().unwrap_or_default()
}

#[tauri::command]
pub fn theme_asset_base() -> String {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        loopback_theme_asset_base()
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        String::new()
    }
}

#[tauri::command]
pub fn theme_preview_url(path: String) -> Result<String, String> {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let _ = loopback_theme_asset_base();
        crate::theme_server::preview_url(Path::new(&path))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = path;
        Ok(String::new())
    }
}

/// Return a hardware-decodable copy of a VP9/AV1 theme video.
///
/// WebKit on macOS decodes VP9/AV1 in software. A 1080p WebM can use enough
/// CPU to starve the audio decoder, while H.264 is decoded by the media
/// engine. The first playback of an installed theme video or a video picked
/// in the editor is transcoded to a cached 720p H.264/AAC file; later loads
/// return the cached URL directly. Videos already encoded as H.264/HEVC, and
/// very small clips, are left untouched.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeMediaProgress {
    pub stage: String,
    pub progress: f64,
}

#[cfg(target_os = "macos")]
const FFMPEG_VERSION: &str = "9.0.2";

/// Small clips are usually short stickers; transcoding them would cost more
/// time and disk than it saves. Anything larger may be a 1080p VP9 stream that
/// WebKit cannot decode smoothly in software.
#[cfg(target_os = "macos")]
const THEME_VIDEO_OPTIMIZE_MIN_BYTES: u64 = 2 * 1024 * 1024;

#[cfg(target_os = "macos")]
struct FfmpegBuild {
    url: &'static str,
    sha256: &'static str,
}

#[cfg(target_os = "macos")]
fn ffmpeg_build() -> Result<FfmpegBuild, String> {
    match std::env::consts::ARCH {
        "aarch64" => Ok(FfmpegBuild {
            url: "https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip",
            sha256: "c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924",
        }),
        "x86_64" => Ok(FfmpegBuild {
            url: "https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_9.0.2/ffmpeg.zip",
            sha256: "7c6b4125b191cbf773832dc51f424cf2b6bb7da43007d1e066f95909e47cacd4",
        }),
        arch => Err(format!(
            "No FFmpeg build is available for the macOS architecture {arch}"
        )),
    }
}

#[tauri::command]
pub async fn optimize_theme_media(app: AppHandle, source_url: String) -> Result<String, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        return Ok(source_url);
    }

    #[cfg(target_os = "macos")]
    {
        let Some(source) = crate::theme_server::resolve_theme_url(&source_url) else {
            return Ok(source_url);
        };

        let metadata = match tokio::fs::metadata(&source).await {
            Ok(metadata) => metadata,
            Err(error) => {
                log::warn!(target: "launcher", "Could not inspect theme media: {error}");
                return Ok(source_url);
            }
        };
        if metadata.len() < THEME_VIDEO_OPTIMIZE_MIN_BYTES {
            log::debug!(
                target: "launcher",
                "Skipping theme video optimization for {} ({} bytes)",
                source.display(),
                metadata.len()
            );
            return Ok(source_url);
        }

        let (cache_name, destination) = match theme_media_cache_path(&source, &metadata) {
            Ok(cache) => cache,
            Err(error) => {
                log::warn!(target: "launcher", "Could not prepare the media cache: {error}");
                return Ok(source_url);
            }
        };

        if destination
            .metadata()
            .map(|meta| meta.is_file() && meta.len() > 1024)
            .unwrap_or(false)
        {
            return Ok(crate::theme_server::media_url(&cache_name)
                .unwrap_or_else(|| source_url.to_string()));
        }

        let ffmpeg = match ensure_theme_ffmpeg(&app).await {
            Ok(path) => path,
            Err(error) => {
                log::warn!(target: "launcher", "Theme video optimization is unavailable: {error}");
                return Ok(source_url);
            }
        };

        let _ = app.emit(
            "theme-media-progress",
            ThemeMediaProgress {
                stage: "optimize".to_string(),
                progress: 0.0,
            },
        );

        let original = source_url.clone();
        tokio::task::spawn_blocking(move || {
            optimize_theme_media_blocking(&ffmpeg, &source, &original, &cache_name, &destination)
        })
        .await
        .map_err(|error| format!("Theme media optimizer thread failed: {error}"))?
    }
}

#[cfg(target_os = "macos")]
fn theme_media_cache_path(
    source: &Path,
    metadata: &std::fs::Metadata,
) -> Result<(String, PathBuf), String> {
    use sha2::{Digest, Sha256};

    let cache_root = crate::theme_server::media_root()?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(source.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified.to_le_bytes());
    hasher.update(b"h264-720-v1");
    let cache_name = format!("{}.mp4", hex::encode(&hasher.finalize()[..16]));
    let destination = cache_root.join(&cache_name);
    Ok((cache_name, destination))
}

#[cfg(target_os = "macos")]
fn theme_tools_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not locate the home directory".to_string())?;
    let directory = PathBuf::from(home).join(".ezpplauncher").join("bin");
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create the theme media tools folder: {error}"))?;
    std::fs::canonicalize(&directory)
        .map_err(|error| format!("Failed to resolve the theme media tools folder: {error}"))
}

#[cfg(target_os = "macos")]
fn verify_ffmpeg(path: &Path) -> bool {
    std::process::Command::new(path)
        .arg("-version")
        .output()
        .map(|output| {
            output.status.success()
                && String::from_utf8_lossy(&output.stdout).starts_with("ffmpeg version")
        })
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn theme_ffmpeg_status() -> Option<String> {
    let home = std::env::var_os("HOME")?;
    let managed = PathBuf::from(home).join(".ezpplauncher/bin/ffmpeg");
    if managed.is_file() && verify_ffmpeg(&managed) {
        return Some(format!(
            "Managed FFmpeg {FFMPEG_VERSION} at {}",
            managed.display()
        ));
    }

    find_media_binary("ffmpeg")
        .filter(|path| verify_ffmpeg(path))
        .map(|path| format!("System FFmpeg at {}", path.display()))
}

#[cfg(target_os = "macos")]
static FFMPEG_DOWNLOAD_LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> =
    std::sync::OnceLock::new();

#[cfg(target_os = "macos")]
async fn ensure_theme_ffmpeg(app: &AppHandle) -> Result<PathBuf, String> {
    let managed = theme_tools_dir()?.join("ffmpeg");
    if managed.is_file() && verify_ffmpeg(&managed) {
        return Ok(managed);
    }
    if managed.exists() {
        let _ = std::fs::remove_file(&managed);
    }

    match download_ffmpeg(app).await {
        Ok(path) => Ok(path),
        Err(download_error) => {
            log::warn!(target: "launcher", "Could not download ffmpeg: {download_error}");
            find_media_binary("ffmpeg")
                .filter(|path| verify_ffmpeg(path))
                .ok_or_else(|| {
                    format!("ffmpeg is not installed and the download failed: {download_error}")
                })
        }
    }
}

#[cfg(target_os = "macos")]
async fn download_ffmpeg(app: &AppHandle) -> Result<PathBuf, String> {
    use futures_util::StreamExt;
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncWriteExt;

    let build = ffmpeg_build()?;
    let directory = theme_tools_dir()?;
    let target = directory.join("ffmpeg");

    let lock = FFMPEG_DOWNLOAD_LOCK.get_or_init(|| tokio::sync::Mutex::new(()));
    let _guard = lock.lock().await;

    if target.is_file() && verify_ffmpeg(&target) {
        return Ok(target);
    }

    let zip_path = directory.join("ffmpeg.zip.part");
    let binary_path = directory.join("ffmpeg.part");
    let _ = std::fs::remove_file(&zip_path);
    let _ = std::fs::remove_file(&binary_path);

    log::info!(
        target: "launcher",
        "Downloading FFmpeg {FFMPEG_VERSION} for theme video optimization"
    );
    let _ = app.emit(
        "theme-media-progress",
        ThemeMediaProgress {
            stage: "download".to_string(),
            progress: 0.0,
        },
    );

    let client = Client::builder()
        .user_agent(concat!("EZPPLauncher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| format!("Could not create the FFmpeg download client: {error}"))?;
    let response = client
        .get(build.url)
        .send()
        .await
        .map_err(|error| format!("Could not download FFmpeg: {error}"))?
        .error_for_status()
        .map_err(|error| format!("FFmpeg download failed: {error}"))?;
    let total = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&zip_path)
        .await
        .map_err(|error| format!("Could not create the FFmpeg archive: {error}"))?;
    let mut hasher = Sha256::new();
    let mut received = 0_u64;
    let mut last_percent = u8::MAX;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|error| format!("Could not read the FFmpeg download: {error}"))?;
        received += chunk.len() as u64;
        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("Could not write the FFmpeg archive: {error}"))?;

        if let Some(percent) = (received.min(total) * 100).checked_div(total).map(|v| v as u8)
            && percent != last_percent {
                last_percent = percent;
                let _ = app.emit(
                    "theme-media-progress",
                    ThemeMediaProgress {
                        stage: "download".to_string(),
                        progress: percent as f64 / 100.0,
                    },
                );
            }
    }

    file.flush()
        .await
        .map_err(|error| format!("Could not finish the FFmpeg archive: {error}"))?;
    drop(file);

    let digest = hex::encode(hasher.finalize());
    if digest != build.sha256 {
        let _ = std::fs::remove_file(&zip_path);
        return Err("The downloaded FFmpeg archive failed its SHA-256 check".to_string());
    }

    let _ = app.emit(
        "theme-media-progress",
        ThemeMediaProgress {
            stage: "extract".to_string(),
            progress: 0.0,
        },
    );

    let zip_for_task = zip_path.clone();
    let binary_for_task = binary_path.clone();
    let target_for_task = target.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        use std::os::unix::fs::PermissionsExt;

        let file = std::fs::File::open(&zip_for_task)
            .map_err(|error| format!("Could not open the FFmpeg archive: {error}"))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|error| format!("Could not read the FFmpeg archive: {error}"))?;
        let mut entry = archive
            .by_name("ffmpeg")
            .map_err(|error| format!("The FFmpeg archive does not contain the binary: {error}"))?;
        let mut output = std::fs::File::create(&binary_for_task)
            .map_err(|error| format!("Could not create the FFmpeg binary: {error}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Could not extract the FFmpeg binary: {error}"))?;
        drop(output);
        std::fs::set_permissions(&binary_for_task, std::fs::Permissions::from_mode(0o755))
            .map_err(|error| format!("Could not make FFmpeg executable: {error}"))?;
        std::fs::rename(&binary_for_task, &target_for_task)
            .map_err(|error| format!("Could not install FFmpeg: {error}"))?;
        let _ = std::fs::remove_file(&zip_for_task);
        Ok(())
    })
    .await
    .map_err(|error| format!("FFmpeg extraction thread failed: {error}"))??;

    if !verify_ffmpeg(&target) {
        let _ = std::fs::remove_file(&target);
        return Err("The downloaded FFmpeg binary could not be executed".to_string());
    }

    log::info!(
        target: "launcher",
        "FFmpeg {FFMPEG_VERSION} installed at {}",
        target.display()
    );
    Ok(target)
}

#[cfg(target_os = "macos")]
fn find_media_binary(name: &str) -> Option<PathBuf> {
    let variable = format!("EZPP_{}", name.to_ascii_uppercase());
    if let Some(value) = std::env::var_os(variable) {
        let path = PathBuf::from(value);
        if path.is_file() {
            return Some(path);
        }
    }

    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|directory| directory.join(name)));
    }
    for directory in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/local/bin",
        "/usr/bin",
    ] {
        candidates.push(PathBuf::from(directory).join(name));
    }

    candidates.into_iter().find(|path| path.is_file())
}

#[cfg(target_os = "macos")]
fn optimize_theme_media_blocking(
    ffmpeg: &Path,
    source: &Path,
    source_url: &str,
    cache_name: &str,
    destination: &Path,
) -> Result<String, String> {
    use std::process::Command;

    let probe = Command::new(ffmpeg)
        .args(["-hide_banner", "-i"])
        .arg(source)
        .output()
        .map_err(|error| format!("Could not probe theme media: {error}"))?;
    let probe_text = String::from_utf8_lossy(&probe.stderr);
    let codec = probe_text.lines().find_map(|line| {
        let index = line.find("Video: ")?;
        line[index + 7..]
            .split([',', ' '])
            .next()
            .map(str::to_ascii_lowercase)
    });

    let Some(codec) = codec else {
        return Ok(source_url.to_string());
    };
    if codec == "h264" || codec == "hevc" {
        return Ok(source_url.to_string());
    }

    let temporary = destination.with_extension("mp4.tmp");
    let _ = std::fs::remove_file(&temporary);

    log::info!(
        target: "launcher",
        "Optimizing theme video for hardware playback ({} -> 720p H.264)",
        source.display()
    );
    let started = std::time::Instant::now();

    let mut command = Command::new(ffmpeg);
    command.args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i"]);
    command.arg(source);
    command.args([
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "scale=-2:720",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "h264_videotoolbox",
        "-b:v",
        "3500k",
        "-maxrate",
        "4500k",
        "-bufsize",
        "7000k",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-map_metadata",
        "-1",
        "-f",
        "mp4",
    ]);
    command.arg(&temporary);
    let first = command.output();

    let success = match first {
        Ok(output) if output.status.success() => true,
        Ok(output) => {
            log::warn!(
                target: "launcher",
                "Hardware theme video encode failed: {}",
                String::from_utf8_lossy(&output.stderr)
                    .chars()
                    .take(500)
                    .collect::<String>()
            );
            false
        }
        Err(error) => {
            log::warn!(target: "launcher", "Could not run ffmpeg: {error}");
            false
        }
    };

    let success = if success {
        true
    } else {
        let _ = std::fs::remove_file(&temporary);
        let mut fallback = Command::new(ffmpeg);
        fallback.args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i"]);
        fallback.arg(source);
        fallback.args([
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-vf",
            "scale=-2:720",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            "-f",
            "mp4",
        ]);
        fallback.arg(&temporary);
        match fallback.output() {
            Ok(output) if output.status.success() => true,
            Ok(output) => {
                log::warn!(
                    target: "launcher",
                    "Software theme video encode failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                        .chars()
                        .take(500)
                        .collect::<String>()
                );
                false
            }
            Err(error) => {
                log::warn!(target: "launcher", "Could not run the fallback ffmpeg encode: {error}");
                false
            }
        }
    };

    if !success {
        let _ = std::fs::remove_file(&temporary);
        return Ok(source_url.to_string());
    }

    std::fs::rename(&temporary, destination)
        .map_err(|error| format!("Could not store the optimized theme video: {error}"))?;
    log::info!(
        target: "launcher",
        "Optimized theme video in {:.1}s: {}",
        started.elapsed().as_secs_f64(),
        destination.display()
    );

    Ok(crate::theme_server::media_url(cache_name).unwrap_or_else(|| source_url.to_string()))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeEditorContext {
    pub folder_name: Option<String>,
    pub folder_path: Option<String>,
    pub theme_json: Option<String>,
}

/// Open (or focus) the advanced theme editor in its own native window.
#[tauri::command]
pub async fn open_theme_editor(app: AppHandle, theme_folder: Option<String>) -> Result<(), String> {
    let folder = match theme_folder.filter(|value| !value.trim().is_empty()) {
        Some(folder) => {
            let checked = checked_theme_folder(&folder)?;
            if !checked.join("theme.json").is_file() {
                return Err("That theme does not contain a theme.json".to_string());
            }
            Some(checked.to_string_lossy().into_owned())
        }
        None => None,
    };

    *app.state::<AppState>().editor_theme_folder.lock().unwrap() = folder;

    if let Some(window) = app.get_webview_window("theme-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
        app.emit_to("theme-editor", "theme-editor-context", ())
            .map_err(|error| error.to_string())?;
        let _ = app.emit_to("main", "theme-editor-state", true);
        return Ok(());
    }

    let window =
        WebviewWindowBuilder::new(&app, "theme-editor", WebviewUrl::App("index.html".into()))
            .title("EZPPLauncher Theme Editor")
            .inner_size(1440.0, 900.0)
            .min_inner_size(1100.0, 720.0)
            .resizable(true)
            // Tauri's native file-drop handler intercepts HTML5 drag events on
            // macOS/WebKit. The editor only needs HTML5 drag and drop for its layer
            // tree, while the main launcher keeps native theme-file dropping.
            .disable_drag_drop_handler()
            .center()
            .build()
            .map_err(|error| format!("Could not open the theme editor: {error}"))?;

    // Pause the launcher's own theme media while the editor window exists. The
    // editor is a separate WebView, so the launcher needs an explicit signal
    // rather than relying on focus/blur events.
    let main_window = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            if let Some(main) = main_window.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
            }
            let _ = main_window.emit_to("main", "theme-editor-state", false);
        }
    });

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    let _ = app.emit_to("main", "theme-editor-state", true);

    Ok(())
}

/// Focus the theme editor window and keep the main launcher window hidden.
#[tauri::command]
pub async fn focus_theme_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("theme-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
    }
    Ok(())
}

/// Close the theme editor window and restore the main launcher window.
#[tauri::command]
pub async fn close_theme_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("theme-editor") {
        let _ = window.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "theme-editor-state", false);
    Ok(())
}

/// Open (or focus) the discord presence embed editor in its own native window.
#[tauri::command]
pub async fn open_presence_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("presence-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
        let _ = app.emit_to("main", "presence-editor-state", true);
        return Ok(());
    }

    let window =
        WebviewWindowBuilder::new(&app, "presence-editor", WebviewUrl::App("index.html".into()))
            .title("EZPPLauncher — Discord Rich Presence Editor")
            .inner_size(1200.0, 800.0)
            .min_inner_size(980.0, 650.0)
            .resizable(true)
            .center()
            .build()
            .map_err(|error| format!("Could not open the presence editor: {error}"))?;

    let main_window = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            if let Some(main) = main_window.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
            }
            let _ = main_window.emit_to("main", "presence-editor-state", false);
        }
    });

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    let _ = app.emit_to("main", "presence-editor-state", true);

    Ok(())
}

/// Focus the presence editor window and keep the main launcher window hidden.
#[tauri::command]
pub async fn focus_presence_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("presence-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
    }
    Ok(())
}

/// Close the presence editor window and restore the main launcher window.
#[tauri::command]
pub async fn close_presence_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("presence-editor") {
        let _ = window.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "presence-editor-state", false);
    Ok(())
}

/// Theme data requested by the advanced editor window when it starts or switches themes.
#[tauri::command]
pub fn theme_editor_context(app: AppHandle) -> Result<ThemeEditorContext, String> {
    let folder = app
        .state::<AppState>()
        .editor_theme_folder
        .lock()
        .unwrap()
        .clone();
    let Some(folder) = folder else {
        return Ok(ThemeEditorContext {
            folder_name: None,
            folder_path: None,
            theme_json: None,
        });
    };

    let path = PathBuf::from(&folder);
    let folder_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(ToOwned::to_owned);
    let theme_json = std::fs::read_to_string(path.join("theme.json")).ok();

    Ok(ThemeEditorContext {
        folder_name,
        folder_path: Some(folder),
        theme_json,
    })
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeBackupInfo {
    pub path: String,
    pub label: String,
    pub created_at: u64,
    pub size: u64,
}

fn theme_backups_root() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not locate the home directory".to_string())?;
    let root = PathBuf::from(home)
        .join(".ezpplauncher")
        .join("theme-backups");
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create the theme backup directory: {error}"))?;
    std::fs::canonicalize(&root)
        .map_err(|error| format!("Failed to resolve the theme backup directory: {error}"))
}

fn directory_size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };

    entries
        .filter_map(|entry| entry.ok())
        .map(|entry| {
            let path = entry.path();
            match entry.file_type() {
                Ok(kind) if kind.is_dir() => directory_size(&path),
                Ok(kind) if kind.is_file() => entry.metadata().map(|meta| meta.len()).unwrap_or(0),
                _ => 0,
            }
        })
        .sum()
}

fn copy_theme_tree(source: &Path, destination: &Path) -> Result<(), String> {
    std::fs::create_dir_all(destination)
        .map_err(|error| format!("Failed to create {}: {error}", destination.display()))?;

    for entry in std::fs::read_dir(source)
        .map_err(|error| format!("Failed to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read theme entry: {error}"))?;
        let kind = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect theme entry: {error}"))?;
        if kind.is_symlink() {
            continue;
        }

        let target = destination.join(entry.file_name());
        if kind.is_dir() {
            copy_theme_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            std::fs::copy(entry.path(), &target)
                .map_err(|error| format!("Failed to copy theme file: {error}"))?;
        }
    }

    Ok(())
}

fn theme_backup_dir(theme_folder: &Path) -> Result<PathBuf, String> {
    let name = theme_folder
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The theme folder has no name".to_string())?;
    Ok(theme_backups_root()?.join(name))
}

fn prune_theme_backups(directory: &Path) -> Result<(), String> {
    let mut entries = std::fs::read_dir(directory)
        .map_err(|error| format!("Failed to read theme backups: {error}"))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .collect::<Vec<_>>();

    entries.sort_by_key(|entry| entry.file_name());

    while entries.len() > 5 {
        let oldest = entries.remove(0);
        let _ = std::fs::remove_dir_all(oldest.path());
    }

    Ok(())
}

/// Copy a theme aside before overwriting it during an update.
#[tauri::command]
pub async fn backup_theme_folder(theme_folder: String) -> Result<String, String> {
    let folder = checked_theme_folder(&theme_folder)?;
    if !folder.is_dir() {
        return Err("The theme folder does not exist".to_string());
    }

    tokio::task::spawn_blocking(move || {
        let backup_root = theme_backup_dir(&folder)?;
        std::fs::create_dir_all(&backup_root)
            .map_err(|error| format!("Failed to create the theme backup directory: {error}"))?;
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let destination = backup_root.join(format!("backup_{stamp}"));
        copy_theme_tree(&folder, &destination)?;
        prune_theme_backups(&backup_root)?;
        Ok(destination.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| format!("Thread error: {error}"))?
}

#[tauri::command]
pub async fn list_theme_backups(theme_folder: String) -> Result<Vec<ThemeBackupInfo>, String> {
    let folder = checked_theme_folder(&theme_folder)?;
    tokio::task::spawn_blocking(move || {
        let backup_root = theme_backup_dir(&folder)?;
        if !backup_root.is_dir() {
            return Ok(Vec::new());
        }

        let mut backups = std::fs::read_dir(&backup_root)
            .map_err(|error| format!("Failed to read theme backups: {error}"))?
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
            .map(|entry| {
                let path = entry.path();
                let created_at = entry
                    .metadata()
                    .ok()
                    .and_then(|meta| meta.modified().ok())
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as u64)
                    .unwrap_or(0);
                ThemeBackupInfo {
                    label: entry.file_name().to_string_lossy().into_owned(),
                    path: path.to_string_lossy().into_owned(),
                    created_at,
                    size: directory_size(&path),
                }
            })
            .collect::<Vec<_>>();

        backups.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        Ok(backups)
    })
    .await
    .map_err(|error| format!("Thread error: {error}"))?
}

#[tauri::command]
pub async fn restore_theme_backup(
    theme_folder: String,
    backup_folder: String,
) -> Result<(), String> {
    let folder = checked_theme_folder(&theme_folder)?;
    tokio::task::spawn_blocking(move || {
        let allowed_root = theme_backup_dir(&folder)?;
        let backup = std::fs::canonicalize(&backup_folder)
            .map_err(|error| format!("Failed to resolve the theme backup: {error}"))?;
        if !backup.starts_with(&allowed_root) || !backup.is_dir() {
            return Err("The backup is outside this theme's backup folder".to_string());
        }

        if folder.exists() {
            std::fs::remove_dir_all(&folder)
                .map_err(|error| format!("Failed to replace the theme folder: {error}"))?;
        }
        copy_theme_tree(&backup, &folder)
    })
    .await
    .map_err(|error| format!("Thread error: {error}"))?
}

/// Only allow writing inside `~/.ezpplauncher/themes`.
fn checked_theme_folder(theme_folder: &str) -> Result<PathBuf, String> {
    let root = theme_root()?;
    let requested = PathBuf::from(theme_folder);
    if !requested.is_absolute() {
        return Err("The theme folder must be an absolute path".to_string());
    }

    let folder = if requested.exists() {
        std::fs::canonicalize(&requested)
            .map_err(|e| format!("Failed to resolve the theme folder: {e}"))?
    } else {
        let parent = requested
            .parent()
            .ok_or_else(|| "The theme folder has no parent directory".to_string())?;
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create the theme directory: {e}"))?;
        let parent = std::fs::canonicalize(parent)
            .map_err(|e| format!("Failed to resolve the theme directory: {e}"))?;
        let name = requested
            .file_name()
            .ok_or_else(|| "The theme folder has no name".to_string())?;
        parent.join(name)
    };

    if folder == root || !folder.starts_with(&root) {
        return Err("The theme folder is outside the themes directory".to_string());
    }

    Ok(folder)
}

#[derive(Deserialize)]
pub struct ThemeAssetInput {
    pub name: String,
    pub source: String,
}

/// Write a theme created or edited by the in-app theme editor.
#[tauri::command]
pub async fn save_theme_project(
    theme_folder: String,
    config: String,
    assets: Vec<ThemeAssetInput>,
) -> Result<(), String> {
    let folder = checked_theme_folder(&theme_folder)?;

    let parsed: Value = serde_json::from_str(&config)
        .map_err(|e| format!("The theme config is not valid JSON: {e}"))?;
    if parsed.get("apiVersion").and_then(Value::as_str) != Some("2.0") {
        return Err("The theme editor can only save API 2.0 themes".to_string());
    }
    if parsed
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .is_none()
    {
        return Err("The theme needs a name".to_string());
    }

    let assets_folder = folder.join("assets");
    tokio::fs::create_dir_all(&assets_folder)
        .await
        .map_err(|e| format!("Failed to create the assets folder: {e}"))?;

    for asset in assets {
        let name = asset.name.trim();
        if name.is_empty()
            || name == "."
            || name == ".."
            || name.contains('/')
            || name.contains('\\')
        {
            return Err(format!("Invalid theme asset name: {name}"));
        }

        let source = PathBuf::from(&asset.source);
        if !source.is_file() {
            return Err(format!("Theme asset not found: {}", source.display()));
        }

        let destination = assets_folder.join(name);
        if source.canonicalize().ok() == destination.canonicalize().ok() {
            continue;
        }

        tokio::fs::copy(&source, &destination)
            .await
            .map_err(|e| format!("Failed to copy theme asset {name}: {e}"))?;
    }

    tokio::fs::write(folder.join("theme.json"), config)
        .await
        .map_err(|e| format!("Failed to write theme.json: {e}"))?;

    Ok(())
}

/// Resolve a `theme.json` asset reference to a path relative to `assets/`.
/// Remote URLs, data URLs and paths that could escape the assets folder are
/// ignored.
fn theme_asset_reference(src: &str) -> Option<String> {
    let value = src.trim();
    if value.is_empty()
        || value.contains("://")
        || value.starts_with('/')
        || value.starts_with("data:")
        || value.starts_with("blob:")
        || value.starts_with("asset:")
    {
        return None;
    }

    let normalized = value.replace('\\', "/");
    let normalized = normalized.trim_start_matches("./");
    if normalized.is_empty()
        || normalized
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return None;
    }

    Some(normalized.to_string())
}

fn collect_theme_asset_refs(value: &Value, assets: &mut HashSet<String>) {
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if (key == "src" || key == "preview")
                    && let Some(src) = value.as_str()
                        && let Some(path) = theme_asset_reference(src) {
                            assets.insert(path);
                        }
                collect_theme_asset_refs(value, assets);
            }
        }
        Value::Array(values) => {
            for value in values {
                collect_theme_asset_refs(value, assets);
            }
        }
        _ => {}
    }
}

fn collect_svelte_sources(value: &Value, sources: &mut Vec<String>) {
    let Some(elements) = value.get("elements").and_then(Value::as_array) else {
        return;
    };
    for element in elements {
        if element.get("type").and_then(Value::as_str) != Some("svelte") {
            continue;
        }
        if let Some(source) = element.get("source").and_then(Value::as_str) {
            sources.push(source.to_string());
        }
    }
}

/// Custom Svelte layers load assets through `asset("path")`, which is not a
/// `src` field in theme.json. Keep any asset whose relative path appears in a
/// component source so exports do not drop files used by custom layers.
fn collect_svelte_asset_refs(assets_root: &Path, sources: &[String], assets: &mut HashSet<String>) {
    if sources.is_empty() {
        return;
    }
    let Ok(entries) = std::fs::read_dir(assets_root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_svelte_asset_refs(&path, sources, assets);
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let Ok(relative) = path.strip_prefix(assets_root) else {
            continue;
        };
        let key = relative.to_string_lossy().replace('\\', "/");
        if sources.iter().any(|source| source.contains(&key)) {
            assets.insert(key);
        }
    }
}

/// For API 2.0 packages, return the assets referenced by `theme.json` so an
/// export can omit orphaned files left behind by older edits. API 1.0 themes
/// can load assets dynamically from their bundle, so they are exported whole.
fn referenced_theme_assets(theme_json: &Path) -> Option<HashSet<String>> {
    let text = std::fs::read_to_string(theme_json).ok()?;
    let parsed: Value = serde_json::from_str(&text).ok()?;
    let api_version = parsed.get("apiVersion")?.as_str()?;
    if api_version.split('.').next() != Some("2") {
        return None;
    }

    let mut assets = HashSet::new();
    // The launcher falls back to this filename for theme thumbnails even when
    // `preview` is omitted from theme.json.
    assets.insert("preview.png".to_string());
    collect_theme_asset_refs(&parsed, &mut assets);

    if let Some(folder) = theme_json.parent() {
        let assets_root = folder.join("assets");
        let mut sources = Vec::new();
        collect_svelte_sources(&parsed, &mut sources);
        collect_svelte_asset_refs(&assets_root, &sources, &mut assets);
    }
    Some(assets)
}

fn add_theme_folder_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    root: &Path,
    directory: &Path,
    asset_filter: Option<&HashSet<String>>,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    let entries = std::fs::read_dir(directory)
        .map_err(|e| format!("Failed to read {}: {e}", directory.display()))?;
    let assets_root = root.join("assets");

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read theme entry: {e}"))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to inspect theme entry: {e}"))?;
        if file_type.is_symlink() {
            continue;
        }

        let entry_path = entry.path();
        if file_type.is_dir() {
            add_theme_folder_to_zip(zip, root, &entry_path, asset_filter, options)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }

        if let Some(filter) = asset_filter
            && let Ok(asset_path) = entry_path.strip_prefix(&assets_root) {
                let key = asset_path.to_string_lossy().replace('\\', "/");
                if !filter.contains(&key) {
                    continue;
                }
            }

        let relative = entry_path
            .strip_prefix(root)
            .map_err(|e| format!("Failed to build archive path: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");

        zip.start_file(relative, options)
            .map_err(|e| format!("Failed to add a file to the theme archive: {e}"))?;
        let mut file = std::fs::File::open(&entry_path)
            .map_err(|e| format!("Failed to open {}: {e}", entry_path.display()))?;
        std::io::copy(&mut file, zip)
            .map_err(|e| format!("Failed to write the theme archive: {e}"))?;
    }

    Ok(())
}

/// Package a theme folder as a shareable `.ezpplauncher-theme` file.
#[tauri::command]
pub async fn export_theme(theme_folder: String, destination_path: String) -> Result<(), String> {
    let folder = checked_theme_folder(&theme_folder)?;
    if !folder.is_dir() {
        return Err("The theme folder does not exist".to_string());
    }

    let destination = PathBuf::from(destination_path);
    if !destination.is_absolute() {
        return Err("The export path must be absolute".to_string());
    }
    if destination.starts_with(&folder) {
        return Err("Choose a destination outside the theme folder".to_string());
    }

    tokio::task::spawn_blocking(move || {
        let asset_filter = referenced_theme_assets(&folder.join("theme.json"));
        let file = std::fs::File::create(&destination)
            .map_err(|e| format!("Failed to create the theme archive: {e}"))?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        add_theme_folder_to_zip(&mut zip, &folder, &folder, asset_filter.as_ref(), options)?;
        zip.finish()
            .map_err(|e| format!("Failed to finish the theme archive: {e}"))?;
        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Thread error: {e}"))??;

    Ok(())
}

#[tauri::command]
pub async fn open_theme_folder(theme_folder: String) -> Result<(), String> {
    let root = theme_root()?;
    let requested = std::fs::canonicalize(&theme_folder).unwrap_or_else(|_| root.clone());
    if requested != root && !requested.starts_with(&root) {
        return Err("The theme folder is outside the themes directory".to_string());
    }

    open::that(&requested).map_err(|e| format!("Failed to open the themes folder: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn config_get(key: String, state: State<AppState>) -> Result<Option<Value>, ConfigError> {
    state.config.lock().unwrap().get(&key)
}

#[tauri::command]
pub fn config_set(
    key: String,
    value: Value,
    encrypt: bool,
    state: State<AppState>,
) -> Result<(), ConfigError> {
    state.config.lock().unwrap().set(&key, value, encrypt)
}

#[tauri::command]
pub fn config_exists(key: String, state: State<AppState>) -> Result<bool, ConfigError> {
    state.config.lock().unwrap().exists(&key)
}

#[tauri::command]
pub fn config_delete(key: String, state: State<AppState>) -> Result<(), ConfigError> {
    state.config.lock().unwrap().delete(&key)
}

#[tauri::command]
pub fn config_clear(state: State<AppState>) -> Result<(), ConfigError> {
    state.config.lock().unwrap().clear()
}

#[tauri::command]
pub fn config_all(state: State<AppState>) -> Result<Vec<(String, Value)>, ConfigError> {
    state.config.lock().unwrap().all()
}

#[tauri::command]
pub async fn reveal_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let win = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();

            #[cfg(target_os = "macos")]
            {
                let res = crate::macos::activate_and_focus_window(&win);
                let _ = tx.send(res);
            }

            #[cfg(not(target_os = "macos"))]
            let _ = tx.send(Ok(()));
        })
        .map_err(|e| e.to_string())?;

    rx.await
        .map_err(|_| "Main thread channel closed".to_string())?
}
