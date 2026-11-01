import {
  formatInteger,
  getThemeDataSampleValue,
  resolveThemeDataValue,
  themeGlobalData,
} from './themeData';
import { getThemeIconBody } from './themeIconCatalog';
import {
  themeArcGeometry,
  themeClockDate,
  themeClockTime,
  themeCountdownText,
  themeParticleSeeds,
  themeSvgGradientVector,
} from './themeLayers';
import { themeScriptInitialVariables } from './themeScript';
import { interpolateThemeText } from './themeTextVariables';
import {
  normalizeChrome,
  readableTextColor,
  themeElementTransformMatrix,
  themeFilterCss,
  themeGroupAncestors,
  themeGroupBounds,
  themeGroupTransformMatrix,
  themeMaskPolygonPoints,
  themeTransformPoint,
  type ThemeV2ButtonElement,
  type ThemeV2Chrome,
  type ThemeV2ClockElement,
  type ThemeV2CountdownElement,
  type ThemeV2DataElement,
  type ThemeV2Definition,
  type ThemeV2Element,
  type ThemeV2GaugeElement,
  type ThemeV2Group,
  type ThemeV2IconElement,
  type ThemeV2LottieElement,
  type ThemeV2ParticlesElement,
  type ThemeV2PathElement,
  type ThemeV2RepeaterElement,
  type ThemeV2ScriptValue,
  type ThemeV2ShapeElement,
  type ThemeV2TextElement,
  type ThemeV2TickerElement,
  type ThemeV2WidgetElement,
} from './themeV2';
import lottie from 'lottie-web';
import { get } from 'svelte/store';

const WIDTH = 1000;
const HEIGHT = 650;
const SIDEBAR_WIDTH = 85;
const FOOTER_HEIGHT = 80;
const DEFAULT_ACCENT = '#ff006e';
const DEFAULT_BODY_FONT = 'Sora Variable';

export type ThemePreviewAssetReader = (path: string) => Promise<Uint8Array | undefined>;

export type ThemePreviewOptions = {
  definition: ThemeV2Definition;
  /** Read a file inside the theme's `assets` directory. */
  readAsset: ThemePreviewAssetReader;
  logoUrl?: string;
};

type LoadedMedia = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

type PreviewContext = {
  ctx: CanvasRenderingContext2D;
  definition: ThemeV2Definition;
  readAsset: ThemePreviewAssetReader;
  objectUrls: string[];
  videos: HTMLVideoElement[];
  images: Map<string, Promise<LoadedMedia | undefined>>;
  videoFrames: Map<string, Promise<LoadedMedia | undefined>>;
  fonts: Map<string, string>;
  fontFamilies: Map<string, string>;
  icons: Map<string, Promise<LoadedMedia | undefined>>;
  variables: Record<string, ThemeV2ScriptValue>;
};

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
};

const FONT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

const assetExtension = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';

const mimeTypeFor = (path: string) => {
  const extension = assetExtension(path);
  return (
    IMAGE_TYPES[extension] ??
    VIDEO_TYPES[extension] ??
    FONT_TYPES[extension] ??
    'application/octet-stream'
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '').trim();
  let red: number;
  let green: number;
  let blue: number;
  let sourceAlpha = 1;

  if (value.length === 3) {
    red = parseInt(value[0] + value[0], 16);
    green = parseInt(value[1] + value[1], 16);
    blue = parseInt(value[2] + value[2], 16);
  } else if (value.length === 6 || value.length === 8) {
    red = parseInt(value.slice(0, 2), 16);
    green = parseInt(value.slice(2, 4), 16);
    blue = parseInt(value.slice(4, 6), 16);
    if (value.length === 8) sourceAlpha = parseInt(value.slice(6, 8), 16) / 255;
  } else {
    return hex;
  }

  if (![red, green, blue].every(Number.isFinite)) return hex;
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha * sourceAlpha, 0, 1)})`;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const fillRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
) => {
  ctx.save();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
};

const strokeRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth = 1
) => {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
  ctx.restore();
};

const quoteFamily = (family: string) => `"${family.replace(/["\\]/g, '\\$&')}"`;

const fontKey = (family: string, weight: string | number, style: string) =>
  `${family.trim().toLowerCase()}|${String(weight).trim()}|${style}`;

const resolveFontFamily = (
  context: PreviewContext,
  family: string,
  weight: string | number,
  style = 'normal'
) =>
  context.fonts.get(fontKey(family, weight, style)) ??
  context.fontFamilies.get(family.trim().toLowerCase()) ??
  family;

const canvasFont = (
  context: PreviewContext,
  family: string,
  size: number,
  weight: string | number = 400,
  style = 'normal'
) =>
  `${style} ${weight} ${size}px ${quoteFamily(
    resolveFontFamily(context, family, weight, style)
  )}, ui-sans-serif, system-ui, sans-serif`;

const loadHtmlImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The image took too long to load.'));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('The image could not be decoded.'));
    };
    image.src = url;
  });

const waitForMediaEvent = (
  media: HTMLVideoElement,
  eventName: 'loadeddata' | 'seeked',
  timeoutMs: number
) =>
  new Promise<void>((resolve, reject) => {
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener(eventName, done);
      media.removeEventListener('error', fail);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(`The video did not fire ${eventName}.`));
    };
    timeout = window.setTimeout(fail, timeoutMs);
    media.addEventListener(eventName, done, { once: true });
    media.addEventListener('error', fail, { once: true });
  });

const bytesToBlob = (bytes: Uint8Array, type: string) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
};

const readAssetBytes = async (context: PreviewContext, path: string) => {
  try {
    return await context.readAsset(path);
  } catch (error) {
    console.warn(`Could not read theme preview asset ${path}`, error);
    return undefined;
  }
};

const loadImageAsset = (context: PreviewContext, path: string) => {
  const cached = context.images.get(path);
  if (cached) return cached;

  const promise = (async () => {
    const bytes = await readAssetBytes(context, path);
    if (!bytes) return undefined;
    const url = URL.createObjectURL(bytesToBlob(bytes, mimeTypeFor(path)));
    context.objectUrls.push(url);
    const image = await loadHtmlImage(url);
    if (!image.naturalWidth || !image.naturalHeight) return undefined;
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  })().catch((error) => {
    console.warn(`Could not load theme preview image ${path}`, error);
    return undefined;
  });

  context.images.set(path, promise);
  return promise;
};

const loadThemeIcon = (context: PreviewContext, name: string, color: string) => {
  const set = context.definition.iconSet ?? 'lucide';
  const icon = getThemeIconBody(name, set);
  if (!icon) return Promise.resolve(undefined);

  const key = `${set}|${name}|${color}`;
  const cached = context.icons.get(key);
  if (cached) return cached;

  const safeColor = color.replace(/["<>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" color="${safeColor}">${icon.body}</svg>`;
  const promise = loadHtmlImage(`data:image/svg+xml,${encodeURIComponent(svg)}`)
    .then<LoadedMedia>((image) => ({
      source: image,
      width: icon.width,
      height: icon.height,
    }))
    .catch((error) => {
      console.warn(`Could not render the theme icon ${name}`, error);
      return undefined;
    });

  context.icons.set(key, promise);
  return promise;
};

const applyGroupMasks = (
  context: PreviewContext,
  ancestors: ThemeV2Group[],
  elements: ThemeV2Element[],
  groups: ThemeV2Group[]
) => {
  const { ctx } = context;
  for (const group of [...ancestors].reverse()) {
    const mask = group.mask;
    if (!mask || mask.shape === 'image') continue;
    const bounds = themeGroupBounds(groups, elements, group.id);
    if (!bounds) continue;
    const matrix = themeGroupTransformMatrix(group, elements, groups);
    const toStage = (x: number, y: number) =>
      themeTransformPoint(matrix, bounds.left + x, bounds.top + y);

    ctx.beginPath();
    if (mask.shape === 'rectangle') {
      const points = [
        toStage(0, 0),
        toStage(bounds.width, 0),
        toStage(bounds.width, bounds.height),
        toStage(0, bounds.height),
      ];
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
    } else if (mask.shape === 'ellipse') {
      const steps = 48;
      for (let index = 0; index < steps; index += 1) {
        const angle = (index / steps) * Math.PI * 2;
        const point = toStage(
          bounds.width / 2 + Math.cos(angle) * (bounds.width / 2),
          bounds.height / 2 + Math.sin(angle) * (bounds.height / 2)
        );
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
    } else {
      const points = themeMaskPolygonPoints(
        mask.sides ?? 6,
        mask.shape === 'star',
        mask.innerRadius ?? 0.5
      );
      points.forEach((point, index) => {
        const stage = toStage((point.x / 100) * bounds.width, (point.y / 100) * bounds.height);
        if (index === 0) ctx.moveTo(stage.x, stage.y);
        else ctx.lineTo(stage.x, stage.y);
      });
      ctx.closePath();
    }
    ctx.clip();
  }
};

const applyElementMask = (context: PreviewContext, element: ThemeV2Element) => {
  const mask = element.mask;
  if (!mask || mask.shape === 'image') return;
  const { ctx } = context;
  ctx.beginPath();
  if (mask.shape === 'rectangle') {
    roundRect(ctx, element.x, element.y, element.width, element.height, mask.radius ?? 0);
  } else if (mask.shape === 'ellipse') {
    ctx.ellipse(
      element.x + element.width / 2,
      element.y + element.height / 2,
      element.width / 2,
      element.height / 2,
      0,
      0,
      Math.PI * 2
    );
  } else {
    const points = themeMaskPolygonPoints(
      mask.sides ?? 6,
      mask.shape === 'star',
      mask.innerRadius ?? 0.5
    );
    points.forEach((point, index) => {
      const x = element.x + (point.x / 100) * element.width;
      const y = element.y + (point.y / 100) * element.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.clip();
};

const loadVideoFrame = (context: PreviewContext, path: string) => {
  const cached = context.videoFrames.get(path);
  if (cached) return cached;

  const promise = (async () => {
    const bytes = await readAssetBytes(context, path);
    if (!bytes) return undefined;
    const url = URL.createObjectURL(bytesToBlob(bytes, mimeTypeFor(path)));
    context.objectUrls.push(url);

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    context.videos.push(video);
    video.load();

    await waitForMediaEvent(video, 'loadeddata', 6000);
    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0.06) {
      video.currentTime = Math.min(duration * 0.1, duration - 0.02);
      await waitForMediaEvent(video, 'seeked', 3000);
    }
    if (!video.videoWidth || !video.videoHeight) return undefined;
    return { source: video, width: video.videoWidth, height: video.videoHeight };
  })().catch((error) => {
    console.warn(`Could not capture a video frame for ${path}`, error);
    return undefined;
  });

  context.videoFrames.set(path, promise);
  return promise;
};

const loadThemeFonts = async (context: PreviewContext) => {
  if (typeof document === 'undefined' || !document.fonts) return;

  const families = new Set<string>();
  const bodyFont = context.definition.typography?.body;
  const headingFont = context.definition.typography?.heading;
  const monoFont = context.definition.typography?.mono;
  if (bodyFont) families.add(bodyFont);
  if (headingFont) families.add(headingFont);
  if (monoFont) families.add(monoFont);
  for (const element of context.definition.elements ?? []) {
    if (element.type === 'text' && element.fontFamily) families.add(element.fontFamily);
  }

  // Bundled Fontsource families are imported globally but only downloaded when
  // used. Ask for the weights and styles we draw so the canvas does not fall
  // back to a system font on its first render.
  const requests = new Set<string>();
  for (const family of families) {
    for (const weight of [400, 600, 700]) {
      requests.add(`normal ${weight} 16px ${quoteFamily(family)}`);
    }
  }
  for (const element of context.definition.elements ?? []) {
    if (element.type !== 'text') continue;
    const family = element.fontFamily ?? bodyFont ?? DEFAULT_BODY_FONT;
    const style = element.fontStyle === 'italic' ? 'italic' : 'normal';
    const weight = element.fontWeight ?? 600;
    requests.add(`${style} ${weight} 16px ${quoteFamily(family)}`);
  }
  await Promise.all(
    [...requests].map((request) => document.fonts.load(request).catch(() => undefined))
  );
  await document.fonts.ready.catch(() => undefined);

  const fonts = context.definition.fonts ?? [];
  await Promise.all(
    fonts.map(async (font, index) => {
      const weight = font.weight?.trim() || '400';
      const style = font.style === 'italic' ? 'italic' : 'normal';
      const key = fontKey(font.family, weight, style);
      if (context.fonts.has(key)) return;

      const bytes = await readAssetBytes(context, font.src);
      if (!bytes) return;
      const url = URL.createObjectURL(bytesToBlob(bytes, mimeTypeFor(font.src)));
      context.objectUrls.push(url);
      const captureFamily = `EZPPPreview_${index}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const face = new FontFace(captureFamily, `url("${url}")`, {
          weight,
          style,
        });
        await face.load();
        document.fonts.add(face);
        context.fonts.set(key, captureFamily);
        if (!context.fontFamilies.has(font.family.trim().toLowerCase())) {
          context.fontFamilies.set(font.family.trim().toLowerCase(), captureFamily);
        }
      } catch (error) {
        console.warn(`Could not load theme preview font ${font.family}`, error);
      }
    })
  );
};

const drawGradientBackground = (context: PreviewContext, from: string, to: string, angle = 135) => {
  const { ctx } = context;
  const radians = (angle * Math.PI) / 180;
  const directionX = Math.sin(radians);
  const directionY = -Math.cos(radians);
  const length = Math.abs(WIDTH * directionX) + Math.abs(HEIGHT * directionY);
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const gradient = ctx.createLinearGradient(
    centerX - (directionX * length) / 2,
    centerY - (directionY * length) / 2,
    centerX + (directionX * length) / 2,
    centerY + (directionY * length) / 2
  );
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

const drawMedia = (
  context: PreviewContext,
  media: LoadedMedia,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: 'cover' | 'contain' = 'cover'
) => {
  const { ctx } = context;
  const scale =
    fit === 'contain'
      ? Math.min(width / media.width, height / media.height)
      : Math.max(width / media.width, height / media.height);
  const drawWidth = media.width * scale;
  const drawHeight = media.height * scale;
  ctx.drawImage(
    media.source,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
};

const drawTintedMedia = (
  context: PreviewContext,
  media: LoadedMedia,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: 'cover' | 'contain',
  tint: string
) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const offscreen = canvas.getContext('2d');
  if (!offscreen) return;

  const scale =
    fit === 'contain'
      ? Math.min(width / media.width, height / media.height)
      : Math.max(width / media.width, height / media.height);
  const drawWidth = media.width * scale;
  const drawHeight = media.height * scale;
  offscreen.drawImage(
    media.source,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  offscreen.globalCompositeOperation = 'source-in';
  offscreen.fillStyle = tint;
  offscreen.fillRect(0, 0, canvas.width, canvas.height);
  context.ctx.drawImage(canvas, x, y, width, height);
};

const supportsCanvasFilter = (ctx: CanvasRenderingContext2D) => {
  try {
    ctx.filter = 'blur(1px)';
    const supported = ctx.filter !== 'none';
    ctx.filter = 'none';
    return supported;
  } catch {
    return false;
  }
};

const drawFullBleedMedia = (
  context: PreviewContext,
  media: LoadedMedia,
  fit: 'cover' | 'contain',
  blur: number
) => {
  const { ctx } = context;
  ctx.save();
  if (blur > 0) {
    if (supportsCanvasFilter(ctx)) {
      ctx.filter = `blur(${blur}px)`;
    }
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(1.04, 1.04);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  }
  drawMedia(context, media, 0, 0, WIDTH, HEIGHT, fit);
  ctx.restore();
};

const drawVignette = (context: PreviewContext, strength: number) => {
  const { ctx } = context;
  const gradient = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    Math.min(WIDTH, HEIGHT) * 0.38,
    WIDTH / 2,
    HEIGHT / 2,
    Math.max(WIDTH, HEIGHT) * 0.75
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${clamp(strength, 0, 1)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const drawParticles = (context: PreviewContext) => {
  const { ctx, definition } = context;
  const effects = definition.effects;
  if (!effects || effects.type === 'none') return;

  const count = Math.min(120, Math.max(0, Math.round(effects.density ?? 30)));
  if (count === 0) return;
  const color = effects.color ?? '#ffffff';

  for (let index = 0; index < count; index += 1) {
    const value = (offset: number) => random(index + 1 + offset);
    const x = value(3) * WIDTH;
    const y = value(4) * HEIGHT;
    const size = effects.type === 'stars' ? 1 + value(1) * 2.5 : 4 + value(1) * 7;
    const alpha = 0.25 + value(7) * 0.65;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (effects.type === 'stars') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (effects.type === 'bubbles') {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effects.type === 'embers') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, size / 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (effects.type === 'petals') {
      ctx.translate(x, y);
      ctx.rotate(value(8) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, size / 2, size / 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};

const drawBackground = async (context: PreviewContext) => {
  const { ctx, definition } = context;
  const background = definition.background;
  const accent = definition.accentColor ?? DEFAULT_ACCENT;

  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = clamp(background.opacity ?? 1, 0, 1);

  if (background.type === 'color') {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (background.type === 'gradient') {
    drawGradientBackground(context, background.from, background.to, background.angle);
  } else {
    const media =
      background.type === 'video'
        ? await loadVideoFrame(context, background.src)
        : await loadImageAsset(context, background.src);

    if (media) {
      drawFullBleedMedia(context, media, background.fit ?? 'cover', background.blur ?? 0);
    } else {
      drawGradientBackground(context, rgba(accent, 0.35), '#09090b');
    }
  }

  ctx.restore();

  const overlay = definition.overlay;
  if (overlay && (overlay.opacity ?? 0) > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(overlay.opacity ?? 0, 0, 1);
    ctx.fillStyle = overlay.color ?? '#000000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  if (overlay && (overlay.vignette ?? 0) > 0) {
    drawVignette(context, overlay.vignette ?? 0);
  }

  drawParticles(context);
};

const drawIcon = (
  context: PreviewContext,
  name:
    | 'home'
    | 'paint'
    | 'palette'
    | 'settings'
    | 'sliders'
    | 'user'
    | 'play'
    | 'music'
    | 'brush'
    | 'wifi',
  centerX: number,
  centerY: number,
  size: number,
  color: string,
  lineWidth = 1.5
) => {
  const { ctx } = context;
  const half = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (name === 'home') {
    ctx.beginPath();
    ctx.moveTo(centerX - half, centerY - half * 0.05);
    ctx.lineTo(centerX, centerY - half * 0.82);
    ctx.lineTo(centerX + half, centerY - half * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - half * 0.62, centerY - half * 0.05);
    ctx.lineTo(centerX - half * 0.62, centerY + half * 0.75);
    ctx.lineTo(centerX + half * 0.62, centerY + half * 0.75);
    ctx.lineTo(centerX + half * 0.62, centerY - half * 0.05);
    ctx.stroke();
  } else if (name === 'paint' || name === 'brush') {
    ctx.beginPath();
    ctx.moveTo(centerX - half * 0.65, centerY + half * 0.65);
    ctx.lineTo(centerX + half * 0.15, centerY - half * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + half * 0.08, centerY - half * 0.58);
    ctx.lineTo(centerX + half * 0.58, centerY - half * 0.08);
    ctx.lineTo(centerX + half * 0.36, centerY + half * 0.18);
    ctx.lineTo(centerX - half * 0.14, centerY - half * 0.32);
    ctx.closePath();
    ctx.fill();
  } else if (name === 'palette') {
    ctx.beginPath();
    ctx.ellipse(
      centerX - half * 0.04,
      centerY + half * 0.02,
      half * 0.74,
      half * 0.62,
      -0.25,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX + half * 0.38, centerY + half * 0.22, half * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    for (const [x, y] of [
      [-0.38, -0.18],
      [-0.12, -0.4],
      [0.18, -0.42],
    ] as const) {
      ctx.beginPath();
      ctx.arc(centerX + half * x, centerY + half * y, half * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name === 'sliders') {
    for (let index = -1; index <= 1; index += 1) {
      const y = centerY + half * index * 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - half * 0.78, y);
      ctx.lineTo(centerX + half * 0.78, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + half * index * 0.38, y, half * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name === 'settings') {
    ctx.beginPath();
    ctx.arc(centerX, centerY, half * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * half * 0.46, centerY + Math.sin(angle) * half * 0.46);
      ctx.lineTo(centerX + Math.cos(angle) * half * 0.8, centerY + Math.sin(angle) * half * 0.8);
      ctx.stroke();
    }
  } else if (name === 'user') {
    ctx.beginPath();
    ctx.arc(centerX, centerY - half * 0.2, half * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY + half * 0.75, half * 0.62, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (name === 'play') {
    ctx.beginPath();
    ctx.moveTo(centerX - half * 0.35, centerY - half * 0.55);
    ctx.lineTo(centerX + half * 0.55, centerY);
    ctx.lineTo(centerX - half * 0.35, centerY + half * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (name === 'music') {
    ctx.beginPath();
    ctx.ellipse(
      centerX - half * 0.34,
      centerY + half * 0.48,
      half * 0.24,
      half * 0.18,
      -0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      centerX + half * 0.46,
      centerY + half * 0.3,
      half * 0.24,
      half * 0.18,
      -0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(centerX - half * 0.12, centerY + half * 0.4);
    ctx.lineTo(centerX - half * 0.12, centerY - half * 0.55);
    ctx.lineTo(centerX + half * 0.68, centerY - half * 0.72);
    ctx.lineTo(centerX + half * 0.68, centerY + half * 0.22);
    ctx.stroke();
  } else if (name === 'wifi') {
    ctx.beginPath();
    ctx.arc(centerX, centerY + half * 0.6, half * 0.18, 0, Math.PI * 2);
    ctx.fill();
    for (const [radius, start] of [
      [half * 0.45, 1.22],
      [half * 0.78, 1.16],
    ] as const) {
      ctx.beginPath();
      ctx.arc(centerX, centerY + half * 0.6, radius, -Math.PI + start, -start);
      ctx.stroke();
    }
  }

  ctx.restore();
};

const drawSidebar = (context: PreviewContext, logo?: LoadedMedia) => {
  const { ctx, definition } = context;
  const accent = definition.accentColor ?? DEFAULT_ACCENT;
  const accentText = readableTextColor(accent);
  const centerX = SIDEBAR_WIDTH / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, SIDEBAR_WIDTH, HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIDEBAR_WIDTH - 0.5, 0);
  ctx.lineTo(SIDEBAR_WIDTH - 0.5, HEIGHT);
  ctx.stroke();

  fillRoundedRect(ctx, 15, 12, 55, 55, 18, rgba(accent, 0.3));
  strokeRoundedRect(ctx, 15, 12, 55, 55, 18, 'rgba(255, 255, 255, 0.15)');

  if (logo) {
    ctx.save();
    roundRect(ctx, 21, 18, 43, 43, 12);
    ctx.clip();
    ctx.drawImage(logo.source, 21, 18, 43, 43);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = accentText;
    ctx.font = `700 16px ${quoteFamily('Sora Variable')}, ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EZ', centerX, 39.5);
    ctx.restore();
  }

  const navIcons = ['home', 'palette', 'sliders'] as const;
  navIcons.forEach((icon, index) => {
    const y = 99 + index * 60;
    const active = index === 0;
    fillRoundedRect(ctx, 18.5, y, 48, 48, 14, active ? accent : 'rgba(0, 0, 0, 0.2)');
    strokeRoundedRect(ctx, 18.5, y, 48, 48, 14, 'rgba(255, 255, 255, 0.15)');
    drawIcon(
      context,
      icon,
      centerX,
      y + 24,
      20,
      active ? accentText : 'rgba(255, 255, 255, 0.85)',
      1.6
    );
  });

  const avatarY = HEIGHT - 12 - 40;
  ctx.beginPath();
  ctx.arc(centerX, avatarY + 20, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  drawIcon(context, 'user', centerX, avatarY + 20, 20, 'rgba(255, 255, 255, 0.55)', 1.5);
};

const drawHeader = (context: PreviewContext) => {
  const { ctx, definition } = context;
  const contentX = SIDEBAR_WIDTH + 24;
  const bodyFont = definition.typography?.body || DEFAULT_BODY_FONT;
  const headingFont = definition.typography?.heading || bodyFont;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#ffffff';
  ctx.font = canvasFont(context, headingFont, 36, 700);
  ctx.fillText('EZPPLauncher', contentX, 48);

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = canvasFont(context, bodyFont, 16, 600);
  ctx.fillText('Hello Guest!', contentX, 91);
  ctx.restore();
};

const wrapText = (
  context: PreviewContext,
  text: string,
  maxWidth: number,
  font: string
): string[] => {
  const { ctx } = context;
  ctx.font = font;
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }

      let fragment = '';
      for (const character of word) {
        if (ctx.measureText(fragment + character).width > maxWidth) {
          if (fragment) lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }

  return lines;
};

const drawStatsCard = (context: PreviewContext) => {
  const { ctx, definition } = context;
  const bodyFont = definition.typography?.body || DEFAULT_BODY_FONT;
  const accent = definition.accentColor ?? DEFAULT_ACCENT;
  const accentText = readableTextColor(accent);
  const x = SIDEBAR_WIDTH + 4;
  const y = HEIGHT - FOOTER_HEIGHT - 200 + 4;
  const width = 288;
  const height = 192;
  const centerX = x + width / 2;

  fillRoundedRect(ctx, x, y, width, height, 6, 'rgba(0, 0, 0, 0.4)');
  strokeRoundedRect(ctx, x, y, width, height, 6, 'rgba(255, 255, 255, 0.06)');

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = canvasFont(context, bodyFont, 14, 600);
  ctx.fillText('See your stats here', centerX, y + 28);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  const descriptionFont = canvasFont(context, bodyFont, 12, 400);
  const description = wrapText(
    context,
    'Log in with your EZPPFarm account to track your rank, PP, accuracy and playcount.',
    width - 40,
    descriptionFont
  );
  ctx.font = descriptionFont;
  description.slice(0, 4).forEach((line, index) => {
    ctx.fillText(line, centerX, y + 51 + index * 15);
  });

  const buttonX = x + 12;
  const buttonWidth = width - 24;
  fillRoundedRect(ctx, buttonX, y + 116, buttonWidth, 28, 6, accent);
  ctx.fillStyle = accentText;
  ctx.font = canvasFont(context, bodyFont, 12, 500);
  ctx.textBaseline = 'middle';
  ctx.fillText('Log In', centerX, y + 130);

  fillRoundedRect(ctx, buttonX, y + 152, buttonWidth, 28, 6, 'rgba(0, 0, 0, 0.18)');
  strokeRoundedRect(ctx, buttonX, y + 152, buttonWidth, 28, 6, 'rgba(255, 255, 255, 0.1)');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText('Register', centerX, y + 166);
  ctx.restore();
};

const drawPill = (
  context: PreviewContext,
  x: number,
  centerY: number,
  label: string,
  textColor: string,
  background: string,
  border: string
) => {
  const { ctx } = context;
  ctx.save();
  ctx.font = `500 9px ${quoteFamily(DEFAULT_BODY_FONT)}, ui-sans-serif, sans-serif`;
  const width = ctx.measureText(label).width + 12;
  fillRoundedRect(ctx, x, centerY - 8, width, 16, 8, background);
  strokeRoundedRect(ctx, x, centerY - 8, width, 16, 8, border);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, centerY);
  ctx.restore();
  return width;
};

const drawFooter = (context: PreviewContext, chrome?: ThemeV2Chrome) => {
  const { ctx, definition } = context;
  const bodyFont = definition.typography?.body || DEFAULT_BODY_FONT;
  const accent = definition.accentColor ?? DEFAULT_ACCENT;
  const accentText = readableTextColor(accent);
  const top = HEIGHT - FOOTER_HEIGHT;
  const centerY = top + FOOTER_HEIGHT / 2;
  let x = SIDEBAR_WIDTH + 32;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(SIDEBAR_WIDTH, top, WIDTH - SIDEBAR_WIDTH, FOOTER_HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIDEBAR_WIDTH, top + 0.5);
  ctx.lineTo(WIDTH, top + 0.5);
  ctx.stroke();

  if (chrome?.dockTelemetry !== false) {
    const stats = [
      { icon: 'music' as const, color: '#60a5fa', value: '1.2k' },
      { icon: 'brush' as const, color: '#fbbf24', value: '42' },
      { icon: 'wifi' as const, color: '#34d399', value: '19ms' },
    ];

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const stat of stats) {
      drawIcon(context, stat.icon, x + 7, centerY, 14, stat.color, 1.4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = `500 11px ${quoteFamily(bodyFont)}, ui-sans-serif, sans-serif`;
      ctx.fillText(stat.value, x + 20, centerY);
      x += 20 + ctx.measureText(stat.value).width + 16;
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, centerY - 7);
    ctx.lineTo(x + 0.5, centerY + 7);
    ctx.stroke();
    x += 16;

    x +=
      drawPill(
        context,
        x,
        centerY,
        'stable',
        'rgba(255, 255, 255, 0.5)',
        'rgba(255, 255, 255, 0.1)',
        'rgba(255, 255, 255, 0.06)'
      ) + 16;
    x +=
      drawPill(
        context,
        x,
        centerY,
        '20260101.0',
        'rgba(255, 255, 255, 0.5)',
        'rgba(255, 255, 255, 0.1)',
        'rgba(255, 255, 255, 0.06)'
      ) + 16;
    drawPill(context, x, centerY, 'Default skin', accent, rgba(accent, 0.2), rgba(accent, 0.25));
  }

  const buttonWidth = 256;
  const buttonHeight = 48;
  const buttonX = WIDTH - 32 - buttonWidth;
  const buttonY = centerY - buttonHeight / 2;

  ctx.save();
  ctx.shadowColor = rgba(accent, 0.28);
  ctx.shadowBlur = 22;
  fillRoundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 24, accent);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(buttonX + 24, centerY, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();
  drawIcon(context, 'play', buttonX + 24, centerY, 16, accentText, 1.5);

  ctx.save();
  ctx.fillStyle = accentText;
  ctx.font = canvasFont(context, bodyFont, 14, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Launch', buttonX + 48 + (buttonWidth - 48) / 2, centerY);
  ctx.restore();
};

const getWidgetPlayerData = (_context: PreviewContext) => {
  const globalData = get(themeGlobalData);
  const name = globalData?.user?.name || getThemeDataSampleValue('user.name') || 'Player';
  const rank = globalData?.user?.stats?.osu?.rank
    ? `#${formatInteger(globalData.user.stats.osu.rank)}`
    : getThemeDataSampleValue('user.rank');
  const pp = globalData?.user?.stats?.osu?.pp
    ? `${formatInteger(globalData.user.stats.osu.pp)}pp`
    : getThemeDataSampleValue('user.pp');
  const acc = globalData?.user?.stats?.osu?.accuracy
    ? `${globalData.user.stats.osu.accuracy.toFixed(1)}%`
    : getThemeDataSampleValue('user.accuracy');
  const plays = globalData?.user?.stats?.osu?.plays
    ? formatInteger(globalData.user.stats.osu.plays)
    : getThemeDataSampleValue('user.plays');
  const level = 75;
  const levelProgress = 75;
  const country = globalData?.user?.country || 'US';
  return { name, rank, pp, acc, plays, level, levelProgress, country };
};

const drawWidgetElement = async (context: PreviewContext, element: ThemeV2WidgetElement) => {
  const { ctx, definition } = context;
  const bodyFont = definition.typography?.body || DEFAULT_BODY_FONT;
  const headingFont = definition.typography?.heading || bodyFont;
  const accent = definition.accentColor ?? DEFAULT_ACCENT;
  const accentText = readableTextColor(accent);

  if (element.widget === 'launch-button') {
    const isIconOnly = element.variant === 'icon-only' || element.variant === 'minimal';
    const isCompact = element.variant === 'compact';

    if (isIconOnly) {
      const radius = Math.min(element.width, element.height) / 2;
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;

      ctx.save();
      ctx.shadowColor = rgba(accent, 0.35);
      ctx.shadowBlur = 14;
      fillRoundedRect(ctx, element.x, element.y, element.width, element.height, radius, accent);
      ctx.restore();

      const iconSize = Math.min(element.width, element.height) * 0.42;
      drawIcon(context, 'play', centerX + 1, centerY, iconSize, accentText, 2);
    } else if (isCompact) {
      const radius = element.height / 2;
      const centerY = element.y + element.height / 2;

      ctx.save();
      ctx.shadowColor = rgba(accent, 0.3);
      ctx.shadowBlur = 12;
      fillRoundedRect(ctx, element.x, element.y, element.width, element.height, radius, accent);
      ctx.restore();

      const iconSize = Math.min(14, element.height * 0.35);
      ctx.save();
      ctx.font = canvasFont(context, bodyFont, Math.min(12, element.height * 0.32), 700);
      const text = 'Launch';
      const textWidth = ctx.measureText(text).width;
      const spacing = 7;
      const totalW = iconSize + spacing + textWidth;
      const startX = element.x + (element.width - totalW) / 2;

      drawIcon(context, 'play', startX + iconSize / 2, centerY, iconSize, accentText, 1.8);

      ctx.fillStyle = accentText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, startX + iconSize + spacing, centerY);
      ctx.restore();
    } else {
      // primary
      const radius = element.height / 2;
      const centerY = element.y + element.height / 2;

      ctx.save();
      ctx.shadowColor = rgba(accent, 0.35);
      ctx.shadowBlur = 18;
      fillRoundedRect(ctx, element.x, element.y, element.width, element.height, radius, accent);
      ctx.restore();

      const baseDim = Math.min(element.width, element.height);
      const circleR = Math.round(baseDim * 0.35);
      const circleX = element.x + baseDim / 2;
      ctx.beginPath();
      ctx.arc(circleX, centerY, circleR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fill();

      drawIcon(context, 'play', circleX + 1, centerY, circleR * 1.05, accentText, 1.8);

      ctx.save();
      ctx.fillStyle = accentText;
      const availableTextW = Math.max(50, element.width - baseDim);
      const textFontSize = Math.max(
        10,
        Math.min(Math.round(baseDim * 0.32), Math.round((availableTextW * 0.85) / 6))
      );
      ctx.font = canvasFont(context, bodyFont, textFontSize, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textCenterX = circleX + circleR + (element.x + element.width - (circleX + circleR)) / 2;
      ctx.fillText('Launch', textCenterX, centerY);
      ctx.restore();
    }
  } else if (element.widget === 'header') {
    const { name } = getWidgetPlayerData(context);
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const greeting = `${timeGreeting}, ${name}!`;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    if (element.variant === 'minimal') {
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, headingFont, Math.min(26, element.height * 0.65), 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('EZPPLauncher', element.x, element.y + element.height / 2);
    } else if (element.variant === 'compact') {
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, headingFont, Math.min(24, element.height * 0.55), 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const centerY = element.y + element.height / 2;
      ctx.fillText('EZPPLauncher', element.x, centerY);
      const titleWidth = ctx.measureText('EZPPLauncher').width;

      ctx.shadowColor = 'transparent';
      drawPill(
        context,
        element.x + titleWidth + 14,
        centerY,
        greeting,
        'rgba(255, 255, 255, 0.9)',
        'rgba(0, 0, 0, 0.45)',
        'rgba(255, 255, 255, 0.12)'
      );
    } else {
      // full
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, headingFont, Math.min(30, element.height * 0.52), 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('EZPPLauncher', element.x, element.y + 4);

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.font = canvasFont(context, bodyFont, Math.min(13, element.height * 0.28), 500);
      ctx.fillText(greeting, element.x, element.y + element.height - 20);
    }
    ctx.restore();
  } else if (element.widget === 'avatar') {
    const { country } = getWidgetPlayerData(context);
    const radius =
      element.variant === 'rounded'
        ? 16
        : element.variant === 'square'
          ? 8
          : Math.min(element.width, element.height) / 2;

    if (element.showOnlineRing !== false) {
      ctx.save();
      strokeRoundedRect(
        ctx,
        element.x - 2,
        element.y - 2,
        element.width + 4,
        element.height + 4,
        radius + 2,
        rgba(accent, 0.55),
        2
      );
      ctx.restore();
    }

    fillRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      radius,
      'rgba(15, 15, 22, 0.9)'
    );
    strokeRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      radius,
      'rgba(255, 255, 255, 0.15)',
      1
    );

    const iconSize = Math.min(element.width, element.height) * 0.48;
    drawIcon(
      context,
      'user',
      element.x + element.width / 2,
      element.y + element.height / 2,
      iconSize,
      accent,
      1.8
    );

    if (element.showCountry !== false && country) {
      const badgeW = 20;
      const badgeH = 14;
      const badgeX = element.x + element.width - badgeW + 2;
      const badgeY = element.y + element.height - badgeH + 2;
      fillRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4, 'rgba(0, 0, 0, 0.85)');
      strokeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4, 'rgba(255, 255, 255, 0.25)', 1);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(country.toUpperCase().slice(0, 2), badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }
  } else if (element.widget === 'telemetry') {
    const radius = element.height / 2;
    fillRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      radius,
      'rgba(0, 0, 0, 0.45)'
    );
    strokeRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      radius,
      'rgba(255, 255, 255, 0.12)',
      1
    );

    const centerY = element.y + element.height / 2;
    let cx = element.x + 16;

    drawIcon(context, 'wifi', cx, centerY, 13, '#34d399', 1.5);
    cx += 12;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `600 11px ${quoteFamily(bodyFont)}, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('19ms', cx, centerY);
    cx += ctx.measureText('19ms').width + 12;

    drawPill(
      context,
      cx,
      centerY,
      'stable',
      'rgba(255, 255, 255, 0.6)',
      'rgba(255, 255, 255, 0.1)',
      'rgba(255, 255, 255, 0.08)'
    );
    ctx.restore();
  } else if (element.widget === 'player-card') {
    const { name, rank, pp, level, levelProgress, acc, plays } = getWidgetPlayerData(context);

    if (element.variant === 'minimal') {
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      const centerY = element.y + element.height / 2;
      const avatarSize = Math.min(38, element.height - 14);
      const avatarX = element.x + 10;
      const avatarY = centerY - avatarSize / 2;

      fillRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 10, 'rgba(20, 20, 28, 0.9)');
      strokeRoundedRect(
        ctx,
        avatarX,
        avatarY,
        avatarSize,
        avatarSize,
        10,
        'rgba(255, 255, 255, 0.15)',
        1
      );
      drawIcon(
        context,
        'user',
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize * 0.48,
        accent,
        1.5
      );

      const textX = avatarX + avatarSize + 10;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 12, 700);
      ctx.textBaseline = 'bottom';
      ctx.fillText(name, textX, centerY - 1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = canvasFont(context, bodyFont, 10, 500);
      ctx.textBaseline = 'top';
      ctx.fillText(`${rank} · ${pp}`, textX, centerY + 1);

      const badgeW = 38;
      const badgeH = 18;
      const badgeX = element.x + element.width - badgeW - 10;
      fillRoundedRect(ctx, badgeX, centerY - badgeH / 2, badgeW, badgeH, 5, rgba(accent, 0.2));
      ctx.fillStyle = accent;
      ctx.font = canvasFont(context, bodyFont, 9, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Lv.${level}`, badgeX + badgeW / 2, centerY);
      ctx.restore();
    } else if (element.variant === 'compact') {
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      const avatarSize = 42;
      const avatarX = element.x + 14;
      const avatarY = element.y + 14;
      fillRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 12, 'rgba(20, 20, 28, 0.9)');
      strokeRoundedRect(
        ctx,
        avatarX,
        avatarY,
        avatarSize,
        avatarSize,
        12,
        'rgba(255, 255, 255, 0.15)',
        1
      );
      drawIcon(
        context,
        'user',
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize * 0.48,
        accent,
        1.5
      );

      const textX = avatarX + avatarSize + 12;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 13, 700);
      ctx.textBaseline = 'top';
      ctx.fillText(name, textX, avatarY + 2);
      const nameW = ctx.measureText(name).width;

      fillRoundedRect(ctx, textX + nameW + 8, avatarY + 1, 36, 17, 5, rgba(accent, 0.2));
      ctx.fillStyle = accent;
      ctx.font = canvasFont(context, bodyFont, 9, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Lv.${level}`, textX + nameW + 8 + 18, avatarY + 9.5);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = canvasFont(context, bodyFont, 10, 500);
      ctx.fillText(`${rank} · ${pp}`, textX, avatarY + 24);

      const bottomY = element.y + element.height - 38;
      const cellW = (element.width - 36) / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(element.x + 14, bottomY - 8);
      ctx.lineTo(element.x + element.width - 14, bottomY - 8);
      ctx.stroke();

      fillRoundedRect(ctx, element.x + 14, bottomY, cellW, 28, 8, 'rgba(255, 255, 255, 0.05)');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = canvasFont(context, bodyFont, 9, 500);
      ctx.textBaseline = 'middle';
      ctx.fillText('Accuracy', element.x + 22, bottomY + 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 11, 700);
      ctx.textAlign = 'right';
      ctx.fillText(acc, element.x + 14 + cellW - 8, bottomY + 14);

      const cell2X = element.x + 14 + cellW + 8;
      fillRoundedRect(ctx, cell2X, bottomY, cellW, 28, 8, 'rgba(255, 255, 255, 0.05)');
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = canvasFont(context, bodyFont, 9, 500);
      ctx.fillText('Plays', cell2X + 8, bottomY + 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 11, 700);
      ctx.textAlign = 'right';
      ctx.fillText(plays, cell2X + cellW - 8, bottomY + 14);
      ctx.restore();
    } else {
      // full
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      const avatarSize = 48;
      const avatarX = element.x + 16;
      const avatarY = element.y + 16;
      fillRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 12, 'rgba(20, 20, 28, 0.9)');
      strokeRoundedRect(
        ctx,
        avatarX,
        avatarY,
        avatarSize,
        avatarSize,
        12,
        'rgba(255, 255, 255, 0.15)',
        1
      );
      drawIcon(
        context,
        'user',
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize * 0.48,
        accent,
        1.5
      );

      const textX = avatarX + avatarSize + 14;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 14, 700);
      ctx.textBaseline = 'top';
      ctx.fillText(name, textX, avatarY + 3);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = canvasFont(context, bodyFont, 11, 600);
      ctx.fillText(`Lv.${level}`, textX, avatarY + 26);
      const lvW = ctx.measureText(`Lv.${level}`).width;

      const barX = textX + lvW + 8;
      const barY = avatarY + 30;
      const barW = Math.max(50, Math.min(100, element.width - barX - 60));
      fillRoundedRect(ctx, barX, barY, barW, 6, 3, 'rgba(255, 255, 255, 0.1)');
      fillRoundedRect(ctx, barX, barY, barW * (levelProgress / 100), 6, 3, accent);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '500 10px monospace';
      ctx.fillText(`${levelProgress}%`, barX + barW + 8, barY - 2);

      const divY = avatarY + avatarSize + 16;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(element.x + 16, divY);
      ctx.lineTo(element.x + element.width - 16, divY);
      ctx.stroke();

      const gridY = divY + 12;
      const gap = 8;
      const cellW = (element.width - 32 - gap) / 2;
      const cellH = Math.max(34, (element.height - (gridY - element.y) - 14 - gap) / 2);

      const stats = [
        { label: 'Rank', value: rank, valueColor: '#ffffff' },
        { label: 'Performance', value: pp, valueColor: accent },
        { label: 'Accuracy', value: acc, valueColor: '#ffffff' },
        { label: 'Plays', value: plays, valueColor: '#ffffff' },
      ];

      stats.forEach((st, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = element.x + 16 + col * (cellW + gap);
        const cy = gridY + row * (cellH + gap);

        fillRoundedRect(ctx, cx, cy, cellW, cellH, 10, 'rgba(255, 255, 255, 0.05)');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = canvasFont(context, bodyFont, 9, 500);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(st.label, cx + 10, cy + 6);

        ctx.fillStyle = st.valueColor;
        ctx.font = canvasFont(context, bodyFont, 12, 700);
        ctx.fillText(st.value, cx + 10, cy + cellH - 18);
      });
      ctx.restore();
    }
  } else if (element.widget === 'recent-activity') {
    if (element.variant === 'minimal') {
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      const centerY = element.y + element.height / 2;
      const coverSize = Math.min(38, element.height - 14);
      const coverX = element.x + 10;
      const coverY = centerY - coverSize / 2;

      fillRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 8, 'rgba(25, 20, 45, 0.9)');
      strokeRoundedRect(
        ctx,
        coverX,
        coverY,
        coverSize,
        coverSize,
        8,
        'rgba(255, 255, 255, 0.15)',
        1
      );
      drawIcon(
        context,
        'music',
        coverX + coverSize / 2,
        coverY + coverSize / 2,
        coverSize * 0.45,
        '#60a5fa',
        1.5
      );

      const textX = coverX + coverSize + 10;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 12, 700);
      ctx.textBaseline = 'bottom';
      ctx.fillText('Space Pirates', textX, centerY - 1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = canvasFont(context, bodyFont, 10, 500);
      ctx.textBaseline = 'top';
      ctx.fillText('Waterflame · 5d ago', textX, centerY + 1);

      const badgeW = 24;
      const badgeH = 20;
      const badgeX = element.x + element.width - badgeW - 10;
      fillRoundedRect(
        ctx,
        badgeX,
        centerY - badgeH / 2,
        badgeW,
        badgeH,
        4,
        'rgba(251, 191, 36, 0.2)'
      );
      strokeRoundedRect(
        ctx,
        badgeX,
        centerY - badgeH / 2,
        badgeW,
        badgeH,
        4,
        'rgba(251, 191, 36, 0.4)',
        1
      );
      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', badgeX + badgeW / 2, centerY);
      ctx.restore();
    } else if (element.variant === 'compact') {
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      ctx.save();
      roundRect(ctx, element.x, element.y, element.width, element.height, 16);
      ctx.clip();

      const bannerH = Math.min(60, element.height * 0.55);
      const bannerGrad = ctx.createLinearGradient(
        element.x,
        element.y,
        element.x,
        element.y + bannerH
      );
      bannerGrad.addColorStop(0, '#1e1b4b');
      bannerGrad.addColorStop(1, '#09090b');
      ctx.fillStyle = bannerGrad;
      ctx.fillRect(element.x, element.y, element.width, bannerH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = canvasFont(context, bodyFont, 9, 700);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('RECENT ACTIVITY', element.x + 12, element.y + 8);

      const badgeW = 20;
      const badgeH = 16;
      const badgeX = element.x + element.width - badgeW - 12;
      fillRoundedRect(ctx, badgeX, element.y + 7, badgeW, badgeH, 4, 'rgba(251, 191, 36, 0.2)');
      strokeRoundedRect(
        ctx,
        badgeX,
        element.y + 7,
        badgeW,
        badgeH,
        4,
        'rgba(251, 191, 36, 0.4)',
        1
      );
      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', badgeX + badgeW / 2, element.y + 7 + badgeH / 2);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 12, 700);
      ctx.fillText('Space Pirates', element.x + 12, element.y + bannerH - 18);

      const bottomCenterY = element.y + bannerH + (element.height - bannerH) / 2;
      ctx.fillStyle = accent;
      ctx.font = canvasFont(context, bodyFont, 10, 600);
      ctx.textBaseline = 'middle';
      ctx.fillText('[Galactic Thieves]', element.x + 12, bottomCenterY);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = canvasFont(context, bodyFont, 10, 700);
      ctx.fillText('Rank #1', element.x + element.width - 12, bottomCenterY);
      ctx.restore();
    } else {
      // full
      fillRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(0, 0, 0, 0.55)'
      );
      strokeRoundedRect(
        ctx,
        element.x,
        element.y,
        element.width,
        element.height,
        16,
        'rgba(255, 255, 255, 0.1)',
        1
      );

      ctx.save();
      roundRect(ctx, element.x, element.y, element.width, element.height, 16);
      ctx.clip();

      const bannerH = 80;
      const bannerGrad = ctx.createLinearGradient(
        element.x,
        element.y,
        element.x,
        element.y + bannerH
      );
      bannerGrad.addColorStop(0, '#1e1b4b');
      bannerGrad.addColorStop(1, '#09090b');
      ctx.fillStyle = bannerGrad;
      ctx.fillRect(element.x, element.y, element.width, bannerH);

      drawPill(
        context,
        element.x + 12,
        element.y + 16,
        'RECENT ACTIVITY',
        'rgba(255, 255, 255, 0.9)',
        'rgba(0, 0, 0, 0.5)',
        'rgba(255, 255, 255, 0.1)'
      );

      const badgeW = 24;
      const badgeH = 18;
      const badgeX = element.x + element.width - badgeW - 14;
      fillRoundedRect(ctx, badgeX, element.y + 8, badgeW, badgeH, 4, 'rgba(251, 191, 36, 0.2)');
      strokeRoundedRect(
        ctx,
        badgeX,
        element.y + 8,
        badgeW,
        badgeH,
        4,
        'rgba(251, 191, 36, 0.4)',
        1
      );
      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', badgeX + badgeW / 2, element.y + 8 + badgeH / 2);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = canvasFont(context, bodyFont, 13, 700);
      ctx.textBaseline = 'top';
      ctx.fillText('Space Pirates', element.x + 12, element.y + 44);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = canvasFont(context, bodyFont, 10, 500);
      ctx.fillText('Waterflame', element.x + 12, element.y + 60);

      const bodyTop = element.y + bannerH + 12;
      ctx.fillStyle = accent;
      ctx.font = canvasFont(context, bodyFont, 11, 600);
      ctx.fillText('[Galactic Thieves]', element.x + 12, bodyTop);

      drawPill(
        context,
        element.x + element.width - 70,
        bodyTop + 6,
        'Rank #1',
        '#fbbf24',
        'rgba(251, 191, 36, 0.12)',
        'rgba(251, 191, 36, 0.25)'
      );

      const divY = bodyTop + 24;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(element.x + 12, divY);
      ctx.lineTo(element.x + element.width - 12, divY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = canvasFont(context, bodyFont, 10, 500);
      ctx.fillText('5d ago', element.x + 12, divY + 8);

      ctx.textAlign = 'right';
      ctx.fillText('ez-pp.farm', element.x + element.width - 12, divY + 8);

      ctx.restore();
    }
  }
};

const drawDashboardCards = async (context: PreviewContext, chrome: ThemeV2Chrome) => {
  if (chrome.playerCard !== false) {
    const playerWidget: ThemeV2WidgetElement = {
      id: '__dashboard_player_card__',
      type: 'widget',
      widget: 'player-card',
      variant: 'full',
      x: SIDEBAR_WIDTH + 32,
      y: 190,
      width: 380,
      height: 220,
    };
    await drawWidgetElement(context, playerWidget);
  }

  if (chrome.recentActivity !== false) {
    const activityWidget: ThemeV2WidgetElement = {
      id: '__dashboard_activity_card__',
      type: 'widget',
      widget: 'recent-activity',
      variant: 'full',
      x: SIDEBAR_WIDTH + 32 + (chrome.playerCard !== false ? 400 : 0),
      y: 190,
      width: 380,
      height: 220,
    };
    await drawWidgetElement(context, activityWidget);
  }
};

const transformText = (text: string, transform: ThemeV2TextElement['textTransform']) => {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize')
    return text.replace(/\b\w/g, (character) => character.toUpperCase());
  return text;
};

const textGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angle: number,
  from: string,
  to: string
) => {
  const radians = (angle * Math.PI) / 180;
  const directionX = Math.sin(radians);
  const directionY = -Math.cos(radians);
  const length = Math.abs(width * directionX) + Math.abs(height * directionY);
  const centerX = width / 2;
  const centerY = height / 2;
  const gradient = ctx.createLinearGradient(
    centerX - (directionX * length) / 2,
    centerY - (directionY * length) / 2,
    centerX + (directionX * length) / 2,
    centerY + (directionY * length) / 2
  );
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
};

const drawTextElement = (context: PreviewContext, element: ThemeV2TextElement) => {
  const { ctx } = context;
  const fontSize = element.fontSize ?? 28;
  const fontWeight = element.fontWeight ?? 600;
  const fontStyle = element.fontStyle === 'italic' ? 'italic' : 'normal';
  const lineHeight = fontSize * (element.lineHeight ?? 1.2);
  const font = canvasFont(
    context,
    element.fontFamily ?? DEFAULT_BODY_FONT,
    fontSize,
    fontWeight,
    fontStyle
  );
  const text = transformText(
    interpolateThemeText(element.text, context.variables),
    element.textTransform
  );
  const lines = wrapText(context, text, element.width, font);
  const decoration = element.textDecoration ?? 'none';
  const underline = decoration.includes('underline');
  const strike = decoration.includes('line-through');
  const outlineWidth = element.outlineWidth ?? 0;
  const shadowBlur = element.shadowBlur ?? 0;
  const shadowX = element.shadowOffsetX ?? 0;
  const shadowY = element.shadowOffsetY ?? 0;
  const hasShadow = shadowBlur > 0 || shadowX !== 0 || shadowY !== 0;
  const fill =
    element.fillMode === 'gradient'
      ? textGradient(
          ctx,
          element.width,
          element.height,
          element.gradientAngle ?? 90,
          element.gradientFrom ?? '#ff006e',
          element.gradientTo ?? '#7c3aed'
        )
      : (element.color ?? '#ffffff');

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, element.width, element.height);
  ctx.clip();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textBaseline = 'top';
  ctx.textAlign =
    element.align === 'center' ? 'center' : element.align === 'right' ? 'right' : 'left';

  const totalHeight = lines.length * lineHeight;
  const startY =
    element.verticalAlign === 'center'
      ? (element.height - totalHeight) / 2
      : element.verticalAlign === 'bottom'
        ? element.height - totalHeight
        : 0;
  const textX =
    element.align === 'center' ? element.width / 2 : element.align === 'right' ? element.width : 0;

  const spacing = element.letterSpacing ?? 0;
  if (spacing !== 0) {
    const ctxWithSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    ctxWithSpacing.letterSpacing = `${spacing}px`;
  }

  if (hasShadow) {
    ctx.shadowColor = element.shadowColor ?? '#000000';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowX;
    ctx.shadowOffsetY = shadowY;
  }
  if (outlineWidth > 0) {
    ctx.strokeStyle = element.outlineColor ?? '#000000';
    ctx.lineWidth = outlineWidth * 2;
    ctx.lineJoin = 'round';
  }

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (outlineWidth > 0) ctx.strokeText(line, textX, y);
    ctx.fillText(line, textX, y);

    if ((underline || strike) && line.trim()) {
      const lineWidth = ctx.measureText(line).width;
      const x =
        element.align === 'center'
          ? textX - lineWidth / 2
          : element.align === 'right'
            ? textX - lineWidth
            : textX;
      const baseline = y + fontSize * 0.82;

      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.beginPath();
      if (underline) {
        const underlineY = baseline + fontSize * 0.08;
        ctx.moveTo(x, underlineY);
        ctx.lineTo(x + lineWidth, underlineY);
      }
      if (strike) {
        const strikeY = baseline - fontSize * 0.3;
        ctx.moveTo(x, strikeY);
        ctx.lineTo(x + lineWidth, strikeY);
      }
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.restore();
};

const drawDataElement = (context: PreviewContext, element: ThemeV2DataElement) => {
  const raw = resolveThemeDataValue(element.field, {
    global: get(themeGlobalData),
    theme: {
      name: context.definition.name,
      author: context.definition.author,
      version: context.definition.version,
    },
    screen: 'home',
    mode: element.mode,
  });
  const fallback = element.defaultValue ?? '';
  const sample = getThemeDataSampleValue(element.field, element.mode);
  const value =
    raw && raw.trim() !== '' ? raw : fallback && fallback.trim() !== '' ? fallback : sample;
  const template = element.text?.trim() ? element.text : '{value}';
  const text = interpolateThemeText(
    template
      .replaceAll('{value}', value)
      .replaceAll('{defaultValue}', fallback)
      .replaceAll('{fallback}', fallback),
    context.variables
  );
  drawTextElement(context, { ...element, type: 'text', text } as ThemeV2TextElement);
};

const shapeGradient = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  from: string,
  to: string
) => {
  const radians = (angle * Math.PI) / 180;
  const directionX = Math.sin(radians);
  const directionY = -Math.cos(radians);
  const length = Math.abs(width * directionX) + Math.abs(height * directionY);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const gradient = ctx.createLinearGradient(
    centerX - (directionX * length) / 2,
    centerY - (directionY * length) / 2,
    centerX + (directionX * length) / 2,
    centerY + (directionY * length) / 2
  );
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
};

const drawShapeElement = (context: PreviewContext, element: ThemeV2ShapeElement) => {
  const { ctx } = context;
  const { x, y, width, height } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  if (element.shape === 'arc') {
    const geometry = themeArcGeometry(
      element.startAngle ?? 0,
      element.endAngle ?? 270,
      element.thickness ?? 12,
      width,
      height
    );
    const size = Math.max(1, Math.min(width, height));
    ctx.save();
    ctx.translate(x + (width - size) / 2, y + (height - size) / 2);
    ctx.scale(size / 100, size / 100);
    ctx.strokeStyle =
      element.fillMode === 'gradient'
        ? shapeGradient(
            ctx,
            0,
            0,
            100,
            100,
            element.gradientAngle ?? 135,
            element.gradientFrom ?? '#ff006e',
            element.gradientTo ?? '#7c3aed'
          )
        : (element.fill ?? '#ff006e');
    ctx.lineWidth = geometry.strokeWidth;
    ctx.lineCap = element.rounded === false ? 'butt' : 'round';
    ctx.stroke(new Path2D(geometry.d));
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  if (element.shape === 'ellipse') {
    ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (element.shape === 'polygon' || element.shape === 'star') {
    const points = themeMaskPolygonPoints(
      element.points ?? 6,
      element.shape === 'star',
      element.innerRadius ?? 0.5
    );
    points.forEach((point, index) => {
      const px = x + (point.x / 100) * width;
      const py = y + (point.y / 100) * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  } else {
    roundRect(ctx, x, y, width, height, element.radius ?? 16);
  }

  ctx.fillStyle =
    element.fillMode === 'gradient'
      ? shapeGradient(
          ctx,
          x,
          y,
          width,
          height,
          element.gradientAngle ?? 135,
          element.gradientFrom ?? '#ff006e',
          element.gradientTo ?? '#7c3aed'
        )
      : (element.fill ?? '#ff006e');
  ctx.fill();

  if ((element.borderWidth ?? 0) > 0) {
    ctx.strokeStyle = element.borderColor ?? '#ffffff';
    ctx.lineWidth = element.borderWidth ?? 0;
    if (element.borderStyle === 'dashed') ctx.setLineDash([10, 6]);
    else if (element.borderStyle === 'dotted') ctx.setLineDash([2, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
};

const drawIconElement = async (context: PreviewContext, element: ThemeV2IconElement) => {
  const { ctx } = context;
  const size = Math.min(element.width, element.height) * ((element.scale ?? 100) / 100);
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const color = element.color ?? '#ffffff';
  const icon = await loadThemeIcon(context, element.icon, color);

  ctx.save();
  if (icon) {
    ctx.drawImage(icon.source, centerX - size / 2, centerY - size / 2, size, size);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

const drawRepeaterElement = async (context: PreviewContext, element: ThemeV2RepeaterElement) => {
  const { ctx } = context;
  const tileWidth = Math.max(4, element.tileWidth ?? 28);
  const tileHeight = Math.max(4, element.tileHeight ?? 28);
  const gapX = Math.max(0, element.gapX ?? 8);
  const gapY = Math.max(0, element.gapY ?? 8);
  const columns =
    element.columns && element.columns > 0
      ? element.columns
      : Math.max(1, Math.floor((element.width + gapX) / (tileWidth + gapX)));
  const rows =
    element.rows && element.rows > 0
      ? element.rows
      : Math.max(1, Math.floor((element.height + gapY) / (tileHeight + gapY)));
  const total = Math.min(240, columns * rows);

  const media =
    element.source === 'image' && element.src
      ? await loadImageAsset(context, element.src)
      : undefined;
  const icon =
    element.source === 'icon'
      ? await loadThemeIcon(context, element.icon ?? 'music', element.color ?? '#ffffff')
      : undefined;

  ctx.save();
  ctx.beginPath();
  ctx.rect(element.x, element.y, element.width, element.height);
  ctx.clip();

  for (let index = 0; index < total; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = element.x + column * (tileWidth + gapX);
    const y = element.y + row * (tileHeight + gapY);
    if (media) {
      drawMedia(context, media, x, y, tileWidth, tileHeight, 'cover');
    } else if (icon) {
      const size = Math.min(tileWidth, tileHeight);
      ctx.drawImage(
        icon.source,
        x + (tileWidth - size) / 2,
        y + (tileHeight - size) / 2,
        size,
        size
      );
    }
  }

  ctx.restore();
};

const gaugeValue = (context: PreviewContext, element: ThemeV2GaugeElement) => {
  const bound = element.variable ? Number(context.variables[element.variable]) : Number.NaN;
  const value = Number.isFinite(bound) ? bound : (element.value ?? 0.5);
  return clamp(value, 0, 1);
};

const drawGaugeElement = (context: PreviewContext, element: ThemeV2GaugeElement) => {
  const { ctx } = context;
  const percent = gaugeValue(context, element);
  const thickness = element.thickness ?? 12;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const trackColor = element.trackColor ?? '#000000';
  const fillColor = element.fillColor ?? '#ff006e';
  const rounded = element.rounded !== false;
  const label = (() => {
    const template = element.label?.trim() ? element.label : '';
    return interpolateThemeText(
      template
        .replaceAll('{percent}', String(Math.round(percent * 100)))
        .replaceAll('{value}', percent.toFixed(2)),
      context.variables
    );
  })();

  ctx.save();
  if (element.mode === 'ring') {
    const radius = Math.max(4, Math.min(element.width, element.height) / 2 - thickness / 2);
    ctx.lineWidth = thickness;
    ctx.lineCap = rounded ? 'round' : 'butt';
    ctx.strokeStyle = trackColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = fillColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent);
    ctx.stroke();
  } else {
    fillRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      rounded ? element.height / 2 : 0,
      trackColor
    );
    ctx.save();
    roundRect(
      ctx,
      element.x,
      element.y,
      element.width * percent,
      element.height,
      rounded ? element.height / 2 : 0
    );
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(element.x, element.y, element.width * percent, element.height);
    ctx.restore();
  }

  if (label) {
    ctx.fillStyle = element.labelColor ?? '#ffffff';
    ctx.font = canvasFont(
      context,
      element.fontFamily ?? DEFAULT_BODY_FONT,
      element.fontSize ?? 20,
      700
    );
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, centerY, element.width - 8);
  }
  ctx.restore();
};

const drawTickerElement = (context: PreviewContext, element: ThemeV2TickerElement) => {
  const { ctx } = context;
  ctx.save();
  if (element.background) {
    ctx.fillStyle = element.background;
    ctx.fillRect(element.x, element.y, element.width, element.height);
  }
  ctx.beginPath();
  ctx.rect(element.x, element.y, element.width, element.height);
  ctx.clip();
  ctx.fillStyle = element.color ?? '#ffffff';
  ctx.font = canvasFont(
    context,
    element.fontFamily ?? DEFAULT_BODY_FONT,
    element.fontSize ?? 24,
    element.fontWeight ?? 600
  );
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const text = interpolateThemeText(element.text, context.variables);
  ctx.fillText(text, element.x + 6, element.y + element.height / 2, element.width - 12);
  ctx.restore();
};

const drawButtonElement = async (context: PreviewContext, element: ThemeV2ButtonElement) => {
  const { ctx } = context;
  const radius = element.radius ?? 10;
  ctx.save();
  fillRoundedRect(
    ctx,
    element.x,
    element.y,
    element.width,
    element.height,
    radius,
    element.background ?? '#ff006e'
  );
  if ((element.borderWidth ?? 0) > 0) {
    strokeRoundedRect(
      ctx,
      element.x,
      element.y,
      element.width,
      element.height,
      radius,
      element.borderColor ?? '#ffffff',
      element.borderWidth ?? 0
    );
  }

  const fontSize = element.fontSize ?? 16;
  const label = interpolateThemeText(element.label, context.variables);
  ctx.font = canvasFont(
    context,
    element.fontFamily ?? DEFAULT_BODY_FONT,
    fontSize,
    element.fontWeight ?? 600
  );
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelWidth = ctx.measureText(label).width;
  const iconSize = fontSize * 1.1;
  const hasIcon = Boolean(element.icon);
  const totalWidth = labelWidth + (hasIcon ? iconSize + 8 : 0);
  const startX = element.x + (element.width - totalWidth) / 2;
  const centerY = element.y + element.height / 2;
  const color = element.color ?? '#ffffff';

  if (element.icon) {
    const icon = await loadThemeIcon(context, element.icon, color);
    if (icon) {
      ctx.drawImage(icon.source, startX, centerY - iconSize / 2, iconSize, iconSize);
    }
  }

  ctx.fillStyle = color;
  ctx.fillText(label, startX + (hasIcon ? iconSize + 8 : 0), centerY, element.width - 8);
  ctx.restore();
};

const drawPathElement = (context: PreviewContext, element: ThemeV2PathElement) => {
  const { ctx } = context;
  let path: Path2D;
  try {
    path = new Path2D(element.path);
  } catch {
    return;
  }

  const scaleX = Math.max(0.01, element.width / 100);
  const scaleY = Math.max(0.01, element.height / 100);
  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.scale(scaleX, scaleY);
  if (element.fillMode === 'gradient') {
    const vector = themeSvgGradientVector(element.gradientAngle ?? 135);
    const gradient = ctx.createLinearGradient(
      vector.x1 * 100,
      vector.y1 * 100,
      vector.x2 * 100,
      vector.y2 * 100
    );
    gradient.addColorStop(0, element.gradientFrom ?? '#ff006e');
    gradient.addColorStop(1, element.gradientTo ?? '#7c3aed');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = element.fill ?? '#ff006e';
  }
  ctx.fill(path);

  if (element.stroke && (element.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = element.stroke;
    ctx.lineWidth = (element.strokeWidth ?? 0) / ((scaleX + scaleY) / 2);
    ctx.lineCap = element.strokeLinecap ?? 'round';
    ctx.lineJoin = 'round';
    if (element.strokeStyle === 'dashed') ctx.setLineDash([3, 2]);
    else if (element.strokeStyle === 'dotted') ctx.setLineDash([0.1, 1.8]);
    ctx.stroke(path);
    ctx.setLineDash([]);
  }
  ctx.restore();
};

const drawParticlesElement = (context: PreviewContext, element: ThemeV2ParticlesElement) => {
  const { ctx } = context;
  const seeds = themeParticleSeeds(element);
  const baseSize = Math.max(1, element.size ?? 6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(element.x, element.y, element.width, element.height);
  ctx.clip();
  for (const seed of seeds) {
    const x = element.x + (seed.left / 100) * element.width;
    const y = element.y + (seed.top / 100) * element.height;
    const size = baseSize * seed.size;
    ctx.globalAlpha = seed.opacity;
    ctx.fillStyle = seed.alternate ? (element.color2 ?? '#ff006e') : (element.color ?? '#ffffff');
    ctx.beginPath();
    if (element.preset === 'sparkles') {
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size * 0.16, y - size * 0.16);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x + size * 0.16, y + size * 0.16);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size * 0.16, y + size * 0.16);
      ctx.lineTo(x - size / 2, y);
      ctx.lineTo(x - size * 0.16, y - size * 0.16);
      ctx.closePath();
    } else if (element.preset === 'confetti') {
      ctx.rect(x - size / 2, y - size / 4, size, size / 2);
    } else if (element.preset === 'petals') {
      ctx.ellipse(x, y, size / 2, size / 4, seed.spin * 0.01, 0, Math.PI * 2);
    } else {
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
};

const drawClockElement = (context: PreviewContext, element: ThemeV2ClockElement) => {
  const { ctx } = context;
  const now = new Date();
  const color = element.color ?? '#ffffff';
  const accent = element.accentColor ?? '#ff006e';

  if ((element.mode ?? 'digital') === 'analog') {
    const size = Math.max(1, Math.min(element.width, element.height));
    const centerX = element.width / 2;
    const centerY = element.height / 2;
    const radius = size / 2 - 2;
    ctx.save();
    ctx.translate((element.width - size) / 2, (element.height - size) / 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index * Math.PI) / 6;
      const inner = radius - (index % 3 === 0 ? 12 : 8);
      ctx.strokeStyle = color;
      ctx.globalAlpha = index % 3 === 0 ? 0.85 : 0.4;
      ctx.lineWidth = index % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.sin(angle) * inner, centerY - Math.cos(angle) * inner);
      ctx.lineTo(
        centerX + Math.sin(angle) * (radius - 2),
        centerY - Math.cos(angle) * (radius - 2)
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const seconds = now.getSeconds();
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const hand = (angle: number, length: number, width: number, fill: string) => {
      ctx.strokeStyle = fill;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      const radians = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.sin(radians) * length, centerY - Math.cos(radians) * length);
      ctx.stroke();
    };
    hand(hours * 30, radius * 0.52, 4, color);
    hand(minutes * 6, radius * 0.74, 2.6, color);
    if (element.showSeconds !== false) hand(seconds * 6, radius * 0.84, 1.2, accent);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const align = element.align ?? 'center';
  const textX = align === 'left' ? 0 : align === 'right' ? element.width : element.width / 2;
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const fontSize = element.fontSize ?? 40;
  const captionSize = Math.max(9, Math.round(fontSize * 0.32));
  const centerY = element.height / 2;

  if (element.label) {
    ctx.fillStyle = accent;
    ctx.font = canvasFont(context, element.fontFamily ?? DEFAULT_BODY_FONT, captionSize, 600);
    ctx.fillText(element.label.toUpperCase(), textX, centerY - fontSize * 0.72);
  }
  ctx.fillStyle = color;
  ctx.font = canvasFont(
    context,
    element.fontFamily ?? DEFAULT_BODY_FONT,
    fontSize,
    element.fontWeight ?? 700
  );
  ctx.fillText(themeClockTime(element, now), textX, centerY, element.width);
  if (element.showDate) {
    ctx.fillStyle = accent;
    ctx.font = canvasFont(context, element.fontFamily ?? DEFAULT_BODY_FONT, captionSize, 500);
    ctx.fillText(themeClockDate(now), textX, centerY + fontSize * 0.68);
  }
  ctx.restore();
};

const drawCountdownElement = (context: PreviewContext, element: ThemeV2CountdownElement) => {
  const { ctx } = context;
  const align = element.align ?? 'center';
  const textX = align === 'left' ? 0 : align === 'right' ? element.width : element.width / 2;
  ctx.save();
  ctx.fillStyle = element.color ?? '#ffffff';
  ctx.font = canvasFont(
    context,
    element.fontFamily ?? DEFAULT_BODY_FONT,
    element.fontSize ?? 40,
    element.fontWeight ?? 700
  );
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(themeCountdownText(element, new Date()), textX, element.height / 2, element.width);
  ctx.restore();
};

const drawLottieElement = async (context: PreviewContext, element: ThemeV2LottieElement) => {
  const bytes = await readAssetBytes(context, element.src);
  if (!bytes) {
    drawLottiePlaceholder(context, element);
    return;
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const container = document.createElement('div');
    container.style.width = `${element.width}px`;
    container.style.height = `${element.height}px`;
    const animation = lottie.loadAnimation({
      container,
      renderer: 'canvas',
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', clearCanvas: true },
    });

    await new Promise<void>((resolve) => {
      if (animation.isLoaded) {
        resolve();
        return;
      }
      animation.addEventListener('DOMLoaded', () => resolve());
      window.setTimeout(resolve, 1500);
    });
    animation.goToAndStop(0, true);
    const lottieCanvas = container.querySelector('canvas');
    if (lottieCanvas) {
      context.ctx.drawImage(lottieCanvas, element.x, element.y, element.width, element.height);
    }
    animation.destroy();
  } catch (error) {
    console.warn('Could not render the Lottie preview frame', error);
    drawLottiePlaceholder(context, element);
  }
};

const drawLottiePlaceholder = (context: PreviewContext, element: ThemeV2Element) => {
  const { ctx } = context;
  const accent = context.definition.accentColor ?? DEFAULT_ACCENT;
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.fillStyle = rgba(accent, 0.09);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  roundRect(ctx, element.x, element.y, element.width, element.height, 14);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = `600 12px "${DEFAULT_BODY_FONT}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOTTIE ANIMATION', element.x + element.width / 2, element.y + element.height / 2);
  ctx.restore();
};

const drawElement = async (
  context: PreviewContext,
  element: ThemeV2Element,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[],
  groupOpacity = 1,
  filter = ''
) => {
  const { ctx } = context;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const matrix = themeElementTransformMatrix(element, elements, groups);

  ctx.save();
  ctx.globalAlpha = clamp((element.opacity ?? 1) * groupOpacity, 0, 1);
  if (filter) ctx.filter = filter;
  ctx.translate(element.x, element.y);
  ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.translate(-element.x, -element.y);
  applyGroupMasks(context, themeGroupAncestors(groups, element).reverse(), elements, groups);
  applyElementMask(context, element);

  if (element.type === 'text') {
    ctx.translate(element.x, element.y);
    drawTextElement(context, element);
  } else if (element.type === 'data') {
    ctx.translate(element.x, element.y);
    drawDataElement(context, element);
  } else if (element.type === 'icon') {
    await drawIconElement(context, element);
  } else if (element.type === 'repeater') {
    await drawRepeaterElement(context, element);
  } else if (element.type === 'gauge') {
    drawGaugeElement(context, element);
  } else if (element.type === 'ticker') {
    drawTickerElement(context, element);
  } else if (element.type === 'button') {
    await drawButtonElement(context, element);
  } else if (element.type === 'lottie') {
    await drawLottieElement(context, element);
  } else if (element.type === 'path') {
    drawPathElement(context, element);
  } else if (element.type === 'particles') {
    drawParticlesElement(context, element);
  } else if (element.type === 'clock') {
    ctx.translate(element.x, element.y);
    drawClockElement(context, element);
  } else if (element.type === 'countdown') {
    ctx.translate(element.x, element.y);
    drawCountdownElement(context, element);
  } else if (element.type === 'shape') {
    drawShapeElement(context, element);
  } else if (element.type === 'image' || element.type === 'video') {
    const media =
      element.type === 'video'
        ? await loadVideoFrame(context, element.src)
        : await loadImageAsset(context, element.src);

    ctx.save();
    roundRect(ctx, element.x, element.y, element.width, element.height, element.radius ?? 0);
    ctx.clip();

    if (media) {
      if (element.type === 'image' && element.tint) {
        drawTintedMedia(
          context,
          media,
          element.x,
          element.y,
          element.width,
          element.height,
          element.fit ?? 'cover',
          element.tint
        );
      } else {
        drawMedia(
          context,
          media,
          element.x,
          element.y,
          element.width,
          element.height,
          element.fit ?? 'cover'
        );
      }
    } else {
      ctx.fillStyle = rgba(context.definition.accentColor ?? DEFAULT_ACCENT, 0.18);
      ctx.fillRect(element.x, element.y, element.width, element.height);
      if (element.type === 'video') {
        drawIcon(context, 'play', centerX, centerY, 22, 'rgba(255, 255, 255, 0.72)', 1.5);
      }
    }
    ctx.restore();
  } else if (element.type === 'svelte') {
    // Thumbnail rendering is canvas-only; compiled Svelte cannot run here.
    // Draw a labelled placeholder so authors can still see the layer bounds.
    ctx.save();
    ctx.strokeStyle = rgba(context.definition.accentColor ?? DEFAULT_ACCENT, 0.7);
    ctx.fillStyle = rgba(context.definition.accentColor ?? DEFAULT_ACCENT, 0.09);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 5]);
    roundRect(context.ctx, element.x, element.y, element.width, element.height, 14);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.font = `600 12px "${DEFAULT_BODY_FONT}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CUSTOM SVELTE LAYER', centerX, centerY);
    ctx.restore();
  } else if (element.type === 'widget') {
    await drawWidgetElement(context, element);
  }

  ctx.restore();
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The preview image could not be encoded.'));
    }, 'image/png');
  });

/** Render a 1000 x 650 PNG thumbnail of an API 2.0 theme. */
export const renderThemePreview = async ({
  definition,
  readAsset,
  logoUrl,
}: ThemePreviewOptions): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const context: PreviewContext = {
    ctx,
    definition,
    readAsset,
    objectUrls: [],
    videos: [],
    images: new Map(),
    videoFrames: new Map(),
    fonts: new Map(),
    fontFamilies: new Map(),
    icons: new Map(),
    variables: themeScriptInitialVariables(definition),
  };

  try {
    await loadThemeFonts(context);

    let logo: LoadedMedia | undefined;
    if (logoUrl) {
      try {
        const image = await loadHtmlImage(logoUrl);
        logo = {
          source: image,
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
      } catch (error) {
        console.warn('Could not load the launcher logo for the theme preview', error);
      }
    }

    const chrome = normalizeChrome(definition.chrome, definition.elements);

    await drawBackground(context);
    drawSidebar(context, logo);
    if (chrome.header !== false) {
      drawHeader(context);
    }
    if (chrome.layoutMode === 'dashboard') {
      await drawDashboardCards(context, chrome);
    } else if (chrome.layoutMode === 'classic') {
      if (chrome.playerCard !== false) {
        drawStatsCard(context);
      }
    }
    if (chrome.dock !== false) {
      drawFooter(context, chrome);
    }
    for (const element of definition.elements ?? []) {
      const ancestors = themeGroupAncestors(definition.groups, element);
      if (element.hidden || ancestors.some((group) => group.hidden)) continue;
      const groupOpacity = ancestors.reduce((opacity, group) => opacity * (group.opacity ?? 1), 1);
      const filter = themeFilterCss(element.filters, ...ancestors.map((group) => group.filters));
      await drawElement(
        context,
        element,
        definition.elements ?? [],
        definition.groups ?? [],
        groupOpacity,
        filter
      );
    }

    return await canvasToBlob(canvas);
  } finally {
    for (const video of context.videos) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    for (const url of context.objectUrls) URL.revokeObjectURL(url);
  }
};
