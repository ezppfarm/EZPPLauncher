use std::ffi::OsString;
use std::fs;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use std::ptr;
use sysinfo::Pid;
use winapi::um::winuser::{FindWindowW, GetWindowTextW, GetWindowThreadProcessId};

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

pub fn set_osu_user_config_value(
    osu_folder_path: &str,
    key: &str,
    value: &str,
) -> Result<bool, String> {
    let current_user = std::env::var("USERNAME").unwrap_or_else(|_| "Admin".to_string());
    let osu_config_path = Path::new(osu_folder_path).join(format!("osu!.{}.cfg", current_user));

    if !osu_config_path.exists() {
        return Ok(false);
    }

    let mut lines = fs::read_to_string(&osu_config_path)
        .map_err(|e| e.to_string())?
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<String>>();

    let mut found_key = false;

    for line in lines.iter_mut() {
        if let Some((existing_key, _)) = line.split_once(" = ") {
            if existing_key.trim() == key {
                *line = format!("{} = {}", key, value);
                found_key = true;
                break;
            }
        }
    }

    if !found_key {
        lines.push(format!("{} = {}", key, value));
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
    let mut window_title = String::new();

    unsafe {
        let hwnd = FindWindowW(ptr::null_mut(), ptr::null_mut());

        if hwnd.is_null() {
            return String::new();
        }

        let mut process_id = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if process_id == pid.as_u32() {
            let mut title = vec![0u16; 512];
            let length = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);

            let title = OsString::from_wide(&title[..length as usize]);
            window_title = title.to_string_lossy().into_owned();
        }
    }

    window_title
}
