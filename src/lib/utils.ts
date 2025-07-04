import { createAudioStore } from '@elron/svelte-audio-store';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const sounds = {
  menuHeartbeat: '/audio/menuHeartbeat.mp3',
  menuBack: '/audio/menuBack.wav',
  menuHit: '/audio/menuHit.wav',
};

export const gameSounds = createAudioStore(sounds);

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
  console.log(releaseStream.replaceAll(' ', '').toLowerCase());
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
