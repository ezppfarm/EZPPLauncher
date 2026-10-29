import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';

const FONTSOURCE_API = 'https://api.fontsource.org/v1/fonts';
const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

export type FontsourceFont = {
  id: string;
  family: string;
  subsets: string[];
  weights: number[];
  styles: string[];
  defSubset: string;
  variable: boolean;
  category: string;
  type: string;
};

export type FontsourceFontOptions = {
  weight?: number;
  style: 'normal' | 'italic';
  subset: string;
};

let catalogPromise: Promise<FontsourceFont[]> | undefined;

const isFontsourceFont = (value: unknown): value is FontsourceFont => {
  if (!value || typeof value !== 'object') return false;
  const font = value as Record<string, unknown>;
  return (
    typeof font.id === 'string' &&
    /^[a-z0-9-]+$/i.test(font.id) &&
    typeof font.family === 'string' &&
    font.family.trim().length > 0 &&
    Array.isArray(font.subsets) &&
    font.subsets.every((subset) => typeof subset === 'string' && /^[a-z0-9-]+$/i.test(subset)) &&
    Array.isArray(font.weights) &&
    font.weights.every((weight) => typeof weight === 'number') &&
    Array.isArray(font.styles) &&
    font.styles.every((style) => style === 'normal' || style === 'italic') &&
    typeof font.defSubset === 'string' &&
    typeof font.variable === 'boolean'
  );
};

/** Load the complete Fontsource catalog once per editor session. */
export const getFontsourceCatalog = async (): Promise<FontsourceFont[]> => {
  if (!catalogPromise) {
    catalogPromise = fetch(FONTSOURCE_API, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Fontsource returned ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) {
          throw new Error('Fontsource returned an unexpected catalog.');
        }
        return payload
          .filter(isFontsourceFont)
          .map((font) => ({
            ...font,
            category: typeof font.category === 'string' ? font.category : 'other',
            type: typeof font.type === 'string' ? font.type : 'google',
          }))
          .sort((left, right) => left.family.localeCompare(right.family));
      })
      .catch((error) => {
        catalogPromise = undefined;
        throw error;
      });
  }
  return catalogPromise;
};

const normalizeStyle = (font: FontsourceFont, style: string) =>
  style === 'italic' && font.styles.includes('italic') ? 'italic' : 'normal';

const normalizeSubset = (font: FontsourceFont, subset: string) =>
  font.subsets.includes(subset)
    ? subset
    : font.subsets.includes(font.defSubset)
      ? font.defSubset
      : (font.subsets[0] ?? 'latin');

const normalizeWeight = (font: FontsourceFont, weight: number | undefined) => {
  const preferred = weight ?? 400;
  return font.weights.includes(preferred) ? preferred : (font.weights[0] ?? 400);
};

/** Direct jsDelivr URL for a single Fontsource WOFF2 file. */
export const fontsourceFontUrl = (font: FontsourceFont, options: FontsourceFontOptions) => {
  const subset = normalizeSubset(font, options.subset);
  const style = normalizeStyle(font, options.style);
  const family = font.variable ? `${font.id}:vf` : font.id;
  const weight = font.variable ? 'wght' : String(normalizeWeight(font, options.weight));
  return `${FONTSOURCE_CDN}/${family}@latest/${subset}-${weight}-${style}.woff2`;
};

/** Stable local filename used inside the editor cache and theme assets. */
export const fontsourceAssetName = (font: FontsourceFont, options: FontsourceFontOptions) => {
  const subset = normalizeSubset(font, options.subset);
  const style = normalizeStyle(font, options.style);
  const weight = font.variable ? 'variable' : String(normalizeWeight(font, options.weight));
  return `font_${font.id.replace(/[^a-z0-9]+/gi, '_')}_${subset}_${weight}_${style}.woff2`;
};

/** Key used to avoid duplicate family/weight/style entries in a theme. */
export const themeFontKey = (family: string, weight: string, style: string) =>
  `${family.trim().toLowerCase()}|${weight.trim()}|${style}`;

export const fontsourceFontKey = (font: FontsourceFont, options: FontsourceFontOptions) => {
  const weight = font.variable ? '100 900' : String(normalizeWeight(font, options.weight));
  return themeFontKey(font.family, weight, normalizeStyle(font, options.style));
};

/** Sensible face to use when previewing a catalog family as a whole. */
export const defaultFontsourceOptions = (font: FontsourceFont): FontsourceFontOptions => ({
  weight: normalizeWeight(font, 400),
  style: normalizeStyle(font, 'normal'),
  subset: normalizeSubset(font, font.defSubset),
});

export const fontCacheDirectory = async () =>
  await path.join(await path.homeDir(), '.ezpplauncher', 'font-cache');

/**
 * Download a selected Fontsource face into the editor cache. The cached file is
 * later copied into the theme's assets folder when the theme is saved.
 */
export const downloadFontsourceFont = async (
  font: FontsourceFont,
  options: FontsourceFontOptions
): Promise<{ name: string; source: string; url: string }> => {
  const url = fontsourceFontUrl(font, options);
  const name = fontsourceAssetName(font, options);
  const directory = await fontCacheDirectory();
  const target = await path.join(directory, name);

  await fs.mkdir(directory, { recursive: true });

  if (!(await fs.exists(target))) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not download ${font.family} (${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error(`Fontsource returned an empty file for ${font.family}.`);
    }
    await fs.writeFile(target, bytes);
  }

  return { name, source: target, url };
};
