//! Rotating file logs for the launcher, osu! and the patcher.
//!
//! Each stream writes to `~/.ezpplauncher/logs`:
//!
//! - `launcher.log` receives everything, including frontend console output.
//! - `osu.log` receives osu! and its updater, including stdout/stderr.
//! - `patcher.log` receives patcher output.
//!
//! A stream's file is only created when it actually has a line to write, so a
//! launch without osu!/patcher output never leaves empty files behind. When a
//! new session starts, or any stream reaches 5 MiB, all three active files are
//! bundled into one `logs_<date>_<time>.zip` and fresh files are started. The
//! five most recent bundles are kept, so a support report only needs one file.
//! `launcher.log` intentionally includes the osu!/patcher entries too. File
//! logging can be disabled from Settings → Logging; stdout output is unchanged.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use log::Level;
use serde::Serialize;
use tauri::Runtime;
use tauri::plugin::TauriPlugin;
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Child;

const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024;
const KEPT_LOG_BUNDLES: usize = 5;
const MAX_LINE_CHARS: usize = 16_000;

static ENABLED: AtomicBool = AtomicBool::new(true);

pub fn set_logging_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

fn logging_enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

/// Read the persisted setting before the config database is initialized, so a
/// disabled logger does not write a startup file before the frontend loads.
fn initial_logging_enabled() -> bool {
    let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) else {
        return true;
    };
    let db_path = PathBuf::from(home).join(".ezpplauncher").join("config.db");

    if !db_path.exists() {
        return true;
    }

    let Ok(connection) =
        rusqlite::Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
    else {
        return true;
    };

    let Ok(raw) = connection.query_row(
        "SELECT value FROM config WHERE key = 'logging_enabled'",
        [],
        |row| row.get::<_, String>(0),
    ) else {
        return true;
    };

    serde_json::from_str::<bool>(&raw).unwrap_or(true)
}

pub fn logs_directory() -> PathBuf {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    home.join(".ezpplauncher").join("logs")
}

#[derive(Clone, Copy)]
enum Stream {
    Launcher,
    Osu,
    Patcher,
}

impl Stream {
    const ALL: [Stream; 3] = [Stream::Launcher, Stream::Osu, Stream::Patcher];

    fn index(self) -> usize {
        match self {
            Stream::Launcher => 0,
            Stream::Osu => 1,
            Stream::Patcher => 2,
        }
    }

    fn file_name(self) -> &'static str {
        match self {
            Stream::Launcher => "launcher.log",
            Stream::Osu => "osu.log",
            Stream::Patcher => "patcher.log",
        }
    }
}

/// Shared state for the three log files. Rotating any stream closes and
/// bundles all of them, so every bundle always holds the same session.
struct LogSet {
    dir: PathBuf,
    state: Mutex<LogState>,
}

struct LogState {
    started: bool,
    files: [Option<File>; 3],
    sizes: [u64; 3],
}

impl LogSet {
    fn new(dir: PathBuf) -> Self {
        Self {
            dir,
            state: Mutex::new(LogState {
                started: false,
                files: [None, None, None],
                sizes: [0; 3],
            }),
        }
    }

    fn write(&self, stream: Stream, buf: &[u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }

        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if !state.started {
            state.started = true;
            bundle_active_logs(&self.dir)?;
            prune_bundles(&self.dir)?;
        }

        let index = stream.index();

        if state.files[index].is_none() {
            self.open_stream(&mut state, stream)?;
        }

        if state.sizes[index] > 0
            && state.sizes[index].saturating_add(buf.len() as u64) > MAX_LOG_SIZE
        {
            self.rotate(&mut state, stream)?;
        }

        let file = state.files[index].as_mut().expect("stream log is open");
        file.write_all(buf)?;
        state.sizes[index] += buf.len() as u64;
        Ok(buf.len())
    }

    fn flush(&self, stream: Stream) -> io::Result<()> {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match state.files[stream.index()].as_mut() {
            Some(file) => file.flush(),
            None => Ok(()),
        }
    }

    fn open_stream(&self, state: &mut LogState, stream: Stream) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.dir.join(stream.file_name()))?;
        let index = stream.index();
        state.sizes[index] = file.metadata()?.len();
        state.files[index] = Some(file);
        Ok(())
    }

    fn rotate(&self, state: &mut LogState, stream: Stream) -> io::Result<()> {
        for file in state.files.iter_mut() {
            if let Some(mut file) = file.take() {
                let _ = file.flush();
            }
        }

        bundle_active_logs(&self.dir)?;
        prune_bundles(&self.dir)?;

        let index = stream.index();
        state.sizes[index] = 0;
        self.open_stream(state, stream)
    }
}

struct SessionWriter {
    logs: Arc<LogSet>,
    stream: Stream,
}

impl Write for SessionWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if !logging_enabled() {
            return Ok(buf.len());
        }

        self.logs.write(self.stream, buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        if !logging_enabled() {
            return Ok(());
        }

        self.logs.flush(self.stream)
    }
}

/// Zip the active logs that have content and remove them afterwards.
fn bundle_active_logs(dir: &Path) -> io::Result<()> {
    let mut entries = Vec::new();

    for stream in Stream::ALL {
        let path = dir.join(stream.file_name());

        match path.metadata() {
            Ok(metadata) if metadata.len() > 0 => {
                entries.push((path, stream.file_name().to_string()));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
    }

    if entries.is_empty() {
        return Ok(());
    }

    fs::create_dir_all(dir)?;
    let bundle_path = unique_bundle_path(dir);

    let result = (|| -> io::Result<()> {
        let file = File::create(&bundle_path)?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for (path, name) in &entries {
            zip.start_file(name.clone(), options).map_err(|error| {
                io::Error::other(format!("Could not add {name} to the log bundle: {error}"))
            })?;
            let mut source = File::open(path)?;
            io::copy(&mut source, &mut zip)?;
        }

        zip.finish().map_err(|error| {
            io::Error::other(format!("Could not finish the log bundle: {error}"))
        })?;
        Ok(())
    })();

    if let Err(error) = result {
        let _ = fs::remove_file(&bundle_path);
        return Err(error);
    }

    for (path, _) in entries {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn unique_bundle_path(dir: &Path) -> PathBuf {
    let stamp = archive_timestamp();
    let mut path = dir.join(format!("logs_{stamp}.zip"));
    let mut suffix = 1;

    while path.exists() {
        path = dir.join(format!("logs_{stamp}-{suffix}.zip"));
        suffix += 1;
    }

    path
}

fn archive_timestamp() -> String {
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());

    format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

fn prune_bundles(dir: &Path) -> io::Result<()> {
    let mut bundles = fs::read_dir(dir)?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let file_name = path.file_name()?.to_str()?;

            if !file_name.starts_with("logs_") || !file_name.ends_with(".zip") {
                return None;
            }

            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((path, modified))
        })
        .collect::<Vec<_>>();

    bundles.sort_by_key(|(_, modified)| *modified);

    if bundles.len() > KEPT_LOG_BUNDLES {
        for (path, _) in bundles.iter().take(bundles.len() - KEPT_LOG_BUNDLES) {
            fs::remove_file(path)?;
        }
    }

    Ok(())
}

fn file_target(set: &Arc<LogSet>, stream: Stream) -> Target {
    let writer = SessionWriter {
        logs: Arc::clone(set),
        stream,
    };
    let dispatch = tauri_plugin_log::fern::Dispatch::new().chain(
        tauri_plugin_log::fern::Output::writer(Box::new(writer), "\n"),
    );

    Target::new(TargetKind::Dispatch(dispatch))
}

/// Build the log plugin. File targets are filtered by logging target so osu!
/// and patcher output stay separate while still being copied to the main log.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    set_logging_enabled(initial_logging_enabled());

    let logs_dir = logs_directory();
    let set = Arc::new(LogSet::new(logs_dir));

    let launcher = file_target(&set, Stream::Launcher);
    let osu =
        file_target(&set, Stream::Osu).filter(|metadata| metadata.target().starts_with("osu"));
    let patcher = file_target(&set, Stream::Patcher)
        .filter(|metadata| metadata.target().starts_with("patcher"));

    tauri_plugin_log::Builder::new()
        .targets([Target::new(TargetKind::Stdout), launcher, osu, patcher])
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogBundleInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogBundleEntry {
    pub name: String,
    pub content: String,
}

/// List the rotating ZIP bundles, newest first, for the in-app log viewer.
#[tauri::command]
pub fn list_log_bundles() -> Result<Vec<LogBundleInfo>, String> {
    let dir = logs_directory();
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut bundles = fs::read_dir(&dir)
        .map_err(|error| format!("Could not read the logs folder: {error}"))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?.to_string();
            if !name.starts_with("logs_") || !name.ends_with(".zip") {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            let modified = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0);
            Some(LogBundleInfo {
                path: path.to_string_lossy().into_owned(),
                name,
                size: metadata.len(),
                modified,
            })
        })
        .collect::<Vec<_>>();

    bundles.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(bundles)
}

/// Read the launcher/osu/patcher logs out of one bundle.
#[tauri::command]
pub fn read_log_bundle(path: String) -> Result<Vec<LogBundleEntry>, String> {
    let dir = logs_directory();
    let requested = fs::canonicalize(&path)
        .map_err(|error| format!("Could not open the log bundle: {error}"))?;
    let root = fs::canonicalize(&dir)
        .map_err(|error| format!("Could not resolve the logs folder: {error}"))?;
    if !requested.starts_with(&root) {
        return Err("The log bundle is outside the logs folder".to_string());
    }

    let file = File::open(&requested)
        .map_err(|error| format!("Could not read the log bundle: {error}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| format!("Invalid log bundle: {error}"))?;
    let mut entries = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not read a log entry: {error}"))?;
        if !entry.name().ends_with(".log") {
            continue;
        }

        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(2 * 1024 * 1024)
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Could not read a log entry: {error}"))?;
        let mut content = String::from_utf8_lossy(&bytes).into_owned();
        if entry.size() > bytes.len() as u64 {
            content.push_str("\n… log truncated in the viewer …\n");
        }
        entries.push(LogBundleEntry {
            name: entry.name().to_string(),
            content,
        });
    }

    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

/// Start reading a child's stdout/stderr and write every line to `target`.
pub fn capture_osu_output(child: &mut Child) {
    capture_output(child, "osu");
}

/// Start reading a child's stdout/stderr and write every line to `target`.
pub fn capture_patcher_output(child: &mut Child) {
    capture_output(child, "patcher");
}

fn capture_output(child: &mut Child, target: &'static str) {
    if let Some(stdout) = child.stdout.take() {
        stream_lines(stdout, "stdout", target);
    }
    if let Some(stderr) = child.stderr.take() {
        stream_lines(stderr, "stderr", target);
    }
}

fn stream_lines<R>(reader: R, stream: &'static str, target: &'static str)
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(reader).lines();

        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    let line = truncate(line.trim_end_matches(['\r', '\n']));
                    if !line.is_empty() {
                        log::log!(target: target, Level::Info, "[{stream}] {line}");
                    }
                }
                Ok(None) => break,
                Err(error) => {
                    log::log!(
                        target: target,
                        Level::Warn,
                        "Could not read {stream} output: {error}"
                    );
                    break;
                }
            }
        }
    });
}

fn truncate(mut value: &str) -> String {
    if value.chars().count() <= MAX_LINE_CHARS {
        return value.to_string();
    }

    value = &value[..value
        .char_indices()
        .nth(MAX_LINE_CHARS)
        .map(|(index, _)| index)
        .unwrap_or(value.len())];
    format!("{value}…")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir =
            std::env::temp_dir().join(format!("ezpp-logging-{}-{name}-{id}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_line(logs: &Arc<LogSet>, stream: Stream, line: &str) {
        let mut writer = SessionWriter {
            logs: Arc::clone(logs),
            stream,
        };
        writer.write_all(line.as_bytes()).unwrap();
        writer.flush().unwrap();
    }

    #[test]
    fn creates_file_only_after_first_line() {
        let dir = temp_dir("lazy");
        let logs = Arc::new(LogSet::new(dir.clone()));

        assert!(!dir.join("osu.log").exists());

        write_line(&logs, Stream::Osu, "[stdout] first\n");

        assert_eq!(
            fs::read_to_string(dir.join("osu.log")).unwrap(),
            "[stdout] first\n"
        );
        assert!(!dir.join("launcher.log").exists());
        assert!(!dir.join("patcher.log").exists());

        drop(logs);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn bundles_all_streams_when_a_new_session_starts() {
        let dir = temp_dir("bundle");

        let previous = Arc::new(LogSet::new(dir.clone()));
        write_line(&previous, Stream::Launcher, "launcher previous\n");
        write_line(&previous, Stream::Osu, "osu previous\n");
        write_line(&previous, Stream::Patcher, "patcher previous\n");
        drop(previous);

        let current = Arc::new(LogSet::new(dir.clone()));
        write_line(&current, Stream::Launcher, "launcher current\n");

        // Active files only contain the new session.
        assert_eq!(
            fs::read_to_string(dir.join("launcher.log")).unwrap(),
            "launcher current\n"
        );
        assert!(!dir.join("osu.log").exists());
        assert!(!dir.join("patcher.log").exists());

        let bundles = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("zip"))
            .collect::<Vec<_>>();

        assert_eq!(bundles.len(), 1);

        let file = File::open(&bundles[0]).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        assert_eq!(zip.len(), 3);

        let mut names = (0..zip.len())
            .map(|index| zip.by_index(index).unwrap().name().to_string())
            .collect::<Vec<_>>();
        names.sort();
        assert_eq!(names, ["launcher.log", "osu.log", "patcher.log"]);

        let mut launcher = String::new();
        zip.by_name("launcher.log")
            .unwrap()
            .read_to_string(&mut launcher)
            .unwrap();
        assert_eq!(launcher, "launcher previous\n");

        drop(zip);
        drop(current);
        fs::remove_dir_all(dir).unwrap();
    }
}
