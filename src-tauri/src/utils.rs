use std::fs;
use std::io::Write;
use std::path::Path;

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

pub fn set_osu_user_config_value<P: AsRef<Path>>(
    osu_folder_path: P,
    key: &str,
    value: &str,
) -> std::io::Result<()> {
    // Determine the config file path
    let current_user = std::env::var("USERNAME").unwrap_or_else(|_| "Admin".to_string());
    let osu_config_path = osu_folder_path
        .as_ref()
        .join(format!("osu!.{}.cfg", current_user));

    // Read existing config into a Vec of lines
    let mut lines = if osu_config_path.exists() {
        fs::read_to_string(&osu_config_path)?
            .lines()
            .map(|line| line.to_string())
            .collect::<Vec<String>>()
    } else {
        Vec::new()
    };

    let mut found = false;

    for line in lines.iter_mut() {
        if let Some((existing_key, _)) = line.split_once(" = ") {
            if existing_key.trim() == key {
                *line = format!("{} = {}", key, value);
                found = true;
                break;
            }
        }
    }

    // If the key was not found, append it
    if !found {
        lines.push(format!("{} = {}", key, value));
    }

    // Write back the file
    let mut file = fs::File::create(&osu_config_path)?;
    for line in lines {
        writeln!(file, "{}", line)?;
    }

    Ok(())
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
