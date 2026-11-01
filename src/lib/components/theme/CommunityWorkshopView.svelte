<script lang="ts">
  import { onMount } from 'svelte';
  import {
    fetchCommunityThemes,
    toggleCommunityThemeLike,
    downloadAndInstallCommunityTheme,
    type CommunityTheme,
  } from '$lib/communityThemes';
  import { active_custom_theme, custom_themes } from '$lib/global';
  import { reduceAnimations } from '$lib/userSettings';
  import { isThemeTrusted } from '$lib/themeTrust';
  import type { Theme } from '$lib/themes';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import ScrollContainer from '$lib/components/ui/scroll-container/ScrollContainer.svelte';
  import { sileo } from 'sileo';
  import {
    Check,
    Code2,
    Download,
    Globe,
    Heart,
    LoaderCircle,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Tag,
  } from '@lucide/svelte';
  import DefaultThemePreview from '$assets/default_preview.png';

  let {
    onApplyTheme,
    onRequestTrust,
  }: {
    onApplyTheme: (theme: Theme) => Promise<void>;
    onRequestTrust: (theme: Theme) => void;
  } = $props();

  let searchQuery = $state('');
  let selectedTag = $state('all');
  let selectedSort = $state<'popular' | 'recent' | 'likes' | 'downloads'>('popular');

  let themes = $state<CommunityTheme[]>([]);
  let totalThemes = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let downloadingId = $state<string | null>(null);
  let downloadProgress = $state(0);
  let downloadStatus = $state('');

  const TAGS = ['all', 'legacy', 'anime', 'minimal', 'video', 'audio', 'game', 'dark', 'clean'];

  const localThemeMap = $derived.by(() => {
    const map = new Map<string, Theme>();
    for (const t of $custom_themes) {
      map.set(t.folder_name.toLowerCase(), t);
      map.set(t.name.toLowerCase(), t);
    }
    return map;
  });

  async function loadWorkshopThemes() {
    loading = true;
    error = null;
    try {
      const res = await fetchCommunityThemes({
        q: searchQuery.trim().length > 0 ? searchQuery.trim() : undefined,
        tag: selectedTag !== 'all' ? selectedTag : undefined,
        sort: selectedSort,
        limit: 50,
      });
      themes = res.items;
      totalThemes = res.total;
    } catch (err) {
      console.warn('[Workshop] Failed to load community themes:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  let searchDebounceTimeout: any = null;
  function handleSearchInput() {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      loadWorkshopThemes();
    }, 300);
  }

  function handleTagClick(tag: string) {
    if (selectedTag === tag) return;
    selectedTag = tag;
    loadWorkshopThemes();
  }

  function handleSortChange(sort: 'popular' | 'recent' | 'likes' | 'downloads') {
    if (selectedSort === sort) return;
    selectedSort = sort;
    loadWorkshopThemes();
  }

  async function handleLike(theme: CommunityTheme, event: MouseEvent) {
    event.stopPropagation();
    const prevLiked = theme.isLiked;
    const prevCount = theme.likeCount;

    // Optimistic update
    theme.isLiked = !prevLiked;
    theme.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

    try {
      const res = await toggleCommunityThemeLike(theme.id);
      theme.isLiked = res.liked;
      theme.likeCount = res.likeCount;
    } catch (err) {
      // Revert on error
      theme.isLiked = prevLiked;
      theme.likeCount = prevCount;
      sileo.error({
        title: 'Could not like theme',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleDownloadAndApply(theme: CommunityTheme) {
    if (downloadingId) return;

    downloadingId = theme.id;
    downloadProgress = 10;
    downloadStatus = 'Downloading theme package...';

    try {
      const res = await downloadAndInstallCommunityTheme(theme, (msg, progress) => {
        downloadStatus = msg;
        downloadProgress = progress;
      });

      sileo.success({
        title: 'Theme Installed',
        description: `"${theme.name}" has been installed to your library.`,
      });

      // Find locally installed theme object
      const installed = $custom_themes.find(
        (t) => t.folder_name.toLowerCase() === res.folderName.toLowerCase()
      );

      if (installed) {
        if (!isThemeTrusted(installed)) {
          onRequestTrust(installed);
        } else {
          await onApplyTheme(installed);
        }
      }
    } catch (err) {
      console.error(err);
      sileo.error({
        title: 'Download failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      downloadingId = null;
      downloadProgress = 0;
      downloadStatus = '';
    }
  }

  async function handleApplyExisting(theme: CommunityTheme) {
    const installed =
      localThemeMap.get(theme.id.toLowerCase()) ||
      localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      await handleDownloadAndApply(theme);
      return;
    }

    if (!isThemeTrusted(installed)) {
      onRequestTrust(installed);
    } else {
      await onApplyTheme(installed);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  onMount(() => {
    loadWorkshopThemes();
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  <!-- Workshop Filter & Search Toolbar -->
  <div class="flex flex-col gap-2.5 pb-3">
    <div class="flex items-center justify-between gap-3">
      <!-- Tag Chips -->
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        {#each TAGS as tag}
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors {selectedTag === tag
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-theme-900/60 text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
            onclick={() => handleTagClick(tag)}
          >
            {tag === 'all' ? 'All Tags' : `#${tag}`}
          </button>
        {/each}
      </div>

      <!-- Controls Right: Sort & Refresh -->
      <div class="flex shrink-0 items-center gap-2">
        <select
          class="h-7.5 rounded-lg border border-theme-800 bg-theme-950/80 px-2.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-white focus:border-primary/50"
          value={selectedSort}
          onchange={(e) => handleSortChange(e.currentTarget.value as any)}
        >
          <option value="popular">Most Popular</option>
          <option value="recent">Most Recent</option>
          <option value="likes">Most Liked</option>
          <option value="downloads">Most Downloaded</option>
        </select>

        <div class="relative w-48">
          <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            class="h-7.5 border-theme-800 bg-theme-950/80 pl-8 text-[11px]"
            placeholder="Search workshop..."
            bind:value={searchQuery}
            oninput={handleSearchInput}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="size-7.5 text-muted-foreground hover:text-white"
          title="Refresh Workshop"
          onclick={loadWorkshopThemes}
          disabled={loading}
        >
          <RefreshCw class="size-3.5 {loading ? 'animate-spin' : ''}" />
        </Button>
      </div>
    </div>
  </div>

  <!-- Content Grid / Status -->
  <div class="min-h-0 flex-1 pt-1">
    <ScrollContainer class="pr-2">
      {#if loading && themes.length === 0}
        <div class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <LoaderCircle class="size-6 animate-spin text-primary" />
          <p class="text-xs">Connecting to EZPPFarm Community Workshop...</p>
        </div>
      {:else if error && themes.length === 0}
        <div class="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <div class="rounded-full bg-red-500/10 p-3 text-red-400">
            <Globe class="size-6" />
          </div>
          <div class="max-w-md">
            <p class="text-sm font-semibold text-white">Workshop Offline or Unreachable</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {error}. Ensure the themes microservice container is running.
            </p>
          </div>
          <Button variant="secondary" size="sm" class="mt-2 text-xs" onclick={loadWorkshopThemes}>
            <RefreshCw class="mr-1.5 size-3.5" />
            Try Again
          </Button>
        </div>
      {:else if themes.length === 0}
        <div class="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Globe class="size-8 opacity-40" />
          <p class="text-xs">No community themes found matching your search.</p>
        </div>
      {:else}
        <div class="grid grid-cols-3 gap-3 pb-4">
          {#each themes as theme (theme.id)}
            {@const localTheme = localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase())}
            {@const isInstalled = Boolean(localTheme)}
            {@const isActive = Boolean(localTheme && $active_custom_theme?.folder_name === localTheme.folder_name)}
            {@const isDownloading = downloadingId === theme.id}
            {@const hasUpdate = Boolean(localTheme && localTheme.version !== theme.version)}

            <div
              class="group flex flex-col overflow-hidden rounded-xl border bg-theme-900/30 {isActive
                ? 'border-primary/60 ring-1 ring-primary/20'
                : 'border-theme-800/60'} transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-theme-900/50 hover:shadow-xl hover:shadow-black/30"
            >
              <!-- 16:9 Thumbnail -->
              <div class="relative aspect-video w-full shrink-0 overflow-hidden bg-theme-950/70">
                <img
                  src={theme.previewUrl}
                  alt={theme.name}
                  class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  onerror={(e) => {
                    // Fallback to default theme preview if server preview not loaded
                    (e.currentTarget as HTMLImageElement).src = DefaultThemePreview;
                  }}
                />
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-theme-950/90 via-transparent to-transparent"></div>

                <!-- Top Left: Trust Badge -->
                <div class="absolute top-2 left-2 flex items-center gap-1.5">
                  {#if theme.apiVersion === '1.0' || theme.tags?.includes('legacy')}
                    <span
                      class="flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-950/80 px-1.5 py-0.5 text-[9px] font-medium text-purple-300 backdrop-blur-sm"
                      title="Legacy v1 theme: video/audio playback"
                    >
                      <Sparkles class="size-3 text-purple-300" />
                      Legacy v1
                    </span>
                  {:else if !theme.hasExecutableCode}
                    <span
                      class="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300 backdrop-blur-sm"
                      title="Sandboxed Declarative Theme: pure styles, no executable JS code"
                    >
                      <ShieldCheck class="size-3" />
                      Declarative
                    </span>
                  {:else}
                    <span
                      class="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 backdrop-blur-sm"
                      title="Contains custom Svelte 5 executable logic"
                    >
                      <Code2 class="size-3" />
                      Svelte Code
                    </span>
                  {/if}
                </div>

                <!-- Top Right: Version -->
                <div class="absolute top-2 right-2">
                  <span class="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
                    v{theme.version}
                  </span>
                </div>

                <!-- Bottom: Author Info -->
                <div class="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <img
                      src={theme.author.avatarUrl}
                      alt={theme.author.name}
                      class="size-5 rounded-full border border-white/20 bg-theme-900 object-cover"
                      onerror={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span class="truncate text-[11px] font-semibold text-white/95 drop-shadow-sm">
                      {theme.author.name}
                    </span>
                    {#if theme.author.donor}
                      <span
                        class="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold text-amber-300 border border-amber-500/30"
                        title="EZPPFarm Supporter"
                      >
                        <Sparkles class="size-2.5 fill-amber-300" />
                        Supporter
                      </span>
                    {/if}
                  </div>
                  <span class="text-[9px] text-muted-foreground/90 tabular-nums">
                    {formatBytes(theme.fileSize)}
                  </span>
                </div>
              </div>

              <!-- Body -->
              <div class="flex flex-1 flex-col justify-between gap-2 p-3">
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="truncate text-[13px] font-bold text-white group-hover:text-primary transition-colors">
                      {theme.name}
                    </h3>

                    <!-- Interactive Like Button -->
                    <button
                      type="button"
                      class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors {theme.isLiked
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-theme-800/40 text-muted-foreground hover:bg-theme-800/80 hover:text-white'}"
                      onclick={(e) => handleLike(theme, e)}
                      title={theme.isLiked ? 'Unlike' : 'Like'}
                    >
                      <Heart class="size-3 {theme.isLiked ? 'fill-rose-400 text-rose-400' : ''}" />
                      <span class="tabular-nums text-[10px]">{theme.likeCount}</span>
                    </button>
                  </div>

                  {#if theme.description}
                    <p class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {theme.description}
                    </p>
                  {/if}

                  {#if theme.tags && theme.tags.length > 0}
                    <div class="mt-2 flex flex-wrap gap-1">
                      {#each theme.tags.slice(0, 3) as tag}
                        <span class="rounded bg-theme-800/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          #{tag}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Footer Action Row -->
                <div class="mt-2 flex items-center justify-between border-t border-theme-800/40 pt-2.5">
                  <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Download class="size-3" />
                    <span class="tabular-nums">{theme.downloadCount}</span>
                  </div>

                  <div>
                    {#if isDownloading}
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] text-primary tabular-nums">{downloadProgress}%</span>
                        <div class="h-1.5 w-16 overflow-hidden rounded-full bg-theme-800">
                          <div
                            class="h-full bg-primary transition-all duration-200"
                            style="width: {downloadProgress}%"
                          ></div>
                        </div>
                      </div>
                    {:else if isActive}
                      <Badge variant="outline" class="border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-[10px]">
                        <Check class="mr-1 size-3" /> In use
                      </Badge>
                    {:else if isInstalled && hasUpdate}
                      <Button
                        size="sm"
                        class="h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                        onclick={() => handleDownloadAndApply(theme)}
                      >
                        Update
                      </Button>
                    {:else if isInstalled}
                      <Button
                        variant="secondary"
                        size="sm"
                        class="h-7 text-xs"
                        onclick={() => handleApplyExisting(theme)}
                      >
                        Apply
                      </Button>
                    {:else}
                      <Button
                        size="sm"
                        class="h-7 text-xs"
                        onclick={() => handleDownloadAndApply(theme)}
                      >
                        <Download class="mr-1 size-3" />
                        Download & Apply
                      </Button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </ScrollContainer>
  </div>
</div>
