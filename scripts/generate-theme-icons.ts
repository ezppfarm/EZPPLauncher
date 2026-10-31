import { THEME_ICON_NAMES, type ThemeIconName, type ThemeIconSet } from '../src/lib/themeIcons';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type IconifyCollection = {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
};

type IconBody = {
  width: number;
  height: number;
  body: string;
};

/**
 * Semantic name -> Iconify icon id per family. Keeping this explicit means a
 * family swap can never pick a random similarly named icon from another set.
 */
const ICON_IDS: Record<ThemeIconName, Record<ThemeIconSet, string>> = {
  home: { lucide: 'house', phosphor: 'house', tabler: 'home' },
  themes: { lucide: 'palette', phosphor: 'palette', tabler: 'palette' },
  settings: {
    lucide: 'sliders-horizontal',
    phosphor: 'sliders-horizontal',
    tabler: 'adjustments-horizontal',
  },
  launch: { lucide: 'play', phosphor: 'play', tabler: 'player-play' },
  user: { lucide: 'user', phosphor: 'user', tabler: 'user' },
  music: { lucide: 'music', phosphor: 'music-notes', tabler: 'music' },
  brush: { lucide: 'brush', phosphor: 'paint-brush', tabler: 'brush' },
  wifi: { lucide: 'wifi', phosphor: 'wifi-high', tabler: 'wifi' },
  'wifi-off': { lucide: 'wifi-off', phosphor: 'wifi-slash', tabler: 'wifi-off' },
  gameplay: { lucide: 'gamepad-2', phosphor: 'game-controller', tabler: 'device-gamepad-2' },
  integrations: { lucide: 'plug', phosphor: 'plugs', tabler: 'plug' },
  installation: { lucide: 'hard-drive', phosphor: 'hard-drives', tabler: 'server' },
  installed: { lucide: 'hard-drive', phosphor: 'hard-drives', tabler: 'server' },
  diagnostics: { lucide: 'shield-check', phosphor: 'shield-check', tabler: 'shield-check' },
  logs: { lucide: 'scroll-text', phosphor: 'scroll', tabler: 'file-text' },
  'all-themes': { lucide: 'layout-grid', phosphor: 'squares-four', tabler: 'layout-grid' },
  available: {
    lucide: 'cloud-download',
    phosphor: 'cloud-arrow-down',
    tabler: 'cloud-download',
  },
  updates: { lucide: 'refresh-cw', phosphor: 'arrows-clockwise', tabler: 'refresh' },
  search: { lucide: 'search', phosphor: 'magnifying-glass', tabler: 'search' },
  folder: { lucide: 'folder-open', phosphor: 'folder-open', tabler: 'folder-open' },
  plus: { lucide: 'plus', phosphor: 'plus', tabler: 'plus' },
  'osu-standard': { lucide: 'circle', phosphor: 'circle', tabler: 'circle' },
  'osu-taiko': { lucide: 'drum', phosphor: 'music-notes', tabler: 'music' },
  'osu-catch': { lucide: 'cherry', phosphor: 'orange-slice', tabler: 'cherry' },
  'osu-mania': { lucide: 'piano', phosphor: 'piano-keys', tabler: 'piano' },
  login: { lucide: 'log-in', phosphor: 'sign-in', tabler: 'login' },
  logout: { lucide: 'log-out', phosphor: 'sign-out', tabler: 'logout' },
  warning: { lucide: 'triangle-alert', phosphor: 'warning', tabler: 'alert-triangle' },
  info: { lucide: 'info', phosphor: 'info', tabler: 'info-circle' },
  loader: { lucide: 'loader-circle', phosphor: 'circle-notch', tabler: 'loader' },
  ellipsis: { lucide: 'ellipsis', phosphor: 'dots-three', tabler: 'dots' },
  check: { lucide: 'check', phosphor: 'check', tabler: 'check' },
  trash: { lucide: 'trash', phosphor: 'trash', tabler: 'trash' },
  edit: { lucide: 'pencil', phosphor: 'pencil-simple', tabler: 'pencil' },
  history: { lucide: 'history', phosphor: 'clock-counter-clockwise', tabler: 'history' },
  refresh: { lucide: 'refresh-cw', phosphor: 'arrows-clockwise', tabler: 'refresh' },
  download: { lucide: 'cloud-download', phosphor: 'cloud-arrow-down', tabler: 'cloud-download' },
  import: { lucide: 'import', phosphor: 'upload-simple', tabler: 'upload' },
  'arrow-right': { lucide: 'arrow-right', phosphor: 'arrow-right', tabler: 'arrow-right' },
  eye: { lucide: 'eye', phosphor: 'eye', tabler: 'eye' },
  'eye-off': { lucide: 'eye-off', phosphor: 'eye-slash', tabler: 'eye-off' },
  wrench: { lucide: 'wrench', phosphor: 'wrench', tabler: 'tool' },
  rotate: { lucide: 'rotate-cw', phosphor: 'arrows-clockwise', tabler: 'rotate-clockwise' },
  volume: { lucide: 'volume-2', phosphor: 'speaker-high', tabler: 'volume' },
  'volume-low': { lucide: 'volume-1', phosphor: 'speaker-low', tabler: 'volume-2' },
  'volume-off': { lucide: 'volume-x', phosphor: 'speaker-slash', tabler: 'volume-off' },
};

const collectionPaths: Record<ThemeIconSet, string> = {
  lucide: '../node_modules/@iconify-json/lucide/icons.json',
  phosphor: '../node_modules/@iconify-json/ph/icons.json',
  tabler: '../node_modules/@iconify-json/tabler/icons.json',
};

const loadCollection = (set: ThemeIconSet): IconifyCollection =>
  JSON.parse(readFileSync(fileURLToPath(new URL(collectionPaths[set], import.meta.url)), 'utf8'));

const resolveIcon = (collection: IconifyCollection, id: string): IconBody | undefined => {
  const direct = collection.icons[id];
  if (direct) {
    return {
      width: direct.width ?? collection.width ?? 24,
      height: direct.height ?? collection.height ?? 24,
      body: direct.body,
    };
  }

  const alias = collection.aliases?.[id];
  if (!alias) return undefined;
  const parent = collection.icons[alias.parent];
  if (!parent) return undefined;
  return {
    width: parent.width ?? collection.width ?? 24,
    height: parent.height ?? collection.height ?? 24,
    body: parent.body,
  };
};

const collections = Object.fromEntries(
  (Object.keys(collectionPaths) as ThemeIconSet[]).map((set) => [set, loadCollection(set)])
) as Record<ThemeIconSet, IconifyCollection>;

const data = {} as Record<ThemeIconSet, Record<ThemeIconName, IconBody>>;
for (const set of Object.keys(collectionPaths) as ThemeIconSet[]) {
  data[set] = {} as Record<ThemeIconName, IconBody>;
  for (const name of THEME_ICON_NAMES) {
    const id = ICON_IDS[name]?.[set];
    if (!id) throw new Error(`No ${set} icon mapped for semantic name "${name}".`);
    const icon = resolveIcon(collections[set], id);
    if (!icon) throw new Error(`Icon "${id}" from ${set} was not found for "${name}".`);
    data[set][name] = icon;
  }
}

const output = `// Generated by scripts/generate-theme-icons.ts. Do not edit by hand.
// Icon artwork: Lucide (ISC), Phosphor (MIT), Tabler (MIT).
import type { ThemeIconName, ThemeIconSet } from './themeIcons';

export type ThemeIconBody = { width: number; height: number; body: string };

export const THEME_ICON_BODIES: Record<ThemeIconSet, Record<ThemeIconName, ThemeIconBody>> = ${JSON.stringify(
  data,
  null,
  2
)};
`;

const outputPath = fileURLToPath(new URL('../src/lib/themeIconData.ts', import.meta.url));
writeFileSync(outputPath, output);
console.log(
  `Generated ${THEME_ICON_NAMES.length} semantic icons for ${Object.keys(collectionPaths).length} sets.`
);
