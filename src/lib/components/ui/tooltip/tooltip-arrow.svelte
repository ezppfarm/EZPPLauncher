<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: TooltipPrimitive.ArrowProps = $props();
</script>

<TooltipPrimitive.Arrow
  bind:ref
  data-slot="tooltip-arrow"
  class={cn('text-popover fill-popover', className)}
  {...restProps}
/>
