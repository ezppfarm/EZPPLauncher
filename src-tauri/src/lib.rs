// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use hardware_id::get_id;
use tauri::Manager;

#[tauri::command]
fn get_hwid() -> String {
    let hwid = get_id().unwrap();
    hwid.into()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_fs::init());
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
        .invoke_handler(tauri::generate_handler![get_hwid])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
