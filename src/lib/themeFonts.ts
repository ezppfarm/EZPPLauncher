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

export const fontStack = (family: string | undefined, fallback = 'Sora Variable') =>
  `"${(family || fallback).replace(/["\\]/g, '\\$&')}", ui-sans-serif, system-ui, sans-serif`;
