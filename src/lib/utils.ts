import { custom_theme_audio_playing } from './global';
import { invoke } from '@tauri-apps/api/core';
import { type ClassValue, clsx } from 'clsx';
import * as crypto from 'crypto-js';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function fadeGlobalVolume(
  volumeFrom: number,
  volumeTo: number,
  duration: number,
  onDone?: () => void
) {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');

  const startTime = performance.now();

  function animate() {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);

    const interpolatedVolume = volumeFrom + (volumeTo - volumeFrom) * progress;

    mediaElements.forEach((element) => {
      element.volume = interpolatedVolume;
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (onDone) onDone();
    }
  }

  animate();
}

export const pauseGlobalMedia = () => {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => element.pause());
};

export const resumeGlobalMedia = () => {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => element.play());
};

export const setCurrentTimeGlobalMedia = (time: number) => {
  const mediaElements: NodeListOf<HTMLMediaElement> = document.querySelectorAll('audio, video');
  mediaElements.forEach((element) => (element.currentTime = time));
};

export function trackMediaContainer(node: HTMLElement) {
  const media = new Set<HTMLMediaElement>();

  function update() {
    custom_theme_audio_playing.set(Array.from(media).some((el) => !el.paused));
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

export function calculateGitBlobSha(fileBuffer: Buffer): string {
  const header = Buffer.from(`blob ${fileBuffer.length}\0`);
  const store = Buffer.concat([header, fileBuffer]);

  return crypto.SHA1(crypto.lib.WordArray.create(store)).toString(crypto.enc.Hex);
}
