<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Slider as SliderPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    class: className,
    onValueChange,
    onValueCommit,
  }: {
    ref?: HTMLSpanElement | null;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    class?: string;
    onValueChange?: (value: number) => void;
    onValueCommit?: (value: number) => void;
  } = $props();
</script>

<SliderPrimitive.Root
  bind:ref
  type="single"
  bind:value
  {min}
  {max}
  {step}
  {disabled}
  {onValueChange}
  {onValueCommit}
  class={cn(
    'bg-primary/20 relative flex h-1.5 w-full touch-none select-none items-center rounded-full',
    className
  )}
>
  <SliderPrimitive.Range class="bg-primary absolute h-full rounded-full" />
  <SliderPrimitive.Thumb
    index={0}
    class="border-primary bg-background ring-offset-background focus-visible:ring-ring block size-4 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
  />
</SliderPrimitive.Root>
