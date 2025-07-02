import { writable } from 'svelte/store';
import { Config } from './config';
import type { EZPPUser } from './types';

export const userAuth = writable<Config>(new Config("user_auth", true));
export const currentUser = writable<EZPPUser | undefined>(undefined);
