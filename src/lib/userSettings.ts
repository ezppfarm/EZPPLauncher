import { writable } from 'svelte/store';

export const customCursor = writable<boolean>(false);
export const cursorSmoothening = writable<boolean>(false);
export const cursorSmoothness = writable<number>(14);
export const reduceAnimations = writable<boolean>(false);
export const gameOptimization = writable<boolean>(false);
export const patch = writable<boolean>(true);
export const loggingEnabled = writable<boolean>(true);

export const osuInstallationPath = writable<string>('');

export const preferredMode = writable<number>(0);
export const preferredType = writable<number>(0);
