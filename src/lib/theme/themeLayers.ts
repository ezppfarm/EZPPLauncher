import type {
  ThemeV2ClockElement,
  ThemeV2CountdownElement,
  ThemeV2ParticlesElement,
} from './themeV2';

/**
 * Shared helpers for the dynamic API 2.0 layer types. The DOM renderer and the
 * canvas thumbnail renderer both use these so a layer looks the same in the
 * launcher, the editor canvas and the exported preview image.
 */

const pad = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, '0');

export const themeClockTime = (element: ThemeV2ClockElement, now: Date): string => {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const showSeconds = element.showSeconds !== false;
  if (element.hour12) {
    const hour = hours % 12 || 12;
    return `${hour}:${pad(minutes)}${showSeconds ? `:${pad(seconds)}` : ''} ${hours < 12 ? 'AM' : 'PM'}`;
  }
  return `${pad(hours)}:${pad(minutes)}${showSeconds ? `:${pad(seconds)}` : ''}`;
};

export const themeClockDate = (now: Date): string =>
  now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export type ThemeCountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when the target is a valid date that has already passed. */
  finished: boolean;
  /** False for empty or unparsable targets; the layer then shows zeroes. */
  valid: boolean;
};

export const themeCountdownParts = (target: string, now: Date): ThemeCountdownParts => {
  const timestamp = target.trim() ? Date.parse(target) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false, valid: false };
  }
  const remaining = Math.max(0, timestamp - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    finished: remaining <= 0,
    valid: true,
  };
};

export const themeCountdownText = (element: ThemeV2CountdownElement, now: Date): string => {
  const parts = themeCountdownParts(element.target, now);
  if (parts.finished) return element.finishedText?.trim() || 'The wait is over';
  const template = element.text?.trim() ? element.text : '{days}d {hours}h {minutes}m {seconds}s';
  return template
    .replaceAll('{days}', String(parts.days))
    .replaceAll('{hours}', pad(parts.hours))
    .replaceAll('{minutes}', pad(parts.minutes))
    .replaceAll('{seconds}', pad(parts.seconds));
};

export type ThemeParticleSeed = {
  /** Horizontal position in percent of the layer. */
  left: number;
  /** Vertical offset in percent of the layer. */
  top: number;
  /** Full animation duration in seconds. */
  duration: number;
  /** Negative delay so particles start already spread along their path. */
  delay: number;
  /** Particle size multiplier, 0.45–1.4. */
  size: number;
  /** Horizontal drift in percent of the layer width. */
  drift: number;
  /** Total rotation in degrees. */
  spin: number;
  /** Use the secondary color. */
  alternate: boolean;
  /** Peak opacity, 0.35–1. */
  opacity: number;
};

const seeded = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = (state * 9301 + 49297) % 233_280;
    return state / 233_280;
  };
};

export const themeParticleSeeds = (element: ThemeV2ParticlesElement): ThemeParticleSeed[] => {
  const density = Math.max(4, Math.min(120, Math.round(element.density ?? 28)));
  const speed = Math.max(0.1, Math.min(3, element.speed ?? 1));
  const wind = Math.max(-1, Math.min(1, element.wind ?? 0));
  const random = seeded(density * 7919 + 17);
  return Array.from({ length: density }, () => {
    const duration = (6 + random() * 10) / speed;
    return {
      left: random() * 100,
      top: random() * 100,
      duration,
      delay: -duration * random(),
      size: 0.45 + random() * 0.95,
      drift: (random() * 2 - 1) * 10 + wind * 16,
      spin: (random() * 2 - 1) * 720,
      alternate: random() > 0.5,
      opacity: 0.35 + random() * 0.65,
    };
  });
};

/** SVG linear-gradient vector for an angle, in 0–1 gradient units. */
export const themeSvgGradientVector = (angle: number) => {
  const radians = (angle * Math.PI) / 180;
  const x = Math.sin(radians);
  const y = -Math.cos(radians);
  return {
    x1: 0.5 - x / 2,
    y1: 0.5 - y / 2,
    x2: 0.5 + x / 2,
    y2: 0.5 + y / 2,
  };
};

/**
 * Arc geometry in a 0–100 view box. Angles start at 12 o'clock and run
 * clockwise; the stroke is inset so it never clips at the layer edge.
 */
export const themeArcGeometry = (
  startAngle: number,
  endAngle: number,
  thickness: number,
  width: number,
  height: number
) => {
  const minSide = Math.max(1, Math.min(width, height));
  const strokeWidth = Math.max(0.5, Math.min(60, (thickness / minSide) * 100));
  const radius = Math.max(1, 50 - strokeWidth / 2);
  const start = ((startAngle % 360) + 360) % 360;
  let end = ((endAngle % 360) + 360) % 360;
  if (end <= start) end += 360;
  const span = Math.min(360, end - start);

  const point = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: 50 + radius * Math.sin(radians),
      y: 50 - radius * Math.cos(radians),
    };
  };

  const from = point(start);
  if (span >= 359.99) {
    const to = point(start + 180);
    return {
      d: `M ${from.x} ${from.y} A ${radius} ${radius} 0 1 1 ${to.x} ${to.y} A ${radius} ${radius} 0 1 1 ${from.x} ${from.y}`,
      strokeWidth,
    };
  }

  const to = point(start + span);
  const largeArc = span > 180 ? 1 : 0;
  return {
    d: `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y}`,
    strokeWidth,
  };
};
