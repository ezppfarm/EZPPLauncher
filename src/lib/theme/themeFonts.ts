export type ThemeFontChoice = {
  label: string;
  family: string;
  category: 'Sans' | 'Serif' | 'Display' | 'Mono' | 'Custom';
};

/** Fonts bundled with the launcher through @fontsource. */
export const BUNDLED_THEME_FONTS: ThemeFontChoice[] = [
  { label: 'Sora', family: 'Sora Variable', category: 'Sans' },
  { label: 'Montserrat', family: 'Montserrat Variable', category: 'Sans' },
  { label: 'Bebas Neue', family: 'Bebas Neue', category: 'Display' },
  { label: 'Playfair Display', family: 'Playfair Display Variable', category: 'Serif' },
  { label: 'Space Mono', family: 'Space Mono', category: 'Mono' },
  { label: 'JetBrains Mono', family: 'JetBrains Mono Variable', category: 'Mono' },
];

const quoteFamily = (family: string) => `"${family.replace(/["\\]/g, '\\$&')}"`;

export const fontStack = (family: string | undefined, fallback = 'Sora Variable') =>
  `${quoteFamily(family || fallback)}, ui-sans-serif, system-ui, sans-serif`;

export const monoFontStack = (family: string | undefined, fallback = 'Space Mono') =>
  `${quoteFamily(family || fallback)}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

const normalizeFamily = (family: string) =>
  family
    .trim()
    .toLowerCase()
    .replace(/\s+variable$/, '');

/** Resolve a Fontsource family name to the family the launcher already ships. */
export const bundledThemeFontFamily = (family: string | undefined) => {
  if (!family) return undefined;
  const normalized = normalizeFamily(family);
  return BUNDLED_THEME_FONTS.find(
    (font) =>
      normalizeFamily(font.family) === normalized || normalizeFamily(font.label) === normalized
  )?.family;
};
