<script lang="ts">
  import ThemeCssClasses from '$lib/components/theme/ThemeCssClasses.svelte';
  import ThemeFilterControls from '$lib/components/theme/ThemeFilterControls.svelte';
  import ThemeLinkedLogic from '$lib/components/theme/ThemeLinkedLogic.svelte';
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import ThemeTransformControls from '$lib/components/theme/ThemeTransformControls.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import Slider from '$lib/components/ui/slider/slider.svelte';
  import {
    type ThemeV2Behavior,
    type ThemeV2BehaviorTarget,
    type ThemeV2Element,
    type ThemeV2Group,
    type ThemeV2MaskShape,
  } from '$lib/themeV2';
  import { Boxes, RefreshCw, Ungroup } from '@lucide/svelte';

  let {
    group = $bindable(),
    behaviors,
    elements,
    groups,
    variables = [],
    focusToken = 0,
    onungroup,
    onpickmask,
    onaddbehavior,
    ondeleterule,
  }: {
    group: ThemeV2Group;
    behaviors: ThemeV2Behavior[];
    elements: ThemeV2Element[];
    groups: ThemeV2Group[];
    variables?: string[];
    focusToken?: number;
    onungroup: () => void;
    onpickmask: () => void;
    onaddbehavior: (target: ThemeV2BehaviorTarget) => ThemeV2Behavior | undefined;
    ondeleterule: (id: string) => void;
  } = $props();

  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
</script>

<div class="space-y-3 p-3">
  <div class="flex items-center gap-2 border-b border-theme-800 pb-2.5">
    <div class="flex size-8 items-center justify-center rounded-md bg-primary/20 text-primary">
      <Boxes class="size-4" />
    </div>
    <div class="min-w-0">
      <p class="truncate text-xs font-semibold text-theme-50">Group</p>
      <p class="truncate font-mono text-[10px] text-muted-foreground">{group.id}</p>
    </div>
  </div>

  <ThemeSection title="Group" bordered={false} contentClass="space-y-3 pt-2">
    <div class="space-y-1">
      <Label for="group-name" class={label}>Group name</Label>
      <Input
        id="group-name"
        class={field}
        value={group.name ?? ''}
        placeholder="Group name"
        oninput={(event) => (group.name = (event.currentTarget as HTMLInputElement).value)}
      />
    </div>

    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <Label class={label}>Opacity</Label>
        <span class="text-[10px] text-muted-foreground"
          >{Math.round((group.opacity ?? 1) * 100)}%</span
        >
      </div>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={group.opacity ?? 1}
        onValueChange={(value) => (group.opacity = value)}
      />
    </div>
  </ThemeSection>

  <ThemeTransformControls
    transform={group}
    idPrefix="group"
    includeTranslate
    onchange={(patch) => Object.assign(group, patch)}
  />

  <ThemeSection
    title="Group state"
    contentClass="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5"
  >
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="group-hidden"
        checked={group.hidden === true}
        onCheckedChange={(checked) => (group.hidden = checked === true)}
      />
      <Label for="group-hidden" class="text-[10px] font-normal text-muted-foreground">Hidden</Label>
    </div>
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="group-locked"
        checked={group.locked === true}
        onCheckedChange={(checked) => (group.locked = checked === true)}
      />
      <Label for="group-locked" class="text-[10px] font-normal text-muted-foreground">Locked</Label>
    </div>
    <div
      class="flex items-center gap-1.5"
      title="Smoothly morph text and number changes across layers in this group using Torph."
    >
      <Checkbox
        id="group-morph"
        checked={group.morph === true}
        onCheckedChange={(checked) => (group.morph = checked === true)}
      />
      <Label for="group-morph" class="text-[10px] font-normal text-muted-foreground">
        Morph text (Torph)
      </Label>
    </div>
    {#if group.morph}
      <div class="w-full space-y-1 pt-1">
        <div class="flex items-center justify-between">
          <Label for="group-morph-duration" class={label}>Morph duration</Label>
          <span class="text-[10px] text-muted-foreground">{group.morphDuration ?? 400}ms</span>
        </div>
        <Input
          id="group-morph-duration"
          class={field}
          type="number"
          min="50"
          max="3000"
          step="50"
          value={group.morphDuration ?? 400}
          oninput={(event) => {
            const val = Number((event.currentTarget as HTMLInputElement).value);
            group.morphDuration = Number.isFinite(val) && val > 0 ? val : 400;
          }}
        />
      </div>
    {/if}
  </ThemeSection>

  <ThemeCssClasses
    idPrefix="group"
    value={group.cssClasses}
    onchange={(value) => (group.cssClasses = value)}
  />

  <ThemeLinkedLogic
    target={{ type: 'group', id: group.id }}
    {behaviors}
    {elements}
    {groups}
    {variables}
    {focusToken}
    onadd={onaddbehavior}
    ondelete={ondeleterule}
  />

  <ThemeSection title="Mask" contentClass="space-y-3 pt-2.5">
    <div class="space-y-1">
      <Label for="group-mask-shape" class={label}>Clip shape</Label>
      <Select.Root
        type="single"
        value={group.mask?.shape ?? 'none'}
        onValueChange={(value) => {
          if (!value) return;
          if (value === 'none') {
            group.mask = undefined;
            return;
          }
          group.mask = {
            shape: value as ThemeV2MaskShape,
            radius: group.mask?.radius ?? 24,
            sides: group.mask?.sides ?? 6,
            innerRadius: group.mask?.innerRadius ?? 0.5,
            src: group.mask?.src,
            fit: group.mask?.fit ?? 'cover',
          };
        }}
      >
        <Select.Trigger
          id="group-mask-shape"
          class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
        >
          {group.mask?.shape ?? 'None'}
        </Select.Trigger>
        <Select.Content class="border-theme-800 bg-theme-950">
          <Select.Item value="none" label="None" />
          <Select.Item value="rectangle" label="Rectangle" />
          <Select.Item value="ellipse" label="Ellipse" />
          <Select.Item value="polygon" label="Polygon" />
          <Select.Item value="star" label="Star" />
          <Select.Item value="image" label="Image alpha" />
        </Select.Content>
      </Select.Root>
    </div>
    {#if group.mask?.shape === 'polygon' || group.mask?.shape === 'star'}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="group-mask-sides" class={label}>Points</Label>
          <Input
            id="group-mask-sides"
            class={field}
            type="number"
            min="3"
            max="24"
            value={group.mask.sides ?? 6}
            oninput={(event) => {
              if (group.mask) {
                group.mask.sides = Number((event.currentTarget as HTMLInputElement).value) || 3;
              }
            }}
          />
        </div>
        {#if group.mask.shape === 'star'}
          <div class="space-y-1">
            <Label for="group-mask-inner" class={label}>Inner radius</Label>
            <Input
              id="group-mask-inner"
              class={field}
              type="number"
              min="0.1"
              max="0.95"
              step="0.05"
              value={group.mask.innerRadius ?? 0.5}
              oninput={(event) => {
                if (group.mask) {
                  group.mask.innerRadius =
                    Number((event.currentTarget as HTMLInputElement).value) || 0.5;
                }
              }}
            />
          </div>
        {/if}
      </div>
    {/if}
    {#if group.mask?.shape === 'image'}
      <div class="space-y-2 rounded-md border border-theme-800 bg-black/20 p-2">
        <p class="truncate font-mono text-[10px] text-theme-100">
          {group.mask.src ?? 'No mask image yet'}
        </p>
        <Button variant="secondary" class="h-8 w-full gap-2 text-xs" onclick={onpickmask}>
          <RefreshCw class="size-3.5" />
          Choose mask image
        </Button>
      </div>
    {/if}
    <p class="text-[9px] leading-relaxed text-muted-foreground">
      The mask clips every layer in this group. Image masks use the picture's alpha channel.
    </p>
  </ThemeSection>

  <ThemeFilterControls filters={group.filters} onchange={(filters) => (group.filters = filters)} />

  <Button variant="secondary" class="h-8 w-full gap-2 text-xs" onclick={onungroup}>
    <Ungroup class="size-3.5" />
    Ungroup group
  </Button>
</div>
