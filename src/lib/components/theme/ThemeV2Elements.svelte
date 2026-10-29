<script lang="ts">
  import { fontStack } from '$lib/themeFonts';
  import { themeMediaSource } from '$lib/themeMedia';
  import { themeAssetUrl, type ThemeV2Element } from '$lib/themeV2';

  let {
    elements = [],
    assets = '',
    assetOverrides = {},
    interactive = false,
    selectedId = undefined,
    scale = 1,
    onselect,
    onpatch,
  }: {
    elements?: ThemeV2Element[];
    assets?: string;
    assetOverrides?: Record<string, string>;
    interactive?: boolean;
    selectedId?: string;
    scale?: number;
    onselect?: (id: string | undefined) => void;
    onpatch?: (id: string, patch: Record<string, unknown>) => void;
  } = $props();

  const assetUrl = (path: string) => assetOverrides[path] ?? themeAssetUrl(assets, path);

  // Keep the live muted property in sync, including live editor toggles.
  function applyMuted(node: HTMLVideoElement, muted: boolean) {
    node.muted = muted;
    return {
      update(value: boolean) {
        node.muted = value;
      },
    };
  }

  type DragState = {
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  };

  type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

  type ResizeState = DragState & {
    direction: ResizeDirection;
    originWidth: number;
    originHeight: number;
  };

  const resizeDirections: ResizeDirection[] = ['nw', 'ne', 'sw', 'se'];

  let drag = $state<DragState | null>(null);
  let resize = $state<ResizeState | null>(null);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  function beginDrag(event: PointerEvent, element: ThemeV2Element) {
    if (!interactive || (event.target as HTMLElement).dataset.resize) return;
    event.preventDefault();
    event.stopPropagation();
    onselect?.(element.id);
    drag = {
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
    };
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    const element = elements.find((candidate) => candidate.id === drag!.id);
    if (!element) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    onpatch?.(drag.id, {
      x: Math.round(clamp(drag.originX + dx, 0, 1000 - element.width)),
      y: Math.round(clamp(drag.originY + dy, 0, 650 - element.height)),
    });
  }

  function endDrag() {
    drag = null;
    window.removeEventListener('pointermove', moveDrag);
  }

  function beginResize(
    event: PointerEvent,
    element: ThemeV2Element,
    direction: ResizeState['direction']
  ) {
    if (!interactive) return;
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
</script>

<div
  class="absolute inset-0 z-20 {interactive ? 'pointer-events-auto' : 'pointer-events-none'}"
  role="presentation"
>
  {#each elements as element (element.id)}
    {@const isSelected = interactive && element.id === selectedId}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="absolute select-none"
      class:cursor-move={interactive}
      style="left:{element.x}px;top:{element.y}px;width:{element.width}px;height:{element.height}px;transform:rotate({element.rotation ??
        0}deg);opacity:{element.opacity ?? 1};touch-action:none;outline:{isSelected
        ? '2px solid #ff006e'
        : 'none'};outline-offset:2px;"
      role={interactive ? 'button' : undefined}
      tabindex={interactive ? 0 : -1}
      aria-label={interactive ? `Select ${element.type} layer` : undefined}
      onpointerdown={(event) => beginDrag(event, element)}
      onkeydown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onselect?.(element.id);
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

      {#if isSelected}
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
    </div>
  {/each}
</div>
