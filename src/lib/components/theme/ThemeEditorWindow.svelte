<script lang="ts">
  import Logo from '$assets/logo.png';
  import FontPreview from '$lib/components/theme/FontPreview.svelte';
  import ThemeElementInspector from '$lib/components/theme/ThemeElementInspector.svelte';
  import ThemeStage from '$lib/components/theme/ThemeStage.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import Separator from '$lib/components/ui/separator/separator.svelte';
  import Slider from '$lib/components/ui/slider/slider.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import {
    defaultFontsourceOptions,
    downloadFontsourceFont,
    fontsourceFontKey,
    fontsourceFontUrl,
    getFontsourceCatalog,
    themeFontKey,
    type FontsourceFont,
  } from '$lib/fontsource';
  import { BUNDLED_THEME_FONTS, type ThemeFontChoice } from '$lib/themeFonts';
  import { renderThemePreview } from '$lib/themePreview';
  import {
    createDefaultThemeV2,
    createThemeV2Element,
    normalizeThemeV2,
    themeAssetName,
    type ThemeV2Asset,
    type ThemeV2Definition,
    type ThemeV2Element,
    type ThemeV2Font,
    type ThemeV2ImageElement,
    type ThemeV2VideoElement,
  } from '$lib/themeV2';
  import {
    exportThemeFolder,
    saveThemeProject,
    themeAssetBase,
    themesDirectory,
    toSafeName,
  } from '$lib/themes';
  import {
    Check,
    ChevronDown,
    ChevronUp,
    Code2,
    Copy,
    Download,
    Image as ImageIcon,
    Layers,
    LoaderCircle,
    MousePointer2,
    Music,
    Palette,
    Plus,
    Redo2,
    RefreshCw,
    Save,
    Search,
    Shapes,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Type,
    Undo2,
    Upload,
    Video,
    X,
  } from '@lucide/svelte';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
  import * as path from '@tauri-apps/api/path';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open, save as saveDialog } from '@tauri-apps/plugin-dialog';
  import * as fs from '@tauri-apps/plugin-fs';
  import { sileo } from 'sileo';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  type ThemeEditorContext = {
    folderName?: string | null;
    folderPath?: string | null;
    themeJson?: string | null;
  };

  type AssetKind = 'image' | 'video' | 'audio' | 'font';

  const labelClass = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const fieldClass = 'h-9 border-theme-800 bg-theme-950 text-xs text-theme-50';

  let definition = $state<ThemeV2Definition>(createDefaultThemeV2());
  let pickedAssets = $state<ThemeV2Asset[]>([]);
  let assetBase = $state('');
  let savedFolder = $state<string | undefined>(undefined);
  let loading = $state(true);
  let saving = $state(false);
  let exporting = $state(false);
  let selectedId = $state<string | undefined>(undefined);
  let leftTab = $state<'layers' | 'theme' | 'fonts'>('layers');
  let canvasHost = $state<HTMLDivElement | undefined>(undefined);
  let canvasScale = $state(0.8);
  let statusMessage = $state('Ready');

  let fontCatalog = $state<FontsourceFont[]>([]);
  let fontCatalogLoading = $state(false);
  let fontCatalogError = $state('');
  let fontQuery = $state('');
  let fontCategory = $state('all');
  let fontResultLimit = $state(60);
  let selectedFontsourceId = $state<string | undefined>(undefined);
  let fontWeight = $state('400');
  let fontStyle = $state<'normal' | 'italic'>('normal');
  let fontSubset = $state('latin');
  let fontDownloading = $state(false);

  const elements = $derived(definition.elements ?? []);
  const selectedIndex = $derived(elements.findIndex((element) => element.id === selectedId));
  const selectedElement = $derived(selectedIndex >= 0 ? elements[selectedIndex] : undefined);
  let previewAssetUrls = $state<Record<string, string>>({});

  // On Linux the custom asset protocol cannot serve theme media, so picked
  // files are registered with the loopback asset server first.
  $effect(() => {
    const assets = pickedAssets.map((asset) => ({ ...asset }));
    let cancelled = false;

    void (async () => {
      const base = await themeAssetBase();
      const entries = await Promise.all(
        assets.map(async (asset) => {
          if (!base) return [asset.name, convertFileSrc(asset.source)] as const;
          try {
            const url = await invoke<string>('theme_preview_url', { path: asset.source });
            return [asset.name, url || convertFileSrc(asset.source)] as const;
          } catch {
            return [asset.name, convertFileSrc(asset.source)] as const;
          }
        })
      );

      if (!cancelled) previewAssetUrls = Object.fromEntries(entries);
    })();

    return () => {
      cancelled = true;
    };
  });

  const previewAssets = $derived(previewAssetUrls);
  const fontOptions = $derived.by<ThemeFontChoice[]>(() => {
    const choices = new SvelteMap<string, ThemeFontChoice>();
    for (const font of BUNDLED_THEME_FONTS) choices.set(font.family, font);
    for (const font of definition.fonts ?? []) {
      if (!choices.has(font.family)) {
        choices.set(font.family, {
          label: font.family,
          family: font.family,
          category: 'Custom' as const,
        });
      }
    }
    return [...choices.values()];
  });
  const customFonts = $derived(definition.fonts ?? []);

  const fontSourceCategories = [
    { value: 'all', label: 'All' },
    { value: 'sans-serif', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'display', label: 'Display' },
    { value: 'monospace', label: 'Mono' },
    { value: 'handwriting', label: 'Script' },
  ] as const;

  const FONT_PREVIEW_FAMILY = 'EZPPFontPreview';

  const selectedFontsource = $derived(fontCatalog.find((font) => font.id === selectedFontsourceId));
  const selectedFontsourceOptions = $derived({
    weight: Number(fontWeight),
    style: fontStyle,
    subset: fontSubset,
  });
  const selectedFontPreviewUrl = $derived(
    selectedFontsource ? fontsourceFontUrl(selectedFontsource, selectedFontsourceOptions) : ''
  );
  const selectedFontPreviewCss = $derived.by(() => {
    if (!selectedFontsource || !selectedFontPreviewUrl) return '';
    const weight = selectedFontsource.variable ? '100 900' : fontWeight;
    return `@font-face{font-family:"${FONT_PREVIEW_FAMILY}";src:url("${selectedFontPreviewUrl}") format("woff2");font-weight:${weight};font-style:${fontStyle};font-display:swap;}`;
  });
  const selectedFontIsAdded = $derived.by(() => {
    if (!selectedFontsource) return false;
    const key = fontsourceFontKey(selectedFontsource, selectedFontsourceOptions);
    return (definition.fonts ?? []).some(
      (font) => themeFontKey(font.family, font.weight ?? '400', font.style ?? 'normal') === key
    );
  });
  const filteredFontsourceFonts = $derived.by(() => {
    const query = fontQuery.trim().toLowerCase();
    return fontCatalog.filter(
      (font) =>
        (fontCategory === 'all' || font.category === fontCategory) &&
        (!query || `${font.family} ${font.id}`.toLowerCase().includes(query))
    );
  });
  const visibleFontsourceFonts = $derived(filteredFontsourceFonts.slice(0, fontResultLimit));

  const backgroundTypes = [
    { value: 'gradient', label: 'Gradient' },
    { value: 'color', label: 'Solid' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
  ] as const;

  const effectTypes = [
    { value: 'none', label: 'None' },
    { value: 'stars', label: 'Stars' },
    { value: 'snow', label: 'Snow' },
    { value: 'petals', label: 'Petals' },
    { value: 'bubbles', label: 'Bubbles' },
  ] as const;

  const notifyError = (description: string) => sileo.error({ title: 'Theme editor', description });

  async function loadFontsourceCatalog() {
    if (fontCatalogLoading || fontCatalog.length > 0) return;
    fontCatalogLoading = true;
    fontCatalogError = '';
    statusMessage = 'Loading Fontsource...';
    try {
      fontCatalog = await getFontsourceCatalog();
      statusMessage = `${fontCatalog.length} Fontsource fonts loaded`;
    } catch (error) {
      console.error(error);
      fontCatalogError =
        error instanceof Error ? error.message : 'Could not reach the Fontsource catalog.';
      statusMessage = 'Fontsource unavailable';
    } finally {
      fontCatalogLoading = false;
    }
  }

  function openFontBrowser() {
    leftTab = 'fonts';
    loadFontsourceCatalog();
  }

  function selectFontsource(font: FontsourceFont) {
    selectedFontsourceId = font.id;
    fontWeight = String(font.weights.includes(400) ? 400 : (font.weights[0] ?? 400));
    fontStyle = font.styles.includes('normal') ? 'normal' : 'italic';
    fontSubset = font.subsets.includes(font.defSubset)
      ? font.defSubset
      : (font.subsets[0] ?? 'latin');
  }

  function setFontCategory(category: string) {
    fontCategory = category;
    fontResultLimit = 60;
  }

  async function addSelectedFontsource() {
    if (!selectedFontsource || fontDownloading || selectedFontIsAdded) return;
    fontDownloading = true;
    statusMessage = `Downloading ${selectedFontsource.family}...`;
    try {
      const asset = await downloadFontsourceFont(selectedFontsource, selectedFontsourceOptions);
      const weight = selectedFontsource.variable ? '100 900' : fontWeight;
      const entry: ThemeV2Font = {
        family: selectedFontsource.family,
        src: asset.name,
        weight,
        style: fontStyle,
      };
      const entryKey = themeFontKey(entry.family, weight, fontStyle);
      definition.fonts = [
        ...(definition.fonts ?? []).filter(
          (font) =>
            themeFontKey(font.family, font.weight ?? '400', font.style ?? 'normal') !== entryKey
        ),
        entry,
      ];
      pickedAssets = [
        ...pickedAssets.filter((candidate) => candidate.name !== asset.name),
        { name: asset.name, source: asset.source },
      ];
      statusMessage = `Added ${selectedFontsource.family}`;
      sileo.success({
        title: 'Font added',
        description: `${selectedFontsource.family} will be bundled with the theme when you save.`,
      });
    } catch (error) {
      console.error(error);
      statusMessage = 'Font download failed';
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      fontDownloading = false;
    }
  }

  const updateCanvasScale = () => {
    if (!canvasHost) return;
    const rect = canvasHost.getBoundingClientRect();
    canvasScale = Math.max(0.25, Math.min((rect.width - 56) / 1000, (rect.height - 56) / 650));
  };

  const ensureDefaults = (theme: ThemeV2Definition): ThemeV2Definition => ({
    ...theme,
    typography: {
      body: theme.typography?.body ?? 'Sora Variable',
      heading: theme.typography?.heading ?? theme.typography?.body ?? 'Sora Variable',
    },
    fonts: theme.fonts ?? [],
    elements: theme.elements ?? [],
  });

  type EditorSnapshot = {
    definition: ThemeV2Definition;
    pickedAssets: ThemeV2Asset[];
  };

  const HISTORY_LIMIT = 100;
  const HISTORY_DELAY = 450;

  let undoStack: EditorSnapshot[] = [];
  let redoStack: EditorSnapshot[] = [];
  let historyBase: EditorSnapshot | undefined;
  let historyKey = '';
  let historyDirty = false;
  let historyTimer: number | undefined;
  let canUndo = $state(false);
  let canRedo = $state(false);

  const captureSnapshot = (): EditorSnapshot => ({
    definition: $state.snapshot(definition) as ThemeV2Definition,
    pickedAssets: $state.snapshot(pickedAssets) as ThemeV2Asset[],
  });

  const snapshotKey = (snapshot: EditorSnapshot) => JSON.stringify(snapshot);

  function refreshHistoryButtons() {
    canUndo = historyDirty || undoStack.length > 0;
    canRedo = !historyDirty && redoStack.length > 0;
  }

  function stopHistoryTimer() {
    if (historyTimer !== undefined) {
      window.clearTimeout(historyTimer);
      historyTimer = undefined;
    }
  }

  function resetHistory() {
    stopHistoryTimer();
    undoStack = [];
    redoStack = [];
    const snapshot = captureSnapshot();
    historyBase = snapshot;
    historyKey = snapshotKey(snapshot);
    historyDirty = false;
    refreshHistoryButtons();
  }

  function applySnapshot(snapshot: EditorSnapshot) {
    definition = snapshot.definition;
    pickedAssets = snapshot.pickedAssets.map((asset) => ({ ...asset }));
    if (selectedId && !definition.elements?.some((element) => element.id === selectedId)) {
      selectedId = undefined;
    }
  }

  function commitPendingHistory() {
    stopHistoryTimer();
    if (!historyBase) {
      resetHistory();
      return;
    }

    const current = captureSnapshot();
    const currentKey = snapshotKey(current);
    const baseKey = snapshotKey(historyBase);

    if (currentKey !== baseKey) {
      undoStack.push(historyBase);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
    }

    historyBase = current;
    historyKey = currentKey;
    historyDirty = false;
    refreshHistoryButtons();
  }

  function undo() {
    commitPendingHistory();
    const previous = undoStack.pop();
    if (!previous) {
      refreshHistoryButtons();
      return;
    }

    redoStack.push(captureSnapshot());
    applySnapshot(previous);
    historyBase = captureSnapshot();
    historyKey = snapshotKey(historyBase);
    historyDirty = false;
    statusMessage = 'Undid last change';
    refreshHistoryButtons();
  }

  function redo() {
    commitPendingHistory();
    const next = redoStack.pop();
    if (!next) {
      refreshHistoryButtons();
      return;
    }

    undoStack.push(captureSnapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    applySnapshot(next);
    historyBase = captureSnapshot();
    historyKey = snapshotKey(historyBase);
    historyDirty = false;
    statusMessage = 'Redid last change';
    refreshHistoryButtons();
  }

  $effect(() => {
    const current = captureSnapshot();
    const currentKey = snapshotKey(current);

    if (!historyBase) {
      historyBase = current;
      historyKey = currentKey;
      return;
    }

    if (currentKey === historyKey) return;
    historyKey = currentKey;

    if (currentKey === snapshotKey(historyBase)) {
      stopHistoryTimer();
      historyDirty = false;
      refreshHistoryButtons();
      return;
    }

    redoStack = [];
    historyDirty = true;
    refreshHistoryButtons();
    stopHistoryTimer();
    historyTimer = window.setTimeout(() => {
      historyTimer = undefined;
      commitPendingHistory();
    }, HISTORY_DELAY);
  });

  async function loadContext() {
    loading = true;
    try {
      const context = await invoke<ThemeEditorContext>('theme_editor_context');
      const parsed = context.themeJson
        ? normalizeThemeV2(JSON.parse(context.themeJson) as Partial<ThemeV2Definition>)
        : createDefaultThemeV2();
      definition = ensureDefaults(parsed);
      savedFolder = context.folderName ?? undefined;
      const httpBase = await themeAssetBase();
      assetBase =
        httpBase && context.folderName
          ? `${httpBase}/${encodeURIComponent(context.folderName)}/assets`
          : context.folderPath
            ? convertFileSrc(await path.normalize(await path.join(context.folderPath, 'assets')))
            : '';
      pickedAssets = [];
      selectedId = undefined;
      selectedFontsourceId = undefined;
      fontDownloading = false;
      resetHistory();
      statusMessage = context.themeJson ? 'Theme loaded' : 'New theme';
      requestAnimationFrame(updateCanvasScale);
    } catch (error) {
      console.error(error);
      definition = ensureDefaults(createDefaultThemeV2());
      savedFolder = undefined;
      assetBase = '';
      pickedAssets = [];
      selectedFontsourceId = undefined;
      fontDownloading = false;
      resetHistory();
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      loading = false;
      requestAnimationFrame(updateCanvasScale);
    }
  }

  onMount(() => {
    const observer = new ResizeObserver(updateCanvasScale);
    if (canvasHost) observer.observe(canvasHost);
    let unlisten: UnlistenFn | undefined;
    listen('theme-editor-context', () => loadContext()).then((stop) => (unlisten = stop));
    loadContext();

    return () => {
      observer.disconnect();
      unlisten?.();
      stopHistoryTimer();
    };
  });

  const assetFilters: Record<AssetKind, { name: string; extensions: string[] }[]> = {
    image: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }],
    video: [{ name: 'Video (WebM recommended)', extensions: ['webm', 'mp4', 'm4v', 'mov'] }],
    audio: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'm4a', 'flac'] }],
    font: [{ name: 'Font', extensions: ['woff2', 'woff', 'ttf', 'otf'] }],
  };

  async function chooseAsset(kind: AssetKind): Promise<ThemeV2Asset | undefined> {
    const selected = await open({
      multiple: false,
      directory: false,
      title:
        kind === 'image'
          ? 'Choose an image'
          : kind === 'video'
            ? 'Choose a video'
            : kind === 'audio'
              ? 'Choose theme music'
              : 'Import a font file',
      filters: assetFilters[kind],
    });
    if (typeof selected !== 'string') return;

    const prefix = kind === 'font' ? 'font' : kind === 'audio' ? 'audio' : kind;
    const name = themeAssetName(selected, prefix);
    const asset = { source: selected, name };
    pickedAssets = [...pickedAssets.filter((candidate) => candidate.name !== name), asset];
    return asset;
  }

  function setBackgroundType(type: ThemeV2Definition['background']['type']) {
    const current = definition.background;
    const opacity = current.opacity ?? 1;
    const blur = current.type === 'image' || current.type === 'video' ? (current.blur ?? 0) : 0;
    const fit =
      current.type === 'image' || current.type === 'video' ? (current.fit ?? 'cover') : 'cover';
    if (type === 'color') {
      definition.background = {
        type,
        color: current.type === 'color' ? current.color : '#181825',
        opacity,
      };
    } else if (type === 'gradient') {
      definition.background = {
        type,
        from: current.type === 'gradient' ? current.from : '#181825',
        to: current.type === 'gradient' ? current.to : '#3b1d4f',
        angle: current.type === 'gradient' ? (current.angle ?? 135) : 135,
        opacity,
      };
    } else if (type === 'video') {
      definition.background = {
        type,
        src: current.type === 'video' ? current.src : '',
        fit,
        opacity,
        blur,
        muted: current.type === 'video' ? current.muted !== false : true,
      };
    } else {
      definition.background = {
        type,
        src: current.type === 'image' ? current.src : '',
        fit,
        opacity,
        blur,
      };
    }
  }

  async function chooseBackground(type: 'image' | 'video') {
    const asset = await chooseAsset(type);
    if (!asset) return;
    const current = definition.background;
    const fit =
      current.type === 'image' || current.type === 'video' ? (current.fit ?? 'cover') : 'cover';
    const opacity = current.opacity ?? 1;
    const blur = current.type === 'image' || current.type === 'video' ? (current.blur ?? 0) : 0;
    if (type === 'video') {
      definition.background = {
        type,
        src: asset.name,
        fit,
        opacity,
        blur,
        muted: current.type === 'video' ? current.muted !== false : true,
      };
    } else {
      definition.background = {
        type,
        src: asset.name,
        fit,
        opacity,
        blur,
      };
    }
  }

  async function chooseAudio() {
    const asset = await chooseAsset('audio');
    if (!asset) return;
    definition.audio = { src: asset.name, loop: definition.audio?.loop !== false };
  }

  function uniqueFamily(label: string) {
    const existing = new Set((definition.fonts ?? []).map((font) => font.family));
    let family = label.trim() || 'Custom Font';
    let suffix = 2;
    while (existing.has(family)) family = `${label.trim()} ${suffix++}`;
    return family;
  }

  async function importFont() {
    const asset = await chooseAsset('font');
    if (!asset) return;
    const stem = (asset.source.split(/[\\/]/).pop() ?? 'Custom Font')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    const font: ThemeV2Font = {
      family: uniqueFamily(stem || 'Custom Font'),
      src: asset.name,
      weight: '400',
      style: 'normal',
    };
    definition.fonts = [...(definition.fonts ?? []), font];
    statusMessage = `Imported ${font.family}`;
    sileo.success({ title: 'Font imported', description: font.family });
  }

  function assetIsUsed(name: string) {
    const background = definition.background;
    if ((background.type === 'image' || background.type === 'video') && background.src === name) {
      return true;
    }
    if (definition.audio?.src === name) return true;
    return elements.some(
      (element) => (element.type === 'image' || element.type === 'video') && element.src === name
    );
  }

  function removeFont(font: ThemeV2Font) {
    const remaining = (definition.fonts ?? []).filter(
      (candidate) =>
        candidate.family !== font.family ||
        candidate.src !== font.src ||
        (candidate.weight ?? '400') !== (font.weight ?? '400') ||
        (candidate.style ?? 'normal') !== (font.style ?? 'normal')
    );
    definition.fonts = remaining;

    if (!remaining.some((candidate) => candidate.family === font.family)) {
      if (definition.typography?.body === font.family) {
        definition.typography.body = 'Sora Variable';
      }
      if (definition.typography?.heading === font.family) {
        definition.typography.heading = 'Sora Variable';
      }
      for (const element of elements) {
        if (element.type === 'text' && element.fontFamily === font.family) {
          element.fontFamily = 'Sora Variable';
        }
      }
    }

    if (!remaining.some((candidate) => candidate.src === font.src) && !assetIsUsed(font.src)) {
      pickedAssets = pickedAssets.filter((asset) => asset.name !== font.src);
    }
  }

  function addText() {
    const element = createThemeV2Element('text', elements.length);
    definition.elements = [...elements, element];
    selectedId = element.id;
    leftTab = 'layers';
  }

  async function addMedia(kind: 'image' | 'video') {
    const asset = await chooseAsset(kind);
    if (!asset) return;
    const element = createThemeV2Element(kind, elements.length) as
      | ThemeV2ImageElement
      | ThemeV2VideoElement;
    element.src = asset.name;
    definition.elements = [...elements, element];
    selectedId = element.id;
    leftTab = 'layers';
  }

  function addShape() {
    const element = createThemeV2Element('shape', elements.length);
    definition.elements = [...elements, element];
    selectedId = element.id;
    leftTab = 'layers';
  }

  function patchElement(id: string, patch: Record<string, unknown>) {
    const element = elements.find((candidate) => candidate.id === id);
    if (element) Object.assign(element, patch);
  }

  function updateElement(id: string, patch: Partial<ThemeV2Element>) {
    patchElement(id, patch);
  }

  async function replaceSelectedAsset(kind: 'image' | 'video') {
    if (
      !selectedElement ||
      (selectedElement.type !== 'image' && selectedElement.type !== 'video')
    ) {
      return;
    }
    const asset = await chooseAsset(kind);
    if (asset) updateElement(selectedElement.id, { src: asset.name });
  }

  function duplicateSelected() {
    if (!selectedElement) return;
    const copy = {
      ...selectedElement,
      id: `element_${Date.now().toString(36)}_${elements.length}`,
      x: Math.min(selectedElement.x + 24, 1000 - selectedElement.width),
      y: Math.min(selectedElement.y + 24, 650 - selectedElement.height),
    } as ThemeV2Element;
    definition.elements = [...elements, copy];
    selectedId = copy.id;
  }

  function deleteSelected() {
    if (!selectedElement) return;
    definition.elements = elements.filter((element) => element.id !== selectedElement.id);
    selectedId = undefined;
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedElement) return;
    const index = elements.findIndex((element) => element.id === selectedElement.id);
    const target = index + direction;
    if (target < 0 || target >= elements.length) return;
    const reordered = [...elements];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    definition.elements = reordered;
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = document.activeElement as HTMLElement | undefined;
    const typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (modifier && key === 'z') {
      if (typing) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && key === 'y') {
      if (typing) return;
      event.preventDefault();
      redo();
      return;
    }

    if (modifier && key === 's') {
      event.preventDefault();
      saveTheme();
      return;
    }
    if (event.key === 'Escape') {
      selectedId = undefined;
      return;
    }
    if (typing || !selectedElement) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelected(1);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelected(-1);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      updateElement(selectedElement.id, {
        x: Math.min(1000 - selectedElement.width, Math.max(0, selectedElement.x + move[0])),
        y: Math.min(650 - selectedElement.height, Math.max(0, selectedElement.y + move[1])),
      });
    }
  }

  async function generateThemePreview(folderName: string) {
    const assetsFolder = await path.join(await themesDirectory(), folderName, 'assets');
    const blob = await renderThemePreview({
      definition: normalizeThemeV2(definition),
      logoUrl: Logo,
      readAsset: async (assetPath) => {
        const parts = assetPath.replace(/\\/g, '/').split('/');
        if (assetPath.startsWith('/') || parts.some((part) => !part || part === '..')) {
          return undefined;
        }
        const relative = parts.filter((part) => part !== '.').join('/');
        if (!relative) return undefined;
        const filePath = await path.join(assetsFolder, relative);
        if (!(await fs.exists(filePath))) return undefined;
        return await fs.readFile(filePath);
      },
    });
    await fs.writeFile(
      await path.join(assetsFolder, 'preview.png'),
      new Uint8Array(await blob.arrayBuffer())
    );
  }

  async function saveTheme(options: { notify?: boolean; emitSaved?: boolean } = {}) {
    if (saving) return false;
    if (!definition.name.trim()) {
      notifyError('Give your theme a name first.');
      return false;
    }
    if (!definition.author.trim()) {
      notifyError('Add an author name so people know who made the theme.');
      return false;
    }
    const folderName = savedFolder ?? toSafeName(definition.name);
    if (!folderName.replace(/_/g, '')) {
      notifyError('The theme name needs at least one letter or number.');
      return false;
    }
    if (!savedFolder) {
      const target = await path.join(await themesDirectory(), folderName);
      if (await fs.exists(target)) {
        notifyError('A theme with that folder already exists. Choose another name.');
        return false;
      }
    }

    saving = true;
    statusMessage = 'Saving...';
    try {
      const themeToSave = normalizeThemeV2(definition);
      themeToSave.preview = 'preview.png';
      await saveThemeProject(folderName, themeToSave, pickedAssets);
      savedFolder = folderName;

      let previewError: string | undefined;
      statusMessage = 'Creating preview...';
      try {
        await generateThemePreview(folderName);
      } catch (error) {
        console.error('Could not create the theme preview', error);
        previewError = error instanceof Error ? error.message : String(error);
      }

      statusMessage = previewError ? 'Saved (preview failed)' : 'Saved';
      if (options.emitSaved !== false) await emit('theme-saved', folderName);
      if (options.notify !== false) {
        sileo.success({
          title: 'Theme saved',
          description: previewError
            ? 'The theme was saved, but its preview image could not be created.'
            : `"${definition.name}" was saved with a fresh preview image.`,
        });
      }
      if (previewError) console.warn(`Theme preview was not updated: ${previewError}`);
      return true;
    } catch (error) {
      console.error(error);
      statusMessage = 'Save failed';
      notifyError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      saving = false;
    }
  }

  async function exportCurrentTheme() {
    const alreadySaved = Boolean(savedFolder);
    const saved = await saveTheme({ notify: false, emitSaved: !alreadySaved });
    if (!saved || !savedFolder) return;
    const destination = await saveDialog({
      defaultPath: `${toSafeName(definition.name)}.ezpplauncher-theme`,
      filters: [{ name: 'EZPPLauncher Theme', extensions: ['ezpplauncher-theme'] }],
    });
    if (typeof destination !== 'string') return;

    exporting = true;
    try {
      await exportThemeFolder(savedFolder, destination);
      sileo.success({
        title: 'Theme exported',
        description: 'The .ezpplauncher-theme file is ready to share.',
      });
    } catch (error) {
      console.error(error);
      sileo.error({
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      exporting = false;
    }
  }

  const closeEditor = () => getCurrentWindow().close();
</script>

<svelte:window onkeydown={handleKeydown} />

{#if selectedFontPreviewCss}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<style>${selectedFontPreviewCss}</style>`}
{/if}

<div class="flex h-screen flex-col overflow-hidden bg-theme-950 text-theme-50">
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-theme-800 bg-black/40 px-4"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="rounded-xl bg-primary/25 p-1 ring-1 ring-inset ring-white/15">
        <img src={Logo} alt="" class="size-7" />
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-sm font-semibold">Advanced theme editor</h1>
          <Badge
            variant="outline"
            class="border-primary/25 bg-primary/15 px-2 py-0.5 text-[9px] text-primary"
          >
            API 2.0
          </Badge>
          {#if definition.nsfw}
            <Badge variant="destructive" class="px-2 py-0.5 text-[9px]" title="Adult content">
              18+
            </Badge>
          {/if}
        </div>
        <p class="truncate text-[10px] text-muted-foreground">
          {definition.name || 'Untitled theme'} · freeform home screen canvas
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <span class="mr-2 hidden text-[10px] text-muted-foreground sm:block">{statusMessage}</span>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        title="Undo (Cmd/Ctrl+Z)"
        aria-label="Undo"
        onclick={undo}
        disabled={!canUndo}
      >
        <Undo2 class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        title="Redo (Cmd/Ctrl+Shift+Z)"
        aria-label="Redo"
        onclick={redo}
        disabled={!canRedo}
      >
        <Redo2 class="size-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onclick={exportCurrentTheme}
        disabled={exporting || saving}
      >
        {#if exporting}
          <LoaderCircle class="animate-spin" />
        {:else}
          <Download />
        {/if}
        Export
      </Button>
      <Button size="sm" onclick={() => saveTheme()} disabled={saving || loading}>
        {#if saving}
          <LoaderCircle class="animate-spin" />
        {:else}
          <Save />
        {/if}
        Save theme
      </Button>
      <Button variant="ghost" size="icon" title="Close editor" onclick={closeEditor}>
        <X />
      </Button>
    </div>
  </header>

  <div class="grid min-h-0 flex-1 grid-cols-[64px_282px_minmax(0,1fr)_324px] overflow-hidden">
    <aside class="flex flex-col items-center gap-1.5 border-r border-theme-800 bg-black/25 p-2">
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg {selectedId === undefined
          ? 'bg-primary/20 text-primary hover:bg-primary/25'
          : ''}"
        title="Select and move layers"
        aria-pressed={selectedId === undefined}
        onclick={() => (selectedId = undefined)}
      >
        <MousePointer2 class="size-4" />
      </Button>
      <Separator class="my-1 w-8 bg-theme-800" />
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg text-muted-foreground"
        title="Add text layer"
        onclick={addText}
      >
        <Type class="size-4" />
        <span class="text-[8px]">Text</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg text-muted-foreground"
        title="Add image layer"
        onclick={() => addMedia('image')}
      >
        <ImageIcon class="size-4" />
        <span class="text-[8px]">Image</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg text-muted-foreground"
        title="Add video layer (WebM recommended)"
        onclick={() => addMedia('video')}
      >
        <Video class="size-4" />
        <span class="text-[8px]">Video</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg text-muted-foreground"
        title="Add shape layer"
        onclick={addShape}
      >
        <Shapes class="size-4" />
        <span class="text-[8px]">Shape</span>
      </Button>
      <Separator class="my-1 w-8 bg-theme-800" />
      <Button
        variant="ghost"
        size="icon"
        class="size-11 flex-col gap-0.5 rounded-lg {leftTab === 'theme'
          ? 'bg-primary/20 text-primary hover:bg-primary/25'
          : 'text-muted-foreground'}"
        title="Theme settings"
        aria-pressed={leftTab === 'theme'}
        onclick={() => (leftTab = 'theme')}
      >
        <Palette class="size-4" />
        <span class="text-[8px]">Theme</span>
      </Button>
      <div class="mt-auto rounded-lg border border-theme-800 bg-black/20 px-1.5 py-1 text-center">
        <p class="text-[8px] uppercase tracking-wide text-muted-foreground">Canvas</p>
        <p class="font-mono text-[9px] text-theme-100">1000×650</p>
      </div>
    </aside>

    <aside class="flex min-h-0 flex-col border-r border-theme-800 bg-theme-900/25">
      <div class="grid shrink-0 grid-cols-3 gap-1 border-b border-theme-800 p-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-1.5 text-[10px] {leftTab === 'layers'
            ? 'bg-primary/20 text-primary hover:bg-primary/25'
            : 'text-muted-foreground'}"
          aria-pressed={leftTab === 'layers'}
          onclick={() => (leftTab = 'layers')}
        >
          <Layers class="size-3.5" />
          Layers
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-1.5 text-[10px] {leftTab === 'theme'
            ? 'bg-primary/20 text-primary hover:bg-primary/25'
            : 'text-muted-foreground'}"
          aria-pressed={leftTab === 'theme'}
          onclick={() => (leftTab = 'theme')}
        >
          <SlidersHorizontal class="size-3.5" />
          Theme
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-1.5 text-[10px] {leftTab === 'fonts'
            ? 'bg-primary/20 text-primary hover:bg-primary/25'
            : 'text-muted-foreground'}"
          aria-pressed={leftTab === 'fonts'}
          onclick={openFontBrowser}
        >
          <Type class="size-3.5" />
          Fonts
        </Button>
      </div>

      {#if leftTab === 'layers'}
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <div class="mb-2 flex items-center justify-between px-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {elements.length} layer{elements.length === 1 ? '' : 's'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
              onclick={addText}
            >
              <Plus class="size-3" />
              Add
            </Button>
          </div>
          {#if elements.length === 0}
            <div class="rounded-lg border border-dashed border-theme-800 p-4 text-center">
              <Layers class="mx-auto size-6 text-theme-600" />
              <p class="mt-2 text-xs font-medium text-theme-100">Your canvas is empty</p>
              <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Add text, images, videos or shapes to build on top of the launcher home screen.
              </p>
            </div>
          {:else}
            <div class="space-y-1">
              {#each [...elements].reverse() as element (element.id)}
                <Button
                  variant="ghost"
                  class="h-auto w-full justify-start gap-2 whitespace-normal rounded-md border px-2 py-2 text-left font-normal {selectedId ===
                  element.id
                    ? 'border-primary/50 bg-primary/10 hover:bg-primary/15'
                    : 'border-transparent hover:border-theme-800'}"
                  aria-pressed={selectedId === element.id}
                  onclick={() => {
                    selectedId = element.id;
                    leftTab = 'layers';
                  }}
                >
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded bg-theme-900"
                  >
                    {#if element.type === 'text'}
                      <Type class="size-3.5" />
                    {:else if element.type === 'image'}
                      <ImageIcon class="size-3.5" />
                    {:else if element.type === 'video'}
                      <Video class="size-3.5" />
                    {:else}
                      <Shapes class="size-3.5" />
                    {/if}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[11px] font-medium text-theme-100">
                      {element.type === 'text'
                        ? element.text.slice(0, 36) || 'Text layer'
                        : element.type === 'shape'
                          ? element.shape
                          : element.src.split('/').pop() || element.type}
                    </span>
                    <span class="block font-mono text-[9px] text-muted-foreground">
                      {Math.round(element.width)}×{Math.round(element.height)}
                    </span>
                  </span>
                  <span class="text-[9px] uppercase text-muted-foreground">{element.type}</span>
                </Button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="grid shrink-0 grid-cols-2 gap-1.5 border-t border-theme-800 p-2">
          <Button
            variant="secondary"
            class="h-8 gap-1.5 text-[10px]"
            onclick={() => addMedia('image')}
          >
            <ImageIcon class="size-3.5" />
            Image
          </Button>
          <Button
            variant="secondary"
            class="h-8 gap-1.5 text-[10px]"
            onclick={() => addMedia('video')}
          >
            <Video class="size-3.5" />
            Video
          </Button>
        </div>
      {:else if leftTab === 'fonts'}
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="shrink-0 space-y-2 border-b border-theme-800 p-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                class="h-8 border-theme-800 bg-theme-950 pl-8 text-xs"
                placeholder="Search all Fontsource fonts…"
                bind:value={fontQuery}
                oninput={() => (fontResultLimit = 60)}
              />
            </div>
            <div class="flex flex-wrap gap-1">
              {#each fontSourceCategories as category (category.value)}
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 rounded px-1.5 text-[9px] {fontCategory === category.value
                    ? 'bg-primary/20 text-primary hover:bg-primary/25'
                    : 'text-muted-foreground'}"
                  aria-pressed={fontCategory === category.value}
                  onclick={() => setFontCategory(category.value)}
                >
                  {category.label}
                </Button>
              {/each}
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            {#if fontCatalogLoading}
              <div class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <LoaderCircle class="size-5 animate-spin" />
                <span class="text-[10px]">Loading all Fontsource fonts…</span>
              </div>
            {:else if fontCatalogError}
              <div
                class="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center"
              >
                <p class="text-[10px] leading-relaxed text-muted-foreground">{fontCatalogError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-7 text-[10px]"
                  onclick={loadFontsourceCatalog}
                >
                  <RefreshCw class="size-3.5" />
                  Retry
                </Button>
              </div>
            {:else if fontCatalog.length === 0}
              <div class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Search class="size-5" />
                <p class="text-[10px]">Load every family from Fontsource to start browsing.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-7 text-[10px]"
                  onclick={loadFontsourceCatalog}
                >
                  Load fonts
                </Button>
              </div>
            {:else}
              <p
                class="mb-2 flex items-center justify-between px-1 text-[9px] text-muted-foreground"
              >
                <span>{filteredFontsourceFonts.length} fonts</span>
                <span>{fontCatalog.length} available</span>
              </p>
              <div class="space-y-0.5">
                {#each visibleFontsourceFonts as font (font.id)}
                  {@const fontPreview = defaultFontsourceOptions(font)}
                  <Button
                    variant="ghost"
                    class="h-auto w-full justify-between gap-2 whitespace-normal rounded px-2 py-1.5 text-left font-normal {selectedFontsourceId ===
                    font.id
                      ? 'bg-primary/15 text-primary hover:bg-primary/20'
                      : ''}"
                    aria-pressed={selectedFontsourceId === font.id}
                    onclick={() => selectFontsource(font)}
                  >
                    <span class="min-w-0">
                      <FontPreview
                        family={font.family}
                        src={fontsourceFontUrl(font, fontPreview)}
                        weight={String(fontPreview.weight)}
                        style={fontPreview.style}
                        class="block truncate text-[12px] leading-tight"
                      />
                      <span class="block text-[9px] capitalize text-muted-foreground"
                        >{font.category.replace('-', ' ')}</span
                      >
                    </span>
                    {#if font.variable}
                      <Badge
                        variant="outline"
                        class="shrink-0 border-primary/25 px-1 py-0 text-[8px] text-primary"
                      >
                        VAR
                      </Badge>
                    {/if}
                  </Button>
                {/each}
              </div>
              {#if filteredFontsourceFonts.length > visibleFontsourceFonts.length}
                <Button
                  variant="ghost"
                  class="mt-2 h-7 w-full text-[10px] text-muted-foreground"
                  onclick={() => (fontResultLimit += 60)}
                >
                  Show more ({filteredFontsourceFonts.length - visibleFontsourceFonts.length} left)
                </Button>
              {/if}
              {#if filteredFontsourceFonts.length === 0}
                <div class="py-8 text-center text-[10px] text-muted-foreground">
                  No Fontsource fonts match that search.
                </div>
              {/if}
            {/if}
          </div>

          {#if selectedFontsource}
            <div class="shrink-0 space-y-2 border-t border-theme-800 bg-black/20 p-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-[11px] font-semibold text-theme-100">
                    {selectedFontsource.family}
                  </p>
                  <p class="truncate text-[9px] capitalize text-muted-foreground">
                    {selectedFontsource.category.replace('-', ' ')} · {selectedFontsource.subsets
                      .length}
                    subsets
                  </p>
                </div>
                {#if selectedFontsource.variable}
                  <Badge
                    variant="outline"
                    class="shrink-0 border-primary/25 px-1.5 py-0 text-[8px] text-primary"
                  >
                    Variable
                  </Badge>
                {/if}
              </div>
              <div
                class="overflow-hidden rounded-md border border-theme-800 bg-theme-950 px-2 py-2"
              >
                <p
                  class="truncate text-base text-theme-100"
                  style="font-family:{FONT_PREVIEW_FAMILY};font-weight:{selectedFontsource.variable
                    ? 600
                    : fontWeight}"
                >
                  The quick brown fox
                </p>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                {#if !selectedFontsource.variable}
                  <div class="space-y-1">
                    <Label for="fontsource-weight" class={labelClass}>Weight</Label>
                    <Select.Root
                      type="single"
                      value={fontWeight}
                      onValueChange={(value) => value && (fontWeight = value)}
                    >
                      <Select.Trigger
                        id="fontsource-weight"
                        class="h-7 border-theme-800 bg-theme-950 text-[10px] text-theme-50"
                      >
                        {fontWeight}
                      </Select.Trigger>
                      <Select.Content class="border-theme-800 bg-theme-950">
                        {#each selectedFontsource.weights as weight (weight)}
                          <Select.Item value={String(weight)} label={String(weight)} />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                {/if}
                <div class="space-y-1 {selectedFontsource.variable ? 'col-span-2' : ''}">
                  <Label for="fontsource-style" class={labelClass}>Style</Label>
                  <Select.Root
                    type="single"
                    value={fontStyle}
                    onValueChange={(value) => value && (fontStyle = value as 'normal' | 'italic')}
                  >
                    <Select.Trigger
                      id="fontsource-style"
                      class="h-7 border-theme-800 bg-theme-950 text-[10px] text-theme-50"
                    >
                      {fontStyle}
                    </Select.Trigger>
                    <Select.Content class="border-theme-800 bg-theme-950">
                      {#each selectedFontsource.styles as style (style)}
                        <Select.Item value={style} label={style} />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
              <div class="space-y-1">
                <Label for="fontsource-subset" class={labelClass}>Subset</Label>
                <Select.Root
                  type="single"
                  value={fontSubset}
                  onValueChange={(value) => value && (fontSubset = value)}
                >
                  <Select.Trigger
                    id="fontsource-subset"
                    class="h-7 border-theme-800 bg-theme-950 text-[10px] text-theme-50"
                  >
                    {fontSubset}
                  </Select.Trigger>
                  <Select.Content class="border-theme-800 bg-theme-950">
                    {#each selectedFontsource.subsets as subset (subset)}
                      <Select.Item value={subset} label={subset} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <Button
                class="h-8 w-full gap-1.5 text-[10px]"
                onclick={addSelectedFontsource}
                disabled={fontDownloading || selectedFontIsAdded}
              >
                {#if fontDownloading}
                  <LoaderCircle class="animate-spin" />
                  Downloading…
                {:else if selectedFontIsAdded}
                  <Check class="size-3.5" />
                  Added to theme
                {:else}
                  <Download class="size-3.5" />
                  Download & add
                {/if}
              </Button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <section class="space-y-3">
            <h3 class="text-xs font-semibold text-theme-100">Theme details</h3>
            <div class="space-y-1.5">
              <Label for="theme-name" class={labelClass}>Name</Label>
              <Input
                id="theme-name"
                bind:value={definition.name}
                class={fieldClass}
                placeholder="Midnight"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1.5">
                <Label for="theme-author" class={labelClass}>Author</Label>
                <Input
                  id="theme-author"
                  bind:value={definition.author}
                  class={fieldClass}
                  placeholder="You"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="theme-version" class={labelClass}>Version</Label>
                <Input
                  id="theme-version"
                  bind:value={definition.version}
                  class={fieldClass}
                  placeholder="1.0.0"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="theme-description" class={labelClass}>Description</Label>
              <Textarea
                id="theme-description"
                bind:value={definition.description}
                class="min-h-16 resize-y border-theme-800 bg-theme-950 text-xs text-theme-50"
              />
            </div>
            <div
              class="flex items-start justify-between gap-3 rounded-md border border-theme-800 bg-theme-950 px-3 py-2.5"
            >
              <div class="space-y-0.5">
                <Label for="theme-nsfw" class="text-xs font-medium text-theme-100">
                  NSFW theme
                </Label>
                <p class="text-[10px] leading-relaxed text-muted-foreground">
                  Mark this theme as adult content. It will show an 18+ badge in the theme manager.
                </p>
              </div>
              <Checkbox
                id="theme-nsfw"
                class="mt-0.5"
                checked={definition.nsfw === true}
                onCheckedChange={(checked) => {
                  definition.nsfw = checked === true;
                }}
              />
            </div>
            <div class="space-y-1.5">
              <Label for="theme-accent" class={labelClass}>Accent</Label>
              <div class="flex items-center gap-2">
                <Input
                  type="color"
                  class="h-9 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                  bind:value={definition.accentColor}
                />
                <Input
                  id="theme-accent"
                  bind:value={definition.accentColor}
                  class="h-9 flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </section>

          <section class="space-y-3 border-t border-theme-800 pt-3">
            <h3 class="text-xs font-semibold text-theme-100">Background</h3>
            <div class="grid grid-cols-4 gap-1 rounded-md bg-black/30 p-1">
              {#each backgroundTypes as option (option.value)}
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 px-1 text-[10px] {definition.background.type === option.value
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'}"
                  aria-pressed={definition.background.type === option.value}
                  onclick={() => setBackgroundType(option.value)}
                >
                  {option.label}
                </Button>
              {/each}
            </div>

            {#if definition.background.type === 'gradient'}
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1.5">
                  <Label for="background-from" class={labelClass}>From</Label>
                  <div class="flex gap-1.5">
                    <Input
                      type="color"
                      class="h-9 w-9 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                      bind:value={definition.background.from}
                    />
                    <Input
                      id="background-from"
                      bind:value={definition.background.from}
                      class="h-9 flex-1 font-mono text-[10px]"
                    />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="background-to" class={labelClass}>To</Label>
                  <div class="flex gap-1.5">
                    <Input
                      type="color"
                      class="h-9 w-9 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                      bind:value={definition.background.to}
                    />
                    <Input
                      id="background-to"
                      bind:value={definition.background.to}
                      class="h-9 flex-1 font-mono text-[10px]"
                    />
                  </div>
                </div>
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label class={labelClass}>Angle</Label>
                  <span class="text-[10px] text-muted-foreground"
                    >{Math.round(definition.background.angle ?? 135)}°</span
                  >
                </div>
                <Slider
                  min={0}
                  max={360}
                  value={definition.background.angle ?? 135}
                  onValueChange={(value) => {
                    if (definition.background.type === 'gradient') {
                      definition.background.angle = value;
                    }
                  }}
                />
              </div>
            {:else if definition.background.type === 'color'}
              <div class="space-y-1.5">
                <Label for="background-color" class={labelClass}>Color</Label>
                <div class="flex gap-2">
                  <Input
                    type="color"
                    class="h-9 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                    bind:value={definition.background.color}
                  />
                  <Input
                    id="background-color"
                    bind:value={definition.background.color}
                    class="h-9 flex-1 font-mono text-xs"
                  />
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <Button
                  variant="secondary"
                  class="h-9 flex-1 gap-1.5 text-[10px]"
                  onclick={() => chooseBackground(definition.background.type as 'image' | 'video')}
                >
                  {#if definition.background.type === 'video'}
                    <Video class="size-3.5" />
                  {:else}
                    <ImageIcon class="size-3.5" />
                  {/if}
                  {definition.background.src ? 'Replace' : 'Choose'}
                </Button>
                <span class="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground">
                  {definition.background.src || 'No file selected'}
                </span>
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label class={labelClass}>Blur</Label>
                  <span class="text-[10px] text-muted-foreground"
                    >{Math.round(definition.background.blur ?? 0)}px</span
                  >
                </div>
                <Slider
                  min={0}
                  max={40}
                  value={definition.background.blur ?? 0}
                  onValueChange={(value) => {
                    if (
                      definition.background.type === 'image' ||
                      definition.background.type === 'video'
                    ) {
                      definition.background.blur = value;
                    }
                  }}
                />
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="background-fit"
                  checked={definition.background.fit === 'contain'}
                  onCheckedChange={(checked) => {
                    if (
                      definition.background.type === 'image' ||
                      definition.background.type === 'video'
                    ) {
                      definition.background.fit = checked ? 'contain' : 'cover';
                    }
                  }}
                />
                <Label for="background-fit" class="text-[10px] font-normal text-muted-foreground">
                  Fit inside the window instead of covering it
                </Label>
              </div>
              {#if definition.background.type === 'video'}
                <div
                  class="flex items-start gap-2 rounded-md border border-theme-800 bg-black/20 p-2"
                >
                  <Checkbox
                    id="background-muted"
                    class="mt-0.5"
                    checked={definition.background.muted !== false}
                    onCheckedChange={(checked) => {
                      if (definition.background.type === 'video') {
                        definition.background.muted = checked === true;
                      }
                    }}
                  />
                  <div class="space-y-0.5">
                    <Label for="background-muted" class="text-[10px] font-normal text-theme-100">
                      Mute background video
                    </Label>
                    <p class="text-[10px] leading-relaxed text-muted-foreground">
                      Unmuted videos may wait for a click before they start, because of autoplay
                      policies.
                    </p>
                  </div>
                </div>
                <p class="text-[10px] leading-relaxed text-muted-foreground">
                  Prefer <strong class="text-theme-100">WebM</strong> to keep theme downloads small. MP4,
                  MOV and M4V are accepted too.
                </p>
              {/if}
            {/if}
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <Label class={labelClass}>Background opacity</Label>
                <span class="text-[10px] text-muted-foreground"
                  >{Math.round((definition.background.opacity ?? 1) * 100)}%</span
                >
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={definition.background.opacity ?? 1}
                onValueChange={(value) => (definition.background.opacity = value)}
              />
            </div>
          </section>

          <section class="space-y-3 border-t border-theme-800 pt-3">
            <h3 class="flex items-center gap-1.5 text-xs font-semibold text-theme-100">
              <Sparkles class="size-3.5 text-primary" />
              Overlay & effects
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label class={labelClass}>Dim</Label>
                  <span class="text-[10px] text-muted-foreground"
                    >{Math.round((definition.overlay?.opacity ?? 0) * 100)}%</span
                  >
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={definition.overlay.opacity ?? 0}
                  onValueChange={(value) => (definition.overlay.opacity = value)}
                />
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label class={labelClass}>Vignette</Label>
                  <span class="text-[10px] text-muted-foreground"
                    >{Math.round((definition.overlay?.vignette ?? 0) * 100)}%</span
                  >
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={definition.overlay.vignette ?? 0}
                  onValueChange={(value) => (definition.overlay.vignette = value)}
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="overlay-color" class={labelClass}>Overlay color</Label>
              <div class="flex items-center gap-2">
                <Input
                  type="color"
                  class="h-9 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                  bind:value={definition.overlay.color}
                />
                <Input
                  id="overlay-color"
                  bind:value={definition.overlay.color}
                  class="h-9 flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="effects-type" class={labelClass}>Particles</Label>
              <Select.Root
                type="single"
                value={definition.effects.type}
                onValueChange={(value) => {
                  if (value) {
                    definition.effects.type = value as ThemeV2Definition['effects']['type'];
                  }
                }}
              >
                <Select.Trigger
                  id="effects-type"
                  class="h-9 border-theme-800 bg-theme-950 text-xs text-theme-50"
                >
                  {effectTypes.find((option) => option.value === definition.effects.type)?.label}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each effectTypes as option (option.value)}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            {#if definition.effects.type !== 'none'}
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <Label class={labelClass}>Density</Label>
                    <span class="text-[10px] text-muted-foreground"
                      >{definition.effects.density ?? 30}</span
                    >
                  </div>
                  <Slider
                    min={0}
                    max={120}
                    value={definition.effects.density ?? 30}
                    onValueChange={(value) => (definition.effects.density = value)}
                  />
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <Label class={labelClass}>Speed</Label>
                    <span class="text-[10px] text-muted-foreground"
                      >{(definition.effects.speed ?? 1).toFixed(1)}×</span
                    >
                  </div>
                  <Slider
                    min={0.2}
                    max={3}
                    step={0.1}
                    value={definition.effects.speed ?? 1}
                    onValueChange={(value) => (definition.effects.speed = value)}
                  />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="effects-color" class={labelClass}>Particle color</Label>
                <div class="flex items-center gap-2">
                  <Input
                    type="color"
                    class="h-9 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
                    bind:value={definition.effects.color}
                  />
                  <Input
                    id="effects-color"
                    bind:value={definition.effects.color}
                    class="h-9 flex-1 font-mono text-xs"
                  />
                </div>
              </div>
            {/if}
          </section>

          <section class="space-y-3 border-t border-theme-800 pt-3">
            <h3 class="flex items-center gap-1.5 text-xs font-semibold text-theme-100">
              <Type class="size-3.5 text-primary" />
              Typography
            </h3>
            <div class="space-y-1.5">
              <Label for="font-body" class={labelClass}>Launcher font</Label>
              <Select.Root
                type="single"
                value={definition.typography.body ?? 'Sora Variable'}
                onValueChange={(value) => {
                  if (value) definition.typography.body = value;
                }}
              >
                <Select.Trigger
                  id="font-body"
                  class="h-9 border-theme-800 bg-theme-950 text-xs text-theme-50"
                >
                  {definition.typography.body ?? 'Sora Variable'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each fontOptions as font (font.family)}
                    <Select.Item value={font.family} label={`${font.label} · ${font.category}`} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <div class="space-y-1.5">
              <Label for="font-heading" class={labelClass}>Heading font</Label>
              <Select.Root
                type="single"
                value={definition.typography.heading ?? 'Sora Variable'}
                onValueChange={(value) => {
                  if (value) definition.typography.heading = value;
                }}
              >
                <Select.Trigger
                  id="font-heading"
                  class="h-9 border-theme-800 bg-theme-950 text-xs text-theme-50"
                >
                  {definition.typography.heading ?? 'Sora Variable'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each fontOptions as font (font.family)}
                    <Select.Item value={font.family} label={`${font.label} · ${font.category}`} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <Button variant="secondary" class="h-8 gap-1.5 text-[10px]" onclick={openFontBrowser}>
                <Search class="size-3.5" />
                Browse fonts
              </Button>
              <Button variant="secondary" class="h-8 gap-1.5 text-[10px]" onclick={importFont}>
                <Upload class="size-3.5" />
                Import file
              </Button>
            </div>
            {#if customFonts.length > 0}
              <div class="space-y-1">
                {#each customFonts as font (`${font.family}-${font.src}-${font.weight ?? '400'}-${font.style ?? 'normal'}`)}
                  <div
                    class="flex items-center gap-2 rounded-md border border-theme-800 bg-black/20 p-2"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[11px] font-medium text-theme-100">{font.family}</p>
                      <p class="truncate font-mono text-[9px] text-muted-foreground">
                        {font.weight ?? '400'} · {font.style ?? 'normal'} · {font.src}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-7 text-muted-foreground hover:text-destructive"
                      title="Remove font"
                      onclick={() => removeFont(font)}
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
            <p class="text-[10px] leading-relaxed text-muted-foreground">
              Browse every Fontsource family, or import your own WOFF2, WOFF, TTF or OTF file.
              Downloaded fonts are bundled into the theme when you save.
            </p>
          </section>

          <section class="space-y-3 border-t border-theme-800 pt-3">
            <h3 class="flex items-center gap-1.5 text-xs font-semibold text-theme-100">
              <Music class="size-3.5 text-primary" />
              Music
            </h3>
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                class="h-8 flex-1 gap-1.5 text-[10px]"
                onclick={chooseAudio}
              >
                <Upload class="size-3.5" />
                {definition.audio?.src ? 'Replace' : 'Choose music'}
              </Button>
              <span class="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground">
                {definition.audio?.src || 'Optional MP3, OGG, WAV, M4A or FLAC'}
              </span>
              {#if definition.audio}
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-muted-foreground"
                  title="Remove music"
                  onclick={() => (definition.audio = undefined)}
                >
                  <X class="size-3.5" />
                </Button>
              {/if}
            </div>
            {#if definition.audio}
              <div class="flex items-center gap-2">
                <Checkbox
                  id="audio-loop"
                  checked={definition.audio.loop !== false}
                  onCheckedChange={(checked) => {
                    if (definition.audio) definition.audio.loop = checked === true;
                  }}
                />
                <Label for="audio-loop" class="text-[10px] font-normal text-muted-foreground">
                  Loop the music. Playback uses the title bar volume control.
                </Label>
              </div>
            {/if}
          </section>

          <section class="space-y-3 border-t border-theme-800 pt-3">
            <h3 class="flex items-center gap-1.5 text-xs font-semibold text-theme-100">
              <Code2 class="size-3.5 text-primary" />
              Custom CSS
            </h3>
            <Textarea
              class="min-h-28 resize-y border-theme-800 bg-theme-950 font-mono text-[10px] text-theme-50"
              spellcheck="false"
              placeholder={':root { --radius: 1rem; }'}
              bind:value={definition.css}
            />
            <p class="text-[10px] text-muted-foreground">
              Applied after the launcher styles. Keep it scoped where possible.
            </p>
          </section>
        </div>
      {/if}
    </aside>

    <main class="flex min-h-0 min-w-0 flex-col bg-theme-900/50">
      <div
        class="flex h-10 shrink-0 items-center justify-between border-b border-theme-800 px-4 text-[10px] text-muted-foreground"
      >
        <span class="flex items-center gap-2">
          <span class="size-1.5 rounded-full bg-emerald-400"></span>
          Launcher home · live canvas
        </span>
        <span class="font-mono">{Math.round(canvasScale * 100)}%</span>
      </div>
      <div
        class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
        style="background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0);background-size:24px 24px;"
        bind:this={canvasHost}
        role="presentation"
      >
        {#if loading}
          <div class="flex flex-col items-center gap-3 text-muted-foreground">
            <LoaderCircle class="size-6 animate-spin" />
            <span class="text-xs">Opening theme…</span>
          </div>
        {:else}
          <div
            class="relative overflow-hidden rounded-xl border border-theme-700 shadow-2xl"
            style="width:{1000 * canvasScale}px;height:{650 * canvasScale}px;"
          >
            <div
              style="width:1000px;height:650px;transform:scale({canvasScale});transform-origin:top left;"
            >
              <ThemeStage
                {definition}
                assets={assetBase}
                assetOverrides={previewAssets}
                {selectedId}
                interactive
                scale={canvasScale}
                onselect={(id) => (selectedId = id)}
                onpatch={(id, patch) => patchElement(id, patch)}
              />
            </div>
          </div>
        {/if}
      </div>
      <div
        class="flex h-8 shrink-0 items-center justify-between border-t border-theme-800 px-4 text-[9px] text-muted-foreground"
      >
        <span>Drag layers on the canvas. Corner handles resize. Shift+arrows nudges 10px.</span>
        <span class="font-mono">{elements.length} elements</span>
      </div>
    </main>

    <aside class="flex min-h-0 flex-col border-l border-theme-800 bg-theme-900/35">
      {#if selectedElement}
        <div class="flex shrink-0 items-center gap-1 border-b border-theme-800 p-2">
          <Button
            variant="secondary"
            size="sm"
            class="h-8 flex-1 px-2 text-[10px]"
            onclick={duplicateSelected}
          >
            <Copy class="size-3.5" />
            Duplicate
          </Button>
          <Button
            variant="secondary"
            size="icon"
            class="size-8"
            title="Bring forward"
            onclick={() => moveSelected(1)}
            disabled={selectedIndex === elements.length - 1}
          >
            <ChevronUp class="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            class="size-8"
            title="Send backward"
            onclick={() => moveSelected(-1)}
            disabled={selectedIndex === 0}
          >
            <ChevronDown class="size-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            class="size-8"
            title="Delete layer"
            onclick={deleteSelected}
          >
            <Trash2 class="size-3.5" />
          </Button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <ThemeElementInspector
            element={selectedElement}
            {fontOptions}
            onreplace={replaceSelectedAsset}
          />
        </div>
      {:else}
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <div class="rounded-xl border border-theme-800 bg-black/20 p-4 text-center">
            <div
              class="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <MousePointer2 class="size-5" />
            </div>
            <p class="mt-3 text-xs font-semibold text-theme-100">Select a layer</p>
            <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Click any layer on the canvas or in the layer list to edit its position, size and
              style. Nothing is selected right now.
            </p>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={addText}
            >
              <Type class="size-4 text-primary" />
              Text
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addMedia('image')}
            >
              <ImageIcon class="size-4 text-primary" />
              Image
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addMedia('video')}
            >
              <Video class="size-4 text-primary" />
              Video
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={addShape}
            >
              <Shapes class="size-4 text-primary" />
              Shape
            </Button>
          </div>

          <div class="mt-4 space-y-2 rounded-lg border border-theme-800 bg-black/20 p-3">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Theme summary
            </p>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-muted-foreground">Background</span>
              <span class="capitalize text-theme-100">{definition.background.type}</span>
            </div>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-muted-foreground">Elements</span>
              <span class="text-theme-100">{elements.length}</span>
            </div>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-muted-foreground">Fonts</span>
              <span class="text-theme-100">{(definition.fonts ?? []).length} custom</span>
            </div>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-muted-foreground">Folder</span>
              <span class="max-w-[150px] truncate font-mono text-theme-100">
                {savedFolder ?? 'not saved yet'}
              </span>
            </div>
          </div>

          <div
            class="mt-4 rounded-lg border border-theme-800 bg-black/20 p-3 text-[10px] leading-relaxed text-muted-foreground"
          >
            <p class="mb-1 font-semibold text-theme-100">Shortcuts</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+Z</span> undo</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+Shift+Z</span> redo</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+S</span> save theme</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+D</span> duplicate layer</p>
            <p><span class="font-mono text-theme-100">Arrows</span> nudge selected layer</p>
            <p><span class="font-mono text-theme-100">Delete</span> remove selected layer</p>
          </div>

          <Button class="mt-4 w-full" onclick={() => saveTheme()} disabled={saving || loading}>
            {#if saving}
              <LoaderCircle class="animate-spin" />
            {:else}
              <Save />
            {/if}
            Save and apply
          </Button>
        </div>
      {/if}
    </aside>
  </div>

  <footer
    class="flex h-7 shrink-0 items-center justify-between border-t border-theme-800 bg-black/40 px-4 text-[9px] text-muted-foreground"
  >
    <span class="flex items-center gap-1.5">
      <span class="size-1.5 rounded-full bg-primary"></span>
      Changes are local until you save. WebM is recommended for video backgrounds and layers.
    </span>
    <span>API 2.0 · advanced editor</span>
  </footer>
</div>
