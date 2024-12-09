#[tauri::command]
pub fn wave(name: &str) -> String {
    format!("Hello, {}! You've been waved from Rust, with a different file!", name)
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust, with a different file!", name)
}