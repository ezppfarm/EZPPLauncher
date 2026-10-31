import type { ThemeV2ScriptValue } from './themeV2';

/**
 * Text layers can display rule variables with `{name}` placeholders. The
 * pattern intentionally matches script identifiers only, so ordinary braces in
 * copy are left alone and every reference can also be offered in the editor.
 */
const VARIABLE_PATTERN = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g;
const BLOCKED_NAMES = new Set(['__proto__', 'prototype', 'constructor', 'screen']);

const variableName = (value: string): string | undefined => {
  if (!value || BLOCKED_NAMES.has(value)) return undefined;
  return value;
};

/** Variable names referenced by a text layer, in first-use order. */
export const themeTextVariableNames = (text: string): string[] => {
  const names = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = variableName(match[1]);
    if (name) names.add(name);
  }
  return [...names];
};

/**
 * Replace `{variable}` placeholders with their current rule values. Unknown
 * names stay visible instead of silently disappearing, which makes typos easy
 * to spot in the editor and in the launcher.
 */
export const interpolateThemeText = (
  text: string,
  variables: Record<string, ThemeV2ScriptValue>
): string => {
  if (!text.includes('{')) return text;
  return text.replace(VARIABLE_PATTERN, (placeholder, rawName: string) => {
    const name = variableName(rawName);
    if (!name || !Object.prototype.hasOwnProperty.call(variables, name)) return placeholder;
    const value = variables[name];
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    return typeof value === 'boolean' ? String(value) : String(value ?? '');
  });
};
