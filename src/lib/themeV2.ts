/**
 * Declarative theme API 2.0.
 *
 * Version 1 themes are JavaScript bundles that mount their own UI. Version 2
 * themes describe their look with data instead, which lets the launcher render
 * them consistently and lets the built-in editor create them without shipping
 * any code. A v2 theme package is a zip containing `theme.json` and an
 * `assets/` folder.
 */
import {
  DEFAULT_THEME_ICON_SET,
  isThemeIconName,
  isThemeIconSet,
  type ThemeIconName,
  type ThemeIconSet,
} from './themeIcons';
import { DEFAULT_THEME_SVELTE_SOURCE } from './themeSvelteDefaults';

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
  /**
   * Font used by monospace details such as paths, versions and telemetry.
   * Omit it to keep the launcher's built-in Space Mono stack.
   */
  mono?: string;
};

/** CSS-like filters shared by groups and individual elements. */
export type ThemeV2Filters = {
  /** Pixels, 0-40. */
  blur?: number;
  /** Multiplier, 1 is unchanged. */
  brightness?: number;
  contrast?: number;
  saturate?: number;
  /** Degrees, -360 to 360. */
  hueRotate?: number;
  /** 0-1. */
  grayscale?: number;
  sepia?: number;
  invert?: number;
};

/** 2D CSS transform fields shared by layers and groups. */
export type ThemeV2Transform = {
  /** Degrees around the layer or group bounds centre. */
  rotation?: number;
  /** Legacy uniform scale fallback; `scaleX` and `scaleY` take precedence. */
  scale?: number;
  /** Horizontal scale around the bounds centre; 1 is unchanged. */
  scaleX?: number;
  /** Vertical scale around the bounds centre; 1 is unchanged. */
  scaleY?: number;
  /** Horizontal skew in degrees; 0 is unchanged. */
  skewX?: number;
  /** Vertical skew in degrees; 0 is unchanged. */
  skewY?: number;
  flipX?: boolean;
  flipY?: boolean;
};

/** A group in the layer list. Groups may be nested through `parentId`. */
export type ThemeV2Group = ThemeV2Transform & {
  id: string;
  name?: string;
  parentId?: string;
  hidden?: boolean;
  locked?: boolean;
  /** Editor-only fold state; stored so the group stays folded on reopen. */
  collapsed?: boolean;
  opacity?: number;
  /** Visual translation applied to the whole group in stage pixels. */
  offsetX?: number;
  offsetY?: number;
  filters?: ThemeV2Filters;
  /** Clips every layer in the group to a shape or image alpha. */
  mask?: ThemeV2Mask;
  /** Space-separated CSS classes inherited by every layer in the group. */
  cssClasses?: string;
  /** Smoothly morph text and number changes using torph across layers in this group. */
  morph?: boolean;
  /** Morph animation duration in milliseconds (default 400). */
  morphDuration?: number;
};

/** A shape or image used to clip a layer or group. */
export type ThemeV2MaskShape = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'image';

export type ThemeV2Mask = {
  shape: ThemeV2MaskShape;
  /** Corner radius for rectangle masks. */
  radius?: number;
  /** Sides for polygon masks and points for star masks. */
  sides?: number;
  /** Inner radius of a star mask, as a fraction of the outer radius. */
  innerRadius?: number;
  /** Asset used for image masks; its alpha channel clips the layer. */
  src?: string;
  fit?: 'cover' | 'contain';
};

export type ThemeV2ElementAlign = 'left' | 'center' | 'right';
export type ThemeV2ElementVerticalAlign = 'top' | 'center' | 'bottom';

export type ThemeV2ElementBase = ThemeV2Transform & {
  id: string;
  /** Optional editor-facing name; does not affect rendering. */
  name?: string;
  /** Stage coordinates: the launcher canvas is 1000 x 650. */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  /** Hidden layers stay in the package but are not rendered. */
  hidden?: boolean;
  /** Locked layers can be selected in the layer list but not dragged on canvas. */
  locked?: boolean;
  /** Opt in to clicks and hovers from theme logic. */
  interactive?: boolean;
  /** Group this layer belongs to. */
  groupId?: string;
  filters?: ThemeV2Filters;
  /** Clips this layer to a shape or image alpha. */
  mask?: ThemeV2Mask;
  /** Space-separated CSS classes added to the rendered layer wrapper. */
  cssClasses?: string;
  /** Smoothly morph text and number changes using torph when content changes. */
  morph?: boolean;
  /** Morph animation duration in milliseconds (default 400). */
  morphDuration?: number;
};

export type ThemeV2TextDecoration =
  | 'none'
  | 'underline'
  | 'line-through'
  | 'underline line-through';
export type ThemeV2TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type ThemeV2TextFillMode = 'solid' | 'gradient';

export type ThemeV2TextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  color?: string;
  align?: ThemeV2ElementAlign;
  verticalAlign?: ThemeV2ElementVerticalAlign;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: ThemeV2TextDecoration;
  textTransform?: ThemeV2TextTransform;
  fillMode?: ThemeV2TextFillMode;
  gradientFrom?: string;
  gradientTo?: string;
  /** CSS gradient angle in degrees; 90 is left to right. */
  gradientAngle?: number;
  /** Text stroke width in pixels; 0 disables the outline. */
  outlineWidth?: number;
  outlineColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
};

export type ThemeV2TextElement = ThemeV2ElementBase &
  ThemeV2TextStyle & {
    type: 'text';
    text: string;
  };

/** Read-only launcher values a data layer can display. */
export const THEME_DATA_FIELDS = [
  { value: 'user.name', label: 'Player name', group: 'Player' },
  { value: 'user.country', label: 'Country code', group: 'Player' },
  { value: 'user.pp', label: 'Performance points', group: 'Player' },
  { value: 'user.rank', label: 'Global rank', group: 'Player' },
  { value: 'user.plays', label: 'Play count', group: 'Player' },
  { value: 'user.accuracy', label: 'Accuracy', group: 'Player' },
  { value: 'user.playtime', label: 'Playtime', group: 'Player' },
  { value: 'launcher.version', label: 'Launcher version', group: 'Launcher' },
  { value: 'osu.build', label: 'osu! build', group: 'osu!' },
  { value: 'osu.stream', label: 'osu! stream', group: 'osu!' },
  { value: 'server.ping', label: 'Server ping', group: 'Launcher' },
  { value: 'server.friends', label: 'Online friends', group: 'Launcher' },
  { value: 'theme.name', label: 'Theme name', group: 'Theme' },
  { value: 'theme.author', label: 'Theme author', group: 'Theme' },
  { value: 'theme.version', label: 'Theme version', group: 'Theme' },
  { value: 'screen', label: 'Current screen', group: 'Launcher' },
  { value: 'clock.time', label: 'Clock (24h)', group: 'Clock' },
  { value: 'clock.time12', label: 'Clock (12h)', group: 'Clock' },
  { value: 'clock.date', label: 'Date', group: 'Clock' },
] as const;

export type ThemeV2DataField = (typeof THEME_DATA_FIELDS)[number]['value'];

export type ThemeV2DataMode = 'osu' | 'taiko' | 'catch' | 'mania';

export type ThemeV2DataElement = ThemeV2ElementBase &
  ThemeV2TextStyle & {
    type: 'data';
    /** Built-in launcher value, for example `user.pp` or `clock.time`. */
    field: ThemeV2DataField;
    /** Which gamemode the player fields read from. */
    mode?: ThemeV2DataMode;
    /** Template for the value; `{value}` is replaced. Defaults to `{value}`. */
    text: string;
    /** Fallback value when live data is missing or empty (e.g. when logged out). */
    defaultValue?: string;
  };

export type ThemeV2ImageElement = ThemeV2ElementBase & {
  type: 'image';
  src: string;
  fit?: 'cover' | 'contain';
  radius?: number;
  /** Repaints the image's alpha silhouette with this color; empty keeps it. */
  tint?: string;
};

export type ThemeV2VideoElement = ThemeV2ElementBase & {
  type: 'video';
  src: string;
  fit?: 'cover' | 'contain';
  radius?: number;
  /** Defaults to true so autoplay works without user interaction. */
  muted?: boolean;
};

export type ThemeV2ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'polygon' | 'star' | 'arc';
export type ThemeV2ShapeFillMode = 'solid' | 'gradient';

export type ThemeV2ShapeElement = ThemeV2ElementBase & {
  type: 'shape';
  shape: ThemeV2ShapeKind;
  fill?: string;
  fillMode?: 'solid' | 'gradient';
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  radius?: number;
  /** Top-left, top-right, bottom-right, bottom-left radii. */
  cornerRadii?: [number, number, number, number];
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  /** Sides for polygon shapes and points for star shapes. */
  points?: number;
  /** Star inner radius, as a fraction of the outer radius. */
  innerRadius?: number;
  /** Frosted-glass blur behind the shape, in pixels. */
  backdropBlur?: number;
  /** Arc start angle in degrees; 0 points up and angles run clockwise. */
  startAngle?: number;
  /** Arc end angle in degrees; wraps past 360 when smaller than `startAngle`. */
  endAngle?: number;
  /** Arc stroke width in stage pixels. */
  thickness?: number;
  /** Whether arc ends use round caps. */
  rounded?: boolean;
};

export type ThemeV2PathElement = ThemeV2ElementBase & {
  type: 'path';
  /** SVG path data authored in a 0–100 box, stretched to the layer bounds. */
  path: string;
  fill?: string;
  fillMode?: ThemeV2ShapeFillMode;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  /** Outline color; an empty value disables the outline. */
  stroke?: string;
  /** Outline width in stage pixels. */
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  strokeLinecap?: 'butt' | 'round' | 'square';
};

export type ThemeV2ParticlePreset =
  | 'sparkles'
  | 'snow'
  | 'petals'
  | 'bubbles'
  | 'embers'
  | 'confetti';

export const THEME_PARTICLE_PRESETS = [
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'snow', label: 'Snow' },
  { value: 'petals', label: 'Petals' },
  { value: 'bubbles', label: 'Bubbles' },
  { value: 'embers', label: 'Embers' },
  { value: 'confetti', label: 'Confetti' },
] as const satisfies readonly { value: ThemeV2ParticlePreset; label: string }[];

export type ThemeV2ParticlesElement = ThemeV2ElementBase & {
  type: 'particles';
  preset: ThemeV2ParticlePreset;
  /** Particle count, 4–120. */
  density?: number;
  /** Animation speed multiplier, 0.1–3. */
  speed?: number;
  /** Particle size in stage pixels, 1–24. */
  size?: number;
  color?: string;
  /** Secondary color; presets blend between both. */
  color2?: string;
  /** Horizontal drift, -1 (left) to 1 (right). */
  wind?: number;
  /** Fade each particle towards the layer edges. */
  fade?: boolean;
};

export type ThemeV2ClockElement = ThemeV2ElementBase & {
  type: 'clock';
  mode?: 'digital' | 'analog';
  /** Digital clock uses 12-hour time. Analog clocks always use the local hour. */
  hour12?: boolean;
  showSeconds?: boolean;
  /** Digital clock adds the local weekday and date below the time. */
  showDate?: boolean;
  /** Optional caption shown above the time. */
  label?: string;
  color?: string;
  /** Second hand, dial accents and the date text. */
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: ThemeV2ElementAlign;
};

export type ThemeV2CountdownElement = ThemeV2ElementBase & {
  type: 'countdown';
  /** ISO date-time the layer counts down to. */
  target: string;
  /** Template with `{days}`, `{hours}`, `{minutes}` and `{seconds}`. */
  text: string;
  /** Shown once the target has passed. */
  finishedText?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: ThemeV2ElementAlign;
};

export type ThemeV2IconElement = ThemeV2ElementBase & {
  type: 'icon';
  icon: ThemeIconName;
  color?: string;
  /** Icon size as a percentage of the layer's shortest side. */
  scale?: number;
};

export type ThemeV2RepeaterElement = ThemeV2ElementBase & {
  type: 'repeater';
  source: 'image' | 'icon';
  src?: string;
  icon?: ThemeIconName;
  tileWidth?: number;
  tileHeight?: number;
  gapX?: number;
  gapY?: number;
  /** Tile counts; 0 or omitted fills the layer bounds. */
  columns?: number;
  rows?: number;
  radius?: number;
  color?: string;
};

export type ThemeV2GaugeElement = ThemeV2ElementBase & {
  type: 'gauge';
  mode?: 'bar' | 'ring';
  /** Fallback value from 0 to 1 when no variable is bound. */
  value?: number;
  /** Theme variable whose 0-1 numeric value drives the gauge. */
  variable?: string;
  trackColor?: string;
  fillColor?: string;
  thickness?: number;
  rounded?: boolean;
  /** Template shown in the middle; `{percent}`, `{value}` and `{variable}` work. */
  label?: string;
  labelColor?: string;
  fontSize?: number;
  fontFamily?: string;
};

export type ThemeV2TickerElement = ThemeV2ElementBase & {
  type: 'ticker';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  background?: string;
  /** Seconds for one full loop. */
  speed?: number;
  gap?: number;
  textTransform?: ThemeV2TextTransform;
};

export type ThemeV2LottieElement = ThemeV2ElementBase & {
  type: 'lottie';
  /** Lottie JSON file relative to the theme's assets folder. */
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
};

export type ThemeV2ButtonAction =
  | { type: 'navigate'; screen: ThemeV2ScriptScreen }
  | { type: 'launch' }
  | { type: 'url'; url: string };

export type ThemeV2ButtonElement = ThemeV2ElementBase & {
  type: 'button';
  label: string;
  icon?: ThemeIconName;
  action: ThemeV2ButtonAction;
  background?: string;
  color?: string;
  hoverBackground?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
};

/**
 * A self-contained Svelte 5 component authored in the theme editor. The source
 * is compiled in the WebView and mounted inside the layer bounds. Because this
 * executes theme JavaScript, API 2.0 themes with a Svelte layer require the
 * same explicit trust confirmation as API 1.0 themes.
 */
export type ThemeV2SvelteElement = ThemeV2ElementBase & {
  type: 'svelte';
  /** Plain-JavaScript Svelte 5 component source (no TypeScript preprocessor). */
  source: string;
};

export type ThemeV2Element =
  | ThemeV2TextElement
  | ThemeV2DataElement
  | ThemeV2ImageElement
  | ThemeV2VideoElement
  | ThemeV2ShapeElement
  | ThemeV2IconElement
  | ThemeV2RepeaterElement
  | ThemeV2GaugeElement
  | ThemeV2TickerElement
  | ThemeV2LottieElement
  | ThemeV2ButtonElement
  | ThemeV2PathElement
  | ThemeV2ParticlesElement
  | ThemeV2ClockElement
  | ThemeV2CountdownElement
  | ThemeV2SvelteElement;

export type ThemeV2ScriptScreen = 'home' | 'themes' | 'settings' | 'login';
export type ThemeV2ScriptValue = string | number | boolean;
export type ThemeV2BehaviorOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterOrEqual'
  | 'lessOrEqual';

export type ThemeV2BehaviorTrigger =
  | { type: 'load' }
  | { type: 'screen'; screen: ThemeV2ScriptScreen }
  | { type: 'click' | 'hover' | 'leave'; elementId?: string }
  | { type: 'timer'; interval: number };

/** Attach a rule to a layer or group so it can be edited from that inspector. */
export type ThemeV2BehaviorTarget = { type: 'element' | 'group'; id: string };

export type ThemeV2BehaviorCondition =
  | {
      type: 'variable';
      variable: string;
      operator: ThemeV2BehaviorOperator;
      value: ThemeV2ScriptValue;
    }
  | { type: 'visible'; elementId: string; value: boolean }
  | { type: 'groupVisible'; groupId: string; value: boolean }
  | { type: 'screen'; screen: ThemeV2ScriptScreen }
  | { type: 'chance'; percent: number };

export type ThemeV2BehaviorAction =
  | { type: 'setVariable'; variable: string; value: ThemeV2ScriptValue }
  | { type: 'changeVariable'; variable: string; amount: number }
  | { type: 'toggleVariable'; variable: string }
  | { type: 'showElement' | 'hideElement' | 'toggleElement'; elementId: string }
  | { type: 'showGroup' | 'hideGroup' | 'toggleGroup'; groupId: string }
  | { type: 'navigate'; screen: ThemeV2ScriptScreen }
  | { type: 'launch' }
  | { type: 'openUrl'; url: string };

/** A Scratch-style WHEN / IF / THEN rule. */
export type ThemeV2Behavior = {
  id: string;
  name?: string;
  enabled?: boolean;
  /** Fire at most once per theme session. */
  once?: boolean;
  /** Optional layer or group this rule belongs to. */
  target?: ThemeV2BehaviorTarget;
  trigger: ThemeV2BehaviorTrigger;
  conditions?: ThemeV2BehaviorCondition[];
  /** Whether every condition or at least one must match. */
  conditionMode?: 'all' | 'any';
  actions: ThemeV2BehaviorAction[];
  /**
   * Optional advanced script body written in JavaScript syntax. When defined,
   * it replaces `actions` for this rule. The script is compiled into a safe
   * instruction set and executed without eval().
   */
  script?: string;
};

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
  /** Built-in icon family used by launcher chrome. Defaults to Lucide. */
  iconSet?: ThemeIconSet;
  fonts: ThemeV2Font[];
  elements: ThemeV2Element[];
  /** Optional layer groups. Elements reference them through `groupId`. */
  groups: ThemeV2Group[];
  /** Declarative interaction rules; API 2.0 themes never run arbitrary JS. */
  behaviors?: ThemeV2Behavior[];
  /**
   * Starting values for `{name}` text placeholders and rule variables. Any
   * variable without an entry starts at `0`.
   */
  variables?: Record<string, ThemeV2ScriptValue>;
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

const CSS_CLASS_TOKEN = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

/**
 * Split a space-separated class list into safe, unique tokens. Theme CSS is
 * injected globally, so this keeps selectors predictable and prevents a layer
 * from carrying malformed attribute content.
 */
export const themeClassTokens = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of value.trim().split(/\s+/)) {
    if (!token || token.length > 64 || !CSS_CLASS_TOKEN.test(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length === 20) break;
  }
  return tokens;
};

/** Sanitized class attribute value for a layer or group. */
export const themeClassNames = (value: unknown): string => themeClassTokens(value).join(' ');

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

const normalizeFilters = (raw: unknown): ThemeV2Filters | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const filters: ThemeV2Filters = {};
  let hasValue = false;
  const add = (
    key: keyof ThemeV2Filters,
    min: number,
    max: number,
    fallback: number,
    present: boolean
  ) => {
    if (!present) return;
    filters[key] = clamp(source[key], fallback, min, max);
    hasValue = true;
  };

  add('blur', 0, 40, 0, source.blur !== undefined);
  add('brightness', 0, 3, 1, source.brightness !== undefined);
  add('contrast', 0, 3, 1, source.contrast !== undefined);
  add('saturate', 0, 4, 1, source.saturate !== undefined);
  add('hueRotate', -360, 360, 0, source.hueRotate !== undefined);
  add('grayscale', 0, 1, 0, source.grayscale !== undefined);
  add('sepia', 0, 1, 0, source.sepia !== undefined);
  add('invert', 0, 1, 0, source.invert !== undefined);

  return hasValue ? filters : undefined;
};

const normalizeTransform = (source: Record<string, unknown>): ThemeV2Transform => {
  const scale = clamp(source.scale, 1, 0.05, 10);
  return {
    rotation: clamp(source.rotation, 0, -360, 360),
    scale,
    scaleX: clamp(source.scaleX, scale, 0.05, 10),
    scaleY: clamp(source.scaleY, scale, 0.05, 10),
    skewX: clamp(source.skewX, 0, -89, 89),
    skewY: clamp(source.skewY, 0, -89, 89),
    flipX: source.flipX === true,
    flipY: source.flipY === true,
  };
};

const normalizeGroups = (raw: unknown): ThemeV2Group[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const groups: ThemeV2Group[] = [];

  raw.slice(0, 50).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return;
    const source = candidate as Record<string, unknown>;
    let id = text(source.id, `group_${index + 1}`).slice(0, 64);
    let suffix = 2;
    while (seen.has(id)) id = `${id}_${suffix++}`;
    seen.add(id);
    const filters = normalizeFilters(source.filters);
    const cssClasses = themeClassNames(source.cssClasses);
    const mask = normalizeMask(source.mask);
    const morph = typeof source.morph === 'boolean' ? source.morph : undefined;
    const morphDuration =
      typeof source.morphDuration === 'number' && Number.isFinite(source.morphDuration)
        ? clamp(source.morphDuration, 400, 50, 5000)
        : undefined;
    const group: ThemeV2Group = {
      id,
      name: typeof source.name === 'string' ? source.name.slice(0, 80) : undefined,
      parentId: typeof source.parentId === 'string' ? source.parentId.slice(0, 64) : undefined,
      hidden: source.hidden === true,
      locked: source.locked === true,
      collapsed: source.collapsed === true,
      opacity: clamp(source.opacity, 1, 0, 1),
      offsetX: clamp(source.offsetX, 0, -2000, 2000),
      offsetY: clamp(source.offsetY, 0, -2000, 2000),
      ...normalizeTransform(source),
      ...(filters ? { filters } : {}),
      ...(mask ? { mask } : {}),
      ...(cssClasses ? { cssClasses } : {}),
      ...(morph !== undefined ? { morph } : {}),
      ...(morphDuration !== undefined ? { morphDuration } : {}),
    };
    groups.push(group);
  });

  // Drop missing/self parents and break accidental cycles so rendering and
  // the layer tree can safely walk upwards.
  const ids = new Set(groups.map((group) => group.id));
  for (const group of groups) {
    if (!group.parentId || !ids.has(group.parentId) || group.parentId === group.id) {
      group.parentId = undefined;
    }
  }
  for (const group of groups) {
    const seenParents = new Set<string>([group.id]);
    let parent = group.parentId
      ? groups.find((candidate) => candidate.id === group.parentId)
      : undefined;
    while (parent) {
      if (seenParents.has(parent.id)) {
        group.parentId = undefined;
        break;
      }
      seenParents.add(parent.id);
      parent = parent.parentId
        ? groups.find((candidate) => candidate.id === parent?.parentId)
        : undefined;
    }
  }

  return groups;
};

const normalizeMask = (raw: unknown): ThemeV2Mask | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const shape = oneOf(
    source.shape,
    ['rectangle', 'ellipse', 'polygon', 'star', 'image'] as const,
    'rectangle'
  );
  const src = text(source.src).slice(0, 500);
  if (shape === 'image' && !src) return undefined;
  return {
    shape,
    radius: clamp(source.radius, 0, 0, 999),
    sides: clampInteger(source.sides, shape === 'star' ? 5 : 6, 3, 24),
    innerRadius: clamp(source.innerRadius, 0.5, 0.1, 0.95),
    ...(src ? { src } : {}),
    fit: source.fit === 'contain' ? 'contain' : 'cover',
  };
};

const DATA_FIELD_VALUES = THEME_DATA_FIELDS.map((field) => field.value);

const normalizeTextStyle = (source: Record<string, unknown>): ThemeV2TextStyle => ({
  fontFamily: text(source.fontFamily, 'Sora Variable'),
  fontSize: clamp(source.fontSize, 28, 6, 240),
  fontWeight: clampInteger(source.fontWeight, 600, 100, 900),
  fontStyle: source.fontStyle === 'italic' ? 'italic' : 'normal',
  color: color(source.color, '#ffffff'),
  align: oneOf(source.align, ['left', 'center', 'right'] as const, 'left'),
  verticalAlign: oneOf(source.verticalAlign, ['top', 'center', 'bottom'] as const, 'top'),
  lineHeight: clamp(source.lineHeight, 1.2, 0.7, 3),
  letterSpacing: clamp(source.letterSpacing, 0, -20, 40),
  textDecoration: oneOf(
    source.textDecoration,
    ['none', 'underline', 'line-through', 'underline line-through'] as const,
    'none'
  ),
  textTransform: oneOf(
    source.textTransform,
    ['none', 'uppercase', 'lowercase', 'capitalize'] as const,
    'none'
  ),
  fillMode: source.fillMode === 'gradient' ? 'gradient' : 'solid',
  gradientFrom: color(source.gradientFrom, '#ff006e'),
  gradientTo: color(source.gradientTo, '#7c3aed'),
  gradientAngle: clamp(source.gradientAngle, 90, 0, 360),
  outlineWidth: clamp(source.outlineWidth, 0, 0, 20),
  outlineColor: color(source.outlineColor, '#000000'),
  shadowColor: color(source.shadowColor, '#000000'),
  shadowBlur: clamp(source.shadowBlur, 0, 0, 40),
  shadowOffsetX: clamp(source.shadowOffsetX, 0, -40, 40),
  shadowOffsetY: clamp(source.shadowOffsetY, 0, -40, 40),
});

const normalizeButtonAction = (raw: unknown): ThemeV2ButtonAction => {
  if (!raw || typeof raw !== 'object') return { type: 'navigate', screen: 'home' };
  const source = raw as Record<string, unknown>;
  const type = oneOf(source.type, ['navigate', 'launch', 'url'] as const, 'navigate');
  if (type === 'launch') return { type: 'launch' };
  if (type === 'url') {
    return { type: 'url', url: text(source.url).slice(0, 2000) };
  }
  return { type: 'navigate', screen: oneOf(source.screen, SCRIPT_SCREENS, 'home') };
};

const PATH_DATA_PATTERN = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]*$/;

const normalizePathData = (value: unknown) => {
  const raw = text(value).slice(0, 4000);
  return raw && PATH_DATA_PATTERN.test(raw) ? raw : '';
};

const normalizeElement = (raw: unknown, index: number): ThemeV2Element | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(
    source.type,
    [
      'text',
      'data',
      'image',
      'video',
      'shape',
      'icon',
      'repeater',
      'gauge',
      'ticker',
      'lottie',
      'button',
      'path',
      'particles',
      'clock',
      'countdown',
      'svelte',
    ] as const,
    'text'
  );
  const cssClasses = themeClassNames(source.cssClasses);
  const morph = typeof source.morph === 'boolean' ? source.morph : undefined;
  const morphDuration =
    typeof source.morphDuration === 'number' && Number.isFinite(source.morphDuration)
      ? clamp(source.morphDuration, 400, 50, 5000)
      : undefined;
  const base = {
    id: text(source.id, `element_${index + 1}`).slice(0, 64),
    name: typeof source.name === 'string' ? source.name.slice(0, 80) : undefined,
    x: clamp(source.x, 0, 0, 1000),
    y: clamp(source.y, 0, 0, 650),
    width: clamp(source.width, 320, 24, 1000),
    height: clamp(source.height, 120, 24, 650),
    ...normalizeTransform(source),
    opacity: clamp(source.opacity, 1, 0, 1),
    hidden: source.hidden === true,
    locked: source.locked === true,
    interactive: source.interactive === true,
    groupId: typeof source.groupId === 'string' ? source.groupId.slice(0, 64) : undefined,
    filters: normalizeFilters(source.filters),
    mask: normalizeMask(source.mask),
    ...(cssClasses ? { cssClasses } : {}),
    ...(morph !== undefined ? { morph } : {}),
    ...(morphDuration !== undefined ? { morphDuration } : {}),
  };

  if (type === 'text') {
    return {
      ...base,
      type,
      text: typeof source.text === 'string' ? source.text.slice(0, 2000) : 'Your text',
      ...normalizeTextStyle(source),
    };
  }

  if (type === 'data') {
    return {
      ...base,
      type,
      field: oneOf(source.field, DATA_FIELD_VALUES, 'user.name' as ThemeV2DataField),
      mode: oneOf(source.mode, ['osu', 'taiko', 'catch', 'mania'] as const, 'osu'),
      text: typeof source.text === 'string' ? source.text.slice(0, 400) : '{value}',
      ...(typeof source.defaultValue === 'string'
        ? { defaultValue: source.defaultValue.slice(0, 200) }
        : {}),
      ...normalizeTextStyle(source),
    };
  }

  if (type === 'shape') {
    const cornerRadii = Array.isArray(source.cornerRadii) ? source.cornerRadii.slice(0, 4) : [];
    const radius = clamp(source.radius, 16, 0, 999);
    return {
      ...base,
      type,
      shape: oneOf(
        source.shape,
        ['rectangle', 'ellipse', 'line', 'polygon', 'star', 'arc'] as const,
        'rectangle'
      ),
      fill: color(source.fill, '#ff006e'),
      fillMode: source.fillMode === 'gradient' ? 'gradient' : 'solid',
      gradientFrom: color(source.gradientFrom, '#ff006e'),
      gradientTo: color(source.gradientTo, '#7c3aed'),
      gradientAngle: clamp(source.gradientAngle, 135, 0, 360),
      radius,
      ...(cornerRadii.length > 0
        ? {
            cornerRadii: [
              clamp(cornerRadii[0], radius, 0, 999),
              clamp(cornerRadii[1], radius, 0, 999),
              clamp(cornerRadii[2], radius, 0, 999),
              clamp(cornerRadii[3], radius, 0, 999),
            ] as [number, number, number, number],
          }
        : {}),
      borderWidth: clamp(source.borderWidth, 0, 0, 40),
      borderColor: color(source.borderColor, '#ffffff'),
      borderStyle: oneOf(source.borderStyle, ['solid', 'dashed', 'dotted'] as const, 'solid'),
      points: clampInteger(source.points, 6, 3, 24),
      innerRadius: clamp(source.innerRadius, 0.5, 0.1, 0.95),
      backdropBlur: clamp(source.backdropBlur, 0, 0, 60),
      startAngle: clamp(source.startAngle, 0, -360, 360),
      endAngle: clamp(source.endAngle, 270, -360, 720),
      thickness: clamp(source.thickness, 12, 1, 120),
      rounded: source.rounded !== false,
    };
  }

  if (type === 'icon') {
    return {
      ...base,
      type,
      icon: isThemeIconName(source.icon) ? source.icon : 'brush',
      color: color(source.color, '#ffffff'),
      scale: clamp(source.scale, 100, 10, 100),
    };
  }

  if (type === 'repeater') {
    return {
      ...base,
      type,
      source: oneOf(source.source, ['image', 'icon'] as const, 'icon'),
      ...(text(source.src) ? { src: text(source.src).slice(0, 500) } : {}),
      icon: isThemeIconName(source.icon) ? source.icon : 'music',
      tileWidth: clamp(source.tileWidth, 28, 4, 400),
      tileHeight: clamp(source.tileHeight, 28, 4, 400),
      gapX: clamp(source.gapX, 8, 0, 200),
      gapY: clamp(source.gapY, 8, 0, 200),
      columns: clampInteger(source.columns, 0, 0, 60),
      rows: clampInteger(source.rows, 0, 0, 60),
      radius: clamp(source.radius, 0, 0, 999),
      color: color(source.color, '#ffffff'),
    };
  }

  if (type === 'gauge') {
    return {
      ...base,
      type,
      mode: oneOf(source.mode, ['bar', 'ring'] as const, 'bar'),
      value: clamp(source.value, 0.5, 0, 1),
      ...(text(source.variable) ? { variable: text(source.variable).slice(0, 64) } : {}),
      trackColor: color(source.trackColor, '#000000'),
      fillColor: color(source.fillColor, '#ff006e'),
      thickness: clamp(source.thickness, 12, 2, 80),
      rounded: source.rounded !== false,
      label: typeof source.label === 'string' ? source.label.slice(0, 200) : '',
      labelColor: color(source.labelColor, '#ffffff'),
      fontSize: clamp(source.fontSize, 20, 6, 200),
      fontFamily: text(source.fontFamily, 'Sora Variable'),
    };
  }

  if (type === 'ticker') {
    return {
      ...base,
      type,
      text: typeof source.text === 'string' ? source.text.slice(0, 500) : 'Now playing',
      fontFamily: text(source.fontFamily, 'Sora Variable'),
      fontSize: clamp(source.fontSize, 24, 6, 200),
      fontWeight: clampInteger(source.fontWeight, 600, 100, 900),
      color: color(source.color, '#ffffff'),
      background: /^#(?:[0-9a-f]{3,8})$/i.test(text(source.background))
        ? text(source.background)
        : '',
      speed: clamp(source.speed, 18, 2, 240),
      gap: clamp(source.gap, 48, 0, 400),
      textTransform: oneOf(
        source.textTransform,
        ['none', 'uppercase', 'lowercase', 'capitalize'] as const,
        'none'
      ),
    };
  }

  if (type === 'lottie') {
    const src = text(source.src).slice(0, 500);
    if (!src) return undefined;
    return {
      ...base,
      type,
      src,
      loop: source.loop !== false,
      autoplay: source.autoplay !== false,
      speed: clamp(source.speed, 1, 0.1, 4),
    };
  }

  if (type === 'button') {
    return {
      ...base,
      type,
      label: typeof source.label === 'string' ? source.label.slice(0, 80) : 'Click me',
      ...(isThemeIconName(source.icon) ? { icon: source.icon } : {}),
      action: normalizeButtonAction(source.action),
      background: color(source.background, '#ff006e'),
      color: color(source.color, '#ffffff'),
      hoverBackground: color(source.hoverBackground, '#ff4d94'),
      borderColor: color(source.borderColor, '#ffffff'),
      borderWidth: clamp(source.borderWidth, 0, 0, 20),
      radius: clamp(source.radius, 10, 0, 999),
      fontSize: clamp(source.fontSize, 16, 6, 120),
      fontWeight: clampInteger(source.fontWeight, 600, 100, 900),
      fontFamily: text(source.fontFamily, 'Sora Variable'),
    };
  }

  if (type === 'path') {
    return {
      ...base,
      type,
      path: normalizePathData(source.path) || 'M 5 95 L 50 5 L 95 95 Z',
      fill: color(source.fill, '#ff006e'),
      fillMode: source.fillMode === 'gradient' ? 'gradient' : 'solid',
      gradientFrom: color(source.gradientFrom, '#ff006e'),
      gradientTo: color(source.gradientTo, '#7c3aed'),
      gradientAngle: clamp(source.gradientAngle, 135, 0, 360),
      stroke: text(source.stroke) ? color(source.stroke, '#ffffff') : '',
      strokeWidth: clamp(source.strokeWidth, 0, 0, 60),
      strokeStyle: oneOf(source.strokeStyle, ['solid', 'dashed', 'dotted'] as const, 'solid'),
      strokeLinecap: oneOf(source.strokeLinecap, ['butt', 'round', 'square'] as const, 'round'),
    };
  }

  if (type === 'particles') {
    return {
      ...base,
      type,
      preset: oneOf(
        source.preset,
        ['sparkles', 'snow', 'petals', 'bubbles', 'embers', 'confetti'] as const,
        'sparkles'
      ),
      density: clampInteger(source.density, 28, 4, 120),
      speed: clamp(source.speed, 1, 0.1, 3),
      size: clamp(source.size, 6, 1, 24),
      color: color(source.color, '#ffffff'),
      color2: color(source.color2, '#ff006e'),
      wind: clamp(source.wind, 0, -1, 1),
      fade: source.fade !== false,
    };
  }

  if (type === 'clock') {
    return {
      ...base,
      type,
      mode: oneOf(source.mode, ['digital', 'analog'] as const, 'digital'),
      hour12: source.hour12 === true,
      showSeconds: source.showSeconds !== false,
      showDate: source.showDate === true,
      label: typeof source.label === 'string' ? source.label.slice(0, 80) : '',
      color: color(source.color, '#ffffff'),
      accentColor: color(source.accentColor, '#ff006e'),
      fontFamily: text(source.fontFamily, 'Sora Variable'),
      fontSize: clamp(source.fontSize, 40, 6, 240),
      fontWeight: clampInteger(source.fontWeight, 700, 100, 900),
      align: oneOf(source.align, ['left', 'center', 'right'] as const, 'center'),
    };
  }

  if (type === 'countdown') {
    return {
      ...base,
      type,
      target: text(source.target).slice(0, 64),
      text:
        typeof source.text === 'string'
          ? source.text.slice(0, 200)
          : '{days}d {hours}h {minutes}m {seconds}s',
      finishedText:
        typeof source.finishedText === 'string'
          ? source.finishedText.slice(0, 200)
          : 'The wait is over',
      fontFamily: text(source.fontFamily, 'Sora Variable'),
      fontSize: clamp(source.fontSize, 40, 6, 240),
      fontWeight: clampInteger(source.fontWeight, 700, 100, 900),
      color: color(source.color, '#ffffff'),
      align: oneOf(source.align, ['left', 'center', 'right'] as const, 'center'),
    };
  }

  if (type === 'svelte') {
    return {
      ...base,
      type,
      source:
        typeof source.source === 'string'
          ? source.source.slice(0, 100_000)
          : DEFAULT_THEME_SVELTE_SOURCE,
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
    ...(type === 'image' ? { tint: text(source.tint).slice(0, 9) } : {}),
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

const SCRIPT_SCREENS = ['home', 'themes', 'settings', 'login'] as const;
const SCRIPT_OPERATORS = [
  'equals',
  'notEquals',
  'greaterThan',
  'lessThan',
  'greaterOrEqual',
  'lessOrEqual',
] as const;

const normalizeScriptValue = (
  value: unknown,
  fallback: ThemeV2ScriptValue = 0
): ThemeV2ScriptValue => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 200);
  return fallback;
};

const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_VARIABLE_NAMES = new Set(['__proto__', 'prototype', 'constructor', 'screen']);

/** Keep theme-declared variable defaults safe and bounded. */
const normalizeVariableDefaults = (value: unknown): Record<string, ThemeV2ScriptValue> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const defaults: Record<string, ThemeV2ScriptValue> = {};
  for (const [rawName, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 64)) {
    const name = rawName.trim().slice(0, 64);
    if (!VARIABLE_NAME_PATTERN.test(name) || RESERVED_VARIABLE_NAMES.has(name)) continue;
    defaults[name] = normalizeScriptValue(rawValue);
  }
  return defaults;
};

const normalizeBehaviorTarget = (raw: unknown): ThemeV2BehaviorTarget | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(source.type, ['element', 'group'] as const, 'element');
  const id = text(source.id).slice(0, 64);
  return id ? { type, id } : undefined;
};

const normalizeBehaviorTrigger = (raw: unknown): ThemeV2BehaviorTrigger | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(
    source.type,
    ['load', 'screen', 'click', 'hover', 'leave', 'timer'] as const,
    'load'
  );
  if (type === 'screen') {
    return { type, screen: oneOf(source.screen, SCRIPT_SCREENS, 'home') };
  }
  if (type === 'click' || type === 'hover' || type === 'leave') {
    const elementId = typeof source.elementId === 'string' ? source.elementId.slice(0, 64) : '';
    return elementId ? { type, elementId } : { type };
  }
  if (type === 'timer') {
    return { type, interval: clamp(source.interval, 5, 0.5, 3600) };
  }
  return { type: 'load' };
};

const normalizeBehaviorCondition = (raw: unknown): ThemeV2BehaviorCondition | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(
    source.type,
    ['variable', 'visible', 'groupVisible', 'screen', 'chance'] as const,
    'variable'
  );
  if (type === 'variable') {
    const variable = text(source.variable).slice(0, 64);
    if (!variable) return undefined;
    return {
      type,
      variable,
      operator: oneOf(source.operator, SCRIPT_OPERATORS, 'equals'),
      value: normalizeScriptValue(source.value),
    };
  }
  if (type === 'visible') {
    const elementId = text(source.elementId).slice(0, 64);
    if (!elementId) return undefined;
    return { type, elementId, value: source.value !== false };
  }
  if (type === 'groupVisible') {
    const groupId = text(source.groupId).slice(0, 64);
    if (!groupId) return undefined;
    return { type, groupId, value: source.value !== false };
  }
  if (type === 'screen') {
    return { type, screen: oneOf(source.screen, SCRIPT_SCREENS, 'home') };
  }
  return { type, percent: clamp(source.percent, 25, 0, 100) };
};

const normalizeBehaviorAction = (raw: unknown): ThemeV2BehaviorAction | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const type = oneOf(
    source.type,
    [
      'setVariable',
      'changeVariable',
      'toggleVariable',
      'showElement',
      'hideElement',
      'toggleElement',
      'showGroup',
      'hideGroup',
      'toggleGroup',
      'navigate',
      'launch',
      'openUrl',
    ] as const,
    'setVariable'
  );
  if (type === 'setVariable') {
    const variable = text(source.variable).slice(0, 64);
    if (!variable) return undefined;
    return { type, variable, value: normalizeScriptValue(source.value) };
  }
  if (type === 'changeVariable') {
    const variable = text(source.variable).slice(0, 64);
    if (!variable) return undefined;
    return { type, variable, amount: clamp(source.amount, 1, -1000000, 1000000) };
  }
  if (type === 'toggleVariable') {
    const variable = text(source.variable).slice(0, 64);
    return variable ? { type, variable } : undefined;
  }
  if (type === 'showElement' || type === 'hideElement' || type === 'toggleElement') {
    const elementId = text(source.elementId).slice(0, 64);
    return elementId ? { type, elementId } : undefined;
  }
  if (type === 'showGroup' || type === 'hideGroup' || type === 'toggleGroup') {
    const groupId = text(source.groupId).slice(0, 64);
    return groupId ? { type, groupId } : undefined;
  }
  if (type === 'navigate') {
    return { type, screen: oneOf(source.screen, SCRIPT_SCREENS, 'home') };
  }
  if (type === 'openUrl') {
    const url = text(source.url).slice(0, 2000);
    return /^https?:\/\//i.test(url) ? { type, url } : undefined;
  }
  return { type: 'launch' };
};

const normalizeBehaviors = (raw: unknown): ThemeV2Behavior[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const behaviors: ThemeV2Behavior[] = [];

  raw.slice(0, 100).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return;
    const source = candidate as Record<string, unknown>;
    const trigger = normalizeBehaviorTrigger(source.trigger);
    if (!trigger) return;

    let id = text(source.id, `rule_${index + 1}`).slice(0, 64);
    let suffix = 2;
    while (seen.has(id)) id = `${id}_${suffix++}`;
    seen.add(id);

    const conditions = Array.isArray(source.conditions)
      ? source.conditions
          .slice(0, 12)
          .map(normalizeBehaviorCondition)
          .filter((condition): condition is ThemeV2BehaviorCondition => Boolean(condition))
      : [];
    const actions = Array.isArray(source.actions)
      ? source.actions
          .slice(0, 20)
          .map(normalizeBehaviorAction)
          .filter((action): action is ThemeV2BehaviorAction => Boolean(action))
      : [];

    behaviors.push({
      id,
      name: typeof source.name === 'string' ? source.name.slice(0, 80) : `Rule ${index + 1}`,
      enabled: source.enabled !== false,
      once: source.once === true,
      target: normalizeBehaviorTarget(source.target),
      trigger,
      conditions,
      conditionMode: source.conditionMode === 'any' ? 'any' : 'all',
      actions,
      ...(typeof source.script === 'string' ? { script: source.script.slice(0, 20000) } : {}),
    });
  });

  return behaviors;
};

/** Create a blank rule, optionally linked to a layer or group. */
export const createThemeV2Behavior = (
  index = 0,
  target?: ThemeV2BehaviorTarget
): ThemeV2Behavior => {
  const base = {
    id: `rule_${Date.now().toString(36)}_${index}`,
    name: `Rule ${index + 1}`,
    enabled: true,
    once: false,
    conditions: [],
    conditionMode: 'all' as const,
  };

  if (target?.type === 'element') {
    return {
      ...base,
      target,
      trigger: { type: 'click', elementId: target.id },
      actions: [{ type: 'toggleElement', elementId: target.id }],
    };
  }
  if (target?.type === 'group') {
    return {
      ...base,
      target,
      trigger: { type: 'click' },
      actions: [{ type: 'toggleGroup', groupId: target.id }],
    };
  }
  return { ...base, trigger: { type: 'load' }, actions: [] };
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
  if (type === 'data') {
    return normalizeElement(
      {
        ...base,
        type,
        field: 'user.name',
        text: 'Welcome, {value}!',
        defaultValue: 'Guest',
        fontSize: 26,
        width: 420,
        height: 60,
      },
      index
    )! as ThemeV2DataElement;
  }
  if (type === 'shape') {
    return normalizeElement(
      { ...base, type, shape: 'rectangle', width: 220, height: 120 },
      index
    )! as ThemeV2ShapeElement;
  }
  if (type === 'icon') {
    return normalizeElement(
      { ...base, type, icon: 'brush', color: '#ffffff', width: 96, height: 96, x: 450, y: 280 },
      index
    )! as ThemeV2IconElement;
  }
  if (type === 'repeater') {
    return normalizeElement(
      { ...base, type, source: 'icon', icon: 'music', width: 320, height: 180 },
      index
    )! as ThemeV2RepeaterElement;
  }
  if (type === 'gauge') {
    return normalizeElement(
      { ...base, type, mode: 'bar', label: '{percent}%', width: 320, height: 44, y: 300 },
      index
    )! as ThemeV2GaugeElement;
  }
  if (type === 'ticker') {
    return normalizeElement(
      { ...base, type, text: 'Now playing · Your favourite track · ', width: 420, height: 48 },
      index
    )! as ThemeV2TickerElement;
  }
  if (type === 'lottie') {
    return normalizeElement(
      { ...base, type, src: 'animation.json', width: 320, height: 320 },
      index
    )! as ThemeV2LottieElement;
  }
  if (type === 'button') {
    return normalizeElement(
      { ...base, type, label: 'Open themes', width: 220, height: 52, y: 320 },
      index
    )! as ThemeV2ButtonElement;
  }
  if (type === 'path') {
    return normalizeElement(
      {
        ...base,
        type,
        path: 'M 5 95 L 50 5 L 95 95 Z',
        fillMode: 'gradient',
        width: 220,
        height: 200,
      },
      index
    )! as ThemeV2PathElement;
  }
  if (type === 'particles') {
    return normalizeElement(
      { ...base, type, preset: 'sparkles', width: 520, height: 360, density: 36 },
      index
    )! as ThemeV2ParticlesElement;
  }
  if (type === 'clock') {
    return normalizeElement(
      { ...base, type, mode: 'digital', width: 300, height: 110, fontSize: 48 },
      index
    )! as ThemeV2ClockElement;
  }
  if (type === 'countdown') {
    return normalizeElement(
      {
        ...base,
        type,
        target: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        width: 380,
        height: 90,
        fontSize: 36,
      },
      index
    )! as ThemeV2CountdownElement;
  }
  if (type === 'svelte') {
    return normalizeElement(
      {
        ...base,
        type,
        source: DEFAULT_THEME_SVELTE_SOURCE,
        width: 360,
        height: 190,
      },
      index
    )! as ThemeV2SvelteElement;
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
  iconSet: DEFAULT_THEME_ICON_SET,
  fonts: [],
  elements: [],
  groups: [],
  behaviors: [],
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
  const monoFont = text(sourceTypography.mono).slice(0, 80);
  const groups = normalizeGroups(raw.groups);
  const groupIds = new Set(groups.map((group) => group.id));
  const elements = normalizeElements(raw.elements).map((element) =>
    element.groupId && !groupIds.has(element.groupId) ? { ...element, groupId: undefined } : element
  );

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
    // A video background owns the soundtrack; combining it with theme music
    // would play two sources at once.
    audio:
      background.type !== 'video' && sourceAudio && text(sourceAudio.src)
        ? {
            src: text(sourceAudio.src),
            loop: sourceAudio.loop !== false,
          }
        : undefined,
    typography: {
      body: bodyFont || defaults.typography?.body || 'Sora Variable',
      heading: headingFont || bodyFont || defaults.typography?.heading || 'Sora Variable',
      ...(monoFont ? { mono: monoFont } : {}),
    },
    iconSet: isThemeIconSet(raw.iconSet) ? raw.iconSet : DEFAULT_THEME_ICON_SET,
    fonts: normalizeFonts(raw.fonts),
    elements,
    groups,
    behaviors: normalizeBehaviors(raw.behaviors),
    variables: normalizeVariableDefaults(raw.variables),
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
  // Keep a cache-busting query (used when reloading a theme from disk) on the
  // base URL, after the asset path rather than inside it.
  const match = /^([^?#]*)([?#].*)?$/.exec(base);
  const basePath = (match?.[1] ?? base).replace(/\/+$/, '');
  const suffix = match?.[2] ?? '';
  return basePath ? `${basePath}/${relative}${suffix}` : `${relative}${suffix}`;
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

/** Compose CSS filter functions for a layer and its ancestor groups. */
export const themeFilterCss = (...filters: (ThemeV2Filters | undefined)[]) => {
  const value = (candidate: unknown, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
  const parts: string[] = [];

  for (const filter of filters) {
    if (!filter) continue;
    const blur = value(filter.blur, 0);
    const brightness = value(filter.brightness, 1);
    const contrast = value(filter.contrast, 1);
    const saturate = value(filter.saturate, 1);
    const hueRotate = value(filter.hueRotate, 0);
    const grayscale = value(filter.grayscale, 0);
    const sepia = value(filter.sepia, 0);
    const invert = value(filter.invert, 0);

    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (brightness !== 1) parts.push(`brightness(${brightness})`);
    if (contrast !== 1) parts.push(`contrast(${contrast})`);
    if (saturate !== 1) parts.push(`saturate(${saturate})`);
    if (hueRotate !== 0) parts.push(`hue-rotate(${hueRotate}deg)`);
    if (grayscale > 0) parts.push(`grayscale(${grayscale})`);
    if (sepia > 0) parts.push(`sepia(${sepia})`);
    if (invert > 0) parts.push(`invert(${invert})`);
  }

  return parts.join(' ');
};

/** Groups from the element's immediate parent up to the root. */
export const themeGroupAncestors = (
  groups: ThemeV2Group[] | undefined,
  element: Pick<ThemeV2Element, 'groupId'>
): ThemeV2Group[] => {
  const byId = new Map((groups ?? []).map((group) => [group.id, group]));
  const ancestors: ThemeV2Group[] = [];
  const seen = new Set<string>();
  let current = element.groupId ? byId.get(element.groupId) : undefined;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ancestors.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return ancestors;
};

/** Group path from the outermost ancestor down to the given group. */
export const themeGroupPath = (
  groups: ThemeV2Group[] | undefined,
  groupId: string
): ThemeV2Group[] => themeGroupAncestors(groups, { groupId }).slice().reverse();

export type ThemeV2TransformMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

const IDENTITY_MATRIX: ThemeV2TransformMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const multiplyMatrices = (
  left: ThemeV2TransformMatrix,
  right: ThemeV2TransformMatrix
): ThemeV2TransformMatrix => ({
  a: left.a * right.a + left.c * right.b,
  b: left.b * right.a + left.d * right.b,
  c: left.a * right.c + left.c * right.d,
  d: left.b * right.c + left.d * right.d,
  e: left.a * right.e + left.c * right.f + left.e,
  f: left.b * right.e + left.d * right.f + left.f,
});

const translateMatrix = (x: number, y: number): ThemeV2TransformMatrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: x,
  f: y,
});

const rotateMatrix = (degrees: number): ThemeV2TransformMatrix => {
  const radians = (degrees * Math.PI) / 180;
  return {
    a: Math.cos(radians),
    b: Math.sin(radians),
    c: -Math.sin(radians),
    d: Math.cos(radians),
    e: 0,
    f: 0,
  };
};

const scaleMatrix = (x: number, y: number): ThemeV2TransformMatrix => ({
  a: x,
  b: 0,
  c: 0,
  d: y,
  e: 0,
  f: 0,
});

const aroundPoint = (
  x: number,
  y: number,
  matrix: ThemeV2TransformMatrix
): ThemeV2TransformMatrix =>
  multiplyMatrices(translateMatrix(x, y), multiplyMatrices(matrix, translateMatrix(-x, -y)));

const cleanMatrix = (matrix: ThemeV2TransformMatrix): ThemeV2TransformMatrix => {
  const clean = (value: number) => {
    const rounded = Math.round(value * 100000) / 100000;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return {
    a: clean(matrix.a),
    b: clean(matrix.b),
    c: clean(matrix.c),
    d: clean(matrix.d),
    e: clean(matrix.e),
    f: clean(matrix.f),
  };
};

/** Bounds of every layer inside a group, including nested groups. */
export const themeGroupBounds = (
  groups: ThemeV2Group[] | undefined,
  elements: ThemeV2Element[],
  groupId: string
) => {
  const members = elements.filter((element) =>
    themeGroupAncestors(groups, element).some((group) => group.id === groupId)
  );
  if (members.length === 0) return undefined;

  const left = Math.min(...members.map((element) => element.x));
  const top = Math.min(...members.map((element) => element.y));
  const right = Math.max(...members.map((element) => element.x + element.width));
  const bottom = Math.max(...members.map((element) => element.y + element.height));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
};

export type ThemeV2Point = { x: number; y: number };

/** Applies an affine transform to a point in stage coordinates. */
export const themeTransformPoint = (
  matrix: ThemeV2TransformMatrix,
  x: number,
  y: number
): ThemeV2Point => ({
  x: matrix.a * x + matrix.c * y + matrix.e,
  y: matrix.b * x + matrix.d * y + matrix.f,
});

const transformScaleX = (transform: ThemeV2Transform) =>
  Math.max(0.05, finite(transform.scaleX, finite(transform.scale, 1)));

const transformScaleY = (transform: ThemeV2Transform) =>
  Math.max(0.05, finite(transform.scaleY, finite(transform.scale, 1)));

const skewMatrix = (skewX: number, skewY: number): ThemeV2TransformMatrix => {
  const x = Math.tan((finite(skewX, 0) * Math.PI) / 180);
  const y = Math.tan((finite(skewY, 0) * Math.PI) / 180);
  return { a: 1, b: y, c: x, d: 1, e: 0, f: 0 };
};

/** Skew and scale, without rotation; useful for gesture math. */
export const themeTransformScaleMatrix = (transform: ThemeV2Transform): ThemeV2TransformMatrix =>
  multiplyMatrices(
    skewMatrix(finite(transform.skewX, 0), finite(transform.skewY, 0)),
    scaleMatrix(
      transformScaleX(transform) * (transform.flipX ? -1 : 1),
      transformScaleY(transform) * (transform.flipY ? -1 : 1)
    )
  );

/** Complete 2D linear transform: rotate, then skew, then scale and flips. */
export const themeTransformLinearMatrix = (transform: ThemeV2Transform): ThemeV2TransformMatrix =>
  multiplyMatrices(
    rotateMatrix(finite(transform.rotation, 0)),
    themeTransformScaleMatrix(transform)
  );

const themeGroupOwnMatrix = (
  group: ThemeV2Group,
  bounds: { centerX: number; centerY: number }
): ThemeV2TransformMatrix => {
  return multiplyMatrices(
    translateMatrix(
      finite(group.offsetX, 0) + bounds.centerX,
      finite(group.offsetY, 0) + bounds.centerY
    ),
    multiplyMatrices(
      themeTransformLinearMatrix(group),
      translateMatrix(-bounds.centerX, -bounds.centerY)
    )
  );
};

const themeGroupMatrix = (
  group: ThemeV2Group,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[],
  seen: Set<string>
): ThemeV2TransformMatrix => {
  if (seen.has(group.id)) return IDENTITY_MATRIX;
  seen.add(group.id);

  const bounds = themeGroupBounds(groups, elements, group.id);
  const own = bounds ? themeGroupOwnMatrix(group, bounds) : IDENTITY_MATRIX;
  const parent = group.parentId
    ? groups.find((candidate) => candidate.id === group.parentId)
    : undefined;
  const parentMatrix = parent ? themeGroupMatrix(parent, elements, groups, seen) : IDENTITY_MATRIX;
  return cleanMatrix(multiplyMatrices(parentMatrix, own));
};

/**
 * Stage transform for a group itself, including nested ancestor groups. Use
 * this to draw a group's selection frame; layer matrices include the layer's
 * local transform as well.
 */
export const themeGroupTransformMatrix = (
  group: ThemeV2Group,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[] = []
): ThemeV2TransformMatrix => themeGroupMatrix(group, elements, groups, new Set());

/**
 * Transform applied by a group's ancestors. Offsets are expressed in this
 * parent space, so screen-space drag deltas must be mapped through its inverse.
 */
export const themeGroupParentMatrix = (
  group: ThemeV2Group,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[] = []
): ThemeV2TransformMatrix => {
  const parent = group.parentId
    ? groups.find((candidate) => candidate.id === group.parentId)
    : undefined;
  return parent ? themeGroupTransformMatrix(parent, elements, groups) : IDENTITY_MATRIX;
};

/**
 * Local affine transform for a layer, including its own rotation, skew,
 * non-uniform scale and flips, plus every ancestor group's transform around
 * that group's bounds.
 */
export const themeElementTransformMatrix = (
  element: ThemeV2Element,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[] = []
): ThemeV2TransformMatrix => {
  const elementTransform = aroundPoint(
    element.width / 2,
    element.height / 2,
    themeTransformLinearMatrix(element)
  );

  let matrix = elementTransform;
  for (const group of themeGroupAncestors(groups, element)) {
    const bounds = themeGroupBounds(groups, elements, group.id);
    if (!bounds) continue;

    const centerX = bounds.centerX - element.x;
    const centerY = bounds.centerY - element.y;
    const local = multiplyMatrices(
      translateMatrix(finite(group.offsetX, 0) + centerX, finite(group.offsetY, 0) + centerY),
      multiplyMatrices(themeTransformLinearMatrix(group), translateMatrix(-centerX, -centerY))
    );
    matrix = multiplyMatrices(local, matrix);
  }

  return cleanMatrix(matrix);
};

/** CSS transform value for a layer, using the matrix computed above. */
export const themeElementTransformCss = (
  element: ThemeV2Element,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[] = []
) => {
  const matrix = themeElementTransformMatrix(element, elements, groups) ?? IDENTITY_MATRIX;
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
};

/** CSS declarations for text decoration, fill and visual effects. */
export const themeTextStyleCss = (element: ThemeV2TextStyle) => {
  const color = element.color ?? '#ffffff';
  const gradient = element.fillMode === 'gradient';
  const from = element.gradientFrom ?? '#ff006e';
  const to = element.gradientTo ?? '#7c3aed';
  const decoration = element.textDecoration ?? 'none';
  const fontSize = element.fontSize ?? 28;
  const parts = [
    `font-style:${element.fontStyle === 'italic' ? 'italic' : 'normal'}`,
    `text-transform:${element.textTransform ?? 'none'}`,
    `text-decoration-line:${decoration}`,
  ];

  if (gradient) {
    parts.push(
      `background-image:linear-gradient(${element.gradientAngle ?? 90}deg, ${from}, ${to})`,
      'background-clip:text',
      '-webkit-background-clip:text',
      '-webkit-text-fill-color:transparent',
      'color:transparent'
    );
  } else {
    parts.push(`color:${color}`);
  }

  if (decoration !== 'none') {
    parts.push(
      `text-decoration-color:${gradient ? from : color}`,
      `text-decoration-thickness:${Math.max(1, Math.round(fontSize * 0.06))}px`,
      `text-underline-offset:${Math.max(1, Math.round(fontSize * 0.08))}px`
    );
  }

  const outlineWidth = element.outlineWidth ?? 0;
  if (outlineWidth > 0) {
    parts.push(
      `-webkit-text-stroke:${outlineWidth}px ${element.outlineColor ?? '#000000'}`,
      'paint-order:stroke fill'
    );
  }

  const shadowBlur = element.shadowBlur ?? 0;
  const shadowX = element.shadowOffsetX ?? 0;
  const shadowY = element.shadowOffsetY ?? 0;
  if (shadowBlur > 0 || shadowX !== 0 || shadowY !== 0) {
    parts.push(
      `text-shadow:${shadowX}px ${shadowY}px ${shadowBlur}px ${element.shadowColor ?? '#000000'}`
    );
  }

  return parts.join(';');
};

/** Regular polygon or star points, in percentages of the layer bounds. */
export const themeMaskPolygonPoints = (
  sides = 6,
  star = false,
  innerRadius = 0.5
): ThemeV2Point[] => {
  const count = Math.max(3, Math.min(24, Math.round(sides))) * (star ? 2 : 1);
  const points: ThemeV2Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    const radius = star && index % 2 === 1 ? Math.min(0.95, Math.max(0.1, innerRadius)) : 1;
    points.push({ x: 50 + Math.cos(angle) * 50 * radius, y: 50 + Math.sin(angle) * 50 * radius });
  }
  return points;
};

/** CSS `clip-path` for a shape mask, or an empty string for image masks. */
export const themeMaskClipPath = (mask: ThemeV2Mask | undefined) => {
  if (!mask) return '';
  if (mask.shape === 'rectangle') {
    return `inset(0 round ${Math.max(0, Math.round(mask.radius ?? 0))}px)`;
  }
  if (mask.shape === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (mask.shape === 'image') return '';
  const points = themeMaskPolygonPoints(
    mask.sides ?? 6,
    mask.shape === 'star',
    mask.innerRadius ?? 0.5
  );
  return `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(', ')})`;
};

/** CSS declarations for an image mask. */
export const themeMaskImageCss = (mask: ThemeV2Mask | undefined, url: string | undefined) => {
  if (!mask || mask.shape !== 'image' || !url) return '';
  const safeUrl = url.replace(/["\\)]/g, '');
  return [
    `-webkit-mask-image:url("${safeUrl}")`,
    `mask-image:url("${safeUrl}")`,
    `-webkit-mask-size:${mask.fit === 'contain' ? 'contain' : '100% 100%'}`,
    `mask-size:${mask.fit === 'contain' ? 'contain' : '100% 100%'}`,
    '-webkit-mask-position:center',
    'mask-position:center',
    '-webkit-mask-repeat:no-repeat',
    'mask-repeat:no-repeat',
  ].join(';');
};

/**
 * Clip/mask CSS for a group, expressed in stage coordinates. Groups render
 * their layers in a stage-sized wrapper, so the clip path is transformed with
 * the group's own matrix and the members keep their absolute positions.
 */
export const themeGroupMaskCss = (
  group: ThemeV2Group,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[],
  assetUrl: (path: string) => string
) => {
  const mask = group.mask;
  if (!mask) return '';
  const bounds = themeGroupBounds(groups, elements, group.id);
  if (!bounds) return '';

  if (mask.shape === 'image') {
    const url = mask.src ? assetUrl(mask.src) : '';
    if (!url) return '';
    const safeUrl = url.replace(/["\\)]/g, '');
    return [
      `-webkit-mask-image:url("${safeUrl}")`,
      `mask-image:url("${safeUrl}")`,
      `-webkit-mask-size:${mask.fit === 'contain' ? 'contain' : `${bounds.width}px ${bounds.height}px`}`,
      `mask-size:${mask.fit === 'contain' ? 'contain' : `${bounds.width}px ${bounds.height}px`}`,
      `-webkit-mask-position:${bounds.left}px ${bounds.top}px`,
      `mask-position:${bounds.left}px ${bounds.top}px`,
      '-webkit-mask-repeat:no-repeat',
      'mask-repeat:no-repeat',
    ].join(';');
  }

  const matrix = themeGroupTransformMatrix(group, elements, groups);
  const toStage = (x: number, y: number) =>
    themeTransformPoint(matrix, bounds.left + x, bounds.top + y);
  const points: ThemeV2Point[] = [];

  if (mask.shape === 'rectangle') {
    points.push(
      toStage(0, 0),
      toStage(bounds.width, 0),
      toStage(bounds.width, bounds.height),
      toStage(0, bounds.height)
    );
  } else if (mask.shape === 'ellipse') {
    const steps = 48;
    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      points.push(
        toStage(
          bounds.width / 2 + Math.cos(angle) * (bounds.width / 2),
          bounds.height / 2 + Math.sin(angle) * (bounds.height / 2)
        )
      );
    }
  } else {
    const shapePoints = themeMaskPolygonPoints(
      mask.sides ?? 6,
      mask.shape === 'star',
      mask.innerRadius ?? 0.5
    );
    for (const point of shapePoints) {
      points.push(toStage((point.x / 100) * bounds.width, (point.y / 100) * bounds.height));
    }
  }

  return `clip-path:polygon(${points
    .map((point) => `${Math.round(point.x * 100) / 100}px ${Math.round(point.y * 100) / 100}px`)
    .join(', ')})`;
};

/** CSS injected while a v2 theme is active. */
export const themeV2Css = (
  definition: ThemeV2Definition,
  assets = '',
  assetOverrides: Record<string, string> = {}
) => {
  const accent = definition.accentColor;
  const accentText = accent ? readableTextColor(accent) : '#ffffff';
  // `.dark` also defines the primary variables, so the override needs a
  // selector that is at least as specific as `html.dark`.
  const accentCss = accent
    ? `:root,:root.dark,:root.light{--primary:${accent};--primary-foreground:${accentText};--accent:${accent};--accent-foreground:${accentText};--ring:${accent};--color-primary:${accent};--color-primary-500:${accent};--color-primary-foreground:${accentText};--color-accent:${accent};--color-accent-foreground:${accentText};}`
    : '';
  const body = definition.typography?.body?.trim();
  const heading = definition.typography?.heading?.trim();
  const mono = definition.typography?.mono?.trim();
  const fontFaces = themeFontFaceCss(definition, assets, assetOverrides);
  const typographyCss = body
    ? `:root,:root.dark{--font-sans:${fontFamilyCss(body)},ui-sans-serif,system-ui,sans-serif;}body{font-family:${fontFamilyCss(body)},ui-sans-serif,system-ui,sans-serif;}`
    : '';
  const headingCss = heading
    ? `:root,:root.dark{--font-heading:${fontFamilyCss(heading)},ui-sans-serif,system-ui,sans-serif;}h1,h2,h3,h4,h5,h6,.theme-heading{font-family:${fontFamilyCss(heading)},ui-sans-serif,system-ui,sans-serif;}`
    : '';
  const monoCss = mono
    ? `:root,:root.dark{--font-mono:${fontFamilyCss(mono)},ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}`
    : '';
  return [accentCss, fontFaces, typographyCss, headingCss, monoCss, definition.css?.trim()]
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
