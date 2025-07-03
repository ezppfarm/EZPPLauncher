use hardware_id::get_id;
use std::path::PathBuf;
use winreg::RegKey;
use winreg::enums::*;

use crate::utils::set_osu_user_config_value;
use crate::utils::{check_folder_completeness, get_osu_config, get_osu_user_config};

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

#[tauri::command]
pub fn find_osu_installation() -> Option<String> {
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
    return None;
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

#[tauri::command]
pub fn set_osu_config_value(
    osu_folder_path: String,
    key: String,
    value: String,
) -> Result<bool, String> {
    set_osu_user_config_value(&osu_folder_path, &key, &value)
}
