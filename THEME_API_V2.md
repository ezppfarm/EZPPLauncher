# EZPPLauncher Theme API 2.0

API 2.0 is a declarative theme format. Instead of shipping a JavaScript bundle that
mounts its own UI, a theme describes its background, effects, audio, fonts and
freeform layers in `theme.json`. The launcher renders it, and the built-in advanced
editor can create and edit these themes without writing code.

API 1.0 themes continue to work unchanged. Pick the API that fits the theme:

|                         | API 1.0                                           | API 2.0                                        |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Rendering               | Svelte bundle (`entry`)                           | Launcher-rendered                              |
| Files                   | `theme.json`, `bundle.js`, `style.css`, `assets/` | `theme.json`, `assets/`                        |
| Created with            | `create-ezpplauncher-theme`                       | Launcher editor or `create-ezpplauncher-theme` |
| Scripts / arbitrary DOM | Yes                                               | No (data only, optional CSS)                   |
| Cross-platform          | Depends on the bundle                             | Yes                                            |

---

## Package layout

A packaged `.ezpplauncher-theme` file is a zip with this structure:

```
theme.json
assets/
  background.webm
  layer.png
  music.mp3
  font.woff2
  preview.png        # optional thumbnail
```

An installed theme lives in:

```
# Windows
C:\Users\<user>\.ezpplauncher\themes\<folder>\

# macOS / Linux
~/.ezpplauncher/themes/<folder>/
```

---

## `theme.json`

```json
{
  "name": "Midnight",
  "version": "1.0.0",
  "apiVersion": "2.0",
  "author": "Your Name",
  "description": "A dark gradient with drifting stars.",
  "preview": "preview.png",
  "background": {
    "type": "gradient",
    "from": "#181825",
    "to": "#3b1d4f",
    "angle": 135,
    "opacity": 1
  },
  "overlay": {
    "color": "#000000",
    "opacity": 0.2,
    "vignette": 0.35
  },
  "effects": {
    "type": "stars",
    "density": 40,
    "speed": 1,
    "color": "#ffd6f2"
  },
  "typography": {
    "body": "Sora Variable",
    "heading": "Bebas Neue"
  },
  "fonts": [
    {
      "family": "My Display Font",
      "src": "display.woff2",
      "weight": "400",
      "style": "normal"
    }
  ],
  "elements": [
    {
      "id": "tagline",
      "type": "text",
      "text": "MIDNIGHT",
      "x": 640,
      "y": 84,
      "width": 300,
      "height": 72,
      "fontFamily": "Bebas Neue",
      "fontSize": 46,
      "fontWeight": 400,
      "color": "#ffffff",
      "align": "right",
      "verticalAlign": "center",
      "letterSpacing": 2
    }
  ],
  "audio": {
    "src": "music.mp3",
    "loop": true
  },
  "accentColor": "#ff006e",
  "css": ""
}
```

### Metadata

| Field         | Type   | Required | Notes                                               |
| ------------- | ------ | -------- | --------------------------------------------------- |
| `name`        | string | yes      | Display name; also used for the install folder      |
| `version`     | string | yes      | Semver, used for update checks                      |
| `apiVersion`  | string | yes      | Must start with `2` (use `"2.0"`)                   |
| `author`      | string | yes      | Shown in the theme manager                          |
| `description` | string | no       | Shown on the theme card                             |
| `nsfw`        | bool   | no       | Marks the theme as adult content (`18+` badge)      |
| `preview`     | string | no       | Card thumbnail; the editor generates `preview.png`  |
| `accentColor` | string | no       | Hex color used for focus rings and active UI states |
| `css`         | string | no       | Extra CSS injected while the theme is active        |

### Background

`background.type` selects the layer:

```json
{ "type": "color", "color": "#181825", "opacity": 1 }
```

```json
{ "type": "gradient", "from": "#181825", "to": "#3b1d4f", "angle": 135, "opacity": 1 }
```

```json
{ "type": "image", "src": "background.png", "fit": "cover", "opacity": 1, "blur": 0 }
```

```json
{
  "type": "video",
  "src": "background.webm",
  "fit": "cover",
  "opacity": 1,
  "blur": 0,
  "muted": true
}
```

- `src` is relative to the theme's `assets/` folder.
- `fit` is `cover` (default) or `contain`.
- `opacity` is clamped to `0`–`1`, `blur` to `0`–`40` pixels.
- Background videos autoplay and loop. They are muted by default; set `muted` to `false`
  to play their audio.
- Prefer **WebM** for video backgrounds and video layers. It is supported by the
  launcher and keeps theme packages much smaller than MP4. MP4, MOV and M4V also
  work.

### Overlay

```json
{ "color": "#000000", "opacity": 0.2, "vignette": 0.35 }
```

`opacity` controls the flat dim layer and `vignette` darkens the edges. Both are
clamped to `0`–`1`.

### Effects

```json
{ "type": "stars", "density": 40, "speed": 1, "color": "#ffd6f2" }
```

Supported types: `none`, `stars`, `snow`, `petals`, `bubbles`.

- `density` is clamped to `0`–`120` particles.
- `speed` is clamped to `0.2`–`3`.
- Effects are disabled when the user turns on **Reduce animations**.

### Audio

```json
{ "src": "music.mp3", "loop": true }
```

`src` is relative to `assets/`. Music uses the launcher's volume control and is
silent in the theme editor preview.

### Typography

`typography.body` changes the font used by the launcher UI. `typography.heading`
changes headings such as the launcher title.

```json
"typography": {
  "body": "Montserrat Variable",
  "heading": "Playfair Display Variable"
}
```

These families ship with the launcher through `@fontsource` and can be used
without adding any files:

| Family                      | Style   |
| --------------------------- | ------- |
| `Sora Variable`             | Sans    |
| `Montserrat Variable`       | Sans    |
| `Bebas Neue`                | Display |
| `Playfair Display Variable` | Serif   |
| `Space Mono`                | Mono    |
| `JetBrains Mono Variable`   | Mono    |

Custom fonts can be packaged with the theme. The launcher generates the
`@font-face` rules from `fonts`:

```json
"fonts": [
  { "family": "My Display Font", "src": "display.woff2", "weight": "400", "style": "normal" }
]
```

- `src` is relative to `assets/`.
- Supported formats: WOFF2 (recommended), WOFF, TTF and OTF.
- `weight` defaults to `400`; `style` defaults to `normal`.
- Use the `family` value in `typography` and in text layers.

The editor's **Fonts** tab browses the full Fontsource catalog (2,000+ families)
and downloads the selected family, weight, style and subset as a WOFF2 into the
theme's `assets/` folder. It adds the matching `fonts` entry automatically, so
saved and exported themes stay self-contained.

### Freeform layers

`elements` are rendered above the launcher UI, but only on the **Home** screen.
The launcher canvas is a fixed **1000 × 650** coordinate space. Elements can extend
the home screen with text, images, videos and shapes, and they are
pointer-transparent in the running launcher so they never block buttons.

The order of the `elements` array controls stacking: the last element is drawn on
top. Themes can contain up to 100 layers.

Every layer supports:

| Field      | Type    | Notes                                            |
| ---------- | ------- | ------------------------------------------------ |
| `id`       | string  | Unique within the theme                          |
| `name`     | string? | Optional editor label; does not affect rendering |
| `type`     | string  | `text`, `image`, `video` or `shape`              |
| `x`, `y`   | number  | Position in the 1000 × 650 stage                 |
| `width`    | number  | 24–1000                                          |
| `height`   | number  | 24–650                                           |
| `rotation` | number  | Degrees, `-360`–`360`                            |
| `opacity`  | number  | `0`–`1`                                          |
| `hidden`   | boolean | Keep the layer in the file but do not render it  |
| `locked`   | boolean | Prevent moving/resizing the layer in the editor  |

#### Text

```json
{
  "id": "greeting",
  "type": "text",
  "text": "Welcome back!",
  "x": 360,
  "y": 220,
  "width": 420,
  "height": 90,
  "fontFamily": "Bebas Neue",
  "fontSize": 42,
  "fontWeight": 600,
  "color": "#ffffff",
  "align": "center",
  "verticalAlign": "center",
  "lineHeight": 1.2,
  "letterSpacing": 0
}
```

`align` is `left`, `center` or `right`; `verticalAlign` is `top`, `center` or
`bottom`. Font size is clamped to `6`–`240`.

#### Image and video

```json
{
  "id": "logo",
  "type": "image",
  "src": "logo.png",
  "x": 700,
  "y": 420,
  "width": 220,
  "height": 140,
  "fit": "contain",
  "radius": 18,
  "opacity": 1
}
```

```json
{
  "id": "ambient",
  "type": "video",
  "src": "ambient.webm",
  "x": 0,
  "y": 0,
  "width": 1000,
  "height": 650,
  "fit": "cover",
  "opacity": 0.35
}
```

Video layers autoplay and loop. They are muted by default; set `muted` to `false` to
play their audio. WebM is recommended for size. Use an `opacity` below `1` if the video
should blend into the launcher UI.

#### Shape

```json
{
  "id": "glow",
  "type": "shape",
  "shape": "ellipse",
  "x": 680,
  "y": 60,
  "width": 260,
  "height": 260,
  "fill": "#ff006e",
  "opacity": 0.18,
  "borderWidth": 0,
  "borderColor": "#ffffff"
}
```

`shape` is `rectangle`, `ellipse` or `line`. `radius` rounds rectangle corners.
`borderWidth` is clamped to `0`–`40`.

### Custom CSS

The `css` field is appended while the theme is active. Theme authors can use it for
small tweaks, but it is not required. Example:

```css
:root {
  --radius: 1rem;
}
```

---

## Using the advanced editor

1. Open **Themes** in the launcher.
2. Select **Create theme**, or the pencil button on an installed API 2.0 theme.
3. The editor opens in its **own resizable window**, not a modal. The center is a
   full launcher home canvas at 1000 × 650.
4. Use the left toolbar to add text, image, video and shape layers. Drag layers on
   the canvas, resize with the corner handles, or edit exact values in the right
   inspector. Shift/Cmd-click a layer or drag a marquee over empty canvas to
   select several layers. Multi-selections can be dragged together and aligned
   or distributed from the right panel. Layers snap to canvas edges, the canvas
   center, and other layers while dragging; hold Alt to disable snapping.
   Right-click a layer for quick duplicate, ordering, hide/lock and delete
   actions, or right-click empty canvas to add a new layer.
5. The layer list supports double-click rename, hide/show, lock/unlock and
   drag-to-reorder. Hidden layers remain in the package, while locked layers
   cannot be moved or resized on the canvas.
6. Use the **Theme** tab for metadata, background, effects, typography and custom
   CSS. Open the **Fonts** tab to search and download from every Fontsource
   family, or import WOFF2, WOFF, TTF and OTF files. Downloaded fonts are copied
   into the theme's `assets/` folder when you save.
7. Select **Save theme** to write `theme.json` and copy new assets into
   `~/.ezpplauncher/themes`. A fresh `assets/preview.png` thumbnail is rendered
   from the theme and the launcher applies the saved theme immediately. Unsaved
   edits are autosaved as a local draft and offered for recovery after a crash.
8. Select **Export** to create a shareable `.ezpplauncher-theme` package. A theme
   check runs first and reports missing assets, oversized media, missing fonts
   and unused imports. Export saves and refreshes the preview, then reports the
   final package size.

Keyboard shortcuts:

- `Cmd/Ctrl+Z` undoes the last change.
- `Cmd/Ctrl+Shift+Z` or `Ctrl+Y` redoes it.
- `Cmd/Ctrl+S` saves.
- `Cmd/Ctrl+D` duplicates the selected layer or multi-selection.
- `Cmd/Ctrl+A` selects every visible layer.
- Shift/Cmd-click toggles a layer in the current selection.
- Arrow keys nudge the selected layer(s) by 1 px; hold Shift for 10 px.
- `Delete` removes the selected layer(s).
- Hold Alt while dragging to skip snapping.
- `Esc` clears the selection or closes an open editor dialog.

---

## Creating API 2.0 themes with the CLI

The `create-ezpplauncher-theme` CLI includes a **declarative (API 2.0)** template:

```bash
npx git+https://git.ez-pp.farm/EZPPFarm/create-ezpplauncher-theme.git my-theme
```

Choose `declarative (API 2.0)`, edit `theme.json`, add files to `assets/`, then run:

```bash
npm run build
```

This produces `dist/my_theme.ezpplauncher-theme`. The template also includes
`preview.html` for a standalone browser preview:

```bash
npx serve .
```

---

## Compatibility and limits

- API 2.0 packages must include `theme.json`; `entry` and `style` are not used.
- Asset paths are resolved inside `assets/`; path traversal is rejected by the
  import commands.
- Exports include only `assets/` files referenced by `theme.json` (background,
  audio, fonts, layers and preview). Orphaned files left in the folder are
  omitted, which keeps packages small. API 1.0 themes are exported whole because
  their bundles can load files dynamically.
- The editor writes `preview.png` whenever you save or export. The generated
  thumbnail renders the background, effects, launcher UI, theme fonts and
  freeform layers; custom CSS is not applied to the thumbnail.
- The theme editor only writes inside `~/.ezpplauncher/themes`.
- API 1.0 themes are still loaded through their existing `mountTheme` bundle API.
- API 2.0 themes cannot run JavaScript. Use custom CSS for small visual tweaks, or
  use API 1.0 when a theme needs a fully custom UI.
- Freeform layers are decorative, home-screen-only and pointer-transparent; they
  cannot add interactive controls.
