export const THEME_ICON_SETS = [
  {
    value: 'lucide',
    label: 'Lucide',
    description: 'Clean geometric outlines. The launcher default.',
  },
  {
    value: 'phosphor',
    label: 'Phosphor',
    description: 'Soft, rounded shapes with a friendly feel.',
  },
  {
    value: 'tabler',
    label: 'Tabler',
    description: 'Crisp, technical outlines with a larger family.',
  },
] as const;

export type ThemeIconSet = (typeof THEME_ICON_SETS)[number]['value'];

export const DEFAULT_THEME_ICON_SET: ThemeIconSet = 'lucide';

export const isThemeIconSet = (value: unknown): value is ThemeIconSet =>
  THEME_ICON_SETS.some((set) => set.value === value);

/**
 * Semantic icon names used by launcher chrome. Themes choose a family, never a
 * component import, so the launcher can swap families without changing layout.
 */
export const THEME_ICON_NAMES = [
  'home',
  'themes',
  'settings',
  'launch',
  'user',
  'music',
  'brush',
  'wifi',
  'wifi-off',
  'gameplay',
  'integrations',
  'installation',
  'installed',
  'diagnostics',
  'logs',
  'all-themes',
  'available',
  'updates',
  'search',
  'folder',
  'plus',
  'osu-standard',
  'osu-taiko',
  'osu-catch',
  'osu-mania',
  'login',
  'logout',
  'warning',
  'info',
  'loader',
  'ellipsis',
  'check',
  'trash',
  'edit',
  'history',
  'refresh',
  'download',
  'import',
  'arrow-right',
  'eye',
  'eye-off',
  'wrench',
  'rotate',
  'volume',
  'volume-low',
  'volume-off',
] as const;

export type ThemeIconName = (typeof THEME_ICON_NAMES)[number];

const ICON_NAME_SET = new Set<string>(THEME_ICON_NAMES);

export const isThemeIconName = (value: unknown): value is ThemeIconName =>
  typeof value === 'string' && ICON_NAME_SET.has(value);

/** A small representative row used by the editor's live icon preview. */
export const THEME_ICON_PREVIEW_NAMES: ThemeIconName[] = [
  'home',
  'themes',
  'settings',
  'launch',
  'user',
];
