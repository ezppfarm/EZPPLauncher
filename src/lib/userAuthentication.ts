import { writable } from 'svelte/store';
import { Config } from './config';

export const userAuth = writable<Config>(new Config(true));

export const username = writable<string>("");
export const password = writable<string>("")
