import type { Theme } from '$lib/themes';

/**
 * API 1.0 themes are executable bundles: loading one imports its entry script
 * into the launcher window. API 2.0 themes are declarative by default, but an
 * opt-in custom Svelte layer compiles and runs theme-authored JavaScript too.
 */
const TRUSTED_THEMES_KEY = 'ezpplauncher.trusted-v1-themes';

export type ThemeCodeKind = 'none' | 'v1' | 'v2-svelte';

export const themeCodeKind = (
  theme: Pick<Theme, 'apiVersion' | 'scriptUrl' | 'definition'>
): ThemeCodeKind => {
  const major = theme.apiVersion.split('.')[0];
  if (major === '1') return theme.scriptUrl.length > 0 ? 'v1' : 'none';
  if (major !== '2') return 'none';
  return theme.definition?.elements?.some((element) => element.type === 'svelte')
    ? 'v2-svelte'
    : 'none';
};

export const themeRunsCode = (theme: Pick<Theme, 'apiVersion' | 'scriptUrl' | 'definition'>) =>
  themeCodeKind(theme) !== 'none';

export const themeTrustKey = (theme: Pick<Theme, 'folder_name' | 'version'>) =>
  `${theme.folder_name}@${theme.version}`;

function readTrustedThemes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRUSTED_THEMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export const isThemeTrusted = (theme: Theme) =>
  !themeRunsCode(theme) || readTrustedThemes().includes(themeTrustKey(theme));

export const trustTheme = (theme: Theme) => {
  if (!themeRunsCode(theme) || typeof window === 'undefined') return;
  const trusted = readTrustedThemes();
  const key = themeTrustKey(theme);
  if (!trusted.includes(key)) {
    localStorage.setItem(TRUSTED_THEMES_KEY, JSON.stringify([...trusted, key]));
  }
};
