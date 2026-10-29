/**
 * Declarative theme API 2.0.
 *
 * Version 1 themes are JavaScript bundles that mount their own UI. Version 2
 * themes describe their look with data instead, which lets the launcher render
 * them consistently and lets the built-in editor create them without shipping
 * any code. A v2 theme package is a zip containing `theme.json` and an
 * `assets/` folder.
 */

export type ThemeV2BackgroundType = 'color' | 'gradient' | 'image' | 'video';

export type ThemeV2Background =
  | {
      type: 'color';
      color: string;
      opacity?: number;
    }
  | {
      type: 'gradient';
      from: string;
      to: string;
      angle?: number;
      opacity?: number;
    }
  | {
      type: 'image';
      src: string;
      fit?: 'cover' | 'contain';
      opacity?: number;
      blur?: number;
    }
  | {
      type: 'video';
      src: string;
      fit?: 'cover' | 'contain';
      opacity?: number;
      blur?: number;
      /** Defaults to true so autoplay works without user interaction. */
      muted?: boolean;
    };

export type ThemeV2EffectType = 'none' | 'snow' | 'stars' | 'petals' | 'bubbles';

export type ThemeV2Effects = {
  type: ThemeV2EffectType;
  density?: number;
  speed?: number;
  color?: string;
};

export type ThemeV2Overlay = {
  color?: string;
  opacity?: number;
  vignette?: number;
};

export type ThemeV2Audio = {
  src: string;
  loop?: boolean;
};

export type ThemeV2Font = {
  /** The family name used by elements and the typography settings. */
  family: string;
  /** Font file relative to the theme's assets folder. */
  src: string;
  weight?: string;
  style?: 'normal' | 'italic';
};

export type ThemeV2Typography = {
  /** Font used by the launcher's normal UI text. */
  body?: string;
  /** Font used by headings such as the launcher title. */
  heading?: string;
};

export type ThemeV2ElementAlign = 'left' | 'center' | 'right';
export type ThemeV2ElementVerticalAlign = 'top' | 'center' | 'bottom';

export type ThemeV2ElementBase = {
  id: string;
  /** Optional editor-facing name; does not affect rendering. */
  name?: string;
  /** Stage coordinates: the launcher canvas is 1000 x 650. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  /** Hidden layers stay in the package but are not rendered. */
  hidden?: boolean;
  /** Locked layers can be selected in the layer list but not dragged on canvas. */
  locked?: boolean;
};

export type ThemeV2TextElement = ThemeV2ElementBase & {
  type: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: ThemeV2ElementAlign;
  verticalAlign?: ThemeV2ElementVerticalAlign;
  lineHeight?: number;
  letterSpacing?: number;
};

export type ThemeV2ImageElement = ThemeV2ElementBase & {
  type: 'image';
  src: string;
  fit?: 'cover' | 'contain';
  radius?: number;
};

export type ThemeV2VideoElement = ThemeV2ElementBase & {
  type: 'video';
  src: string;
  fit?: 'cover' | 'contain';
  radius?: number;
  /** Defaults to true so autoplay works without user interaction. */
  muted?: boolean;
};

export type ThemeV2ShapeElement = ThemeV2ElementBase & {
  type: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line';
  fill?: string;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
};

export type ThemeV2Element =
  | ThemeV2TextElement
  | ThemeV2ImageElement
  | ThemeV2VideoElement
  | ThemeV2ShapeElement;

export type ThemeV2Definition = {
  name: string;
  version: string;
  apiVersion: '2.0';
  author: string;
  description?: string;
  /** Marks the theme as adult content in the theme manager. */
  nsfw?: boolean;
  /** Optional preview image, relative to the theme's assets folder. */
  preview?: string;
  background: ThemeV2Background;
  overlay: ThemeV2Overlay;
  effects: ThemeV2Effects;
  audio?: ThemeV2Audio;
  /** Theme-wide fonts and freeform layers rendered over the launcher UI. */
  typography: ThemeV2Typography;
  fonts: ThemeV2Font[];
  elements: ThemeV2Element[];
  /** Used for focus rings, active states and effect accents. */
  accentColor?: string;
  /** Optional CSS appended after the launcher's own styles. */
  css?: string;
};

export type ThemeV2Asset = {
  name: string;
  source: string;
};

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const color = (value: unknown, fallback: string) => {
  const result = text(value, fallback);
  return /^#(?:[0-9a-f]{3,8})$/i.test(result) ? result : fallback;
};

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const clampInteger = (value: unknown, fallback: number, min: number, max: number) =>
  Math.round(clamp(value, fallback, min, max));

const fontFamilyCss = (family: string) => `"${family.replace(/["\\]/g, '\\$&')}"`;

const fontFormat = (src: string) => {
  const extension = src.split('.').pop()?.toLowerCase();
  if (extension === 'woff2') return 'woff2';
  if (extension === 'woff') return 'woff';
  if (extension === 'otf') return 'opentype';
  if (extension === 'ttf') return 'truetype';
  return 'woff2';
};

const normalizeFonts = (raw: unknown): ThemeV2Font[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const fonts: ThemeV2Font[] = [];
  for (const candidate of raw.slice(0, 48)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const source = candidate as Record<string, unknown>;
    const family = text(source.family).slice(0, 80);
    const src = text(source.src).slice(0, 260);
    const weight =
      text(typeof source.weight === 'number' ? String(source.weight) : source.weight, '400')
        .replace(/[^0-9,\s]/g, '')
        .slice(0, 40) || '400';
    const style = source.style === 'italic' ? 'italic' : 'normal';
    const key = `${family}|${weight}|${style}|${src}`;
    if (!family || !src || seen.has(key)) continue;
    seen.add(key);
    fonts.push({ family, src, weight, style });
  }
  return fonts;
};

const normalizeElement = (raw: unknown, index: number): ThemeV2Element | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(source.type, ['text', 'image', 'video', 'shape'] as const, 'text');
  const base = {
    id: text(source.id, `element_${index + 1}`).slice(0, 64),
    name: typeof source.name === 'string' ? source.name.slice(0, 80) : undefined,
    x: clamp(source.x, 0, 0, 1000),
    y: clamp(source.y, 0, 0, 650),
    width: clamp(source.width, 320, 24, 1000),
    height: clamp(source.height, 120, 24, 650),
    rotation: clamp(source.rotation, 0, -360, 360),
    opacity: clamp(source.opacity, 1, 0, 1),
    hidden: source.hidden === true,
    locked: source.locked === true,
  };

  if (type === 'text') {
    return {
      ...base,
      type,
      text: typeof source.text === 'string' ? source.text.slice(0, 2000) : 'Your text',
      fontFamily: text(source.fontFamily, 'Sora Variable'),
      fontSize: clamp(source.fontSize, 28, 6, 240),
      fontWeight: clampInteger(source.fontWeight, 600, 100, 900),
      color: color(source.color, '#ffffff'),
      align: oneOf(source.align, ['left', 'center', 'right'] as const, 'left'),
      verticalAlign: oneOf(source.verticalAlign, ['top', 'center', 'bottom'] as const, 'top'),
      lineHeight: clamp(source.lineHeight, 1.2, 0.7, 3),
      letterSpacing: clamp(source.letterSpacing, 0, -20, 40),
    };
  }

  if (type === 'shape') {
    return {
      ...base,
      type,
      shape: oneOf(source.shape, ['rectangle', 'ellipse', 'line'] as const, 'rectangle'),
      fill: color(source.fill, '#ff006e'),
      radius: clamp(source.radius, 16, 0, 999),
      borderWidth: clamp(source.borderWidth, 0, 0, 40),
      borderColor: color(source.borderColor, '#ffffff'),
    };
  }

  const src = text(source.src).slice(0, 500);
  if (!src) return undefined;
  return {
    ...base,
    type,
    src,
    fit: source.fit === 'contain' ? 'contain' : 'cover',
    radius: clamp(source.radius, 0, 0, 999),
    ...(type === 'video' ? { muted: source.muted !== false } : {}),
  };
};

const normalizeElements = (raw: unknown): ThemeV2Element[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const elements: ThemeV2Element[] = [];
  raw.slice(0, 100).forEach((candidate, index) => {
    const element = normalizeElement(candidate, index);
    if (!element) return;
    let id = element.id;
    let suffix = 2;
    while (seen.has(id)) id = `${element.id}_${suffix++}`;
    seen.add(id);
    elements.push({ ...element, id });
  });
  return elements;
};

/** Create a sensible element for the advanced editor's add buttons. */
export const createThemeV2Element = (type: ThemeV2Element['type'], index = 0): ThemeV2Element => {
  const id = `element_${Date.now().toString(36)}_${index}`;
  const base = { id, x: 340, y: 250, width: 320, height: 120 };
  if (type === 'image') {
    return normalizeElement(
      { ...base, type, src: 'placeholder.png' },
      index
    )! as ThemeV2ImageElement;
  }
  if (type === 'video') {
    return normalizeElement(
      { ...base, type, src: 'placeholder.webm' },
      index
    )! as ThemeV2VideoElement;
  }
  if (type === 'shape') {
    return normalizeElement(
      { ...base, type, shape: 'rectangle', width: 220, height: 120 },
      index
    )! as ThemeV2ShapeElement;
  }
  return normalizeElement(
    { ...base, type, text: 'Your text', fontSize: 40, width: 420, height: 90 },
    index
  )! as ThemeV2TextElement;
};

export const isThemeV2 = (apiVersion: unknown) =>
  typeof apiVersion === 'string' && apiVersion.split('.')[0] === '2';

export const createDefaultThemeV2 = (): ThemeV2Definition => ({
  name: 'Untitled theme',
  version: '1.0.0',
  apiVersion: '2.0',
  author: '',
  description: '',
  nsfw: false,
  background: {
    type: 'gradient',
    from: '#181825',
    to: '#3b1d4f',
    angle: 135,
    opacity: 1,
  },
  overlay: {
    color: '#000000',
    opacity: 0.2,
    vignette: 0.35,
  },
  effects: {
    type: 'none',
    density: 30,
    speed: 1,
    color: '#ffffff',
  },
  typography: {
    body: 'Sora Variable',
    heading: 'Sora Variable',
  },
  fonts: [],
  elements: [],
  accentColor: '#ff006e',
  css: '',
});

/** Coerce a theme.json payload into the supported v2 shape. */
export const normalizeThemeV2 = (raw: Partial<ThemeV2Definition>): ThemeV2Definition => {
  const defaults = createDefaultThemeV2();
  const sourceBackground = (raw.background ?? {}) as Record<string, unknown>;
  const backgroundType = ['color', 'gradient', 'image', 'video'].includes(
    String(sourceBackground.type)
  )
    ? (String(sourceBackground.type) as ThemeV2BackgroundType)
    : 'gradient';

  let background: ThemeV2Background;
  switch (backgroundType) {
    case 'color':
      background = {
        type: 'color',
        color: color(sourceBackground.color, '#181825'),
        opacity: clamp(sourceBackground.opacity, 1, 0, 1),
      };
      break;
    case 'image':
      background = {
        type: 'image',
        src: text(sourceBackground.src),
        fit: sourceBackground.fit === 'contain' ? 'contain' : 'cover',
        opacity: clamp(sourceBackground.opacity, 1, 0, 1),
        blur: clamp(sourceBackground.blur, 0, 0, 40),
      };
      break;
    case 'video':
      background = {
        type: 'video',
        src: text(sourceBackground.src),
        fit: sourceBackground.fit === 'contain' ? 'contain' : 'cover',
        opacity: clamp(sourceBackground.opacity, 1, 0, 1),
        blur: clamp(sourceBackground.blur, 0, 0, 40),
        muted: sourceBackground.muted !== false,
      };
      break;
    default:
      background = {
        type: 'gradient',
        from: color(
          sourceBackground.from,
          defaults.background.type === 'gradient' ? defaults.background.from : '#181825'
        ),
        to: color(sourceBackground.to, '#3b1d4f'),
        angle: clamp(sourceBackground.angle, 135, 0, 360),
        opacity: clamp(sourceBackground.opacity, 1, 0, 1),
      };
  }

  const sourceEffects = (raw.effects ?? {}) as Record<string, unknown>;
  const effectType = ['none', 'snow', 'stars', 'petals', 'bubbles'].includes(
    String(sourceEffects.type)
  )
    ? (String(sourceEffects.type) as ThemeV2EffectType)
    : 'none';

  const sourceOverlay = (raw.overlay ?? {}) as Record<string, unknown>;
  const sourceAudio = raw.audio as Record<string, unknown> | undefined;
  const sourceTypography = (raw.typography ?? {}) as Record<string, unknown>;
  const bodyFont = text(sourceTypography.body).slice(0, 80);
  const headingFont = text(sourceTypography.heading).slice(0, 80);

  return {
    name: text(raw.name, 'Untitled theme'),
    version: text(raw.version, '1.0.0'),
    apiVersion: '2.0',
    author: text(raw.author, 'Unknown'),
    description: text(raw.description),
    nsfw: raw.nsfw === true,
    preview: text(raw.preview),
    background,
    overlay: {
      color: color(sourceOverlay.color, '#000000'),
      opacity: clamp(sourceOverlay.opacity, 0.2, 0, 1),
      vignette: clamp(sourceOverlay.vignette, 0.35, 0, 1),
    },
    effects: {
      type: effectType,
      density: Math.round(clamp(sourceEffects.density, 30, 0, 120)),
      speed: clamp(sourceEffects.speed, 1, 0.2, 3),
      color: color(sourceEffects.color, '#ffffff'),
    },
    audio:
      sourceAudio && text(sourceAudio.src)
        ? {
            src: text(sourceAudio.src),
            loop: sourceAudio.loop !== false,
          }
        : undefined,
    typography: {
      body: bodyFont || defaults.typography?.body || 'Sora Variable',
      heading: headingFont || bodyFont || defaults.typography?.heading || 'Sora Variable',
    },
    fonts: normalizeFonts(raw.fonts),
    elements: normalizeElements(raw.elements),
    accentColor: color(raw.accentColor, '#ff006e'),
    css: typeof raw.css === 'string' ? raw.css : '',
  };
};

/** Resolve a path inside a theme package to an asset URL. */
export const themeAssetUrl = (base: string, path: string | undefined) => {
  if (!path) return '';
  if (/^(?:[a-z]+:)?\/\//i.test(path) || /^(?:data|blob|asset):/i.test(path)) return path;
  const relative = path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return base ? `${base.replace(/\/+$/, '')}/${relative}` : relative;
};

/** A CSS background value used for theme cards in the manager. */
export const themeV2ThumbnailStyle = (definition: ThemeV2Definition, assets = '') => {
  const background = definition.background;
  switch (background.type) {
    case 'color':
      return `background-color:${background.color};`;
    case 'image':
      return background.src
        ? `background-image:url("${themeAssetUrl(assets, background.src)}");background-size:cover;background-position:center;`
        : `background-color:#181825;`;
    case 'video':
      return `background:linear-gradient(135deg, ${definition.accentColor ?? '#ff006e'}55, #181825);`;
    default:
      return `background:linear-gradient(${background.angle ?? 135}deg, ${background.from}, ${background.to});`;
  }
};

const channel = (value: string) => parseInt(value, 16) / 255;

const relativeLuminance = (hex: string) => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return 0;
  let value = match[1];
  if (value.length === 3)
    value = value
      .split('')
      .map((part) => part + part)
      .join('');
  const [r, g, b] = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const readableTextColor = (hex: string) =>
  relativeLuminance(hex) > 0.55 ? '#181825' : '#ffffff';

/** @font-face declarations for fonts bundled in a theme package. */
export const themeFontFaceCss = (
  definition: ThemeV2Definition,
  assets = '',
  assetOverrides: Record<string, string> = {}
) =>
  (definition.fonts ?? [])
    .map(
      (font) =>
        `@font-face{font-family:${fontFamilyCss(font.family)};src:url("${
          assetOverrides[font.src] ?? themeAssetUrl(assets, font.src)
        }") format("${fontFormat(font.src)}");font-weight:${font.weight ?? '400'};font-style:${
          font.style ?? 'normal'
        };font-display:swap;}`
    )
    .join('\n');

/** CSS injected while a v2 theme is active. */
export const themeV2Css = (
  definition: ThemeV2Definition,
  assets = '',
  assetOverrides: Record<string, string> = {}
) => {
  const accent = definition.accentColor;
  // `.dark` also defines the primary variables, so the override needs a
  // selector that is at least as specific as `html.dark`.
  const accentCss = accent
    ? `:root,:root.dark,:root.light{--primary:${accent};--primary-foreground:${readableTextColor(accent)};--ring:${accent};--color-primary:${accent};--color-primary-500:${accent};--color-primary-foreground:${readableTextColor(accent)};}`
    : '';
  const body = definition.typography?.body?.trim();
  const heading = definition.typography?.heading?.trim();
  const fontFaces = themeFontFaceCss(definition, assets, assetOverrides);
  const typographyCss = body
    ? `:root,:root.dark{--font-sans:${fontFamilyCss(body)},ui-sans-serif,system-ui,sans-serif;}body{font-family:${fontFamilyCss(body)},ui-sans-serif,system-ui,sans-serif;}`
    : '';
  const headingCss = heading
    ? `:root,:root.dark{--font-heading:${fontFamilyCss(heading)},ui-sans-serif,system-ui,sans-serif;}h1,h2,h3,h4,h5,h6,.theme-heading{font-family:${fontFamilyCss(heading)},ui-sans-serif,system-ui,sans-serif;}`
    : '';
  return [accentCss, fontFaces, typographyCss, headingCss, definition.css?.trim()]
    .filter(Boolean)
    .join('\n');
};

/** A safe, predictable asset filename for the theme editor. */
export const themeAssetName = (sourcePath: string, prefix: string) => {
  const base = sourcePath.split(/[\\/]/).pop() ?? 'asset';
  const dot = base.lastIndexOf('.');
  const extension =
    dot > 0
      ? base
          .slice(dot)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '')
      : '';
  const stem =
    (dot > 0 ? base.slice(0, dot) : base)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || 'asset';
  return `${prefix}_${stem}${extension}`;
};
