import { Config } from './config';
import type { EZPPUser } from './types';
import { writable } from 'svelte/store';

export const userAuth = writable<Config>(new Config('user_auth', true));
export const currentUser = writable<EZPPUser | undefined>(undefined);
