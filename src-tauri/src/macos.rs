//! macOS support for osu! stable running inside a Wine wrapper.
//!
//! osu! stable is a Windows application, so on macOS it has to run through a
//! Wine-based wrapper. The launcher supports Wineskin wrappers (the common
//! `osu!.app` wine skin), Whisky bottles and CrossOver bottles.

use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration as StdDuration, Instant};
use tokio::process::{Child, Command};
use tokio::time::{Duration, sleep};

use crate::utils::is_valid_osu_folder;

/// Round the borderless launcher window and make its corners transparent.
///
/// macOS does not round undecorated windows on its own, so the webview has to
/// be clipped with the content view's layer. The window itself is made
/// transparent so the area outside that clip shows the desktop instead of a
/// square background.
pub fn round_window(window: &tauri::WebviewWindow, radius: f64) -> Result<(), String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let ns_window = window.ns_window().map_err(|error| error.to_string())? as *mut AnyObject;
    if ns_window.is_null() {
        return Err("The native window is not available".into());
    }

    unsafe {
        let _: () = msg_send![ns_window, setOpaque: false];
        let clear: *mut AnyObject = msg_send![objc2::class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear];
        let _: () = msg_send![ns_window, setHasShadow: true];

        let content_view: *mut AnyObject = msg_send![ns_window, contentView];
        if content_view.is_null() {
            return Err("The native content view is not available".into());
        }

        let _: () = msg_send![content_view, setWantsLayer: true];
        let layer: *mut AnyObject = msg_send![content_view, layer];
        if layer.is_null() {
            return Err("The native content view has no layer".into());
        }

        let _: () = msg_send![layer, setCornerRadius: radius];
        let _: () = msg_send![layer, setMasksToBounds: true];
        let _: () = msg_send![ns_window, invalidateShadow];
    }

    Ok(())
}

/// Allow theme media to start without a click. WKWebView otherwise blocks
/// autoplay for anything with an audio track, which makes a theme's background
/// video sit frozen until the user interacts with the launcher.
pub fn allow_media_autoplay(window: &tauri::WebviewWindow) -> Result<(), String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    window
        .with_webview(|webview| unsafe {
            let webview = webview.inner() as *mut AnyObject;
            if webview.is_null() {
                return;
            }

            let configuration: *mut AnyObject = msg_send![webview, configuration];
            if configuration.is_null() {
                return;
            } // WKAudiovisualMediaTypesNone. This is a public WKWebView setting.
            let _: () =
                msg_send![configuration, setMediaTypesRequiringUserActionForPlayback: 0usize];
            let current: usize = msg_send![configuration, mediaTypesRequiringUserActionForPlayback];
            log::debug!(
                target: "launcher",
                "Theme media autoplay policy: {current}"
            );
        })
        .map_err(|error| format!("Could not enable theme media autoplay: {error}"))
}

/// Show a native open panel that accepts `.app` bundles as well as folders.
///
/// AppKit treats application bundles as packages (directories) by default, so a
/// regular folder picker descends into `osu!.app` instead of selecting it. This
/// panel turns that behaviour off, letting the user pick the wrapper itself,
/// while still allowing a plain Wine prefix folder to be selected.
pub fn pick_osu_installation() -> Result<Option<PathBuf>, String> {
    use objc2::msg_send;
    use objc2::rc::autoreleasepool;
    use objc2::runtime::AnyObject;
    use std::ffi::{CStr, CString};

    unsafe fn ns_string(value: &str) -> Result<*mut AnyObject, String> {
        let value = CString::new(value).map_err(|_| "The path contains a NUL byte".to_string())?;
        let string: *mut AnyObject =
            unsafe { msg_send![objc2::class!(NSString), stringWithUTF8String: value.as_ptr()] };
        if string.is_null() {
            return Err("Could not create the native dialog text".to_string());
        }
        Ok(string)
    }

    autoreleasepool(|_| unsafe {
        let panel: *mut AnyObject = msg_send![objc2::class!(NSOpenPanel), openPanel];
        if panel.is_null() {
            return Err("Could not create the native file picker".to_string());
        }

        let _: () = msg_send![panel, setCanChooseFiles: true];
        let _: () = msg_send![panel, setCanChooseDirectories: true];
        // Keep `.app` bundles selectable instead of navigating into them.
        let _: () = msg_send![panel, setTreatsFilePackagesAsDirectories: false];
        let _: () = msg_send![panel, setAllowsMultipleSelection: false];
        let _: () = msg_send![panel, setCanCreateDirectories: false];

        let title = ns_string("Select osu!.app")?;
        let _: () = msg_send![panel, setTitle: title];
        let message = ns_string("Pick your osu!.app wrapper, or a Wine prefix folder.")?;
        let _: () = msg_send![panel, setMessage: message];
        let prompt = ns_string("Select")?;
        let _: () = msg_send![panel, setPrompt: prompt];

        let applications = ns_string("/Applications")?;
        let directory_url: *mut AnyObject =
            msg_send![objc2::class!(NSURL), fileURLWithPath: applications];
        if !directory_url.is_null() {
            let _: () = msg_send![panel, setDirectoryURL: directory_url];
        }

        // NSModalResponseOK
        let response: i64 = msg_send![panel, runModal];
        if response != 1 {
            return Ok(None);
        }

        let url: *mut AnyObject = msg_send![panel, URL];
        if url.is_null() {
            return Ok(None);
        }
        let path: *mut AnyObject = msg_send![url, path];
        if path.is_null() {
            return Ok(None);
        }
        let utf8: *const std::os::raw::c_char = msg_send![path, UTF8String];
        if utf8.is_null() {
            return Ok(None);
        }

        let path = CStr::from_ptr(utf8).to_string_lossy().into_owned();
        Ok(Some(PathBuf::from(path)))
    })
}

pub struct WineRuntime {
    prefix: PathBuf,
    wine_bin: PathBuf,
    wine_root: Option<PathBuf>,
}

#[derive(Clone)]
pub struct WineDiagnostics {
    pub prefix: PathBuf,
    pub wine_bin: PathBuf,
    pub app_bundle: Option<PathBuf>,
    pub net8_installed: bool,
    pub wine_version: Option<String>,
    pub prefix_arch: Option<String>,
}

impl WineDiagnostics {
    /// Inspect the wrapper without starting it, for the launcher's diagnostics panel.
    pub fn for_osu_folder(osu_folder: &Path) -> Result<Self, String> {
        let runtime = WineRuntime::for_osu_folder(osu_folder)?;
        let net8_installed = [
            runtime
                .prefix
                .join("drive_c/Program Files/dotnet/shared/Microsoft.WindowsDesktop.App"),
            runtime
                .prefix
                .join("drive_c/Program Files (x86)/dotnet/shared/Microsoft.WindowsDesktop.App"),
        ]
        .iter()
        .any(|path| {
            fs::read_dir(path)
                .ok()
                .map(|entries| {
                    entries.filter_map(|entry| entry.ok()).any(|entry| {
                        entry
                            .file_name()
                            .to_str()
                            .map(|name| name.starts_with("8."))
                            .unwrap_or(false)
                    })
                })
                .unwrap_or(false)
        });

        Ok(Self {
            prefix: runtime.prefix.clone(),
            wine_bin: runtime.wine_bin.clone(),
            app_bundle: app_bundle_for(&runtime.prefix),
            net8_installed,
            wine_version: wine_version_for(&runtime.wine_bin),
            prefix_arch: prefix_architecture(&runtime.prefix),
        })
    }
}

impl WineRuntime {
    /// Build a runtime description for an osu! folder inside a Wine prefix.
    pub fn for_osu_folder(osu_folder: &Path) -> Result<Self, String> {
        if !osu_folder.join("osu!.exe").is_file() {
            return Err(format!(
                "osu!.exe was not found in {}",
                osu_folder.display()
            ));
        }

        let prefix = prefix_for(osu_folder).ok_or_else(|| {
            "This osu! installation is not inside a Wine prefix. On macOS, choose the osu! folder inside your Wineskin, Whisky or CrossOver wrapper.".to_string()
        })?;

        let app = app_bundle_for(&prefix);
        let (wine_bin, wine_root) = find_wine_bin(&prefix, app.as_deref()).ok_or_else(|| {
            "Could not find a Wine runtime for this osu! installation. Make sure the Wineskin/Whisky/CrossOver wrapper is still installed.".to_string()
        })?;

        Ok(Self {
            prefix,
            wine_bin,
            wine_root,
        })
    }

    /// Spawn a Windows executable through the wrapper's Wine runtime.
    pub fn spawn(&self, exe: &Path, args: &[&str]) -> Result<Child, String> {
        let loader = self.loader_for(exe);
        if !loader.is_file() {
            return Err(format!(
                "Wine loader not found at {}. The wrapper may be incomplete.",
                loader.display()
            ));
        }

        let mut command = Command::new(&loader);
        command.arg(exe).args(args);
        command.current_dir(exe.parent().unwrap_or(&self.prefix));
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        command.env("WINEPREFIX", &self.prefix);
        command.env("WINEDEBUG", "-all");
        command.env("WINEDLLOVERRIDES", "mscoree,mshtml=");
        command.env("FREETYPE_PROPERTIES", "truetype:interpreter-version=35");

        if let Some(wine_root) = &self.wine_root {
            let mut library_paths = vec![
                wine_root.join("lib"),
                wine_root.join("lib64"),
                wine_root.join("lib32on64"),
                wine_root.clone(),
                PathBuf::from("/opt/local/lib"),
                PathBuf::from("/usr/lib"),
                PathBuf::from("/usr/libexec"),
                PathBuf::from("/usr/lib/system"),
                PathBuf::from("/opt/X11/lib"),
            ];
            if let Some(existing) = std::env::var_os("DYLD_FALLBACK_LIBRARY_PATH") {
                library_paths.extend(std::env::split_paths(&existing));
            }
            if let Ok(library_path) = std::env::join_paths(library_paths) {
                command.env("DYLD_FALLBACK_LIBRARY_PATH", &library_path);
                command.env("WINESKIN_LIB_PATH_FOR_FALLBACK", &library_path);
            }
        }

        let mut paths = vec![self.wine_bin.clone()];
        if let Some(existing) = std::env::var_os("PATH") {
            paths.extend(std::env::split_paths(&existing));
        }
        if let Ok(path) = std::env::join_paths(paths) {
            command.env("PATH", path);
        }

        let executable_name = exe
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "the Windows application".to_string());

        command.spawn().map_err(|error| {
            format!(
                "Failed to start {executable_name} through Wine ({}): {}",
                loader.display(),
                error
            )
        })
    }

    /// Stop every process that belongs to this Wine prefix.
    pub async fn kill_prefix(&self) {
        let wineserver = self.wine_bin.join("wineserver");
        if !wineserver.is_file() {
            return;
        }

        let _ = Command::new(wineserver)
            .arg("-k")
            .env("WINEPREFIX", &self.prefix)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;
    }

    fn loader_for(&self, exe: &Path) -> PathBuf {
        let is_64_bit = pe_machine(exe) == Some(0x8664);
        let candidates: &[&str] = if is_64_bit {
            &["wine64", "wine"]
        } else {
            &["wine32on64", "wine", "wine64"]
        };

        candidates
            .iter()
            .map(|candidate| self.wine_bin.join(candidate))
            .find(|candidate| candidate.is_file())
            .unwrap_or_else(|| self.wine_bin.join(candidates[0]))
    }
}

/// Run osu! (`-devserver ez-pp.farm`) and wait until the game exits.
pub async fn run_osu(osu_folder: &str, patch: bool) -> Result<(), String> {
    let folder = Path::new(osu_folder);
    let runtime = WineRuntime::for_osu_folder(folder).map_err(|error| {
        log::error!(target: "osu", "Could not prepare the Wine runtime: {error}");
        error
    })?;
    let mut game = runtime
        .spawn(&folder.join("osu!.exe"), &["-devserver", "ez-pp.farm"])
        .map_err(|error| {
            log::error!(target: "osu", "Could not start osu!: {error}");
            error
        })?;

    if let Some(pid) = game.id() {
        log::info!(target: "osu", "osu! started through Wine (pid {pid})");
    }
    crate::logging::capture_osu_output(&mut game);

    if patch {
        if let Err(error) = start_patcher(&runtime, folder).await {
            log::warn!(target: "patcher", "Could not start the patcher: {error}");
        }
    }

    match game.wait().await {
        Ok(status) => log::info!(target: "osu", "osu! exited with {status}"),
        Err(error) => {
            log::warn!(target: "osu", "Could not wait for osu!: {error}");
            return Err(format!("Failed to wait for osu!: {}", error));
        }
    }

    Ok(())
}

/// Start the Windows patcher through the same Wine prefix as osu!.
async fn start_patcher(runtime: &WineRuntime, osu_folder: &Path) -> Result<(), String> {
    let patcher_exe = osu_folder
        .join("EZPPLauncher")
        .join("patcher")
        .join("osu!.patcher.exe");

    if !patcher_exe.is_file() {
        return Err(format!(
            "Patcher was requested but {} does not exist",
            patcher_exe.display()
        ));
    }

    wait_for_osu_game().await;

    log::info!(
        target: "patcher",
        "Starting the patcher from {}",
        patcher_exe.display()
    );

    let mut patcher = runtime.spawn(&patcher_exe, &[])?;
    if let Some(pid) = patcher.id() {
        log::info!(target: "patcher", "Patcher started through Wine (pid {pid})");
    }
    crate::logging::capture_patcher_output(&mut patcher);

    tauri::async_runtime::spawn(async move {
        match patcher.wait().await {
            Ok(status) => log::info!(target: "patcher", "Patcher exited with {status}"),
            Err(error) => log::warn!(target: "patcher", "Could not wait for the patcher: {error}"),
        }
    });

    Ok(())
}

/// Wait until the Wine-hosted osu! process exists, then give it time to create
/// its game window. Wine does not expose the window title to the launcher here,
/// so the process is the best signal available.
async fn wait_for_osu_game() {
    let mut system = sysinfo::System::new_all();
    let deadline = Instant::now() + StdDuration::from_secs(30);
    let mut detected = false;

    while Instant::now() < deadline {
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        if system
            .processes()
            .values()
            .any(crate::utils::is_osu_game_process)
        {
            detected = true;
            break;
        }

        sleep(Duration::from_millis(500)).await;
    }

    if !detected {
        log::warn!(
            target: "patcher",
            "Could not detect the osu! process; starting the patcher anyway"
        );
    }

    // Wine gives no reliable window-ready signal, so leave the game a moment
    // to finish initializing before the patcher attaches to it.
    sleep(Duration::from_secs(8)).await;
}

/// Run `osu!.exe -repair`, wait for the updater and close the game it starts.
pub async fn run_osu_updater(osu_folder: &str) -> Result<(), String> {
    let folder = Path::new(osu_folder);
    let runtime = WineRuntime::for_osu_folder(folder).map_err(|error| {
        log::error!(target: "osu", "Could not prepare the Wine runtime: {error}");
        error
    })?;
    let mut updater = runtime
        .spawn(&folder.join("osu!.exe"), &["-repair"])
        .map_err(|error| {
            log::error!(target: "osu", "Could not start the osu! updater: {error}");
            error
        })?;

    if let Some(pid) = updater.id() {
        log::info!(target: "osu", "osu! updater started through Wine (pid {pid})");
    }
    crate::logging::capture_osu_output(&mut updater);

    let mut system = sysinfo::System::new_all();
    let deadline = Instant::now() + StdDuration::from_secs(300);

    loop {
        if updater
            .try_wait()
            .map_err(|error| format!("Failed to check the osu! updater: {}", error))?
            .is_some()
        {
            log::info!(target: "osu", "The osu! updater exited");
            break;
        }

        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        if system
            .processes()
            .values()
            .any(crate::utils::is_osu_game_process)
        {
            // The updater relaunched osu! to finish the update. Close it so the
            // launcher can start the game itself with the correct server.
            log::info!(target: "osu", "The updater relaunched osu!; closing the Wine prefix");
            runtime.kill_prefix().await;
            break;
        }

        if Instant::now() >= deadline {
            log::warn!(target: "osu", "Timed out waiting for the osu! updater; closing the Wine prefix");
            runtime.kill_prefix().await;
            break;
        }

        sleep(Duration::from_millis(500)).await;
    }

    match updater.wait().await {
        Ok(status) => log::info!(target: "osu", "osu! updater exited with {status}"),
        Err(error) => log::warn!(target: "osu", "Could not wait for the osu! updater: {error}"),
    }
    Ok(())
}

/// Resolve a user-selected path (osu! folder, `.app` bundle, prefix or drive_c)
/// to a valid osu! installation folder.
pub fn resolve_osu_folder(folder: &Path) -> Option<PathBuf> {
    if is_valid_osu_folder(folder) {
        return Some(folder.to_path_buf());
    }

    let mut prefixes = Vec::new();

    if folder.file_name() == Some(OsStr::new("drive_c")) {
        if let Some(parent) = canonical_prefix(folder) {
            prefixes.push(parent);
        }
    }

    if folder.join("drive_c").is_dir() {
        if let Some(parent) = canonical_prefix(&folder.join("drive_c")) {
            prefixes.push(parent);
        }
    }

    if folder.extension() == Some(OsStr::new("app")) || folder.join("Contents").is_dir() {
        for drive_c in [
            folder.join("Contents/Resources/drive_c"),
            folder.join("Contents/SharedSupport/drive_c"),
            folder.join("Contents/SharedSupport/prefix/drive_c"),
        ] {
            if drive_c.is_dir() {
                if let Some(parent) = canonical_prefix(&drive_c) {
                    prefixes.push(parent);
                }
            }
        }

        let mut drive_dirs = Vec::new();
        find_drive_c_dirs(folder, 5, &mut drive_dirs);
        prefixes.extend(
            drive_dirs
                .iter()
                .filter_map(|drive_c| drive_c.parent().map(Path::to_path_buf)),
        );
    }

    if let Some(prefix) = prefix_for(folder) {
        prefixes.push(prefix);
    }

    prefixes.sort();
    prefixes.dedup();

    prefixes
        .into_iter()
        .find_map(|prefix| find_osu_folder_in_prefix(&prefix))
}

/// Auto-detect an osu! installation in the usual macOS wrapper locations.
pub fn find_osu_installation() -> Option<String> {
    for app in app_bundles() {
        if let Some(folder) = resolve_osu_folder(&app) {
            return Some(folder.to_string_lossy().into_owned());
        }
    }

    for prefix in bottle_prefixes() {
        if let Some(folder) = find_osu_folder_in_prefix(&prefix) {
            return Some(folder.to_string_lossy().into_owned());
        }
    }

    None
}

fn find_osu_folder_in_prefix(prefix: &Path) -> Option<PathBuf> {
    let drive_c = prefix.join("drive_c");
    if !drive_c.is_dir() {
        return None;
    }

    if let Some(folder) = common_osu_folders(&drive_c)
        .into_iter()
        .find(|folder| is_valid_osu_folder(folder))
    {
        return Some(folder);
    }

    let mut candidates = Vec::new();
    collect_osu_folders(&drive_c, 0, 6, &mut candidates);
    candidates
        .into_iter()
        .find(|folder| is_valid_osu_folder(folder))
}

fn common_osu_folders(drive_c: &Path) -> Vec<PathBuf> {
    let mut folders = vec![
        drive_c.join("osu!"),
        drive_c.join("Program Files").join("osu!"),
        drive_c.join("Program Files (x86)").join("osu!"),
    ];

    if let Ok(users) = fs::read_dir(drive_c.join("users")) {
        for user in users.flatten() {
            let user_path = user.path();
            if user_path.is_dir() {
                folders.push(user_path.join("AppData").join("Local").join("osu!"));
                folders.push(user_path.join("AppData").join("Roaming").join("osu!"));
            }
        }
    }

    folders
}

fn collect_osu_folders(dir: &Path, depth: usize, max_depth: usize, out: &mut Vec<PathBuf>) {
    if depth > max_depth {
        return;
    }

    if dir.join("osu!.exe").is_file() {
        out.push(dir.to_path_buf());
        return;
    }

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_ascii_lowercase();
        if matches!(
            name.as_str(),
            "windows" | "programdata" | "$recycle.bin" | "system volume information"
        ) {
            continue;
        }

        collect_osu_folders(&path, depth + 1, max_depth, out);
    }
}

fn find_drive_c_dirs(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 {
        return;
    }

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };

        if metadata.file_type().is_symlink() {
            // Wineskin wrappers often add a convenience drive_c symlink at
            // the app root. Resolve it to the real prefix so WINEPREFIX points
            // at Contents/Resources instead of the bundle itself.
            if path.file_name() == Some(OsStr::new("drive_c")) {
                if let Ok(canonical) = fs::canonicalize(&path) {
                    out.push(canonical);
                }
            }
            continue;
        }

        if !metadata.is_dir() {
            continue;
        }

        if path.file_name() == Some(OsStr::new("drive_c")) {
            out.push(path);
            continue;
        }

        // Do not descend into nested apps (for example Wineskin.app).
        if path.extension() == Some(OsStr::new("app")) {
            continue;
        }

        find_drive_c_dirs(&path, depth - 1, out);
    }
}

fn prefix_for(osu_folder: &Path) -> Option<PathBuf> {
    let drive_c = osu_folder
        .ancestors()
        .find(|ancestor| ancestor.file_name() == Some(OsStr::new("drive_c")))?;
    canonical_prefix(drive_c)
}

fn canonical_prefix(drive_c: &Path) -> Option<PathBuf> {
    let canonical = fs::canonicalize(drive_c).ok()?;
    canonical.parent().map(Path::to_path_buf)
}

fn app_bundle_for(prefix: &Path) -> Option<PathBuf> {
    prefix
        .ancestors()
        .find(|ancestor| ancestor.extension() == Some(OsStr::new("app")))
        .map(Path::to_path_buf)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn app_bundles() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications")];
    if let Some(home) = home_dir() {
        roots.push(home.join("Applications"));
    }

    let mut apps = Vec::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension() == Some(OsStr::new("app")) {
                apps.push(path);
            }
        }
    }

    apps.sort();
    apps
}

fn bottle_prefixes() -> Vec<PathBuf> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let bottle_roots = [
        home.join("Library/Containers/com.isaacmarovitz.Whisky/Bottles"),
        home.join("Library/Application Support/CrossOver/Bottles"),
        home.join("Library/Application Support/Whisky/Bottles"),
    ];

    let mut prefixes = Vec::new();
    for root in bottle_roots {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.join("drive_c").is_dir() {
                prefixes.push(path);
            }
        }
    }

    prefixes.sort();
    prefixes
}

fn find_wine_bin(prefix: &Path, app: Option<&Path>) -> Option<(PathBuf, Option<PathBuf>)> {
    let mut candidates: Vec<(PathBuf, Option<PathBuf>)> = Vec::new();

    if let Some(app) = app {
        for root in [
            app.join("Contents/SharedSupport/wine"),
            app.join("Contents/Resources/WineskinEngine.bundle/Wine"),
            app.join("Contents/Frameworks/wswine.bundle"),
        ] {
            push_wine_root(&mut candidates, root);
        }
    }

    for root in [
        prefix.join("WineskinEngine.bundle/Wine"),
        prefix.join("Wine"),
    ] {
        push_wine_root(&mut candidates, root);
    }

    if let Some(home) = home_dir() {
        for root in [
            home.join("Applications/Whisky.app/Contents/Resources/wine"),
            home.join("Applications/Whisky.app/Contents/Libraries/Wine"),
        ] {
            push_wine_root(&mut candidates, root);
        }
    }

    for root in [
        PathBuf::from("/Applications/Whisky.app/Contents/Resources/wine"),
        PathBuf::from("/Applications/Whisky.app/Contents/Libraries/Wine"),
        PathBuf::from("/Applications/CrossOver.app/Contents/SharedSupport/CrossOver"),
    ] {
        push_wine_root(&mut candidates, root);
    }

    for bin in [
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ] {
        if has_wine_loader(&bin) {
            candidates.push((bin, None));
        }
    }

    for binary in ["wine64", "wine32on64", "wine"] {
        if let Some(path) = find_in_path(binary) {
            if let Some(bin) = path.parent() {
                candidates.push((bin.to_path_buf(), None));
                break;
            }
        }
    }

    candidates.into_iter().find(|(bin, _)| has_wine_loader(bin))
}

fn push_wine_root(candidates: &mut Vec<(PathBuf, Option<PathBuf>)>, root: PathBuf) {
    let bin = root.join("bin");
    if has_wine_loader(&bin) {
        candidates.push((bin, Some(root)));
    }
}

fn has_wine_loader(bin: &Path) -> bool {
    ["wine32on64", "wine64", "wine"]
        .iter()
        .any(|loader| bin.join(loader).is_file())
}

fn wine_version_for(bin: &Path) -> Option<String> {
    let loader = ["wine64", "wine", "wine32on64"]
        .iter()
        .map(|name| bin.join(name))
        .find(|path| path.is_file())?;
    let output = std::process::Command::new(loader)
        .arg("--version")
        .env("WINEDEBUG", "-all")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!version.is_empty()).then_some(version)
}

fn prefix_architecture(prefix: &Path) -> Option<String> {
    if prefix.join("drive_c/windows/syswow64").is_dir() {
        Some("win64".to_string())
    } else if prefix.join("drive_c/windows/system32").is_dir() {
        Some("win32".to_string())
    } else {
        None
    }
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(binary))
        .find(|candidate| candidate.is_file())
}

fn pe_machine(exe: &Path) -> Option<u16> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = fs::File::open(exe).ok()?;
    let mut signature = [0u8; 2];
    file.read_exact(&mut signature).ok()?;
    if &signature != b"MZ" {
        return None;
    }

    file.seek(SeekFrom::Start(0x3c)).ok()?;
    let mut offset = [0u8; 4];
    file.read_exact(&mut offset).ok()?;
    file.seek(SeekFrom::Start(u32::from_le_bytes(offset) as u64))
        .ok()?;

    let mut header = [0u8; 6];
    file.read_exact(&mut header).ok()?;
    if &header[..4] != b"PE\0\0" {
        return None;
    }

    Some(u16::from_le_bytes([header[4], header[5]]))
}
