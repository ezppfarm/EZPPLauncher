<script lang="ts">
  import Logo from '$assets/logo.png';
  import FontPreview from '$lib/components/theme/FontPreview.svelte';
  import ThemeBehaviorInspector from '$lib/components/theme/ThemeBehaviorInspector.svelte';
  import ThemeElementInspector from '$lib/components/theme/ThemeElementInspector.svelte';
  import ThemeGroupInspector from '$lib/components/theme/ThemeGroupInspector.svelte';
  import ThemeIcon from '$lib/components/theme/ThemeIcon.svelte';
  import ThemeLogicBadge from '$lib/components/theme/ThemeLogicBadge.svelte';
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import ThemeStage from '$lib/components/theme/ThemeStage.svelte';
  import ThemeVariableDefaults from '$lib/components/theme/ThemeVariableDefaults.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
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
  import {
    THEME_CLOCK_VARIABLE_NAMES,
    isThemeClockVariable,
    themeClockValues,
  } from '$lib/themeClock';
  import {
    BUNDLED_THEME_FONTS,
    bundledThemeFontFamily,
    fontStack,
    type ThemeFontChoice,
  } from '$lib/themeFonts';
  import { THEME_ICON_PREVIEW_NAMES, THEME_ICON_SETS } from '$lib/themeIcons';
  import {
    themeBehaviorSummary,
    themeBehaviorTargetLabel,
    themeElementLabel,
    themeGroupContainsElement,
    themeGroupInteractiveCount,
  } from '$lib/themeLogic';
  import { renderThemePreview } from '$lib/themePreview';
  import { themeScriptInitialVariables, themeScriptVariableNames } from '$lib/themeScript';
  import {
    formatThemeScriptError,
    parseThemeScript,
    themeScriptProgramCanLeaveLauncher,
    themeScriptProgramReferences,
  } from '$lib/themeScriptLang';
  import { analyzeThemeSvelteSource } from '$lib/themeSvelte';
  import {
    createDefaultThemeV2,
    createThemeV2Behavior,
    createThemeV2Element,
    normalizeThemeV2,
    themeAssetName,
    type ThemeV2Asset,
    type ThemeV2BehaviorTarget,
    type ThemeV2Definition,
    type ThemeV2Element,
    type ThemeV2Font,
    type ThemeV2Group,
    type ThemeV2ImageElement,
    type ThemeV2LottieElement,
    type ThemeV2ScriptValue,
    type ThemeV2VideoElement,
  } from '$lib/themeV2';
  import {
    exportThemeFolder,
    saveThemeProject,
    themeAssetBase,
    themesDirectory,
    toSafeName,
  } from '$lib/themes';
  import { formatBytes } from '$lib/utils';
  import {
    AlertTriangle,
    Boxes,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ChevronsDown,
    ChevronsUp,
    ClipboardPaste,
    Clock,
    Code2,
    Component,
    Copy,
    CopyPlus,
    Download,
    Eye,
    EyeOff,
    Film,
    Gauge,
    GripVertical,
    Hand,
    Image as ImageIcon,
    Keyboard,
    Layers,
    LoaderCircle,
    Lock,
    Maximize2,
    Megaphone,
    Minus,
    MousePointer2,
    MousePointerClick,
    Music,
    Plus,
    Redo2,
    RefreshCw,
    Repeat,
    Save,
    Scissors,
    Search,
    Shapes,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Spline,
    Timer,
    Trash2,
    Type,
    Undo2,
    Ungroup,
    Unlock,
    Upload,
    Video,
    X,
    Zap,
  } from '@lucide/svelte';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
  import * as path from '@tauri-apps/api/path';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open, save as saveDialog } from '@tauri-apps/plugin-dialog';
  import * as fs from '@tauri-apps/plugin-fs';
  import { sileo } from 'sileo';
  import { onMount, tick } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  type ThemeEditorContext = {
    folderName?: string | null;
    folderPath?: string | null;
    themeJson?: string | null;
  };

  type ThemeEditorDraft = {
    definition: ThemeV2Definition;
    pickedAssets: ThemeV2Asset[];
    savedFolder?: string;
    savedAt: number;
  };

  type ThemeValidationIssue = {
    level: 'error' | 'warning';
    message: string;
  };

  type ThemeValidationReport = {
    issues: ThemeValidationIssue[];
    totalBytes: number;
    fileCount: number;
    checkedAt: number;
  };

  type AssetKind = 'image' | 'video' | 'audio' | 'font' | 'lottie';

  type LayerClipboard = {
    groups: ThemeV2Group[];
    elements: ThemeV2Element[];
  };

  type LayerRow =
    | { kind: 'group'; group: ThemeV2Group; depth: number }
    | { kind: 'element'; element: ThemeV2Element; depth: number };

  type LayerDragItem = { kind: 'element' | 'group'; id: string };

  type LayerDropTarget =
    | { mode: 'inside'; groupId: string }
    | { mode: 'between'; elementId: string; position: 'above' | 'below' }
    | { mode: 'root' };

  const labelClass = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const fieldClass = 'h-9 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const shortcutRows: { label: string; keys: string[] }[] = [
    { label: 'Save theme', keys: ['Cmd/Ctrl', 'S'] },
    { label: 'Undo', keys: ['Cmd/Ctrl', 'Z'] },
    { label: 'Redo', keys: ['Cmd/Ctrl', 'Shift', 'Z'] },
    { label: 'Find layers and groups', keys: ['Cmd/Ctrl', 'F'] },
    { label: 'Zoom canvas in / out', keys: ['Cmd/Ctrl', '+ / -'] },
    { label: 'Fit canvas to window', keys: ['Cmd/Ctrl', '0'] },
    { label: 'Copy / cut / paste', keys: ['Cmd/Ctrl', 'C / X / V'] },
    { label: 'Duplicate layer or group', keys: ['Cmd/Ctrl', 'D'] },
    { label: 'Select all layers', keys: ['Cmd/Ctrl', 'A'] },
    { label: 'Group or ungroup selection', keys: ['Cmd/Ctrl', 'G'] },
    { label: 'Add to selection', keys: ['Shift/Cmd', 'Click'] },
    { label: 'Nudge selected layers', keys: ['Arrows'] },
    { label: 'Nudge by 10px', keys: ['Shift', 'Arrows'] },
    { label: 'Reorder selected layer', keys: ['Cmd/Ctrl', '↑ / ↓'] },
    { label: 'Jump to linked logic', keys: ['Alt/Option', '↑ / ↓'] },
    { label: 'Delete selection', keys: ['Delete'] },
    { label: 'Clear selection / close dialog', keys: ['Escape'] },
    { label: 'Show this shortcut list', keys: ['?'] },
  ];

  let definition = $state<ThemeV2Definition>(createDefaultThemeV2());
  let pickedAssets = $state<ThemeV2Asset[]>([]);
  let assetBase = $state('');
  let savedFolder = $state<string | undefined>(undefined);
  let editorFolderPath = $state<string | undefined>(undefined);
  let loading = $state(true);
  let saving = $state(false);
  let exporting = $state(false);
  let selectedIds = $state<string[]>([]);
  let selectedGroupId = $state<string | undefined>(undefined);
  let selectedBehaviorId = $state<string | undefined>(undefined);
  let logicQuery = $state('');
  let layerClipboard = $state<LayerClipboard | undefined>(undefined);
  let pasteSerial = 0;
  let leftTab = $state<'layers' | 'theme' | 'fonts' | 'logic'>('layers');
  let layerQuery = $state('');
  let layerSearchInput = $state<HTMLInputElement | null>(null);
  let layerListHost = $state<HTMLDivElement | null>(null);
  let shortcutsOpen = $state(false);
  let logicFocusKey = $state('');
  let logicFocusToken = $state(0);
  let canvasHost = $state<HTMLDivElement | undefined>(undefined);
  let canvasFitScale = $state(0.8);
  let canvasZoom = $state(1);
  let canvasPanX = $state(0);
  let canvasPanY = $state(0);
  let panMode = $state(false);
  let panning = $state(false);
  let panStart = { x: 0, y: 0, panX: 0, panY: 0 };
  const canvasScale = $derived(canvasFitScale * canvasZoom);
  let statusMessage = $state('Ready');
  let renamingId = $state<string | undefined>(undefined);
  let draggingLayer = $state<LayerDragItem | undefined>(undefined);
  let dropTarget = $state<LayerDropTarget | undefined>(undefined);
  let lastSavedKey = $state('');
  let draftSavedAt = $state<number | undefined>(undefined);
  let recoverableDraft = $state<ThemeEditorDraft | undefined>(undefined);
  let closeDialogOpen = $state(false);
  let allowClose = false;
  let validationReport = $state<ThemeValidationReport | undefined>(undefined);
  let validationOpen = $state(false);
  let exportAfterValidation = $state(false);

  let contextMenuOpen = $state(false);
  let layerContextMenuOpen = $state(false);
  let contextMenuTargetId = $state<string | undefined>(undefined);
  let contextMenuGroupId = $state<string | undefined>(undefined);
  let deleteGroupId = $state<string | undefined>(undefined);

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
  const groups = $derived(definition.groups ?? []);
  const behaviors = $derived(definition.behaviors ?? []);
  const logicBadges = $derived.by(() => {
    const badges = new SvelteMap<string, { count: number; warning: boolean }>();

    for (const behavior of behaviors) {
      const target = behavior.target;
      if (!target) continue;

      const key = `${target.type}:${target.id}`;
      const badge = badges.get(key) ?? { count: 0, warning: false };
      badge.count += 1;

      const pointerTrigger =
        behavior.trigger.type === 'click' ||
        behavior.trigger.type === 'hover' ||
        behavior.trigger.type === 'leave';
      if (pointerTrigger) {
        const interactive =
          target.type === 'element'
            ? elements.some((element) => element.id === target.id && element.interactive === true)
            : themeGroupInteractiveCount(groups, elements, target.id) > 0;
        if (!interactive) badge.warning = true;
      }

      badges.set(key, badge);
    }

    return badges;
  });
  const filteredBehaviors = $derived.by(() => {
    const query = logicQuery.trim().toLowerCase();
    if (!query) return behaviors;
    return behaviors.filter((behavior) => {
      const haystack = [
        behavior.name ?? '',
        themeBehaviorTargetLabel(behavior.target, elements, groups),
        themeBehaviorSummary(behavior, elements, groups),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });
  const scriptVariables = $derived([
    ...new Set<string>([...THEME_CLOCK_VARIABLE_NAMES, ...themeScriptVariableNames(definition)]),
  ]);
  const editableScriptVariables = $derived(
    scriptVariables.filter((name) => !isThemeClockVariable(name))
  );
  let previewClock = $state(Date.now());
  $effect(() => {
    const handle = setInterval(() => (previewClock = Date.now()), 1000);
    return () => clearInterval(handle);
  });
  const previewScriptVariables = $derived({
    ...themeScriptInitialVariables(definition),
    ...themeClockValues(new Date(previewClock)),
  });
  const selectedGroup = $derived(
    selectedGroupId ? groups.find((group) => group.id === selectedGroupId) : undefined
  );
  const selectedBehavior = $derived(
    selectedBehaviorId
      ? behaviors.find((behavior) => behavior.id === selectedBehaviorId)
      : undefined
  );
  function buildLayerRows(includeCollapsed: boolean): LayerRow[] {
    const groupIds = new SvelteSet(groups.map((group) => group.id));
    const elementOrder = new SvelteMap(elements.map((element, index) => [element.id, index]));
    const parentElement = (element: ThemeV2Element) =>
      element.groupId && groupIds.has(element.groupId) ? element.groupId : undefined;
    const parentGroup = (group: ThemeV2Group) =>
      group.parentId && groupIds.has(group.parentId) ? group.parentId : undefined;

    const groupZ = (groupId: string, stack = new SvelteSet<string>()): number => {
      if (stack.has(groupId)) return -1;
      stack.add(groupId);
      let top = -1;
      for (const element of elements) {
        if (parentElement(element) === groupId) {
          top = Math.max(top, elementOrder.get(element.id) ?? -1);
        }
      }
      for (const group of groups) {
        if (parentGroup(group) === groupId) top = Math.max(top, groupZ(group.id, stack));
      }
      return top;
    };

    const entriesFor = (parentId: string | undefined) => {
      const groupEntries = groups
        .filter((group) => parentGroup(group) === parentId)
        .map((group) => ({ kind: 'group' as const, group }));
      const elementEntries = elements
        .filter((element) => parentElement(element) === parentId)
        .map((element) => ({ kind: 'element' as const, element }));

      return [...groupEntries, ...elementEntries].sort((a, b) => {
        const aZ = a.kind === 'group' ? groupZ(a.group.id) : (elementOrder.get(a.element.id) ?? -1);
        const bZ = b.kind === 'group' ? groupZ(b.group.id) : (elementOrder.get(b.element.id) ?? -1);
        return bZ - aZ;
      });
    };

    const rows: LayerRow[] = [];
    const addEntries = (parentId: string | undefined, depth: number) => {
      for (const entry of entriesFor(parentId)) {
        if (entry.kind === 'group') {
          rows.push({ kind: 'group', group: entry.group, depth });
          if (includeCollapsed || !entry.group.collapsed) addEntries(entry.group.id, depth + 1);
        } else {
          rows.push({ kind: 'element', element: entry.element, depth });
        }
      }
    };
    addEntries(undefined, 0);
    return rows;
  }

  const layerRows = $derived.by(() => buildLayerRows(false));
  const layerRowKey = (row: LayerRow) =>
    row.kind === 'group' ? `g:${row.group.id}` : `e:${row.element.id}`;
  const layerRowMatches = (row: LayerRow, query: string) => {
    const haystack =
      row.kind === 'group'
        ? groupLabel(row.group)
        : `${elementLabel(row.element)} ${row.element.name ?? ''} ${row.element.type}`;
    return haystack.toLowerCase().includes(query);
  };
  const layerSearchQuery = $derived(layerQuery.trim().toLowerCase());
  const layerSearchActive = $derived(layerSearchQuery.length > 0);
  const layerSearchMatchCount = $derived.by(() => {
    if (!layerSearchActive) return 0;
    return buildLayerRows(true).filter((row) => layerRowMatches(row, layerSearchQuery)).length;
  });
  const visibleLayerRows = $derived.by(() => {
    if (!layerSearchActive) return layerRows;

    const allRows = buildLayerRows(true);
    const byKey = new SvelteMap(allRows.map((row) => [layerRowKey(row), row]));
    const matches = new SvelteSet(
      allRows.filter((row) => layerRowMatches(row, layerSearchQuery)).map((row) => layerRowKey(row))
    );
    const visible = new SvelteSet(matches);

    // A matching group is shown with its full contents, so the expanded chevron is accurate.
    for (const row of allRows) {
      let parentId = row.kind === 'group' ? row.group.parentId : row.element.groupId;
      const seen = new SvelteSet<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        if (matches.has(`g:${parentId}`)) {
          visible.add(layerRowKey(row));
          break;
        }
        const parent = byKey.get(`g:${parentId}`);
        parentId = parent?.kind === 'group' ? parent.group.parentId : undefined;
      }
    }

    // Keep the ancestors of each match visible so the list still shows hierarchy.
    for (const key of [...visible]) {
      const row = byKey.get(key);
      let parentId = row?.kind === 'group' ? row.group.parentId : row?.element.groupId;
      const seen = new SvelteSet<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parentKey = `g:${parentId}`;
        if (visible.has(parentKey)) break;
        visible.add(parentKey);
        const parent = byKey.get(parentKey);
        parentId = parent?.kind === 'group' ? parent.group.parentId : undefined;
      }
    }

    return allRows.filter((row) => visible.has(layerRowKey(row)));
  });
  const anyGroupExpanded = $derived(groups.some((group) => !group.collapsed));
  const logicTargets = $derived.by(() =>
    buildLayerRows(true)
      .map((row) =>
        row.kind === 'group'
          ? { type: 'group' as const, id: row.group.id }
          : { type: 'element' as const, id: row.element.id }
      )
      .filter((target) => (logicBadges.get(`${target.type}:${target.id}`)?.count ?? 0) > 0)
  );
  const currentLogicTargetIndex = $derived(
    logicTargets.findIndex((target) =>
      target.type === 'group'
        ? target.id === selectedGroupId
        : selectedIds.length === 1 && target.id === selectedIds[0]
    )
  );
  const selectedSet = $derived(new SvelteSet(selectedIds));
  const selectedElements = $derived(elements.filter((element) => selectedSet.has(element.id)));
  const movableSelectedElements = $derived(
    selectedElements.filter((element) => !element.locked && !isElementLockedByGroups(element))
  );
  const selectedIndex = $derived(
    selectedIds.length === 1 ? elements.findIndex((element) => element.id === selectedIds[0]) : -1
  );
  const selectedElement = $derived(selectedIndex >= 0 ? elements[selectedIndex] : undefined);
  const contextMenuSelection = $derived(contextMenuTargetId ? selectedElements : []);
  const contextMenuGroup = $derived(
    contextMenuGroupId ? groups.find((group) => group.id === contextMenuGroupId) : undefined
  );
  const deleteGroupTarget = $derived(
    deleteGroupId ? groups.find((group) => group.id === deleteGroupId) : undefined
  );
  const deleteGroupIds = $derived(
    deleteGroupTarget ? collectGroupIds(deleteGroupTarget.id) : new SvelteSet<string>()
  );
  const deleteGroupLayerCount = $derived(
    elements.filter((element) => element.groupId && deleteGroupIds.has(element.groupId)).length
  );
  const deleteGroupNestedCount = $derived(Math.max(0, deleteGroupIds.size - 1));
  const deleteGroupLayerLabel = $derived(
    `${deleteGroupLayerCount} layer${deleteGroupLayerCount === 1 ? '' : 's'}`
  );
  const deleteGroupNestedLabel = $derived(
    `${deleteGroupNestedCount} nested group${deleteGroupNestedCount === 1 ? '' : 's'}`
  );
  const contextMenuAllHidden = $derived(
    contextMenuSelection.length > 0 && contextMenuSelection.every((element) => element.hidden)
  );
  const contextMenuAllLocked = $derived(
    contextMenuSelection.length > 0 && contextMenuSelection.every((element) => element.locked)
  );
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
  const selectedFontBundledFamily = $derived(
    selectedFontsource ? bundledThemeFontFamily(selectedFontsource.family) : undefined
  );
  const selectedFontIsBundled = $derived(selectedFontBundledFamily !== undefined);
  const selectedFontsourceOptions = $derived({
    weight: Number(fontWeight),
    style: fontStyle,
    subset: fontSubset,
  });
  const selectedFontPreviewUrl = $derived(
    selectedFontsource && !selectedFontIsBundled
      ? fontsourceFontUrl(selectedFontsource, selectedFontsourceOptions)
      : ''
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
    if (!selectedFontsource || fontDownloading || selectedFontIsAdded || selectedFontIsBundled)
      return;
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

  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 650;
  const CANVAS_MIN_SCALE = 0.1;
  const CANVAS_MAX_SCALE = 5;
  const CANVAS_ZOOM_STEP = 1.2;

  const updateCanvasScale = () => {
    if (!canvasHost) return;
    const rect = canvasHost.getBoundingClientRect();
    canvasFitScale = Math.max(
      0.25,
      Math.min((rect.width - 56) / CANVAS_WIDTH, (rect.height - 56) / CANVAS_HEIGHT)
    );
  };

  function zoomCanvasAt(focusX: number, focusY: number, nextScale: number) {
    if (!canvasHost) return;
    const rect = canvasHost.getBoundingClientRect();
    const currentScale = canvasScale;
    const clampedScale = Math.max(CANVAS_MIN_SCALE, Math.min(CANVAS_MAX_SCALE, nextScale));
    if (Math.abs(clampedScale - currentScale) < 0.0001) return;

    // Keep the canvas point under the cursor fixed while the scale changes.
    const canvasX =
      (focusX - rect.width / 2 - canvasPanX + (CANVAS_WIDTH * currentScale) / 2) / currentScale;
    const canvasY =
      (focusY - rect.height / 2 - canvasPanY + (CANVAS_HEIGHT * currentScale) / 2) / currentScale;
    canvasPanX =
      focusX - rect.width / 2 - canvasX * clampedScale + (CANVAS_WIDTH * clampedScale) / 2;
    canvasPanY =
      focusY - rect.height / 2 - canvasY * clampedScale + (CANVAS_HEIGHT * clampedScale) / 2;
    canvasZoom = clampedScale / canvasFitScale;
  }

  function zoomCanvasBy(factor: number) {
    if (!canvasHost) {
      canvasZoom = Math.max(
        CANVAS_MIN_SCALE / canvasFitScale,
        Math.min(CANVAS_MAX_SCALE / canvasFitScale, canvasZoom * factor)
      );
      return;
    }
    const rect = canvasHost.getBoundingClientRect();
    zoomCanvasAt(rect.width / 2, rect.height / 2, canvasScale * factor);
  }

  function resetCanvasViewState() {
    canvasZoom = 1;
    canvasPanX = 0;
    canvasPanY = 0;
    panMode = false;
    panning = false;
  }

  function resetCanvasView() {
    resetCanvasViewState();
    updateCanvasScale();
    statusMessage = 'Canvas fit to window';
  }

  function handleCanvasWheel(event: WheelEvent) {
    if (!canvasHost) return;
    event.preventDefault();
    const rect = canvasHost.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomCanvasAt(event.clientX - rect.left, event.clientY - rect.top, canvasScale * factor);
      return;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
    canvasPanX -= event.deltaX * unit;
    canvasPanY -= event.deltaY * unit;
  }

  function startCanvasPan(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    panning = true;
    panStart = { x: event.clientX, y: event.clientY, panX: canvasPanX, panY: canvasPanY };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function moveCanvasPan(event: PointerEvent) {
    if (!panning) return;
    canvasPanX = panStart.panX + (event.clientX - panStart.x);
    canvasPanY = panStart.panY + (event.clientY - panStart.y);
  }

  function endCanvasPan(event: PointerEvent) {
    if (!panning) return;
    panning = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  const ensureDefaults = (theme: ThemeV2Definition): ThemeV2Definition => ({
    ...theme,
    typography: {
      body: theme.typography?.body ?? 'Sora Variable',
      heading: theme.typography?.heading ?? theme.typography?.body ?? 'Sora Variable',
      ...(theme.typography?.mono ? { mono: theme.typography.mono } : {}),
    },
    fonts: theme.fonts ?? [],
    elements: theme.elements ?? [],
    groups: theme.groups ?? [],
  });

  type EditorSnapshot = {
    definition: ThemeV2Definition;
    pickedAssets: ThemeV2Asset[];
  };

  const HISTORY_LIMIT = 100;
  const HISTORY_DELAY = 450;
  const DRAFT_KEY = 'ezpplauncher.theme-editor.draft.v1';
  const DRAFT_DELAY = 800;

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
  const dirty = $derived(
    !loading && Boolean(lastSavedKey) && snapshotKey(captureSnapshot()) !== lastSavedKey
  );

  $effect(() => {
    const searching = layerSearchActive;
    if (searching || leftTab !== 'layers') return;
    const key = selectedGroupId
      ? `g:${selectedGroupId}`
      : selectedIds[0]
        ? `e:${selectedIds[0]}`
        : '';
    if (!key || !layerListHost) return;
    const host = layerListHost;
    requestAnimationFrame(() => {
      host
        .querySelector<HTMLElement>(`[data-layer-key="${key}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  });

  function readDraft(): ThemeEditorDraft | undefined {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as ThemeEditorDraft;
      if (!parsed || typeof parsed !== 'object' || !parsed.definition) return undefined;
      if (!Array.isArray(parsed.pickedAssets) || typeof parsed.savedAt !== 'number') {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage can be unavailable in restricted webviews; autosave is optional.
    }
    draftSavedAt = undefined;
  }

  function restoreDraft() {
    if (!recoverableDraft) return;
    definition = ensureDefaults(normalizeThemeV2(recoverableDraft.definition));
    pickedAssets = recoverableDraft.pickedAssets.map((asset) => ({ ...asset }));
    selectedIds = [];
    selectedGroupId = undefined;
    recoverableDraft = undefined;
    resetHistory();
    statusMessage = 'Draft restored';
  }

  function discardDraft() {
    recoverableDraft = undefined;
    clearDraft();
    statusMessage = 'Draft discarded';
  }

  $effect(() => {
    const current = captureSnapshot();
    const key = snapshotKey(current);
    if (loading || !lastSavedKey || !definition.name) return;

    if (key === lastSavedKey) {
      // Keep a draft that is waiting to be restored; only clear drafts that
      // belong to the already-saved state.
      if (!recoverableDraft) clearDraft();
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const draft: ThemeEditorDraft = {
          definition: current.definition,
          pickedAssets: current.pickedAssets,
          savedFolder,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        draftSavedAt = draft.savedAt;
      } catch {
        // Ignore quota errors; the explicit save button still works.
      }
    }, DRAFT_DELAY);

    return () => window.clearTimeout(timer);
  });

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
    selectedIds = selectedIds.filter((id) =>
      definition.elements?.some((element) => element.id === id)
    );
    selectedGroupId = definition.groups?.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : undefined;
    selectedBehaviorId = definition.behaviors?.some(
      (behavior) => behavior.id === selectedBehaviorId
    )
      ? selectedBehaviorId
      : undefined;
  }

  function selectElement(id: string | undefined, additive = false) {
    selectedGroupId = undefined;
    selectedBehaviorId = undefined;
    if (leftTab === 'logic') leftTab = 'layers';
    if (!id) {
      selectedIds = [];
      return;
    }

    if (additive) {
      selectedIds = selectedSet.has(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id];
      return;
    }

    selectedIds = [id];
  }

  function selectMany(ids: string[], additive = false) {
    selectedGroupId = undefined;
    selectedBehaviorId = undefined;
    if (leftTab === 'logic') leftTab = 'layers';
    const valid = ids.filter((id) => elements.some((element) => element.id === id));
    selectedIds = additive ? [...new SvelteSet([...selectedIds, ...valid])] : valid;
  }

  function selectGroup(id: string | undefined) {
    selectedIds = [];
    selectedBehaviorId = undefined;
    selectedGroupId = id;
    leftTab = 'layers';
  }

  function expandGroupPath(groupId: string | undefined) {
    const seen = new SvelteSet<string>();
    let current = groupId ? groups.find((group) => group.id === groupId) : undefined;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      current.collapsed = false;
      current = current.parentId
        ? groups.find((group) => group.id === current?.parentId)
        : undefined;
    }
  }

  function openLinkedLogic(type: 'element' | 'group', id: string) {
    const groupId =
      type === 'group'
        ? groups.find((group) => group.id === id)?.parentId
        : elements.find((element) => element.id === id)?.groupId;
    expandGroupPath(groupId);
    if (type === 'group') selectGroup(id);
    else selectElement(id);
    leftTab = 'layers';
    logicFocusKey = `${type}:${id}`;
    logicFocusToken += 1;
  }

  function jumpLogicTarget(direction: 1 | -1) {
    if (logicTargets.length === 0) return;
    const index =
      currentLogicTargetIndex === -1
        ? direction > 0
          ? 0
          : logicTargets.length - 1
        : (currentLogicTargetIndex + direction + logicTargets.length) % logicTargets.length;
    const target = logicTargets[index];
    openLinkedLogic(target.type, target.id);
  }

  function openLogicTab() {
    selectedIds = [];
    selectedGroupId = undefined;
    leftTab = 'logic';
    if (!selectedBehaviorId) selectedBehaviorId = behaviors[0]?.id;
  }

  function groupLabel(group: ThemeV2Group) {
    return group.name?.trim() || 'Group';
  }

  function isElementLockedByGroups(element: ThemeV2Element) {
    let group = element.groupId
      ? groups.find((candidate) => candidate.id === element.groupId)
      : undefined;
    const seen = new SvelteSet<string>();
    while (group && !seen.has(group.id)) {
      if (group.locked) return true;
      seen.add(group.id);
      group = group.parentId
        ? groups.find((candidate) => candidate.id === group?.parentId)
        : undefined;
    }
    return false;
  }

  function selectBehavior(id: string | undefined) {
    selectedBehaviorId = id;
    selectedIds = [];
    selectedGroupId = undefined;
    leftTab = 'logic';
  }

  function createBehavior(target?: ThemeV2BehaviorTarget) {
    if (behaviors.length >= 100) {
      notifyError('A theme can contain at most 100 logic rules.');
      return undefined;
    }
    const behavior = createThemeV2Behavior(behaviors.length, target);
    definition.behaviors = [...behaviors, behavior];
    if (target?.type === 'element') {
      const element = elements.find((candidate) => candidate.id === target.id);
      if (element) element.interactive = true;
    }
    return behavior;
  }

  function addBehavior() {
    const behavior = createBehavior();
    if (behavior) selectBehavior(behavior.id);
  }

  function deleteBehavior(id = selectedBehaviorId) {
    if (!id) return;
    definition.behaviors = behaviors.filter((behavior) => behavior.id !== id);
    if (selectedBehaviorId === id) selectBehavior(undefined);
  }

  function collectGroupIds(rootId: string) {
    const ids = new SvelteSet<string>();
    const visit = (groupId: string) => {
      if (ids.has(groupId)) return;
      ids.add(groupId);
      for (const child of groups.filter((group) => group.parentId === groupId)) {
        visit(child.id);
      }
    };
    visit(rootId);
    return ids;
  }

  function pruneBehaviorsAfterRemoval({
    groups: removedGroups,
    elements: removedElements,
  }: {
    groups?: ReadonlySet<string>;
    elements?: ReadonlySet<string>;
  } = {}) {
    const groupIds = removedGroups ?? new SvelteSet<string>();
    const elementIds = removedElements ?? new SvelteSet<string>();
    const current = definition.behaviors ?? [];

    const remaining = current.filter((behavior) => {
      if (behavior.target?.type === 'element' && elementIds.has(behavior.target.id)) return false;
      if (behavior.target?.type === 'group' && groupIds.has(behavior.target.id)) return false;

      const trigger = behavior.trigger;
      if (
        (trigger.type === 'click' || trigger.type === 'hover' || trigger.type === 'leave') &&
        trigger.elementId &&
        elementIds.has(trigger.elementId)
      ) {
        return false;
      }

      return true;
    });

    let changed = remaining.length !== current.length;
    const cleaned = remaining.map((behavior) => {
      let behaviorChanged = false;
      const conditions = (behavior.conditions ?? []).filter((condition) => {
        if (condition.type === 'visible' && elementIds.has(condition.elementId)) {
          behaviorChanged = true;
          return false;
        }
        if (condition.type === 'groupVisible' && groupIds.has(condition.groupId)) {
          behaviorChanged = true;
          return false;
        }
        return true;
      });
      const actions = behavior.actions.filter((action) => {
        if (
          (action.type === 'showElement' ||
            action.type === 'hideElement' ||
            action.type === 'toggleElement') &&
          elementIds.has(action.elementId)
        ) {
          behaviorChanged = true;
          return false;
        }
        if (
          (action.type === 'showGroup' ||
            action.type === 'hideGroup' ||
            action.type === 'toggleGroup') &&
          groupIds.has(action.groupId)
        ) {
          behaviorChanged = true;
          return false;
        }
        return true;
      });

      if (!behaviorChanged) return behavior;
      changed = true;
      return { ...behavior, conditions, actions };
    });

    if (!changed) return 0;

    definition.behaviors = cleaned;
    if (selectedBehaviorId && !cleaned.some((behavior) => behavior.id === selectedBehaviorId)) {
      selectedBehaviorId = undefined;
    }
    return current.length - remaining.length;
  }

  function removeGroupTree(rootId: string) {
    const ids = collectGroupIds(rootId);
    const removedElements = new SvelteSet(
      elements
        .filter((element) => element.groupId && ids.has(element.groupId))
        .map((element) => element.id)
    );
    definition.groups = groups.filter((group) => !ids.has(group.id));
    definition.elements = elements.filter((element) => !removedElements.has(element.id));
    pruneBehaviorsAfterRemoval({ groups: ids, elements: removedElements });
    if (selectedGroupId && ids.has(selectedGroupId)) selectedGroupId = undefined;
    selectedIds = selectedIds.filter((id) => !removedElements.has(id));
  }

  function requestGroupDelete(id = selectedGroupId) {
    if (!id || !groups.some((group) => group.id === id)) return;
    deleteGroupId = id;
  }

  function confirmGroupDelete() {
    const id = deleteGroupId;
    if (!id) return;

    const group = groups.find((candidate) => candidate.id === id);
    const ids = collectGroupIds(id);
    const layerCount = elements.filter(
      (element) => element.groupId && ids.has(element.groupId)
    ).length;
    const label = group ? groupLabel(group) : 'Group';

    deleteGroupId = undefined;
    removeGroupTree(id);
    statusMessage =
      layerCount > 0
        ? `Deleted ${label} and ${layerCount} layer${layerCount === 1 ? '' : 's'}`
        : `Deleted ${label}`;
  }

  function addGroup(name?: string) {
    let id = `group_${Date.now().toString(36)}`;
    let suffix = 2;
    while (groups.some((group) => group.id === id))
      id = `group_${Date.now().toString(36)}_${suffix++}`;
    const group: ThemeV2Group = {
      id,
      name: name ?? `Group ${groups.length + 1}`,
      collapsed: false,
    };
    definition.groups = [...groups, group];
    selectedIds = [];
    selectedGroupId = id;
    leftTab = 'layers';
    return group;
  }

  function groupSelection() {
    if (selectedElements.length === 0) return;
    const targets = [...selectedElements];
    const parents = new SvelteSet(targets.map((element) => element.groupId));
    const parentId = parents.size === 1 ? [...parents][0] : undefined;
    const group = addGroup();
    if (parentId) {
      group.parentId = parentId;
      const parent = groups.find((candidate) => candidate.id === parentId);
      if (parent) parent.collapsed = false;
    }
    const targetSet = new SvelteSet(targets.map((element) => element.id));
    definition.elements = elements.map((element) =>
      targetSet.has(element.id) ? { ...element, groupId: group.id } : element
    );
  }

  function removeSelectedFromGroup() {
    if (selectedElements.length === 0) return;
    for (const element of selectedElements) {
      if (!element.groupId) continue;
      element.groupId = undefined;
    }
  }

  function ungroupGroup(id = selectedGroupId) {
    const group = id ? groups.find((candidate) => candidate.id === id) : undefined;
    if (!group) return;
    const parentId = group.parentId;
    definition.groups = groups
      .filter((candidate) => candidate.id !== group.id)
      .map((candidate) =>
        candidate.parentId === group.id ? { ...candidate, parentId } : candidate
      );
    definition.elements = elements.map((element) =>
      element.groupId === group.id ? { ...element, groupId: parentId } : element
    );
    pruneBehaviorsAfterRemoval({ groups: new SvelteSet([group.id]) });
    selectedGroupId = undefined;
  }

  function toggleGroupCollapsed(group: ThemeV2Group) {
    group.collapsed = !group.collapsed;
  }

  function setAllGroupsCollapsed(collapsed: boolean) {
    if (groups.length === 0) return;
    definition.groups = groups.map((group) => ({ ...group, collapsed }));
    statusMessage = collapsed ? 'Collapsed all groups' : 'Expanded all groups';
  }

  function toggleAllGroups() {
    setAllGroupsCollapsed(anyGroupExpanded);
  }

  async function focusLayerSearch() {
    leftTab = 'layers';
    await tick();
    layerSearchInput?.focus();
    layerSearchInput?.select();
  }

  function toggleGroupFlag(group: ThemeV2Group, flag: 'hidden' | 'locked') {
    group[flag] = !group[flag];
  }

  function groupDescendantCount(groupId: string, seen = new SvelteSet<string>()): number {
    if (seen.has(groupId)) return 0;
    seen.add(groupId);
    let count = elements.filter((element) => element.groupId === groupId).length;
    for (const child of groups.filter((group) => group.parentId === groupId)) {
      count += groupDescendantCount(child.id, seen);
    }
    return count;
  }

  function validGroupId(id: string | undefined) {
    return id && groups.some((group) => group.id === id) ? id : undefined;
  }

  function canNestGroup(groupId: string, parentId: string | undefined) {
    if (!parentId) return true;
    if (groupId === parentId) return false;
    return !collectGroupIds(groupId).has(parentId);
  }

  function moveElementIntoGroup(sourceId: string, groupId: string) {
    const source = elements.find((element) => element.id === sourceId);
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!source || !group) return false;

    const remaining = elements.filter((element) => element.id !== sourceId);
    const groupIds = collectGroupIds(groupId);
    let topIndex = -1;
    remaining.forEach((element, index) => {
      if (element.groupId && groupIds.has(element.groupId)) topIndex = index;
    });

    // Elements are stored bottom-to-top, so inserting after the group's top
    // child places the dragged layer at the top of that group.
    source.groupId = groupId;
    remaining.splice(topIndex + 1, 0, source);
    definition.elements = remaining;
    group.collapsed = false;
    expandGroupPath(group.id);
    statusMessage = `Moved ${elementLabel(source)} into ${groupLabel(group)}`;
    return true;
  }

  function moveElementBetween(sourceId: string, targetId: string, position: 'above' | 'below') {
    if (sourceId === targetId) return false;
    const source = elements.find((element) => element.id === sourceId);
    const target = elements.find((element) => element.id === targetId);
    if (!source || !target) return false;

    const remaining = elements.filter((element) => element.id !== sourceId);
    const targetIndex = remaining.findIndex((element) => element.id === targetId);
    if (targetIndex < 0) return false;

    // The layer list is rendered top-to-bottom, while `elements` is ordered
    // bottom-to-top. Inserting after the target in the array moves the layer
    // above it in the list.
    const insertAt = position === 'above' ? targetIndex + 1 : targetIndex;
    const parentId = validGroupId(target.groupId);
    source.groupId = parentId;
    remaining.splice(insertAt, 0, source);
    definition.elements = remaining;
    if (parentId) expandGroupPath(parentId);
    statusMessage = `Moved ${elementLabel(source)} ${position} ${elementLabel(target)}`;
    return true;
  }

  function moveGroupToParent(groupId: string, parentId: string | undefined) {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group || group.parentId === parentId) return false;
    if (!canNestGroup(groupId, parentId)) return false;

    const parent = parentId ? groups.find((candidate) => candidate.id === parentId) : undefined;
    group.parentId = parent?.id;
    if (parent) {
      parent.collapsed = false;
      expandGroupPath(parent.id);
    }
    statusMessage = parent
      ? `Moved ${groupLabel(group)} into ${groupLabel(parent)}`
      : `Moved ${groupLabel(group)} out of its group`;
    return true;
  }

  function moveElementToRoot(sourceId: string) {
    const source = elements.find((element) => element.id === sourceId);
    if (!source || !source.groupId) return false;
    source.groupId = undefined;
    statusMessage = `Moved ${elementLabel(source)} out of its group`;
    return true;
  }

  function closeContextMenu() {
    contextMenuOpen = false;
    layerContextMenuOpen = false;
    contextMenuTargetId = undefined;
    contextMenuGroupId = undefined;
  }

  function prepareContextMenu(targetId: string | undefined) {
    if (loading) return;

    contextMenuGroupId = undefined;
    if (targetId) {
      if (!selectedSet.has(targetId)) selectElement(targetId);
    } else {
      selectedIds = [];
      selectedGroupId = undefined;
    }
    contextMenuTargetId = targetId;
  }

  function prepareGroupContextMenu(groupId: string) {
    if (loading) return;
    selectedIds = [];
    selectedGroupId = groupId;
    contextMenuTargetId = undefined;
    contextMenuGroupId = groupId;
  }

  function elementLabel(element: ThemeV2Element) {
    return themeElementLabel(element);
  }

  function moveElements(updates: { id: string; x: number; y: number }[]) {
    for (const update of updates) {
      updateElement(update.id, { x: update.x, y: update.y });
    }
  }

  function nudgeSelected(deltaX: number, deltaY: number) {
    if (movableSelectedElements.length === 0) return;

    const minX = Math.min(...movableSelectedElements.map((element) => element.x));
    const minY = Math.min(...movableSelectedElements.map((element) => element.y));
    const maxX = Math.max(...movableSelectedElements.map((element) => element.x + element.width));
    const maxY = Math.max(...movableSelectedElements.map((element) => element.y + element.height));
    const dx = Math.min(1000 - maxX, Math.max(-minX, deltaX));
    const dy = Math.min(650 - maxY, Math.max(-minY, deltaY));

    for (const element of movableSelectedElements) {
      updateElement(element.id, { x: element.x + dx, y: element.y + dy });
    }
  }

  function toggleElementFlag(element: ThemeV2Element, flag: 'hidden' | 'locked') {
    updateElement(element.id, { [flag]: !element[flag] });
  }

  function toggleSelectedFlag(flag: 'hidden' | 'locked') {
    const next = !selectedElements.every((element) => element[flag] === true);
    for (const element of selectedElements) {
      updateElement(element.id, { [flag]: next });
    }
  }

  function alignSelected(edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    if (movableSelectedElements.length < 2) return;

    const minX = Math.min(...movableSelectedElements.map((element) => element.x));
    const minY = Math.min(...movableSelectedElements.map((element) => element.y));
    const maxX = Math.max(...movableSelectedElements.map((element) => element.x + element.width));
    const maxY = Math.max(...movableSelectedElements.map((element) => element.y + element.height));

    for (const element of movableSelectedElements) {
      if (edge === 'left') updateElement(element.id, { x: minX });
      if (edge === 'center') {
        updateElement(element.id, { x: Math.round((minX + maxX - element.width) / 2) });
      }
      if (edge === 'right') updateElement(element.id, { x: maxX - element.width });
      if (edge === 'top') updateElement(element.id, { y: minY });
      if (edge === 'middle') {
        updateElement(element.id, { y: Math.round((minY + maxY - element.height) / 2) });
      }
      if (edge === 'bottom') updateElement(element.id, { y: maxY - element.height });
    }
  }

  function distributeSelected(axis: 'horizontal' | 'vertical') {
    if (movableSelectedElements.length < 3) return;

    const sorted = [...movableSelectedElements].sort((a, b) =>
      axis === 'horizontal' ? a.x - b.x : a.y - b.y
    );
    const start = axis === 'horizontal' ? sorted[0].x : sorted[0].y;
    const end =
      axis === 'horizontal'
        ? Math.max(...sorted.map((element) => element.x + element.width))
        : Math.max(...sorted.map((element) => element.y + element.height));
    const totalSize = sorted.reduce(
      (sum, element) => sum + (axis === 'horizontal' ? element.width : element.height),
      0
    );
    const gap = Math.max(0, (end - start - totalSize) / (sorted.length - 1));
    let cursor = start;

    for (const element of sorted) {
      if (axis === 'horizontal') {
        updateElement(element.id, { x: Math.round(cursor) });
        cursor += element.width + gap;
      } else {
        updateElement(element.id, { y: Math.round(cursor) });
        cursor += element.height + gap;
      }
    }
  }

  function startLayerDrag(event: DragEvent, kind: 'element' | 'group', id: string) {
    draggingLayer = { kind, id };
    dropTarget = undefined;

    if (kind === 'group') {
      if (selectedGroupId !== id) selectGroup(id);
    } else if (!selectedSet.has(id)) {
      selectElement(id);
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  function dropPosition(event: DragEvent): 'above' | 'below' {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
  }

  function updateGroupDrop(event: DragEvent, groupId: string) {
    const source = draggingLayer;
    if (!source) return;
    if (source.kind === 'group' && !canNestGroup(source.id, groupId)) {
      if (dropTarget?.mode === 'inside' && dropTarget.groupId === groupId) {
        dropTarget = undefined;
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTarget = { mode: 'inside', groupId };
  }

  function updateElementDrop(event: DragEvent, elementId: string) {
    if (draggingLayer?.kind !== 'element' || draggingLayer.id === elementId) {
      if (dropTarget?.mode === 'between' && dropTarget.elementId === elementId) {
        dropTarget = undefined;
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTarget = { mode: 'between', elementId, position: dropPosition(event) };
  }

  function updateRootDrop(event: DragEvent) {
    if (!draggingLayer) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTarget = { mode: 'root' };
  }

  function dropLayerOnGroup(event: DragEvent, groupId: string) {
    event.preventDefault();
    event.stopPropagation();
    const source = draggingLayer;
    if (source) {
      if (source.kind === 'element') moveElementIntoGroup(source.id, groupId);
      else moveGroupToParent(source.id, groupId);
    }
    endLayerDrag();
  }

  function dropLayerOnElement(event: DragEvent, elementId: string) {
    event.preventDefault();
    event.stopPropagation();
    const source = draggingLayer;
    if (source?.kind === 'element') {
      const position = dropTarget?.mode === 'between' ? dropTarget.position : dropPosition(event);
      moveElementBetween(source.id, elementId, position);
    }
    endLayerDrag();
  }

  function dropLayerOnRoot(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const source = draggingLayer;
    if (source) {
      if (source.kind === 'element') moveElementToRoot(source.id);
      else moveGroupToParent(source.id, undefined);
    }
    endLayerDrag();
  }

  function endLayerDrag() {
    draggingLayer = undefined;
    dropTarget = undefined;
  }

  function renameElement(id: string, value: string) {
    updateElement(id, { name: value });
  }

  function focusInput(node: HTMLInputElement) {
    requestAnimationFrame(() => {
      node.focus();
      node.select();
    });
    return {};
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
      editorFolderPath = context.folderPath ?? undefined;
      const httpBase = await themeAssetBase();
      assetBase =
        httpBase && context.folderName
          ? `${httpBase}/${encodeURIComponent(context.folderName)}/assets`
          : context.folderPath
            ? convertFileSrc(await path.normalize(await path.join(context.folderPath, 'assets')))
            : '';
      pickedAssets = [];
      selectedIds = [];
      selectedGroupId = undefined;
      layerClipboard = undefined;
      selectedFontsourceId = undefined;
      fontDownloading = false;
      renamingId = undefined;
      resetCanvasViewState();
      resetHistory();
      lastSavedKey = snapshotKey(captureSnapshot());
      const draft = readDraft();
      recoverableDraft =
        draft && (draft.savedFolder ?? '') === (context.folderName ?? '') ? draft : undefined;
      statusMessage = context.themeJson ? 'Theme loaded' : 'New theme';
      requestAnimationFrame(updateCanvasScale);
    } catch (error) {
      console.error(error);
      definition = ensureDefaults(createDefaultThemeV2());
      savedFolder = undefined;
      editorFolderPath = undefined;
      assetBase = '';
      pickedAssets = [];
      selectedIds = [];
      selectedGroupId = undefined;
      layerClipboard = undefined;
      selectedFontsourceId = undefined;
      fontDownloading = false;
      resetCanvasViewState();
      resetHistory();
      lastSavedKey = snapshotKey(captureSnapshot());
      recoverableDraft = undefined;
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
    let unlistenClose: UnlistenFn | undefined;
    listen('theme-editor-context', () => loadContext()).then((stop) => (unlisten = stop));
    getCurrentWindow()
      .onCloseRequested((event) => {
        if (allowClose || !dirty) return;
        event.preventDefault();
        closeDialogOpen = true;
      })
      .then((stop) => (unlistenClose = stop));
    loadContext();

    return () => {
      observer.disconnect();
      unlisten?.();
      unlistenClose?.();
      stopHistoryTimer();
    };
  });

  const assetFilters: Record<AssetKind, { name: string; extensions: string[] }[]> = {
    image: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }],
    video: [{ name: 'Video (WebM recommended)', extensions: ['webm', 'mp4', 'm4v', 'mov'] }],
    audio: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'm4a', 'flac'] }],
    font: [{ name: 'Font', extensions: ['woff2', 'woff', 'ttf', 'otf'] }],
    lottie: [{ name: 'Lottie animation', extensions: ['json'] }],
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
              : kind === 'lottie'
                ? 'Choose a Lottie JSON animation'
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

  function setVariableDefault(name: string, value: ThemeV2ScriptValue | undefined) {
    const variables = { ...(definition.variables ?? {}) };
    if (value === undefined) {
      delete variables[name];
    } else {
      variables[name] = value;
    }
    definition.variables = variables;
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
    if (type === 'video') definition.audio = undefined;
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
    if (definition.background.type === 'video') {
      notifyError('Theme music cannot be used while a video is selected as the background.');
      return;
    }
    const asset = await chooseAsset('audio');
    if (!asset) return;
    definition.audio = { src: asset.name, loop: definition.audio?.loop !== false };
  }

  function uniqueFamily(label: string) {
    const existing = new SvelteSet((definition.fonts ?? []).map((font) => font.family));
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
    if ((definition.fonts ?? []).some((font) => font.src === name)) return true;
    return elements.some(
      (element) =>
        ((element.type === 'image' || element.type === 'video') && element.src === name) ||
        (element.type === 'svelte' && element.source.includes(name))
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
      if (definition.typography?.mono === font.family) {
        definition.typography.mono = 'Space Mono';
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
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  async function addMedia(kind: 'image' | 'video') {
    const asset = await chooseAsset(kind);
    if (!asset) return;
    const element = createThemeV2Element(kind, elements.length) as
      | ThemeV2ImageElement
      | ThemeV2VideoElement;
    element.src = asset.name;
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  function addShape() {
    const element = createThemeV2Element('shape', elements.length);
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  function addSvelte() {
    const element = createThemeV2Element('svelte', elements.length);
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  function addLayer(
    type:
      | 'data'
      | 'icon'
      | 'repeater'
      | 'gauge'
      | 'ticker'
      | 'button'
      | 'path'
      | 'particles'
      | 'clock'
      | 'countdown'
  ) {
    const element = createThemeV2Element(type, elements.length);
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  async function addLottie() {
    const asset = await chooseAsset('lottie');
    if (!asset) return;
    const element = createThemeV2Element('lottie', elements.length) as ThemeV2LottieElement;
    element.src = asset.name;
    if (selectedGroupId) element.groupId = selectedGroupId;
    definition.elements = [...elements, element];
    selectedGroupId = undefined;
    selectedIds = [element.id];
    leftTab = 'layers';
  }

  function patchElement(id: string, patch: Record<string, unknown>) {
    const element = elements.find((candidate) => candidate.id === id);
    if (element) Object.assign(element, patch);
  }

  function patchGroup(id: string, patch: Partial<ThemeV2Group>) {
    const group = groups.find((candidate) => candidate.id === id);
    if (group) Object.assign(group, patch);
  }

  function updateElement(id: string, patch: Partial<ThemeV2Element>) {
    patchElement(id, patch);
  }

  async function replaceSelectedAsset(kind: 'image' | 'video' | 'lottie') {
    const element = selectedElement;
    if (!element) return;
    if (kind === 'lottie' ? element.type !== 'lottie' : element.type !== kind) return;
    const asset = await chooseAsset(kind);
    if (asset) updateElement(element.id, { src: asset.name });
  }

  async function pickElementMask() {
    const element = selectedElement;
    if (!element) return;
    const asset = await chooseAsset('image');
    if (!asset) return;
    element.mask = {
      shape: 'image',
      src: asset.name,
      fit: element.mask?.fit ?? 'cover',
      radius: element.mask?.radius ?? 0,
      sides: element.mask?.sides ?? 6,
      innerRadius: element.mask?.innerRadius ?? 0.5,
    };
  }

  async function pickRepeaterImage() {
    const element = selectedElement;
    if (!element || element.type !== 'repeater') return;
    const asset = await chooseAsset('image');
    if (asset) updateElement(element.id, { src: asset.name, source: 'image' });
  }

  async function pickGroupMask() {
    const group = selectedGroup;
    if (!group) return;
    const asset = await chooseAsset('image');
    if (!asset) return;
    group.mask = {
      shape: 'image',
      src: asset.name,
      fit: group.mask?.fit ?? 'cover',
      radius: group.mask?.radius ?? 0,
      sides: group.mask?.sides ?? 6,
      innerRadius: group.mask?.innerRadius ?? 0.5,
    };
  }

  function copySelection() {
    if (!selectedGroup && selectedElements.length === 0) return false;
    const snapshot = $state.snapshot(definition) as ThemeV2Definition;
    if (selectedGroup) {
      const groupIds = collectGroupIds(selectedGroup.id);
      const copiedGroups = (snapshot.groups ?? []).filter((group) => groupIds.has(group.id));
      const copiedElements = (snapshot.elements ?? []).filter(
        (element) => element.groupId && groupIds.has(element.groupId)
      );
      layerClipboard = { groups: copiedGroups, elements: copiedElements };
      statusMessage = `Copied ${groupLabel(selectedGroup)}`;
      return true;
    }

    if (selectedElements.length === 0) return false;
    const copiedElements = (snapshot.elements ?? []).filter((element) =>
      selectedSet.has(element.id)
    );
    if (copiedElements.length === 0) return false;
    layerClipboard = { groups: [], elements: copiedElements };
    statusMessage = `Copied ${copiedElements.length} layer${copiedElements.length === 1 ? '' : 's'}`;
    return true;
  }

  function cutSelection() {
    if (selectedGroup) {
      if (!copySelection()) return;
      const label = groupLabel(selectedGroup);
      removeGroupTree(selectedGroup.id);
      statusMessage = `Cut ${label}`;
      return;
    }

    if (selectedElements.length === 0) return;
    const count = selectedElements.length;
    if (!copySelection()) return;
    deleteSelected();
    statusMessage = `Cut ${count} layer${count === 1 ? '' : 's'}`;
  }

  function pasteClipboard(targetGroupId?: string) {
    const clipboard = layerClipboard;
    if (!clipboard) return;

    const targetGroup = targetGroupId
      ? groups.find((group) => group.id === targetGroupId)
      : undefined;
    if (clipboard.groups.length === 0 && clipboard.elements.length === 0) return;

    pasteSerial += 1;
    const suffix = `${Date.now().toString(36)}_${pasteSerial}`;
    const groupIdMap = new SvelteMap<string, string>();
    for (const [index, group] of clipboard.groups.entries()) {
      groupIdMap.set(group.id, `group_${suffix}_${index}`);
    }

    const copiedGroups = clipboard.groups.map((group) => ({
      ...group,
      id: groupIdMap.get(group.id)!,
      parentId: (group.parentId ? groupIdMap.get(group.parentId) : undefined) ?? targetGroup?.id,
      collapsed: false,
    }));

    const copiedElements = clipboard.elements.map((element, index) => {
      let groupId: string | undefined;
      if (element.groupId && groupIdMap.has(element.groupId)) {
        groupId = groupIdMap.get(element.groupId);
      } else if (targetGroup) {
        groupId = targetGroup.id;
      } else if (element.groupId && groups.some((group) => group.id === element.groupId)) {
        groupId = element.groupId;
      }

      return {
        ...element,
        id: `element_${suffix}_${index}`,
        groupId,
        x: Math.max(0, Math.min(1000 - element.width, element.x + 24)),
        y: Math.max(0, Math.min(650 - element.height, element.y + 24)),
      } as ThemeV2Element;
    });

    definition.groups = [...groups, ...copiedGroups];
    definition.elements = [...elements, ...copiedElements];
    if (targetGroup) targetGroup.collapsed = false;

    selectedBehaviorId = undefined;
    leftTab = 'layers';
    if (copiedGroups.length > 0) {
      const primary = copiedGroups.find((group) => !group.parentId) ?? copiedGroups[0];
      selectedIds = [];
      selectedGroupId = primary?.id;
    } else {
      selectedIds = copiedElements.map((element) => element.id);
      selectedGroupId = undefined;
    }

    const parts: string[] = [];
    if (copiedGroups.length > 0) {
      parts.push(`${copiedGroups.length} group${copiedGroups.length === 1 ? '' : 's'}`);
    }
    if (copiedElements.length > 0) {
      parts.push(`${copiedElements.length} layer${copiedElements.length === 1 ? '' : 's'}`);
    }
    statusMessage = `Pasted ${parts.join(' and ')}`;
  }

  function duplicateGroup(groupId = selectedGroupId) {
    const source = groupId ? groups.find((group) => group.id === groupId) : undefined;
    if (!source) return false;

    const snapshot = $state.snapshot(definition) as ThemeV2Definition;
    const treeIds = collectGroupIds(source.id);
    const sourceGroups = (snapshot.groups ?? []).filter((group) => treeIds.has(group.id));
    const sourceElements = (snapshot.elements ?? []).filter(
      (element) => element.groupId && treeIds.has(element.groupId)
    );
    const stamp = `${Date.now().toString(36)}_${++pasteSerial}`;
    const idMap = new SvelteMap<string, string>();
    sourceGroups.forEach((group, index) => idMap.set(group.id, `group_${stamp}_${index}`));

    const copiedGroups = sourceGroups.map((group) => ({
      ...group,
      id: idMap.get(group.id)!,
      parentId: group.id === source.id ? group.parentId : idMap.get(group.parentId ?? ''),
      name: group.id === source.id ? `${groupLabel(source)} copy` : group.name,
      collapsed: group.id === source.id ? false : group.collapsed,
    }));
    const copiedElements = sourceElements.map((element, index) => ({
      ...element,
      id: `element_${stamp}_${index}`,
      groupId: element.groupId ? idMap.get(element.groupId) : undefined,
      x: Math.max(0, Math.min(1000 - element.width, element.x + 24)),
      y: Math.max(0, Math.min(650 - element.height, element.y + 24)),
    })) as ThemeV2Element[];

    definition.groups = [
      ...groups.map((group) =>
        group.id === source.parentId ? { ...group, collapsed: false } : group
      ),
      ...copiedGroups,
    ];
    definition.elements = [...elements, ...copiedElements];
    selectedIds = [];
    selectedGroupId = idMap.get(source.id);
    leftTab = 'layers';
    statusMessage = `Duplicated ${groupLabel(source)}`;
    return true;
  }

  function duplicateSelected() {
    if (selectedGroup) {
      duplicateGroup(selectedGroup.id);
      return;
    }
    if (selectedElements.length === 0) return;
    const stamp = Date.now().toString(36);
    const copies = selectedElements.map((element, index) => ({
      ...element,
      id: `element_${stamp}_${elements.length + index}`,
      x: Math.min(element.x + 24, 1000 - element.width),
      y: Math.min(element.y + 24, 650 - element.height),
    })) as ThemeV2Element[];
    definition.elements = [...elements, ...copies];
    selectedIds = copies.map((copy) => copy.id);
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;
    const removedElements = new SvelteSet(selectedIds);
    definition.elements = elements.filter((element) => !removedElements.has(element.id));
    pruneBehaviorsAfterRemoval({ elements: removedElements });
    selectedIds = [];
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

    if (
      !typing &&
      event.altKey &&
      logicTargets.length > 0 &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
      jumpLogicTarget(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (
      modifier &&
      key === 'f' &&
      !typing &&
      !shortcutsOpen &&
      !closeDialogOpen &&
      !validationOpen
    ) {
      event.preventDefault();
      void focusLayerSearch();
      return;
    }
    if (modifier && !typing && (key === '+' || key === '=')) {
      event.preventDefault();
      zoomCanvasBy(CANVAS_ZOOM_STEP);
      return;
    }
    if (modifier && !typing && key === '-') {
      event.preventDefault();
      zoomCanvasBy(1 / CANVAS_ZOOM_STEP);
      return;
    }
    if (modifier && !typing && key === '0') {
      event.preventDefault();
      resetCanvasView();
      return;
    }
    if (!typing && event.key === '?') {
      event.preventDefault();
      shortcutsOpen = true;
      return;
    }

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
    if (modifier && key === 'c') {
      if (typing) return;
      event.preventDefault();
      copySelection();
      return;
    }
    if (modifier && key === 'x') {
      if (typing) return;
      event.preventDefault();
      cutSelection();
      return;
    }
    if (modifier && key === 'v') {
      if (typing) return;
      event.preventDefault();
      const copiedGroupIsSelected =
        selectedGroupId &&
        layerClipboard?.groups.some((group) => group.id === selectedGroupId) === true;
      const targetGroupId = copiedGroupIsSelected
        ? undefined
        : (selectedGroupId ??
          (selectedElements.length === 1 ? selectedElements[0].groupId : undefined));
      pasteClipboard(targetGroupId);
      return;
    }
    if (event.key === 'Escape') {
      if (shortcutsOpen) {
        shortcutsOpen = false;
        return;
      }
      if (contextMenuOpen || layerContextMenuOpen) {
        closeContextMenu();
        return;
      }
      if (validationOpen) {
        validationOpen = false;
        exportAfterValidation = false;
        return;
      }
      if (closeDialogOpen) {
        closeDialogOpen = false;
        return;
      }
      if (deleteGroupId) {
        deleteGroupId = undefined;
        return;
      }
      selectedIds = [];
      selectedGroupId = undefined;
      renamingId = undefined;
      return;
    }
    if (modifier && key === 'a') {
      if (typing) return;
      event.preventDefault();
      selectedIds = elements.filter((element) => !element.hidden).map((element) => element.id);
      return;
    }
    if (modifier && key === 'g') {
      if (typing) return;
      event.preventDefault();
      if (selectedGroup) ungroupGroup();
      else groupSelection();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedGroup) {
      event.preventDefault();
      requestGroupDelete();
      return;
    }
    if (modifier && key === 'd' && !typing) {
      if (!selectedGroup && selectedIds.length === 0) return;
      event.preventDefault();
      duplicateSelected();
      return;
    }
    if (typing || selectedIds.length === 0) return;
    if (modifier && event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelected(1);
      return;
    }
    if (modifier && event.key === 'ArrowDown') {
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
      nudgeSelected(move[0], move[1]);
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
      editorFolderPath = await path.join(await themesDirectory(), folderName);
      lastSavedKey = snapshotKey(captureSnapshot());
      clearDraft();
      recoverableDraft = undefined;

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

  function referencedAssets() {
    const refs: string[] = [];
    const add = (value: string | undefined) => {
      if (!value) return;
      if (/^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|blob|asset):/i.test(value)) return;
      const relative = value.replace(/\\/g, '/').replace(/^\.?\//, '');
      if (relative && !refs.includes(relative)) refs.push(relative);
    };

    const background = definition.background;
    if (background.type === 'image' || background.type === 'video') add(background.src);
    add(definition.audio?.src);
    for (const element of elements) {
      if (
        element.type === 'image' ||
        element.type === 'video' ||
        element.type === 'lottie' ||
        (element.type === 'repeater' && element.source === 'image')
      ) {
        add(element.src);
      }
      add(element.mask?.src);
      if (element.type === 'svelte') {
        for (const match of element.source.matchAll(/asset\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
          add(match[1]);
        }
      }
    }
    for (const group of definition.groups ?? []) add(group.mask?.src);
    for (const font of definition.fonts ?? []) add(font.src);
    return refs;
  }

  async function validateTheme(): Promise<ThemeValidationReport> {
    const issues: ThemeValidationIssue[] = [];
    const error = (message: string) => issues.push({ level: 'error', message });
    const warning = (message: string) => issues.push({ level: 'warning', message });

    if (!definition.name.trim()) error('The theme needs a name.');
    if (!definition.author.trim()) error('The theme needs an author.');
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(definition.version.trim())) {
      warning('The version should use semantic versioning, for example 1.0.0.');
    }

    const background = definition.background;
    if ((background.type === 'image' || background.type === 'video') && !background.src.trim()) {
      error(`Choose a ${background.type} for the background, or switch to a color/gradient.`);
    }
    if (definition.audio && !definition.audio.src.trim()) {
      error('The theme has music enabled but no audio file.');
    }

    const seenIds: string[] = [];
    for (const element of elements) {
      if (seenIds.includes(element.id)) error(`Duplicate layer id: ${element.id}`);
      seenIds.push(element.id);
      if ((element.type === 'image' || element.type === 'video') && !element.src.trim()) {
        error(`The ${element.type} layer ${elementLabel(element)} has no asset.`);
      }
      if (element.type === 'repeater' && element.source === 'image' && !element.src?.trim()) {
        error(`The repeater ${elementLabel(element)} has no image.`);
      }
      if (element.mask?.shape === 'image' && !element.mask.src?.trim()) {
        error(`The mask on ${elementLabel(element)} has no image.`);
      }
      if (
        element.type === 'button' &&
        element.action.type === 'url' &&
        !/^https?:\/\//i.test(element.action.url)
      ) {
        error(`The button ${elementLabel(element)} needs a full http(s) URL.`);
      }
      if (element.type === 'svelte') {
        const analysis = await analyzeThemeSvelteSource(
          element.source,
          `layer-${element.id}.svelte`
        );
        if (!element.source.trim()) {
          error(`The Svelte layer ${elementLabel(element)} has no source.`);
        } else if (!analysis.ok) {
          const first = analysis.errors[0];
          error(
            `Svelte layer “${elementLabel(element)}”${first ? `: ${first.message}` : ' could not be compiled.'}`
          );
        }
        for (const issue of analysis.warnings.slice(0, 2)) {
          warning(
            `Svelte layer “${elementLabel(element)}” at ${issue.line}:${issue.column}: ${issue.message}`
          );
        }
      }
    }
    for (const group of groups) {
      if (group.mask?.shape === 'image' && !group.mask.src?.trim()) {
        error(`The mask on group “${group.name?.trim() || group.id}” has no image.`);
      }
    }

    const elementIds = new SvelteSet(seenIds);
    const groupIds = new SvelteSet(groups.map((group) => group.id));
    const interactiveIds = new SvelteSet(
      elements.filter((element) => element.interactive).map((element) => element.id)
    );
    for (const behavior of behaviors) {
      const ruleName = behavior.name?.trim() || behavior.id;
      const pointerTrigger =
        behavior.trigger.type === 'click' ||
        behavior.trigger.type === 'hover' ||
        behavior.trigger.type === 'leave';
      const elementTargetId = behavior.target?.type === 'element' ? behavior.target.id : undefined;
      const groupTargetId = behavior.target?.type === 'group' ? behavior.target.id : undefined;
      const hasScript = behavior.script !== undefined;
      if (!hasScript && behavior.actions.length === 0) {
        warning(`Rule “${ruleName}” has no actions.`);
      }
      if (hasScript) {
        const parsed = parseThemeScript(behavior.script ?? '');
        const firstError = parsed.errors[0];
        if (firstError) {
          error(`Rule “${ruleName}” script: ${formatThemeScriptError(firstError)}`);
        } else if (!(behavior.script ?? '').trim()) {
          warning(`Rule “${ruleName}” has an empty advanced script.`);
        } else {
          if (
            themeScriptProgramCanLeaveLauncher(parsed.program) &&
            behavior.trigger.type !== 'click'
          ) {
            warning(
              `Rule “${ruleName}” has an external action that only runs from a click trigger.`
            );
          }
          const scriptRefs = themeScriptProgramReferences(parsed.program);
          for (const elementId of scriptRefs.elementIds) {
            if (!elementIds.has(elementId)) {
              error(
                `Rule “${ruleName}” script references a layer that no longer exists: ${elementId}`
              );
            }
          }
          for (const groupId of scriptRefs.groupIds) {
            if (!groupIds.has(groupId)) {
              error(
                `Rule “${ruleName}” script references a group that no longer exists: ${groupId}`
              );
            }
          }
        }
      }
      if (elementTargetId && !elementIds.has(elementTargetId)) {
        error(`Rule “${ruleName}” is linked to a layer that no longer exists.`);
      }
      if (groupTargetId && !groupIds.has(groupTargetId)) {
        error(`Rule “${ruleName}” is linked to a group that no longer exists.`);
      }
      if (pointerTrigger && elementTargetId && !interactiveIds.has(elementTargetId)) {
        warning(`Rule “${ruleName}” is linked to a layer that is not marked Interactive.`);
      }
      if (
        pointerTrigger &&
        groupTargetId &&
        !elements.some(
          (element) =>
            element.interactive === true &&
            themeGroupContainsElement(groups, groupTargetId, element)
        )
      ) {
        warning(`Rule “${ruleName}” needs at least one Interactive layer inside its linked group.`);
      }
      if (
        (behavior.trigger.type === 'click' ||
          behavior.trigger.type === 'hover' ||
          behavior.trigger.type === 'leave') &&
        behavior.trigger.elementId &&
        !elementIds.has(behavior.trigger.elementId)
      ) {
        error(`Rule “${ruleName}” targets a layer that no longer exists.`);
      }
      for (const condition of behavior.conditions ?? []) {
        if (condition.type === 'visible' && !elementIds.has(condition.elementId)) {
          error(`Rule “${ruleName}” checks a layer that no longer exists.`);
        }
        if (condition.type === 'groupVisible' && !groupIds.has(condition.groupId)) {
          error(`Rule “${ruleName}” checks a group that no longer exists.`);
        }
      }
      if (!hasScript) {
        for (const action of behavior.actions) {
          if (
            (action.type === 'showElement' ||
              action.type === 'hideElement' ||
              action.type === 'toggleElement') &&
            !elementIds.has(action.elementId)
          ) {
            error(`Rule “${ruleName}” targets a layer that no longer exists.`);
          }
          if (
            (action.type === 'showGroup' ||
              action.type === 'hideGroup' ||
              action.type === 'toggleGroup') &&
            !groupIds.has(action.groupId)
          ) {
            error(`Rule “${ruleName}” targets a group that no longer exists.`);
          }
          if (action.type === 'openUrl' && !/^https?:\/\//i.test(action.url)) {
            error(`Rule “${ruleName}” has a URL that does not start with http:// or https://.`);
          }
          if (
            (action.type === 'launch' || action.type === 'openUrl') &&
            behavior.trigger.type !== 'click'
          ) {
            warning(
              `Rule “${ruleName}” has an external action that only runs from a click trigger.`
            );
          }
        }
      }
      if (
        pointerTrigger &&
        'elementId' in behavior.trigger &&
        behavior.trigger.elementId &&
        !interactiveIds.has(behavior.trigger.elementId)
      ) {
        warning(`Rule “${ruleName}” listens to a layer that is not marked Interactive.`);
      }
    }

    const refs = referencedAssets();
    // The editor is opened with the resolved theme folder, which can be
    // outside the managed themes directory. Prefer it over rebuilding the
    // path from the folder name, and use the native metadata command instead
    // of the fs plugin so the check is not limited by its path scope.
    const assetsFolder = editorFolderPath
      ? await path.join(editorFolderPath, 'assets')
      : savedFolder
        ? await path.join(await themesDirectory(), savedFolder, 'assets')
        : undefined;
    let totalBytes = 0;
    let fileCount = 0;

    for (const ref of refs) {
      const picked = pickedAssets.find((asset) => asset.name === ref);
      const candidate =
        picked?.source ?? (assetsFolder ? await path.join(assetsFolder, ref) : undefined);
      const size = candidate
        ? ((await invoke<number | null>('file_size', { path: candidate }).catch(() => null)) ??
          undefined)
        : undefined;

      if (size === undefined) {
        error(`Missing asset: ${ref}. Re-import it before exporting.`);
        continue;
      }

      totalBytes += size;
      fileCount += 1;

      if (/\.(?:webm|mp4|m4v|mov)$/i.test(ref) && size > 20 * 1024 * 1024) {
        warning(`${ref} is ${formatBytes(size)}. Consider compressing videos to WebM.`);
      } else if (/\.(?:png|jpe?g|webp|gif|avif)$/i.test(ref) && size > 8 * 1024 * 1024) {
        warning(`${ref} is ${formatBytes(size)}. Large images make theme downloads slower.`);
      }
    }

    const unused = pickedAssets.filter((asset) => !refs.includes(asset.name));
    if (unused.length > 0) {
      warning(
        `${unused.length} imported asset${unused.length === 1 ? '' : 's'} will not be exported because no layer uses ${unused.length === 1 ? 'it' : 'them'}.`
      );
    }

    if (elements.length === 0) {
      warning(
        'This theme has no custom layers. It will only change the launcher background and colors.'
      );
    }

    return {
      issues,
      totalBytes,
      fileCount,
      checkedAt: Date.now(),
    };
  }

  async function checkTheme() {
    statusMessage = 'Checking theme...';
    validationReport = await validateTheme();
    validationOpen = true;
    const errors = validationReport.issues.filter((issue) => issue.level === 'error').length;
    exportAfterValidation = errors === 0;
    statusMessage =
      errors === 0
        ? 'Theme check passed'
        : `Theme check found ${errors} error${errors === 1 ? '' : 's'}`;
  }

  async function exportCurrentTheme(skipValidation = false) {
    if (exporting || saving) return;

    if (!skipValidation) {
      const report = await validateTheme();
      validationReport = report;
      const errors = report.issues.some((issue) => issue.level === 'error');
      const warnings = report.issues.some((issue) => issue.level === 'warning');
      if (errors || warnings) {
        validationOpen = true;
        exportAfterValidation = !errors;
        return;
      }
    }

    validationOpen = false;
    exportAfterValidation = false;
    const alreadySaved = Boolean(savedFolder);
    const saved = await saveTheme({ notify: false, emitSaved: !alreadySaved });
    if (!saved || !savedFolder) return;
    const destination = await saveDialog({
      defaultPath: `${toSafeName(definition.name)}.ezpplauncher-theme`,
      filters: [{ name: 'EZPPLauncher Theme', extensions: ['ezpplauncher-theme'] }],
    });
    if (typeof destination !== 'string') return;

    exporting = true;
    statusMessage = 'Exporting...';
    try {
      await exportThemeFolder(savedFolder, destination);
      let size = 0;
      try {
        size = (await invoke<number | null>('file_size', { path: destination })) ?? 0;
      } catch {
        // The export succeeded; only the size read failed.
      }
      statusMessage = size > 0 ? `Exported ${formatBytes(size)}` : 'Exported';
      sileo.success({
        title: 'Theme exported',
        description:
          size > 0
            ? `The ${formatBytes(size)} .ezpplauncher-theme file is ready to share.`
            : 'The .ezpplauncher-theme file is ready to share.',
      });
    } catch (error) {
      console.error(error);
      statusMessage = 'Export failed';
      sileo.error({
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      exporting = false;
    }
  }

  async function closeEditor() {
    if (saving) return;
    if (dirty) {
      closeDialogOpen = true;
      return;
    }
    allowClose = true;
    await getCurrentWindow().close();
  }

  async function saveAndClose() {
    const saved = await saveTheme({ notify: false });
    if (!saved) return;
    clearDraft();
    allowClose = true;
    closeDialogOpen = false;
    await getCurrentWindow().close();
  }

  async function discardAndClose() {
    clearDraft();
    allowClose = true;
    closeDialogOpen = false;
    await getCurrentWindow().close();
  }
</script>

<svelte:window
  onkeydown={handleKeydown}
  onresize={closeContextMenu}
  onblur={() => {
    closeContextMenu();
    panning = false;
  }}
/>

{#snippet contextMenuItems()}
  <ContextMenu.Label
    class="px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
  >
    {#if contextMenuGroup}
      {groupLabel(contextMenuGroup)}
    {:else if contextMenuTargetId}
      {contextMenuSelection.length > 1
        ? `${contextMenuSelection.length} layers selected`
        : contextMenuSelection[0]
          ? elementLabel(contextMenuSelection[0])
          : 'Layer'}
    {:else}
      Canvas
    {/if}
  </ContextMenu.Label>

  {#if contextMenuGroup}
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={copySelection}>
      <Copy />
      Copy group
    </ContextMenu.Item>
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => duplicateGroup(contextMenuGroup?.id)}
    >
      <CopyPlus />
      Duplicate group
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={cutSelection}>
      <Scissors />
      Cut group
    </ContextMenu.Item>
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      disabled={!layerClipboard}
      onclick={() => pasteClipboard(contextMenuGroup.id)}
    >
      <ClipboardPaste />
      Paste into group
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => ungroupGroup(contextMenuGroup.id)}
    >
      <Ungroup />
      Ungroup group
    </ContextMenu.Item>
    <ContextMenu.Item
      variant="destructive"
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => requestGroupDelete(contextMenuGroup.id)}
    >
      <Trash2 />
      Delete group
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => toggleGroupFlag(contextMenuGroup, 'hidden')}
    >
      {#if contextMenuGroup.hidden}
        <Eye />
        Show group
      {:else}
        <EyeOff />
        Hide group
      {/if}
    </ContextMenu.Item>
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => toggleGroupFlag(contextMenuGroup, 'locked')}
    >
      {#if contextMenuGroup.locked}
        <Unlock />
        Unlock group
      {:else}
        <Lock />
        Lock group
      {/if}
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      onclick={() => selectGroup(contextMenuGroup.id)}
    >
      <MousePointer2 />
      Edit group
    </ContextMenu.Item>
  {:else if contextMenuTargetId}
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={copySelection}>
      <Copy />
      Copy
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={cutSelection}>
      <Scissors />
      Cut
    </ContextMenu.Item>
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      disabled={!layerClipboard}
      onclick={() =>
        pasteClipboard(
          contextMenuSelection.length === 1 ? contextMenuSelection[0].groupId : undefined
        )}
    >
      <ClipboardPaste />
      Paste
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={duplicateSelected}>
      <CopyPlus />
      Duplicate
    </ContextMenu.Item>
    {#if contextMenuSelection.length === 1 && contextMenuSelection[0].groupId}
      <ContextMenu.Item
        class="gap-2 py-1.5 text-[11px]"
        onclick={() => {
          const groupId = contextMenuSelection[0]?.groupId;
          if (groupId) selectGroup(groupId);
        }}
      >
        <Boxes />
        Select parent group
      </ContextMenu.Item>
    {/if}
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={groupSelection}>
      <Boxes />
      Group selection
    </ContextMenu.Item>
    {#if contextMenuSelection.some((element) => element.groupId)}
      <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={removeSelectedFromGroup}>
        <Ungroup />
        Remove from group
      </ContextMenu.Item>
    {/if}
    {#if contextMenuSelection.length === 1}
      <ContextMenu.Item
        class="gap-2 py-1.5 text-[11px]"
        disabled={selectedIndex >= elements.length - 1}
        onclick={() => moveSelected(1)}
      >
        <ChevronUp />
        Bring forward
      </ContextMenu.Item>
      <ContextMenu.Item
        class="gap-2 py-1.5 text-[11px]"
        disabled={selectedIndex <= 0}
        onclick={() => moveSelected(-1)}
      >
        <ChevronDown />
        Send backward
      </ContextMenu.Item>
    {/if}
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => toggleSelectedFlag('hidden')}>
      {#if contextMenuAllHidden}
        <Eye />
        Show {contextMenuSelection.length === 1 ? 'layer' : 'layers'}
      {:else}
        <EyeOff />
        Hide {contextMenuSelection.length === 1 ? 'layer' : 'layers'}
      {/if}
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => toggleSelectedFlag('locked')}>
      {#if contextMenuAllLocked}
        <Unlock />
        Unlock {contextMenuSelection.length === 1 ? 'layer' : 'layers'}
      {:else}
        <Lock />
        Lock {contextMenuSelection.length === 1 ? 'layer' : 'layers'}
      {/if}
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item
      variant="destructive"
      class="gap-2 py-1.5 text-[11px]"
      onclick={deleteSelected}
    >
      <Trash2 />
      Delete {contextMenuSelection.length === 1 ? 'layer' : 'layers'}
    </ContextMenu.Item>
  {:else}
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      disabled={!layerClipboard}
      onclick={() => pasteClipboard()}
    >
      <ClipboardPaste />
      Paste
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={addText}>
      <Type />
      Add text
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addMedia('image')}>
      <ImageIcon />
      Add image
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addMedia('video')}>
      <Video />
      Add video
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={addShape}>
      <Shapes />
      Add shape
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={addSvelte}>
      <Component />
      Add Svelte component
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('data')}>
      <Type />
      Add data layer
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('icon')}>
      <Sparkles />
      Add icon
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('repeater')}>
      <Repeat />
      Add repeater
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('gauge')}>
      <Gauge />
      Add gauge
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('ticker')}>
      <Megaphone />
      Add ticker
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('button')}>
      <MousePointerClick />
      Add button
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('path')}>
      <Spline />
      Add vector path
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('particles')}>
      <Sparkles />
      Add particles
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('clock')}>
      <Clock />
      Add clock
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={() => addLayer('countdown')}>
      <Timer />
      Add countdown
    </ContextMenu.Item>
    <ContextMenu.Item class="gap-2 py-1.5 text-[11px]" onclick={addLottie}>
      <Film />
      Add Lottie animation
    </ContextMenu.Item>
    <ContextMenu.Separator class="my-1 bg-theme-800" />
    <ContextMenu.Item
      class="gap-2 py-1.5 text-[11px]"
      disabled={elements.length === 0}
      onclick={() => {
        selectedIds = elements.filter((element) => !element.hidden).map((element) => element.id);
      }}
    >
      <MousePointer2 />
      Select all layers
    </ContextMenu.Item>
  {/if}
{/snippet}

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
          <h1 class="truncate text-sm font-semibold">Theme editor</h1>
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
          {definition.name || 'Untitled theme'}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <span
        class="mr-2 hidden text-[10px] sm:block {dirty
          ? 'text-amber-300'
          : 'text-muted-foreground'}"
        title={dirty ? 'You have changes that are not saved to the theme folder' : statusMessage}
      >
        {dirty ? 'Unsaved changes' : statusMessage}
      </span>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        onclick={() => (shortcutsOpen = true)}
      >
        <Keyboard class="size-4" />
      </Button>
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
        variant="ghost"
        size="icon"
        class="size-8"
        title="Check theme before export"
        aria-label="Check theme"
        onclick={checkTheme}
        disabled={loading || saving || exporting}
      >
        <ShieldCheck class="size-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => exportCurrentTheme()}
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

  {#if recoverableDraft}
    <div
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-100"
    >
      <AlertTriangle class="size-4 shrink-0 text-amber-300" />
      <span class="min-w-0 flex-1">
        An unsaved draft from {new Date(recoverableDraft.savedAt).toLocaleString()} is available.
      </span>
      <Button size="sm" class="h-7 text-[10px]" onclick={restoreDraft}>Restore draft</Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 text-[10px] text-amber-100 hover:bg-amber-500/10"
        onclick={discardDraft}
      >
        Discard
      </Button>
    </div>
  {/if}

  <div class="grid min-h-0 flex-1 grid-cols-[282px_minmax(0,1fr)_324px] overflow-hidden">
    <aside class="flex min-h-0 flex-col border-r border-theme-800 bg-theme-900/25">
      <div class="grid shrink-0 grid-cols-4 gap-1 border-b border-theme-800 p-2">
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
          class="h-8 gap-1.5 px-1 text-[10px] {leftTab === 'logic'
            ? 'bg-primary/20 text-primary hover:bg-primary/25'
            : 'text-muted-foreground'}"
          aria-pressed={leftTab === 'logic'}
          onclick={openLogicTab}
        >
          <Zap class="size-3.5" />
          Logic
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-1 text-[10px] {leftTab === 'fonts'
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
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="shrink-0 border-b border-theme-800 p-2">
            <div class="flex items-center justify-between px-1">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {#if layerSearchActive}
                  {layerSearchMatchCount} match{layerSearchMatchCount === 1 ? '' : 'es'}
                {:else}
                  {elements.length} layer{elements.length === 1 ? '' : 's'}
                  {#if groups.length > 0}
                    · {groups.length} group{groups.length === 1 ? '' : 's'}
                  {/if}
                {/if}
              </span>
              <div class="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title="Previous layer or group with logic (Alt/Option+↑)"
                  aria-label="Previous layer or group with logic"
                  disabled={logicTargets.length === 0}
                  onclick={() => jumpLogicTarget(-1)}
                >
                  <ChevronUp class="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title="Next layer or group with logic (Alt/Option+↓)"
                  aria-label="Next layer or group with logic"
                  disabled={logicTargets.length === 0}
                  onclick={() => jumpLogicTarget(1)}
                >
                  <ChevronDown class="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title={anyGroupExpanded ? 'Collapse all groups' : 'Expand all groups'}
                  aria-label={anyGroupExpanded ? 'Collapse all groups' : 'Expand all groups'}
                  disabled={groups.length === 0}
                  onclick={toggleAllGroups}
                >
                  {#if anyGroupExpanded}
                    <ChevronsUp class="size-3" />
                  {:else}
                    <ChevronsDown class="size-3" />
                  {/if}
                </Button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="sm"
                        class="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
                      >
                        <Plus class="size-3" />
                        Add
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" class="w-44 border-theme-700 bg-theme-950">
                    <DropdownMenu.Label
                      class="px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Add layer
                    </DropdownMenu.Label>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={addText}>
                      <Type />
                      Text
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addMedia('image')}>
                      <ImageIcon />
                      Image
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addMedia('video')}>
                      <Video />
                      Video
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={addShape}>
                      <Shapes />
                      Shape
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={addSvelte}>
                      <Component />
                      Svelte component
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator class="my-1 bg-theme-800" />
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('data')}>
                      <Type />
                      Data
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('icon')}>
                      <Sparkles />
                      Icon
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      class="gap-2 text-[11px]"
                      onclick={() => addLayer('repeater')}
                    >
                      <Repeat />
                      Repeater
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('gauge')}>
                      <Gauge />
                      Gauge
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('ticker')}>
                      <Megaphone />
                      Ticker
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('button')}>
                      <MousePointerClick />
                      Button
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('path')}>
                      <Spline />
                      Vector path
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      class="gap-2 text-[11px]"
                      onclick={() => addLayer('particles')}
                    >
                      <Sparkles />
                      Particles
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addLayer('clock')}>
                      <Clock />
                      Clock
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      class="gap-2 text-[11px]"
                      onclick={() => addLayer('countdown')}
                    >
                      <Timer />
                      Countdown
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={addLottie}>
                      <Film />
                      Lottie animation
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator class="my-1 bg-theme-800" />
                    <DropdownMenu.Item class="gap-2 text-[11px]" onclick={() => addGroup()}>
                      <Boxes />
                      Group
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
            </div>
            <div class="relative mt-2">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                class="h-7 border-theme-800 bg-theme-950 pl-7 pr-7 text-[10px] text-theme-50"
                placeholder="Find layers and groups…"
                aria-label="Find layers and groups"
                bind:ref={layerSearchInput}
                bind:value={layerQuery}
                onkeydown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    layerQuery = '';
                    return;
                  }
                  if (event.key !== 'Enter' || !layerSearchActive) return;
                  const first = visibleLayerRows.find((row) =>
                    layerRowMatches(row, layerSearchQuery)
                  );
                  if (first?.kind === 'group') {
                    selectGroup(first.group.id);
                  } else if (first) {
                    selectElement(first.element.id, false);
                  }
                }}
              />
              {#if layerSearchActive}
                <button
                  type="button"
                  class="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                  title="Clear search"
                  aria-label="Clear layer search"
                  onclick={() => {
                    layerQuery = '';
                    layerSearchInput?.focus();
                  }}
                >
                  <X class="size-3" />
                </button>
              {/if}
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2" bind:this={layerListHost}>
            {#if elements.length === 0 && groups.length === 0}
              <div class="rounded-lg border border-dashed border-theme-800 p-4 text-center">
                <Layers class="mx-auto size-6 text-theme-600" />
                <p class="mt-2 text-xs font-medium text-theme-100">Your canvas is empty</p>
                <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Add text, images, videos or shapes to build on top of the launcher home screen.
                </p>
              </div>
            {:else if layerSearchActive && visibleLayerRows.length === 0}
              <div class="rounded-lg border border-dashed border-theme-800 p-4 text-center">
                <Search class="mx-auto size-5 text-theme-600" />
                <p class="mt-2 text-xs font-medium text-theme-100">No matching layers</p>
                <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Try a layer name, group name or layer type. Collapsed groups are searched too.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  class="mt-3 h-7 text-[10px]"
                  onclick={() => {
                    layerQuery = '';
                    layerSearchInput?.focus();
                  }}
                >
                  Clear search
                </Button>
              </div>
            {:else}
              <ContextMenu.Root bind:open={layerContextMenuOpen}>
                <ContextMenu.Trigger class="block">
                  <div
                    class="space-y-1"
                    role="list"
                    oncontextmenu={(event) => {
                      if (event.target === event.currentTarget) prepareContextMenu(undefined);
                    }}
                  >
                    {#each visibleLayerRows as row (layerRowKey(row))}
                      {#if row.kind === 'group'}
                        {@const badge = logicBadges.get(`group:${row.group.id}`)}
                        {@const groupExpanded = layerSearchActive || !row.group.collapsed}
                        <div
                          role="listitem"
                          data-layer-key={`g:${row.group.id}`}
                          class="group relative flex items-center gap-1 rounded-md border px-1 py-1 {selectedGroupId ===
                          row.group.id
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent hover:border-theme-800'} {row.group.hidden
                            ? 'opacity-60'
                            : ''} {dropTarget?.mode === 'inside' &&
                          dropTarget.groupId === row.group.id
                            ? 'border-primary bg-primary/20 ring-1 ring-primary/40'
                            : ''} {draggingLayer?.kind === 'group' &&
                          draggingLayer.id === row.group.id
                            ? 'opacity-40'
                            : ''}"
                          style="margin-left:{row.depth * 14}px"
                          ondragover={(event) => updateGroupDrop(event, row.group.id)}
                          ondrop={(event) => dropLayerOnGroup(event, row.group.id)}
                          oncontextmenu={() => prepareGroupContextMenu(row.group.id)}
                        >
                          <button
                            type="button"
                            class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                            title={layerSearchActive
                              ? 'Clear the search to change group expansion'
                              : groupExpanded
                                ? 'Collapse group'
                                : 'Expand group'}
                            aria-label={groupExpanded ? 'Collapse group' : 'Expand group'}
                            aria-expanded={groupExpanded}
                            onclick={() => {
                              if (layerSearchActive) return;
                              toggleGroupCollapsed(row.group);
                            }}
                          >
                            {#if groupExpanded}
                              <ChevronDown class="size-3.5" />
                            {:else}
                              <ChevronRight class="size-3.5" />
                            {/if}
                          </button>
                          <span
                            class="flex size-6 shrink-0 items-center justify-center rounded bg-theme-900"
                          >
                            <Boxes class="size-3.5" />
                          </span>
                          <button
                            type="button"
                            class="min-w-0 flex-1 text-left"
                            onclick={() => selectGroup(row.group.id)}
                          >
                            <span class="block truncate text-[11px] font-medium text-theme-100">
                              {groupLabel(row.group)}
                            </span>
                            <span class="block font-mono text-[9px] text-muted-foreground">
                              {groupDescendantCount(row.group.id)} layer{groupDescendantCount(
                                row.group.id
                              ) === 1
                                ? ''
                                : 's'}
                            </span>
                          </button>
                          <ThemeLogicBadge
                            count={badge?.count ?? 0}
                            warning={badge?.warning ?? false}
                            onopen={() => openLinkedLogic('group', row.group.id)}
                          />
                          <div class="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              class="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                              title={row.group.hidden ? 'Show group' : 'Hide group'}
                              aria-label={row.group.hidden ? 'Show group' : 'Hide group'}
                              onclick={() => toggleGroupFlag(row.group, 'hidden')}
                            >
                              {#if row.group.hidden}
                                <EyeOff class="size-3.5" />
                              {:else}
                                <Eye class="size-3.5" />
                              {/if}
                            </button>
                            <button
                              type="button"
                              class="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                              title={row.group.locked ? 'Unlock group' : 'Lock group'}
                              aria-label={row.group.locked ? 'Unlock group' : 'Lock group'}
                              onclick={() => toggleGroupFlag(row.group, 'locked')}
                            >
                              {#if row.group.locked}
                                <Lock class="size-3.5" />
                              {:else}
                                <Unlock class="size-3.5" />
                              {/if}
                            </button>
                            <button
                              type="button"
                              draggable="true"
                              class="flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100 active:cursor-grabbing"
                              title="Drag group into another group, or out to the root"
                              aria-label="Drag group"
                              ondragstart={(event) => startLayerDrag(event, 'group', row.group.id)}
                              ondragend={endLayerDrag}
                            >
                              <GripVertical class="size-3.5" />
                            </button>
                          </div>
                        </div>
                      {:else}
                        {@const element = row.element}
                        {@const selected = selectedSet.has(element.id)}
                        {@const badge = logicBadges.get(`element:${element.id}`)}
                        <div
                          role="listitem"
                          data-layer-key={`e:${element.id}`}
                          class="group relative flex items-center gap-1 rounded-md border px-1 py-1 {selected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent hover:border-theme-800'} {element.hidden
                            ? 'opacity-60'
                            : ''} {draggingLayer?.kind === 'element' &&
                          draggingLayer.id === element.id
                            ? 'opacity-40'
                            : ''}"
                          style="margin-left:{row.depth * 14}px"
                          ondragover={(event) => updateElementDrop(event, element.id)}
                          ondrop={(event) => dropLayerOnElement(event, element.id)}
                          ondragleave={(event) => {
                            const next = event.relatedTarget as Node | null;
                            if (next && event.currentTarget.contains(next)) return;
                            if (
                              dropTarget?.mode === 'between' &&
                              dropTarget.elementId === element.id
                            ) {
                              dropTarget = undefined;
                            }
                          }}
                          oncontextmenu={() => prepareContextMenu(element.id)}
                        >
                          {#if dropTarget?.mode === 'between' && dropTarget.elementId === element.id}
                            <span
                              class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded bg-primary {dropTarget.position ===
                              'above'
                                ? '-top-px'
                                : '-bottom-px'}"
                            ></span>
                          {/if}

                          {#if renamingId === element.id}
                            <div class="flex min-w-0 flex-1 items-center gap-1.5 px-1">
                              <span
                                class="flex size-6 shrink-0 items-center justify-center rounded bg-theme-900"
                              >
                                {#if element.type === 'text'}
                                  <Type class="size-3.5" />
                                {:else if element.type === 'image'}
                                  <ImageIcon class="size-3.5" />
                                {:else if element.type === 'video'}
                                  <Video class="size-3.5" />
                                {:else if element.type === 'svelte'}
                                  <Component class="size-3.5" />
                                {:else if element.type === 'path'}
                                  <Spline class="size-3.5" />
                                {:else if element.type === 'particles'}
                                  <Sparkles class="size-3.5" />
                                {:else if element.type === 'clock'}
                                  <Clock class="size-3.5" />
                                {:else if element.type === 'countdown'}
                                  <Timer class="size-3.5" />
                                {:else}
                                  <Shapes class="size-3.5" />
                                {/if}
                              </span>
                              <input
                                class="h-6 min-w-0 flex-1 rounded border border-primary/50 bg-theme-950 px-1.5 text-[11px] text-theme-50 outline-none"
                                value={element.name ?? ''}
                                placeholder={elementLabel(element)}
                                use:focusInput
                                oninput={(event) =>
                                  renameElement(
                                    element.id,
                                    (event.currentTarget as HTMLInputElement).value
                                  )}
                                onblur={() => (renamingId = undefined)}
                                onkeydown={(event) => {
                                  if (event.key === 'Enter' || event.key === 'Escape') {
                                    event.preventDefault();
                                    renamingId = undefined;
                                  }
                                }}
                              />
                            </div>
                          {:else}
                            <button
                              type="button"
                              class="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
                              aria-pressed={selected}
                              onclick={(event) => {
                                selectElement(
                                  element.id,
                                  event.shiftKey || event.metaKey || event.ctrlKey
                                );
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
                                {:else if element.type === 'svelte'}
                                  <Component class="size-3.5" />
                                {:else if element.type === 'path'}
                                  <Spline class="size-3.5" />
                                {:else if element.type === 'particles'}
                                  <Sparkles class="size-3.5" />
                                {:else if element.type === 'clock'}
                                  <Clock class="size-3.5" />
                                {:else if element.type === 'countdown'}
                                  <Timer class="size-3.5" />
                                {:else}
                                  <Shapes class="size-3.5" />
                                {/if}
                              </span>
                              <span class="min-w-0 flex-1">
                                <span
                                  class="block truncate text-[11px] font-medium text-theme-100"
                                  title="Double-click to rename"
                                  role="presentation"
                                  ondblclick={(event) => {
                                    event.stopPropagation();
                                    renamingId = element.id;
                                  }}
                                >
                                  {elementLabel(element)}
                                </span>
                                <span class="block font-mono text-[9px] text-muted-foreground">
                                  {Math.round(element.width)}×{Math.round(element.height)} · {element.type}
                                </span>
                              </span>
                            </button>
                          {/if}

                          <ThemeLogicBadge
                            count={badge?.count ?? 0}
                            warning={badge?.warning ?? false}
                            onopen={() => openLinkedLogic('element', element.id)}
                          />

                          <div class="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              class="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                              title={element.hidden ? 'Show layer' : 'Hide layer'}
                              aria-label={element.hidden ? 'Show layer' : 'Hide layer'}
                              onclick={(event) => {
                                event.stopPropagation();
                                toggleElementFlag(element, 'hidden');
                              }}
                            >
                              {#if element.hidden}
                                <EyeOff class="size-3.5" />
                              {:else}
                                <Eye class="size-3.5" />
                              {/if}
                            </button>
                            <button
                              type="button"
                              class="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100"
                              title={element.locked ? 'Unlock layer' : 'Lock layer'}
                              aria-label={element.locked ? 'Unlock layer' : 'Lock layer'}
                              onclick={(event) => {
                                event.stopPropagation();
                                toggleElementFlag(element, 'locked');
                              }}
                            >
                              {#if element.locked}
                                <Lock class="size-3.5" />
                              {:else}
                                <Unlock class="size-3.5" />
                              {/if}
                            </button>
                            <button
                              type="button"
                              draggable="true"
                              class="flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-theme-800 hover:text-theme-100 active:cursor-grabbing"
                              title="Drag to reorder, move into a group, or move out of one"
                              aria-label="Drag layer"
                              ondragstart={(event) => startLayerDrag(event, 'element', element.id)}
                              ondragend={endLayerDrag}
                            >
                              <GripVertical class="size-3.5" />
                            </button>
                          </div>
                        </div>
                      {/if}
                    {/each}
                    {#if draggingLayer}
                      <div
                        role="listitem"
                        aria-label="Drop here to move out of all groups"
                        class="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed px-2 text-[10px] transition-colors {dropTarget?.mode ===
                        'root'
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-theme-700 text-muted-foreground'}"
                        ondragover={updateRootDrop}
                        ondrop={dropLayerOnRoot}
                      >
                        <Ungroup class="size-3.5 shrink-0" />
                        Drop here to move out of all groups
                      </div>
                    {/if}
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Content class="w-56 border-theme-700 bg-theme-950">
                  {@render contextMenuItems()}
                </ContextMenu.Content>
              </ContextMenu.Root>
            {/if}
          </div>
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
                  {@const bundledFamily = bundledThemeFontFamily(font.family)}
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
                        family={bundledFamily ?? font.family}
                        src={bundledFamily ? '' : fontsourceFontUrl(font, fontPreview)}
                        weight={String(fontPreview.weight)}
                        style={fontPreview.style}
                        class="block truncate text-[12px] leading-tight"
                      />
                      <span class="block text-[9px] capitalize text-muted-foreground"
                        >{font.category.replace('-', ' ')}</span
                      >
                    </span>
                    {#if bundledFamily}
                      <Badge
                        variant="outline"
                        class="shrink-0 border-primary/40 bg-primary/10 px-1 py-0 text-[8px] text-primary"
                        title="Bundled with the launcher — no download needed"
                      >
                        BUNDLED
                      </Badge>
                    {:else if font.variable}
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
                  {#if selectedFontIsBundled}
                    <p class="mt-0.5 flex items-center gap-1 text-[9px] text-primary">
                      <CheckCircle2 class="size-3 shrink-0" />
                      Bundled with the launcher
                    </p>
                  {/if}
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  {#if selectedFontIsBundled}
                    <Badge
                      variant="outline"
                      class="border-primary/40 bg-primary/10 px-1.5 py-0 text-[8px] text-primary"
                    >
                      Bundled
                    </Badge>
                  {/if}
                  {#if selectedFontsource.variable}
                    <Badge
                      variant="outline"
                      class="shrink-0 border-primary/25 px-1.5 py-0 text-[8px] text-primary"
                    >
                      Variable
                    </Badge>
                  {/if}
                </div>
              </div>
              <div
                class="overflow-hidden rounded-md border border-theme-800 bg-theme-950 px-2 py-2"
              >
                <p
                  class="truncate text-base text-theme-100"
                  style:font-family={selectedFontIsBundled
                    ? fontStack(selectedFontBundledFamily)
                    : FONT_PREVIEW_FAMILY}
                  style:font-weight={selectedFontsource.variable ? 600 : fontWeight}
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
                disabled={fontDownloading || selectedFontIsAdded || selectedFontIsBundled}
              >
                {#if fontDownloading}
                  <LoaderCircle class="animate-spin" />
                  Downloading…
                {:else if selectedFontIsBundled}
                  <CheckCircle2 class="size-3.5" />
                  Bundled with launcher
                {:else if selectedFontIsAdded}
                  <Check class="size-3.5" />
                  Added to theme
                {:else}
                  <Download class="size-3.5" />
                  Download & add
                {/if}
              </Button>
              {#if selectedFontIsBundled}
                <p class="text-center text-[9px] leading-relaxed text-muted-foreground">
                  Already available in the launcher font menus — no download needed.
                </p>
              {/if}
            </div>
          {/if}
        </div>
      {:else if leftTab === 'logic'}
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="shrink-0 space-y-2 border-b border-theme-800 p-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {behaviors.length} rule{behaviors.length === 1 ? '' : 's'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
                onclick={addBehavior}
              >
                <Plus class="size-3" />
                Add
              </Button>
            </div>
            {#if behaviors.length > 0}
              <div class="relative">
                <Search
                  class="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  class="h-7 border-theme-800 bg-theme-950 pl-7 text-[10px] text-theme-50"
                  placeholder="Search rules or targets"
                  aria-label="Search logic rules"
                  bind:value={logicQuery}
                />
              </div>
            {/if}
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            {#if behaviors.length === 0}
              <div class="rounded-lg border border-dashed border-theme-800 p-4 text-center">
                <Zap class="mx-auto size-6 text-theme-600" />
                <p class="mt-2 text-xs font-medium text-theme-100">No rules yet</p>
                <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Add a WHEN / IF / THEN rule to react to clicks, hovers, timers and screen changes.
                </p>
              </div>
            {:else if filteredBehaviors.length === 0}
              <div class="rounded-lg border border-dashed border-theme-800 p-4 text-center">
                <Search class="mx-auto size-5 text-theme-600" />
                <p class="mt-2 text-xs font-medium text-theme-100">No matching rules</p>
                <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Try a rule name, layer name or group name.
                </p>
              </div>
            {:else}
              <div class="space-y-1">
                {#each filteredBehaviors as behavior (behavior.id)}
                  <button
                    type="button"
                    class="flex w-full items-start gap-1.5 rounded-md border px-1.5 py-1.5 text-left transition-colors {selectedBehaviorId ===
                    behavior.id
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-transparent hover:border-theme-800 hover:bg-theme-900/60'}"
                    onclick={() => selectBehavior(behavior.id)}
                  >
                    <span
                      class="flex size-6 shrink-0 items-center justify-center rounded bg-theme-900"
                    >
                      <Zap class="size-3.5 text-primary" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-1.5">
                        <span class="truncate text-[11px] font-medium text-theme-100">
                          {behavior.name?.trim() || 'Rule'}
                        </span>
                        {#if behavior.target}
                          <span
                            class="shrink-0 rounded bg-theme-900 px-1 py-0.5 text-[8px] text-primary/90"
                            title={themeBehaviorTargetLabel(behavior.target, elements, groups)}
                          >
                            {behavior.target.type === 'group' ? 'Group' : 'Layer'}
                          </span>
                        {/if}
                      </span>
                      <span class="mt-0.5 block truncate text-[9px] text-muted-foreground">
                        {themeBehaviorSummary(behavior, elements, groups)}
                      </span>
                    </span>
                    {#if behavior.enabled === false}
                      <span class="mt-0.5 text-[8px] font-semibold uppercase text-muted-foreground"
                        >Off</span
                      >
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <p
            class="shrink-0 border-t border-theme-800 p-2 text-[9px] leading-relaxed text-muted-foreground"
          >
            Linked rules are editable from their layer or group inspector. Pointer rules need
            <strong class="text-theme-100">Interactive</strong> layers.
          </p>
        </div>
      {:else}
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <ThemeSection title="Theme details" bordered={false} contentClass="space-y-3 pt-2">
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
          </ThemeSection>

          <ThemeVariableDefaults
            variables={editableScriptVariables}
            defaults={definition.variables ?? {}}
            onchange={setVariableDefault}
          />

          <ThemeSection title="Background" contentClass="space-y-3 pt-2.5">
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
          </ThemeSection>

          <ThemeSection
            title="Overlay & effects"
            icon={Sparkles}
            open={false}
            contentClass="space-y-3 pt-2.5"
          >
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
          </ThemeSection>

          <ThemeSection title="Typography" icon={Type} open={false} contentClass="space-y-3 pt-2.5">
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
            <div class="space-y-1.5">
              <Label for="font-mono" class={labelClass}>Monospace font</Label>
              <Select.Root
                type="single"
                value={definition.typography.mono ?? 'Space Mono'}
                onValueChange={(value) => {
                  if (value) definition.typography.mono = value;
                }}
              >
                <Select.Trigger
                  id="font-mono"
                  class="h-9 border-theme-800 bg-theme-950 text-xs text-theme-50"
                >
                  {definition.typography.mono ?? 'Space Mono'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each fontOptions as font (font.family)}
                    <Select.Item value={font.family} label={`${font.label} · ${font.category}`} />
                  {/each}
                </Select.Content>
              </Select.Root>
              <p class="text-[10px] leading-relaxed text-muted-foreground">
                Used for paths, versions and telemetry text.
              </p>
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
          </ThemeSection>

          <ThemeSection
            title="Icon set"
            icon={Sparkles}
            open={false}
            contentClass="space-y-3 pt-2.5"
          >
            <Select.Root
              type="single"
              value={definition.iconSet ?? 'lucide'}
              onValueChange={(value) => {
                if (value === 'lucide' || value === 'phosphor' || value === 'tabler') {
                  definition.iconSet = value;
                }
              }}
            >
              <Select.Trigger
                id="theme-icon-set"
                class="h-9 border-theme-800 bg-theme-950 text-xs text-theme-50"
              >
                {THEME_ICON_SETS.find((option) => option.value === (definition.iconSet ?? 'lucide'))
                  ?.label ?? 'Lucide'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                {#each THEME_ICON_SETS as option (option.value)}
                  <Select.Item value={option.value} label={option.label} />
                {/each}
              </Select.Content>
            </Select.Root>
            <div
              class="flex items-center gap-2 rounded-md border border-theme-800 bg-theme-950 p-2"
            >
              {#each THEME_ICON_PREVIEW_NAMES as name (name)}
                <span
                  class="flex size-8 items-center justify-center rounded-md bg-theme-900 text-theme-100"
                >
                  <ThemeIcon {name} set={definition.iconSet ?? 'lucide'} class="size-4" />
                </span>
              {/each}
              <span class="ml-auto text-[9px] text-muted-foreground">Live preview</span>
            </div>
            <p class="text-[10px] leading-relaxed text-muted-foreground">
              Changes launcher navigation, status, settings and theme-browser icons. The icon data
              ships with the launcher, so themes still work offline.
            </p>
          </ThemeSection>

          <ThemeSection title="Music" icon={Music} open={false} contentClass="space-y-3 pt-2.5">
            {#if definition.background.type === 'video'}
              <div
                class="flex items-start gap-2 rounded-md border border-theme-800 bg-black/20 p-2"
              >
                <Lock class="mt-0.5 size-3.5 text-muted-foreground" />
                <p class="text-[10px] leading-relaxed text-muted-foreground">
                  Music is unavailable while a video is used as the background. Switch to an image,
                  color, or gradient to choose theme music.
                </p>
              </div>
            {:else}
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
            {/if}
          </ThemeSection>

          <ThemeSection
            title="Custom CSS"
            icon={Code2}
            open={false}
            contentClass="space-y-3 pt-2.5"
          >
            <Textarea
              class="min-h-28 resize-y border-theme-800 bg-theme-950 font-mono text-[10px] text-theme-50"
              spellcheck="false"
              placeholder={':root { --radius: 1rem; }'}
              bind:value={definition.css}
            />
            <p class="text-[10px] text-muted-foreground">
              Applied after the launcher styles. The live canvas previews these rules; keep them
              scoped where possible.
            </p>
          </ThemeSection>
        </div>
      {/if}
    </aside>

    <main class="flex min-h-0 min-w-0 flex-col bg-theme-900/50">
      <div
        class="flex h-10 shrink-0 items-center justify-between border-b border-theme-800 px-3 text-[10px] text-muted-foreground"
      >
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-1.5 shrink-0 rounded-full bg-emerald-400"></span>
          <span class="truncate">Launcher home · live canvas</span>
        </span>
        <div class="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            class="size-6 text-muted-foreground"
            title="Zoom out (Cmd/Ctrl+-)"
            aria-label="Zoom out"
            onclick={() => zoomCanvasBy(1 / CANVAS_ZOOM_STEP)}
          >
            <Minus class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-12 px-0 font-mono text-[10px] text-theme-100"
            title="Reset to fit to window (Cmd/Ctrl+0)"
            aria-label="Reset canvas zoom to fit to window"
            onclick={resetCanvasView}
          >
            {Math.round(canvasScale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-6 text-muted-foreground"
            title="Zoom in (Cmd/Ctrl++)"
            aria-label="Zoom in"
            onclick={() => zoomCanvasBy(CANVAS_ZOOM_STEP)}
          >
            <Plus class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-6 text-muted-foreground"
            title="Fit to window (Cmd/Ctrl+0)"
            aria-label="Fit canvas to window"
            onclick={resetCanvasView}
          >
            <Maximize2 class="size-3.5" />
          </Button>
          <span class="mx-0.5 h-4 w-px bg-theme-800"></span>
          <Button
            variant="ghost"
            size="icon"
            class="size-6 {panMode
              ? 'bg-primary/20 text-primary hover:bg-primary/25'
              : 'text-muted-foreground'}"
            title="Pan mode — drag the canvas to move it"
            aria-label="Pan mode"
            aria-pressed={panMode}
            onclick={() => {
              panMode = !panMode;
              panning = false;
            }}
          >
            <Hand class="size-3.5" />
          </Button>
        </div>
      </div>
      <div
        class="relative min-h-0 flex-1 overflow-hidden p-6"
        style="background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0);background-size:24px 24px;"
        bind:this={canvasHost}
        role="presentation"
        onwheel={handleCanvasWheel}
      >
        {#if loading}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
          >
            <LoaderCircle class="size-6 animate-spin" />
            <span class="text-xs">Opening theme…</span>
          </div>
        {:else}
          <div
            class="absolute left-1/2 top-1/2"
            style="transform:translate(calc(-50% + {canvasPanX}px), calc(-50% + {canvasPanY}px));"
          >
            <ContextMenu.Root bind:open={contextMenuOpen}>
              <ContextMenu.Trigger
                class="relative overflow-hidden rounded-xl border border-theme-700 shadow-2xl"
                style="width:{CANVAS_WIDTH * canvasScale}px;height:{CANVAS_HEIGHT * canvasScale}px;"
              >
                <div
                  style="width:{CANVAS_WIDTH}px;height:{CANVAS_HEIGHT}px;transform:scale({canvasScale});transform-origin:top left;"
                >
                  <ThemeStage
                    {definition}
                    assets={assetBase}
                    assetOverrides={previewAssets}
                    {selectedIds}
                    {selectedGroupId}
                    interactive
                    scale={canvasScale}
                    variables={previewScriptVariables}
                    onselect={(id, additive) => selectElement(id, additive)}
                    onselectmany={(ids, additive) => selectMany(ids, additive)}
                    onselectgroup={(id) => selectGroup(id)}
                    onmove={moveElements}
                    onpatch={(id, patch) => patchElement(id, patch)}
                    onpatchgroup={(id, patch) => patchGroup(id, patch)}
                    oncontext={(id) => prepareContextMenu(id)}
                    oncontextgroup={(id) => prepareGroupContextMenu(id)}
                  />
                </div>
              </ContextMenu.Trigger>

              <ContextMenu.Content class="w-56 border-theme-700 bg-theme-950">
                {@render contextMenuItems()}
              </ContextMenu.Content>
            </ContextMenu.Root>
          </div>

          {#if panMode}
            <div
              class="absolute inset-0 z-30 touch-none {panning ? 'cursor-grabbing' : 'cursor-grab'}"
              role="presentation"
              onpointerdown={startCanvasPan}
              onpointermove={moveCanvasPan}
              onpointerup={endCanvasPan}
              onpointercancel={endCanvasPan}
            ></div>
          {/if}
        {/if}
      </div>
      <div
        class="flex h-8 shrink-0 items-center justify-between border-t border-theme-800 px-4 text-[9px] text-muted-foreground"
      >
        <span> Drag to move · Wheel pan · Ctrl/Cmd+wheel zoom · Cmd/Ctrl+0 fit · ? shortcuts </span>
        <span class="font-mono">{elements.length} elements</span>
      </div>
    </main>

    <aside class="flex min-h-0 flex-col border-l border-theme-800 bg-theme-900/35">
      {#if leftTab === 'logic'}
        {#if selectedBehavior}
          <div class="min-h-0 flex-1 overflow-y-auto">
            <ThemeBehaviorInspector
              behavior={selectedBehavior}
              {elements}
              {groups}
              variables={scriptVariables}
              ondelete={() => deleteBehavior(selectedBehavior.id)}
            />
          </div>
        {:else}
          <div class="flex min-h-0 flex-1 items-center justify-center p-4">
            <div class="rounded-xl border border-theme-800 bg-black/20 p-4 text-center">
              <div
                class="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"
              >
                <Zap class="size-5" />
              </div>
              <p class="mt-3 text-xs font-semibold text-theme-100">Select a rule</p>
              <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Choose a rule on the left, or add one to start wiring interactions.
              </p>
              <Button
                variant="secondary"
                size="sm"
                class="mt-3 h-8 gap-1.5 text-[10px]"
                onclick={addBehavior}
              >
                <Plus class="size-3.5" />
                Add rule
              </Button>
            </div>
          </div>
        {/if}
      {:else if selectedIds.length > 1}
        <div class="flex shrink-0 items-center gap-1 border-b border-theme-800 p-2">
          <span class="flex-1 text-[10px] font-semibold text-theme-100">
            {selectedIds.length} layers selected
          </span>
          <Button
            variant="secondary"
            size="icon"
            class="size-8"
            title="Duplicate selected layers"
            onclick={duplicateSelected}
          >
            <Copy class="size-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            class="size-8"
            title="Delete selected layers"
            onclick={deleteSelected}
          >
            <Trash2 class="size-3.5" />
          </Button>
        </div>
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <ThemeSection
            title="Align"
            bordered={false}
            headingClass="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            contentClass="space-y-2 pt-2"
          >
            <div class="grid grid-cols-3 gap-1">
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('left')}>Left</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('center')}>Center</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('right')}>Right</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('top')}>Top</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('middle')}>Middle</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => alignSelected('bottom')}>Bottom</Button
              >
            </div>
          </ThemeSection>
          <ThemeSection
            title="Distribute"
            headingClass="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            contentClass="space-y-2 pt-2.5"
          >
            <div class="grid grid-cols-2 gap-1">
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => distributeSelected('horizontal')}>Horizontal</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => distributeSelected('vertical')}>Vertical</Button
              >
            </div>
            <p class="text-[10px] leading-relaxed text-muted-foreground">
              Distribute needs at least three selected layers.
            </p>
          </ThemeSection>
          <ThemeSection
            title="Layers"
            headingClass="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            contentClass="space-y-2 pt-2.5"
          >
            <div class="grid grid-cols-2 gap-1">
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => toggleSelectedFlag('hidden')}>Hide / show</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="h-8 text-[10px]"
                onclick={() => toggleSelectedFlag('locked')}>Lock / unlock</Button
              >
              <Button
                variant="secondary"
                size="sm"
                class="col-span-2 h-8 gap-1.5 text-[10px]"
                onclick={groupSelection}
              >
                <Boxes class="size-3.5" />
                Group selection
              </Button>
            </div>
            <p class="text-[10px] leading-relaxed text-muted-foreground">
              Use the alignment buttons to arrange a multi-layer selection. Press Escape to clear
              it.
            </p>
          </ThemeSection>
        </div>
      {:else if selectedGroup}
        <div class="flex shrink-0 items-center gap-1 border-b border-theme-800 p-2">
          <span class="min-w-0 flex-1 truncate text-[10px] font-semibold text-theme-100">
            {groupLabel(selectedGroup)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            class="h-8 px-2 text-[10px]"
            onclick={() => ungroupGroup()}
          >
            Ungroup
          </Button>
          <Button
            variant="secondary"
            size="icon"
            class="size-8"
            title="Duplicate group"
            aria-label="Duplicate group"
            onclick={() => duplicateGroup()}
          >
            <CopyPlus class="size-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            class="size-8"
            title="Delete group and its layers"
            aria-label="Delete group and its layers"
            onclick={() => requestGroupDelete()}
          >
            <Trash2 class="size-3.5" />
          </Button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <ThemeGroupInspector
            group={selectedGroup}
            {behaviors}
            {elements}
            {groups}
            variables={scriptVariables}
            focusToken={logicFocusKey === `group:${selectedGroup.id}` ? logicFocusToken : 0}
            onungroup={() => ungroupGroup()}
            onpickmask={pickGroupMask}
            onaddbehavior={createBehavior}
            ondeleterule={deleteBehavior}
          />
        </div>
      {:else if selectedElement}
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
            {elements}
            {behaviors}
            {groups}
            variables={scriptVariables}
            focusToken={logicFocusKey === `element:${selectedElement.id}` ? logicFocusToken : 0}
            onreplace={replaceSelectedAsset}
            onpickmask={pickElementMask}
            onpickrepeater={pickRepeaterImage}
            onaddbehavior={createBehavior}
            ondeleterule={deleteBehavior}
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
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={addSvelte}
            >
              <Component class="size-4 text-primary" />
              Svelte
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('data')}
            >
              <Type class="size-4 text-primary" />
              Data
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('icon')}
            >
              <Sparkles class="size-4 text-primary" />
              Icon
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('repeater')}
            >
              <Repeat class="size-4 text-primary" />
              Repeater
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('gauge')}
            >
              <Gauge class="size-4 text-primary" />
              Gauge
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('ticker')}
            >
              <Megaphone class="size-4 text-primary" />
              Ticker
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('button')}
            >
              <MousePointerClick class="size-4 text-primary" />
              Button
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('path')}
            >
              <Spline class="size-4 text-primary" />
              Path
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('particles')}
            >
              <Sparkles class="size-4 text-primary" />
              Particles
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('clock')}
            >
              <Clock class="size-4 text-primary" />
              Clock
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={() => addLayer('countdown')}
            >
              <Timer class="size-4 text-primary" />
              Countdown
            </Button>
            <Button
              variant="secondary"
              class="h-auto flex-col gap-1 p-3 text-[10px]"
              onclick={addLottie}
            >
              <Film class="size-4 text-primary" />
              Lottie
            </Button>
          </div>

          <ThemeSection
            title="Theme summary"
            class="mt-4"
            bordered={false}
            contentClass="space-y-2 pt-2"
          >
            <div class="space-y-2 rounded-lg border border-theme-800 bg-black/20 p-3">
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
                <span class="text-muted-foreground">Theme folder</span>
                <span class="max-w-[150px] truncate font-mono text-theme-100">
                  {savedFolder ?? 'not saved yet'}
                </span>
              </div>
            </div>
          </ThemeSection>

          <ThemeSection
            title="Shortcuts"
            class="mt-4"
            bordered={false}
            open={false}
            contentClass="space-y-1 rounded-lg border border-theme-800 bg-black/20 p-3 pt-3 text-[10px] leading-relaxed text-muted-foreground"
          >
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+Z</span> undo</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+Shift+Z</span> redo</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+S</span> save theme</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+F</span> find layers and groups</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl + / -</span> zoom canvas</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+0</span> fit canvas to window</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+C / X / V</span> copy, cut, paste</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+D</span> duplicate layer or group</p>
            <p><span class="font-mono text-theme-100">Cmd/Ctrl+A</span> select all layers</p>
            <p><span class="font-mono text-theme-100">Shift/Cmd+click</span> add to selection</p>
            <p><span class="font-mono text-theme-100">Arrows</span> nudge selected layers</p>
            <p>
              <span class="font-mono text-theme-100">Alt/Option+↑ / ↓</span> jump to layers or groups
              with logic
            </p>
            <p>
              <span class="font-mono text-theme-100">Delete</span> remove selected layers or group
            </p>
            <Button
              variant="ghost"
              size="sm"
              class="mt-2 h-6 w-full px-1 text-[10px] text-muted-foreground"
              onclick={() => (shortcutsOpen = true)}
            >
              <Keyboard class="size-3" />
              All shortcuts
            </Button>
          </ThemeSection>

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
      {#if draftSavedAt}
        Draft autosaved at {new Date(draftSavedAt).toLocaleTimeString()} · changes are local until you
        save
      {:else}
        Changes are local until you save. WebM is recommended for video backgrounds and layers.
      {/if}
    </span>
    <span>API 2.0 · advanced editor</span>
  </footer>

  {#if shortcutsOpen}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="presentation"
      onclick={(event) => {
        if (event.target === event.currentTarget) shortcutsOpen = false;
      }}
    >
      <div
        class="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-theme-700 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div class="flex items-center gap-3 border-b border-theme-800 p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
          >
            <Keyboard class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 id="shortcuts-title" class="text-sm font-semibold">Keyboard shortcuts</h2>
            <p class="mt-0.5 text-[10px] text-muted-foreground">
              Everything in the editor is reachable from the keyboard.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            title="Close shortcuts"
            aria-label="Close shortcuts"
            onclick={() => (shortcutsOpen = false)}
          >
            <X class="size-3.5" />
          </Button>
        </div>
        <div class="grid min-h-0 flex-1 gap-x-6 gap-y-0.5 overflow-y-auto p-4 sm:grid-cols-2">
          {#each shortcutRows as shortcut (shortcut.label)}
            <div
              class="flex items-center justify-between gap-3 border-b border-theme-800/70 px-1 py-1.5 text-[11px] last:border-0"
            >
              <span class="min-w-0 truncate text-muted-foreground">{shortcut.label}</span>
              <span class="flex shrink-0 items-center gap-1">
                {#each shortcut.keys as key, index (key)}
                  {#if index > 0}<span class="text-theme-600">+</span>{/if}
                  <kbd
                    class="rounded border border-theme-700 bg-theme-900 px-1.5 py-0.5 font-mono text-[9px] text-theme-100"
                  >
                    {key}
                  </kbd>
                {/each}
              </span>
            </div>
          {/each}
        </div>
        <div class="border-t border-theme-800 px-4 py-2 text-[9px] text-muted-foreground">
          Tip: press <kbd class="font-mono text-theme-100">?</kbd> anywhere in the editor to reopen this
          list.
        </div>
      </div>
    </div>
  {/if}

  {#if validationOpen && validationReport}
    {@const errors = validationReport.issues.filter((issue) => issue.level === 'error')}
    {@const warnings = validationReport.issues.filter((issue) => issue.level === 'warning')}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="presentation"
    >
      <div
        class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-theme-700 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-title"
      >
        <div class="flex items-start gap-3 border-b border-theme-800 p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg {errors.length
              ? 'bg-destructive/15 text-destructive'
              : 'bg-emerald-500/15 text-emerald-400'}"
          >
            {#if errors.length}
              <AlertTriangle class="size-4" />
            {:else}
              <CheckCircle2 class="size-4" />
            {/if}
          </div>
          <div class="min-w-0 flex-1">
            <h2 id="validation-title" class="text-sm font-semibold">Theme check</h2>
            <p class="mt-0.5 text-[10px] text-muted-foreground">
              {validationReport.fileCount} referenced asset{validationReport.fileCount === 1
                ? ''
                : 's'} · {formatBytes(validationReport.totalBytes)} estimated
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            title="Close check"
            onclick={() => {
              validationOpen = false;
              exportAfterValidation = false;
            }}
          >
            <X class="size-3.5" />
          </Button>
        </div>

        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {#if validationReport.issues.length === 0}
            <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs">
              Everything looks good. The theme is ready to export.
            </div>
          {:else}
            {#each [...errors, ...warnings] as issue (issue.level + issue.message)}
              <div
                class="flex gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed {issue.level ===
                'error'
                  ? 'border-destructive/25 bg-destructive/10 text-destructive'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-100'}"
              >
                {#if issue.level === 'error'}
                  <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
                {:else}
                  <ShieldCheck class="mt-0.5 size-3.5 shrink-0" />
                {/if}
                <span>{issue.message}</span>
              </div>
            {/each}
          {/if}
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-theme-800 p-3">
          <Button
            variant="secondary"
            size="sm"
            onclick={() => {
              validationOpen = false;
              exportAfterValidation = false;
            }}
          >
            Close
          </Button>
          {#if errors.length === 0 && exportAfterValidation}
            <Button
              size="sm"
              onclick={() => exportCurrentTheme(true)}
              disabled={exporting || saving}
            >
              {#if exporting}
                <LoaderCircle class="animate-spin" />
              {:else}
                <Download />
              {/if}
              {warnings.length ? 'Export anyway' : 'Export theme'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if closeDialogOpen}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-theme-700 bg-theme-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-title"
      >
        <h2 id="close-title" class="text-sm font-semibold">Save before closing?</h2>
        <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
          This theme has unsaved changes. Save them, discard them, or keep editing.
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onclick={() => (closeDialogOpen = false)}
            disabled={saving}
          >
            Keep editing
          </Button>
          <Button variant="destructive" size="sm" onclick={discardAndClose} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onclick={saveAndClose} disabled={saving}>
            {#if saving}
              <LoaderCircle class="animate-spin" />
            {:else}
              <Save />
            {/if}
            Save and close
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if deleteGroupTarget}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-theme-700 bg-theme-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive"
          >
            <Trash2 class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 id="delete-group-title" class="text-sm font-semibold">
              Delete “{groupLabel(deleteGroupTarget)}”?
            </h2>
            <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
              {#if deleteGroupLayerCount > 0}
                <strong class="text-theme-100">{deleteGroupLayerLabel}</strong>
                {#if deleteGroupNestedCount > 0}
                  and <strong class="text-theme-100">{deleteGroupNestedLabel}</strong>
                {/if}
                will be deleted with this group.
              {:else if deleteGroupNestedCount > 0}
                This group has no layers, but
                <strong class="text-theme-100">{deleteGroupNestedLabel}</strong> will be deleted with
                it.
              {:else}
                This group has no layers.
              {/if}
            </p>
            <p class="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
              You can undo this with Cmd/Ctrl+Z.
            </p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onclick={() => (deleteGroupId = undefined)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onclick={confirmGroupDelete}>
            <Trash2 class="size-3.5" />
            Delete group
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
