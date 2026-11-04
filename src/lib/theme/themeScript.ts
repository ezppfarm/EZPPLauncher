import { isThemeClockVariable, themeClockValues } from './themeClock';
import {
  executeThemeScript,
  formatThemeScriptError,
  parseThemeScript,
  themeScriptSourceVariables,
  type ThemeScriptProgram,
} from './themeScriptLang';
import { themeTextVariableNames } from './themeTextVariables';
import {
  themeGroupAncestors,
  type ThemeV2Behavior,
  type ThemeV2BehaviorAction,
  type ThemeV2BehaviorCondition,
  type ThemeV2BehaviorOperator,
  type ThemeV2BehaviorTrigger,
  type ThemeV2Definition,
  type ThemeV2Element,
  type ThemeV2Group,
  type ThemeV2ScriptScreen,
  type ThemeV2ScriptValue,
} from './themeV2';
import { get, writable } from 'svelte/store';

export type ThemeScriptState = {
  variables: Record<string, ThemeV2ScriptValue>;
  /** Per-element visibility overrides set by rules. */
  visibility: Record<string, boolean>;
  /** Per-group visibility overrides set by rules. */
  groupVisibility: Record<string, boolean>;
};

export type ThemeScriptHandlers = {
  navigate?: (screen: ThemeV2ScriptScreen) => void;
  launch?: () => void;
  openUrl?: (url: string) => void;
};

export type ThemeScriptEvalContext = {
  variables: Record<string, ThemeV2ScriptValue>;
  screen: ThemeV2ScriptScreen;
  isVisible: (elementId: string) => boolean;
  isGroupVisible: (groupId: string) => boolean;
  random: () => number;
};

const emptyState = (): ThemeScriptState => ({
  variables: {},
  visibility: {},
  groupVisibility: {},
});

export const themeScriptState = writable<ThemeScriptState>(emptyState());

let definition: ThemeV2Definition | undefined;
let currentScreen: ThemeV2ScriptScreen = 'home';
let handlers: ThemeScriptHandlers = {};
let state = emptyState();
let firedRules = new Set<string>();
const timerHandles = new Map<string, ReturnType<typeof setInterval>>();
let compiledScripts = new Map<string, ThemeScriptProgram>();
let clockHandle: ReturnType<typeof setInterval> | undefined;

const publish = () => {
  themeScriptState.set({
    variables: { ...state.variables },
    visibility: { ...state.visibility },
    groupVisibility: { ...state.groupVisibility },
  });
};

const elementById = (elementId: string): ThemeV2Element | undefined =>
  definition?.elements?.find((element) => element.id === elementId);

const baseHidden = (element: ThemeV2Element) =>
  element.hidden === true ||
  themeGroupAncestors(definition?.groups, element).some((group) => group.hidden === true);

const groupChain = (groupId: string): ThemeV2Group[] => {
  const byId = new Map((definition?.groups ?? []).map((group) => [group.id, group]));
  const chain: ThemeV2Group[] = [];
  const seen = new Set<string>();
  let current = byId.get(groupId);
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
};

export const themeScriptGroupVisible = (groupId: string): boolean => {
  const chain = groupChain(groupId);
  if (chain.length === 0) return false;
  if (chain.some((group) => state.groupVisibility[group.id] === false)) return false;
  const own = state.groupVisibility[groupId];
  if (own !== undefined) return own;
  if (chain.some((group) => state.groupVisibility[group.id] === true)) return true;
  return !chain.some((group) => group.hidden === true);
};

export const themeScriptElementVisible = (elementId: string): boolean => {
  const element = elementById(elementId);
  if (!element) return false;
  const ancestors = themeGroupAncestors(definition?.groups, element);
  if (ancestors.some((group) => state.groupVisibility[group.id] === false)) return false;
  const override = state.visibility[elementId];
  if (override !== undefined) return override;
  if (ancestors.some((group) => state.groupVisibility[group.id] === true)) return true;
  return !baseHidden(element);
};

export const themeScriptVariableNames = (theme: ThemeV2Definition | undefined): string[] => {
  const names = new Set<string>();
  if (!theme) return [];
  // Include variables that only declare a starting value so they stay visible
  // in the editor and can be reset instead of disappearing silently. Clock
  // values are supplied by the runtime and are not editable defaults.
  for (const name of Object.keys(theme.variables ?? {})) {
    if (!isThemeClockVariable(name)) names.add(name);
  }
  for (const element of theme.elements ?? []) {
    if (element.type === 'text') {
      for (const name of themeTextVariableNames(element.text)) {
        if (!isThemeClockVariable(name)) names.add(name);
      }
    } else if (element.type === 'svelte') {
      // Custom layers read variables as props. Include those names so the
      // variable defaults panel and IntelliSense know about them.
      for (const match of element.source.matchAll(/\bvariables\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!isThemeClockVariable(match[1])) names.add(match[1]);
      }
    }
  }
  for (const behavior of theme.behaviors ?? []) {
    for (const condition of behavior.conditions ?? []) {
      if (condition.type === 'variable' && !isThemeClockVariable(condition.variable)) {
        names.add(condition.variable);
      }
    }
    for (const action of behavior.actions) {
      if (
        (action.type === 'setVariable' ||
          action.type === 'changeVariable' ||
          action.type === 'toggleVariable') &&
        !isThemeClockVariable(action.variable)
      ) {
        names.add(action.variable);
      }
    }
    if (behavior.script !== undefined) {
      for (const name of themeScriptSourceVariables(behavior.script)) {
        if (!isThemeClockVariable(name)) names.add(name);
      }
    }
  }
  return [...names];
};

/** All variables a theme starts with; rule triggers and text layers add more. */
export const themeScriptInitialVariables = (
  theme: ThemeV2Definition | undefined
): Record<string, ThemeV2ScriptValue> => {
  const defaults = theme?.variables ?? {};
  const values = Object.fromEntries(
    themeScriptVariableNames(theme).map((name) => [
      name,
      Object.prototype.hasOwnProperty.call(defaults, name) ? defaults[name] : 0,
    ])
  );
  // Clock values are always current and override any same-named defaults.
  return { ...values, ...themeClockValues() };
};

const sameValue = (actual: ThemeV2ScriptValue | undefined, expected: ThemeV2ScriptValue) => {
  if (typeof expected === 'number') return Number(actual) === expected;
  if (typeof expected === 'boolean') return Boolean(actual) === expected;
  return String(actual ?? '') === expected;
};

const compareValues = (
  actual: ThemeV2ScriptValue | undefined,
  expected: ThemeV2ScriptValue,
  operator: ThemeV2BehaviorOperator
) => {
  switch (operator) {
    case 'notEquals':
      return !sameValue(actual, expected);
    case 'greaterThan':
      return Number(actual) > Number(expected);
    case 'lessThan':
      return Number(actual) < Number(expected);
    case 'greaterOrEqual':
      return Number(actual) >= Number(expected);
    case 'lessOrEqual':
      return Number(actual) <= Number(expected);
    default:
      return sameValue(actual, expected);
  }
};

export const themeScriptConditionMatches = (
  condition: ThemeV2BehaviorCondition,
  context: ThemeScriptEvalContext
): boolean => {
  switch (condition.type) {
    case 'variable':
      return compareValues(
        context.variables[condition.variable],
        condition.value,
        condition.operator
      );
    case 'visible':
      return context.isVisible(condition.elementId) === condition.value;
    case 'groupVisible':
      return context.isGroupVisible(condition.groupId) === condition.value;
    case 'screen':
      return context.screen === condition.screen;
    case 'chance':
      return context.random() * 100 < condition.percent;
    default:
      return false;
  }
};

export const themeScriptConditionsMatch = (
  conditions: ThemeV2BehaviorCondition[] | undefined,
  mode: 'all' | 'any',
  context: ThemeScriptEvalContext
): boolean => {
  if (!conditions || conditions.length === 0) return true;
  if (mode === 'any')
    return conditions.some((condition) => themeScriptConditionMatches(condition, context));
  return conditions.every((condition) => themeScriptConditionMatches(condition, context));
};

const triggerMatches = (
  trigger: ThemeV2BehaviorTrigger,
  type: 'load' | 'screen' | 'click' | 'hover' | 'leave' | 'timer',
  detail: { elementId?: string; screen?: ThemeV2ScriptScreen }
) => {
  if (trigger.type !== type) return false;
  if (trigger.type === 'screen') return trigger.screen === detail.screen;
  if (trigger.type === 'click' || trigger.type === 'hover' || trigger.type === 'leave') {
    return !trigger.elementId || trigger.elementId === detail.elementId;
  }
  return true;
};

const context = (): ThemeScriptEvalContext => ({
  variables: state.variables,
  screen: currentScreen,
  isVisible: themeScriptElementVisible,
  isGroupVisible: themeScriptGroupVisible,
  random: Math.random,
});

const applyActions = (actions: ThemeV2BehaviorAction[], allowExternal: boolean) => {
  if (actions.length === 0) return;
  for (const action of actions) {
    switch (action.type) {
      case 'setVariable':
        if (isThemeClockVariable(action.variable)) break;
        state.variables[action.variable] = action.value;
        break;
      case 'changeVariable':
        if (isThemeClockVariable(action.variable)) break;
        state.variables[action.variable] =
          Number(state.variables[action.variable] ?? 0) + action.amount;
        break;
      case 'toggleVariable':
        if (isThemeClockVariable(action.variable)) break;
        state.variables[action.variable] = !state.variables[action.variable];
        break;
      case 'showElement':
        state.visibility[action.elementId] = true;
        break;
      case 'hideElement':
        state.visibility[action.elementId] = false;
        break;
      case 'toggleElement':
        state.visibility[action.elementId] = !themeScriptElementVisible(action.elementId);
        break;
      case 'showGroup':
        state.groupVisibility[action.groupId] = true;
        break;
      case 'hideGroup':
        state.groupVisibility[action.groupId] = false;
        break;
      case 'toggleGroup':
        state.groupVisibility[action.groupId] = !themeScriptGroupVisible(action.groupId);
        break;
      case 'navigate':
        handlers.navigate?.(action.screen);
        break;
      case 'launch':
        // Leaving the launcher is only allowed from an explicit click.
        if (allowExternal) handlers.launch?.();
        break;
      case 'openUrl':
        if (allowExternal && /^https?:\/\//i.test(action.url)) handlers.openUrl?.(action.url);
        break;
      default:
        break;
    }
  }
  publish();
};

const compileThemeScripts = (theme: ThemeV2Definition | undefined) => {
  compiledScripts = new Map<string, ThemeScriptProgram>();
  for (const rule of theme?.behaviors ?? []) {
    if (rule.script === undefined) continue;
    const result = parseThemeScript(rule.script);
    if (result.errors.length > 0) {
      console.warn(
        `Theme rule "${rule.name ?? rule.id}" has an invalid advanced script: ${formatThemeScriptError(
          result.errors[0]
        )}`
      );
      continue;
    }
    compiledScripts.set(rule.id, result.program);
  }
};

const runCompiledScript = (program: ThemeScriptProgram, allowExternal: boolean) => {
  executeThemeScript(program, {
    variables: state.variables,
    screen: currentScreen,
    random: Math.random,
    isVisible: themeScriptElementVisible,
    isGroupVisible: themeScriptGroupVisible,
    setElementVisible: (elementId, visible) => {
      state.visibility[elementId] = visible;
    },
    setGroupVisible: (groupId, visible) => {
      state.groupVisibility[groupId] = visible;
    },
    navigate: (screen) => handlers.navigate?.(screen),
    openUrl: (url) => handlers.openUrl?.(url),
    launch: () => handlers.launch?.(),
    allowExternal,
  });
  publish();
};

const stopRuleTimer = (ruleId: string) => {
  const handle = timerHandles.get(ruleId);
  if (handle !== undefined) {
    clearInterval(handle);
    timerHandles.delete(ruleId);
  }
};

const behaviorTargetMatches = (rule: ThemeV2Behavior, detail: { elementId?: string }): boolean => {
  if (!rule.target) return true;
  if (
    rule.trigger.type !== 'click' &&
    rule.trigger.type !== 'hover' &&
    rule.trigger.type !== 'leave'
  ) {
    return true;
  }
  if (!detail.elementId) return false;
  if (rule.target.type === 'element') return rule.target.id === detail.elementId;

  const element = elementById(detail.elementId);
  if (!element) return false;
  return themeGroupAncestors(definition?.groups, element).some(
    (group) => group.id === rule.target?.id
  );
};

const runRule = (
  rule: ThemeV2Behavior,
  type: 'load' | 'screen' | 'click' | 'hover' | 'leave' | 'timer',
  detail: { elementId?: string; screen?: ThemeV2ScriptScreen } = {}
) => {
  if (rule.enabled === false) return;
  if (rule.once && firedRules.has(rule.id)) return;
  if (!triggerMatches(rule.trigger, type, detail)) return;
  if (!behaviorTargetMatches(rule, detail)) return;
  if (!themeScriptConditionsMatch(rule.conditions, rule.conditionMode ?? 'all', context())) return;
  if (rule.once) {
    firedRules.add(rule.id);
    stopRuleTimer(rule.id);
  }

  if (rule.script !== undefined) {
    const program = compiledScripts.get(rule.id);
    if (program) runCompiledScript(program, type === 'click');
    return;
  }

  applyActions(rule.actions, type === 'click');
};

const runRules = (
  type: 'load' | 'screen' | 'click' | 'hover' | 'leave' | 'timer',
  detail: { elementId?: string; screen?: ThemeV2ScriptScreen } = {}
) => {
  if (!definition) return;
  for (const rule of definition.behaviors ?? []) {
    runRule(rule, type, detail);
  }
};

const updateClock = () => {
  if (!definition) return;
  Object.assign(state.variables, themeClockValues());
  publish();
};

const stopClock = () => {
  if (clockHandle !== undefined) {
    clearInterval(clockHandle);
    clockHandle = undefined;
  }
};

const startClock = () => {
  stopClock();
  updateClock();
  clockHandle = setInterval(updateClock, 1000);
};

const startTimers = () => {
  for (const rule of definition?.behaviors ?? []) {
    if (rule.enabled === false || rule.trigger.type !== 'timer') continue;
    const milliseconds = Math.max(500, rule.trigger.interval * 1000);
    const handle = setInterval(() => runRule(rule, 'timer'), milliseconds);
    timerHandles.set(rule.id, handle);
  }
};

const stopTimers = () => {
  for (const handle of timerHandles.values()) clearInterval(handle);
  timerHandles.clear();
};

export const setThemeScriptHandlers = (next: ThemeScriptHandlers) => {
  handlers = { ...handlers, ...next };
};

/** Load a theme's rules, reset its variables and start timer triggers. */
export const loadThemeScript = (next: ThemeV2Definition | undefined) => {
  stopTimers();
  stopClock();
  definition = next;
  state = emptyState();
  firedRules = new Set<string>();
  compileThemeScripts(next);
  state.variables = themeScriptInitialVariables(next);
  publish();
  if (!next) return;
  startClock();
  startTimers();
  runRules('load');
  runRules('screen', { screen: currentScreen });
};

export const stopThemeScript = () => {
  stopTimers();
  stopClock();
  definition = undefined;
  state = emptyState();
  firedRules = new Set<string>();
  compiledScripts = new Map<string, ThemeScriptProgram>();
  publish();
};

export const setThemeScriptScreen = (screen: ThemeV2ScriptScreen) => {
  if (currentScreen === screen) return;
  currentScreen = screen;
  runRules('screen', { screen });
};

export const triggerThemeScriptElement = (
  elementId: string,
  interaction: 'click' | 'hover' | 'leave'
) => {
  runRules(interaction, { elementId });
};

/** Exposed for editor previews and tests. */
export const evaluateThemeScriptConditions = (
  conditions: ThemeV2BehaviorCondition[] | undefined,
  mode: 'all' | 'any',
  variables: Record<string, ThemeV2ScriptValue>,
  screen: ThemeV2ScriptScreen,
  isVisible: (elementId: string) => boolean,
  random: () => number = Math.random,
  isGroupVisible: (groupId: string) => boolean = () => true
) =>
  themeScriptConditionsMatch(conditions, mode, {
    variables,
    screen,
    isVisible,
    isGroupVisible,
    random,
  });

export const getThemeScriptState = () => get(themeScriptState);
