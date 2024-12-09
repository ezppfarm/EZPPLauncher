// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod actions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![actions::greet, actions::wave])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
