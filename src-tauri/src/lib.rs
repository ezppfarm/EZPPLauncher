// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use hardware_id::get_id;
use std::path::PathBuf;
use tauri::Manager;
use winreg::RegKey;
use winreg::enums::*;

mod utils;
use crate::utils::check_folder_completeness;
use crate::utils::get_osu_user_config;


#[tauri::command]
fn get_hwid() -> String {
    let hwid = get_id().unwrap();
    hwid.into()
}

#[tauri::command(rename_all = "snake_case")]
fn valid_osu_folder(folder: String) -> bool {
    // List of files that should be present in the osu! installation folder
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
fn find_osu_installation() -> Option<String> {
    // List of possible registry paths to check for osu! installation
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
fn get_beatmapsets_count(folder: String) -> Option<u64> {
    let path = PathBuf::from(folder);
    let osu_config = get_osu_user_config(path.clone());
    let songs_path = osu_config
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let app_window = app.get_webview_window("main").expect("no main window");
            app_window
                .set_always_on_top(true)
                .expect("failed to set always on top");
            app_window.set_focus().expect("failed to focus");
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            get_hwid,
            find_osu_installation,
            valid_osu_folder,
            get_beatmapsets_count
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
