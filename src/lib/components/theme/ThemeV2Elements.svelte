<script lang="ts">
  import ThemeCustomLayer from '$lib/components/theme/ThemeCustomLayer.svelte';
  import ThemeIcon from '$lib/components/theme/ThemeIcon.svelte';
  import ThemeLottieLayer from '$lib/components/theme/ThemeLottieLayer.svelte';
  import { resolveThemeDataValue, themeGlobalData } from '$lib/themeData';
  import { fontStack } from '$lib/themeFonts';
  import { DEFAULT_THEME_ICON_SET, type ThemeIconSet } from '$lib/themeIcons';
  import {
    themeArcGeometry,
    themeClockDate,
    themeClockTime,
    themeCountdownText,
    themeParticleSeeds,
    themeSvgGradientVector,
  } from '$lib/themeLayers';
  import { themeMediaSource, themeVideoLifecycle } from '$lib/themeMedia';
  import { interpolateThemeText } from '$lib/themeTextVariables';
  import {
    themeAssetUrl,
    themeClassNames,
    themeElementTransformCss,
    themeFilterCss,
    themeGroupAncestors,
    themeGroupBounds,
    themeGroupMaskCss,
    themeGroupParentMatrix,
    themeGroupPath,
    themeGroupTransformMatrix,
    themeMaskClipPath,
    themeMaskImageCss,
    themeMaskPolygonPoints,
    themeTextStyleCss,
    themeTransformLinearMatrix,
    themeTransformPoint,
    themeTransformScaleMatrix,
    type ThemeV2ButtonAction,
    type ThemeV2Element,
    type ThemeV2Group,
    type ThemeV2Point,
    type ThemeV2ScriptValue,
  } from '$lib/themeV2';
  import { Boxes, ChevronRight, Move, RotateCw } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  let {
    elements = [],
    groups = [],
    assets = '',
    assetOverrides = {},
    screen = 'home',
    themeName = '',
    themeAuthor = '',
    themeVersion = '',
    accentColor = '#ff006e',
    iconSet = DEFAULT_THEME_ICON_SET,
    interactive = false,
    selectedIds = [],
    selectedGroupId,
    scale = 1,
    visibility = {},
    groupVisibility = {},
    variables = {},
    oninteraction,
    onselect,
    onselectmany,
    onselectgroup,
    onmove,
    onpatch,
    onpatchgroup,
    oncontext,
    oncontextgroup,
    onbuttonaction,
  }: {
    elements?: ThemeV2Element[];
    groups?: ThemeV2Group[];
    assets?: string;
    assetOverrides?: Record<string, string>;
    screen?: string;
    themeName?: string;
    themeAuthor?: string;
    themeVersion?: string;
    accentColor?: string;
    iconSet?: ThemeIconSet;
    interactive?: boolean;
    selectedIds?: string[];
    selectedGroupId?: string;
    scale?: number;
    visibility?: Record<string, boolean>;
    groupVisibility?: Record<string, boolean>;
    /** Rule variables available to `{name}` placeholders in text layers. */
    variables?: Record<string, ThemeV2ScriptValue>;
    oninteraction?: (id: string, type: 'click' | 'hover' | 'leave') => void;
    onselect?: (id: string | undefined, additive?: boolean) => void;
    onselectmany?: (ids: string[], additive?: boolean) => void;
    onselectgroup?: (id: string) => void;
    onmove?: (updates: { id: string; x: number; y: number }[]) => void;
    onpatch?: (id: string, patch: Record<string, unknown>) => void;
    onpatchgroup?: (id: string, patch: Partial<ThemeV2Group>) => void;
    oncontext?: (id: string | undefined, event: MouseEvent) => void;
    oncontextgroup?: (id: string, event: MouseEvent) => void;
    onbuttonaction?: (action: ThemeV2ButtonAction) => void;
  } = $props();

  const assetUrl = (path: string) => assetOverrides[path] ?? themeAssetUrl(assets, path);

  const ancestorsOf = (element: ThemeV2Element) => themeGroupAncestors(groups, element);
  const isElementHidden = (element: ThemeV2Element) => {
    const ancestors = ancestorsOf(element);
    if (ancestors.some((group) => groupVisibility[group.id] === false)) return true;
    const override = visibility[element.id];
    if (override !== undefined) return override;
    if (ancestors.some((group) => groupVisibility[group.id] === true)) return false;
    return element.hidden === true || ancestors.some((group) => group.hidden === true);
  };
  const isElementLocked = (element: ThemeV2Element) =>
    element.locked === true || ancestorsOf(element).some((group) => group.locked === true);
  const elementOpacity = (element: ThemeV2Element) =>
    ancestorsOf(element).reduce(
      (opacity, group) => opacity * (group.opacity ?? 1),
      element.opacity ?? 1
    );
  const elementFilter = (element: ThemeV2Element) =>
    themeFilterCss(element.filters, ...ancestorsOf(element).map((group) => group.filters));
  const elementClassNames = (element: ThemeV2Element) =>
    themeClassNames(
      [...ancestorsOf(element).map((group) => group.cssClasses), element.cssClasses]
        .filter(Boolean)
        .join(' ')
    );

  const visibleElements = $derived(elements.filter((element) => !isElementHidden(element)));

  let clockNow = $state(new Date());
  const usesClock = $derived(
    visibleElements.some(
      (element) =>
        (element.type === 'data' && element.field.startsWith('clock.')) ||
        element.type === 'clock' ||
        element.type === 'countdown'
    )
  );

  $effect(() => {
    if (!usesClock) return;
    const timer = window.setInterval(() => (clockNow = new Date()), 1000);
    return () => window.clearInterval(timer);
  });

  const dataValue = (element: Extract<ThemeV2Element, { type: 'data' }>) => {
    const raw = resolveThemeDataValue(element.field, {
      global: $themeGlobalData,
      theme: { name: themeName, author: themeAuthor, version: themeVersion },
      screen,
      mode: element.mode,
      now: clockNow,
    });
    const template = element.text?.trim() ? element.text : '{value}';
    return interpolateThemeText(template.replaceAll('{value}', raw), variables);
  };

  const maskedAncestors = (element: ThemeV2Element) =>
    ancestorsOf(element)
      .filter((group) => group.mask)
      .reverse();

  const shapePoints = (element: Extract<ThemeV2Element, { type: 'shape' }>) =>
    themeMaskPolygonPoints(
      element.points ?? 6,
      element.shape === 'star',
      element.innerRadius ?? 0.5
    );

  const shapeClip = (element: Extract<ThemeV2Element, { type: 'shape' }>) => {
    if (element.shape !== 'polygon' && element.shape !== 'star') return 'none';
    return `polygon(${shapePoints(element)
      .map((point) => `${point.x}% ${point.y}%`)
      .join(', ')})`;
  };

  const imageTintStyle = (element: Extract<ThemeV2Element, { type: 'image' }>) => {
    const url = assetUrl(element.src).replace(/["\\)]/g, '');
    return [
      `background-color:${element.tint || 'transparent'}`,
      `-webkit-mask-image:url("${url}")`,
      `mask-image:url("${url}")`,
      `-webkit-mask-size:${element.fit === 'contain' ? 'contain' : '100% 100%'}`,
      `mask-size:${element.fit === 'contain' ? 'contain' : '100% 100%'}`,
      '-webkit-mask-position:center',
      'mask-position:center',
      '-webkit-mask-repeat:no-repeat',
      'mask-repeat:no-repeat',
      `border-radius:${element.radius ?? 0}px`,
    ].join(';');
  };

  const shapeFill = (element: Extract<ThemeV2Element, { type: 'shape' }>) =>
    element.fillMode === 'gradient'
      ? `linear-gradient(${element.gradientAngle ?? 135}deg, ${element.gradientFrom ?? '#ff006e'}, ${element.gradientTo ?? '#7c3aed'})`
      : (element.fill ?? '#ff006e');

  const shapeRadius = (element: Extract<ThemeV2Element, { type: 'shape' }>) => {
    const radii = element.cornerRadii ?? [
      element.radius ?? 16,
      element.radius ?? 16,
      element.radius ?? 16,
      element.radius ?? 16,
    ];
    return radii.map((radius) => `${Math.max(0, radius)}px`).join(' ');
  };

  const svgGradientId = (prefix: string, id: string) =>
    `${prefix}-${id.replace(/[^A-Za-z0-9_-]/g, '')}`;

  const pathDash = (element: Extract<ThemeV2Element, { type: 'path' }>) => {
    const width = Math.max(0, element.strokeWidth ?? 0);
    if (!width || element.strokeStyle === 'solid') return undefined;
    return element.strokeStyle === 'dotted'
      ? `${width * 0.1} ${width * 1.8}`
      : `${width * 3} ${width * 2}`;
  };

  const arcGeometry = (element: Extract<ThemeV2Element, { type: 'shape' }>) =>
    themeArcGeometry(
      element.startAngle ?? 0,
      element.endAngle ?? 270,
      element.thickness ?? 12,
      element.width,
      element.height
    );

  const clockCaptionSize = (element: Extract<ThemeV2Element, { type: 'clock' }>) =>
    Math.max(9, Math.round((element.fontSize ?? 40) * 0.32));

  const analogHands = (now: Date) => {
    const seconds = now.getSeconds();
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    return {
      hour: hours * 30,
      minute: minutes * 6,
      second: seconds * 6,
    };
  };

  const MAX_REPEATER_TILES = 240;
  const repeaterTiles = (element: Extract<ThemeV2Element, { type: 'repeater' }>) => {
    const tileWidth = Math.max(4, element.tileWidth ?? 28);
    const tileHeight = Math.max(4, element.tileHeight ?? 28);
    const gapX = Math.max(0, element.gapX ?? 8);
    const gapY = Math.max(0, element.gapY ?? 8);
    const columns =
      element.columns && element.columns > 0
        ? element.columns
        : Math.max(1, Math.floor((element.width + gapX) / (tileWidth + gapX)));
    const rows =
      element.rows && element.rows > 0
        ? element.rows
        : Math.max(1, Math.floor((element.height + gapY) / (tileHeight + gapY)));
    const total = Math.min(MAX_REPEATER_TILES, columns * rows);
    return { columns, rows, total, tileWidth, tileHeight, gapX, gapY };
  };

  const gaugePercent = (element: Extract<ThemeV2Element, { type: 'gauge' }>) => {
    const variable = element.variable ? Number(variables[element.variable]) : Number.NaN;
    const value = Number.isFinite(variable) ? variable : (element.value ?? 0.5);
    return Math.min(1, Math.max(0, value));
  };

  const gaugeLabel = (element: Extract<ThemeV2Element, { type: 'gauge' }>) => {
    const percent = gaugePercent(element);
    const template = element.label?.trim() ? element.label : '';
    return interpolateThemeText(
      template
        .replaceAll('{percent}', String(Math.round(percent * 100)))
        .replaceAll('{value}', percent.toFixed(2)),
      variables
    );
  };

  // Keep the live muted property in sync, including live editor toggles.
  function applyMuted(node: HTMLVideoElement, muted: boolean) {
    node.muted = muted;
    return {
      update(value: boolean) {
        node.muted = value;
      },
    };
  }

  type ElementOrigin = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  type DragState = {
    ids: string[];
    startX: number;
    startY: number;
    origins: ElementOrigin[];
  };

  type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

  type ResizeState = {
    id: string;
    direction: ResizeDirection;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
  };

  type ElementRotateState = {
    id: string;
    startAngle: number;
    originRotation: number;
    parentInverse: { a: number; b: number; c: number; d: number };
    scaleInverse: { a: number; b: number; c: number; d: number };
    center: ThemeV2Point;
  };

  type MarqueeState = {
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    additive: boolean;
  };

  type GroupFrame = {
    group: ThemeV2Group;
    bounds: {
      left: number;
      top: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
    };
    corners: ThemeV2Point[];
    center: ThemeV2Point;
    topCenter: ThemeV2Point;
    rotationHandle: ThemeV2Point;
    labelPoint: ThemeV2Point;
    locked: boolean;
  };

  type GroupMoveState = {
    id: string;
    start: ThemeV2Point;
    originX: number;
    originY: number;
    inverse: { a: number; b: number; c: number; d: number };
  };

  type GroupRotateState = {
    id: string;
    startAngle: number;
    originRotation: number;
    parentInverse: { a: number; b: number; c: number; d: number };
    scaleInverse: { a: number; b: number; c: number; d: number };
    center: ThemeV2Point;
  };

  type GroupScaleState = {
    id: string;
    startDistance: number;
    originScaleX: number;
    originScaleY: number;
    parentInverse: { a: number; b: number; c: number; d: number };
    anchorVector: ThemeV2Point;
    anchorLocal: ThemeV2Point;
    center: ThemeV2Point;
    originX: number;
    originY: number;
    linear: { a: number; b: number; c: number; d: number };
  };

  const resizeDirections: ResizeDirection[] = ['nw', 'ne', 'sw', 'se'];
  const SNAP_DISTANCE = 6;

  let overlay = $state<HTMLDivElement | undefined>(undefined);
  let drag = $state<DragState | null>(null);
  let resize = $state<ResizeState | null>(null);
  let elementRotate = $state<ElementRotateState | null>(null);
  let marquee = $state<MarqueeState | null>(null);
  let snapGuides = $state<{ x?: number; y?: number }>({});
  let groupMove = $state<GroupMoveState | null>(null);
  let groupRotate = $state<GroupRotateState | null>(null);
  let groupScale = $state<GroupScaleState | null>(null);
  let hoveredGroupId = $state<string | undefined>(undefined);
  let hoverHideTimer: number | undefined;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const selectedSet = $derived(new SvelteSet(selectedIds));

  const isSelected = (id: string) => interactive && selectedSet.has(id);

  const groupChain = (group: ThemeV2Group) => themeGroupAncestors(groups, { groupId: group.id });
  const groupLabel = (group: ThemeV2Group) => group.name?.trim() || 'Group';
  const groupScaleLabel = (group: ThemeV2Group) => {
    const x = Math.round((group.scaleX ?? group.scale ?? 1) * 100);
    const y = Math.round((group.scaleY ?? group.scale ?? 1) * 100);
    return x === y ? `${x}%` : `${x}×${y}%`;
  };
  const isGroupHidden = (group: ThemeV2Group) =>
    groupChain(group).some((candidate) => candidate.hidden === true);
  const isGroupLocked = (group: ThemeV2Group) =>
    groupChain(group).some((candidate) => candidate.locked === true);

  function buildGroupFrame(group: ThemeV2Group): GroupFrame | undefined {
    if (isGroupHidden(group)) return undefined;

    const bounds = themeGroupBounds(groups, elements, group.id);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return undefined;

    const matrix = themeGroupTransformMatrix(group, elements, groups);
    const corners = [
      themeTransformPoint(matrix, bounds.left, bounds.top),
      themeTransformPoint(matrix, bounds.left + bounds.width, bounds.top),
      themeTransformPoint(matrix, bounds.left + bounds.width, bounds.top + bounds.height),
      themeTransformPoint(matrix, bounds.left, bounds.top + bounds.height),
    ];
    const center = themeTransformPoint(matrix, bounds.centerX, bounds.centerY);
    const topCenter = {
      x: (corners[0].x + corners[1].x) / 2,
      y: (corners[0].y + corners[1].y) / 2,
    };
    const normalX = topCenter.x - center.x;
    const normalY = topCenter.y - center.y;
    const normalLength = Math.hypot(normalX, normalY) || 1;

    return {
      group,
      bounds,
      corners,
      center,
      topCenter,
      rotationHandle: {
        x: topCenter.x + (normalX / normalLength) * 28,
        y: topCenter.y + (normalY / normalLength) * 28,
      },
      labelPoint: {
        x: clamp(topCenter.x + (normalX / normalLength) * 12, 112, 888),
        y: clamp(topCenter.y + (normalY / normalLength) * 12, 30, 638),
      },
      locked: isGroupLocked(group),
    };
  }

  const groupFrame = $derived.by<GroupFrame | undefined>(() => {
    if (!interactive || !selectedGroupId) return undefined;
    const group = groups.find((candidate) => candidate.id === selectedGroupId);
    return group ? buildGroupFrame(group) : undefined;
  });

  const hoverGroupFrame = $derived.by<GroupFrame | undefined>(() => {
    if (!interactive || !hoveredGroupId) return undefined;
    const group = groups.find((candidate) => candidate.id === hoveredGroupId);
    return group ? buildGroupFrame(group) : undefined;
  });

  const triggerInteraction = (element: ThemeV2Element, type: 'click' | 'hover' | 'leave') => {
    if (interactive || !element.interactive) return;
    oninteraction?.(element.id, type);
  };

  function cancelHoverHide() {
    if (hoverHideTimer !== undefined) {
      window.clearTimeout(hoverHideTimer);
      hoverHideTimer = undefined;
    }
  }

  function scheduleHoverHide() {
    cancelHoverHide();
    hoverHideTimer = window.setTimeout(() => {
      hoveredGroupId = undefined;
      hoverHideTimer = undefined;
    }, 220);
  }

  function showGroupHover(element: ThemeV2Element) {
    if (!interactive) return;
    if (!element.groupId) {
      scheduleHoverHide();
      return;
    }

    const group = groups.find((candidate) => candidate.id === element.groupId);
    if (!group) {
      scheduleHoverHide();
      return;
    }

    hoveredGroupId = group.id;
    cancelHoverHide();
  }

  function selectHoveredGroup(groupId = hoveredGroupId) {
    if (!groupId) return;
    onselectgroup?.(groupId);
    hoveredGroupId = undefined;
    cancelHoverHide();
  }

  onDestroy(cancelHoverHide);

  const modifierPressed = (event: PointerEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;

  function selectElement(id: string | undefined, additive = false) {
    onselect?.(id, additive);
  }

  function beginDrag(event: PointerEvent, element: ThemeV2Element) {
    if (!interactive || event.button !== 0) return;
    const handle = (event.target as HTMLElement).dataset;
    if (handle.resize || handle.rotate) return;

    event.preventDefault();
    event.stopPropagation();

    const additive = modifierPressed(event);
    if (additive) {
      selectElement(element.id, true);
      return;
    }

    if (isElementLocked(element)) {
      selectElement(element.id, false);
      return;
    }

    const keepGroup = selectedSet.has(element.id) && selectedIds.length > 1;
    if (!keepGroup) selectElement(element.id, false);

    const candidateIds = keepGroup ? [...selectedIds] : [element.id];
    const origins = candidateIds
      .map((id) => elements.find((candidate) => candidate.id === id))
      .filter(
        (candidate): candidate is ThemeV2Element =>
          candidate !== undefined && !isElementLocked(candidate)
      )
      .map((candidate) => ({
        id: candidate.id,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      }));

    if (origins.length === 0) return;

    drag = {
      ids: origins.map((origin) => origin.id),
      startX: event.clientX,
      startY: event.clientY,
      origins,
    };
    snapGuides = {};
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
  }

  function groupBounds(origins: ElementOrigin[]) {
    const left = Math.min(...origins.map((origin) => origin.x));
    const top = Math.min(...origins.map((origin) => origin.y));
    const right = Math.max(...origins.map((origin) => origin.x + origin.width));
    const bottom = Math.max(...origins.map((origin) => origin.y + origin.height));
    return { left, top, right, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
  }

  function closestSnap(
    lines: number[],
    candidates: number[]
  ): { delta: number; guide: number } | undefined {
    let best: { delta: number; guide: number } | undefined;

    for (const line of lines) {
      for (const candidate of candidates) {
        const delta = candidate - line;
        if (Math.abs(delta) > SNAP_DISTANCE) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, guide: candidate };
        }
      }
    }

    return best;
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;

    const bounds = groupBounds(drag.origins);
    const rawDx = (event.clientX - drag.startX) / scale;
    const rawDy = (event.clientY - drag.startY) / scale;
    let dx = clamp(rawDx, -bounds.left, 1000 - bounds.right);
    let dy = clamp(rawDy, -bounds.top, 650 - bounds.bottom);

    if (!event.altKey) {
      const others = visibleElements.filter((element) => !drag!.ids.includes(element.id));
      const xCandidates = [
        0,
        500,
        1000,
        ...others.flatMap((element) => [
          element.x,
          element.x + element.width / 2,
          element.x + element.width,
        ]),
      ];
      const yCandidates = [
        0,
        325,
        650,
        ...others.flatMap((element) => [
          element.y,
          element.y + element.height / 2,
          element.y + element.height,
        ]),
      ];

      const xSnap = closestSnap(
        [bounds.left + dx, bounds.centerX + dx, bounds.right + dx],
        xCandidates
      );
      const ySnap = closestSnap(
        [bounds.top + dy, bounds.centerY + dy, bounds.bottom + dy],
        yCandidates
      );

      if (xSnap) dx += xSnap.delta;
      if (ySnap) dy += ySnap.delta;
      snapGuides = { x: xSnap?.guide, y: ySnap?.guide };
    } else {
      snapGuides = {};
    }

    dx = clamp(dx, -bounds.left, 1000 - bounds.right);
    dy = clamp(dy, -bounds.top, 650 - bounds.bottom);

    onmove?.(
      drag.origins.map((origin) => ({
        id: origin.id,
        x: Math.round(clamp(origin.x + dx, 0, 1000 - origin.width)),
        y: Math.round(clamp(origin.y + dy, 0, 650 - origin.height)),
      }))
    );
  }

  function endDrag() {
    drag = null;
    snapGuides = {};
    window.removeEventListener('pointermove', moveDrag);
  }

  function beginResize(event: PointerEvent, element: ThemeV2Element, direction: ResizeDirection) {
    if (!interactive || isElementLocked(element)) return;
    event.preventDefault();
    event.stopPropagation();
    resize = {
      id: element.id,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height,
    };
    window.addEventListener('pointermove', moveResize);
    window.addEventListener('pointerup', endResize, { once: true });
  }

  function moveResize(event: PointerEvent) {
    if (!resize) return;
    const dx = (event.clientX - resize.startX) / scale;
    const dy = (event.clientY - resize.startY) / scale;
    const west = resize.direction.includes('w');
    const north = resize.direction.includes('n');
    const width = Math.round(clamp(resize.originWidth + (west ? -dx : dx), 24, 1000));
    const height = Math.round(clamp(resize.originHeight + (north ? -dy : dy), 24, 650));
    onpatch?.(resize.id, {
      x: west
        ? Math.round(clamp(resize.originX + resize.originWidth - width, 0, 1000 - width))
        : resize.originX,
      y: north
        ? Math.round(clamp(resize.originY + resize.originHeight - height, 0, 650 - height))
        : resize.originY,
      width,
      height,
    });
  }

  function endResize() {
    resize = null;
    window.removeEventListener('pointermove', moveResize);
  }

  function beginElementRotate(event: PointerEvent, element: ThemeV2Element) {
    if (!interactive || isElementLocked(element) || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(element.id, false);

    const parent = ancestorsOf(element)[0];
    const parentMatrix = parent
      ? themeGroupTransformMatrix(parent, elements, groups)
      : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const center = themeTransformPoint(
      parentMatrix,
      element.x + element.width / 2,
      element.y + element.height / 2
    );
    const parentInverse = invertLinear(parentMatrix);
    const scaleInverse = invertLinear(themeTransformScaleMatrix(element));
    const point = stagePoint(event);
    const parentLocal = applyLinear(parentInverse, point.x - center.x, point.y - center.y);
    const local = applyLinear(scaleInverse, parentLocal.x, parentLocal.y);

    elementRotate = {
      id: element.id,
      startAngle: Math.atan2(local.y, local.x),
      originRotation: element.rotation ?? 0,
      parentInverse,
      scaleInverse,
      center,
    };
    window.addEventListener('pointermove', moveElementRotate);
    window.addEventListener('pointerup', endElementRotate, { once: true });
  }

  function moveElementRotate(event: PointerEvent) {
    if (!elementRotate) return;
    const point = stagePoint(event);
    const parentLocal = applyLinear(
      elementRotate.parentInverse,
      point.x - elementRotate.center.x,
      point.y - elementRotate.center.y
    );
    const local = applyLinear(elementRotate.scaleInverse, parentLocal.x, parentLocal.y);
    let delta = Math.atan2(local.y, local.x) - elementRotate.startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    let rotation = elementRotate.originRotation + (delta * 180) / Math.PI;
    if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
    onpatch?.(elementRotate.id, {
      rotation: roundTo(normalizeDegrees(rotation), 1),
    });
  }

  function endElementRotate() {
    elementRotate = null;
    window.removeEventListener('pointermove', moveElementRotate);
  }

  function beginMarquee(event: PointerEvent) {
    if (!interactive || event.button !== 0 || event.target !== event.currentTarget || !overlay) {
      return;
    }

    const rect = overlay.getBoundingClientRect();
    const startX = clamp((event.clientX - rect.left) / scale, 0, 1000);
    const startY = clamp((event.clientY - rect.top) / scale, 0, 650);
    const additive = modifierPressed(event);

    if (!additive) onselectmany?.([], false);

    marquee = { startX, startY, x: startX, y: startY, width: 0, height: 0, additive };
    window.addEventListener('pointermove', moveMarquee);
    window.addEventListener('pointerup', endMarquee, { once: true });
  }

  function moveMarquee(event: PointerEvent) {
    if (!marquee || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    const currentX = clamp((event.clientX - rect.left) / scale, 0, 1000);
    const currentY = clamp((event.clientY - rect.top) / scale, 0, 650);

    marquee = {
      ...marquee,
      x: Math.min(marquee.startX, currentX),
      y: Math.min(marquee.startY, currentY),
      width: Math.abs(currentX - marquee.startX),
      height: Math.abs(currentY - marquee.startY),
    };
  }

  function endMarquee() {
    if (!marquee) return;
    const selection = marquee;
    marquee = null;
    window.removeEventListener('pointermove', moveMarquee);

    if (selection.width < 3 && selection.height < 3) {
      return;
    }

    const hits = visibleElements
      .filter(
        (element) =>
          !element.locked &&
          element.x < selection.x + selection.width &&
          element.x + element.width > selection.x &&
          element.y < selection.y + selection.height &&
          element.y + element.height > selection.y
      )
      .map((element) => element.id);

    onselectmany?.(hits, selection.additive);
  }

  function stagePoint(event: PointerEvent): ThemeV2Point {
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    const safeScale = Math.max(0.0001, scale);
    return {
      x: (event.clientX - rect.left) / safeScale,
      y: (event.clientY - rect.top) / safeScale,
    };
  }

  function invertLinear(matrix: { a: number; b: number; c: number; d: number }) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(determinant) < 0.000001) return { a: 1, b: 0, c: 0, d: 1 };
    return {
      a: matrix.d / determinant,
      b: -matrix.b / determinant,
      c: -matrix.c / determinant,
      d: matrix.a / determinant,
    };
  }

  function applyLinear(
    matrix: { a: number; b: number; c: number; d: number },
    x: number,
    y: number
  ) {
    return { x: matrix.a * x + matrix.c * y, y: matrix.b * x + matrix.d * y };
  }

  const roundTo = (value: number, decimals: number) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };

  const normalizeDegrees = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

  function beginGroupMove(event: PointerEvent, frame: GroupFrame) {
    if (!interactive || frame.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onselectgroup?.(frame.group.id);

    const parent = themeGroupParentMatrix(frame.group, elements, groups);
    groupMove = {
      id: frame.group.id,
      start: stagePoint(event),
      originX: frame.group.offsetX ?? 0,
      originY: frame.group.offsetY ?? 0,
      inverse: invertLinear(parent),
    };
    snapGuides = {};
    window.addEventListener('pointermove', moveGroupMove);
    window.addEventListener('pointerup', endGroupMove, { once: true });
  }

  function moveGroupMove(event: PointerEvent) {
    if (!groupMove) return;
    const group = groups.find((candidate) => candidate.id === groupMove?.id);
    if (!group) return;

    const point = stagePoint(event);
    const stageX = point.x - groupMove.start.x;
    const stageY = point.y - groupMove.start.y;
    const local = applyLinear(groupMove.inverse, stageX, stageY);
    let nextX = groupMove.originX + local.x;
    let nextY = groupMove.originY + local.y;

    if (!event.altKey) {
      const bounds = themeGroupBounds(groups, elements, group.id);
      if (bounds) {
        const others = visibleElements.filter(
          (element) =>
            !themeGroupAncestors(groups, element).some((ancestor) => ancestor.id === group.id)
        );
        const xCandidates = [
          0,
          500,
          1000,
          ...others.flatMap((element) => [
            element.x,
            element.x + element.width / 2,
            element.x + element.width,
          ]),
        ];
        const yCandidates = [
          0,
          325,
          650,
          ...others.flatMap((element) => [
            element.y,
            element.y + element.height / 2,
            element.y + element.height,
          ]),
        ];
        const frameAt = (offsetX: number, offsetY: number) => {
          const matrix = themeGroupTransformMatrix(
            { ...group, offsetX, offsetY },
            elements,
            groups
          );
          const corners = [
            themeTransformPoint(matrix, bounds.left, bounds.top),
            themeTransformPoint(matrix, bounds.left + bounds.width, bounds.top),
            themeTransformPoint(matrix, bounds.left + bounds.width, bounds.top + bounds.height),
            themeTransformPoint(matrix, bounds.left, bounds.top + bounds.height),
          ];
          const left = Math.min(...corners.map((corner) => corner.x));
          const top = Math.min(...corners.map((corner) => corner.y));
          const right = Math.max(...corners.map((corner) => corner.x));
          const bottom = Math.max(...corners.map((corner) => corner.y));
          return {
            left,
            top,
            right,
            bottom,
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2,
          };
        };

        let frameBounds = frameAt(nextX, nextY);
        const xSnap = closestSnap(
          [frameBounds.left, frameBounds.centerX, frameBounds.right],
          xCandidates
        );
        if (xSnap) {
          const correction = applyLinear(groupMove.inverse, xSnap.delta, 0);
          nextX += correction.x;
          nextY += correction.y;
        }

        frameBounds = frameAt(nextX, nextY);
        const ySnap = closestSnap(
          [frameBounds.top, frameBounds.centerY, frameBounds.bottom],
          yCandidates
        );
        if (ySnap) {
          const correction = applyLinear(groupMove.inverse, 0, ySnap.delta);
          nextX += correction.x;
          nextY += correction.y;
        }

        snapGuides = { x: xSnap?.guide, y: ySnap?.guide };
      }
    } else {
      snapGuides = {};
    }

    onpatchgroup?.(groupMove.id, {
      offsetX: Math.round(clamp(nextX, -2000, 2000) * 10) / 10,
      offsetY: Math.round(clamp(nextY, -2000, 2000) * 10) / 10,
    });
  }

  function endGroupMove() {
    groupMove = null;
    snapGuides = {};
    window.removeEventListener('pointermove', moveGroupMove);
  }

  function beginGroupRotate(event: PointerEvent, frame: GroupFrame) {
    if (!interactive || frame.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onselectgroup?.(frame.group.id);

    const parent = themeGroupParentMatrix(frame.group, elements, groups);
    const parentInverse = invertLinear(parent);
    const scaleInverse = invertLinear(themeTransformScaleMatrix(frame.group));
    const point = stagePoint(event);
    const parentLocal = applyLinear(
      parentInverse,
      point.x - frame.center.x,
      point.y - frame.center.y
    );
    const local = applyLinear(scaleInverse, parentLocal.x, parentLocal.y);
    groupRotate = {
      id: frame.group.id,
      startAngle: Math.atan2(local.y, local.x),
      originRotation: frame.group.rotation ?? 0,
      parentInverse,
      scaleInverse,
      center: frame.center,
    };
    window.addEventListener('pointermove', moveGroupRotate);
    window.addEventListener('pointerup', endGroupRotate, { once: true });
  }

  function moveGroupRotate(event: PointerEvent) {
    if (!groupRotate) return;
    const point = stagePoint(event);
    const parentLocal = applyLinear(
      groupRotate.parentInverse,
      point.x - groupRotate.center.x,
      point.y - groupRotate.center.y
    );
    const local = applyLinear(groupRotate.scaleInverse, parentLocal.x, parentLocal.y);
    let delta = Math.atan2(local.y, local.x) - groupRotate.startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    let rotation = groupRotate.originRotation + (delta * 180) / Math.PI;
    if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
    onpatchgroup?.(groupRotate.id, {
      rotation: roundTo(normalizeDegrees(rotation), 1),
    });
  }

  function endGroupRotate() {
    groupRotate = null;
    window.removeEventListener('pointermove', moveGroupRotate);
  }

  function beginGroupScale(event: PointerEvent, frame: GroupFrame, cornerIndex: number) {
    if (!interactive || frame.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onselectgroup?.(frame.group.id);

    const { bounds } = frame;
    const anchorIndex = (cornerIndex + 2) % 4;
    const baseCorners = [
      { x: bounds.left, y: bounds.top },
      { x: bounds.left + bounds.width, y: bounds.top },
      { x: bounds.left + bounds.width, y: bounds.top + bounds.height },
      { x: bounds.left, y: bounds.top + bounds.height },
    ];
    const anchorStage = frame.corners[anchorIndex];
    const point = stagePoint(event);
    const parentInverse = invertLinear(themeGroupParentMatrix(frame.group, elements, groups));
    const center = frame.center;
    const anchorVector = applyLinear(
      parentInverse,
      anchorStage.x - center.x,
      anchorStage.y - center.y
    );
    const pointerVector = applyLinear(parentInverse, point.x - center.x, point.y - center.y);
    groupScale = {
      id: frame.group.id,
      startDistance: Math.max(
        1,
        Math.hypot(pointerVector.x - anchorVector.x, pointerVector.y - anchorVector.y)
      ),
      originScaleX: Math.max(0.05, frame.group.scaleX ?? frame.group.scale ?? 1),
      originScaleY: Math.max(0.05, frame.group.scaleY ?? frame.group.scale ?? 1),
      parentInverse,
      anchorVector,
      anchorLocal: baseCorners[anchorIndex],
      center,
      originX: frame.group.offsetX ?? 0,
      originY: frame.group.offsetY ?? 0,
      linear: themeTransformLinearMatrix(frame.group),
    };
    window.addEventListener('pointermove', moveGroupScale);
    window.addEventListener('pointerup', endGroupScale, { once: true });
  }

  function moveGroupScale(event: PointerEvent) {
    if (!groupScale) return;
    const point = stagePoint(event);
    const pointerVector = applyLinear(
      groupScale.parentInverse,
      point.x - groupScale.center.x,
      point.y - groupScale.center.y
    );
    const distance = Math.hypot(
      pointerVector.x - groupScale.anchorVector.x,
      pointerVector.y - groupScale.anchorVector.y
    );
    const minFactor = Math.max(0.05 / groupScale.originScaleX, 0.05 / groupScale.originScaleY);
    const maxFactor = Math.min(10 / groupScale.originScaleX, 10 / groupScale.originScaleY);
    let factor = clamp(distance / groupScale.startDistance, minFactor, maxFactor);
    if (event.shiftKey) factor = Math.round(factor * 20) / 20;
    factor = clamp(factor, minFactor, maxFactor);

    // Scaling both axes by the same factor keeps the opposite corner fixed by
    // compensating the group offset through the full rotate/skew/scale matrix.
    const local = applyLinear(
      groupScale.linear,
      groupScale.anchorLocal.x - groupScale.center.x,
      groupScale.anchorLocal.y - groupScale.center.y
    );
    const scaleDelta = 1 - factor;

    onpatchgroup?.(groupScale.id, {
      scaleX: roundTo(groupScale.originScaleX * factor, 3),
      scaleY: roundTo(groupScale.originScaleY * factor, 3),
      offsetX: Math.round(clamp(groupScale.originX + scaleDelta * local.x, -2000, 2000) * 10) / 10,
      offsetY: Math.round(clamp(groupScale.originY + scaleDelta * local.y, -2000, 2000) * 10) / 10,
    });
  }

  function endGroupScale() {
    groupScale = null;
    window.removeEventListener('pointermove', moveGroupScale);
  }

  function scaleCursor(corner: ThemeV2Point, center: ThemeV2Point) {
    const angle =
      ((Math.atan2(corner.y - center.y, corner.x - center.x) * 180) / Math.PI + 360) % 360;
    const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
    return cursors[Math.round(angle / 45) % 4];
  }
</script>

<div
  bind:this={overlay}
  class="absolute inset-0 z-20 {interactive ? 'pointer-events-auto' : 'pointer-events-none'}"
  role="presentation"
  onpointerdown={beginMarquee}
  onpointerleave={scheduleHoverHide}
  oncontextmenu={(event) => {
    if (!interactive || event.target !== event.currentTarget) return;
    // The surrounding bits-ui ContextMenu.Trigger opens on the bubbling
    // contextmenu event and prevents the native menu itself. Calling
    // preventDefault() here makes the trigger treat the event as handled
    // (it bails when defaultPrevented is set), leaving no menu at all.
    oncontext?.(undefined, event);
  }}
>
  {#snippet maskedLayer(element: ThemeV2Element, depth: number)}
    {@const masks = maskedAncestors(element)}
    {#if depth < masks.length}
      <div
        class="absolute inset-0"
        style="pointer-events:none;overflow:visible;{themeGroupMaskCss(
          masks[depth],
          elements,
          groups,
          assetUrl
        )}"
      >
        {@render maskedLayer(element, depth + 1)}
      </div>
    {:else}
      {@render layerContent(element)}
    {/if}
  {/snippet}

  {#snippet layerContent(element: ThemeV2Element)}
    {@const selected = isSelected(element.id)}
    {@const singleSelected = selected && selectedIds.length === 1}
    {@const elementLocked = isElementLocked(element)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="absolute select-none {elementClassNames(element)}"
      class:cursor-move={interactive && !elementLocked}
      class:cursor-default={interactive && elementLocked}
      class:cursor-pointer={!interactive && element.interactive}
      class:pointer-events-auto={interactive || element.interactive}
      style="left:{element.x}px;top:{element.y}px;width:{element.width}px;height:{element.height}px;transform:{themeElementTransformCss(
        element,
        elements,
        groups
      )};transform-origin:0 0;touch-action:none;outline:{selected
        ? `${selectedIds.length > 1 ? 1 : 2}px solid #ff006e`
        : 'none'};outline-offset:2px;"
      role={interactive || element.interactive ? 'button' : undefined}
      tabindex={interactive || element.interactive ? 0 : -1}
      aria-label={interactive
        ? `Select ${element.type} layer`
        : element.interactive
          ? element.name?.trim() || `${element.type} layer`
          : undefined}
      onpointerdown={(event) => beginDrag(event, element)}
      onclick={() => triggerInteraction(element, 'click')}
      onpointerenter={() => {
        triggerInteraction(element, 'hover');
        showGroupHover(element);
      }}
      onpointerleave={() => {
        triggerInteraction(element, 'leave');
        if (interactive) scheduleHoverHide();
      }}
      oncontextmenu={(event) => {
        if (!interactive) return;
        // Let the event bubble so the editor's ContextMenu.Trigger can open.
        oncontext?.(element.id, event);
      }}
      ondblclick={(event) => {
        if (!interactive || !element.groupId) return;
        event.preventDefault();
        event.stopPropagation();
        onselectgroup?.(element.groupId);
      }}
      onkeydown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          selectElement(element.id, modifierPressed(event));
        } else if (
          !interactive &&
          element.interactive &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          triggerInteraction(element, 'click');
        }
      }}
    >
      <!-- Opacity lives on the content wrapper so selection chrome stays fully opaque. -->
      <div
        class="h-full w-full"
        style="opacity:{elementOpacity(element)};filter:{elementFilter(element)};{element.mask
          ? `clip-path:${themeMaskClipPath(element.mask)};`
          : ''}{themeMaskImageCss(
          element.mask,
          element.mask?.src ? assetUrl(element.mask.src) : undefined
        )}"
      >
        {#if element.type === 'text' || element.type === 'data'}
          <div
            class="h-full w-full overflow-hidden"
            style="display:flex;align-items:{element.verticalAlign === 'center'
              ? 'center'
              : element.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'flex-start'};justify-content:{element.align === 'center'
              ? 'center'
              : element.align === 'right'
                ? 'flex-end'
                : 'flex-start'};text-align:{element.align ?? 'left'};"
          >
            <span
              style="font-family:{fontStack(element.fontFamily)};font-size:{element.fontSize ??
                28}px;font-weight:{element.fontWeight ?? 600};line-height:{element.lineHeight ??
                1.2};letter-spacing:{element.letterSpacing ??
                0}px;white-space:pre-wrap;overflow-wrap:anywhere;{themeTextStyleCss(element)}"
            >
              {element.type === 'data'
                ? dataValue(element)
                : interpolateThemeText(element.text, variables)}
            </span>
          </div>
        {:else if element.type === 'image'}
          {#if element.tint}
            <div class="pointer-events-none h-full w-full" style={imageTintStyle(element)}></div>
          {:else}
            <img
              class="pointer-events-none h-full w-full"
              src={assetUrl(element.src)}
              alt=""
              draggable="false"
              style="object-fit:{element.fit ?? 'cover'};border-radius:{element.radius ?? 0}px;"
            />
          {/if}
        {:else if element.type === 'video'}
          <video
            class="pointer-events-none h-full w-full"
            use:themeMediaSource={assetUrl(element.src)}
            use:themeVideoLifecycle
            autoplay
            loop
            muted={element.muted !== false}
            use:applyMuted={element.muted !== false}
            playsinline
            disablepictureinpicture
            aria-hidden="true"
            style="object-fit:{element.fit ?? 'cover'};border-radius:{element.radius ?? 0}px;"
          ></video>
        {:else if element.type === 'svelte'}
          <ThemeCustomLayer
            source={element.source}
            {assets}
            {assetOverrides}
            {variables}
            {screen}
            layerId={element.id}
            layerName={element.name}
            width={element.width}
            height={element.height}
            {themeName}
            {themeAuthor}
            {accentColor}
            {interactive}
          />
        {:else if element.type === 'shape'}
          {#if element.shape === 'arc'}
            {@const arc = arcGeometry(element)}
            {@const gradientVector = themeSvgGradientVector(element.gradientAngle ?? 135)}
            <svg
              class="h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {#if element.fillMode === 'gradient'}
                <defs>
                  <linearGradient
                    id={svgGradientId('arc-gradient', element.id)}
                    x1={gradientVector.x1}
                    y1={gradientVector.y1}
                    x2={gradientVector.x2}
                    y2={gradientVector.y2}
                  >
                    <stop offset="0%" stop-color={element.gradientFrom ?? '#ff006e'} />
                    <stop offset="100%" stop-color={element.gradientTo ?? '#7c3aed'} />
                  </linearGradient>
                </defs>
              {/if}
              <path
                d={arc.d}
                fill="none"
                stroke={element.fillMode === 'gradient'
                  ? `url(#${svgGradientId('arc-gradient', element.id)})`
                  : (element.fill ?? '#ff006e')}
                stroke-width={arc.strokeWidth}
                stroke-linecap={element.rounded === false ? 'butt' : 'round'}
              />
            </svg>
          {:else}
            <div
              class="h-full w-full"
              style="background:{shapeFill(element)};border-radius:{element.shape === 'ellipse'
                ? '50%'
                : element.shape === 'rectangle' || element.shape === 'line'
                  ? shapeRadius(element)
                  : '0'};clip-path:{shapeClip(element)};border:{element.borderWidth
                ? `${element.borderWidth}px ${element.borderStyle ?? 'solid'} ${element.borderColor ?? '#ffffff'}`
                : 'none'};backdrop-filter:{element.backdropBlur
                ? `blur(${element.backdropBlur}px)`
                : 'none'};-webkit-backdrop-filter:{element.backdropBlur
                ? `blur(${element.backdropBlur}px)`
                : 'none'};"
            ></div>
          {/if}
        {:else if element.type === 'icon'}
          <div
            class="flex h-full w-full items-center justify-center"
            style="color:{element.color ?? '#ffffff'};"
          >
            <ThemeIcon
              name={element.icon}
              set={iconSet}
              size={(Math.min(element.width, element.height) * (element.scale ?? 100)) / 100}
            />
          </div>
        {:else if element.type === 'repeater'}
          <div class="h-full w-full overflow-hidden">
            <div
              class="grid h-full w-full"
              style="grid-template-columns:repeat({repeaterTiles(element).columns},{repeaterTiles(
                element
              ).tileWidth}px);grid-template-rows:repeat({repeaterTiles(element)
                .rows},{repeaterTiles(element).tileHeight}px);gap:{repeaterTiles(element)
                .gapY}px {repeaterTiles(element).gapX}px;"
            >
              {#each Array(repeaterTiles(element).total) as _, index (index)}
                {#if element.source === 'image' && element.src}
                  <img
                    class="pointer-events-none h-full w-full object-cover"
                    src={assetUrl(element.src)}
                    alt=""
                    draggable="false"
                    style="border-radius:{element.radius ?? 0}px;"
                  />
                {:else}
                  <span
                    class="flex items-center justify-center"
                    style="color:{element.color ?? '#ffffff'};"
                  >
                    <ThemeIcon
                      name={element.icon ?? 'music'}
                      set={iconSet}
                      size={Math.min(
                        repeaterTiles(element).tileWidth,
                        repeaterTiles(element).tileHeight
                      )}
                    />
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {:else if element.type === 'gauge'}
          {#if element.mode === 'ring'}
            <div class="relative flex h-full w-full items-center justify-center">
              <svg class="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r={Math.max(4, 45 - (element.thickness ?? 12) / 2)}
                  fill="none"
                  stroke={element.trackColor ?? '#000000'}
                  stroke-width={element.thickness ?? 12}
                />
                <circle
                  cx="50"
                  cy="50"
                  r={Math.max(4, 45 - (element.thickness ?? 12) / 2)}
                  fill="none"
                  stroke={element.fillColor ?? '#ff006e'}
                  stroke-width={element.thickness ?? 12}
                  stroke-linecap={element.rounded === false ? 'butt' : 'round'}
                  stroke-dasharray={`${gaugePercent(element) * 2 * Math.PI * Math.max(4, 45 - (element.thickness ?? 12) / 2)} ${2 * Math.PI * Math.max(4, 45 - (element.thickness ?? 12) / 2)}`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              {#if gaugeLabel(element)}
                <span
                  class="pointer-events-none absolute text-center"
                  style="color:{element.labelColor ?? '#ffffff'};font-family:{fontStack(
                    element.fontFamily
                  )};font-size:{element.fontSize ?? 20}px;font-weight:700;"
                >
                  {gaugeLabel(element)}
                </span>
              {/if}
            </div>
          {:else}
            <div class="relative flex h-full w-full items-center">
              <div
                class="h-full w-full overflow-hidden"
                style="background:{element.trackColor ??
                  '#000000'};border-radius:{element.rounded === false ? '0' : '999px'};"
              >
                <div
                  class="h-full"
                  style="width:{gaugePercent(element) * 100}%;background:{element.fillColor ??
                    '#ff006e'};border-radius:{element.rounded === false ? '0' : '999px'};"
                ></div>
              </div>
              {#if gaugeLabel(element)}
                <span
                  class="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style="color:{element.labelColor ?? '#ffffff'};font-family:{fontStack(
                    element.fontFamily
                  )};font-size:{element.fontSize ?? 20}px;font-weight:700;"
                >
                  {gaugeLabel(element)}
                </span>
              {/if}
            </div>
          {/if}
        {:else if element.type === 'ticker'}
          <div
            class="h-full w-full overflow-hidden"
            style="background:{element.background || 'transparent'};"
          >
            <div
              class="theme-ticker-track flex h-full w-max items-center"
              style="--ticker-duration:{element.speed ?? 18}s;"
            >
              {#each [0, 1] as copy (copy)}
                <span
                  style="padding-right:{element.gap ?? 48}px;font-family:{fontStack(
                    element.fontFamily
                  )};font-size:{element.fontSize ?? 24}px;font-weight:{element.fontWeight ??
                    600};color:{element.color ?? '#ffffff'};text-transform:{element.textTransform ??
                    'none'};white-space:nowrap;"
                >
                  {interpolateThemeText(element.text, variables)}
                </span>
              {/each}
            </div>
          </div>
        {:else if element.type === 'lottie'}
          {#key element.src}
            <ThemeLottieLayer
              src={assetUrl(element.src)}
              loop={element.loop !== false}
              autoplay={element.autoplay !== false}
              speed={element.speed ?? 1}
            />
          {/key}
        {:else if element.type === 'button'}
          <button
            type="button"
            class="theme-button flex h-full w-full items-center justify-center gap-2 px-4"
            style="--theme-button-hover:{element.hoverBackground ??
              '#ff4d94'};background:{element.background ?? '#ff006e'};color:{element.color ??
              '#ffffff'};border:{element.borderWidth
              ? `${element.borderWidth}px solid ${element.borderColor ?? '#ffffff'}`
              : 'none'};border-radius:{element.radius ?? 10}px;font-family:{fontStack(
              element.fontFamily
            )};font-size:{element.fontSize ?? 16}px;font-weight:{element.fontWeight ?? 600};"
            onclick={(event) => {
              if (interactive) return;
              event.stopPropagation();
              onbuttonaction?.(element.action);
            }}
          >
            {#if element.icon}
              <ThemeIcon name={element.icon} set={iconSet} size="1.1em" />
            {/if}
            <span class="truncate">{interpolateThemeText(element.label, variables)}</span>
          </button>
        {:else if element.type === 'path'}
          {@const gradientVector = themeSvgGradientVector(element.gradientAngle ?? 135)}
          <svg
            class="h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {#if element.fillMode === 'gradient'}
              <defs>
                <linearGradient
                  id={svgGradientId('path-gradient', element.id)}
                  x1={gradientVector.x1}
                  y1={gradientVector.y1}
                  x2={gradientVector.x2}
                  y2={gradientVector.y2}
                >
                  <stop offset="0%" stop-color={element.gradientFrom ?? '#ff006e'} />
                  <stop offset="100%" stop-color={element.gradientTo ?? '#7c3aed'} />
                </linearGradient>
              </defs>
            {/if}
            <path
              d={element.path}
              fill={element.fillMode === 'gradient'
                ? `url(#${svgGradientId('path-gradient', element.id)})`
                : (element.fill ?? '#ff006e')}
              stroke={element.stroke || 'none'}
              stroke-width={element.stroke ? Math.max(0, element.strokeWidth ?? 0) : 0}
              stroke-linecap={element.strokeLinecap ?? 'round'}
              stroke-linejoin="round"
              stroke-dasharray={pathDash(element)}
              vector-effect="non-scaling-stroke"
            />
          </svg>
        {:else if element.type === 'particles'}
          <div
            class="theme-particles theme-particles-{element.preset}"
            style="--particle-color:{element.color ??
              '#ffffff'};--particle-color-2:{element.color2 ?? '#ff006e'};"
            aria-hidden="true"
          >
            {#each themeParticleSeeds(element) as seed, index (index)}
              <span
                class="theme-particle"
                style="--x:{seed.left}%;--y:{seed.top}%;--drift:{seed.drift}%;--size:{(element.size ??
                  6) *
                  seed.size}px;--duration:{seed.duration}s;--delay:{seed.delay}s;--spin:{seed.spin}deg;--opacity:{seed.opacity};--particle-fill:{seed.alternate
                  ? (element.color2 ?? '#ff006e')
                  : (element.color ?? '#ffffff')};{element.fade === false
                  ? ''
                  : 'mask-image:linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);-webkit-mask-image:linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);'}"
              ></span>
            {/each}
          </div>
        {:else if element.type === 'clock'}
          {@const now = clockNow}
          {#if element.mode === 'analog'}
            {@const hands = analogHands(now)}
            <svg
              class="h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke={element.color ?? '#ffffff'}
                stroke-opacity="0.22"
                stroke-width="1.5"
              />
              {#each Array(12) as _, index (index)}
                <line
                  x1="50"
                  y1="6"
                  x2="50"
                  y2={index % 3 === 0 ? '12' : '9'}
                  stroke={element.color ?? '#ffffff'}
                  stroke-opacity={index % 3 === 0 ? '0.85' : '0.4'}
                  stroke-width={index % 3 === 0 ? '2' : '1'}
                  transform="rotate({index * 30} 50 50)"
                  stroke-linecap="round"
                />
              {/each}
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="27"
                stroke={element.color ?? '#ffffff'}
                stroke-width="4"
                stroke-linecap="round"
                transform="rotate({hands.hour} 50 50)"
              />
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="17"
                stroke={element.color ?? '#ffffff'}
                stroke-width="2.6"
                stroke-linecap="round"
                transform="rotate({hands.minute} 50 50)"
              />
              {#if element.showSeconds !== false}
                <line
                  x1="50"
                  y1="56"
                  x2="50"
                  y2="12"
                  stroke={element.accentColor ?? '#ff006e'}
                  stroke-width="1.2"
                  stroke-linecap="round"
                  transform="rotate({hands.second} 50 50)"
                />
              {/if}
              <circle cx="50" cy="50" r="3" fill={element.accentColor ?? '#ff006e'} />
            </svg>
          {:else}
            <div
              class="flex h-full w-full flex-col justify-center gap-1 overflow-hidden"
              style="align-items:{element.align === 'left'
                ? 'flex-start'
                : element.align === 'right'
                  ? 'flex-end'
                  : 'center'};text-align:{element.align ?? 'center'};"
            >
              {#if element.label}
                <span
                  style="font-family:{fontStack(element.fontFamily)};font-size:{clockCaptionSize(
                    element
                  )}px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:{element.accentColor ??
                    '#ff006e'};">{element.label}</span
                >
              {/if}
              <span
                style="font-family:{fontStack(element.fontFamily)};font-size:{element.fontSize ??
                  40}px;font-weight:{element.fontWeight ??
                  700};line-height:1.05;color:{element.color ??
                  '#ffffff'};font-variant-numeric:tabular-nums;"
              >
                {themeClockTime(element, now)}
              </span>
              {#if element.showDate}
                <span
                  style="font-family:{fontStack(element.fontFamily)};font-size:{clockCaptionSize(
                    element
                  )}px;font-weight:500;color:{element.accentColor ?? '#ff006e'};"
                  >{themeClockDate(now)}</span
                >
              {/if}
            </div>
          {/if}
        {:else if element.type === 'countdown'}
          <div
            class="flex h-full w-full items-center overflow-hidden"
            style="justify-content:{element.align === 'left'
              ? 'flex-start'
              : element.align === 'right'
                ? 'flex-end'
                : 'center'};text-align:{element.align ?? 'center'};"
          >
            <span
              style="font-family:{fontStack(element.fontFamily)};font-size:{element.fontSize ??
                40}px;font-weight:{element.fontWeight ?? 700};color:{element.color ??
                '#ffffff'};font-variant-numeric:tabular-nums;"
            >
              {themeCountdownText(element, clockNow)}
            </span>
          </div>
        {/if}
      </div>

      {#if singleSelected && !elementLocked}
        <span
          class="pointer-events-none absolute left-1/2 top-0 w-px -translate-x-1/2 -translate-y-full bg-primary"
          style="height:30px;"
          aria-hidden="true"
        ></span>
        <button
          type="button"
          class="absolute left-1/2 z-10 flex size-5 cursor-grab items-center justify-center rounded-full border-2 border-white bg-primary p-0 text-primary-foreground shadow active:cursor-grabbing"
          style="top:-30px;transform:translate(-50%, -50%);"
          data-rotate="true"
          title="Rotate layer (Shift snaps to 15°)"
          aria-label="Rotate layer"
          onpointerdown={(event) => beginElementRotate(event, element)}
        >
          <RotateCw class="size-3" />
        </button>
        {#each resizeDirections as direction (direction)}
          <span
            class="absolute z-10 block size-3 rounded-full border-2 border-white bg-primary shadow"
            data-resize={direction}
            style="{direction.includes('n') ? 'top:-7px' : 'bottom:-7px'};{direction.includes('w')
              ? 'left:-7px'
              : 'right:-7px'};cursor:{direction === 'nw' || direction === 'se'
              ? 'nwse-resize'
              : 'nesw-resize'};"
            onpointerdown={(event) => beginResize(event, element, direction)}
            role="presentation"
          ></span>
        {/each}
        <span
          class="absolute -top-7 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
        >
          {element.type}
        </span>
      {/if}

      {#if selected && selectedIds.length > 1}
        <span
          class="absolute -top-5 left-0 rounded bg-primary/90 px-1 py-0.5 text-[8px] font-semibold text-primary-foreground"
        >
          selected
        </span>
      {/if}
    </div>
  {/snippet}

  {#each visibleElements as element (element.id)}
    {@render maskedLayer(element, 0)}
  {/each}

  {#if hoverGroupFrame}
    {@const hover = hoverGroupFrame}
    {@const breadcrumb = themeGroupPath(groups, hover.group.id)}
    {#if hover.group.id !== selectedGroupId}
      <svg
        class="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <polygon
          points={hover.corners.map((corner) => `${corner.x},${corner.y}`).join(' ')}
          fill="var(--primary)"
          fill-opacity="0.02"
          stroke="var(--primary)"
          stroke-opacity="0.8"
          stroke-width="1"
          stroke-dasharray="5 4"
        />
      </svg>
    {/if}

    {#if hover.group.id !== selectedGroupId || breadcrumb.length > 1}
      <div
        class="absolute z-40 flex max-w-56 flex-wrap items-center justify-center gap-0.5 rounded-xl border border-primary/50 bg-theme-950/95 p-1 text-theme-50 shadow-lg backdrop-blur-sm"
        style="left:{hover.labelPoint.x}px;top:{hover.labelPoint
          .y}px;transform:translate(-50%, -100%);"
        role="group"
        aria-label="Group path"
        title={breadcrumb.map(groupLabel).join(' / ')}
        onpointerenter={cancelHoverHide}
        onpointerleave={scheduleHoverHide}
        onpointerdown={(event) => event.stopPropagation()}
        oncontextmenu={(event) => {
          if (!interactive) return;
          // Let the event bubble so the editor's ContextMenu.Trigger opens.
          const target =
            event.target instanceof Element
              ? event.target.closest<HTMLElement>('[data-group-id]')
              : null;
          oncontextgroup?.(target?.dataset.groupId ?? hover.group.id, event);
        }}
      >
        <Boxes class="size-3 shrink-0 opacity-70" />
        {#each breadcrumb as group, index (group.id)}
          {#if index > 0}
            <ChevronRight class="size-2.5 shrink-0 text-theme-500" aria-hidden="true" />
          {/if}
          <button
            type="button"
            class="max-w-24 cursor-pointer truncate rounded px-1 py-0.5 text-[9px] font-semibold transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            data-group-id={group.id}
            title={`Select group: ${groupLabel(group)}`}
            onclick={(event) => {
              event.stopPropagation();
              selectHoveredGroup(group.id);
            }}
          >
            {groupLabel(group)}
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if groupFrame}
    {@const frame = groupFrame}
    <svg
      class="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <polygon
        points={frame.corners.map((corner) => `${corner.x},${corner.y}`).join(' ')}
        fill="var(--primary)"
        fill-opacity="0.06"
        stroke="var(--primary)"
        stroke-width="1.5"
        stroke-dasharray={frame.locked ? '6 4' : undefined}
      />
      {#if !frame.locked}
        <line
          x1={frame.topCenter.x}
          y1={frame.topCenter.y}
          x2={frame.rotationHandle.x}
          y2={frame.rotationHandle.y}
          stroke="var(--primary)"
          stroke-width="1.5"
        />
      {/if}
    </svg>

    <button
      type="button"
      class="absolute z-40 flex max-w-52 items-center gap-1.5 rounded-full border border-white/20 bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg {frame.locked
        ? 'cursor-default'
        : 'cursor-grab active:cursor-grabbing'}"
      style="left:{frame.center.x}px;top:{frame.center.y}px;transform:translate(-50%, -50%);"
      title={frame.locked ? 'Group is locked' : 'Drag to move group (Alt skips snapping)'}
      onpointerdown={(event) => beginGroupMove(event, frame)}
      oncontextmenu={(event) => {
        if (!interactive) return;
        oncontextgroup?.(frame.group.id, event);
      }}
    >
      <Move class="size-3 shrink-0" />
      <span class="truncate">{groupLabel(frame.group)}</span>
      <span class="shrink-0 text-[9px] opacity-75">{groupScaleLabel(frame.group)}</span>
    </button>

    {#if !frame.locked}
      {#each frame.corners as corner, index (index)}
        <button
          type="button"
          class="absolute z-40 block size-3 rounded-full border-2 border-white bg-primary p-0 shadow"
          style="left:{corner.x}px;top:{corner.y}px;transform:translate(-50%, -50%);cursor:{scaleCursor(
            corner,
            frame.center
          )};"
          title="Scale group (Shift snaps to 5%)"
          aria-label="Scale group"
          onpointerdown={(event) => beginGroupScale(event, frame, index)}
        ></button>
      {/each}

      <button
        type="button"
        class="absolute z-40 flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary p-0 text-primary-foreground shadow"
        style="left:{frame.rotationHandle.x}px;top:{frame.rotationHandle
          .y}px;transform:translate(-50%, -50%);cursor:grab;"
        title="Rotate group (Shift snaps to 15°)"
        aria-label="Rotate group"
        onpointerdown={(event) => beginGroupRotate(event, frame)}
      >
        <RotateCw class="size-3" />
      </button>
    {/if}
  {/if}

  {#if snapGuides.x !== undefined}
    <div
      class="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary/80"
      style="left:{snapGuides.x}px"
    ></div>
  {/if}
  {#if snapGuides.y !== undefined}
    <div
      class="pointer-events-none absolute inset-x-0 z-30 h-px bg-primary/80"
      style="top:{snapGuides.y}px"
    ></div>
  {/if}

  {#if marquee}
    <div
      class="pointer-events-none absolute z-30 border border-primary bg-primary/10"
      style="left:{marquee.x}px;top:{marquee.y}px;width:{marquee.width}px;height:{marquee.height}px;"
    ></div>
  {/if}
</div>

<style>
  .theme-ticker-track {
    animation: theme-ticker-scroll var(--ticker-duration, 18s) linear infinite;
  }

  @keyframes theme-ticker-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  .theme-button {
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }

  .theme-button:hover {
    background: var(--theme-button-hover);
  }

  .theme-particles {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .theme-particle {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--size);
    height: var(--size);
    animation-fill-mode: both;
    background: var(--particle-fill);
    opacity: 0;
    will-change: transform, opacity;
  }

  .theme-particles-snow .theme-particle {
    border-radius: 50%;
    filter: blur(0.3px);
    animation: theme-particle-fall var(--duration) linear var(--delay) infinite;
  }

  .theme-particles-petals .theme-particle {
    border-radius: 80% 10% 80% 10%;
    animation: theme-particle-petal var(--duration) linear var(--delay) infinite;
  }

  .theme-particles-bubbles .theme-particle {
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.35);
    background: color-mix(in srgb, var(--particle-fill) 28%, transparent);
    animation: theme-particle-rise var(--duration) linear var(--delay) infinite;
  }

  .theme-particles-embers .theme-particle {
    border-radius: 50%;
    box-shadow: 0 0 calc(var(--size) * 0.8) var(--particle-fill);
    animation: theme-particle-rise calc(var(--duration) * 0.55) linear var(--delay) infinite;
  }

  .theme-particles-confetti .theme-particle {
    border-radius: 1px;
    animation: theme-particle-confetti calc(var(--duration) * 0.7) linear var(--delay) infinite;
  }

  .theme-particles-sparkles .theme-particle {
    clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);
    animation: theme-particle-twinkle calc(var(--duration) * 0.35) ease-in-out var(--delay) infinite;
  }

  @keyframes theme-particle-fall {
    0% {
      top: -10%;
      left: var(--x);
      opacity: 0;
      transform: rotate(0deg);
    }
    8% {
      opacity: var(--opacity);
    }
    100% {
      top: 110%;
      left: calc(var(--x) + var(--drift));
      opacity: var(--opacity);
      transform: rotate(var(--spin));
    }
  }

  @keyframes theme-particle-petal {
    0% {
      top: -10%;
      left: var(--x);
      opacity: 0;
      transform: rotate(0deg);
    }
    10% {
      opacity: var(--opacity);
    }
    50% {
      left: calc(var(--x) + var(--drift) * 0.6);
      transform: rotate(calc(var(--spin) * 0.5));
    }
    100% {
      top: 110%;
      left: calc(var(--x) + var(--drift));
      opacity: 0;
      transform: rotate(var(--spin));
    }
  }

  @keyframes theme-particle-rise {
    0% {
      top: 110%;
      left: var(--x);
      opacity: 0;
      transform: scale(0.6);
    }
    12% {
      opacity: var(--opacity);
    }
    100% {
      top: -10%;
      left: calc(var(--x) + var(--drift));
      opacity: 0;
      transform: scale(1.15);
    }
  }

  @keyframes theme-particle-confetti {
    0% {
      top: -10%;
      left: var(--x);
      opacity: 0;
      transform: rotate(0deg);
    }
    6% {
      opacity: var(--opacity);
    }
    100% {
      top: 110%;
      left: calc(var(--x) + var(--drift));
      opacity: 0;
      transform: rotate(var(--spin));
    }
  }

  @keyframes theme-particle-twinkle {
    0%,
    100% {
      opacity: 0;
      transform: scale(0.2);
    }
    50% {
      opacity: var(--opacity);
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .theme-ticker-track,
    .theme-particle {
      animation: none;
    }

    .theme-particle {
      opacity: calc(var(--opacity) * 0.6);
    }
  }
</style>
