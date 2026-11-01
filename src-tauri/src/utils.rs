use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use sysinfo::Pid;

pub const OSU_FOLDER_FILES: &[&str] = &[
    "avcodec-51.dll",
    "avformat-52.dll",
    "avutil-49.dll",
    "bass.dll",
    "bass_fx.dll",
    "collection.db",
    "d3dcompiler_47.dll",
    "libEGL.dll",
    "libGLESv2.dll",
    "Microsoft.Ink.dll",
    "OpenTK.dll",
    "osu!.cfg",
    "osu!.db",
    "osu!.exe",
    "osu!auth.dll",
    "osu!gameplay.dll",
    "osu!seasonal.dll",
    "osu!ui.dll",
    "presence.db",
    "pthreadGC2.dll",
    "scores.db",
];

pub fn is_valid_osu_folder<P: AsRef<Path>>(folder_path: P) -> bool {
    let folder_path = folder_path.as_ref();
    folder_path.join("osu!.exe").is_file()
        && check_folder_completeness(folder_path, OSU_FOLDER_FILES) >= 70.0
}

/// True if the process is osu! (either running natively or through Wine/Proton).
pub fn is_osu_process(process: &sysinfo::Process) -> bool {
    let name = process.name().to_string_lossy().to_ascii_lowercase();
    if name.ends_with("osu!.exe") {
        return true;
    }

    if let Some(exe) = process.exe() {
        if exe
            .file_name()
            .map(|file_name| file_name.to_string_lossy().to_ascii_lowercase() == "osu!.exe")
            .unwrap_or(false)
        {
            return true;
        }
    }

    process.cmd().iter().any(|arg| {
        arg.to_string_lossy()
            .to_ascii_lowercase()
            .contains("osu!.exe")
    })
}

/// Like [`is_osu_process`], but excludes the osu! updater started with `-repair`.
pub fn is_osu_game_process(process: &sysinfo::Process) -> bool {
    is_osu_process(process)
        && !process.cmd().iter().any(|arg| {
            arg.to_string_lossy()
                .to_ascii_lowercase()
                .contains("-repair")
        })
}

fn find_osu_user_config_path<P: AsRef<Path>>(folder_path: P) -> Option<PathBuf> {
    let folder_path = folder_path.as_ref();
    if !folder_path.is_dir() {
        return None;
    }

    if let Ok(current_user) = std::env::var("USERNAME").or_else(|_| std::env::var("USER")) {
        let config_path = folder_path.join(format!("osu!.{}.cfg", current_user));
        if config_path.is_file() {
            return Some(config_path);
        }
    }

    // The Windows username inside a Wine prefix does not always match the host
    // username (especially on macOS), so fall back to the most recent osu!.*.cfg.
    let mut candidates = fs::read_dir(folder_path)
        .ok()?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
            if !file_name.starts_with("osu!.") || !file_name.ends_with(".cfg") {
                return None;
            }
            if file_name == "osu!.cfg" {
                return None;
            }

            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            Some((modified, path))
        })
        .collect::<Vec<_>>();

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, path)| path)
}

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
    let osu_config_path = find_osu_user_config_path(osu_folder_path)?;

    let mut config_map = std::collections::HashMap::new();
    if let Ok(contents) = std::fs::read_to_string(osu_config_path) {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once(" = ") {
                config_map.insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    Some(config_map)
}

pub fn set_osu_user_config_vals(
    osu_folder_path: &str,
    key_values: &[(&str, Option<&str>)],
) -> Result<bool, String> {
    let osu_config_path = find_osu_user_config_path(osu_folder_path)
        .ok_or_else(|| "osu! user config file does not exist".to_string())?;

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

#[cfg(target_os = "linux")]
pub fn get_osuwinello_path() -> Option<PathBuf> {
    let mut search_paths =
        std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).collect::<Vec<_>>();

    for path in ["/usr/local/bin", "/usr/bin", "/bin"] {
        let path = PathBuf::from(path);
        if !search_paths.contains(&path) {
            search_paths.push(path);
        }
    }

    if let Some(home) = std::env::var_os("HOME") {
        let path = Path::new(&home).join(".local/bin");
        if !search_paths.contains(&path) {
            search_paths.push(path);
        }
    }

    search_paths
        .into_iter()
        .map(|path| path.join("osu-wine"))
        .find(|path| path.is_file())
}

#[cfg(not(target_os = "linux"))]
pub fn get_osuwinello_path() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "linux")]
pub fn is_osuwinello_available() -> bool {
    get_osuwinello_path().is_some()
}

#[cfg(not(target_os = "linux"))]
pub fn is_osuwinello_available() -> bool {
    false
}

#[cfg(target_os = "linux")]
pub fn is_wmctrl_available() -> bool {
    use std::process::Command;
    Command::new("wmctrl")
        .arg("-V")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

#[cfg(not(target_os = "linux"))]
pub fn is_wmctrl_available() -> bool {
    false
}

#[cfg(target_os = "linux")]
pub fn get_window_title_by_pid(target_pid: Pid) -> String {
    use std::process::Command;
    let find_title = || -> Option<String> {
        let output = Command::new("wmctrl").arg("-lp").output().ok()?;

        if !output.status.success() {
            return None;
        }

        let output_str = String::from_utf8(output.stdout).ok()?;

        for line in output_str.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 4 {
                continue;
            }

            if let Ok(pid) = parts[2].parse::<u32>() {
                if pid == target_pid.as_u32() {
                    let title = parts[4..].join(" ");
                    return Some(title);
                }
            }
        }

        None
    };

    find_title().unwrap_or_default()
}

#[cfg(target_os = "macos")]
pub fn get_window_title_by_pid(target_pid: Pid) -> String {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use std::ffi::CStr;

    #[repr(C)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    #[repr(C)]
    struct CGSize {
        width: f64,
        height: f64,
    }

    #[repr(C)]
    struct CGRect {
        origin: CGPoint,
        size: CGSize,
    }

    unsafe extern "C" {
        fn CGWindowListCopyWindowInfo(option: u32, relative_to_window: u32) -> *mut AnyObject;
        fn CGRectMakeWithDictionaryRepresentation(
            dict: *const AnyObject,
            rect: *mut CGRect,
        ) -> bool;
    }

    unsafe {
        // kCGWindowListOptionAll = 0, kCGNullWindowID = 0
        let window_list: *mut AnyObject = CGWindowListCopyWindowInfo(0, 0);
        if window_list.is_null() {
            return String::new();
        }

        let count: usize = msg_send![window_list, count];
        let pid_key: *mut AnyObject = msg_send![
            objc2::class!(NSString),
            stringWithUTF8String: c"kCGWindowOwnerPID".as_ptr()
        ];
        let name_key: *mut AnyObject = msg_send![
            objc2::class!(NSString),
            stringWithUTF8String: c"kCGWindowName".as_ptr()
        ];
        let owner_key: *mut AnyObject = msg_send![
            objc2::class!(NSString),
            stringWithUTF8String: c"kCGWindowOwnerName".as_ptr()
        ];
        let bounds_key: *mut AnyObject = msg_send![
            objc2::class!(NSString),
            stringWithUTF8String: c"kCGWindowBounds".as_ptr()
        ];
        let layer_key: *mut AnyObject = msg_send![
            objc2::class!(NSString),
            stringWithUTF8String: c"kCGWindowLayer".as_ptr()
        ];

        let target_u32 = target_pid.as_u32();

        // Pass 1: Try exact target_pid match.
        // Pass 2: If target_pid produced no onscreen windows, check Wine/osu! owner windows
        // (handles Wine 32-on-64 architecture where wine32on64 delegates window creation to wine64-preloader).
        for fallback_pass in [false, true] {
            let mut found_game_title = String::new();
            let mut found_updater_title = String::new();
            let mut has_game_window = false;
            let mut has_updater_window = false;

            for i in 0..count {
                let dict: *mut AnyObject = msg_send![window_list, objectAtIndex: i];
                if dict.is_null() {
                    continue;
                }

                let pid_num: *mut AnyObject = msg_send![dict, objectForKey: pid_key];
                if pid_num.is_null() {
                    continue;
                }
                let pid_val: u32 = msg_send![pid_num, unsignedIntValue];

                let is_match = if !fallback_pass {
                    target_u32 != 0 && pid_val == target_u32
                } else {
                    let owner_str: *mut AnyObject = msg_send![dict, objectForKey: owner_key];
                    if !owner_str.is_null() {
                        let utf8: *const std::ffi::c_char = msg_send![owner_str, UTF8String];
                        if !utf8.is_null() {
                            if let Ok(owner) = CStr::from_ptr(utf8).to_str() {
                                let lower = owner.to_lowercase();
                                lower.contains("wine") || lower.contains("osu")
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                if !is_match {
                    continue;
                }

                // Check layer: valid application window layers are 0..=50
                // (e.g. 0 for normal windows, 3 for floating/focused, 27 for Wine fullscreen/borderless shields)
                let layer_num: *mut AnyObject = msg_send![dict, objectForKey: layer_key];
                let layer: i32 = if !layer_num.is_null() {
                    msg_send![layer_num, intValue]
                } else {
                    0
                };
                if layer < 0 || layer > 50 {
                    continue;
                }

                // 1. Check kCGWindowName if available
                let name_str: *mut AnyObject = msg_send![dict, objectForKey: name_key];
                if !name_str.is_null() {
                    let utf8: *const std::ffi::c_char = msg_send![name_str, UTF8String];
                    if !utf8.is_null() {
                        if let Ok(s) = CStr::from_ptr(utf8).to_str() {
                            let trimmed = s.trim();
                            if !trimmed.is_empty() {
                                if trimmed.to_lowercase().contains("updater") {
                                    found_updater_title = trimmed.to_string();
                                } else {
                                    found_game_title = trimmed.to_string();
                                    break;
                                }
                            }
                        }
                    }
                }

                // 2. Check window bounds
                let bounds_dict: *mut AnyObject = msg_send![dict, objectForKey: bounds_key];
                if !bounds_dict.is_null() {
                    let mut rect = CGRect {
                        origin: CGPoint { x: 0.0, y: 0.0 },
                        size: CGSize {
                            width: 0.0,
                            height: 0.0,
                        },
                    };
                    if CGRectMakeWithDictionaryRepresentation(bounds_dict, &mut rect) {
                        // Ignore menu bar overlays (height <= 50) and tiny dummy windows (<= 100x100)
                        if rect.size.height > 50.0 && rect.size.width > 100.0 {
                            // Ignore Wine's default 500x500 dummy desktop surface
                            let is_wine_default_desktop = (rect.size.width - 500.0).abs() < 2.0
                                && (rect.size.height - 500.0).abs() < 2.0;

                            if !is_wine_default_desktop {
                                if rect.size.width >= 640.0 && rect.size.height >= 480.0 {
                                    has_game_window = true;
                                    break;
                                } else if rect.size.width >= 200.0 && rect.size.height >= 80.0 {
                                    has_updater_window = true;
                                }
                            }
                        }
                    }
                }
            }

            let has_result = !found_game_title.is_empty()
                || has_game_window
                || !found_updater_title.is_empty()
                || has_updater_window;

            if has_result {
                let _: () = msg_send![window_list, release];
                if !found_game_title.is_empty() {
                    return found_game_title;
                } else if has_game_window {
                    return "osu!".to_string();
                } else if !found_updater_title.is_empty() {
                    return found_updater_title;
                } else {
                    return "osu! updater".to_string();
                }
            }
        }

        let _: () = msg_send![window_list, release];
        String::new()
    }
}

#[cfg(windows)]
pub fn get_window_title_by_pid(pid: Pid) -> String {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
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
                        return 0;
                    }
                }
            }
            1
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

pub async fn is_net8_installed() -> bool {
    use tokio::process::Command;

    let mut command = Command::new("dotnet");
    command.arg("--list-runtimes");

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output_result = command.output().await;
    match output_result {
        Ok(output) => {
            if !output.status.success() {
                log::warn!(
                    target: "launcher",
                    "`dotnet --list-runtimes` failed with status: {}",
                    output.status
                );
                log::warn!(
                    target: "launcher",
                    "dotnet stderr: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
                return false;
            }

            let stdout_str = String::from_utf8_lossy(&output.stdout);
            stdout_str
                .lines()
                .any(|line| line.starts_with("Microsoft.WindowsDesktop.App 8."))
        }
        Err(_) => false,
    }
}

#[cfg(not(windows))]
pub fn encrypt_password(password: &str, _entropy: &str) -> Result<String, String> {
    Ok(password.to_string())
}

#[cfg(windows)]
pub fn encrypt_password(password: &str, entropy: &str) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use std::slice;
    use winapi::shared::minwindef::{BYTE, DWORD, LPVOID};
    use winapi::shared::ntdef::LPCWSTR;
    use winapi::um::dpapi::{CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData};
    use winapi::um::winbase::LocalFree;
    use winapi::um::wincrypt::DATA_BLOB;

    let description = "Encrypted";

    let password_bytes = password.as_bytes();
    let mut input_blob = DATA_BLOB {
        cbData: password_bytes.len() as DWORD,
        pbData: password_bytes.as_ptr() as *mut BYTE,
    };

    let entropy_bytes = entropy.as_bytes();
    let mut entropy_blob = DATA_BLOB {
        cbData: entropy_bytes.len() as DWORD,
        pbData: entropy_bytes.as_ptr() as *mut BYTE,
    };

    let mut output_blob = DATA_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let wide_description: Vec<u16> = OsStrExt::encode_wide(OsStr::new(description))
        .chain(Some(0))
        .collect();

    let p_description: LPCWSTR = wide_description.as_ptr();

    let result = unsafe {
        CryptProtectData(
            &mut input_blob,
            p_description,
            &mut entropy_blob,
            ptr::null_mut(),
            ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output_blob,
        )
    };

    if result == 0 {
        return Err("CryptProtectData failed".to_string());
    }

    let encrypted_data =
        unsafe { slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec() };

    unsafe {
        LocalFree(output_blob.pbData as LPVOID);
    }

    let base64_string = general_purpose::STANDARD.encode(&encrypted_data);

    Ok(base64_string)
}

/// Check if the patcher binary has already been patched for .NET 4.0 compatibility under Wine.
pub fn is_compatible_patcher(data: &[u8]) -> bool {
    let has_pbi_patch = data
        .windows(6)
        .any(|w| w == [0x1f, 0x18, 0x00, 0x00, 0x00, 0x00]);
    let has_devserver_patch = data
        .windows(7)
        .any(|w| w == [0x26, 0x26, 0x2b, 0x0e, 0x00, 0x00, 0x00]);
    has_pbi_patch && has_devserver_patch
}

/// Ensure `osu!.patcher.exe` is compatible with .NET Framework 4.0 runtime (used by Wine).
///
/// In .NET 4.0 (the runtime provided by Wine prefixes for osu! stable), generic `Marshal.SizeOf<T>()`
/// does not exist (added in .NET 4.5.1), causing a `MissingMethodException` when `GetCommandLine()`
/// queries `PROCESS_BASIC_INFORMATION`. Additionally:
/// 1. `Console.ReadKey()` crashes with `InvalidOperationException` when stdio is redirected without a console.
/// 2. `GetOsuPid()` checks for `" -devserver "` via PEB reading, which fails or is unreliable under Wine.
/// 3. Costura embeds `ManagedInjector.Lib` which also calls generic `Marshal.SizeOf<Native.ModuleEntry32>()`
///    and parses remote PE export tables through generic marshal APIs.
/// This function patches the binary in-place so it runs reliably under Wine.
pub fn ensure_patcher_compatibility(patcher_exe: &Path) -> Result<bool, String> {
    if !patcher_exe.is_file() {
        return Ok(false);
    }

    // Clean up loose ManagedInjector.Lib.dll if present, as CLR loads loose assemblies before Costura resources.
    if let Some(parent) = patcher_exe.parent() {
        let loose = parent.join("ManagedInjector.Lib.dll");
        if loose.is_file() {
            let _ = fs::remove_file(&loose);
        }
    }

    let mut data = fs::read(patcher_exe)
        .map_err(|e| format!("Failed to read {}: {e}", patcher_exe.display()))?;
    let mut modified = false;

    // Pattern 1 in GetCommandLine: ldloc.0, ldc.i4.0, ldloca.s 1, ldloc.1, call Marshal.SizeOf<PBI>
    // [0x06, 0x16, 0x12, 0x01, 0x07, 0x28, 0x01, 0x00, 0x00, 0x2b]
    let sizeof_pattern = [0x06, 0x16, 0x12, 0x01, 0x07, 0x28, 0x01, 0x00, 0x00, 0x2b];
    if let Some(pos) = data
        .windows(sizeof_pattern.len())
        .position(|w| w == sizeof_pattern)
    {
        // Replace ldloc.1 (0x07) and call Marshal.SizeOf<PBI> (0x28, 0x01, 0x00, 0x00, 0x2b) with ldc.i4.s 24 (0x1f, 0x18) + 4 nops
        let target = pos + 4;
        data[target..target + 6].copy_from_slice(&[0x1f, 0x18, 0x00, 0x00, 0x00, 0x00]);
        modified = true;
    }

    // Pattern 2 in Main catch handler: call Console.Write, call Console.ReadKey, pop, leave.s
    // [0x28, 0x12, 0x00, 0x00, 0x0a, 0x28, 0x13, 0x00, 0x00, 0x0a, 0x26, 0xde]
    let readkey_pattern = [
        0x28, 0x12, 0x00, 0x00, 0x0a, 0x28, 0x13, 0x00, 0x00, 0x0a, 0x26, 0xde,
    ];
    if let Some(pos) = data
        .windows(readkey_pattern.len())
        .position(|w| w == readkey_pattern)
    {
        // Replace call Console.ReadKey() (5 bytes) + pop (1 byte) with 6 nops
        let target = pos + 5;
        data[target..target + 6].copy_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        modified = true;
    }

    // Pattern 3 in GetOsuPid: devserver check bypass
    // [0x72, 0x95, 0x01, 0x00, 0x70, 0x6f, 0x15, 0x00, 0x00, 0x0a, 0x2d, 0x0b]
    let dev_pattern = [
        0x72, 0x95, 0x01, 0x00, 0x70, 0x6f, 0x15, 0x00, 0x00, 0x0a, 0x2d, 0x0b,
    ];
    if let Some(pos) = data
        .windows(dev_pattern.len())
        .position(|w| w == dev_pattern)
    {
        // Replace callvirt Contains + brtrue.s with pop, pop, br.s + 3 nops
        let target = pos + 5;
        data[target..target + 7].copy_from_slice(&[0x26, 0x26, 0x2b, 0x0e, 0x00, 0x00, 0x00]);
        modified = true;
    }

    // Pattern 4: Costura embedded ManagedInjector.Lib resource at offset 0x1f00 (length 10020)
    if data.len() >= 0x1f00 + 10020 && data.get(0x1efc..0x1f00) == Some(&[0x24, 0x27, 0x00, 0x00]) {
        use flate2::read::DeflateDecoder;
        use flate2::write::DeflateEncoder;
        use flate2::Compression;
        use std::io::{Read, Write};

        let stream = &data[0x1f00..0x1f00 + 10020];
        let mut decoder = DeflateDecoder::new(stream);
        let mut decomp = Vec::new();
        if decoder.read_to_end(&mut decomp).is_ok() {
            let mut inner_modified = false;

            // 4a. NativeHelper.GetModules: Marshal.SizeOf<ModuleEntry32>() -> ldc.i4 548
            let module_pattern = [0x12, 0x04, 0x28, 0x08, 0x00, 0x00, 0x2b];
            if let Some(pos) = decomp.windows(module_pattern.len()).position(|w| w == module_pattern) {
                decomp[pos + 2..pos + 7].copy_from_slice(&[0x20, 0x24, 0x02, 0x00, 0x00]);
                inner_modified = true;
            }

            // 4b. InjectableProcess.GetArchitecture: return NetFrameworkV4 (2) immediately
            let arch_pattern = [
                0x02, 0x7b, 0x0a, 0x00, 0x00, 0x04, 0x2c, 0x07, 0x02, 0x7b, 0x0a, 0x00, 0x00,
                0x04, 0x2a,
            ];
            if let Some(pos) = decomp.windows(arch_pattern.len()).position(|w| w == arch_pattern) {
                decomp[pos..pos + 2].copy_from_slice(&[0x18, 0x2a]); // ldc.i4.2, ret
                decomp[pos + 2..pos + 15].fill(0x00); // 13 nops
                inner_modified = true;
            }

            // 4c. FrameworkInjectorBase.GetCorBindToRuntimeExAddress: return 0x17b55 directly without remote PE parsing
            let corbind_pattern = [
                0x03, 0x06, 0x7b, 0x65, 0x00, 0x00, 0x0a, 0x72, 0x3d, 0x03, 0x00, 0x70, 0x04,
                0x28, 0x08, 0x00, 0x00, 0x06, 0x0b,
            ];
            if let Some(pos) = decomp.windows(corbind_pattern.len()).position(|w| w == corbind_pattern) {
                decomp[pos..pos + 6].copy_from_slice(&[0x20, 0x55, 0x7b, 0x01, 0x00, 0x0b]); // ldc.i4 0x17b55, stloc.1
                decomp[pos + 6..pos + 19].fill(0x00); // 13 nops
                inner_modified = true;
            }

            if inner_modified {
                let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
                if encoder.write_all(&decomp).is_ok() {
                    if let Ok(mut compressed) = encoder.finish() {
                        if compressed.len() <= 10020 - 5 {
                            let remaining = 10020 - compressed.len();
                            let length = (remaining - 5) as u16;
                            let nlen = !length;
                            compressed.push(0x01); // BFINAL = 1, BTYPE = 00
                            compressed.push((length & 0xff) as u8);
                            compressed.push((length >> 8) as u8);
                            compressed.push((nlen & 0xff) as u8);
                            compressed.push((nlen >> 8) as u8);
                            compressed.extend(std::iter::repeat(0x00).take(length as usize));
                            if compressed.len() == 10020 {
                                data[0x1f00..0x1f00 + 10020].copy_from_slice(&compressed);
                                modified = true;
                            }
                        }
                    }
                }
            }
        }
    }

    if modified {
        fs::write(patcher_exe, &data)
            .map_err(|e| format!("Failed to write {}: {e}", patcher_exe.display()))?;
        log::info!(
            target: "patcher",
            "Applied .NET 4.0 compatibility patch to {}",
            patcher_exe.display()
        );
    }

    Ok(modified)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patcher_compatibility_patch() {
        let mut fake_binary = vec![0x90; 0x3000];
        let pbi = [0x06, 0x16, 0x12, 0x01, 0x07, 0x28, 0x01, 0x00, 0x00, 0x2b];
        fake_binary[10..10 + pbi.len()].copy_from_slice(&pbi);
        let readkey = [
            0x28, 0x12, 0x00, 0x00, 0x0a, 0x28, 0x13, 0x00, 0x00, 0x0a, 0x26, 0xde,
        ];
        fake_binary[30..30 + readkey.len()].copy_from_slice(&readkey);
        let devserver = [
            0x72, 0x95, 0x01, 0x00, 0x70, 0x6f, 0x15, 0x00, 0x00, 0x0a, 0x2d, 0x0b,
        ];
        fake_binary[50..50 + devserver.len()].copy_from_slice(&devserver);

        let temp_file = std::env::temp_dir().join("test_patcher_compat.exe");
        std::fs::write(&temp_file, &fake_binary).unwrap();
        let modified = ensure_patcher_compatibility(&temp_file).unwrap();
        assert!(modified);
        let patched_data = std::fs::read(&temp_file).unwrap();
        assert!(is_compatible_patcher(&patched_data));
        let _ = std::fs::remove_file(temp_file);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_get_window_title_macos() {
        let _ = get_window_title_by_pid(Pid::from_u32(0));
    }

    #[test]
    fn test_patcher_compatibility_real_patcher() {
        let real_patcher = Path::new("/Applications/osu!(stable).app/Contents/Resources/drive_c/osu!/EZPPLauncher/patcher/osu!.patcher.exe");
        if real_patcher.is_file() {
            let res = ensure_patcher_compatibility(real_patcher);
            assert!(res.is_ok());
            let data = std::fs::read(real_patcher).unwrap();
            assert!(is_compatible_patcher(&data));
        }
    }
}
