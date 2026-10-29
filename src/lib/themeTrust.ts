import type { Theme } from '$lib/themes';

/**
 * API 1.0 themes are executable bundles: loading one imports its entry script
 * into the launcher window. API 2.0 themes are declarative data and do not
 * need a trust decision.
 */
const TRUSTED_THEMES_KEY = 'ezpplauncher.trusted-v1-themes';

export const themeRunsCode = (theme: Pick<Theme, 'apiVersion' | 'scriptUrl'>) =>
  theme.apiVersion.split('.')[0] === '1' && theme.scriptUrl.length > 0;

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
