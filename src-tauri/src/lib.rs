// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

pub mod commands;
pub mod presence;
pub mod utils;
use crate::commands::{
    check_for_corruption, download_ezpp_launcher_update, download_ezpp_launcher_update_files,
    encrypt_string, exit, find_osu_installation, get_beatmapsets_count,
    get_ezpp_launcher_update_files, get_hwid, get_launcher_version, get_osu_release_stream,
    get_osu_skin, get_osu_version, get_platform, get_skins_count, has_net8, has_osuwinello,
    has_wmctrl, install_ezpp_launcher_update, is_osu_running, open_url_in_browser,
    presence_connect, presence_disconnect, presence_is_connected, presence_update_status,
    presence_update_user, replace_ui_files, run_osu, run_osu_updater, set_osu_config_values,
    set_osu_user_config_values, valid_osu_folder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let app_window = app.get_webview_window("main").expect("no main window");
            app_window.set_focus().expect("failed to focus");
        }));
    }

    let app = builder
        .invoke_handler(tauri::generate_handler![
            get_hwid,
            find_osu_installation,
            valid_osu_folder,
            get_beatmapsets_count,
            get_skins_count,
            get_osu_version,
            get_osu_release_stream,
            set_osu_config_values,
            set_osu_user_config_values,
            run_osu_updater,
            run_osu,
            get_osu_skin,
            get_ezpp_launcher_update_files,
            download_ezpp_launcher_update_files,
            replace_ui_files,
            is_osu_running,
            open_url_in_browser,
            get_launcher_version,
            exit,
            get_platform,
            check_for_corruption,
            presence_connect,
            presence_disconnect,
            presence_update_status,
            presence_update_user,
            presence_is_connected,
            has_osuwinello,
            has_wmctrl,
            has_net8,
            encrypt_string,
            download_ezpp_launcher_update,
            install_ezpp_launcher_update
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            api.prevent_exit();

            tauri::async_runtime::block_on(presence::disconnect());
            std::process::exit(0);
        }
    });
}
