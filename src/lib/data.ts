import type { EZPPUserInfo } from './types';
import { writable } from 'svelte/store';

export const currentUserInfo = writable<EZPPUserInfo | undefined>(undefined);
