<script lang="ts">
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import {
    getFullIconCatalog,
    type IconPackKey,
    type ThemeIconCatalogItem,
  } from '$lib/themeIconCatalog';
  import { DEFAULT_THEME_ICON_SET, type ThemeIconSet } from '$lib/themeIcons';
  import ThemeIcon from './ThemeIcon.svelte';
  import { Check, ChevronDown, ChevronsUpDown, LayoutGrid, List, Search, X } from '@lucide/svelte';

  let {
    value = $bindable(undefined),
    iconSet = DEFAULT_THEME_ICON_SET,
    placeholder = 'Select icon...',
    disabled = false,
    allowNone = false,
    onchange,
  }: {
    value?: string;
    iconSet?: ThemeIconSet;
    placeholder?: string;
    disabled?: boolean;
    allowNone?: boolean;
    onchange?: (val: string | undefined) => void;
  } = $props();

  let open = $state(false);
  let searchQuery = $state('');
  let selectedPack = $state<IconPackKey | 'all'>('all');
  let viewMode = $state<'grid' | 'list'>('grid');
  let scrollContainer = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);

  const containerHeight = 280;
  const gridColumns = 5;
  const gridRowHeight = 54;
  const listRowHeight = 34;
  const overscan = 4;

  const rowHeight = $derived(viewMode === 'grid' ? gridRowHeight : listRowHeight);

  const catalog = getFullIconCatalog();

  const packTabs: { key: IconPackKey | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: catalog.length },
    { key: 'launcher', label: 'Launcher', count: 47 },
    { key: 'lucide', label: 'Lucide', count: 2078 },
    { key: 'phosphor', label: 'Phosphor', count: 9161 },
    { key: 'tabler', label: 'Tabler', count: 6305 },
  ];

  const filteredItems = $derived.by(() => {
    let items = catalog;
    if (selectedPack !== 'all') {
      items = items.filter((it) => it.pack === selectedPack);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (it) => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)
      );
    }
    return items;
  });

  const numRows = $derived(
    viewMode === 'grid' ? Math.ceil(filteredItems.length / gridColumns) : filteredItems.length
  );

  const totalHeight = $derived(numRows * rowHeight);

  const startIndex = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
  const endIndex = $derived(
    Math.min(numRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan)
  );

  type VirtualRow = {
    index: number;
    items?: ThemeIconCatalogItem[];
    item?: ThemeIconCatalogItem;
  };

  const visibleRows = $derived.by(() => {
    const rows: VirtualRow[] = [];
    if (viewMode === 'grid') {
      for (let i = startIndex; i < endIndex; i++) {
        const rowItems = filteredItems.slice(i * gridColumns, (i + 1) * gridColumns);
        rows.push({ index: i, items: rowItems });
      }
    } else {
      for (let i = startIndex; i < endIndex; i++) {
        const item = filteredItems[i];
        if (item) {
          rows.push({ index: i, item });
        }
      }
    }
    return rows;
  });

  $effect(() => {
    // When search, pack, or view mode changes, reset scroll to top
    void searchQuery;
    void selectedPack;
    void viewMode;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      scrollTop = 0;
    }
  });

  function selectIcon(id: string | undefined) {
    if (id === 'none' || !id) {
      value = undefined;
      onchange?.(undefined);
    } else {
      value = id;
      onchange?.(id);
    }
    open = false;
  }

  function displayName(val: string | undefined): string {
    if (!val || val === 'none') return 'None';
    if (val.includes(':')) {
      return val.slice(val.indexOf(':') + 1);
    }
    return val;
  }

  function displayPack(val: string | undefined): string | null {
    if (!val || val === 'none') return null;
    if (val.startsWith('lucide:')) return 'Lucide';
    if (val.startsWith('ph:')) return 'Phosphor';
    if (val.startsWith('tabler:')) return 'Tabler';
    return 'Launcher';
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    {disabled}
    class="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-theme-800 bg-theme-950 px-2.5 text-xs text-theme-50 transition-colors hover:bg-theme-900/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
  >
    {#if !value || value === 'none'}
      <span class="flex items-center gap-2 text-muted-foreground truncate">
        <span
          class="flex size-4 items-center justify-center rounded border border-dashed border-theme-700 text-[10px]"
          >✕</span
        >
        <span>{allowNone ? 'None' : placeholder}</span>
      </span>
    {:else}
      <span class="flex items-center gap-2 min-w-0 truncate">
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded bg-theme-900 border border-theme-800 text-theme-200"
        >
          <ThemeIcon name={value} set={iconSet} size={15} />
        </span>
        <span class="truncate font-mono text-xs text-theme-100">{displayName(value)}</span>
        {#if displayPack(value)}
          <span
            class="rounded bg-theme-800/80 px-1 py-0.5 text-[8px] uppercase tracking-wide text-muted-foreground shrink-0"
          >
            {displayPack(value)}
          </span>
        {/if}
      </span>
    {/if}
    <ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground opacity-60" />
  </Popover.Trigger>

  <Popover.Content
    align="start"
    side="bottom"
    sideOffset={4}
    class="w-[360px] max-w-[95vw] rounded-lg border border-theme-800 bg-theme-950 p-0 text-theme-50 shadow-2xl"
  >
    <!-- Search Bar -->
    <div class="border-b border-theme-800/80 p-2">
      <div class="relative flex items-center">
        <Search class="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          bind:value={searchQuery}
          placeholder="Search 17,000+ icons..."
          class="h-8 pl-8 pr-7 text-xs border-theme-800 bg-theme-900/60 placeholder:text-muted-foreground"
          autofocus
        />
        {#if searchQuery}
          <button
            type="button"
            class="absolute right-2 text-muted-foreground hover:text-theme-100 transition-colors"
            onclick={() => (searchQuery = '')}
          >
            <X class="size-3.5" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Pack Filter Tabs & View Toggle -->
    <div
      class="flex items-center justify-between gap-1 border-b border-theme-800/60 bg-theme-900/30 px-2 py-1.5"
    >
      <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {#each packTabs as tab (tab.key)}
          <button
            type="button"
            class="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors {selectedPack ===
            tab.key
              ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
              : 'text-muted-foreground hover:bg-theme-800/60 hover:text-theme-200 border border-transparent'}"
            onclick={() => (selectedPack = tab.key)}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-0.5 shrink-0 pl-1 border-l border-theme-800/60">
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:text-theme-100 transition-colors {viewMode ===
          'grid'
            ? 'bg-theme-800 text-theme-100'
            : ''}"
          title="Grid view"
          onclick={() => (viewMode = 'grid')}
        >
          <LayoutGrid class="size-3.5" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:text-theme-100 transition-colors {viewMode ===
          'list'
            ? 'bg-theme-800 text-theme-100'
            : ''}"
          title="List view"
          onclick={() => (viewMode = 'list')}
        >
          <List class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- Allow "None" option if requested -->
    {#if allowNone}
      <div class="border-b border-theme-800/50 px-2 py-1 bg-theme-900/20">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors {value ===
            'none' || !value
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-muted-foreground hover:bg-theme-800/60 hover:text-theme-100'}"
          onclick={() => selectIcon('none')}
        >
          <span class="flex items-center gap-2">
            <span
              class="flex size-4 items-center justify-center rounded border border-dashed border-theme-700 text-[10px]"
              >✕</span
            >
            <span>None (No icon)</span>
          </span>
          {#if value === 'none' || !value}
            <Check class="size-3 text-primary" />
          {/if}
        </button>
      </div>
    {/if}

    <!-- Virtual Scrolling List/Grid -->
    <div
      bind:this={scrollContainer}
      class="overflow-y-auto px-2 py-1 select-none"
      style="height: {containerHeight}px;"
      onscroll={(e) => {
        scrollTop = (e.currentTarget as HTMLElement).scrollTop;
      }}
    >
      {#if filteredItems.length === 0}
        <div
          class="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground"
        >
          <p>No icons found</p>
          {#if searchQuery}
            <p class="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">"{searchQuery}"</p>
          {/if}
          <Button
            variant="ghost"
            size="sm"
            class="mt-3 h-7 text-[10px]"
            onclick={() => {
              searchQuery = '';
              selectedPack = 'all';
            }}
          >
            Clear filters
          </Button>
        </div>
      {:else}
        <div style="height: {totalHeight}px; position: relative;">
          <div
            style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({startIndex *
              rowHeight}px);"
          >
            {#if viewMode === 'grid'}
              {#each visibleRows as row (row.index)}
                <div class="grid grid-cols-5 gap-1.5" style="height: {rowHeight}px;">
                  {#each row.items ?? [] as item (item.id)}
                    {@const isSelected =
                      item.id === value || (item.pack === 'launcher' && item.name === value)}
                    <button
                      type="button"
                      class="group relative flex flex-col items-center justify-center rounded-md p-1 border transition-all text-center
                        {isSelected
                        ? 'bg-primary/20 border-primary text-primary shadow-xs'
                        : 'border-transparent bg-theme-900/40 hover:bg-theme-800/80 hover:border-theme-700 text-theme-200 hover:text-theme-50'}"
                      title="{item.name} ({item.packLabel})"
                      onclick={() => selectIcon(item.id)}
                    >
                      <div class="flex size-5 items-center justify-center shrink-0">
                        <ThemeIcon name={item.id} set={iconSet} size={18} />
                      </div>
                      <span
                        class="mt-0.5 w-full truncate text-[9px] font-mono leading-tight opacity-75 group-hover:opacity-100"
                      >
                        {item.name}
                      </span>
                      {#if isSelected}
                        <div
                          class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
                        ></div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/each}
            {:else}
              {#each visibleRows as row (row.index)}
                {#if row.item}
                  {@const item = row.item}
                  {@const isSelected =
                    item.id === value || (item.pack === 'launcher' && item.name === value)}
                  <div style="height: {rowHeight}px;" class="flex items-center">
                    <button
                      type="button"
                      class="flex w-full h-7 items-center justify-between rounded px-2 text-xs transition-colors
                        {isSelected
                        ? 'bg-primary/20 text-primary font-medium'
                        : 'text-theme-200 hover:bg-theme-800/70 hover:text-theme-50'}"
                      title="{item.name} ({item.packLabel})"
                      onclick={() => selectIcon(item.id)}
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <div class="flex size-4.5 items-center justify-center shrink-0">
                          <ThemeIcon name={item.id} set={iconSet} size={16} />
                        </div>
                        <span class="truncate font-mono text-[11px]">{item.name}</span>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span
                          class="text-[9px] uppercase px-1 py-0.2 rounded bg-theme-900/80 border border-theme-800/80 text-muted-foreground font-mono"
                        >
                          {item.packLabel}
                        </span>
                        {#if isSelected}
                          <Check class="size-3 text-primary" />
                        {/if}
                      </div>
                    </button>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer Stats Bar -->
    <div
      class="flex items-center justify-between border-t border-theme-800/70 bg-theme-900/40 px-3 py-1.5 text-[10px] text-muted-foreground"
    >
      <span>{filteredItems.length.toLocaleString()} icons</span>
      <span class="text-[9px]"
        >Theme pack: <span class="capitalize text-theme-200">{iconSet}</span></span
      >
    </div>
  </Popover.Content>
</Popover.Root>
