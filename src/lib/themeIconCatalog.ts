import { THEME_ICON_BODIES, type ThemeIconBody } from './themeIconData';
import { DEFAULT_THEME_ICON_SET, THEME_ICON_NAMES, type ThemeIconSet } from './themeIcons';
import lucideCollection from '@iconify-json/lucide/icons.json';
import phCollection from '@iconify-json/ph/icons.json';
import tablerCollection from '@iconify-json/tabler/icons.json';

export type { ThemeIconBody };

export type IconPackKey = 'launcher' | 'lucide' | 'phosphor' | 'tabler';

export type ThemeIconCatalogItem = {
  id: string;
  name: string;
  pack: IconPackKey;
  packLabel: string;
};

type IconifyRawCollection = {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
};

const collections: Record<'lucide' | 'ph' | 'tabler', IconifyRawCollection> = {
  lucide: lucideCollection as unknown as IconifyRawCollection,
  ph: phCollection as unknown as IconifyRawCollection,
  tabler: tablerCollection as unknown as IconifyRawCollection,
};

const resolveFromCollection = (
  collection: IconifyRawCollection,
  id: string
): ThemeIconBody | undefined => {
  const direct = collection.icons[id];
  if (direct) {
    return {
      width: direct.width ?? collection.width ?? 24,
      height: direct.height ?? collection.height ?? 24,
      body: direct.body,
    };
  }

  const alias = collection.aliases?.[id];
  if (alias) {
    const parent = collection.icons[alias.parent];
    if (parent) {
      return {
        width: parent.width ?? collection.width ?? 24,
        height: parent.height ?? collection.height ?? 24,
        body: parent.body,
      };
    }
  }

  return undefined;
};

const FALLBACK_ICON: ThemeIconBody = {
  width: 24,
  height: 24,
  body: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

// Cache for quickly resolving icon bodies
const bodyCache = new Map<string, ThemeIconBody>();

/**
 * Resolve any icon by name (semantic launcher name, prefixed like `lucide:bell`,
 * `ph:sword`, `tabler:star`, or unprefixed matching an active/fallback pack).
 */
export function getThemeIconBody(
  name: string | undefined | null,
  set: ThemeIconSet = DEFAULT_THEME_ICON_SET
): ThemeIconBody {
  if (!name || typeof name !== 'string') {
    return THEME_ICON_BODIES[set]?.home ?? THEME_ICON_BODIES[DEFAULT_THEME_ICON_SET].home;
  }

  const cacheKey = `${set}:${name}`;
  const cached = bodyCache.get(cacheKey);
  if (cached) return cached;

  // 1. Check if semantic launcher icon in THEME_ICON_BODIES
  const semantic = (THEME_ICON_BODIES[set] as Record<string, ThemeIconBody> | undefined)?.[name];
  if (semantic) {
    bodyCache.set(cacheKey, semantic);
    return semantic;
  }
  const semanticDefault = (
    THEME_ICON_BODIES[DEFAULT_THEME_ICON_SET] as Record<string, ThemeIconBody> | undefined
  )?.[name];
  if (semanticDefault) {
    bodyCache.set(cacheKey, semanticDefault);
    return semanticDefault;
  }

  // 2. Check for pack prefix like "lucide:xxx", "ph:xxx" / "phosphor:xxx", "tabler:xxx"
  if (name.includes(':')) {
    const colonIdx = name.indexOf(':');
    const prefix = name.slice(0, colonIdx).toLowerCase();
    const iconId = name.slice(colonIdx + 1);

    const packCol =
      prefix === 'lucide'
        ? collections.lucide
        : prefix === 'ph' || prefix === 'phosphor'
          ? collections.ph
          : prefix === 'tabler'
            ? collections.tabler
            : undefined;

    if (packCol) {
      const resolved = resolveFromCollection(packCol, iconId);
      if (resolved) {
        bodyCache.set(cacheKey, resolved);
        return resolved;
      }
    }
  }

  // 3. Try current set collection
  const currentCollectionKey = set === 'phosphor' ? 'ph' : set === 'tabler' ? 'tabler' : 'lucide';
  const directCurrent = resolveFromCollection(collections[currentCollectionKey], name);
  if (directCurrent) {
    bodyCache.set(cacheKey, directCurrent);
    return directCurrent;
  }

  // 4. Try other collections (lucide, ph, tabler)
  const lucideResolved = resolveFromCollection(collections.lucide, name);
  if (lucideResolved) {
    bodyCache.set(cacheKey, lucideResolved);
    return lucideResolved;
  }
  const phResolved = resolveFromCollection(collections.ph, name);
  if (phResolved) {
    bodyCache.set(cacheKey, phResolved);
    return phResolved;
  }
  const tablerResolved = resolveFromCollection(collections.tabler, name);
  if (tablerResolved) {
    bodyCache.set(cacheKey, tablerResolved);
    return tablerResolved;
  }

  // Fallback icon
  return FALLBACK_ICON;
}

// Cached full catalog
let fullCatalog: ThemeIconCatalogItem[] | null = null;

export function getFullIconCatalog(): ThemeIconCatalogItem[] {
  if (fullCatalog) return fullCatalog;

  const items: ThemeIconCatalogItem[] = [];

  // 1. Semantic Launcher icons
  for (const name of THEME_ICON_NAMES) {
    items.push({
      id: name,
      name,
      pack: 'launcher',
      packLabel: 'Launcher',
    });
  }

  // 2. Lucide icons
  for (const name of Object.keys(collections.lucide.icons)) {
    items.push({
      id: `lucide:${name}`,
      name,
      pack: 'lucide',
      packLabel: 'Lucide',
    });
  }

  // 3. Phosphor icons
  for (const name of Object.keys(collections.ph.icons)) {
    items.push({
      id: `ph:${name}`,
      name,
      pack: 'phosphor',
      packLabel: 'Phosphor',
    });
  }

  // 4. Tabler icons
  for (const name of Object.keys(collections.tabler.icons)) {
    items.push({
      id: `tabler:${name}`,
      name,
      pack: 'tabler',
      packLabel: 'Tabler',
    });
  }

  fullCatalog = items;
  return items;
}
