<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { Snippet } from 'svelte';

  let {
    content,
    trigger,
    side = 'top',
  }: {
    content: string;
    trigger: Snippet<[Record<string, unknown>]>;
    side?: 'top' | 'right' | 'bottom' | 'left';
  } = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {@render trigger(props)}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content
    {side}
    sideOffset={6}
    class="max-w-72 border-theme-700 bg-theme-950 px-2.5 py-1.5 text-[10px] leading-relaxed text-white shadow-xl"
  >
    {content}
  </Tooltip.Content>
</Tooltip.Root>
