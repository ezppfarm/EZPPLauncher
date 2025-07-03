import { writable } from 'svelte/store';
import type { EZPPUserInfo } from './types';

export const currentUserInfo = writable<EZPPUserInfo | undefined>(undefined);
