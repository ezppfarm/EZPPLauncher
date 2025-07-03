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
