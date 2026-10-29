<script lang="ts">
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Input from '$lib/components/ui/input/input.svelte';
  import { openLogsFolder } from '$lib/osuUtil';
  import { formatBytes } from '$lib/utils';
  import {
    AlertTriangle,
    Copy,
    FileText,
    FolderOpen,
    LoaderCircle,
    RefreshCw,
    Search,
    Terminal,
    X,
  } from '@lucide/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { sileo } from 'sileo';
  import { onMount } from 'svelte';

  type LogBundleInfo = {
    path: string;
    name: string;
    size: number;
    modified: number;
  };

  type LogBundleEntry = {
    name: string;
    content: string;
  };

  let { onclose }: { onclose: () => void } = $props();

  let bundles = $state<LogBundleInfo[]>([]);
  let selectedPath = $state<string | undefined>(undefined);
  let entries = $state<LogBundleEntry[]>([]);
  let selectedLog = $state('launcher.log');
  let query = $state('');
  let errorsOnly = $state(false);
  let loadingBundles = $state(true);
  let loadingEntries = $state(false);
  let errorMessage = $state('');

  const selectedBundle = $derived(bundles.find((bundle) => bundle.path === selectedPath));
  const activeEntry = $derived(entries.find((entry) => entry.name === selectedLog));
  const allLines = $derived(activeEntry?.content.split(/\r?\n/) ?? []);
  const filteredLines = $derived.by(() => {
    const text = query.trim().toLowerCase();
    return allLines.filter((line) => {
      if (errorsOnly && !/(error|warn|panic|fatal|failed)/i.test(line)) return false;
      return !text || line.toLowerCase().includes(text);
    });
  });
  const visibleLines = $derived(filteredLines.slice(0, 5000));

  async function loadBundles() {
    loadingBundles = true;
    errorMessage = '';
    try {
      bundles = await invoke<LogBundleInfo[]>('list_log_bundles');
      if (bundles.length === 0) {
        selectedPath = undefined;
        entries = [];
        return;
      }

      const stillThere = bundles.some((bundle) => bundle.path === selectedPath);
      const next = stillThere ? selectedPath : bundles[0].path;
      selectedPath = next;
      await loadBundle(next!);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      loadingBundles = false;
    }
  }

  async function loadBundle(path: string) {
    selectedPath = path;
    loadingEntries = true;
    errorMessage = '';
    try {
      entries = await invoke<LogBundleEntry[]>('read_log_bundle', { path });
      if (!entries.some((entry) => entry.name === selectedLog)) {
        selectedLog = entries[0]?.name ?? 'launcher.log';
      }
    } catch (error) {
      entries = [];
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      loadingEntries = false;
    }
  }

  async function refresh() {
    await loadBundles();
  }

  async function copyVisible() {
    const text = filteredLines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      sileo.success({
        title: 'Log lines copied',
        description: `${filteredLines.length} lines from ${selectedLog}.`,
      });
    } catch {
      sileo.error({ title: 'Could not copy the log' });
    }
  }

  async function openFolder() {
    try {
      await openLogsFolder();
    } catch (error) {
      sileo.error({
        title: 'Could not open the logs folder',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function lineClass(line: string) {
    if (/(error|panic|fatal|failed)/i.test(line)) return 'text-red-300';
    if (/(warn|deprecated|missing)/i.test(line)) return 'text-amber-200';
    if (/(info|started|loaded|saved)/i.test(line)) return 'text-theme-200';
    return 'text-theme-300';
  }

  onMount(loadBundles);
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose();
  }}
/>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
  role="presentation"
>
  <div
    class="flex h-[82vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-theme-700 bg-theme-950 shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="log-viewer-title"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-theme-800 p-3">
      <div class="flex min-w-0 items-center gap-2">
        <div class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Terminal class="size-4" />
        </div>
        <div class="min-w-0">
          <h2 id="log-viewer-title" class="text-sm font-semibold">Log bundles</h2>
          <p class="truncate text-[10px] text-muted-foreground">
            Launcher, osu! and patcher output, grouped by session
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          class="border-theme-800 bg-theme-950"
          onclick={openFolder}
        >
          <FolderOpen class="size-3.5" />
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="border-theme-800 bg-theme-950"
          onclick={refresh}
          disabled={loadingBundles}
        >
          <RefreshCw class={loadingBundles ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Refresh
        </Button>
        <Button variant="ghost" size="icon" class="size-8" title="Close logs" onclick={onclose}>
          <X class="size-4" />
        </Button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)]">
      <aside class="flex min-h-0 flex-col border-r border-theme-800 bg-black/20">
        <div
          class="flex shrink-0 items-center justify-between border-b border-theme-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <span>Bundles</span>
          <span>{bundles.length}</span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          {#if loadingBundles}
            <div class="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin" />
              Loading…
            </div>
          {:else if bundles.length === 0}
            <div class="p-3 text-[11px] leading-relaxed text-muted-foreground">
              No bundles yet. Logs are zipped on the next launcher restart or when a log reaches 5
              MiB.
            </div>
          {:else}
            {#each bundles as bundle (bundle.path)}
              <button
                type="button"
                class="mb-1 w-full rounded-md border px-2 py-2 text-left transition {bundle.path ===
                selectedPath
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent hover:border-theme-800 hover:bg-theme-900/60'}"
                onclick={() => loadBundle(bundle.path)}
              >
                <span class="flex items-center gap-1.5">
                  <FileText class="size-3.5 shrink-0 text-primary" />
                  <span class="truncate text-[11px] font-medium text-theme-100">
                    {bundle.name}
                  </span>
                </span>
                <span class="mt-1 block pl-5 text-[9px] text-muted-foreground">
                  {new Date(bundle.modified).toLocaleString()} · {formatBytes(bundle.size)}
                </span>
              </button>
            {/each}
          {/if}
        </div>
      </aside>

      <main class="flex min-h-0 min-w-0 flex-col">
        {#if errorMessage}
          <div
            class="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertTriangle class="size-4" />
            {errorMessage}
          </div>
        {/if}

        <div class="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-theme-800 p-2">
          {#if entries.length > 0}
            {#each entries as entry (entry.name)}
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-[10px] {selectedLog === entry.name
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground'}"
                onclick={() => (selectedLog = entry.name)}
              >
                {entry.name}
              </Button>
            {/each}
          {/if}
          <div class="relative ml-auto w-52">
            <Search
              class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              class="h-7 border-theme-800 bg-theme-950 pl-7 text-[10px]"
              placeholder="Filter lines…"
              bind:value={query}
            />
          </div>
          <div
            class="flex items-center gap-1.5 rounded-md border border-theme-800 bg-theme-950 px-2 py-1"
          >
            <Checkbox id="log-errors-only" bind:checked={errorsOnly} />
            <label for="log-errors-only" class="text-[10px] text-muted-foreground">
              Errors only
            </label>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="h-7 border-theme-800 bg-theme-950 text-[10px]"
            onclick={copyVisible}
            disabled={filteredLines.length === 0}
          >
            <Copy class="size-3" />
            Copy
          </Button>
        </div>

        <div class="min-h-0 flex-1 overflow-auto bg-black/25">
          {#if loadingEntries}
            <div
              class="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <LoaderCircle class="size-4 animate-spin" />
              Reading bundle…
            </div>
          {:else if !selectedBundle}
            <div
              class="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground"
            >
              <Terminal class="size-8 opacity-40" />
              <p class="text-xs">Choose a log bundle to inspect it.</p>
            </div>
          {:else if filteredLines.length === 0}
            <div
              class="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground"
            >
              <Search class="size-6 opacity-40" />
              <p class="text-xs">No lines match this filter.</p>
            </div>
          {:else}
            <div class="p-3 font-mono text-[10px] leading-relaxed">
              {#each visibleLines as line, index (index)}
                <div class="whitespace-pre-wrap break-words {lineClass(line)}">{line || ' '}</div>
              {/each}
              {#if filteredLines.length > visibleLines.length}
                <p class="mt-2 text-amber-200">
                  Showing the first {visibleLines.length} matching lines. Narrow the filter to see more.
                </p>
              {/if}
            </div>
          {/if}
        </div>

        <footer
          class="flex shrink-0 items-center justify-between border-t border-theme-800 px-3 py-1.5 text-[9px] text-muted-foreground"
        >
          <span>{filteredLines.length} matching lines</span>
          <span>
            {selectedBundle
              ? `${selectedBundle.name} · ${formatBytes(selectedBundle.size)}`
              : 'No bundle selected'}
          </span>
        </footer>
      </main>
    </div>
  </div>
</div>
