use std::ffi::OsString;
use std::fs;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use sysinfo::Pid;

pub fn check_folder_completeness<P: AsRef<Path>>(folder_path: P, required_files: &[&str]) -> f32 {
    let mut found = 0;
    for file in required_files {
        let file_path = folder_path.as_ref().join(file);
        if file_path.exists() {
            found += 1;
        }
    }
    if required_files.is_empty() {
        100.0
    } else {
        (found as f32 / required_files.len() as f32) * 100.0
    }
}

pub fn get_osu_user_config<P: AsRef<Path>>(
    osu_folder_path: P,
) -> Option<std::collections::HashMap<String, String>> {
    if !osu_folder_path.as_ref().exists() {
        return None;
    }

    let current_user = std::env::var("USERNAME").unwrap_or_else(|_| "Admin".to_string());
    let osu_config_path = osu_folder_path
        .as_ref()
        .join(format!("osu!.{}.cfg", current_user));
    if !osu_config_path.exists() {
        return None;
    }

    let mut config_map = std::collections::HashMap::new();
    if let Ok(contents) = std::fs::read_to_string(osu_config_path) {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once(" = ") {
                config_map.insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    return Some(config_map);
}

pub fn set_osu_user_config_vals(
    osu_folder_path: &str,
    key_values: &[(&str, Option<&str>)],
) -> Result<bool, String> {
    let current_user = std::env::var("USERNAME").unwrap_or_else(|_| "Admin".to_string());
    let osu_config_path = Path::new(osu_folder_path).join(format!("osu!.{}.cfg", current_user));

    if !osu_config_path.exists() {
        return Err("osu! user config file does not exist".to_string());
    }

    let mut lines = fs::read_to_string(&osu_config_path)
        .map_err(|e| e.to_string())?
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<String>>();

    let mut keys_to_set: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    let mut keys_to_add: std::collections::HashSet<&str> = std::collections::HashSet::new();

    for (key, value_opt) in key_values.iter() {
        if let Some(value) = value_opt {
            keys_to_set.insert(*key, *value);
            keys_to_add.insert(*key);
        }
    }

    // Collect indices and keys to update to avoid borrow checker issues
    let mut updates = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        if let Some((existing_key, _)) = line.split_once(" = ") {
            let trimmed_key = existing_key.trim();
            if let Some(new_value) = keys_to_set.get(trimmed_key) {
                updates.push((i, trimmed_key.to_string(), new_value.to_string()));
            }
        }
    }
    for (i, trimmed_key, new_value) in updates {
        lines[i] = format!("{} = {}", trimmed_key, new_value);
        keys_to_add.remove(trimmed_key.as_str());
    }

    // Add new keys that were not found
    for key in keys_to_add {
        if let Some(value) = keys_to_set.get(key) {
            lines.push(format!("{} = {}", key, value));
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&osu_config_path, new_content).map_err(|e| e.to_string())?;

    Ok(true)
}

pub fn set_osu_config_vals(
    osu_folder_path: &str,
    key_values: &[(&str, Option<&str>)],
) -> Result<bool, String> {
    let osu_config_path = Path::new(osu_folder_path).join("osu!.cfg");

    if !osu_config_path.exists() {
        return Err("osu!.cfg file does not exist".to_string());
    }

    let mut lines = fs::read_to_string(&osu_config_path)
        .map_err(|e| e.to_string())?
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<String>>();

    let mut keys_to_set: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    let mut keys_to_add: std::collections::HashSet<&str> = std::collections::HashSet::new();

    for (key, value_opt) in key_values.iter() {
        if let Some(value) = value_opt {
            keys_to_set.insert(*key, *value);
            keys_to_add.insert(*key);
        }
    }

    let mut updates = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        if let Some((existing_key, _)) = line.split_once(" = ") {
            let trimmed_key = existing_key.trim();
            if let Some(new_value) = keys_to_set.get(trimmed_key) {
                updates.push((i, trimmed_key.to_string(), new_value.to_string()));
            }
        }
    }
    for (i, trimmed_key, new_value) in updates {
        lines[i] = format!("{} = {}", trimmed_key, new_value);
        keys_to_add.remove(trimmed_key.as_str());
    }

    // Add new keys that were not found
    for key in keys_to_add {
        if let Some(value) = keys_to_set.get(key) {
            lines.push(format!("{} = {}", key, value));
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&osu_config_path, new_content).map_err(|e| e.to_string())?;

    Ok(true)
}

pub fn get_osu_config<P: AsRef<Path>>(
    osu_folder_path: P,
) -> Option<std::collections::HashMap<String, String>> {
    if !osu_folder_path.as_ref().exists() {
        return None;
    }

    let osu_config_path = osu_folder_path.as_ref().join("osu!.cfg");
    if !osu_config_path.exists() {
        return None;
    }

    let mut config_map = std::collections::HashMap::new();
    if let Ok(contents) = std::fs::read_to_string(osu_config_path) {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once(" = ") {
                config_map.insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    return Some(config_map);
}

pub fn get_window_title_by_pid(pid: Pid) -> String {
    use std::sync::{Arc, Mutex};
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    extern "system" fn enum_windows_proc(
        hwnd: HWND,
        lparam: winapi::shared::minwindef::LPARAM,
    ) -> i32 {
        unsafe {
            let data = &mut *(lparam as *mut (u32, Arc<Mutex<Option<String>>>));
            let target_pid = data.0;
            let result = &data.1;

            let mut window_pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut window_pid);
            if window_pid == target_pid && IsWindowVisible(hwnd) != 0 {
                let mut title = vec![0u16; 512];
                let length = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
                if length > 0 {
                    let title = OsString::from_wide(&title[..length as usize]);
                    let title_str = title.to_string_lossy().into_owned();
                    if !title_str.is_empty() {
                        *result.lock().unwrap() = Some(title_str);
                        return 0; // Stop enumeration
                    }
                }
            }
            1 // Continue enumeration
        }
    }

    let result = Arc::new(Mutex::new(None));
    let mut data = (pid.as_u32(), Arc::clone(&result));
    unsafe {
        EnumWindows(
            Some(enum_windows_proc),
            &mut data as *mut _ as winapi::shared::minwindef::LPARAM,
        );
    }
    result.lock().unwrap().clone().unwrap_or_default()
}
