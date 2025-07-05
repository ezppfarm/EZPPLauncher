use hardware_id::get_id;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
use sysinfo::System;
use tauri::AppHandle;
use tauri::Emitter;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::utils::{
    check_folder_completeness, get_osu_config, get_osu_user_config, get_window_title_by_pid,
    set_osu_config_vals, set_osu_user_config_vals,
};


#[tauri::command]
pub fn get_hwid() -> String {
    let hwid = get_id().unwrap();
    hwid.into()
}

#[tauri::command(rename_all = "snake_case")]
pub fn valid_osu_folder(folder: String) -> bool {
    let osu_folder_files = [
        "avcodec-51.dll",
        "avformat-52.dll",
        "avutil-49.dll",
        "bass.dll",
        "bass_fx.dll",
        "collection.db",
        "d3dcompiler_47.dll",
        "libEGL.dll",
        "libGLESv2.dll",
        "Microsoft.Ink.dll",
        "OpenTK.dll",
        "osu!.cfg",
        "osu!.db",
        "osu!.exe",
        "osu!auth.dll",
        "osu!gameplay.dll",
        "osu!seasonal.dll",
        "osu!ui.dll",
        "presence.db",
        "pthreadGC2.dll",
        "scores.db",
    ];

    let folder_files: Vec<&str> = osu_folder_files.iter().map(|&s| s).collect();
    if folder_files.iter().any(|&file| file == "osu!.exe") == false {
        return false;
    }

    let path = PathBuf::from(folder);
    let match_percentage = check_folder_completeness(path, &osu_folder_files) >= 70.0;
    if match_percentage {
        return true;
    }
    return false;
}

#[cfg(not(windows))]
#[tauri::command]
pub fn find_osu_installation() -> Option<String> {
    None
}

#[cfg(windows)]
#[tauri::command]
pub fn find_osu_installation() -> Option<String> {
    use winreg::RegKey;
    use winreg::enums::*;

    let hklm_registry_paths = ["SOFTWARE\\Classes\\osu\\DefaultIcon"];

    let hkcr_registry_paths = [
        "osustable.File.osk\\DefaultIcon",
        "osustable.File.osr\\DefaultIcon",
        "osustable.File.osz\\DefaultIcon",
    ];

    let osu_folder_files = [
        "avcodec-51.dll",
        "avformat-52.dll",
        "avutil-49.dll",
        "bass.dll",
        "bass_fx.dll",
        "collection.db",
        "d3dcompiler_47.dll",
        "libEGL.dll",
        "libGLESv2.dll",
        "Microsoft.Ink.dll",
        "OpenTK.dll",
        "osu!.cfg",
        "osu!.db",
        "osu!.exe",
        "osu!auth.dll",
        "osu!gameplay.dll",
        "osu!seasonal.dll",
        "osu!ui.dll",
        "presence.db",
        "pthreadGC2.dll",
        "scores.db",
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
                        let match_percentage = check_folder_completeness(parent, &osu_folder_files);

                        if match_percentage >= 70.0 {
                            return Some(parent.to_string_lossy().into());
                        }
                    }
                }
            }
        }
    }

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);

    for reg_path in &hkcr_registry_paths {
        if let Ok(subkey) = hkcr.open_subkey_with_flags(reg_path, KEY_READ | KEY_WOW64_32KEY) {
            let value_names = [""];
            for value_name in &value_names {
                if let Ok(value) = subkey.get_value::<String, _>(value_name) {
                    let trimmed = value.trim_matches('"');
                    let stripped = trimmed.strip_suffix(",1").unwrap_or(trimmed);
                    let path = PathBuf::from(stripped.trim());
                    if let Some(parent) = path.parent() {
                        let match_percentage = check_folder_completeness(parent, &osu_folder_files);

                        if match_percentage >= 70.0 {
                            return Some(parent.to_string_lossy().into());
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn get_beatmapsets_count(folder: String) -> Option<u64> {
    let path = PathBuf::from(folder);
    let osu_user_config = get_osu_user_config(path.clone());
    let songs_path = osu_user_config
        .and_then(|config| config.get("Songs").cloned())
        .unwrap_or_else(|| path.join("Songs").to_string_lossy().into_owned());
    let songs_folder = PathBuf::from(songs_path);

    if !songs_folder.exists() {
        return None;
    }

    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(songs_folder) {
        for entry in entries.flatten() {
            if entry.file_type().map_or(false, |ft| ft.is_dir()) {
                let dir_path = entry.path();
                if let Ok(files) = std::fs::read_dir(&dir_path) {
                    for file in files.flatten() {
                        if file.path().extension().map_or(false, |ext| ext == "osu") {
                            count += 1;
                            break;
                        }
                    }
                }
            }
        }
    }
    return Some(count);
}

#[tauri::command]
pub fn get_skins_count(folder: String) -> Option<u64> {
    let path = PathBuf::from(folder);
    let skins_folder = path.join("Skins");

    if !skins_folder.exists() {
        return None;
    }

    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(skins_folder) {
        for entry in entries.flatten() {
            if entry.file_type().map_or(false, |ft| ft.is_dir()) {
                let dir_path = entry.path();
                if let Ok(files) = std::fs::read_dir(&dir_path) {
                    for file in files.flatten() {
                        if file.path().extension().map_or(false, |ext| ext == "ini") {
                            count += 1;
                            break;
                        }
                    }
                }
            }
        }
    }
    return Some(count);
}

#[tauri::command]
pub fn get_osu_skin(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_user_config = get_osu_user_config(path.clone());
    return osu_user_config
        .and_then(|config| config.get("Skin").cloned())
        .unwrap_or_else(|| "Default".to_string());
}

#[tauri::command]
pub fn get_osu_version(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_user_config = get_osu_user_config(path.clone());
    return osu_user_config
        .and_then(|config| config.get("LastVersion").cloned())
        .unwrap_or_else(|| "failed".to_string());
}

#[tauri::command]
pub fn get_osu_release_stream(folder: String) -> String {
    let path = PathBuf::from(folder);
    let osu_config = get_osu_config(path.clone());
    return osu_config
        .and_then(|config| config.get("_ReleaseStream").cloned())
        .unwrap_or_else(|| "Stable40".to_string());
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
    match set_osu_user_config_vals(&osu_folder_path, &converted) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
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
    match set_osu_config_vals(&osu_folder_path, &converted) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn run_osu_updater(folder: String) -> Result<(), String> {
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let osu_exe_path = PathBuf::from(folder.clone()).join("osu!.exe");
    
    #[cfg(windows)]
    const DETACHED_PROCESS: u32 = 0x00000008;
    #[cfg(windows)]
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    let handle = thread::spawn(move || {
        #[cfg(windows)]
        let mut updater_process = Command::new(&osu_exe_path)
            .arg("-repair")
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .ok()?; // Ignore error, just exit thread

        #[cfg(not(windows))]
        let mut updater_process = Command::new(&osu_exe_path).arg("-repair").spawn().ok()?; // Ignore error, just exit thread

        thread::sleep(Duration::from_millis(500));

        let mut sys = System::new_all();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut termination_thread_running = true;

        while termination_thread_running {
            for (_, process) in sys.processes() {
                if process.name() == "osu!.exe" {
                    let process_id = process.pid();
                    let window_title = get_window_title_by_pid(process_id);

                    if !window_title.is_empty() && !window_title.contains("updater") {
                        if let Ok(_) = process.kill_and_wait() {
                            termination_thread_running = false;
                            break;
                        }
                    }
                }
            }

            if !termination_thread_running {
                break;
            }

            thread::sleep(Duration::from_millis(500));
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        }

        let _ = updater_process.wait();

        let force_update_files = [".require_update", "help.txt", "_pending"];

        for update_file_name in &force_update_files {
            let update_file = PathBuf::from(&folder).join(update_file_name);
            if update_file.exists() {
                let metadata = std::fs::symlink_metadata(&update_file);
                if let Ok(meta) = metadata {
                    let result = if meta.is_dir() {
                        std::fs::remove_dir_all(&update_file)
                    } else {
                        std::fs::remove_file(&update_file)
                    };
                    if let Err(e) = result {
                        eprintln!(
                            "Failed to remove force update file {:?}: {}",
                            update_file, e
                        );
                    }
                }
            }
        }

        Some(())
    });

    handle.join().map_err(|_| "Thread panicked".to_string())?;
    Ok(())
}

#[tauri::command]
pub fn run_osu(folder: String, patch: bool) -> Result<(), String> {
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let osu_exe_path = PathBuf::from(&folder).join("osu!.exe");
    
    #[cfg(windows)]
    const DETACHED_PROCESS: u32 = 0x00000008;
    #[cfg(windows)]
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    #[cfg(windows)]
    let mut game_process = Command::new(osu_exe_path)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .arg("-devserver")
        .arg("ez-pp.farm")
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(not(windows))]
    let mut game_process = Command::new(osu_exe_path)
        .arg("-devserver")
        .arg("ez-pp.farm")
        .spawn()
        .map_err(|e| e.to_string())?;

    if patch {
        thread::sleep(Duration::from_secs(3));
        let patcher_exe_path = PathBuf::from(&folder)
            .join("EZPPLauncher")
            .join("patcher")
            .join("osu!.patcher.exe");

        if patcher_exe_path.exists() {
            #[cfg(windows)]
            {
                let _ = Command::new(&patcher_exe_path)
                    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                    .spawn()
                    .map_err(|e| format!("Failed to run patcher: {e}"))?;
            }

            #[cfg(not(windows))]
            {
                let _ = Command::new(&patcher_exe_path)
                    .spawn()
                    .map_err(|e| format!("Failed to run patcher: {e}"))?;
            }
        }
    }

    game_process.wait().map_err(|e| e.to_string())?;

    Ok(())
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
) -> Result<(Vec<UpdateFile>, Vec<UpdateFile>), String> {
    let osu_path = PathBuf::from(folder);
    let client = Client::new();

    let update_files = client
        .patch(update_url)
        .header("User-Agent", "EZPPLauncher")
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
            if hash.to_lowercase() != file.md5.to_lowercase() {
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

            // Emit progress to frontend
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

    Ok(())
}

#[derive(Serialize)]
#[serde(tag = "type", content = "details")]
pub enum ReplaceUIError {
    FileNotFound(String),
    PermissionDenied(String),
    IoError(String),
}

#[tauri::command]
pub fn replace_ui_files(folder: String, revert: bool) -> Result<(), ReplaceUIError> {
    let osu_path = PathBuf::from(folder);
    let ezpp_ui = osu_path.join("EZPPLauncher").join("ezpp!ui.dll");
    let osu_ui = osu_path.join("osu!ui.dll");
    let ezpp_gameplay = osu_path.join("EZPPLauncher").join("ezpp!gameplay.dll");
    let osu_gameplay = osu_path.join("osu!gameplay.dll");

    let osu_ui_bak = osu_path.join("osu!ui.dll.bak");
    let osu_gameplay_bak = osu_path.join("osu!gameplay.dll.bak");

    let try_rename = |from: &PathBuf, to: &PathBuf| -> Result<(), ReplaceUIError> {
        if !from.exists() {
            return Err(ReplaceUIError::FileNotFound(from.display().to_string()));
        }
        std::fs::rename(from, to).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => {
                ReplaceUIError::FileNotFound(from.display().to_string())
            }
            std::io::ErrorKind::PermissionDenied => {
                ReplaceUIError::PermissionDenied(from.display().to_string())
            }
            _ => ReplaceUIError::IoError(e.to_string()),
        })
    };

    if !revert {
        try_rename(&osu_ui, &osu_ui_bak)?;
        try_rename(&ezpp_ui, &osu_ui)?;

        try_rename(&osu_gameplay, &osu_gameplay_bak)?;
        try_rename(&ezpp_gameplay, &osu_gameplay)?;
    } else {
        try_rename(&osu_ui, &ezpp_ui)?;
        try_rename(&osu_ui_bak, &osu_ui)?;

        try_rename(&osu_gameplay, &ezpp_gameplay)?;
        try_rename(&osu_gameplay_bak, &osu_gameplay)?;
    }

    Ok(())
}

#[tauri::command]
pub fn is_osu_running() -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in sys.processes().values() {
        if process.name().eq_ignore_ascii_case("osu!.exe") {
            return true;
        }
    }

    false
}

#[tauri::command]
pub fn open_url_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}
