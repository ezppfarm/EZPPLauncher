<script lang="ts">
  import ThemeScriptEditor from '$lib/components/theme/ThemeScriptEditor.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import { isThemeClockVariable, THEME_CLOCK_VARIABLE_NAMES } from '$lib/themeClock';
  import {
    themeBehaviorTargetLabel,
    themeElementLabel,
    themeGroupInteractiveCount,
    themeGroupLabel,
  } from '$lib/themeLogic';
  import {
    formatThemeScriptError,
    parseThemeScript,
    themeScriptProgramCanLeaveLauncher,
  } from '$lib/themeScriptLang';
  import type {
    ThemeV2Behavior,
    ThemeV2BehaviorAction,
    ThemeV2BehaviorCondition,
    ThemeV2BehaviorOperator,
    ThemeV2BehaviorTarget,
    ThemeV2BehaviorTrigger,
    ThemeV2Element,
    ThemeV2Group,
    ThemeV2ScriptScreen,
    ThemeV2ScriptValue,
  } from '$lib/themeV2';
  import { Link2, Plus, Trash2 } from '@lucide/svelte';
  import { SvelteSet } from 'svelte/reactivity';

  let {
    behavior,
    elements,
    groups = [],
    variables = [],
    ondelete,
    embedded = false,
  }: {
    behavior: ThemeV2Behavior;
    elements: ThemeV2Element[];
    groups?: ThemeV2Group[];
    variables?: string[];
    ondelete: () => void;
    embedded?: boolean;
  } = $props();

  const themeVariables = $derived(variables.filter((name) => !isThemeClockVariable(name)));
  // Keep the quick-pick row compact; the longer formats are still documented
  // and available to scripts.
  const clockConditionNames = THEME_CLOCK_VARIABLE_NAMES.filter(
    (name) => name !== 'time12' && name !== 'timeSeconds'
  );

  let activeSection = $state<'when' | 'if' | 'then'>('when');

  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const tabClass =
    'flex h-6 flex-1 items-center justify-center gap-1 rounded px-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors';

  const screens: { value: ThemeV2ScriptScreen; label: string }[] = [
    { value: 'home', label: 'Home' },
    { value: 'themes', label: 'Themes' },
    { value: 'settings', label: 'Settings' },
    { value: 'login', label: 'Login' },
  ];
  const triggerOptions = [
    { value: 'load', label: 'Theme loads' },
    { value: 'screen', label: 'Screen changes' },
    { value: 'click', label: 'Clicked' },
    { value: 'hover', label: 'Pointer enters' },
    { value: 'leave', label: 'Pointer leaves' },
    { value: 'timer', label: 'Timer repeats' },
  ];
  const operators: { value: ThemeV2BehaviorOperator; label: string }[] = [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' },
    { value: 'greaterThan', label: 'is greater than' },
    { value: 'lessThan', label: 'is less than' },
    { value: 'greaterOrEqual', label: 'is at least' },
    { value: 'lessOrEqual', label: 'is at most' },
  ];
  const conditionOptions = [
    { value: 'variable', label: 'Variable comparison' },
    { value: 'visible', label: 'Layer visibility' },
    { value: 'groupVisible', label: 'Group visibility' },
    { value: 'screen', label: 'Current screen' },
    { value: 'chance', label: 'Random chance' },
  ];
  const actionOptions = [
    { value: 'setVariable', label: 'Set variable' },
    { value: 'changeVariable', label: 'Change number' },
    { value: 'toggleVariable', label: 'Toggle boolean' },
    { value: 'showElement', label: 'Show layer' },
    { value: 'hideElement', label: 'Hide layer' },
    { value: 'toggleElement', label: 'Toggle layer' },
    { value: 'showGroup', label: 'Show group' },
    { value: 'hideGroup', label: 'Hide group' },
    { value: 'toggleGroup', label: 'Toggle group' },
    { value: 'navigate', label: 'Go to screen' },
    { value: 'launch', label: 'Launch osu!' },
    { value: 'openUrl', label: 'Open a URL' },
  ];
  const groupOptions = $derived(
    groups.map((group) => ({ value: group.id, label: themeGroupLabel(group) }))
  );
  const hasGroups = $derived(groups.length > 0);
  const availableConditionOptions = $derived(
    conditionOptions.filter((option) => option.value !== 'groupVisible' || hasGroups)
  );
  const groupActionTypes = new SvelteSet(['showGroup', 'hideGroup', 'toggleGroup']);
  const availableActionOptions = $derived(
    actionOptions.filter((option) => !groupActionTypes.has(option.value) || hasGroups)
  );

  const elementOptions = $derived(
    elements.map((element) => ({
      value: element.id,
      label: `${element.name?.trim() || element.type} · ${element.id}`,
    }))
  );
  const triggerScreen = $derived(
    behavior.trigger.type === 'screen' ? behavior.trigger.screen : 'home'
  );
  const triggerElementId = $derived(
    behavior.trigger.type === 'click' ||
      behavior.trigger.type === 'hover' ||
      behavior.trigger.type === 'leave'
      ? behavior.trigger.elementId
      : undefined
  );
  const canAddCondition = $derived((behavior.conditions ?? []).length < 12);
  const canAddAction = $derived(behavior.actions.length < 20);
  const targetValue = $derived(
    behavior.target ? `${behavior.target.type}:${behavior.target.id}` : '_none'
  );
  const targetLabel = $derived(themeBehaviorTargetLabel(behavior.target, elements, groups));
  const targetName = $derived(targetLabel.replace(/^(?:Layer|Group) · /, ''));
  const pointerTrigger = $derived(
    behavior.trigger.type === 'click' ||
      behavior.trigger.type === 'hover' ||
      behavior.trigger.type === 'leave'
  );
  const targetInteractiveCount = $derived.by(() => {
    if (behavior.target?.type === 'element') {
      return elements.find((element) => element.id === behavior.target?.id)?.interactive ? 1 : 0;
    }
    if (behavior.target?.type === 'group') {
      return themeGroupInteractiveCount(groups, elements, behavior.target.id);
    }
    return 0;
  });
  const targetNeedsInteractive = $derived(
    pointerTrigger && Boolean(behavior.target) && targetInteractiveCount === 0
  );
  const conditionCount = $derived((behavior.conditions ?? []).length);
  const scriptMode = $derived(behavior.script !== undefined);
  const scriptResult = $derived(parseThemeScript(behavior.script ?? ''));
  const scriptError = $derived(scriptMode ? scriptResult.errors[0] : undefined);
  const thenCount = $derived(
    scriptMode
      ? (behavior.script ?? '').split('\n').filter((line) => line.trim()).length
      : behavior.actions.length
  );
  const scriptCanLeave = $derived(
    scriptMode && !scriptError && themeScriptProgramCanLeaveLauncher(scriptResult.program)
  );

  const scriptValue = (value: ThemeV2ScriptValue) =>
    typeof value === 'string' ? JSON.stringify(value) : String(value);

  function actionsToScript(actions: ThemeV2BehaviorAction[]): string {
    return actions
      .map((action) => {
        switch (action.type) {
          case 'setVariable':
            return `${action.variable} = ${scriptValue(action.value)};`;
          case 'changeVariable':
            return action.amount < 0
              ? `${action.variable} -= ${Math.abs(action.amount)};`
              : `${action.variable} += ${action.amount};`;
          case 'toggleVariable':
            return `${action.variable} = !${action.variable};`;
          case 'showElement':
            return `showLayer(${JSON.stringify(action.elementId)});`;
          case 'hideElement':
            return `hideLayer(${JSON.stringify(action.elementId)});`;
          case 'toggleElement':
            return `toggleLayer(${JSON.stringify(action.elementId)});`;
          case 'showGroup':
            return `showGroup(${JSON.stringify(action.groupId)});`;
          case 'hideGroup':
            return `hideGroup(${JSON.stringify(action.groupId)});`;
          case 'toggleGroup':
            return `toggleGroup(${JSON.stringify(action.groupId)});`;
          case 'navigate':
            return `goTo(${JSON.stringify(action.screen)});`;
          case 'openUrl':
            return `openUrl(${JSON.stringify(action.url)});`;
          case 'launch':
            return 'launch();';
        }
      })
      .join('\n');
  }

  function setScriptMode(enabled: boolean) {
    if (enabled) {
      if (behavior.script === undefined) behavior.script = actionsToScript(behavior.actions);
      return;
    }
    behavior.script = undefined;
  }

  const parseValue = (value: string): ThemeV2ScriptValue => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const number = Number(value);
    return value.trim() !== '' && Number.isFinite(number) ? number : value;
  };

  const nextVariableName = (): string => {
    const names = new SvelteSet<string>();
    for (const condition of behavior.conditions ?? []) {
      if (condition.type === 'variable') names.add(condition.variable);
    }
    for (const action of behavior.actions) {
      if (
        action.type === 'setVariable' ||
        action.type === 'changeVariable' ||
        action.type === 'toggleVariable'
      ) {
        names.add(action.variable);
      }
    }
    let index = 1;
    while (names.has(`variable_${index}`)) index += 1;
    return `variable_${index}`;
  };

  function setTarget(value: string) {
    if (value === '_none') {
      behavior.target = undefined;
      return;
    }

    const separator = value.indexOf(':');
    const type = value.slice(0, separator);
    const id = value.slice(separator + 1);
    if ((type !== 'element' && type !== 'group') || !id) return;
    const target: ThemeV2BehaviorTarget = { type, id };
    behavior.target = target;

    const trigger = behavior.trigger;
    if (trigger.type === 'click' || trigger.type === 'hover' || trigger.type === 'leave') {
      if (target.type === 'element') {
        behavior.trigger = { type: trigger.type, elementId: target.id };
        const element = elements.find((candidate) => candidate.id === target.id);
        if (element) element.interactive = true;
      } else {
        behavior.trigger = { type: trigger.type };
      }
    }
  }

  function setTriggerType(type: string) {
    if (type === 'screen') {
      behavior.trigger = { type: 'screen', screen: 'home' };
    } else if (type === 'click' || type === 'hover' || type === 'leave') {
      const targetElementId = behavior.target?.type === 'element' ? behavior.target.id : undefined;
      if (targetElementId) {
        const element = elements.find((candidate) => candidate.id === targetElementId);
        if (element) element.interactive = true;
      }
      behavior.trigger = targetElementId ? { type, elementId: targetElementId } : { type };
    } else if (type === 'timer') {
      behavior.trigger = { type: 'timer', interval: 5 };
    } else {
      behavior.trigger = { type: 'load' };
    }
  }

  function updateTrigger(patch: Partial<ThemeV2BehaviorTrigger>) {
    behavior.trigger = { ...behavior.trigger, ...patch } as ThemeV2BehaviorTrigger;
  }

  function createCondition(type: ThemeV2BehaviorCondition['type']): ThemeV2BehaviorCondition {
    if (type === 'visible') {
      return { type, elementId: elements[0]?.id ?? '', value: true };
    }
    if (type === 'groupVisible') {
      const groupId =
        behavior.target?.type === 'group' ? behavior.target.id : (groups[0]?.id ?? '');
      return { type, groupId, value: true };
    }
    if (type === 'screen') return { type, screen: 'home' };
    if (type === 'chance') return { type, percent: 25 };
    return {
      type,
      variable: nextVariableName(),
      operator: 'equals',
      value: 0,
    };
  }

  function addCondition(type: ThemeV2BehaviorCondition['type']) {
    if (!canAddCondition) return;
    behavior.conditions = [...(behavior.conditions ?? []), createCondition(type)];
  }

  function replaceCondition(index: number, type: ThemeV2BehaviorCondition['type']) {
    const conditions = [...(behavior.conditions ?? [])];
    conditions[index] = createCondition(type);
    behavior.conditions = conditions;
  }

  function removeCondition(index: number) {
    behavior.conditions = (behavior.conditions ?? []).filter((_, current) => current !== index);
  }

  function createAction(type: ThemeV2BehaviorAction['type']): ThemeV2BehaviorAction {
    if (type === 'changeVariable') {
      return { type, variable: nextVariableName(), amount: 1 };
    }
    if (type === 'toggleVariable') return { type, variable: nextVariableName() };
    if (type === 'showElement' || type === 'hideElement' || type === 'toggleElement') {
      return { type, elementId: elements[0]?.id ?? '' };
    }
    if (type === 'showGroup' || type === 'hideGroup' || type === 'toggleGroup') {
      const groupId =
        behavior.target?.type === 'group' ? behavior.target.id : (groups[0]?.id ?? '');
      return { type, groupId };
    }
    if (type === 'navigate') return { type, screen: 'home' };
    if (type === 'launch') return { type };
    if (type === 'openUrl') return { type, url: 'https://' };
    return { type, variable: nextVariableName(), value: 0 };
  }

  function addAction(type: ThemeV2BehaviorAction['type']) {
    if (!canAddAction) return;
    behavior.actions = [...behavior.actions, createAction(type)];
  }

  function replaceAction(index: number, type: ThemeV2BehaviorAction['type']) {
    const actions = [...behavior.actions];
    actions[index] = createAction(type);
    behavior.actions = actions;
  }

  function removeAction(index: number) {
    behavior.actions = behavior.actions.filter((_, current) => current !== index);
  }

  function setElementField(
    target: ThemeV2BehaviorCondition | ThemeV2BehaviorAction,
    elementId: string
  ) {
    if ('elementId' in target) target.elementId = elementId;
  }

  function setGroupField(
    target: ThemeV2BehaviorCondition | ThemeV2BehaviorAction,
    groupId: string
  ) {
    if ('groupId' in target) target.groupId = groupId;
  }
</script>

<div class={embedded ? 'space-y-2.5 p-2' : 'space-y-3 p-2.5'}>
  <div class="flex items-center gap-1.5">
    <Input
      id={`rule-name-${behavior.id}`}
      class="h-7 flex-1 border-theme-800 bg-theme-950 text-[11px] text-theme-50"
      value={behavior.name ?? ''}
      placeholder="Rule name"
      oninput={(event) => (behavior.name = (event.currentTarget as HTMLInputElement).value)}
    />
    <Button
      variant="destructive"
      size="icon"
      class="size-7 shrink-0"
      title="Delete rule"
      onclick={ondelete}
    >
      <Trash2 class="size-3" />
    </Button>
  </div>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    <div class="flex items-center gap-1.5">
      <Checkbox
        id={`rule-enabled-${behavior.id}`}
        checked={behavior.enabled !== false}
        onCheckedChange={(checked) => (behavior.enabled = checked === true)}
      />
      <Label
        for={`rule-enabled-${behavior.id}`}
        class="text-[10px] font-normal text-muted-foreground"
      >
        Enabled
      </Label>
    </div>
    <div class="flex items-center gap-1.5">
      <Checkbox
        id={`rule-once-${behavior.id}`}
        checked={behavior.once === true}
        onCheckedChange={(checked) => (behavior.once = checked === true)}
      />
      <Label for={`rule-once-${behavior.id}`} class="text-[10px] font-normal text-muted-foreground">
        Once per session
      </Label>
    </div>
  </div>

  <div class="flex items-center gap-1.5" title="Controls which layer or group this rule belongs to">
    <Link2 class="size-3 shrink-0 text-primary" />
    <Select.Root
      type="single"
      value={targetValue}
      onValueChange={(value) => setTarget(String(value))}
    >
      <Select.Trigger class="h-7 flex-1 border-theme-800 bg-theme-950 text-[10px] text-theme-100">
        {targetLabel}
      </Select.Trigger>
      <Select.Content class="border-theme-800 bg-theme-950">
        <Select.Item value="_none" label="Not linked (global)" />
        {#each groupOptions as option (option.value)}
          <Select.Item value={`group:${option.value}`} label={`Group · ${option.label}`} />
        {/each}
        {#each elements as element (element.id)}
          <Select.Item
            value={`element:${element.id}`}
            label={`Layer · ${themeElementLabel(element)}`}
          />
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  {#if themeVariables.length > 0}
    <div class="flex flex-wrap items-center gap-1">
      <span class="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
        Variables
      </span>
      {#each themeVariables as variable (variable)}
        <span class="rounded bg-theme-900 px-1 py-0.5 font-mono text-[8px] text-theme-100">
          {variable}
        </span>
      {/each}
    </div>
  {/if}

  <div class="grid grid-cols-3 gap-1 rounded-md border border-theme-800 bg-black/20 p-1">
    <button
      type="button"
      class="{tabClass} {activeSection === 'when'
        ? 'bg-theme-800 text-theme-50'
        : 'text-muted-foreground hover:text-theme-100'}"
      onclick={() => (activeSection = 'when')}
    >
      When
    </button>
    <button
      type="button"
      class="{tabClass} {activeSection === 'if'
        ? 'bg-theme-800 text-theme-50'
        : 'text-muted-foreground hover:text-theme-100'}"
      onclick={() => (activeSection = 'if')}
    >
      If
      {#if conditionCount > 0}
        <span class="rounded-full bg-black/30 px-1 text-[8px]">{conditionCount}</span>
      {/if}
    </button>
    <button
      type="button"
      class="{tabClass} {activeSection === 'then'
        ? 'bg-theme-800 text-theme-50'
        : 'text-muted-foreground hover:text-theme-100'}"
      onclick={() => (activeSection = 'then')}
    >
      Then
      {#if thenCount > 0}
        <span class="rounded-full bg-black/30 px-1 text-[8px]">{thenCount}</span>
      {/if}
    </button>
  </div>

  {#if activeSection === 'when'}
    <section class="space-y-2 rounded-md border border-sky-500/25 bg-sky-500/5 p-2">
      <Select.Root
        type="single"
        value={behavior.trigger.type}
        onValueChange={(value) => setTriggerType(String(value))}
      >
        <Select.Trigger class={field}>
          {triggerOptions.find((option) => option.value === behavior.trigger.type)?.label ??
            'Theme loads'}
        </Select.Trigger>
        <Select.Content class="border-theme-800 bg-theme-950">
          {#each triggerOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>

      {#if behavior.trigger.type === 'screen'}
        <div class="space-y-1">
          <Label class={label}>Screen</Label>
          <Select.Root
            type="single"
            value={behavior.trigger.screen}
            onValueChange={(value) => updateTrigger({ screen: value as ThemeV2ScriptScreen })}
          >
            <Select.Trigger class={field}>
              {screens.find((screen) => screen.value === triggerScreen)?.label ?? 'Home'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each screens as screen (screen.value)}
                <Select.Item value={screen.value} label={screen.label} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {:else if pointerTrigger}
        <div class="space-y-1">
          {#if behavior.target}
            <div
              class="flex items-start gap-2 rounded-md border border-theme-800 bg-theme-950 px-2 py-1.5"
            >
              <Link2 class="mt-0.5 size-3 shrink-0 text-primary" />
              <p class="text-[9px] leading-relaxed text-muted-foreground">
                {#if behavior.target.type === 'group'}
                  Fires for any interactive layer inside
                  <strong class="text-theme-100">{targetName}</strong>.
                {:else}
                  Fires for <strong class="text-theme-100">{targetName}</strong>.
                {/if}
              </p>
            </div>
            {#if targetNeedsInteractive}
              <p
                class="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[9px] leading-relaxed text-amber-100/80"
              >
                {#if behavior.target.type === 'group'}
                  Mark at least one layer inside this group as
                  <strong>Interactive</strong> so this trigger can fire.
                {:else}
                  This linked layer is not <strong>Interactive</strong>, so this trigger cannot
                  fire.
                {/if}
              </p>
            {/if}
          {:else}
            <Label class={label}>Layer</Label>
            <Select.Root
              type="single"
              value={triggerElementId || '_any'}
              onValueChange={(value) =>
                updateTrigger({ elementId: value === '_any' ? undefined : String(value) })}
            >
              <Select.Trigger class={field}>
                {elementOptions.find((option) => option.value === triggerElementId)?.label ??
                  'Any interactive layer'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                <Select.Item value="_any" label="Any interactive layer" />
                {#each elementOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label} />
                {/each}
              </Select.Content>
            </Select.Root>
            <p class="text-[9px] leading-relaxed text-muted-foreground">
              Enable <strong class="text-theme-100">Interactive</strong> in the layer inspector to make
              this layer receive pointer events.
            </p>
          {/if}
        </div>
      {:else if behavior.trigger.type === 'timer'}
        <div class="space-y-1">
          <Label for="rule-interval" class={label}>Every (seconds)</Label>
          <Input
            id="rule-interval"
            class={field}
            type="number"
            min="0.5"
            max="3600"
            step="0.5"
            value={behavior.trigger.interval}
            oninput={(event) =>
              updateTrigger({
                interval: Math.max(
                  0.5,
                  Number((event.currentTarget as HTMLInputElement).value) || 5
                ),
              })}
          />
        </div>
      {:else}
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          Runs once when the theme is applied to the launcher.
        </p>
      {/if}
    </section>
  {:else if activeSection === 'if'}
    <section class="space-y-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">Match</p>
        <Select.Root
          type="single"
          value={behavior.conditionMode ?? 'all'}
          onValueChange={(value) => (behavior.conditionMode = value === 'any' ? 'any' : 'all')}
        >
          <Select.Trigger class="h-6 border-theme-800 bg-theme-950 px-2 text-[9px] text-theme-100">
            {behavior.conditionMode === 'any' ? 'Any' : 'All'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="all" label="All conditions" />
            <Select.Item value="any" label="Any condition" />
          </Select.Content>
        </Select.Root>
      </div>

      {#if (behavior.conditions ?? []).length === 0}
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          No conditions — this rule always runs when the trigger fires.
        </p>
      {:else}
        {#each behavior.conditions ?? [] as condition, index (index)}
          <div class="space-y-2 rounded-md border border-theme-800 bg-theme-950/70 p-2">
            <div class="flex items-center gap-1">
              <Select.Root
                type="single"
                value={condition.type}
                onValueChange={(value) =>
                  replaceCondition(index, String(value) as ThemeV2BehaviorCondition['type'])}
              >
                <Select.Trigger class="h-7 flex-1 border-theme-800 bg-theme-950 text-[10px]">
                  {conditionOptions.find((option) => option.value === condition.type)?.label ??
                    'Condition'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each conditionOptions as option (option.value)}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-destructive"
                title="Remove condition"
                onclick={() => removeCondition(index)}
              >
                <Trash2 class="size-3" />
              </Button>
            </div>

            {#if condition.type === 'variable'}
              <div class="grid grid-cols-[1fr_auto] gap-1.5">
                <Input
                  class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                  value={condition.variable}
                  placeholder="variable"
                  oninput={(event) =>
                    (condition.variable = (event.currentTarget as HTMLInputElement).value)}
                />
                <Select.Root
                  type="single"
                  value={condition.operator}
                  onValueChange={(value) => (condition.operator = value as ThemeV2BehaviorOperator)}
                >
                  <Select.Trigger class="h-7 border-theme-800 bg-theme-950 text-[10px]">
                    {operators.find((operator) => operator.value === condition.operator)?.label ??
                      'equals'}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each operators as operator (operator.value)}
                      <Select.Item value={operator.value} label={operator.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <Input
                class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                value={String(condition.value)}
                placeholder="value"
                oninput={(event) =>
                  (condition.value = parseValue((event.currentTarget as HTMLInputElement).value))}
              />
              <div class="flex flex-wrap items-center gap-1">
                <span
                  class="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground"
                  title="Read-only clock values refresh every second. Use a timer trigger for rules that should re-check them."
                >
                  Clock
                </span>
                {#each clockConditionNames as clock (clock)}
                  <button
                    type="button"
                    class="rounded px-1 py-0.5 font-mono text-[8px] transition-colors {condition.variable ===
                    clock
                      ? 'bg-sky-500/30 text-sky-100'
                      : 'bg-theme-900 text-sky-200 hover:bg-theme-800'}"
                    title="Built-in clock value — read-only and refreshed every second"
                    onclick={() => (condition.variable = clock)}
                  >
                    {clock}
                  </button>
                {/each}
              </div>
            {:else if condition.type === 'visible'}
              <Select.Root
                type="single"
                value={condition.elementId}
                onValueChange={(value) => setElementField(condition, String(value))}
              >
                <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                  {elementOptions.find((option) => option.value === condition.elementId)?.label ??
                    'Choose a layer'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each elementOptions as option (option.value)}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
              <Select.Root
                type="single"
                value={condition.value ? 'visible' : 'hidden'}
                onValueChange={(value) => (condition.value = value === 'visible')}
              >
                <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                  {condition.value ? 'Is visible' : 'Is hidden'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  <Select.Item value="visible" label="Is visible" />
                  <Select.Item value="hidden" label="Is hidden" />
                </Select.Content>
              </Select.Root>
            {:else if condition.type === 'groupVisible'}
              <Select.Root
                type="single"
                value={condition.groupId}
                onValueChange={(value) => setGroupField(condition, String(value))}
              >
                <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                  {groupOptions.find((option) => option.value === condition.groupId)?.label ??
                    'Choose a group'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each groupOptions as option (option.value)}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
              <Select.Root
                type="single"
                value={condition.value ? 'visible' : 'hidden'}
                onValueChange={(value) => (condition.value = value === 'visible')}
              >
                <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                  {condition.value ? 'Is visible' : 'Is hidden'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  <Select.Item value="visible" label="Is visible" />
                  <Select.Item value="hidden" label="Is hidden" />
                </Select.Content>
              </Select.Root>
            {:else if condition.type === 'screen'}
              <Select.Root
                type="single"
                value={condition.screen}
                onValueChange={(value) => (condition.screen = value as ThemeV2ScriptScreen)}
              >
                <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                  {screens.find((screen) => screen.value === condition.screen)?.label ?? 'Home'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each screens as screen (screen.value)}
                    <Select.Item value={screen.value} label={screen.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Chance</span>
                  <span>{Math.round(condition.percent)}%</span>
                </div>
                <Input
                  class="h-7 border-theme-800 bg-theme-950 text-[10px]"
                  type="number"
                  min="0"
                  max="100"
                  value={condition.percent}
                  oninput={(event) =>
                    (condition.percent = Math.min(
                      100,
                      Math.max(0, Number((event.currentTarget as HTMLInputElement).value) || 0)
                    ))}
                />
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="secondary"
              size="sm"
              class="h-7 w-full gap-1 text-[10px]"
              disabled={!canAddCondition}
            >
              <Plus class="size-3" />
              {canAddCondition ? 'Add condition' : 'Condition limit reached'}
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-48 border-theme-700 bg-theme-950">
          {#each availableConditionOptions as option (option.value)}
            <DropdownMenu.Item
              class="gap-2 text-[11px]"
              onclick={() => addCondition(option.value as ThemeV2BehaviorCondition['type'])}
            >
              {option.label}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </section>
  {:else}
    <section class="space-y-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">
          {scriptMode ? 'Script' : 'Actions'}
        </p>
        <div class="flex rounded border border-theme-800 bg-theme-950 p-0.5">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition-colors {!scriptMode
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-muted-foreground hover:text-theme-100'}"
            aria-pressed={!scriptMode}
            onclick={() => setScriptMode(false)}
          >
            Builder
          </button>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition-colors {scriptMode
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-muted-foreground hover:text-theme-100'}"
            aria-pressed={scriptMode}
            onclick={() => setScriptMode(true)}
          >
            Script
          </button>
        </div>
      </div>

      {#if scriptMode}
        <div class="space-y-1.5">
          <ThemeScriptEditor
            value={behavior.script ?? ''}
            {variables}
            {elements}
            {groups}
            onchange={(next) => (behavior.script = next)}
          />
          <div class="flex items-center justify-end gap-2 text-[8px] text-muted-foreground">
            <span>Builder actions are kept but ignored.</span>
          </div>
          {#if scriptError}
            <p
              class="rounded border border-destructive/30 bg-destructive/10 p-1.5 font-mono text-[9px] leading-relaxed text-destructive"
            >
              {formatThemeScriptError(scriptError)}
            </p>
          {:else if !(behavior.script ?? '').trim()}
            <p class="text-[9px] leading-relaxed text-muted-foreground">
              This script is empty, so the rule does nothing.
            </p>
          {:else}
            <p class="text-[9px] leading-relaxed text-muted-foreground">
              Sandboxed JavaScript syntax — no browser APIs or <code>eval</code>. Try
              <code>clicks += 1;</code>,
              <code>if (clicks &gt;= 3) &#123; ... &#125;</code>,
              <code>for (let i = 0; i &lt; 3; i++) &#123; ... &#125;</code>,
              <code>showLayer("id");</code>, <code>goTo("themes");</code>.
            </p>
          {/if}
        </div>
      {:else}
        {#if behavior.actions.length === 0}
          <p class="text-[9px] leading-relaxed text-muted-foreground">
            Add at least one action for this rule to do something.
          </p>
        {:else}
          {#each behavior.actions as action, index (index)}
            <div class="space-y-2 rounded-md border border-theme-800 bg-theme-950/70 p-2">
              <div class="flex items-center gap-1">
                <Select.Root
                  type="single"
                  value={action.type}
                  onValueChange={(value) =>
                    replaceAction(index, String(value) as ThemeV2BehaviorAction['type'])}
                >
                  <Select.Trigger class="h-7 flex-1 border-theme-800 bg-theme-950 text-[10px]">
                    {actionOptions.find((option) => option.value === action.type)?.label ??
                      'Action'}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each actionOptions as option (option.value)}
                      <Select.Item value={option.value} label={option.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-destructive"
                  title="Remove action"
                  onclick={() => removeAction(index)}
                >
                  <Trash2 class="size-3" />
                </Button>
              </div>

              {#if action.type === 'setVariable'}
                <div class="grid grid-cols-2 gap-1.5">
                  <Input
                    class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                    value={action.variable}
                    placeholder="variable"
                    oninput={(event) =>
                      (action.variable = (event.currentTarget as HTMLInputElement).value)}
                  />
                  <Input
                    class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                    value={String(action.value)}
                    placeholder="value"
                    oninput={(event) =>
                      (action.value = parseValue((event.currentTarget as HTMLInputElement).value))}
                  />
                </div>
              {:else if action.type === 'changeVariable'}
                <div class="grid grid-cols-2 gap-1.5">
                  <Input
                    class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                    value={action.variable}
                    placeholder="variable"
                    oninput={(event) =>
                      (action.variable = (event.currentTarget as HTMLInputElement).value)}
                  />
                  <Input
                    class="h-7 border-theme-800 bg-theme-950 text-[10px]"
                    type="number"
                    value={action.amount}
                    oninput={(event) =>
                      (action.amount =
                        Number((event.currentTarget as HTMLInputElement).value) || 0)}
                  />
                </div>
              {:else if action.type === 'toggleVariable'}
                <Input
                  class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                  value={action.variable}
                  placeholder="variable"
                  oninput={(event) =>
                    (action.variable = (event.currentTarget as HTMLInputElement).value)}
                />
              {:else if action.type === 'showElement' || action.type === 'hideElement' || action.type === 'toggleElement'}
                <Select.Root
                  type="single"
                  value={action.elementId}
                  onValueChange={(value) => setElementField(action, String(value))}
                >
                  <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                    {elementOptions.find((option) => option.value === action.elementId)?.label ??
                      'Choose a layer'}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each elementOptions as option (option.value)}
                      <Select.Item value={option.value} label={option.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else if action.type === 'showGroup' || action.type === 'hideGroup' || action.type === 'toggleGroup'}
                <Select.Root
                  type="single"
                  value={action.groupId}
                  onValueChange={(value) => setGroupField(action, String(value))}
                >
                  <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                    {groupOptions.find((option) => option.value === action.groupId)?.label ??
                      'Choose a group'}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each groupOptions as option (option.value)}
                      <Select.Item value={option.value} label={option.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else if action.type === 'navigate'}
                <Select.Root
                  type="single"
                  value={action.screen}
                  onValueChange={(value) => (action.screen = value as ThemeV2ScriptScreen)}
                >
                  <Select.Trigger class="h-7 w-full border-theme-800 bg-theme-950 text-[10px]">
                    {screens.find((screen) => screen.value === action.screen)?.label ?? 'Home'}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each screens as screen (screen.value)}
                      <Select.Item value={screen.value} label={screen.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else if action.type === 'openUrl'}
                <Input
                  class="h-7 border-theme-800 bg-theme-950 font-mono text-[10px]"
                  value={action.url}
                  placeholder="https://example.com"
                  oninput={(event) =>
                    (action.url = (event.currentTarget as HTMLInputElement).value)}
                />
              {:else}
                <p class="text-[9px] leading-relaxed text-muted-foreground">
                  Starts the normal osu! launch flow. Only use this on an explicit click.
                </p>
              {/if}
            </div>
          {/each}
        {/if}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="secondary"
                size="sm"
                class="h-7 w-full gap-1 text-[10px]"
                disabled={!canAddAction}
              >
                <Plus class="size-3" />
                {canAddAction ? 'Add action' : 'Action limit reached'}
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" class="w-48 border-theme-700 bg-theme-950">
            {#each availableActionOptions as option (option.value)}
              <DropdownMenu.Item
                class="gap-2 text-[11px]"
                onclick={() => addAction(option.value as ThemeV2BehaviorAction['type'])}
              >
                {option.label}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {/if}
    </section>
  {/if}

  {#if scriptMode ? scriptCanLeave : behavior.actions.some((action) => action.type === 'launch' || action.type === 'openUrl')}
    <p
      class="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[9px] leading-relaxed text-amber-100/80"
    >
      This rule can leave the launcher. URL actions show the full destination and ask for
      confirmation first; launch actions start the normal osu! flow. Prefer a click trigger and tell
      users what will happen.
    </p>
  {/if}
</div>
