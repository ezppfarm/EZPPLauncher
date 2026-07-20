use crate::config::ConfigError;
use hardware_id::get_id;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::io::Read;
use std::path::PathBuf;
use std::process::Stdio;
use sysinfo::System;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_fs::FsExt;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::{Duration, sleep};

use crate::osudb::parse_osudb;
use crate::presence;
use crate::state::AppState;
use crate::utils::{
    check_folder_completeness, encrypt_password, get_osu_config, get_osu_user_config,
    get_window_title_by_pid, is_net8_installed, is_osuwinello_available, is_wmctrl_available,
    set_osu_config_vals, set_osu_user_config_vals,
};

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

#[tauri::command]
pub fn get_hwid() -> String {
    get_id()
        .unwrap_or("recorderinsandybridge".to_string())
        .into()
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

    let path = PathBuf::from(folder);
    if !path.join("osu!.exe").exists() {
        return false;
    }
    check_folder_completeness(path, &osu_folder_files) >= 70.0
}

#[tauri::command]
pub fn find_osu_installation() -> Option<String> {
    #[cfg(windows)]
    {
        use winreg::RegKey;
        use winreg::enums::*;

        let hklm_registry_paths = ["SOFTWARE\\Classes\\osu\\DefaultIcon"];

        let hkcu_registry_paths = [
            "Software\\Classes\\osustable.File.osk\\DefaultIcon",
            "Software\\Classes\\osustable.File.osr\\DefaultIcon",
            "Software\\Classes\\osustable.File.osz\\DefaultIcon",
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
                            let match_percentage =
                                check_folder_completeness(parent, &osu_folder_files);

                            if match_percentage >= 70.0 {
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
                            let match_percentage =
                                check_folder_completeness(parent, &osu_folder_files);

                            if match_percentage >= 70.0 {
                                return Some(parent.to_string_lossy().into());
                            }
                        }
                    }
                }
            }
        }
    }
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkinInfo {
    pub name: String,
    pub author: Option<String>,
    pub modified: u64,
}

#[tauri::command]
pub async fn get_skins(folder: String) -> Option<Vec<SkinInfo>> {
    use std::path::PathBuf;
    use std::time::UNIX_EPOCH;
    use tokio::fs;

    let skins_folder = PathBuf::from(folder).join("Skins");

    if !skins_folder.exists() {
        return None;
    }

    let mut entries = fs::read_dir(skins_folder).await.ok()?;

    let mut skins = Vec::new();

    while let Some(entry) = entries.next_entry().await.ok()? {
        if !entry.file_type().await.ok()?.is_dir() {
            continue;
        }

        let dir_path = entry.path();
        let skin_ini = dir_path.join("skin.ini");

        if !skin_ini.exists() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();

        let author = fs::read_to_string(&skin_ini)
            .await
            .ok()
            .and_then(|content| {
                content.lines().find_map(|line| {
                    let (key, value) = line.split_once(':')?;
                    key.trim()
                        .eq_ignore_ascii_case("Author")
                        .then(|| value.trim().to_string())
                })
            });

        let modified = entry
            .metadata()
            .await
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        skins.push(SkinInfo {
            name,
            author,
            modified,
        });
    }

    Some(skins)
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
            if entry.file_type().await.map_or(false, |ft| ft.is_dir()) {
                let dir_path = entry.path();
                if let Ok(mut files) = fs::read_dir(&dir_path).await {
                    while let Ok(Some(file)) = files.next_entry().await {
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
    let mut updater_process = {
        #[cfg(windows)]
        {
            const DETACHED_PROCESS: u32 = 0x00000008;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
            let osu_exe_path = PathBuf::from(&folder).join("osu!.exe");
            Command::new(&osu_exe_path)
                .arg("-repair")
                .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                .spawn()
                .map_err(|e| format!("Failed to spawn updater: {}", e))?
        }

        #[cfg(not(windows))]
        {
            Command::new("osu-wine")
                .arg("-repair")
                .spawn()
                .map_err(|e| format!("Failed to spawn updater: {}", e))?
        }
    };

    sleep(Duration::from_millis(500)).await;

    let mut sys = System::new_all();

    loop {
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut found = false;

        for (_pid, process) in sys.processes() {
            if process.name() == "osu!.exe" {
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

    let _ = updater_process.wait().await;

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
                        eprintln!("Failed to remove {:?}: {}", path, e);
                    }
                }
                Err(e) => {
                    eprintln!("Could not stat {:?}: {}", path, e);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn run_osu(folder: String, patch: bool) -> Result<(), String> {
    #[cfg(windows)]
    const DETACHED_PROCESS: u32 = 0x00000008;
    #[cfg(windows)]
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    let mut game_process = {
        #[cfg(windows)]
        {
            let osu_exe_path = PathBuf::from(&folder).join("osu!.exe");
            Command::new(&osu_exe_path)
                .arg("-devserver")
                .arg("ez-pp.farm")
                .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                .spawn()
                .map_err(|e| format!("Failed to spawn osu: {}", e))?
        }

        #[cfg(not(windows))]
        {
            Command::new("osu-wine")
                .arg("--devserver")
                .arg("ez-pp.farm")
                .spawn()
                .map_err(|e| format!("Failed to spawn osu: {}", e))?
        }
    };

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
            #[cfg(windows)]
            {
                let _ = Command::new(&patcher_exe_path)
                    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                    .spawn()
                    .map_err(|e| format!("Failed to run patcher: {e}"))?;
            }
            #[cfg(not(windows))]
            {
                let _ = Command::new("osu-wine")
                    .arg("--wine")
                    .arg(&patcher_exe_path)
                    .spawn()
                    .map_err(|e| format!("Failed to run patcher: {}", e))?;
            }
        }
    }

    //TODO: maybe implement tosu?
    /* let tosu_exe_path = PathBuf::from(&folder)
        .join("EZPPLauncher")
        .join("tosu")
        .join("tosu.exe");

    let mut _tosu_process: Option<_> = None;

    if tosu_exe_path.exists() {
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
        #[cfg(windows)]
        {
            _tosu_process = Some(
                Command::new(&tosu_exe_path)
                    /* .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP) */
                    .spawn()
                    .map_err(|e| format!("Failed to run tosu: {e}"))?,
            );
        }
        /* #[cfg(not(windows))]
        {
            let _ = Command::new("osu-wine")
                .arg("--wine")
                .arg(&tosu_exe_path)
                .spawn()
                .map_err(|e| format!("Failed to run tosu: {}", e))?;
        } */
    } */

    game_process.wait().await.map_err(|e| e.to_string())?;

    /* if let Some(mut tosu_process) = _tosu_process {
        tosu_process.kill().await.map_err(|e| e.to_string())?;
    } */

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

#[derive(Serialize, Deserialize, Clone)]
pub struct ThemeInfo {
    pub name: String,
    pub entry: String,
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
