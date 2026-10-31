<script lang="ts">
  import ThemeBehaviorInspector from '$lib/components/theme/ThemeBehaviorInspector.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { themeBehaviorSummary, themeGroupInteractiveCount } from '$lib/themeLogic';
  import type {
    ThemeV2Behavior,
    ThemeV2BehaviorTarget,
    ThemeV2Element,
    ThemeV2Group,
  } from '$lib/themeV2';
  import { AlertTriangle, ChevronDown, Plus, Zap } from '@lucide/svelte';

  let {
    target,
    behaviors,
    elements,
    groups,
    variables = [],
    focusToken = 0,
    onadd,
    ondelete,
  }: {
    target: ThemeV2BehaviorTarget;
    behaviors: ThemeV2Behavior[];
    elements: ThemeV2Element[];
    groups: ThemeV2Group[];
    variables?: string[];
    focusToken?: number;
    onadd: (target: ThemeV2BehaviorTarget) => ThemeV2Behavior | undefined;
    ondelete: (id: string) => void;
  } = $props();

  let open = $state(false);
  let selectedId = $state<string | undefined>(undefined);
  let section = $state<HTMLElement>();
  let lastFocusToken = 0;

  const linkedBehaviors = $derived(
    behaviors.filter(
      (behavior) => behavior.target?.type === target.type && behavior.target?.id === target.id
    )
  );
  const pointerRuleCount = $derived(
    linkedBehaviors.filter(
      (behavior) =>
        behavior.trigger.type === 'click' ||
        behavior.trigger.type === 'hover' ||
        behavior.trigger.type === 'leave'
    ).length
  );
  const interactiveTargets = $derived(
    target.type === 'group'
      ? themeGroupInteractiveCount(groups, elements, target.id)
      : elements.find((element) => element.id === target.id)?.interactive
        ? 1
        : 0
  );
  const needsInteractive = $derived(pointerRuleCount > 0 && interactiveTargets === 0);

  $effect(() => {
    if (!focusToken || focusToken === lastFocusToken) return;
    lastFocusToken = focusToken;
    open = true;
    if (linkedBehaviors.length === 1) selectedId = linkedBehaviors[0].id;
    requestAnimationFrame(() => section?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });

  function addRule() {
    const behavior = onadd(target);
    open = true;
    if (behavior) selectedId = behavior.id;
  }

  function deleteRule(id: string) {
    ondelete(id);
    if (selectedId === id) selectedId = undefined;
  }
</script>

<section bind:this={section} class="border-t border-theme-800 pt-2">
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      class="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-theme-900/60"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <Zap class="size-3.5 shrink-0 text-primary" />
      <span class="text-[11px] font-semibold text-theme-100">Logic</span>
      {#if linkedBehaviors.length > 0}
        <span class="rounded-full bg-theme-900 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          {linkedBehaviors.length}
        </span>
      {/if}
      {#if needsInteractive}
        <span title="A linked pointer rule needs an interactive layer">
          <AlertTriangle class="size-3 text-amber-300" />
        </span>
      {/if}
      <ChevronDown
        class="ml-auto size-3 shrink-0 text-muted-foreground transition-transform {open
          ? 'rotate-180'
          : ''}"
      />
    </button>
    <Button
      variant="secondary"
      size="sm"
      class="h-6 shrink-0 gap-1 px-1.5 text-[9px]"
      title="Add a rule linked to this layer or group"
      onclick={addRule}
    >
      <Plus class="size-3" />
      Add
    </Button>
  </div>

  {#if open}
    <div class="mt-1.5 space-y-1.5">
      {#if linkedBehaviors.length === 0}
        <p
          class="rounded-md border border-dashed border-theme-800 px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground"
        >
          No rules linked yet. Add one to react to clicks, hovers, timers or screen changes.
        </p>
      {:else}
        {#each linkedBehaviors as behavior (behavior.id)}
          <div class="overflow-hidden rounded-md border border-theme-800 bg-black/20">
            <button
              type="button"
              class="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-theme-900/60"
              aria-expanded={selectedId === behavior.id}
              onclick={() => (selectedId = selectedId === behavior.id ? undefined : behavior.id)}
            >
              <span
                class="size-1.5 shrink-0 rounded-full {behavior.enabled === false
                  ? 'bg-theme-600'
                  : 'bg-emerald-400'}"
              ></span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-[10px] font-medium text-theme-100">
                    {behavior.name?.trim() || 'Rule'}
                  </span>
                  {#if behavior.once}
                    <span class="rounded bg-theme-900 px-1 py-0.5 text-[8px] text-muted-foreground">
                      once
                    </span>
                  {/if}
                </span>
                <span class="mt-0.5 block truncate text-[9px] text-muted-foreground">
                  {themeBehaviorSummary(behavior, elements, groups)}
                </span>
              </span>
              <ChevronDown
                class="size-3 shrink-0 text-muted-foreground transition-transform {selectedId ===
                behavior.id
                  ? 'rotate-180'
                  : ''}"
              />
            </button>

            {#if selectedId === behavior.id}
              <div class="border-t border-theme-800 bg-theme-950/60">
                <ThemeBehaviorInspector
                  {behavior}
                  {elements}
                  {groups}
                  {variables}
                  embedded
                  ondelete={() => deleteRule(behavior.id)}
                />
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      {#if needsInteractive}
        <div
          class="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/5 p-1.5"
        >
          <AlertTriangle class="mt-0.5 size-3 shrink-0 text-amber-300" />
          <p class="text-[9px] leading-relaxed text-amber-100/80">
            {#if target.type === 'group'}
              Mark at least one layer in this group as <strong>Interactive</strong>.
            {:else}
              Enable <strong>Interactive</strong> for this layer.
            {/if}
          </p>
        </div>
      {/if}
    </div>
  {/if}
</section>
