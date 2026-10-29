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
- [x] Advanced theme editor in its own window with freeform text/image/video/shape layers, fonts, live launcher preview and export

---

## 💻 Supported Platforms

| Platform | Status                                                 |
| -------- | ------------------------------------------------------ |
| Windows  | ✅ Supported                                           |
| macOS    | 🕧 Partially supported (via Wineskin/Whisky/CrossOver) |
| Linux    | 🕧 Partially supported (via osu-winello)               |

> **Windows** remains the fully supported platform. OpenTabletDriver is Windows-only. On macOS,
> in-game patching runs the Windows patcher through the same Wine prefix as osu!, so that prefix
> needs a .NET runtime installed.

### macOS

osu! stable is a Windows build, so on macOS it runs inside a Wine wrapper. EZPPLauncher
supports Wineskin wrappers (the usual `osu!.app` wine skin), Whisky bottles and CrossOver
bottles.

The setup wizard automatically looks for Wineskins in `/Applications` and `~/Applications`.
If detection fails, choose **Browse** and pick the `osu!.app` wrapper itself (or a Wine prefix
folder); the launcher resolves the osu! installation inside it, so there is no need to open the
bundle's package contents.

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
`logs_<date>_<time>.zip`; the five most recent bundles are kept. You can turn file logging off
or open the folder from **Settings → Logging**.
On Windows the folder is `%USERPROFILE%\.ezpplauncher\logs`.

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
