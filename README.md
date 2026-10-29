# EZPPLauncher

**EZPPLauncher** is a custom launcher for the private osu! server [EZPPFarm](https://ez-pp.farm), built with **Rust** and **Svelte** using the [Tauri](https://tauri.app) framework.  
It enhances the osu! experience with quality-of-life features and integration specifically designed for the EZPPFarm community.

---

## 🖼️ Preview

![EZPPLauncher Preview](./assets/EZPPLauncher-preview.png)

---

## 🚀 Features

- [x] Automatically updates osu! before launching
- [x] Automatically start/stop the OpenTabletDriver Daemon (Windows)
- [x] Automatic ingame login
- [x] Patches the osu! client to show misses in Relax and Autopilot (Windows, Linux and macOS via Wine)
- [x] Displays your EZPPFarm stats in the launcher
- [x] Shows the number of imported beatmapsets
- [x] Shows the number of imported skins
- [x] Displays ping to the EZPPFarm server
- [x] Discord Rich Presence
- [x] Performance Display Overlay (currently in experimental patcher release stream)
- [x] Launcher Theming (API 1.0 bundles and API 2.0 declarative themes)
- [x] Advanced theme editor in its own window with freeform text/image/video/shape layers, multi-select and snapping, layer locks, draft recovery, validation and export
- [x] Theme update backups with one-click rollback, plus a trust prompt before running executable API 1.0 themes
- [x] In-app diagnostics for osu!, Wine, the patcher, and the experimental stream's .NET 8 runtime, plus a log-bundle viewer

---

## 💻 Supported Platforms

| Platform | Status                                                 |
| -------- | ------------------------------------------------------ |
| Windows  | ✅ Supported                                           |
| macOS    | 🕧 Partially supported (via Wineskin/Whisky/CrossOver) |
| Linux    | 🕧 Partially supported (via osu-winello)               |

> **Windows** remains the fully supported platform. OpenTabletDriver is Windows-only. On macOS,
> in-game patching runs the Windows patcher through the same Wine prefix as osu!. The stable
> patcher stream needs no extra runtime; the experimental stream needs the .NET 8 Desktop Runtime
> installed in that prefix.

### macOS

osu! stable is a Windows build, so on macOS it runs inside a Wine wrapper. EZPPLauncher
supports Wineskin wrappers (the usual `osu!.app` wine skin), Whisky bottles and CrossOver
bottles.

The setup wizard automatically looks for Wineskins in `/Applications` and `~/Applications`.
If detection fails, choose **Browse** and pick the `osu!.app` wrapper itself (or a Wine prefix
folder); the launcher resolves the osu! installation inside it, so there is no need to open the
bundle's package contents.

Large VP8/VP9/AV1 theme videos are transcoded once to a cached 720p H.264/AAC file so WebKit
can use the Mac's hardware decoder. The first large video triggers a one-time (~63 MB) download
of a signed static FFmpeg 9.0.2 build from `ffmpeg.martin-riedl.de` into `~/.ezpplauncher/bin`;
the launcher verifies its pinned SHA-256 and makes it executable. The managed build requires
macOS 12 or newer. If the download fails, a system FFmpeg (Homebrew or MacPorts) is used; without
either, themes still load but large WebM videos remain on WebKit's software decoder and may
stutter. Theme authors can also ship an H.264/MP4 version alongside the WebM.

---

## 🪵 Logs

Launcher, osu! and patcher output is written to `.ezpplauncher/logs` in your home folder:

| File           | Contents                                                       |
| -------------- | -------------------------------------------------------------- |
| `launcher.log` | Launcher lifecycle, webview console output and uncaught errors |
| `osu.log`      | osu! and osu! updater output, including stdout/stderr          |
| `patcher.log`  | Patcher output, including stdout/stderr                        |

A file is only created when that stream actually writes a line. On each new session, or when
any file reaches 5 MiB, all three active files are bundled into a single
`logs_<date>_<time>.zip`; the five most recent bundles are kept. You can turn file logging off,
open the folder, or browse and filter a bundle in the built-in viewer from **Settings → Logging**.
On Windows the folder is `%USERPROFILE%\.ezpplauncher\logs`.

**Settings → Diagnostics** checks the selected osu! install and write access, the macOS Wine
prefix/runtime/version and (for the experimental patcher stream) its .NET 8 runtime, the FFmpeg
theme-video transcoder, osu-winello/wmctrl on Linux, and whether the patcher is present. It can
copy a plain-text support report or reopen the setup wizard for a guided repair.

---

## 🛠 Build From Source

### Requirements

- **Rust** (installed via [rustup](https://rustup.rs/) – recommended for Windows)
- **Cargo** (comes with rustup)
- **[CMake](https://cmake.org/download/)**
- **[Bun](https://bun.sh/)** (JavaScript runtime)
- On macOS: **Xcode Command Line Tools** (`xcode-select --install`)

### Steps

```bash
# Install all dependencies
bun i

# Build the project
bun run build
```

After building, the launcher executable will be located at:

```
# Windows
src-tauri/target/release/ezpplauncher.exe

# macOS
src-tauri/target/release/bundle/macos/EZPPLauncher.app
src-tauri/target/release/bundle/dmg/EZPPLauncher_*.dmg
```

---

## 📁 Project Structure (Simplified)

```
├── src/                           # Frontend (Svelte)
├── src-tauri/                     # Backend (Rust)
│   ├── src/macos.rs               # Wine/Wineskin support for macOS
│   ├── tauri.conf.json            # Tauri configuration
│   └── tauri.macos.conf.json      # macOS bundle targets (app + dmg)
├── package.json                   # Bun project config
└── README.md
```

---

## 🎨 Launcher Themes

By default, the launcher includes several downloadable themes. Themes can be created
in two ways:

- Use the built-in **advanced editor** on the Themes screen. It opens in its own
  resizable window with a full launcher home canvas, freeform text/image/video/shape
  layers, WebM support, `@fontsource` fonts and custom font imports. It creates API 2.0
  themes and can export them as shareable `.ezpplauncher-theme` files.
- Use the [create-ezpplauncher-theme](https://git.ez-pp.farm/EZPPFarm/create-ezpplauncher-theme)
  CLI. It supports both API 1.0 Svelte themes and API 2.0 declarative themes.

See [THEME_API_V2.md](THEME_API_V2.md) for the full API 2.0 schema, limits and packaging
layout. API 1.0 themes continue to load unchanged.
