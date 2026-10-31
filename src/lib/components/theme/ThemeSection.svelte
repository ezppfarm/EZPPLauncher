<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import type { Component, Snippet } from 'svelte';

  let {
    title,
    open = $bindable(true),
    icon: Icon,
    badge,
    description,
    actions,
    children,
    class: className = '',
    contentClass = 'space-y-3 pt-2.5',
    headingClass = 'text-xs font-semibold text-theme-100',
    bordered = true,
  }: {
    title: string;
    open?: boolean;
    icon?: Component<{ class?: string }>;
    badge?: string | number;
    description?: string;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
    contentClass?: string;
    headingClass?: string;
    bordered?: boolean;
  } = $props();
</script>

<section class="{bordered ? 'border-t border-theme-800 pt-3 ' : ''}{className}">
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      class="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-0.5 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      {#if Icon}
        <Icon class="size-3.5 shrink-0 text-primary" />
      {/if}
      <span class="truncate {headingClass}">{title}</span>
      {#if badge !== undefined && badge !== ''}
        <span
          class="shrink-0 rounded-full bg-theme-900 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground"
        >
          {badge}
        </span>
      {/if}
      <ChevronDown
        class="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 {open
          ? 'rotate-180'
          : ''}"
      />
    </button>
    {#if actions}
      <div class="flex shrink-0 items-center gap-1">
        {@render actions()}
      </div>
    {/if}
  </div>

  {#if open}
    <div class={contentClass}>
      {#if description}
        <p class="text-[10px] leading-relaxed text-muted-foreground">{description}</p>
      {/if}
      {@render children?.()}
    </div>
  {/if}
</section>
