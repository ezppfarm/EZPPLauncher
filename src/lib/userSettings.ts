import { writable } from 'svelte/store';
import { Config } from './config';

export const userSettings = writable<Config>(new Config(false));

export const customCursor = writable<boolean>(true);
export const cursorSmoothening = writable<boolean>(true);
export const cursorSmoothness = writable<number>(180);
export const reduceAnimations = writable<boolean>(false);

export const osuInstallationPath = writable<string>('');
