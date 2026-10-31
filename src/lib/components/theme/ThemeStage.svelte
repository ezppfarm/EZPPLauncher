<script lang="ts">
  import Logo from '$assets/logo.png';
  import ThemeIcon from '$lib/components/theme/ThemeIcon.svelte';
  import ThemeV2Background from '$lib/components/theme/ThemeV2Background.svelte';
  import ThemeV2Elements from '$lib/components/theme/ThemeV2Elements.svelte';
  import * as Avatar from '$lib/components/ui/avatar';
  import { currentUserInfo } from '$lib/data';
  import { scopeThemeCss } from '$lib/themeCssScope';
  import { fontStack, monoFontStack } from '$lib/themeFonts';
  import { DEFAULT_THEME_ICON_SET } from '$lib/themeIcons';
  import {
    normalizeChrome,
    readableTextColor,
    themeFontFaceCss,
    themeHasLaunchButton,
    type ThemeV2ButtonAction,
    type ThemeV2Definition,
    type ThemeV2Group,
    type ThemeV2ScriptValue,
    type ThemeV2WidgetKind,
  } from '$lib/themeV2';
  import { currentUser } from '$lib/userAuthentication';
  import { countryCodeToEmoji } from '$lib/utils';
  import { Clock, Trophy } from '@lucide/svelte';

  let {
    definition,
    assets = '',
    assetOverrides = {},
    selectedIds = [],
    selectedGroupId,
    interactive = false,
    scale = 1,
    variables = {},
    onselect,
    onselectmany,
    onselectgroup,
    onmove,
    onpatch,
    onpatchgroup,
    oncontext,
    oncontextgroup,
    ondetach,
    onbuttonaction,
  }: {
    definition: ThemeV2Definition;
    assets?: string;
    assetOverrides?: Record<string, string>;
    selectedIds?: string[];
    selectedGroupId?: string;
    interactive?: boolean;
    scale?: number;
    variables?: Record<string, ThemeV2ScriptValue>;
    onselect?: (id: string | undefined, additive?: boolean) => void;
    onselectmany?: (ids: string[], additive?: boolean) => void;
    onselectgroup?: (id: string) => void;
    onmove?: (updates: { id: string; x: number; y: number }[]) => void;
    onpatch?: (id: string, patch: Record<string, unknown>) => void;
    onpatchgroup?: (id: string, patch: Partial<ThemeV2Group>) => void;
    oncontext?: (id: string | undefined, event: MouseEvent) => void;
    oncontextgroup?: (id: string, event: MouseEvent) => void;
    ondetach?: (widgetKind: ThemeV2WidgetKind) => void;
    onbuttonaction?: (action: ThemeV2ButtonAction) => void;
  } = $props();

  const bodyFont = $derived(definition.typography?.body);
  const headingFont = $derived(definition.typography?.heading);
  const monoFont = $derived(definition.typography?.mono);
  const accent = $derived(definition.accentColor?.trim() || '#ff006e');
  const accentText = $derived(readableTextColor(accent));
  const iconSet = $derived(definition.iconSet ?? DEFAULT_THEME_ICON_SET);
  const chrome = $derived(definition.chrome ?? normalizeChrome(undefined, definition.elements));
  const hasLaunchBtn = $derived(themeHasLaunchButton(definition));
  const stageStyle = $derived(
    [
      `font-family:${fontStack(bodyFont)}`,
      `--primary:${accent}`,
      `--primary-foreground:${accentText}`,
      `--accent:${accent}`,
      `--accent-foreground:${accentText}`,
      `--ring:${accent}`,
      `--color-primary:${accent}`,
      `--color-primary-foreground:${accentText}`,
      `--color-primary-500:${accent}`,
      `--color-accent:${accent}`,
      `--color-accent-foreground:${accentText}`,
      `--color-ring:${accent}`,
      `--font-mono:${monoFontStack(monoFont)}`,
    ].join(';')
  );
  const fontFaces = $derived(themeFontFaceCss(definition, assets, assetOverrides));
  const customCss = $derived(scopeThemeCss(definition.css, '.theme-stage'));
  const elements = $derived(definition.elements ?? []);
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html `<style>${fontFaces}\n${customCss}</style>`}

<div
  class="theme-stage dark relative h-[650px] w-[1000px] overflow-hidden bg-theme-950 text-theme-50"
  style={stageStyle}
  role="presentation"
>
  <ThemeV2Background {definition} {assets} {assetOverrides} preview />

  <div class="relative z-10 grid h-full grid-cols-[0.085fr_1fr]">
    <aside
      class="flex flex-col items-center gap-2 border-r border-theme-900 bg-black/40 p-3 backdrop-blur-sm"
    >
      <div class="rounded-[1.1rem] bg-primary/30 p-1.5 ring-1 ring-inset ring-white/15">
        <img class="pointer-events-none size-[43px]" src={Logo} alt="" draggable="false" />
      </div>
      {#if variables.launcher_version !== undefined && variables.launcher_version !== ''}
        <span
          class="rounded-full bg-primary px-2 py-0 text-[8px] font-semibold text-primary-foreground"
        >
          {variables.launcher_version}
        </span>
      {/if}
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] bg-primary p-3 text-primary-foreground ring-1 ring-inset ring-white/15"
      >
        <ThemeIcon name="home" set={iconSet} class="size-5" />
      </div>
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] border border-black/20 bg-black/20 p-3 text-theme-200 ring-1 ring-inset ring-white/15"
      >
        <ThemeIcon name="themes" set={iconSet} class="size-5" />
      </div>
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] border border-black/20 bg-black/20 p-3 text-theme-200 ring-1 ring-inset ring-white/15"
      >
        <ThemeIcon name="settings" set={iconSet} class="size-5" />
      </div>
      <div
        class="mt-auto flex size-10 items-center justify-center overflow-hidden rounded-full bg-theme-900"
      >
        <ThemeIcon name="user" set={iconSet} class="size-5 text-muted-foreground" />
      </div>
    </aside>

    <section class="relative flex min-w-0 flex-col justify-between">
      {#if chrome.header !== false}
        <div class="px-8 pt-7 pb-2 shrink-0 z-10 flex items-start justify-between gap-4">
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="group/header relative flex flex-col {interactive
              ? 'cursor-pointer rounded-xl p-2 -m-2 transition-all hover:bg-white/5 hover:ring-2 hover:ring-primary/40'
              : ''}"
            role={interactive ? 'button' : undefined}
            tabindex={interactive ? 0 : undefined}
            onclick={(e) => {
              if (interactive) {
                e.stopPropagation();
                ondetach?.('header');
              }
            }}
            title={interactive ? 'Click to detach into moveable Header Title layer' : undefined}
          >
            <span
              class="text-3xl font-extrabold tracking-tight drop-shadow-md text-theme-50"
              style="font-family:{fontStack(headingFont, bodyFont)}"
            >
              EZPPLauncher
            </span>
            <span class="text-xs font-medium text-white/70 drop-shadow mt-0.5">
              Good evening, Guest!
            </span>
            {#if interactive}
              <div
                class="pointer-events-none absolute -bottom-6 left-0 whitespace-nowrap rounded border border-white/20 bg-black/90 px-2 py-0.5 text-[10px] text-white opacity-0 shadow transition-opacity group-hover/header:opacity-100"
              >
                Click to detach & move freely
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div></div>
      {/if}

      <div class="px-8 py-2 my-auto z-10">
        {#if chrome.layoutMode === 'dashboard'}
          <div class="flex flex-row items-stretch gap-5 w-full max-w-4xl">
            {#if chrome.playerCard !== false}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class="flex-1 min-w-[320px] max-w-[440px] bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex flex-col justify-between gap-3 shadow-xl {interactive
                  ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all'
                  : ''}"
                role={interactive ? 'button' : undefined}
                tabindex={interactive ? 0 : undefined}
                onclick={(e) => {
                  if (interactive) {
                    e.stopPropagation();
                    ondetach?.('player-card');
                  }
                }}
                title={interactive ? 'Click to detach into moveable Player Card layer' : undefined}
              >
                <div class="flex items-center gap-3">
                  <div class="relative shrink-0">
                    <Avatar.Root
                      class="size-11 rounded-xl border border-white/15 bg-theme-900 shadow"
                    >
                      <Avatar.Image
                        src="https://a.ez-pp.farm/{$currentUser?.id ??
                          $currentUserInfo?.info?.id ??
                          0}"
                        alt={$currentUser?.name ?? 'Player'}
                        class="h-full w-full object-cover"
                      />
                      <Avatar.Fallback
                        class="flex h-full w-full items-center justify-center bg-theme-900 text-primary"
                      >
                        <ThemeIcon name="user" set={iconSet} size={20} />
                      </Avatar.Fallback>
                    </Avatar.Root>
                    {#if $currentUserInfo?.info?.country}
                      <span
                        class="absolute -bottom-1 -right-1 flex items-center justify-center rounded-md border border-white/20 bg-black/90 px-1 py-0.5 text-[9px] leading-none shadow"
                      >
                        {countryCodeToEmoji($currentUserInfo.info.country)}
                      </span>
                    {/if}
                  </div>
                  <div>
                    <span class="font-bold text-sm text-theme-50 block"
                      >{$currentUser?.name ?? 'Guest Player'}</span
                    >
                    <span class="text-xs text-muted-foreground block">
                      Lv.{$currentUserInfo?.stats?.['0']?.level ?? 98} · {(
                        $currentUserInfo?.stats?.['0']?.acc ?? 93
                      ).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="bg-white/5 rounded-xl p-2.5">
                    <span class="text-[10px] text-muted-foreground block">Rank</span>
                    <span class="font-bold text-sm text-theme-50">#102</span>
                  </div>
                  <div class="bg-white/5 rounded-xl p-2.5">
                    <span class="text-[10px] text-muted-foreground block">Performance</span>
                    <span class="font-bold text-sm text-primary">4,521pp</span>
                  </div>
                </div>
              </div>
            {/if}

            {#if chrome.recentActivity !== false}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class="flex-1 min-w-[300px] max-w-[380px] bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl flex flex-col justify-between {interactive
                  ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all'
                  : ''}"
                role={interactive ? 'button' : undefined}
                tabindex={interactive ? 0 : undefined}
                onclick={(e) => {
                  if (interactive) {
                    e.stopPropagation();
                    ondetach?.('recent-activity');
                  }
                }}
                title={interactive
                  ? 'Click to detach into moveable Recent Activity layer'
                  : undefined}
              >
                <!-- Mini Cover Header -->
                <div class="relative h-20 w-full shrink-0 overflow-hidden bg-theme-900/80">
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
                  ></div>
                  <div class="absolute top-2 left-2.5 right-2.5 flex items-center justify-between">
                    <span
                      class="rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90"
                    >
                      Recent Activity
                    </span>
                    <span
                      class="rounded border border-amber-300/40 bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300"
                    >
                      S
                    </span>
                  </div>
                  <div class="absolute bottom-1.5 left-2.5 right-2.5 flex min-w-0 flex-col">
                    <span class="truncate text-xs font-bold text-white">Space Pirates</span>
                    <span class="truncate text-[10px] text-white/70">Waterflame</span>
                  </div>
                </div>

                <!-- Metrics Body -->
                <div class="flex flex-1 flex-col justify-center gap-2 p-2.5">
                  <div class="flex items-center justify-between gap-1 text-[11px]">
                    <span class="max-w-[180px] truncate font-semibold text-primary">
                      [Galactic Thieves]
                    </span>
                    <div
                      class="flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                    >
                      <Trophy class="size-3" />
                      <span>Rank #1</span>
                    </div>
                  </div>
                  <div
                    class="flex items-center justify-between border-t border-white/5 pt-1.5 text-[10px] text-muted-foreground"
                  >
                    <span class="flex items-center gap-1 font-mono">
                      <Clock class="size-2.5" />
                      5d ago
                    </span>
                    <span class="text-white/60">ez-pp.farm</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else if chrome.layoutMode === 'classic'}
          {#if chrome.playerCard !== false}
            <div class="flex flex-col justify-end">
              <div
                class="w-72 h-48 bg-black/40 backdrop-blur-sm rounded-md ring-1 ring-inset ring-white/5 flex flex-col items-center justify-center p-3 gap-3"
              >
                <div class="flex flex-col items-center gap-1 text-center">
                  <span class="text-sm font-semibold text-theme-50">See your stats here</span>
                  <span class="text-xs text-muted-foreground"
                    >Log in with your EZPPFarm account to track your rank.</span
                  >
                </div>
                <div class="flex w-full flex-col gap-2">
                  <div
                    class="flex h-7 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground"
                  >
                    Log In
                  </div>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      {#if chrome.dock !== false}
        <div
          class="relative z-10 flex items-center justify-between border-t border-t-theme-900 bg-black/40 px-8 py-3.5 backdrop-blur-sm shrink-0"
        >
          {#if chrome.dockTelemetry !== false}
            <div class="flex items-center gap-3">
              <div
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/80"
              >
                <ThemeIcon name="music" set={iconSet} class="size-3.5 text-blue-400" />
                <span>1.2k</span>
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/80"
              >
                <ThemeIcon name="brush" set={iconSet} class="size-3.5 text-amber-400" />
                <span>42</span>
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/80"
              >
                <ThemeIcon name="wifi" set={iconSet} class="size-3.5 text-emerald-400" />
                <span>19ms</span>
              </div>
            </div>
          {:else}
            <div></div>
          {/if}

          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="group/launch relative flex h-11 items-center rounded-full bg-primary shadow-lg shadow-primary/25 {interactive
              ? 'cursor-pointer hover:ring-2 hover:ring-white/40 transition-all'
              : ''}"
            role={interactive ? 'button' : undefined}
            tabindex={interactive ? 0 : undefined}
            onclick={(e) => {
              if (interactive) {
                e.stopPropagation();
                ondetach?.('launch-button');
              }
            }}
            title={interactive
              ? 'Click to detach and position Launch Button freely anywhere'
              : undefined}
          >
            <div class="relative flex size-11 shrink-0 items-center justify-center">
              <div
                class="relative z-10 flex size-8 items-center justify-center rounded-full bg-black/30"
              >
                <ThemeIcon
                  name="launch"
                  set={iconSet}
                  class="ml-0.5 size-3.5 fill-current text-primary-foreground"
                />
              </div>
            </div>
            <div class="w-48 pl-1 pr-5 text-center">
              <p class="text-xs font-bold leading-tight text-primary-foreground">Launch</p>
            </div>
            {#if interactive}
              <div
                class="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-white/20 bg-black/90 px-2 py-0.5 text-[10px] text-white opacity-0 shadow transition-opacity group-hover/launch:opacity-100"
              >
                Click to detach & move freely
              </div>
            {/if}
          </div>
        </div>
      {:else if !hasLaunchBtn}
        <div
          class="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur"
        >
          <span>⚠️ Launch Button Missing</span>
        </div>
      {/if}
    </section>
  </div>

  <ThemeV2Elements
    {elements}
    groups={definition.groups}
    {assets}
    {assetOverrides}
    themeName={definition.name}
    themeAuthor={definition.author}
    themeVersion={definition.version}
    accentColor={definition.accentColor}
    {iconSet}
    {interactive}
    {selectedIds}
    {selectedGroupId}
    {scale}
    {variables}
    {onselect}
    {onselectmany}
    {onselectgroup}
    {onmove}
    {onpatch}
    {onpatchgroup}
    {oncontext}
    {oncontextgroup}
    {onbuttonaction}
  />
</div>
