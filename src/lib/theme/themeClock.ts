import type { ThemeV2ScriptValue } from './themeV2';

/**
 * Built-in clock values available to theme text layers and logic. They are
 * refreshed by the theme script runtime and are read-only for theme authors.
 */
export const THEME_CLOCK_VARIABLE_NAMES = [
  'time',
  'time12',
  'timeSeconds',
  'hour',
  'minute',
  'second',
  'dayPeriod',
] as const;

export type ThemeClockVariableName = (typeof THEME_CLOCK_VARIABLE_NAMES)[number];

const CLOCK_VARIABLE_SET = new Set<string>(THEME_CLOCK_VARIABLE_NAMES);

export const isThemeClockVariable = (name: string): name is ThemeClockVariableName =>
  CLOCK_VARIABLE_SET.has(name);

const pad = (value: number) => String(value).padStart(2, '0');

/** Local clock values, using the viewer's locale-independent 24h/12h formats. */
export const themeClockValues = (now: Date = new Date()): Record<string, ThemeV2ScriptValue> => {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  const time = `${pad(hour)}:${pad(minute)}`;
  const dayPeriod = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 || 12;

  return {
    time,
    time12: `${hour12}:${pad(minute)} ${dayPeriod}`,
    timeSeconds: `${time}:${pad(second)}`,
    hour,
    minute,
    second,
    dayPeriod,
  };
};
