<script lang="ts">
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import { AlertTriangle, Zap } from '@lucide/svelte';

  let {
    count,
    warning = false,
    onopen,
  }: {
    count: number;
    warning?: boolean;
    onopen: () => void;
  } = $props();

  const title = $derived(
    warning
      ? `${count} linked logic rule${count === 1 ? '' : 's'} · needs an interactive layer · Open in inspector`
      : `${count} linked logic rule${count === 1 ? '' : 's'} · Open in inspector`
  );
</script>

{#if count > 0}
  <button
    type="button"
    class="-m-0.5 shrink-0 cursor-pointer rounded-full p-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    {title}
    aria-label={title}
    onclick={(event) => {
      event.stopPropagation();
      onopen();
    }}
  >
    <Badge
      variant="outline"
      class="pointer-events-none h-4 gap-0.5 border px-1 py-0 text-[8px] font-semibold leading-none {warning
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-primary/25 bg-primary/10 text-primary'}"
    >
      {#if warning}
        <AlertTriangle class="size-2.5" />
      {:else}
        <Zap class="size-2.5" />
      {/if}
      {count}
    </Badge>
  </button>
{/if}
