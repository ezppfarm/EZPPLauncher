<script lang="ts">
  import Logo from '$assets/logo.png';
  import ThemeV2Background from '$lib/components/theme/ThemeV2Background.svelte';
  import ThemeV2Elements from '$lib/components/theme/ThemeV2Elements.svelte';
  import { fontStack } from '$lib/themeFonts';
  import { readableTextColor, themeFontFaceCss, type ThemeV2Definition } from '$lib/themeV2';
  import { Brush, House, Music, Paintbrush, Play, Settings, User, Wifi } from '@lucide/svelte';

  let {
    definition,
    assets = '',
    assetOverrides = {},
    selectedIds = [],
    interactive = false,
    scale = 1,
    onselect,
    onselectmany,
    onmove,
    onpatch,
    oncontext,
  }: {
    definition: ThemeV2Definition;
    assets?: string;
    assetOverrides?: Record<string, string>;
    selectedIds?: string[];
    interactive?: boolean;
    scale?: number;
    onselect?: (id: string | undefined, additive?: boolean) => void;
    onselectmany?: (ids: string[], additive?: boolean) => void;
    onmove?: (updates: { id: string; x: number; y: number }[]) => void;
    onpatch?: (id: string, patch: Record<string, unknown>) => void;
    oncontext?: (id: string | undefined, event: MouseEvent) => void;
  } = $props();

  const bodyFont = $derived(definition.typography?.body);
  const headingFont = $derived(definition.typography?.heading);
  const accent = $derived(definition.accentColor?.trim() || '#ff006e');
  const accentText = $derived(readableTextColor(accent));
  const stageStyle = $derived(
    [
      `font-family:${fontStack(bodyFont)}`,
      `--primary:${accent}`,
      `--primary-foreground:${accentText}`,
      `--ring:${accent}`,
      `--color-primary:${accent}`,
      `--color-primary-foreground:${accentText}`,
      `--color-primary-500:${accent}`,
      `--color-ring:${accent}`,
    ].join(';')
  );
  const fontFaces = $derived(themeFontFaceCss(definition, assets, assetOverrides));
  const elements = $derived(definition.elements ?? []);
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html `<style>${fontFaces}</style>`}

<div
  class="theme-stage relative h-[650px] w-[1000px] overflow-hidden bg-theme-950 text-theme-50"
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
      <span
        class="rounded-full bg-primary px-2 py-0 text-[8px] font-semibold text-primary-foreground"
      >
        3.2.7
      </span>
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] bg-primary/50 p-3 ring-1 ring-inset ring-white/15"
      >
        <House class="size-5 text-theme-200" />
      </div>
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] border border-black/20 bg-black/20 p-3 ring-1 ring-inset ring-white/15"
      >
        <Paintbrush class="size-5 text-theme-200" />
      </div>
      <div
        class="mt-3 flex size-12 items-center justify-center rounded-[0.85rem] border border-black/20 bg-black/20 p-3 ring-1 ring-inset ring-white/15"
      >
        <Settings class="size-5 text-theme-200" />
      </div>
      <div
        class="mt-auto flex size-10 items-center justify-center overflow-hidden rounded-full bg-theme-900"
      >
        <User class="size-5 text-muted-foreground" />
      </div>
    </aside>

    <section class="relative flex min-w-0 flex-col">
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="mt-12 mb-auto flex flex-col px-6">
          <span
            class="text-4xl font-bold drop-shadow-lg"
            style="font-family:{fontStack(headingFont, bodyFont)}"
          >
            EZPPLauncher
          </span>
          <span class="font-semibold text-muted-foreground drop-shadow-lg">Hello Guest!</span>
        </div>

        <div class="relative h-50 shrink-0">
          <div
            class="absolute left-0 top-0 m-1 flex h-48 w-72 flex-col items-center justify-center gap-3 rounded-md bg-black/40 p-3 ring-1 ring-inset ring-white/5 backdrop-blur-sm"
          >
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="text-sm font-semibold text-theme-50">See your stats here</span>
              <span class="text-xs text-muted-foreground">
                Log in with your EZPPFarm account to track your rank, PP, accuracy and playcount.
              </span>
            </div>
            <div class="flex w-full flex-col gap-2">
              <div
                class="flex h-7 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground"
              >
                Log In
              </div>
              <div
                class="flex h-7 w-full items-center justify-center rounded-md border border-theme-800 text-xs font-medium text-muted-foreground"
              >
                Register
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="relative z-10 flex items-center justify-between border-t border-t-theme-900 bg-black/40 px-8 py-4 backdrop-blur-sm"
      >
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Music class="size-3.5 text-blue-400" />
            <span class="text-[11px] font-medium text-white/70">1.2k</span>
          </div>
          <div class="flex items-center gap-2">
            <Brush class="size-3.5 text-amber-400" />
            <span class="text-[11px] font-medium text-white/70">42</span>
          </div>
          <div class="flex items-center gap-2">
            <Wifi class="size-3.5 text-emerald-400" />
            <span class="text-[11px] font-medium text-white/70">19ms</span>
          </div>
          <div class="h-4 w-px bg-white/10"></div>
          <span
            class="rounded-full border border-white/6 bg-white/10 px-2 py-0.5 text-[10px] text-white/50"
          >
            stable
          </span>
          <span
            class="rounded-full border border-white/6 bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/50"
          >
            20260101.0
          </span>
          <span
            class="rounded-full border border-primary/20 bg-primary/20 px-2 py-0.5 text-[10px] text-primary"
          >
            Default skin
          </span>
        </div>
        <div class="flex h-12 items-center rounded-full bg-primary shadow-lg shadow-primary/25">
          <div class="relative flex size-12 shrink-0 items-center justify-center">
            <div
              class="relative z-10 flex size-9 items-center justify-center rounded-full bg-black/30"
            >
              <Play class="ml-0.5 size-4 fill-current text-primary-foreground" />
            </div>
          </div>
          <div class="w-52 pl-1 pr-6 text-center">
            <p class="text-sm font-bold leading-tight text-primary-foreground">Launch</p>
          </div>
        </div>
      </div>
    </section>
  </div>

  <ThemeV2Elements
    {elements}
    {assets}
    {assetOverrides}
    {interactive}
    {selectedIds}
    {scale}
    {onselect}
    {onselectmany}
    {onmove}
    {onpatch}
    {oncontext}
  />
</div>
