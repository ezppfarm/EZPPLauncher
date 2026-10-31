# EZPPLauncher Theme API 2.0

API 2.0 is a declarative theme format. Instead of shipping a JavaScript bundle that
mounts its own UI, a theme describes its background, effects, audio, fonts and
freeform layers in `theme.json`. The launcher renders it, and the built-in advanced
editor can create and edit these themes without writing code. Themes can opt into a
custom **Svelte layer** when they need behavior that data alone cannot express; that
layer runs theme-authored JavaScript and therefore needs an explicit trust prompt.

API 1.0 themes continue to work unchanged. Pick the API that fits the theme:

|                         | API 1.0                                           | API 2.0                                        |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Rendering               | Svelte bundle (`entry`)                           | Launcher-rendered                              |
| Files                   | `theme.json`, `bundle.js`, `style.css`, `assets/` | `theme.json`, `assets/`                        |
| Created with            | `create-ezpplauncher-theme`                       | Launcher editor or `create-ezpplauncher-theme` |
| Scripts / arbitrary DOM | Yes                                               | Optional custom Svelte layer (trust prompt)    |
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
    "heading": "Bebas Neue",
    "mono": "JetBrains Mono Variable"
  },
  "fonts": [
    {
      "family": "My Display Font",
      "src": "display.woff2",
      "weight": "400",
      "style": "normal"
    }
  ],
  "groups": [
    {
      "id": "branding",
      "name": "Branding",
      "opacity": 1
    }
  ],
  "elements": [
    {
      "id": "tagline",
      "groupId": "branding",
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
  "variables": {
    "player": "Guest",
    "clicks": 0
  },
  "accentColor": "#ff006e",
  "iconSet": "lucide",
  "css": ""
}
```

### Metadata

| Field         | Type   | Required | Notes                                                            |
| ------------- | ------ | -------- | ---------------------------------------------------------------- |
| `name`        | string | yes      | Display name; also used for the install folder                   |
| `version`     | string | yes      | Semver, used for update checks                                   |
| `apiVersion`  | string | yes      | Must start with `2` (use `"2.0"`)                                |
| `author`      | string | yes      | Shown in the theme manager                                       |
| `description` | string | no       | Shown on the theme card                                          |
| `nsfw`        | bool   | no       | Marks the theme as adult content (`18+` badge)                   |
| `preview`     | string | no       | Card thumbnail; the editor generates `preview.png`               |
| `accentColor` | string | no       | Hex color used for focus rings and active UI states              |
| `iconSet`     | string | no       | Launcher icon family: `lucide`, `phosphor` or `tabler`           |
| `css`         | string | no       | Extra CSS injected while the theme is active                     |
| `behaviors`   | array  | no       | Declarative WHEN / IF / THEN rules; see **Theme logic**          |
| `variables`   | object | no       | Starting values for placeholders and rules; see **Dynamic text** |

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
- Theme music (`audio`) cannot be combined with a video background; the editor
  disables music and the launcher ignores the `audio` entry in that case.
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

Theme music cannot be combined with a `video` background. The editor disables
the music controls while a video background is selected, and themes that contain
both have their `audio` entry ignored.

### Typography

`typography.body` changes the font used by the launcher UI. `typography.heading`
changes headings such as the launcher title. `typography.mono` changes the
monospace font used for paths, versions and telemetry labels; leave it out to
keep the built-in Space Mono stack.

```json
"typography": {
  "body": "Montserrat Variable",
  "heading": "Playfair Display Variable",
  "mono": "JetBrains Mono Variable"
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

### Icon set

`iconSet` swaps the launcher's navigation, status, settings and theme-browser
icons. The default is Lucide; Phosphor and Tabler are also bundled.

```json
"iconSet": "phosphor"
```

| Value      | Family   | Character                          |
| ---------- | -------- | ---------------------------------- |
| `lucide`   | Lucide   | Clean geometric outlines (default) |
| `phosphor` | Phosphor | Softer, rounded shapes             |
| `tabler`   | Tabler   | Crisp, technical outlines          |

Icon bodies ship with the launcher, so the setting never downloads anything at
runtime. Unknown values fall back to Lucide, which keeps older launchers and
hand-written themes compatible. The editor shows a live preview in **Theme →
Icon set**, and the selected family is used across the launcher and its live home
canvas.

### Freeform layers

`elements` are rendered above the launcher UI, but only on the **Home** screen.
The launcher canvas is a fixed **1000 × 650** coordinate space. Elements can extend
the home screen with text, images, videos, shapes, icons, data readouts, gauges,
tickers, Lottie animations and buttons. They are pointer-transparent by default so
they never block buttons; set `interactive: true` to let a layer receive clicks and
hovers from theme logic. Interactive layers sit above the UI and can block clicks
inside their rectangle.

The order of the `elements` array controls stacking: the last element is drawn on
top. Themes can contain up to 100 layers.

Every layer supports:

| Field         | Type    | Notes                                                                                                                                                       |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string  | Unique within the theme                                                                                                                                     |
| `name`        | string? | Optional editor label; does not affect rendering                                                                                                            |
| `type`        | string  | `text`, `data`, `image`, `video`, `shape`, `icon`, `repeater`, `gauge`, `ticker`, `lottie`, `button`, `path`, `particles`, `clock`, `countdown` or `svelte` |
| `x`, `y`      | number  | Position in the 1000 × 650 stage                                                                                                                            |
| `width`       | number  | 24–1000                                                                                                                                                     |
| `height`      | number  | 24–650                                                                                                                                                      |
| `rotation`    | number  | Degrees, `-360`–`360`                                                                                                                                       |
| `scale`       | number  | Legacy uniform scale fallback, `0.05`–`10`                                                                                                                  |
| `scaleX`      | number  | Horizontal scale, `0.05`–`10`                                                                                                                               |
| `scaleY`      | number  | Vertical scale, `0.05`–`10`                                                                                                                                 |
| `skewX`       | number  | Horizontal skew in degrees, `-89`–`89`                                                                                                                      |
| `skewY`       | number  | Vertical skew in degrees, `-89`–`89`                                                                                                                        |
| `flipX`       | boolean | Mirror the layer horizontally                                                                                                                               |
| `flipY`       | boolean | Mirror the layer vertically                                                                                                                                 |
| `opacity`     | number  | `0`–`1`                                                                                                                                                     |
| `hidden`      | boolean | Keep the layer in the file but do not render it                                                                                                             |
| `locked`      | boolean | Prevent moving/resizing the layer in the editor                                                                                                             |
| `interactive` | boolean | Opts into clicks and hovers from theme logic                                                                                                                |
| `groupId`     | string? | Group that contains this layer                                                                                                                              |
| `filters`     | object? | Per-layer CSS filters; see **Groups and filters**                                                                                                           |
| `mask`        | object? | Shape or image clip; see **Masks**                                                                                                                          |
| `cssClasses`  | string? | Space-separated classes for the layer wrapper                                                                                                               |

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
  "fontStyle": "normal",
  "color": "#ffffff",
  "align": "center",
  "verticalAlign": "center",
  "lineHeight": 1.2,
  "letterSpacing": 0,
  "textDecoration": "none",
  "textTransform": "none",
  "fillMode": "solid",
  "outlineWidth": 0,
  "outlineColor": "#000000",
  "shadowColor": "#000000",
  "shadowBlur": 0,
  "shadowOffsetX": 0,
  "shadowOffsetY": 0
}
```

`align` is `left`, `center` or `right`; `verticalAlign` is `top`, `center` or
`bottom`. Font size is clamped to `6`–`240`.

Text layers support the full visual styling set:

| Field            | Type   | Notes                                                           |
| ---------------- | ------ | --------------------------------------------------------------- |
| `fontStyle`      | string | `normal` or `italic`                                            |
| `textDecoration` | string | `none`, `underline`, `line-through` or `underline line-through` |
| `textTransform`  | string | `none`, `uppercase`, `lowercase` or `capitalize`                |
| `fillMode`       | string | `solid` or `gradient`                                           |
| `gradientFrom`   | string | Gradient start color                                            |
| `gradientTo`     | string | Gradient end color                                              |
| `gradientAngle`  | number | Degrees, `0`–`360`; `90` is left to right                       |
| `outlineWidth`   | number | Pixels, `0`–`20`; `0` disables the outline                      |
| `outlineColor`   | string | Outline color                                                   |
| `shadowColor`    | string | Text shadow color                                               |
| `shadowBlur`     | number | Pixels, `0`–`40`                                                |
| `shadowOffsetX`  | number | Pixels, `-40`–`40`                                              |
| `shadowOffsetY`  | number | Pixels, `-40`–`40`                                              |

Gradient fills use `gradientFrom` and `gradientTo`; `color` remains the fallback
for solid fills and is used for text decoration when no gradient is active. Text
outlines are drawn behind the fill, so gradients and outlines can be combined.

#### Dynamic text

Text layers can show live rule variables with `{name}` placeholders. Variables
are shared by every rule and text layer in the theme.

```json
{
  "type": "text",
  "text": "Clicks: {clicks}\nPlayer: {player}",
  "id": "counter"
}
```

```js
clicks += 1;
if (clicks >= 3) {
  player = 'Ready!';
}
```

The theme can declare starting values for its variables. This is optional; any
variable without an entry starts at `0`.

```json
"variables": {
  "clicks": 0,
  "player": "Guest",
  "ready": false
}
```

Every valid placeholder starts with its declared value when the theme loads,
then updates whenever a script or builder action changes that variable. Values
may be numbers, strings or booleans, and variables that are only read by rules
or scripts can be seeded here as well. Numbers, strings and booleans are
inserted as plain text. Reserved names such as `{screen}` and malformed
placeholders stay visible instead of rendering a value. In the editor, the text
inspector lists known variables and inserts the placeholder at the cursor, and
**Theme → Variables** sets each variable's starting value; clearing a field
falls back to `0`.

#### Built-in clock

The engine also exposes read-only local clock values. They refresh once per
second, so a text layer or script can display the live time without declaring
any variables. Conditions also read the current clock whenever a rule fires.

| Placeholder     | Value                                      |
| --------------- | ------------------------------------------ |
| `{time}`        | 24-hour time, e.g. `21:05`                 |
| `{time12}`      | 12-hour time with AM/PM, e.g. `9:05 PM`    |
| `{timeSeconds}` | 24-hour time with seconds, e.g. `21:05:07` |
| `{hour}`        | Hour from `0` to `23`                      |
| `{minute}`      | Minute from `0` to `59`                    |
| `{second}`      | Second from `0` to `59`                    |
| `{dayPeriod}`   | `AM` or `PM`                               |

```html
<p class="clock">{time12}</p>
<p class="tiny">LOCAL // {timeSeconds}</p>
```

They are available to conditions and scripts too, which makes day/night themes
simple:

```js
if (hour >= 18 || hour < 6) {
  showGroup('night');
  hideGroup('day');
}
```

Conditions are evaluated when their rule's trigger fires, so pair a time-based
condition with a **timer** trigger to re-check it while the launcher is open.
For example, a rule with `trigger: { "type": "timer", "interval": 10 }` and a
condition on `hour` switches the theme at sunset or sunrise without restarting.
The helper actions **Show group** / **Hide group** make this easy to build in
the rule editor; the **Clock** quick-pick in a variable condition fills in
`time`, `hour`, `minute`, `second` or `dayPeriod` for you.

The clock names are reserved. Assigning to `time`, `hour` or any other clock
name is a script error, and they are not listed in **Theme → Variables**. They
appear in the text inspector's insert row and in script completion.

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
  "tint": "",
  "opacity": 1
}
```

`tint` repaints the image's alpha silhouette with a solid color. It is the
simplest way to make a monochrome SVG logo follow the theme accent; leave it out
or set it to an empty string to keep the original colors.

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

`shape` is `rectangle`, `ellipse`, `line`, `polygon`, `star` or `arc`. `radius`
rounds rectangle corners and `cornerRadii` (top-left, top-right, bottom-right,
bottom-left) overrides it per corner. `points` sets polygon sides and star points
(`3`–`24`), and `innerRadius` sets the star's inner radius (`0.1`–`0.95`).

An `arc` draws a ring segment instead of a filled shape. Angles start at 12
o'clock and run clockwise; `endAngle` may wrap past `360` and a full `360` span
becomes a ring. `thickness` is the stroke width in stage pixels and `rounded`
controls the end caps.

```json
{
  "id": "dial",
  "type": "shape",
  "shape": "arc",
  "x": 700,
  "y": 80,
  "width": 180,
  "height": 180,
  "startAngle": -120,
  "endAngle": 120,
  "thickness": 10,
  "rounded": true,
  "fillMode": "gradient",
  "gradientFrom": "#ff006e",
  "gradientTo": "#7c3aed"
}
```

Fill can be a solid color or a gradient:

```json
{
  "id": "sunburst",
  "type": "shape",
  "shape": "star",
  "x": 120,
  "y": 120,
  "width": 220,
  "height": 220,
  "points": 8,
  "innerRadius": 0.42,
  "fillMode": "gradient",
  "gradientFrom": "#ffd166",
  "gradientTo": "#ff006e",
  "gradientAngle": 135,
  "opacity": 0.9
}
```

`borderStyle` accepts `solid`, `dashed` or `dotted`, and `backdropBlur` adds a
frosted-glass blur behind the shape (`0`–`60` pixels). Keep the fill partially
transparent to see the blur.

#### Icon

An icon layer draws a semantic icon from the theme's icon set, so switching
`iconSet` changes every icon layer with the rest of the launcher.

```json
{
  "id": "star",
  "type": "icon",
  "icon": "music",
  "x": 720,
  "y": 80,
  "width": 64,
  "height": 64,
  "color": "#ffd6f2",
  "scale": 100
}
```

`scale` is a percentage of the layer's shortest side (`10`–`100`). The available
names are the ones listed by **Theme → Icon** in the editor.

#### Data layer

A data layer is a text layer whose content comes from the launcher instead of
static copy. Use `{value}` in `text` as the placeholder.

```json
{
  "id": "player",
  "type": "data",
  "field": "user.name",
  "text": "Welcome, {value}!",
  "x": 360,
  "y": 180,
  "width": 420,
  "height": 60,
  "fontSize": 26,
  "color": "#ffffff"
}
```

Fields: `user.name`, `user.country`, `user.pp`, `user.rank`, `user.plays`,
`user.accuracy`, `user.playtime`, `launcher.version`, `osu.build`, `osu.stream`,
`server.ping`, `server.friends`, `theme.name`, `theme.author`, `theme.version`,
`screen`, `clock.time`, `clock.time12` and `clock.date`. Player stat fields accept
`mode`: `osu`, `taiko`, `catch` or `mania`. Unknown or signed-out values render as
an empty string. A data layer accepts every text styling field (`fontFamily`,
`fontSize`, `fillMode`, `outlineWidth`, shadows and so on).

#### Repeater

A repeater tiles an image or an icon across the layer bounds.

```json
{
  "id": "sparkles",
  "type": "repeater",
  "source": "icon",
  "icon": "music",
  "x": 120,
  "y": 480,
  "width": 300,
  "height": 120,
  "tileWidth": 28,
  "tileHeight": 28,
  "gapX": 14,
  "gapY": 14,
  "color": "#ffffff"
}
```

`source` is `image` or `icon`. Image repeaters use `src`, `radius` and `fit`
(`cover` inside each tile). Leave `columns` and `rows` at `0` to fill the bounds;
explicit counts are clamped to `60`. At most 240 tiles are drawn.

#### Gauge

A gauge renders a bar or a ring from a `0`–`1` value. Bind it to a theme variable
so logic rules can animate it, or leave `variable` out and use the static value.

```json
{
  "id": "progress",
  "type": "gauge",
  "mode": "ring",
  "variable": "sync",
  "x": 760,
  "y": 420,
  "width": 120,
  "height": 120,
  "trackColor": "#000000",
  "fillColor": "#ff006e",
  "thickness": 10,
  "rounded": true,
  "label": "{percent}%"
}
```

`label` supports `{percent}`, `{value}` and any rule variable. `thickness` is the
ring stroke width in pixels; the bar fills the layer height.

#### Ticker

A ticker scrolls a single line of text horizontally.

```json
{
  "id": "now-playing",
  "type": "ticker",
  "text": "Now playing · Your favourite track · ",
  "x": 120,
  "y": 560,
  "width": 420,
  "height": 48,
  "fontSize": 20,
  "color": "#ffffff",
  "speed": 18,
  "gap": 48
}
```

`speed` is the number of seconds for one loop. The track is duplicated so the
loop is seamless, and animation stops when the system asks for reduced motion.

#### Lottie animation

A Lottie layer plays a JSON animation from the theme's `assets` folder. It scales
crisply and is usually far smaller than a WebM.

```json
{
  "id": "crest",
  "type": "lottie",
  "src": "crest.json",
  "x": 720,
  "y": 60,
  "width": 200,
  "height": 200,
  "loop": true,
  "autoplay": true,
  "speed": 1
}
```

`speed` is clamped to `0.1`–`4`. The exported preview image renders the first
frame; the launcher renders the live animation.

#### Vector path

A `path` layer draws custom SVG path data as a scalable shape. Author the path
inside a **0–100** coordinate box; it is stretched to the layer rectangle. M, L,
H, V, C, S, Q, T, A and Z commands are supported, and anything outside path
grammar is stripped when the theme loads.

```json
{
  "id": "wave",
  "type": "path",
  "path": "M 0 70 C 20 20 35 95 55 55 C 72 22 86 40 100 10 L 100 100 L 0 100 Z",
  "x": 0,
  "y": 470,
  "width": 700,
  "height": 180,
  "fillMode": "gradient",
  "gradientFrom": "#ff006e",
  "gradientTo": "#7c3aed",
  "gradientAngle": 90,
  "stroke": "#ffffff",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "strokeLinecap": "round"
}
```

Set `stroke` to an empty string for a fill-only path. `strokeStyle` accepts
`solid`, `dashed` or `dotted`, and `strokeLinecap` accepts `butt`, `round` or
`square`.

#### Particles

A particle field animates inside its rectangle without any assets. The presets
cover the most common ambient effects, and the layer respects the system's
reduced-motion setting.

```json
{
  "id": "sparkle-field",
  "type": "particles",
  "preset": "sparkles",
  "x": 520,
  "y": 90,
  "width": 420,
  "height": 360,
  "density": 42,
  "size": 7,
  "speed": 1,
  "color": "#ffe9a8",
  "color2": "#ff006e",
  "wind": 0.2,
  "fade": true
}
```

| Field     | Type    | Notes                                                         |
| --------- | ------- | ------------------------------------------------------------- |
| `preset`  | string  | `sparkles`, `snow`, `petals`, `bubbles`, `embers`, `confetti` |
| `density` | number  | Particle count, `4`–`120`                                     |
| `speed`   | number  | Animation speed multiplier, `0.1`–`3`                         |
| `size`    | number  | Base particle size in stage pixels, `1`–`24`                  |
| `color`   | string  | Primary color                                                 |
| `color2`  | string  | Secondary color; particles alternate between both             |
| `wind`    | number  | Horizontal drift, `-1` (left) to `1` (right)                  |
| `fade`    | boolean | Fade particles at the top and bottom edges (default `true`)   |

#### Clock

A clock layer shows the viewer's local time, either as text or as an analog
dial. It ticks once per second while it is visible.

```json
{
  "id": "local-time",
  "type": "clock",
  "mode": "digital",
  "x": 40,
  "y": 500,
  "width": 300,
  "height": 110,
  "hour12": false,
  "showSeconds": true,
  "showDate": true,
  "label": "Local time",
  "fontFamily": "Sora Variable",
  "fontSize": 42,
  "fontWeight": 700,
  "color": "#ffffff",
  "accentColor": "#ff006e",
  "align": "center"
}
```

`mode` is `digital` or `analog`. `hour12`, `showSeconds` and `showDate` affect the
digital clock; the analog dial always uses local hours and shows the second hand
unless `showSeconds` is `false`. `accentColor` colors the second hand, dial
details and the date.

#### Countdown

A countdown layer ticks towards an ISO date-time using a template. It shares the
clock tick and needs no logic rule.

```json
{
  "id": "release",
  "type": "countdown",
  "target": "2027-01-01T00:00:00Z",
  "text": "{days}d {hours}h {minutes}m {seconds}s",
  "finishedText": "Happy new year!",
  "x": 60,
  "y": 420,
  "width": 380,
  "height": 80,
  "fontSize": 34,
  "color": "#ffffff",
  "align": "left"
}
```

The template supports `{days}`, `{hours}`, `{minutes}` and `{seconds}`. Hours,
minutes and seconds are zero-padded. Once the target passes, `finishedText` is
shown instead. An empty or invalid `target` displays zeroes.

#### Button

A button layer is a real launcher control. It receives clicks even though the
rest of the layer stack is pointer-transparent, and it is above the built-in UI.

```json
{
  "id": "open-themes",
  "type": "button",
  "label": "Browse themes",
  "icon": "themes",
  "x": 360,
  "y": 480,
  "width": 240,
  "height": 52,
  "action": { "type": "navigate", "screen": "themes" },
  "background": "#ff006e",
  "color": "#ffffff",
  "hoverBackground": "#ff4d94",
  "radius": 12
}
```

`action` is one of:

| Action     | Shape                                      |
| ---------- | ------------------------------------------ |
| `navigate` | `{ "type": "navigate", "screen": "home" }` |
| `launch`   | `{ "type": "launch" }`                     |
| `url`      | `{ "type": "url", "url": "https://…" }`    |

External URLs always open through the launcher's confirmation dialog, which shows
the full address first. A `url` action must use `http` or `https`; the theme check
reports anything else as an error.

#### Custom Svelte layer

A `svelte` layer is a self-contained Svelte 5 component compiled by the launcher at
runtime. It fills the layer rectangle and can render any markup, SVG or canvas
content, use runes, and import from Svelte's runtime modules.

```json
{
  "id": "welcome",
  "type": "svelte",
  "x": 360,
  "y": 200,
  "width": 360,
  "height": 190,
  "interactive": true,
  "source": "<script>\n  let { variables = {}, asset } = $props();\n</script>\n\n<div class=\"card\">Score: {variables.score}</div>\n\n<style>\n  .card { height: 100%; color: white; }\n</style>\n"
}
```

The component receives these reactive props:

| Prop        | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `variables` | Live theme variable values. Logic rule changes update the component.    |
| `screen`    | The current launcher screen (custom layers render on Home today).       |
| `layer`     | `{ id, name, width, height }` for this layer.                           |
| `theme`     | `{ name, author, accentColor }`.                                        |
| `asset`     | `asset('image.png')` resolves a file inside the theme `assets/` folder. |

```svelte
<script>
  let { variables = {}, asset } = $props();
  const logo = $derived(asset('logo.png'));
</script>

<img src={logo} alt="" /><p>Score: {variables.score ?? 0}</p>
```

The editor provides a Monaco source pane with Svelte/JavaScript highlighting,
completions for props, runes and theme variables, and inline compiler errors. The
source is **plain JavaScript**; TypeScript in `<script lang="ts">` is not
preprocessed. Imports are limited to Svelte's runtime (`svelte`, `svelte/store`,
`svelte/transition`, `svelte/easing`, `svelte/motion`, `svelte/animate`,
`svelte/reactivity` and `svelte/legacy`). Dynamic `import()` and `import.meta` are
not available.

> **Security:** a Svelte layer is executable theme code. It can read the launcher
> DOM and call APIs available to the page, so only run themes from authors you
> trust. The launcher asks for confirmation before activating or opening the editor
> for any API 2.0 theme that contains a Svelte layer, just like an API 1.0 theme
> bundle. The editor shows a warning in the layer inspector as a reminder.

### Groups and filters

`groups` are optional layer groups for the layer list. Assign a layer to a group with
`groupId`; groups can nest through `parentId`:

```json
"groups": [
  {
    "id": "branding",
    "name": "Branding",
    "collapsed": false,
    "opacity": 1,
    "hidden": false,
    "locked": false,
    "offsetX": 12,
    "offsetY": -8,
    "scaleX": 1.1,
    "scaleY": 1.1,
    "rotation": 0,
    "skewX": 0,
    "skewY": 0,
    "flipX": false,
    "flipY": false,
    "filters": { "brightness": 1.1, "saturate": 1.2 }
  },
  { "id": "branding_badge", "name": "Badge", "parentId": "branding" }
]
```

| Field        | Type    | Notes                                                  |
| ------------ | ------- | ------------------------------------------------------ |
| `id`         | string  | Unique within the theme                                |
| `name`       | string? | Group label in the editor                              |
| `parentId`   | string? | Parent group for nested groups                         |
| `hidden`     | boolean | Hides every layer inside the group                     |
| `locked`     | boolean | Prevents dragging, resizing and transforming the group |
| `collapsed`  | boolean | Folds the group in the editor; ignored by the launcher |
| `opacity`    | number  | `0`–`1`, multiplied with the layer opacity             |
| `offsetX`    | number  | Horizontal translation in stage pixels, `-2000`–`2000` |
| `offsetY`    | number  | Vertical translation in stage pixels, `-2000`–`2000`   |
| `scale`      | number  | Legacy uniform scale fallback, `0.05`–`10`             |
| `scaleX`     | number  | Horizontal scale, `0.05`–`10`                          |
| `scaleY`     | number  | Vertical scale, `0.05`–`10`                            |
| `rotation`   | number  | Degrees around the group's bounds, `-360`–`360`        |
| `skewX`      | number  | Horizontal skew in degrees, `-89`–`89`                 |
| `skewY`      | number  | Vertical skew in degrees, `-89`–`89`                   |
| `flipX`      | boolean | Mirror the group horizontally                          |
| `flipY`      | boolean | Mirror the group vertically                            |
| `filters`    | object? | Filters applied to the whole group                     |
| `mask`       | object? | Shape or image clip; see **Masks**                     |
| `cssClasses` | string? | Classes inherited by every layer in the group          |

#### Masks

Layers and groups can be clipped by a shape or by an image's alpha channel:

```json
"mask": {
  "shape": "polygon",
  "sides": 6,
  "radius": 0,
  "innerRadius": 0.5,
  "src": "mask.png",
  "fit": "cover"
}
```

| Shape       | Behavior                                                  |
| ----------- | --------------------------------------------------------- |
| `rectangle` | Rounded rectangle; `radius` in pixels                     |
| `ellipse`   | Inscribed ellipse                                         |
| `polygon`   | Regular polygon with `sides` (`3`–`24`)                   |
| `star`      | Star with `sides` points and `innerRadius` (`0.1`–`0.95`) |
| `image`     | Alpha mask from `src`; `fit` is `cover` or `contain`      |

A group mask clips every layer in the group and follows the group's transform. A
layer mask clips only that layer; selection outlines in the editor stay outside
the mask so the layer remains easy to move. Image masks need an actual alpha
channel; opaque PNG or JPEG files clip the layer away completely.

Both groups and layers accept the same `filters` object:

```json
"filters": {
  "blur": 4,
  "brightness": 1.1,
  "contrast": 1.05,
  "saturate": 1.2,
  "hueRotate": 12,
  "grayscale": 0.2,
  "sepia": 0,
  "invert": 0
}
```

| Field        | Default | Range    | Notes      |
| ------------ | ------- | -------- | ---------- |
| `blur`       | `0`     | 0–40     | Pixels     |
| `brightness` | `1`     | 0–3      | Multiplier |
| `contrast`   | `1`     | 0–3      | Multiplier |
| `saturate`   | `1`     | 0–4      | Multiplier |
| `hueRotate`  | `0`     | -360–360 | Degrees    |
| `grayscale`  | `0`     | 0–1      |            |
| `sepia`      | `0`     | 0–1      |            |
| `invert`     | `0`     | 0–1      |            |

Filters compose down the tree: a layer's own filters run first, followed by its
group, then outer groups. Group opacity multiplies the same way. Group transforms
are anchored to the bounds of the layers inside the group and compose through
nested groups. A layer's own `rotation`, `skewX`, `skewY`, `scaleX`, `scaleY`,
`flipX` and `flipY` apply before its ancestor groups' transforms. Themes can
contain up to 50 groups; nesting is limited only by that count.

The full 2D transform set is supported: translate, rotate, independent X/Y scale
and skew. Layers use `x`/`y` for translation and groups use `offsetX`/`offsetY`
(shown as **Translate** in the editor). The remaining transforms compose in CSS
order: rotate, skew, then scale and flips, around the layer or group bounds
centre. `scaleX` and `scaleY` take precedence over the legacy uniform `scale`
field; when they are absent, `scale` is used for both axes. Raw `matrix()`,
`matrix3d()` and 3D transforms such as `perspective` and `rotateX`/`rotateY` are
not exposed because the editor's hit-testing and group handles use an invertible
2D matrix.

In the editor, hover any layer on the canvas to reveal its group outline and a
breadcrumb of the group path from the outermost group to the innermost one.
Click any crumb to select that group, including an outer ancestor. You can also
double-click the layer or use **Select parent group** in its context menu. The
group frame has a center label for moving, corner handles for proportional scaling
and a top handle for rotation. A selected single layer gets a top rotate handle of
its own; rotating a layer inside a group respects the group's transform. Hold `Alt`
while moving to skip snapping and `Shift` while rotating or scaling to snap to 15°
or 5% steps. Group handles are hidden while the group is locked.

### Theme logic

API 2.0 themes can include declarative interaction rules. Think of them as
Scratch-style **WHEN / IF / THEN** blocks: no JavaScript is executed, and the
editor can show exactly what a rule will do. Rules can also opt into a safe
advanced script with expressions, branches and loops; see **Advanced scripts**
below.

```json
"behaviors": [
  {
    "id": "open_themes",
    "name": "Open themes",
    "enabled": true,
    "once": true,
    "target": { "type": "element", "id": "themes_button" },
    "trigger": { "type": "click", "elementId": "themes_button" },
    "conditionMode": "all",
    "conditions": [
      { "type": "variable", "variable": "opened", "operator": "equals", "value": 0 }
    ],
    "actions": [
      { "type": "setVariable", "variable": "opened", "value": 1 },
      { "type": "navigate", "screen": "themes" }
    ]
  }
]
```

A layer only receives pointer events when it sets `"interactive": true`. Use the
**Interactive** toggle in the layer inspector, then pick that layer in a click or
hover trigger.

`target` is optional and links a rule to a layer or group:

```json
"target": { "type": "group", "id": "home_actions" }
```

Linked rules appear directly in that layer or group inspector, where they can be
viewed, added and edited without leaving the tab. For `click`, `hover` and `leave`
triggers, a group target matches any interactive layer inside the group (including
nested groups); an element target matches only that layer. `load`, `screen` and
`timer` triggers are theme-wide regardless of the link.

| Trigger  | Fields               | When it runs                                                       |
| -------- | -------------------- | ------------------------------------------------------------------ |
| `load`   | —                    | The theme becomes active                                           |
| `screen` | `screen`             | The launcher switches to `home`, `themes`, `settings` or `login`   |
| `click`  | `elementId`?         | An interactive layer (or a layer inside a linked group) is clicked |
| `hover`  | `elementId`?         | The pointer enters an interactive layer or linked group            |
| `leave`  | `elementId`?         | The pointer leaves an interactive layer or linked group            |
| `timer`  | `interval` (seconds) | Repeatedly, with a minimum of 0.5 seconds                          |

Conditions can be combined with `conditionMode: "all"` (default) or `"any"`.
An empty condition list always matches.

| Condition      | Fields                          | Checks                                                                                                        |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `variable`     | `variable`, `operator`, `value` | Compares a variable using `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterOrEqual` or `lessOrEqual` |
| `visible`      | `elementId`, `value`            | Whether a layer is currently visible                                                                          |
| `groupVisible` | `groupId`, `value`              | Whether a group is currently visible                                                                          |
| `screen`       | `screen`                        | The current launcher screen                                                                                   |
| `chance`       | `percent`                       | A random roll from 0–100                                                                                      |

| Action                                          | Fields               | Effect                                                    |
| ----------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `setVariable`                                   | `variable`, `value`  | Stores a string, number or boolean                        |
| `changeVariable`                                | `variable`, `amount` | Adds a number to a variable                               |
| `toggleVariable`                                | `variable`           | Flips a boolean                                           |
| `showElement` / `hideElement` / `toggleElement` | `elementId`          | Overrides a layer's visible state                         |
| `showGroup` / `hideGroup` / `toggleGroup`       | `groupId`            | Overrides a group's visibility, including its descendants |
| `navigate`                                      | `screen`             | Switches the launcher to a screen                         |
| `launch`                                        | —                    | Starts the normal osu! launch flow from a click           |
| `openUrl`                                       | `url`                | Asks first, then opens an `http`/`https` URL from a click |

A group-level hide wins over its children. A group-level show reveals the group,
including descendants that are hidden in the theme data. Element visibility and
nested-group overrides still take priority over a group show.

Rules are evaluated in array order and every matching rule runs. Use conditions
and `once: true` to gate rules. Rules are limited to 100 per theme, 12 conditions
per rule and 20 actions per rule. Variables are scoped to the active theme
session, start at `0`, and are reset when the theme changes. `once: true` stops a
rule after it matches once.

Rules run in the launcher, not in the editor preview. Use **Save theme** and
then test the saved theme in the launcher. `launch` and `openUrl` are deliberately
restricted to `click` triggers so loading, timers or screen changes cannot leave
the launcher unexpectedly. Before opening an external URL, the launcher shows a
blocking confirmation dialog with the full destination; links never open on their
own.

### Advanced scripts

Every rule can use an advanced script instead of its builder actions. Set `script`
to a string; when the field is present, it replaces `actions` for that rule.
The builder actions stay in `theme.json` so switching back in the editor restores
them.

```json
"behaviors": [
  {
    "id": "advanced_click",
    "trigger": { "type": "click", "elementId": "button" },
    "actions": [],
    "script": "clicks += 1;\nif (clicks >= 3) {\n  showLayer(\"secret\");\n} else {\n  hideLayer(\"secret\");\n}"
  }
]
```

Scripts use **plain JavaScript syntax**, but they are never passed to `eval`.
The launcher parses each script into a small, safe instruction set and runs only
that subset. There is no DOM, browser API, network access, import or `eval`, and
unsupported syntax is reported as an error in the editor. The earlier keyword
syntax (`set`, `show layer`, `repeat`) is no longer accepted.

Supported statements:

| JavaScript                                 | Effect                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `let name = expression;` / `const` / `var` | Stores a number, string or boolean                   |
| `name = expression;`                       | Assigns a value                                      |
| `name += 1;`, `-=`, `*=`, `/=`, `%=`       | Updates a number                                     |
| `name++;`, `name--;`                       | Increments or decrements                             |
| `showLayer("id");`                         | Shows a layer                                        |
| `hideLayer("id");`                         | Hides a layer                                        |
| `toggleLayer("id");`                       | Flips a layer's visibility                           |
| `showGroup("id");`                         | Shows a group and its descendants                    |
| `hideGroup("id");`                         | Hides a group and its descendants                    |
| `toggleGroup("id");`                       | Flips a group's visibility                           |
| `if (expression) { ... }`                  | Runs a block when the expression is truthy           |
| `if (...) { ... } else { ... }`            | Adds an else branch, including `else if`             |
| `for (let i = 0; i < 3; i++) { ... }`      | Runs a bounded loop                                  |
| `while (expression) { ... }`               | Runs a bounded loop                                  |
| `goTo("themes");`                          | Navigates to `home`, `themes`, `settings` or `login` |
| `openUrl("https://...");`                  | Opens an `http`/`https` URL from a click             |
| `launch();`                                | Starts the normal osu! launch flow from a click      |
| `stop();`                                  | Ends the current script immediately                  |

Comments use `//` or `/* ... */`. Semicolons are optional, but one statement
per line is easiest to read.

Expressions support numbers, strings, template literals, `true`, `false`,
variables, `screen` (the current screen name), read-only clock values (`time`,
`time12`, `timeSeconds`, `hour`, `minute`, `second`, `dayPeriod`), `+ - * / %`,
`== != < <= > >=` (`===` and `!==` also work), `&& || !`, the ternary
`condition ? a : b`, and parentheses. `Math.min`, `Math.max`, `Math.round`,
`Math.floor`, `Math.ceil`, `Math.abs` and `Math.random` are available; the
shorthand `min()`, `max()`, `round()` and the other built-ins below work too.

Not supported: functions, classes, arrays, objects, destructuring, `switch`,
`try`/`catch`, `do...while`, `break`/`continue`, `async`, imports, `this`,
regular expressions and BigInt. Assignments must be their own statement; they
cannot appear inside an expression.

Built-in functions:

| Function                                                    | Result                                     |
| ----------------------------------------------------------- | ------------------------------------------ |
| `min(a, b, …)` / `max(a, b, …)`                             | Smallest or largest number                 |
| `clamp(value, min, max)`                                    | Clamps a number to a range                 |
| `round(value)`, `floor(value)`, `ceil(value)`, `abs(value)` | Numeric helpers                            |
| `random()`                                                  | A random number from 0 to 1                |
| `chance(percent)`                                           | A random boolean with the given percentage |
| `visible("elementId")`                                      | Whether a layer is currently visible       |
| `groupVisible("groupId")`                                   | Whether a group is currently visible       |
| `contains(text, search)`                                    | Whether text contains a substring          |
| `length(text)`                                              | String length                              |
| `number(value)`, `string(value)`, `boolean(value)`          | Explicit conversions                       |

Scripts have a 20,000 character limit, loops are capped at 1,000 iterations and
each trigger is limited to 10,000 executed statements. `launch()` and
`openUrl()` still only run from explicit click triggers. Use a **timer** trigger
instead of waiting inside a script. Variables changed by a script can be shown
in any text layer with a `{name}` placeholder, for example `Clicks: {clicks}`.

### Custom CSS

The `css` field is appended while the theme is active. Theme authors can use it for
small tweaks, but it is not required. The advanced editor applies it live to the
canvas, with selectors scoped to the 1000 × 650 preview so the editor window itself
keeps its own styling. Example:

```css
:root {
  --radius: 1rem;
}
```

Layers and groups can expose stable hooks through `cssClasses`:

```json
{ "id": "hero", "type": "text", "cssClasses": "hero-title glow", "text": "Welcome" }
```

```css
.hero-title {
  letter-spacing: 0.04em;
}

.hero-title.glow {
  text-shadow: 0 0 24px #ffd37a;
}
```

A group's classes are applied to every layer inside it, including nested groups.
Class names are space-separated and limited to letters, numbers, `_`, `-` and a
leading `-`; up to 20 classes per layer or group. Use the **CSS classes** section
in the layer or group inspector to edit them.

---

## Using the advanced editor

1. Open **Themes** in the launcher.
2. Select **Create theme**, or the pencil button on an installed API 2.0 theme.
3. The editor opens in its **own resizable window**, not a modal. The center is a
   full launcher home canvas at 1000 × 650.
4. Use the **+ Add** menu above the layer list to add text, image, video and shape layers. Drag layers on
   the canvas, resize with the corner handles, or edit exact values in the right
   inspector. Shift/Cmd-click a layer or drag a marquee over empty canvas to
   select several layers. Multi-selections can be dragged together and aligned
   or distributed from the right panel. Layers snap to canvas edges, the canvas
   center, and other layers while dragging; hold Alt to disable snapping.
   Right-click a layer for copy, cut, paste, duplicate, group, ordering,
   hide/lock and delete actions, or right-click empty canvas to add or paste a
   layer.
5. The layer list supports double-click rename, hide/show, lock/unlock and
   drag-and-drop. Drag a layer by its grip handle: drop it between two layers
   to reorder it and adopt that row's group, drop it onto a group to move it
   inside, or drop it in the **move out of all groups** zone to return it to
   the root. Groups are draggable too, so nested groups can be moved into or
   out of other groups. Select several layers and choose **Group selection**.
   Groups can be collapsed, hidden, locked and renamed; right-click a group to
   copy, cut, paste into it, or use its other quick actions. Hidden layers remain in the package, while
   locked layers cannot be moved or resized on the canvas. Select a layer or a
   group to edit its **Filters** (blur, brightness, contrast, saturation, hue,
   grayscale, sepia and invert) in the right inspector. Group filters and
   opacity apply to every layer inside. The **Transform** section provides
   translate, independent X/Y scale, rotation, X/Y skew and flips for both
   layers and groups. Group transforms are anchored to the bounds of their
   layers. Text layers also expose bold, italic, underline, strikethrough, case,
   gradient fill, outline and shadow controls in the inspector.
6. Use the **Theme** tab for metadata, background, effects, typography, icon set
   and custom CSS. Open the **Fonts** tab to search and download from every Fontsource
   family, or import WOFF2, WOFF, TTF and OTF files. Downloaded fonts are copied
   into the theme's `assets/` folder when you save.
7. Open the **Logic** tab to add WHEN / IF / THEN rules and search them by name or
   target. Mark the layers that should react to the pointer as **Interactive**,
   then pick them in a click, hover or leave trigger. Link a rule to a layer or
   group with **Linked to**; linked rules also appear in that layer or group
   inspector with an inline editor and an **Add rule** shortcut. In **Then**, use
   the **Builder / Script** switch for a safe advanced script with expressions,
   `if/else`, `repeat`, variables and all the normal actions. The script opens in
   a Monaco editor with line numbers, syntax highlighting, variable/layer/group
   completion, hover documentation and inline error markers. Use the expand
   button for a fullscreen editor. Logic badges in the layer list open the linked
   editor, and the arrows above the list
   (or `Alt/Option+ArrowUp/Down`) jump between layers and groups that have rules.
   Rules run in the launcher, so save the theme before testing them.
8. Select **Save theme** to write `theme.json` and copy new assets into
   `~/.ezpplauncher/themes`. A fresh `assets/preview.png` thumbnail is rendered
   from the theme and the launcher applies the saved theme immediately. Unsaved
   edits are autosaved as a local draft and offered for recovery after a crash.
9. Select **Export** to create a shareable `.ezpplauncher-theme` package. A theme
   check runs first and reports missing assets, oversized media, missing fonts
   and unused imports. Export saves and refreshes the preview, then reports the
   final package size.

Keyboard shortcuts:

- `Cmd/Ctrl+Z` undoes the last change.
- `Cmd/Ctrl+Shift+Z` or `Ctrl+Y` redoes it.
- `Cmd/Ctrl+S` saves.
- `Cmd/Ctrl+C`, `Cmd/Ctrl+X` and `Cmd/Ctrl+V` copy, cut and paste the selected
  layer(s) or group. Pasting a group keeps its nested groups, layers and filters.
- `Cmd/Ctrl+D` duplicates the selected layer or multi-selection.
- `Cmd/Ctrl+G` groups the selected layers, or ungroups the selected group.
- `Cmd/Ctrl+A` selects every visible layer.
- Shift/Cmd-click toggles a layer in the current selection.
- Arrow keys nudge the selected layer(s) by 1 px; hold Shift for 10 px.
- `Alt/Option+ArrowDown` and `Alt/Option+ArrowUp` jump to the next or previous
  layer or group with linked logic, expanding its inspector section.
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
  audio, fonts, media layers and preview). Asset paths mentioned by custom Svelte
  layers through `asset('...')` are kept as well. Orphaned files left in the folder
  are omitted, which keeps packages small. API 1.0 themes are exported whole
  because their bundles can load files dynamically.
- The editor writes `preview.png` whenever you save or export. The generated
  thumbnail renders the background, effects, launcher UI, theme fonts,
  freeform layers, group visibility/opacity and filters; custom CSS is applied to
  the **live editor canvas** but not to the generated thumbnail.
- The theme editor only writes inside `~/.ezpplauncher/themes`.
- API 1.0 themes are still loaded through their existing `mountTheme` bundle API.
- Advanced scripts use JavaScript syntax but never run as JavaScript. Theme logic
  is compiled into the same restricted instruction set as the declarative
  triggers, conditions and actions above. There is no `eval`, DOM access or
  network API; `launch()` and `openUrl()` only run from explicit click triggers,
  and external URLs require a second confirmation in the launcher.
- Custom Svelte layers are the exception: they are real JavaScript and are not
  sandboxed. They require a trust confirmation before activation. Keep the source
  self-contained and use `asset()` for packaged files so exports can keep the
  right assets.
- Older launchers ignore unknown fields such as `behaviors`, so a theme with
  logic still loads, but its rules will not run until the launcher is updated.
- Freeform layers are home-screen-only and pointer-transparent by default. Marking
  a layer `interactive` opts it into logic clicks/hovers; it still cannot add
  arbitrary controls or execute code.
