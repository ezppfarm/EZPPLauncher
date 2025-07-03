use std::path::Path;

/// Checks the presence of required files in a folder and returns the percentage found.
///
/// # Arguments
/// * `folder_path` - The path to the folder to check.
/// * `required_files` - A slice of file names that should be present in the folder.
///
/// # Returns
/// * `f32` - The percentage (0.0 to 100.0) of required files found in the folder.
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
    // Ensure the osu! folder path is valid
    if !osu_folder_path.as_ref().exists() {
        return None;
    }

    // get the osu!{username}.cfg file from the osu! folder
    let current_user = std::env::var("USERNAME").unwrap_or_else(|_| "Admin".to_string());
    let osu_config_path = osu_folder_path
        .as_ref()
        .join(format!("osu!.{}.cfg", current_user));
    if !osu_config_path.exists() {
        return None;
    }

    // read the osu config and return it as a map, key and value are separated by ' = '
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

pub fn get_osu_config<P: AsRef<Path>>(
    osu_folder_path: P,
) -> Option<std::collections::HashMap<String, String>> {
    // Ensure the osu! folder path is valid
    if !osu_folder_path.as_ref().exists() {
        return None;
    }

    // get the osu!.cfg file from the osu! folder
    let osu_config_path = osu_folder_path.as_ref().join("osu!.cfg");
    if !osu_config_path.exists() {
        return None;
    }

    // read the osu config and return it as a map, key and value are separated by ' = '
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
