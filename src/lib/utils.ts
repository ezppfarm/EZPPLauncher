import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const playAudio = (path: string, volume: number) => {
  const audio = new Audio(path);
  audio.volume = volume;
  audio.play();
};
