<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Progress as ProgressPrimitive, type WithoutChildrenOrChild } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    max = 100,
    value,
    indeterminate = false,
    ...restProps
  }: WithoutChildrenOrChild<ProgressPrimitive.RootProps & { indeterminate?: boolean }> = $props();
</script>

<ProgressPrimitive.Root
  bind:ref
  class={cn('bg-secondary relative h-4 w-full overflow-hidden rounded-full', className)}
  value={indeterminate ? max : value}
  {max}
  {...restProps}
>
  <div
    class="bg-primary h-full w-full flex-1 transition-all {indeterminate
      ? 'animate-slide'
      : ''} rounded-lg"
    style={`transform: translateX(-${100 - (100 * ((indeterminate ? max : value) ?? 0)) / (max ?? 1)}%);`}
  ></div>
</ProgressPrimitive.Root>

<style lang="scss">
  .animate-slide {
    animation: 2s infinite forwards indeterminate;
  }
  @keyframes indeterminate {
    0%,
    2%,
    98%,
    100% {
      transform: translateX(-99%);
    }
    49%,
    51% {
      transform: translateX(99%);
    }
  }
</style>
