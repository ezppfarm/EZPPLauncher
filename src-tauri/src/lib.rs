// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

pub mod commands;
pub mod utils;
use crate::commands::{
    find_osu_installation, get_beatmapsets_count, get_hwid, get_osu_release_stream,
    get_osu_version, get_skins_count, run_osu, run_osu_updater, set_osu_config_value,
    set_osu_user_config_value, valid_osu_folder,
};

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
            get_beatmapsets_count,
            get_skins_count,
            get_osu_version,
            get_osu_release_stream,
            set_osu_config_value,
            set_osu_user_config_value,
            run_osu_updater,
            run_osu
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
