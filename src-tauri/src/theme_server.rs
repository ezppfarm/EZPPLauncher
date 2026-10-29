//! Loopback HTTP server for theme assets on Linux.
//!
//! WebKitGTK cannot play audio or video through Tauri's custom `asset:`
//! protocol, and module scripts from that scheme are unreliable too. A real
//! loopback HTTP server gives WebKit normal status codes, range responses and
//! MIME types, so v1 and v2 theme assets load the same way they do in a
//! browser.

use http_body_util::Full;
use http_range::HttpRange;
use hyper::body::{Bytes, Incoming};
use hyper::header::{
    ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
    ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_EXPOSE_HEADERS, ACCESS_CONTROL_MAX_AGE,
    CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, ORIGIN, RANGE, VARY,
};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::convert::Infallible;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::net::TcpListener;

type Body = Full<Bytes>;

/// Keep individual responses small enough that a media seek cannot allocate
/// an unbounded buffer. WebKit asks for the next range as it plays.
const MAX_RANGE_BYTES: u64 = 8 * 1024 * 1024;

struct ThemeServer {
    port: u16,
    previews: Arc<Mutex<HashMap<String, PathBuf>>>,
}

static SERVER: OnceLock<ThemeServer> = OnceLock::new();

/// Bind the server on a random loopback port. The root is the themes folder.
pub fn start(root: PathBuf) -> Result<u16, String> {
    if let Some(server) = SERVER.get() {
        return Ok(server.port);
    }

    let root = std::fs::canonicalize(&root)
        .map_err(|error| format!("Could not resolve the themes folder: {error}"))?;
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Could not start the theme asset server: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Could not configure the theme asset server: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Could not read the theme asset server address: {error}"))?
        .port();

    let previews = Arc::new(Mutex::new(HashMap::new()));
    let server = ThemeServer {
        port,
        previews: previews.clone(),
    };
    let _ = SERVER.set(server);

    let root = Arc::new(root);
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                log::error!(target: "launcher", "Theme asset server failed: {error}");
                return;
            }
        };

        log::info!(
            target: "launcher",
            "Theme asset server listening on http://127.0.0.1:{port}/themes"
        );

        loop {
            let (stream, _) = match listener.accept().await {
                Ok(connection) => connection,
                Err(error) => {
                    log::debug!(target: "launcher", "Theme asset server accept error: {error}");
                    continue;
                }
            };

            let root = root.clone();
            let previews = previews.clone();
            tokio::spawn(async move {
                let service =
                    service_fn(move |request| handle(request, root.clone(), previews.clone()));

                if let Err(error) = http1::Builder::new()
                    .serve_connection(TokioIo::new(stream), service)
                    .await
                {
                    log::debug!(target: "launcher", "Theme asset connection ended: {error}");
                }
            });
        }
    });

    Ok(port)
}

pub fn base_url() -> Option<String> {
    SERVER
        .get()
        .map(|server| format!("http://127.0.0.1:{}/themes", server.port))
}

/// Register a file picked in the theme editor so its preview can be served
/// over HTTP too. The token is only a lookup key; unregistered paths are never
/// readable through the server.
pub fn preview_url(path: &Path) -> Result<String, String> {
    let server = SERVER
        .get()
        .ok_or_else(|| "The theme asset server is not running".to_string())?;
    let path = std::fs::canonicalize(path)
        .map_err(|error| format!("Could not resolve the preview asset: {error}"))?;
    if !path.is_file() {
        return Err("The preview asset is not a file".to_string());
    }

    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    hasher.update(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
            .to_le_bytes(),
    );
    let token = hex::encode(&hasher.finalize()[..16]);

    server
        .previews
        .lock()
        .map_err(|_| "Could not register the preview asset".to_string())?
        .insert(token.clone(), path);

    Ok(format!("http://127.0.0.1:{}/preview/{token}", server.port))
}

async fn handle(
    request: Request<Incoming>,
    root: Arc<PathBuf>,
    previews: Arc<Mutex<HashMap<String, PathBuf>>>,
) -> Result<Response<Body>, Infallible> {
    let origin = request
        .headers()
        .get(ORIGIN)
        .and_then(|value| value.to_str().ok())
        .and_then(allowed_origin);

    if request.method() == Method::OPTIONS {
        return Ok(preflight_response(origin.as_deref()));
    }

    if request.method() != Method::GET && request.method() != Method::HEAD {
        return Ok(text_response(
            StatusCode::METHOD_NOT_ALLOWED,
            "Method not allowed",
            origin.as_deref(),
        ));
    }

    let range = request
        .headers()
        .get(RANGE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);

    let path = percent_encoding::percent_decode_str(request.uri().path())
        .decode_utf8_lossy()
        .to_string();

    let file = if let Some(relative) = path.strip_prefix("/themes/") {
        safe_theme_path(&root, relative)
    } else if let Some(token) = path.strip_prefix("/preview/") {
        previews
            .lock()
            .ok()
            .and_then(|previews| previews.get(token).cloned())
    } else {
        None
    };

    let response = match file {
        Some(file) => {
            serve_file(request.method(), &file, range.as_deref(), origin.as_deref()).await
        }
        None => Ok(text_response(
            StatusCode::NOT_FOUND,
            "Not found",
            origin.as_deref(),
        )),
    };

    Ok(response.unwrap_or_else(|message| {
        log::warn!(target: "launcher", "Theme asset request failed: {message}");
        text_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            origin.as_deref(),
        )
    }))
}

fn safe_theme_path(root: &Path, relative: &str) -> Option<PathBuf> {
    let relative = relative.trim_start_matches('/');
    if relative.is_empty()
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return None;
    }

    let candidate = root.join(relative);
    let canonical = std::fs::canonicalize(candidate).ok()?;
    canonical.starts_with(root).then_some(canonical)
}

async fn serve_file(
    method: &Method,
    path: &Path,
    range_header: Option<&str>,
    origin: Option<&str>,
) -> Result<Response<Body>, String> {
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|error| format!("Could not read theme asset: {error}"))?;
    if !metadata.is_file() {
        return Ok(text_response(StatusCode::NOT_FOUND, "Not found", origin));
    }

    let length = metadata.len();
    let range = match range_header {
        Some(header) => match parse_range(header, length) {
            Ok(range) => range,
            Err(()) => return Ok(range_not_satisfiable(length, origin)),
        },
        None => None,
    };

    let (status, start, end) = match range {
        Some((start, end)) => (StatusCode::PARTIAL_CONTENT, start, end),
        None => (StatusCode::OK, 0, length.saturating_sub(1)),
    };

    let body_length = if length == 0 {
        0
    } else {
        end.saturating_sub(start) + 1
    };

    let body = if method == Method::HEAD || body_length == 0 {
        Vec::new()
    } else {
        let mut file = tokio::fs::File::open(path)
            .await
            .map_err(|error| format!("Could not open theme asset: {error}"))?;
        if start > 0 {
            file.seek(SeekFrom::Start(start))
                .await
                .map_err(|error| format!("Could not seek theme asset: {error}"))?;
        }
        let mut buffer = vec![0_u8; body_length as usize];
        file.read_exact(&mut buffer)
            .await
            .map_err(|error| format!("Could not read theme asset: {error}"))?;
        buffer
    };

    let mut builder = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, content_type(path))
        .header(CONTENT_LENGTH, body_length.to_string())
        .header(ACCEPT_RANGES, "bytes")
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cross-Origin-Resource-Policy", "cross-origin");

    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(CONTENT_RANGE, format!("bytes {start}-{end}/{length}"));
    }

    if let Some(origin) = origin {
        builder = builder
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(VARY, "Origin")
            .header(
                ACCESS_CONTROL_EXPOSE_HEADERS,
                "Content-Range, Content-Length, Accept-Ranges",
            );
    }

    builder
        .body(Full::new(body.into()))
        .map_err(|error| format!("Could not build theme asset response: {error}"))
}

fn parse_range(header: &str, length: u64) -> Result<Option<(u64, u64)>, ()> {
    if length == 0 {
        return Ok(None);
    }

    let ranges = HttpRange::parse(header, length).map_err(|_| ())?;
    if ranges.len() != 1 {
        return Err(());
    }

    let range = &ranges[0];
    let start = range.start;
    let end = (start + range.length - 1).min(length - 1);
    if start >= length || end < start {
        return Err(());
    }

    // Don't allocate the entire file for a single open-ended range request.
    Ok(Some((start, end.min(start + MAX_RANGE_BYTES - 1))))
}

fn range_not_satisfiable(length: u64, origin: Option<&str>) -> Response<Body> {
    let mut builder = Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(CONTENT_RANGE, format!("bytes */{length}"))
        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(CONTENT_LENGTH, "0");

    if let Some(origin) = origin {
        builder = builder
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(VARY, "Origin");
    }

    builder
        .body(Full::new(Bytes::new()))
        .expect("range response is valid")
}

fn preflight_response(origin: Option<&str>) -> Response<Body> {
    let mut builder = Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(ACCESS_CONTROL_ALLOW_HEADERS, "Range, Content-Type")
        .header(
            ACCESS_CONTROL_EXPOSE_HEADERS,
            "Content-Range, Content-Length, Accept-Ranges",
        )
        .header(ACCESS_CONTROL_MAX_AGE, "600");

    if let Some(origin) = origin {
        builder = builder
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(VARY, "Origin");
    }

    builder
        .body(Full::new(Bytes::new()))
        .expect("preflight response is valid")
}

fn text_response(status: StatusCode, message: &str, origin: Option<&str>) -> Response<Body> {
    let mut builder = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(CONTENT_LENGTH, message.len().to_string())
        .header("X-Content-Type-Options", "nosniff");

    if let Some(origin) = origin {
        builder = builder
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(VARY, "Origin");
    }

    builder
        .body(Full::new(Bytes::copy_from_slice(message.as_bytes())))
        .expect("text response is valid")
}

fn allowed_origin(origin: &str) -> Option<String> {
    if origin == "tauri://localhost"
        || origin == "http://tauri.localhost"
        || origin == "https://tauri.localhost"
        || origin == "null"
        || origin.starts_with("http://localhost:")
        || origin.starts_with("http://127.0.0.1:")
    {
        Some(origin.to_string())
    } else {
        None
    }
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "webm" => "video/webm",
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "ogv" => "video/ogg",
        "mp3" => "audio/mpeg",
        "ogg" | "oga" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}
