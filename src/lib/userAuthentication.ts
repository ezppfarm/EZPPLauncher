import type { EZPPUser } from './types';
import { writable } from 'svelte/store';

export const currentUser = writable<EZPPUser | undefined>(undefined);
