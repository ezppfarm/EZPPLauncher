<script lang="ts">
  import cursor_default from '$assets/cursor.png';
  import cursor_additive from '$assets/cursor-additive.png';
  import { animate } from 'animejs';
  import { onMount } from 'svelte';
  import { currentMonitor } from '@tauri-apps/api/window';
  import { estimateRefreshRate } from '@/displayUtils';
  import { cursorSmoothness } from '@/userSettings';

  let { smoothCursor = true }: { smoothCursor?: boolean } = $props();

  let mouseX = $state(0);
  let mouseY = $state(0);
  let lastMouseX = $state(0);
  let lastMouseY = $state(0);
  let rotation = $state(0);
  let isMouseDown = $state(false);
  let isHoveringInteractive = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let degrees = $state(0);
  let applyRotation = $state(false);

  function isInteractive(el: Element | null): boolean {
    while (el) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const computed = getComputedStyle(el);
      if (
        ['button', 'a', 'input', 'select', 'textarea', 'label', 'option'].includes(tag) ||
        (role && ['button', 'link', 'checkbox', 'combobox'].includes(role)) ||
        computed.cursor === 'pointer'
      ) {
        return true;
      }

      el = el.parentElement;
    }
    return false;
  }

  const handleMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    const deltaX = e.pageX - window.pageXOffset - dragStartX;
    const deltaY = e.pageY - window.pageYOffset - dragStartY;

    const velocityX = Math.abs(mouseX - lastMouseX);
    const velocityY = Math.abs(mouseY - lastMouseY);

    if (!applyRotation && isMouseDown && velocityX * velocityX + velocityY * velocityY > 800) {
      applyRotation = true;
    }

    let newDegrees = (Math.atan2(-deltaX, deltaY) * 180) / Math.PI + 24.3;

    let diff = (newDegrees - degrees) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    if (isMouseDown && applyRotation) {
      degrees += diff;
    } else {
      degrees = 0;
    }

    const el = document.elementFromPoint(mouseX, mouseY);
    isHoveringInteractive = isInteractive(el);

    if (!isMouseDown) {
      if (isHoveringInteractive) {
        animate(cursorAdditive, {
          opacity: 1,
          duration: 800,
          ease: (t: number) => (t - 1) ** 5 + 1,
        });
      } else {
        animate(cursorAdditive, {
          opacity: 0,
          duration: 800,
          ease: (t: number) => (t - 1) ** 5 + 1,
        });
      }
    }

    animate(cursor, {
      duration: smoothCursor ? $cursorSmoothness : 0,
      translateX: mouseX,
      translateY: mouseY - 50,
      ease: (t: number) => (t - 1) ** 5 + 1,
    });

    animate(cursor, {
      duration: 1500,
      rotate: degrees,
      transformOrigin: '0px 0px 0',
      ease: (t: number) => Math.pow(2, -10 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
    });
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  };

  const handleMouseDown = (event: MouseEvent) => {
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    isMouseDown = true;
    animate(cursorInner, {
      scale: 0.9,
      duration: 800,
      ease: (t: number) => (t - 1) ** 3 + 1,
    });
    animate(cursorAdditive, {
      opacity: 1,
      scale: 0.9,
      duration: 800,
      ease: (t: number) => (t - 1) ** 5 + 1,
    });
  };

  const handleMouseUp = () => {
    rotation = 0;
    isMouseDown = false;
    applyRotation = false;
    animate(cursorInner, {
      scale: 1,
      duration: 500,
      ease: (t: number) => Math.pow(2, -10 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
    });
    animate(cursorAdditive, {
      opacity: 0,
      duration: 500,
      scale: 1,
      ease: (t: number) => (t - 1) ** 5 + 1,
    });
  };

  let cursor: HTMLElement;
  let cursorInner: HTMLDivElement;
  let cursorAdditive: HTMLImageElement;

  onMount(() => {
    document.documentElement.classList.add('hiddenCursor');
    return () => {
      document.documentElement.classList.remove('hiddenCursor');
    };
  });
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmousedown={handleMouseDown}
  onmouseup={handleMouseUp}
/>

<div class="h-7 w-7 fixed pointer-events-none z-[99999]" bind:this={cursor}>
  <div class="relative">
    <img class="absolute top-0 left-0" src={cursor_default} bind:this={cursorInner} alt="cursor" />
    <img
      class="absolute top-0 left-0 opacity-0"
      src={cursor_additive}
      bind:this={cursorAdditive}
      alt="cursor"
    />
  </div>
</div>

<style>
  :global(html.hiddenCursor),
  :global(html.hiddenCursor body),
  :global(html.hiddenCursor *),
  :global(html.hiddenCursor *:hover),
  :global(html.hiddenCursor button),
  :global(html.hiddenCursor a),
  :global(html.hiddenCursor input),
  :global(html.hiddenCursor select),
  :global(html.hiddenCursor textarea) {
    cursor: none !important;
  }
</style>
