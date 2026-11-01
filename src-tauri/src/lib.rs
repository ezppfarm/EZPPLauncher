// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use hardware_id::get_id;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod commands;
pub mod config;
pub mod logging;
#[cfg(target_os = "macos")]
pub mod macos;
pub mod osudb;
pub mod presence;
pub mod state;
#[cfg(any(target_os = "linux", target_os = "macos"))]
pub mod theme_server;
pub mod utils;
use crate::{
    commands::{
        backup_theme_folder, check_for_corruption, close_presence_editor, close_theme_editor, config_all, config_clear, config_delete,
        config_exists, config_get, config_set, download_and_extract_theme,
        download_ezpp_launcher_update, download_ezpp_launcher_update_files, encrypt_string, exit,
        export_theme, extract_theme, file_size, find_osu_installation, focus_presence_editor, focus_theme_editor, get_beatmapsets_count,
        get_ezpp_launcher_update_files, get_hwid, get_launcher_version, get_osu_release_stream,
        get_osu_skin, get_osu_version, get_platform, get_skins_count, has_net8, has_osuwinello,
        has_wmctrl, hash_file_sha256, install_ezpp_launcher_update, installation_diagnostics,
        is_open_tablet_driver_path_valid, is_open_tablet_driver_running, is_osu_running,
        list_theme_backups, log_frontend, open_logs_folder, open_presence_editor, open_theme_editor, open_theme_folder,
        open_url_in_browser, opened_urls, optimize_theme_media, pick_osu_installation,
        presence_connect, presence_disconnect, presence_is_connected, presence_update_activity,
        presence_update_button, presence_update_status, presence_update_user, read_file_chunk, read_theme_info, replace_ui_files,
        resolve_osu_folder, restore_theme_backup, reveal_window, run_open_tablet_driver, run_osu, run_osu_updater,
        save_theme_project, set_logging_enabled, set_osu_config_values, set_osu_user_config_values,
        stop_open_tablet_driver, theme_asset_base, theme_editor_context, theme_preview_url,
        unlock_media_autoplay, valid_osu_folder,
    },
    state::AppState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(logging::plugin());
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
            log::info!(
                target: "launcher",
                "EZPPLauncher {} starting on {} ({}) — logs: {}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH,
                logging::logs_directory().display()
            );

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
                editor_theme_folder: Mutex::new(None),
            });

            // WebKit's custom-protocol media pipeline is unreliable (and
            // loads large WebMs into memory), so Linux and macOS use a real
            // loopback HTTP server with byte-range support instead.
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            match commands::theme_root().and_then(|root| {
                let media = theme_server::media_root()?;
                theme_server::start(root, media)
            }) {
                Ok(_) => {}
                Err(error) => log::warn!(
                    target: "launcher",
                    "Could not start the theme asset server: {error}"
                ),
            }

            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = macos::round_window(&window, 12.0) {
                    log::warn!(target: "launcher", "Could not round the launcher window: {error}");
                }
                if let Err(error) = macos::allow_media_autoplay(&window) {
                    log::warn!(target: "launcher", "{error}");
                }
                if let Err(error) = macos::unlock_media_autoplay(&window) {
                    log::warn!(target: "launcher", "{error}");
                }
                if let Err(error) = macos::activate_and_focus_window(&window) {
                    log::warn!(target: "launcher", "Could not focus launcher window on startup: {error}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            opened_urls,
            get_hwid,
            find_osu_installation,
            pick_osu_installation,
            resolve_osu_folder,
            valid_osu_folder,
            get_beatmapsets_count,
            get_skins_count,
            get_osu_version,
            get_osu_release_stream,
            installation_diagnostics,
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
            file_size,
            check_for_corruption,
            presence_connect,
            presence_disconnect,
            presence_update_status,
            presence_update_user,
            presence_update_button,
            presence_update_activity,
            presence_is_connected,
            has_osuwinello,
            has_wmctrl,
            has_net8,
            encrypt_string,
            download_ezpp_launcher_update,
            install_ezpp_launcher_update,
            read_theme_info,
            backup_theme_folder,
            list_theme_backups,
            restore_theme_backup,
            extract_theme,
            download_and_extract_theme,
            save_theme_project,
            export_theme,
            hash_file_sha256,
            read_file_chunk,
            open_theme_folder,
            open_theme_editor,
            focus_theme_editor,
            close_theme_editor,
            open_presence_editor,
            focus_presence_editor,
            close_presence_editor,
            theme_editor_context,
            theme_asset_base,
            theme_preview_url,
            optimize_theme_media,
            config_get,
            config_set,
            config_exists,
            config_delete,
            config_clear,
            config_all,
            run_open_tablet_driver,
            stop_open_tablet_driver,
            is_open_tablet_driver_running,
            is_open_tablet_driver_path_valid,
            log_frontend,
            set_logging_enabled,
            open_logs_folder,
            reveal_window,
            unlock_media_autoplay,
            logging::list_log_bundles,
            logging::read_log_bundle
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        // The content view can be replaced again while the webview is being
        // built, so re-apply the corner mask once the app is ready.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Ready = &event
            && let Some(window) = app.get_webview_window("main") {
                if let Err(error) = macos::round_window(&window, 12.0) {
                    log::warn!(target: "launcher", "Could not round the launcher window: {error}");
                }
                if let Err(error) = macos::allow_media_autoplay(&window) {
                    log::warn!(target: "launcher", "{error}");
                }
                if let Err(error) = macos::unlock_media_autoplay(&window) {
                    log::warn!(target: "launcher", "{error}");
                }
                if let Err(error) = macos::activate_and_focus_window(&window) {
                    log::warn!(target: "launcher", "Could not focus launcher window on ready: {error}");
                }
            }

        presence::handle_run_event(app, &event);
    });
}
