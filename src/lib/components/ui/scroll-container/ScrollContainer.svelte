<script lang="ts">
  // Props
  let { children, class: className = '', topOffset = 0 } = $props();

  let wrapper: HTMLDivElement;
  let container: HTMLDivElement;
  let thumb: HTMLDivElement;

  // Thumb state
  let thumbHeight = $state(20);
  let thumbTop = $state(0);

  // Drag state
  let dragging = false;
  let startY = 0;
  let startScroll = 0;

  /** Update thumb height & position */
  function updateScrollbar() {
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollable = scrollHeight - clientHeight;

    if (scrollable <= 0) {
      thumbHeight = 0;
      thumbTop = 0;
      return;
    }

    thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 24);

    const trackHeight = clientHeight - thumbHeight - topOffset;
    thumbTop = (scrollTop / scrollable) * trackHeight;
  }

  /** Start dragging the thumb */
  function startDrag(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    startScroll = container.scrollTop;
    thumb.setPointerCapture(e.pointerId);
  }

  /** Drag the thumb */
  function drag(e: PointerEvent) {
    if (!dragging) return;

    const delta = e.clientY - startY;
    const { scrollHeight, clientHeight } = container;
    const scrollable = scrollHeight - clientHeight;
    const trackHeight = clientHeight - thumbHeight - topOffset;

    container.scrollTop = startScroll + (delta / trackHeight) * scrollable;
  }

  /** End dragging */
  function endDrag(e: PointerEvent) {
    dragging = false;
    thumb.releasePointerCapture(e.pointerId);
  }

  // Reactive effect to update scrollbar
  $effect(() => updateScrollbar());

  // ResizeObserver for dynamic content
  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<div class="wrapper" bind:this={wrapper}>
  <!-- Scrollable content -->
  <div
    class={`content ${className}`}
    bind:this={container}
    onscroll={updateScrollbar}
    id="scrollable-content"
  >
    {@render children?.()}
  </div>

  <!-- Custom scrollbar -->
  <div class="scrollbar" style="top: {topOffset}px;">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="thumb bg-theme-600/60! hover:bg-theme-700! active:bg-theme-700 transition-colors"
      bind:this={thumb}
      onpointerdown={startDrag}
      onpointermove={drag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      aria-controls="scrollable-content"
      style="height:{thumbHeight}px; transform:translateY({thumbTop}px);"
    ></div>
  </div>
</div>

<style>
  .wrapper {
    position: relative;
    height: 100%;
    width: 100%;
  }

  /* Scrollable content */
  .content {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;

    scrollbar-width: none; /* Firefox */
  }

  .content::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Edge */
  }

  /* Scrollbar track */
  .scrollbar {
    position: absolute;
    right: 2px;
    bottom: 0;
    width: 8px;
    background: transparent;
    border-radius: 999px;
  }

  /* Thumb */
  .thumb {
    position: absolute;
    width: 100%;
    background: var(--color-theme-700);
    border-radius: 999px;
    cursor: grab;
    transition: background 0.15s;
  }

  .thumb:active {
    cursor: grabbing;
    background: var(--color-theme-600);
  }

  .thumb:hover {
    background: var(--color-theme-700);
  }
</style>
