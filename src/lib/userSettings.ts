import { writable } from 'svelte/store';
import { Config } from './config';

export const userSettings = writable<Config>(new Config('user_settings', false));

export const customCursor = writable<boolean>(false);
export const cursorSmoothening = writable<boolean>(false);
export const cursorSmoothness = writable<number>(180);
export const reduceAnimations = writable<boolean>(false);
export const patch = writable<boolean>(true);

export const osuInstallationPath = writable<string>('');

export const preferredMode = writable<number>(0);
export const preferredType = writable<number>(0);
