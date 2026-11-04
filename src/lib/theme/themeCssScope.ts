/**
 * Theme custom CSS is global in the launcher. The advanced editor renders a
 * single 1000 x 650 canvas at a time, so previews are scoped to that canvas
 * instead of restyling the editor's own chrome.
 */

const ROOT_SELECTORS = /(^|[\s>+~,(])(?::root|html|body)(?=$|[\s>+~.#:[\],)])/g;

const splitSelectorList = (selectorText: string): string[] => {
  const selectors: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(' || character === '[') {
      depth += 1;
      continue;
    }
    if ((character === ')' || character === ']') && depth > 0) {
      depth -= 1;
      continue;
    }
    if (character === ',' && depth === 0) {
      selectors.push(selectorText.slice(start, index));
      start = index + 1;
    }
  }

  selectors.push(selectorText.slice(start));
  return selectors;
};

const scopeSelector = (selector: string, scope: string): string => {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.startsWith(scope)) return trimmed;

  const rooted = trimmed.replace(
    ROOT_SELECTORS,
    (_match, boundary: string) => `${boundary}${scope}`
  );
  if (rooted.startsWith(scope)) return rooted;
  return `${scope} ${rooted}`;
};

/** Prefix every selector in a comma-separated list with the editor canvas scope. */
export const scopeThemeSelectors = (selectorText: string, scope: string): string =>
  splitSelectorList(selectorText)
    .map((selector) => scopeSelector(selector, scope))
    .filter(Boolean)
    .join(', ');

const scopeRule = (rule: CSSRule, scope: string) => {
  if (rule.type === 1) {
    const styleRule = rule as CSSStyleRule;
    styleRule.selectorText = scopeThemeSelectors(styleRule.selectorText, scope);
    return;
  }

  const grouping = rule as CSSGroupingRule;
  if (grouping.cssRules) {
    for (const child of Array.from(grouping.cssRules)) scopeRule(child, scope);
  }
};

/**
 * Parse custom CSS with the browser and scope its selectors to the preview
 * canvas. `@font-face`, keyframes and at-rule blocks are preserved.
 */
export const scopeThemeCss = (css: string | undefined, scope: string): string => {
  const source = css?.trim();
  if (!source || typeof document === 'undefined') return '';

  const style = document.createElement('style');
  style.media = 'not all';
  style.textContent = source;
  document.head.appendChild(style);

  try {
    const sheet = style.sheet;
    if (!sheet) return '';
    const rules = Array.from(sheet.cssRules);
    for (const rule of rules) scopeRule(rule, scope);
    return rules.map((rule) => rule.cssText).join('\n');
  } catch {
    return '';
  } finally {
    style.remove();
  }
};
