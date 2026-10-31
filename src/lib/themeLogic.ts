import {
  themeGroupAncestors,
  type ThemeV2Behavior,
  type ThemeV2BehaviorAction,
  type ThemeV2BehaviorTarget,
  type ThemeV2Element,
  type ThemeV2Group,
} from './themeV2';

export const themeElementLabel = (element: ThemeV2Element): string => {
  if (element.name?.trim()) return element.name.trim();
  if (element.type === 'text') return element.text.trim().slice(0, 32) || 'Text layer';
  if (element.type === 'data') return element.field;
  if (element.type === 'shape') return element.shape;
  if (element.type === 'icon') return `${element.icon} icon`;
  if (element.type === 'ticker') return element.text.trim().slice(0, 32) || 'Ticker';
  if (element.type === 'gauge') return `${element.mode ?? 'bar'} gauge`;
  if (element.type === 'button') return element.label.trim() || 'Button';
  if (element.type === 'repeater') {
    return element.source === 'image' ? 'Image repeater' : `${element.icon ?? 'Icon'} repeater`;
  }
  if (element.type === 'lottie') return element.src.split('/').pop() || 'Lottie animation';
  if (element.type === 'path') return 'Vector path';
  if (element.type === 'particles') return `${element.preset} particles`;
  if (element.type === 'clock') return `${element.mode ?? 'digital'} clock`;
  if (element.type === 'countdown')
    return element.target ? `Countdown · ${element.target}` : 'Countdown';
  if (element.type === 'svelte') return 'Svelte component';
  if (element.type === 'widget') {
    switch (element.widget) {
      case 'launch-button':
        return 'Launch button widget';
      case 'player-card':
        return 'Player card widget';
      case 'recent-activity':
        return 'Recent activity widget';
      case 'telemetry':
        return 'Telemetry bar widget';
      case 'header':
        return 'Header widget';
      case 'avatar':
        return 'Player avatar widget';
      default:
        return 'Widget';
    }
  }
  return element.src.split('/').pop() || element.type;
};

export const themeGroupLabel = (group: ThemeV2Group): string =>
  group.name?.trim() || 'Untitled group';

export const themeGroupContainsElement = (
  groups: ThemeV2Group[],
  groupId: string,
  element: ThemeV2Element
) => themeGroupAncestors(groups, element).some((group) => group.id === groupId);

export const themeGroupInteractiveCount = (
  groups: ThemeV2Group[],
  elements: ThemeV2Element[],
  groupId: string
) =>
  elements.filter(
    (element) => element.interactive === true && themeGroupContainsElement(groups, groupId, element)
  ).length;

export const themeBehaviorTargetLabel = (
  target: ThemeV2BehaviorTarget | undefined,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[]
): string => {
  if (!target) return 'Global';
  if (target.type === 'element') {
    const element = elements.find((candidate) => candidate.id === target.id);
    return element ? `Layer · ${themeElementLabel(element)}` : 'Layer · missing';
  }
  const group = groups.find((candidate) => candidate.id === target.id);
  return group ? `Group · ${themeGroupLabel(group)}` : 'Group · missing';
};

const pointerVerb = (triggerType: 'click' | 'hover' | 'leave') => {
  if (triggerType === 'hover') return 'Hover';
  if (triggerType === 'leave') return 'Leave';
  return 'Click';
};

export const themeBehaviorTriggerLabel = (
  behavior: ThemeV2Behavior,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[]
): string => {
  const trigger = behavior.trigger;
  if (trigger.type === 'load') return 'Theme loads';
  if (trigger.type === 'screen') {
    return `On ${trigger.screen[0].toUpperCase()}${trigger.screen.slice(1)} screen`;
  }
  if (trigger.type === 'timer') return `Every ${trigger.interval}s`;

  const verb = pointerVerb(trigger.type);
  if (behavior.target?.type === 'element') {
    const element = elements.find((candidate) => candidate.id === behavior.target?.id);
    return `${verb} · ${element ? themeElementLabel(element) : 'linked layer'}`;
  }
  if (behavior.target?.type === 'group') {
    const group = groups.find((candidate) => candidate.id === behavior.target?.id);
    return `${verb} · inside ${group ? themeGroupLabel(group) : 'linked group'}`;
  }
  if (trigger.elementId) {
    const element = elements.find((candidate) => candidate.id === trigger.elementId);
    return `${verb} · ${element ? themeElementLabel(element) : 'missing layer'}`;
  }
  return `${verb} · any interactive layer`;
};

export const themeBehaviorActionLabel = (
  action: ThemeV2BehaviorAction,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[]
): string => {
  const elementLabel = (id: string) => {
    const element = elements.find((candidate) => candidate.id === id);
    return element ? themeElementLabel(element) : 'missing layer';
  };
  const groupLabel = (id: string) => {
    const group = groups.find((candidate) => candidate.id === id);
    return group ? themeGroupLabel(group) : 'missing group';
  };

  switch (action.type) {
    case 'setVariable':
      return `Set ${action.variable}`;
    case 'changeVariable':
      return `${action.amount >= 0 ? 'Add' : 'Subtract'} ${Math.abs(action.amount)} · ${action.variable}`;
    case 'toggleVariable':
      return `Toggle ${action.variable}`;
    case 'showElement':
      return `Show ${elementLabel(action.elementId)}`;
    case 'hideElement':
      return `Hide ${elementLabel(action.elementId)}`;
    case 'toggleElement':
      return `Toggle ${elementLabel(action.elementId)}`;
    case 'showGroup':
      return `Show group · ${groupLabel(action.groupId)}`;
    case 'hideGroup':
      return `Hide group · ${groupLabel(action.groupId)}`;
    case 'toggleGroup':
      return `Toggle group · ${groupLabel(action.groupId)}`;
    case 'navigate':
      return `Go to ${action.screen}`;
    case 'launch':
      return 'Launch osu!';
    case 'openUrl':
      return 'Open URL';
  }
};

export const themeBehaviorSummary = (
  behavior: ThemeV2Behavior,
  elements: ThemeV2Element[],
  groups: ThemeV2Group[],
  limit = 2
): string => {
  const trigger = themeBehaviorTriggerLabel(behavior, elements, groups);
  if (behavior.script !== undefined) {
    const lines = behavior.script.split('\n').filter((line) => line.trim()).length;
    return `${trigger} → Advanced script · ${lines} line${lines === 1 ? '' : 's'}`;
  }
  if (behavior.actions.length === 0) return `${trigger} · no action`;
  const actions = behavior.actions.map((action) =>
    themeBehaviorActionLabel(action, elements, groups)
  );
  const visible = actions.slice(0, limit);
  const remaining = actions.length - visible.length;
  return `${trigger} → ${visible.join(' · ')}${remaining > 0 ? ` +${remaining}` : ''}`;
};
