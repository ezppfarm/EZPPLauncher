import { SvelteMap, SvelteSet } from 'svelte/reactivity';

/**
 * Install progress lives outside the workshop component because switching to
 * the Installed tab unmounts it. Keeping the state here lets the workshop show
 * the current progress again when it is remounted, while the in-flight
 * download keeps running.
 */
export const activeThemeDownloads = new SvelteSet<string>();
export const themeDownloadProgress = new SvelteMap<string, number>();
