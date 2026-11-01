import { custom_theme_audio_playing } from './global';
import { playThemeMedia } from './themeMedia';
import { invoke } from '@tauri-apps/api/core';
import { type ClassValue, clsx } from 'clsx';
import * as crypto from 'crypto-js';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;

export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;

export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

export const numberHumanReadable = (number: number) => {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const playAudio = (path: string, volume: number) => {
  const audio = new Audio(path);
  audio.volume = volume;
  audio.play();
};

export const isNumber = (value: unknown) => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value.toString().match(/^-?\d+(\.\d+)?$/) !== null;
  }
  return false;
};

export const formatTimeReadable = (initialSeconds: number) => {
  let seconds = initialSeconds;

  const days = Math.floor(seconds / (24 * 3600));
  seconds -= days * 24 * 3600;

  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;

  const minutes = Math.floor(seconds / 60);

  let result = '';

  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  result += `${minutes}m`;

  return result.trim();
};

export const formatRelativeTime = (dateOrTimestamp: Date | string | number | undefined): string => {
  if (!dateOrTimestamp) return 'recently';
  const time = new Date(dateOrTimestamp).getTime();
  if (isNaN(time)) return 'recently';
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export const countryCodeToEmoji = (code?: string): string => {
  if (!code || code.length !== 2) return '🌐';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const releaseStreamToReadable = (releaseStream: string) => {
  if (releaseStream.replaceAll(' ', '').toLowerCase() === 'cuttingedge') return 'Cutting Edge';
  return 'Stable';
};

export const compareBuildNumbers = (current: string, target: string): number => {
  const parse = (version: string): [number, number] => {
    const cleaned = version.startsWith('b')
      ? version.slice(1).split(/[^0-9.]/)[0]
      : version.split(/[^0-9.]/)[0];

    const [baseStr, hotfixStr] = cleaned.split('.');
    const base = parseInt(baseStr, 10);
    const hotfix = hotfixStr ? parseInt(hotfixStr, 10) : 0;

    return [base, hotfix];
  };

  const [currentBase, currentHotfix] = parse(current);
  const [targetBase, targetHotfix] = parse(target);

  if (targetBase > currentBase) {
    return targetBase - currentBase + targetHotfix;
  } else if (targetBase === currentBase) {
    return targetHotfix - currentHotfix;
  } else {
    return -1;
  }
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
};

export const openURL = async (url: string) => {
  await invoke('open_url_in_browser', { url });
};

export const urlIsValidImage = async (url: string) => {
  try {
    const request = await fetch(url);
    if (!request.ok) return false;
    const contentType = request.headers.get('content-type');
    return contentType?.startsWith('image/');
  } catch {
    return false;
  }
};

export function toURL(data: Buffer, type: string) {
  return URL.createObjectURL(new Blob([new Uint8Array(data)], { type }));
}

export function setGlobalVolume(volume: number) {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => {
    element.volume = volume;
  });
}

let activeFadeCancel: (() => void) | undefined = undefined;

export function fadeGlobalVolume(
  volumeFrom: number,
  volumeTo: number,
  duration: number,
  onDone?: () => void
): Promise<void> {
  if (activeFadeCancel) {
    activeFadeCancel();
    activeFadeCancel = undefined;
  }

  return new Promise((resolve) => {
    const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
    if (mediaElements.length === 0 || duration <= 0) {
      if (mediaElements.length > 0) {
        mediaElements.forEach((element) => {
          element.volume = Math.min(1, Math.max(0, volumeTo));
        });
      }
      if (onDone) onDone();
      resolve();
      return;
    }

    let cancelled = false;
    let animationFrameId: number;

    activeFadeCancel = () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
    };

    const startTime = performance.now();

    function animate() {
      if (cancelled) {
        resolve();
        return;
      }

      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const interpolatedVolume = Math.min(
        1,
        Math.max(0, volumeFrom + (volumeTo - volumeFrom) * progress)
      );

      mediaElements.forEach((element) => {
        element.volume = interpolatedVolume;
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        activeFadeCancel = undefined;
        if (onDone) onDone();
        resolve();
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  });
}

export const pauseGlobalMedia = () => {
  if (activeFadeCancel) {
    activeFadeCancel();
    activeFadeCancel = undefined;
  }
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => {
    try {
      element.pause();
    } catch {
      // ignore
    }
  });
};

export const resumeGlobalMedia = () => {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => {
    try {
      if (element instanceof HTMLVideoElement && element.error) {
        element.load();
      }
      playThemeMedia(element);
    } catch (err) {
      console.warn('Could not resume global media:', err);
    }
  });
};

export const setCurrentTimeGlobalMedia = (time: number) => {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => {
    try {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        element.currentTime = Math.min(Math.max(0, time), element.duration);
      } else {
        element.currentTime = Math.max(0, time);
      }
    } catch {
      // ignore if media is not seekable
    }
  });
};

export function trackMediaContainer(node: HTMLElement) {
  const media = new Set<HTMLMediaElement>();

  function update() {
    custom_theme_audio_playing.set(
      Array.from(media).some((el) => !el.paused && !(el instanceof HTMLVideoElement && el.muted))
    );
  }

  function register(el: HTMLMediaElement) {
    media.add(el);

    const handler = () => update();
    el.addEventListener('play', handler);
    el.addEventListener('pause', handler);

    return () => {
      media.delete(el);
      el.removeEventListener('play', handler);
      el.removeEventListener('pause', handler);
    };
  }

  // find existing media inside the div
  node.querySelectorAll<HTMLMediaElement>('video, audio').forEach(register);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLMediaElement) register(n);
        if (n instanceof HTMLElement) {
          n.querySelectorAll<HTMLMediaElement>('video, audio').forEach(register);
        }
      });
    }
  });

  observer.observe(node, { childList: true, subtree: true });

  return {
    destroy() {
      observer.disconnect();
    },
  };
}

const MEDIA_ACTIONS: MediaSessionAction[] = [
  'play',
  'pause',
  'stop',
  'previoustrack',
  'nexttrack',
  'seekbackward',
  'seekforward',
];

export function disableMediaControls() {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');

  if ('mediaSession' in navigator) {
    MEDIA_ACTIONS.forEach((action) => {
      try {
        navigator.mediaSession.setActionHandler(action, () => {});
      } catch {}
    });
  }

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key.startsWith('Media')) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  mediaElements.forEach((el) => {
    el.disableRemotePlayback = true;
  });
}

export function calculateGitBlobSha(fileBuffer: Buffer): string {
  const header = Buffer.from(`blob ${fileBuffer.length}\0`);
  const store = Buffer.concat([header, fileBuffer]);

  return crypto.SHA1(crypto.lib.WordArray.create(store)).toString(crypto.enc.Hex);
}
