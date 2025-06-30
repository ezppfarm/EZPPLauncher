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