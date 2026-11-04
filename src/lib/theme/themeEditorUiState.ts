import { SvelteMap } from 'svelte/reactivity';

/**
 * Open state for accordion sections in the current theme-editor WebView session.
 * This module is re-evaluated when the editor window closes, so the state is not
 * persisted across app launches.
 */
export const themeEditorSectionOpen = new SvelteMap<string, boolean>();
