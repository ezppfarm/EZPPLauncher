import {
  readableTextColor,
  type ThemeV2Definition,
  type ThemeV2Element,
  type ThemeV2TextElement,
} from './themeV2';

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
  if (bodyFont) families.add(bodyFont);
  if (headingFont) families.add(headingFont);
  for (const element of context.definition.elements ?? []) {
    if (element.type === 'text' && element.fontFamily) families.add(element.fontFamily);
  }

  // Bundled Fontsource families are imported globally but only downloaded when
  // used. Ask for the weights we draw so the canvas does not fall back to a
  // system font on its first render.
  await Promise.all(
    [...families].flatMap((family) =>
      [400, 600, 700].map((weight) =>
        document.fonts.load(`${weight} 16px ${quoteFamily(family)}`).catch(() => undefined)
      )
    )
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
  name: 'home' | 'paint' | 'settings' | 'user' | 'play' | 'music' | 'brush' | 'wifi',
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

  fillRoundedRect(ctx, centerX - 14, 75, 28, 13, 6.5, accent);
  ctx.save();
  ctx.fillStyle = accentText;
  ctx.font = `600 8px ${quoteFamily('Sora Variable')}, ui-sans-serif, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('3.2.7', centerX, 82);
  ctx.restore();

  const navIcons = ['home', 'paint', 'settings'] as const;
  navIcons.forEach((icon, index) => {
    const y = 99 + index * 60;
    fillRoundedRect(
      ctx,
      18.5,
      y,
      48,
      48,
      14,
      index === 0 ? rgba(accent, 0.5) : 'rgba(0, 0, 0, 0.2)'
    );
    strokeRoundedRect(ctx, 18.5, y, 48, 48, 14, 'rgba(255, 255, 255, 0.15)');
    drawIcon(context, icon, centerX, y + 24, 20, 'rgba(255, 255, 255, 0.85)', 1.6);
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

const drawFooter = (context: PreviewContext) => {
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

const drawTextElement = (context: PreviewContext, element: ThemeV2TextElement) => {
  const { ctx } = context;
  const fontSize = element.fontSize ?? 28;
  const fontWeight = element.fontWeight ?? 600;
  const lineHeight = fontSize * (element.lineHeight ?? 1.2);
  const font = canvasFont(context, element.fontFamily ?? DEFAULT_BODY_FONT, fontSize, fontWeight);
  const lines = wrapText(context, element.text, element.width, font);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, element.width, element.height);
  ctx.clip();
  ctx.font = font;
  ctx.fillStyle = element.color ?? '#ffffff';
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

  lines.forEach((line, index) => {
    ctx.fillText(line, textX, startY + index * lineHeight);
  });
  ctx.restore();
};

const drawElement = async (context: PreviewContext, element: ThemeV2Element) => {
  const { ctx } = context;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;

  ctx.save();
  ctx.globalAlpha = clamp(element.opacity ?? 1, 0, 1);
  ctx.translate(centerX, centerY);
  ctx.rotate(((element.rotation ?? 0) * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  if (element.type === 'text') {
    ctx.translate(element.x, element.y);
    drawTextElement(context, element);
  } else if (element.type === 'image' || element.type === 'video') {
    const media =
      element.type === 'video'
        ? await loadVideoFrame(context, element.src)
        : await loadImageAsset(context, element.src);

    ctx.save();
    roundRect(ctx, element.x, element.y, element.width, element.height, element.radius ?? 0);
    ctx.clip();

    if (media) {
      drawMedia(
        context,
        media,
        element.x,
        element.y,
        element.width,
        element.height,
        element.fit ?? 'cover'
      );
    } else {
      ctx.fillStyle = rgba(context.definition.accentColor ?? DEFAULT_ACCENT, 0.18);
      ctx.fillRect(element.x, element.y, element.width, element.height);
      if (element.type === 'video') {
        drawIcon(context, 'play', centerX, centerY, 22, 'rgba(255, 255, 255, 0.72)', 1.5);
      }
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = element.fill ?? '#ff006e';
    ctx.beginPath();
    if (element.shape === 'ellipse') {
      ctx.ellipse(centerX, centerY, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
    } else {
      roundRect(ctx, element.x, element.y, element.width, element.height, element.radius ?? 16);
    }
    ctx.fill();
    if ((element.borderWidth ?? 0) > 0) {
      ctx.strokeStyle = element.borderColor ?? '#ffffff';
      ctx.lineWidth = element.borderWidth ?? 0;
      ctx.stroke();
    }
    ctx.restore();
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

    await drawBackground(context);
    drawSidebar(context, logo);
    drawHeader(context);
    drawStatsCard(context);
    drawFooter(context);
    for (const element of definition.elements ?? []) {
      await drawElement(context, element);
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
