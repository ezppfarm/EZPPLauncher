<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import type { ThemeV2TextDecoration, ThemeV2TextStyle, ThemeV2TextTransform } from '$lib/themeV2';
  import { Bold, Italic, RotateCcw, Strikethrough, Underline } from '@lucide/svelte';

  let {
    element,
    onchange,
  }: {
    element: ThemeV2TextStyle;
    onchange: (patch: Partial<ThemeV2TextStyle>) => void;
  } = $props();

  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const colorField = 'h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5';

  const bold = $derived((element.fontWeight ?? 600) >= 700);
  const italic = $derived(element.fontStyle === 'italic');
  const underline = $derived((element.textDecoration ?? 'none').includes('underline'));
  const strike = $derived((element.textDecoration ?? 'none').includes('line-through'));
  const gradient = $derived(element.fillMode === 'gradient');

  const transformOptions: { value: ThemeV2TextTransform; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'uppercase', label: 'UPPERCASE' },
    { value: 'lowercase', label: 'lowercase' },
    { value: 'capitalize', label: 'Capitalize' },
  ];

  const inputValue = (event: Event) => (event.currentTarget as HTMLInputElement).value;

  function toggleDecoration(nextUnderline: boolean, nextStrike: boolean) {
    const parts: string[] = [];
    if (nextUnderline) parts.push('underline');
    if (nextStrike) parts.push('line-through');
    onchange({ textDecoration: (parts.join(' ') || 'none') as ThemeV2TextDecoration });
  }

  function setFillMode(value: ThemeV2TextStyle['fillMode']) {
    const fillMode = value === 'gradient' ? 'gradient' : 'solid';
    onchange({
      fillMode,
      ...(fillMode === 'gradient'
        ? {
            gradientFrom: element.gradientFrom ?? '#ff006e',
            gradientTo: element.gradientTo ?? '#7c3aed',
          }
        : {}),
    });
  }

  function resetTextStyle() {
    onchange({
      fontWeight: 600,
      fontStyle: 'normal',
      textDecoration: 'none',
      textTransform: 'none',
      fillMode: 'solid',
      gradientFrom: '#ff006e',
      gradientTo: '#7c3aed',
      gradientAngle: 90,
      outlineWidth: 0,
      outlineColor: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowColor: '#000000',
    });
  }
</script>

{#snippet textStyleActions()}
  <Button
    variant="ghost"
    size="sm"
    class="h-6 gap-1 px-1.5 text-[9px] text-muted-foreground"
    title="Reset bold, italic, decoration, case, fill, outline and shadow"
    onclick={resetTextStyle}
  >
    <RotateCcw class="size-3" />
    Reset
  </Button>
{/snippet}

<ThemeSection
  title="Text style"
  open={false}
  actions={textStyleActions}
  contentClass="space-y-2 pt-2.5"
>
  <div class="grid grid-cols-4 gap-1">
    <Button
      variant={bold ? 'default' : 'secondary'}
      size="icon"
      class="size-8 w-full"
      title="Bold"
      aria-label="Bold"
      aria-pressed={bold}
      onclick={() => onchange({ fontWeight: bold ? 400 : 700 })}
    >
      <Bold class="size-3.5" />
    </Button>
    <Button
      variant={italic ? 'default' : 'secondary'}
      size="icon"
      class="size-8 w-full"
      title="Italic"
      aria-label="Italic"
      aria-pressed={italic}
      onclick={() => onchange({ fontStyle: italic ? 'normal' : 'italic' })}
    >
      <Italic class="size-3.5" />
    </Button>
    <Button
      variant={underline ? 'default' : 'secondary'}
      size="icon"
      class="size-8 w-full"
      title="Underline"
      aria-label="Underline"
      aria-pressed={underline}
      onclick={() => toggleDecoration(!underline, strike)}
    >
      <Underline class="size-3.5" />
    </Button>
    <Button
      variant={strike ? 'default' : 'secondary'}
      size="icon"
      class="size-8 w-full"
      title="Strikethrough"
      aria-label="Strikethrough"
      aria-pressed={strike}
      onclick={() => toggleDecoration(underline, !strike)}
    >
      <Strikethrough class="size-3.5" />
    </Button>
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <Label for="element-text-transform" class={label}>Case</Label>
      <Select.Root
        type="single"
        value={element.textTransform ?? 'none'}
        onValueChange={(value) => {
          if (value) onchange({ textTransform: value as ThemeV2TextTransform });
        }}
      >
        <Select.Trigger
          id="element-text-transform"
          class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
        >
          {transformOptions.find((option) => option.value === (element.textTransform ?? 'none'))
            ?.label ?? 'None'}
        </Select.Trigger>
        <Select.Content class="border-theme-800 bg-theme-950">
          {#each transformOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <div class="space-y-1">
      <Label for="element-fill-mode" class={label}>Fill</Label>
      <Select.Root
        type="single"
        value={element.fillMode ?? 'solid'}
        onValueChange={(value) => setFillMode(value as ThemeV2TextStyle['fillMode'])}
      >
        <Select.Trigger
          id="element-fill-mode"
          class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
        >
          {element.fillMode === 'gradient' ? 'Gradient' : 'Solid'}
        </Select.Trigger>
        <Select.Content class="border-theme-800 bg-theme-950">
          <Select.Item value="solid" label="Solid" />
          <Select.Item value="gradient" label="Gradient" />
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  {#if gradient}
    <div class="space-y-2">
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <Label class={label}>Gradient from</Label>
          <span class="font-mono text-[9px] text-theme-100"
            >{element.gradientFrom ?? '#ff006e'}</span
          >
        </div>
        <div class="flex items-center gap-2">
          <Input
            class={colorField}
            type="color"
            value={element.gradientFrom ?? '#ff006e'}
            oninput={(event) => onchange({ gradientFrom: inputValue(event) })}
          />
          <Input
            class="{field} flex-1 font-mono"
            value={element.gradientFrom ?? '#ff006e'}
            oninput={(event) => onchange({ gradientFrom: inputValue(event) })}
          />
        </div>
      </div>
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <Label class={label}>Gradient to</Label>
          <span class="font-mono text-[9px] text-theme-100">{element.gradientTo ?? '#7c3aed'}</span>
        </div>
        <div class="flex items-center gap-2">
          <Input
            class={colorField}
            type="color"
            value={element.gradientTo ?? '#7c3aed'}
            oninput={(event) => onchange({ gradientTo: inputValue(event) })}
          />
          <Input
            class="{field} flex-1 font-mono"
            value={element.gradientTo ?? '#7c3aed'}
            oninput={(event) => onchange({ gradientTo: inputValue(event) })}
          />
        </div>
      </div>
      <div class="space-y-1">
        <Label for="element-gradient-angle" class={label}>Gradient angle</Label>
        <Input
          id="element-gradient-angle"
          class={field}
          type="number"
          min="0"
          max="360"
          step="1"
          value={element.gradientAngle ?? 90}
          onchange={(event) =>
            onchange({
              gradientAngle: Math.min(360, Math.max(0, Number(inputValue(event)) || 0)),
            })}
        />
      </div>
    </div>
  {:else}
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <Label class={label}>Color</Label>
        <span class="font-mono text-[9px] text-theme-100">{element.color ?? '#ffffff'}</span>
      </div>
      <div class="flex items-center gap-2">
        <Input
          class={colorField}
          type="color"
          value={element.color ?? '#ffffff'}
          oninput={(event) => onchange({ color: inputValue(event) })}
        />
        <Input
          class="{field} flex-1 font-mono"
          value={element.color ?? '#ffffff'}
          oninput={(event) => onchange({ color: inputValue(event) })}
        />
      </div>
    </div>
  {/if}

  <div class="space-y-1">
    <Label class={label}>Outline</Label>
    <div class="grid grid-cols-[72px_40px_1fr] gap-2">
      <Input
        class={field}
        type="number"
        min="0"
        max="20"
        step="1"
        aria-label="Outline width"
        title="Outline width in pixels; 0 disables it"
        value={element.outlineWidth ?? 0}
        onchange={(event) =>
          onchange({ outlineWidth: Math.min(20, Math.max(0, Number(inputValue(event)) || 0)) })}
      />
      <Input
        class={colorField}
        type="color"
        aria-label="Outline color"
        value={element.outlineColor ?? '#000000'}
        oninput={(event) => onchange({ outlineColor: inputValue(event) })}
      />
      <Input
        class="{field} min-w-0 font-mono"
        aria-label="Outline color hex"
        value={element.outlineColor ?? '#000000'}
        oninput={(event) => onchange({ outlineColor: inputValue(event) })}
      />
    </div>
  </div>

  <div class="space-y-1">
    <Label class={label}>Shadow</Label>
    <div class="grid grid-cols-3 gap-2">
      <Input
        class={field}
        type="number"
        min="0"
        max="40"
        step="1"
        aria-label="Shadow blur"
        title="Shadow blur"
        value={element.shadowBlur ?? 0}
        onchange={(event) =>
          onchange({ shadowBlur: Math.min(40, Math.max(0, Number(inputValue(event)) || 0)) })}
      />
      <Input
        class={field}
        type="number"
        min="-40"
        max="40"
        step="1"
        aria-label="Shadow offset X"
        title="Shadow offset X"
        value={element.shadowOffsetX ?? 0}
        onchange={(event) =>
          onchange({
            shadowOffsetX: Math.min(40, Math.max(-40, Number(inputValue(event)) || 0)),
          })}
      />
      <Input
        class={field}
        type="number"
        min="-40"
        max="40"
        step="1"
        aria-label="Shadow offset Y"
        title="Shadow offset Y"
        value={element.shadowOffsetY ?? 0}
        onchange={(event) =>
          onchange({
            shadowOffsetY: Math.min(40, Math.max(-40, Number(inputValue(event)) || 0)),
          })}
      />
    </div>
    <div class="flex items-center gap-2">
      <Input
        class={colorField}
        type="color"
        aria-label="Shadow color"
        value={element.shadowColor ?? '#000000'}
        oninput={(event) => onchange({ shadowColor: inputValue(event) })}
      />
      <Input
        class="{field} flex-1 font-mono"
        aria-label="Shadow color hex"
        value={element.shadowColor ?? '#000000'}
        oninput={(event) => onchange({ shadowColor: inputValue(event) })}
      />
    </div>
  </div>
</ThemeSection>
