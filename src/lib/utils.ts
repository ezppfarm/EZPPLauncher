import { createAudioStore } from "@elron/svelte-audio-store";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const sounds = {
  menuHeartbeat: "/audio/menuHeartbeat.mp3",
  menuBack: "/audio/menuBack.wav",
  menuHit: "/audio/menuHit.wav",
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
