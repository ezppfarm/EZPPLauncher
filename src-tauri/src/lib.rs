// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use hardware_id::get_id;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod commands;
pub mod config;
pub mod osudb;
pub mod presence;
pub mod state;
pub mod utils;
use crate::{
    commands::{
        check_for_corruption, config_all, config_clear, config_delete, config_exists, config_get,
        config_set, download_and_extract_theme, download_ezpp_launcher_update,
        download_ezpp_launcher_update_files, encrypt_string, exit, extract_theme,
        find_osu_installation, get_beatmapsets_count, get_ezpp_launcher_update_files, get_hwid,
        get_launcher_version, get_osu_release_stream, get_osu_skin, get_osu_version, get_platform,
        get_skins, get_skins_count, has_net8, has_osuwinello, has_wmctrl,
        install_ezpp_launcher_update, is_osu_running, open_url_in_browser, opened_urls,
        presence_connect, presence_disconnect, presence_is_connected, presence_update_button,
        presence_update_status, presence_update_user, read_theme_info, replace_ui_files, run_osu,
        run_osu_updater, set_osu_config_values, set_osu_user_config_values, valid_osu_folder,
    },
    state::AppState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    unsafe {
        // std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let app_window = app.get_webview_window("main").expect("no main window");
            app_window.set_focus().expect("failed to focus");
            if args.len() > 1 {
                use tauri::Emitter;

                let mut files = Vec::new();

                for maybe_file in args.iter().skip(1) {
                    if maybe_file.starts_with("-") {
                        continue;
                    }

                    let path = PathBuf::from(maybe_file);

                    if path.extension().and_then(|e| e.to_str()) == Some("ezpplauncher-theme") {
                        app.fs_scope().allow_file(&path).ok();
                        files.push(path);
                    }
                }

                app.emit("opened", files.clone()).ok();
            }
        }));
    }

    let app = builder
        .setup(|app| {
            // ── Config ────────────────────────────────────────────────────────
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .unwrap_or_else(|_| ".".into());
            let db_path = PathBuf::from(home).join(".ezpplauncher").join("config.db");

            let hwid = get_id().unwrap_or_else(|_| "recorderinsandybridge".into());

            let mut cfg = config::Config::new(db_path);
            cfg.init(&hwid)?;

            // ── Opened files ──────────────────────────────────────────────────
            let mut opened_files = Vec::new();
            let args = std::env::args().collect::<Vec<_>>();
            if args.len() > 1 {
                for maybe_file in args.iter().skip(1) {
                    if maybe_file.starts_with("-") {
                        continue;
                    }
                    let path = PathBuf::from(maybe_file);
                    if path.extension().and_then(|e| e.to_str()) == Some("ezpplauncher-theme") {
                        app.fs_scope().allow_file(&path).ok();
                        opened_files.push(path);
                    }
                }
            }

            app.manage(AppState {
                config: Mutex::new(cfg),
                opened_files: Mutex::new(opened_files),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            opened_urls,
            get_hwid,
            find_osu_installation,
            valid_osu_folder,
            get_beatmapsets_count,
            get_skins,
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
            presence_update_button,
            presence_is_connected,
            has_osuwinello,
            has_wmctrl,
            has_net8,
            encrypt_string,
            download_ezpp_launcher_update,
            install_ezpp_launcher_update,
            read_theme_info,
            extract_theme,
            download_and_extract_theme,
            config_get,
            config_set,
            config_exists,
            config_delete,
            config_clear,
            config_all,
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        presence::handle_run_event(app, &event);
    });
}
