<script lang="ts">
  import { fontStack } from '$lib/themeFonts';
  import { themeMediaSource, themeVideoLifecycle } from '$lib/themeMedia';
  import { themeAssetUrl, type ThemeV2Element } from '$lib/themeV2';

  let {
    elements = [],
    assets = '',
    assetOverrides = {},
    interactive = false,
    selectedIds = [],
    scale = 1,
    onselect,
    onselectmany,
    onmove,
    onpatch,
    oncontext,
  }: {
    elements?: ThemeV2Element[];
    assets?: string;
    assetOverrides?: Record<string, string>;
    interactive?: boolean;
    selectedIds?: string[];
    scale?: number;
    onselect?: (id: string | undefined, additive?: boolean) => void;
    onselectmany?: (ids: string[], additive?: boolean) => void;
    onmove?: (updates: { id: string; x: number; y: number }[]) => void;
    onpatch?: (id: string, patch: Record<string, unknown>) => void;
    oncontext?: (id: string | undefined, event: MouseEvent) => void;
  } = $props();

  const assetUrl = (path: string) => assetOverrides[path] ?? themeAssetUrl(assets, path);
  const visibleElements = $derived(elements.filter((element) => !element.hidden));

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

  type MarqueeState = {
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    additive: boolean;
  };

  const resizeDirections: ResizeDirection[] = ['nw', 'ne', 'sw', 'se'];
  const SNAP_DISTANCE = 6;

  let overlay = $state<HTMLDivElement | undefined>(undefined);
  let drag = $state<DragState | null>(null);
  let resize = $state<ResizeState | null>(null);
  let marquee = $state<MarqueeState | null>(null);
  let snapGuides = $state<{ x?: number; y?: number }>({});

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const selectedSet = $derived(new Set(selectedIds));

  const isSelected = (id: string) => interactive && selectedSet.has(id);

  const modifierPressed = (event: PointerEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;

  function selectElement(id: string | undefined, additive = false) {
    onselect?.(id, additive);
  }

  function beginDrag(event: PointerEvent, element: ThemeV2Element) {
    if (!interactive || event.button !== 0) return;
    if ((event.target as HTMLElement).dataset.resize) return;

    event.preventDefault();
    event.stopPropagation();

    const additive = modifierPressed(event);
    if (additive) {
      selectElement(element.id, true);
      return;
    }

    if (element.locked) {
      selectElement(element.id, false);
      return;
    }

    const keepGroup = selectedSet.has(element.id) && selectedIds.length > 1;
    if (!keepGroup) selectElement(element.id, false);

    const candidateIds = keepGroup ? [...selectedIds] : [element.id];
    const origins = candidateIds
      .map((id) => elements.find((candidate) => candidate.id === id))
      .filter(
        (candidate): candidate is ThemeV2Element => candidate !== undefined && !candidate.locked
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
    if (!interactive || element.locked) return;
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
</script>

<div
  bind:this={overlay}
  class="absolute inset-0 z-20 {interactive ? 'pointer-events-auto' : 'pointer-events-none'}"
  role="presentation"
  onpointerdown={beginMarquee}
  oncontextmenu={(event) => {
    if (!interactive || event.target !== event.currentTarget) return;
    event.preventDefault();
    oncontext?.(undefined, event);
  }}
>
  {#each visibleElements as element (element.id)}
    {@const selected = isSelected(element.id)}
    {@const singleSelected = selected && selectedIds.length === 1}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="absolute select-none"
      class:cursor-move={interactive && !element.locked}
      class:cursor-default={interactive && element.locked}
      style="left:{element.x}px;top:{element.y}px;width:{element.width}px;height:{element.height}px;transform:rotate({element.rotation ??
        0}deg);opacity:{element.opacity ?? 1};touch-action:none;outline:{selected
        ? `${selectedIds.length > 1 ? 1 : 2}px solid #ff006e`
        : 'none'};outline-offset:2px;"
      role={interactive ? 'button' : undefined}
      tabindex={interactive ? 0 : -1}
      aria-label={interactive ? `Select ${element.type} layer` : undefined}
      onpointerdown={(event) => beginDrag(event, element)}
      oncontextmenu={(event) => {
        if (!interactive) return;
        event.preventDefault();
        oncontext?.(element.id, event);
      }}
      onkeydown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          selectElement(element.id, modifierPressed(event));
        }
      }}
    >
      {#if element.type === 'text'}
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
              28}px;font-weight:{element.fontWeight ?? 600};color:{element.color ??
              '#ffffff'};line-height:{element.lineHeight ??
              1.2};letter-spacing:{element.letterSpacing ??
              0}px;white-space:pre-wrap;overflow-wrap:anywhere;"
          >
            {element.text}
          </span>
        </div>
      {:else if element.type === 'image'}
        <img
          class="pointer-events-none h-full w-full"
          src={assetUrl(element.src)}
          alt=""
          draggable="false"
          style="object-fit:{element.fit ?? 'cover'};border-radius:{element.radius ?? 0}px;"
        />
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
      {:else}
        <div
          class="h-full w-full"
          style="background:{element.fill ?? '#ff006e'};border-radius:{element.shape === 'ellipse'
            ? '50%'
            : `${element.radius ?? 16}px`};border:{element.borderWidth
            ? `${element.borderWidth}px solid ${element.borderColor ?? '#ffffff'}`
            : 'none'};"
        ></div>
      {/if}

      {#if singleSelected && !element.locked}
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
  {/each}

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
