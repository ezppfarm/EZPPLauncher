<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Slider from '$lib/components/ui/slider/slider.svelte';
  import type { ThemeV2Filters } from '$lib/themeV2';

  let {
    filters,
    onchange,
  }: {
    filters?: ThemeV2Filters;
    onchange: (filters: ThemeV2Filters) => void;
  } = $props();

  type Control = {
    key: keyof ThemeV2Filters;
    label: string;
    min: number;
    max: number;
    step: number;
    fallback: number;
    unit: string;
  };

  const controls: Control[] = [
    { key: 'blur', label: 'Blur', min: 0, max: 40, step: 1, fallback: 0, unit: 'px' },
    { key: 'brightness', label: 'Brightness', min: 0, max: 3, step: 0.05, fallback: 1, unit: '' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 3, step: 0.05, fallback: 1, unit: '' },
    { key: 'saturate', label: 'Saturation', min: 0, max: 4, step: 0.05, fallback: 1, unit: '' },
    {
      key: 'hueRotate',
      label: 'Hue rotate',
      min: -360,
      max: 360,
      step: 1,
      fallback: 0,
      unit: 'deg',
    },
    { key: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.01, fallback: 0, unit: '' },
    { key: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, fallback: 0, unit: '' },
    { key: 'invert', label: 'Invert', min: 0, max: 1, step: 0.01, fallback: 0, unit: '' },
  ];

  const valueOf = (control: Control) => filters?.[control.key] ?? control.fallback;
  const display = (control: Control) => {
    const value = valueOf(control);
    return `${control.step < 1 ? value.toFixed(2).replace(/\.?0+$/, '') : Math.round(value)}${control.unit}`;
  };
  const isDefault = $derived(controls.every((control) => valueOf(control) === control.fallback));

  function setValue(key: keyof ThemeV2Filters, value: number) {
    onchange({ ...(filters ?? {}), [key]: value });
  }
</script>

{#snippet filterActions()}
  <Button
    variant="ghost"
    size="sm"
    class="h-6 px-1.5 text-[10px] text-muted-foreground"
    disabled={isDefault}
    onclick={() => onchange({})}
  >
    Reset
  </Button>
{/snippet}

<ThemeSection
  title="Filters"
  open={false}
  actions={filterActions}
  contentClass="space-y-2.5 pt-2.5"
>
  <div class="space-y-2.5">
    {#each controls as control (control.key)}
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground">{control.label}</span>
          <span class="font-mono text-[9px] text-theme-100">{display(control)}</span>
        </div>
        <Slider
          min={control.min}
          max={control.max}
          step={control.step}
          value={valueOf(control)}
          onValueChange={(value) => setValue(control.key, value)}
        />
      </div>
    {/each}
  </div>
</ThemeSection>
