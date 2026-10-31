<script lang="ts">
  import { compileThemeSvelte } from '$lib/themeSvelte';
  import { themeAssetUrl, type ThemeV2ScriptValue } from '$lib/themeV2';
  import { TriangleAlert } from '@lucide/svelte';
  import { mount, unmount } from 'svelte';

  let {
    source,
    assets = '',
    assetOverrides = {},
    variables = {},
    screen = 'home',
    layerId,
    layerName,
    width,
    height,
    themeName = '',
    themeAuthor = '',
    accentColor = '#ff006e',
    interactive = false,
  }: {
    source: string;
    assets?: string;
    assetOverrides?: Record<string, string>;
    variables?: Record<string, ThemeV2ScriptValue>;
    screen?: string;
    layerId: string;
    layerName?: string;
    width: number;
    height: number;
    themeName?: string;
    themeAuthor?: string;
    accentColor?: string;
    interactive?: boolean;
  } = $props();

  type ComponentInstance = ReturnType<typeof mount>;

  let host = $state<HTMLDivElement>();
  let error = $state('');
  let loading = $state(true);
  let instance: ComponentInstance | undefined;
  let generation = 0;

  // A $state proxy can be passed to mount() so $props() in the custom
  // component remains reactive when a logic rule changes a variable.
  const componentProps = $state<Record<string, unknown>>({
    variables: {},
    screen: 'home',
    layer: { id: '', name: undefined, width: 0, height: 0 },
    theme: { name: '', author: '', accentColor: '#ff006e' },
    asset: (path: string) => path,
  });

  const errorMessage = (value: unknown) =>
    value instanceof Error ? `${value.name}: ${value.message}` : String(value);

  $effect(() => {
    componentProps.variables = { ...variables };
    componentProps.screen = screen;
    componentProps.layer = { id: layerId, name: layerName, width, height };
    componentProps.theme = { name: themeName, author: themeAuthor, accentColor };
    componentProps.asset = (path: string) => assetOverrides[path] ?? themeAssetUrl(assets, path);
  });

  $effect(() => {
    const current = ++generation;
    const currentSource = source;
    let mounted: ComponentInstance | undefined;
    loading = true;

    void (async () => {
      const result = await compileThemeSvelte(currentSource, `layer-${layerId}.svelte`);
      if (current !== generation || !host) return;

      if (!result.component) {
        error = result.errors[0]?.message ?? 'The custom component could not be compiled.';
        loading = false;
        return;
      }

      try {
        mounted = mount(result.component, { target: host, props: componentProps });
        instance = mounted;
        error = '';
      } catch (mountError) {
        error = errorMessage(mountError);
      } finally {
        loading = false;
      }
    })();

    return () => {
      // Invalidate a compile that is still in flight so it cannot mount into
      // a host that has already been removed with this layer.
      generation += 1;
      loading = false;
      if (mounted) {
        void unmount(mounted, { outro: false });
        if (instance === mounted) instance = undefined;
      }
    };
  });

  $effect(() => {
    if (!interactive || !error) return;
    console.error(`[theme] Svelte layer ${layerId} failed`, error);
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={host} class="h-full w-full"></div>

  {#if interactive && loading}
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-theme-700 bg-theme-950/65 text-[10px] text-muted-foreground"
    >
      Compiling Svelte…
    </div>
  {/if}

  {#if interactive && error}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-destructive/50 bg-destructive/12 p-3 text-center"
    >
      <TriangleAlert class="size-4 shrink-0 text-destructive" />
      <p class="text-[10px] font-semibold text-destructive">Svelte layer failed</p>
      <p class="line-clamp-4 font-mono text-[9px] leading-relaxed text-destructive/90">{error}</p>
      <p class="text-[8px] text-muted-foreground">Fix the error in the layer inspector.</p>
    </div>
  {/if}
</div>
