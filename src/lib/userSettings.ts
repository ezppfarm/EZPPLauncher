import { writable } from 'svelte/store';
import { Config } from './config';

export const userSettings = writable<Config>(new Config());

export const customCursor = writable<boolean>(true);
export const cursorSmoothening = writable<boolean>(true);
export const reduceAnimations = writable<boolean>(false);
