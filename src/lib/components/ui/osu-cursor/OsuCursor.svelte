<script lang="ts">
  import cursor_additive from '$assets/cursor-additive.png';
  import cursor_default from '$assets/cursor.png';
  import { cursorSmoothness } from '$lib/userSettings';
  import { animate } from 'animejs';
  import { onMount } from 'svelte';

  let { smoothCursor = true }: { smoothCursor?: boolean } = $props();

  const VELOCITY_WINDOW_MS = 16;
  const SPEED_THRESHOLD = 9;
  const REQUIRED_CONSECUTIVE = 3;

  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let prevAppliedX = -1;
  let prevAppliedY = -1;
  let hasMoved = false;

  let lastMouseX = 0;
  let lastMouseY = 0;
  let isMouseDown = false;
  let isHoveringInteractive = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let targetDegrees = 0;
  let currentDegrees = 0;
  let applyRotation = false;

  let lastVelocityTime = 0;
  let consecutiveHighSpeed = 0;
  let velocityAccumX = 0;
  let velocityAccumY = 0;
  let rotateSpringAnim: ReturnType<typeof animate> | null = null;

  let cursor: HTMLElement;
  let cursorRotateWrapper: HTMLDivElement;
  let cursorInner: HTMLImageElement;
  let cursorAdditive: HTMLImageElement;

  function isInteractive(el: Element | null): boolean {
    while (el) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const computed = getComputedStyle(el);
      if (
        ['button', 'a', 'input', 'select', 'textarea', 'label', 'option'].includes(tag) ||
        (role && ['button', 'link', 'checkbox', 'combobox', 'menuitem', 'option'].includes(role)) ||
        computed.cursor === 'pointer'
      ) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function dampContinuously(current: number, target: number, halfLife: number, dt: number): number {
    if (halfLife <= 0 || dt <= 0) return target;
    return target + (current - target) * Math.pow(0.5, dt / halfLife);
  }

  const handleMouseMove = (e: MouseEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;

    if (!hasMoved) {
      currentX = targetX;
      currentY = targetY;
      prevAppliedX = targetX;
      prevAppliedY = targetY;
      lastMouseX = targetX;
      lastMouseY = targetY;
      hasMoved = true;
      if (cursor) {
        cursor.style.opacity = '1';
        cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      return;
    }

    if (cursor) {
      cursor.style.opacity = '1';
    }

    velocityAccumX += targetX - lastMouseX;
    velocityAccumY += targetY - lastMouseY;

    const now = performance.now();
    const dt = now - lastVelocityTime;

    if (dt >= VELOCITY_WINDOW_MS) {
      const speed = Math.sqrt(velocityAccumX ** 2 + velocityAccumY ** 2) / dt;

      if (speed > SPEED_THRESHOLD) {
        consecutiveHighSpeed++;
        if (!applyRotation && isMouseDown && consecutiveHighSpeed >= REQUIRED_CONSECUTIVE) {
          applyRotation = true;
        }
      } else {
        consecutiveHighSpeed = 0;
      }

      velocityAccumX = 0;
      velocityAccumY = 0;
      lastVelocityTime = now;
    }

    if (isMouseDown && applyRotation) {
      const deltaX = targetX - dragStartX;
      const deltaY = targetY - dragStartY;
      const newDegrees = (Math.atan2(-deltaX, deltaY) * 180) / Math.PI + 24.3;

      let diff = (newDegrees - targetDegrees) % 360;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;

      targetDegrees += diff;
    }

    const el = document.elementFromPoint(targetX, targetY);
    const hovering = isInteractive(el);
    if (hovering !== isHoveringInteractive) {
      isHoveringInteractive = hovering;
      if (!isMouseDown) {
        animate(cursorAdditive, {
          opacity: isHoveringInteractive ? 1 : 0,
          duration: 800,
          ease: (t: number) => (t - 1) ** 5 + 1,
        });
      }
    }

    lastMouseX = targetX;
    lastMouseY = targetY;
  };

  const handleMouseDown = (event: MouseEvent) => {
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    velocityAccumX = 0;
    velocityAccumY = 0;
    consecutiveHighSpeed = 0;
    lastVelocityTime = performance.now();

    isMouseDown = true;

    if (rotateSpringAnim) {
      rotateSpringAnim.pause();
      rotateSpringAnim = null;
    }

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
    isMouseDown = false;
    const hadRotation = applyRotation || Math.abs(currentDegrees) > 0.1;
    applyRotation = false;
    consecutiveHighSpeed = 0;
    velocityAccumX = 0;
    velocityAccumY = 0;

    animate(cursorInner, {
      scale: 1,
      duration: 500,
      ease: (t: number) => Math.pow(2, -10 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
    });
    animate(cursorAdditive, {
      opacity: isHoveringInteractive ? 1 : 0,
      duration: 500,
      scale: 1,
      ease: (t: number) => (t - 1) ** 5 + 1,
    });

    if (hadRotation && cursorRotateWrapper) {
      rotateSpringAnim = animate(cursorRotateWrapper, {
        rotate: 0,
        duration: 1200,
        ease: (t: number) => Math.pow(2, -10 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
        onComplete: () => {
          currentDegrees = 0;
          targetDegrees = 0;
          rotateSpringAnim = null;
        },
      });
    }
  };

  const handleMouseLeave = () => {
    if (cursor) cursor.style.opacity = '0';
  };

  const handleMouseEnter = () => {
    if (cursor && hasMoved) cursor.style.opacity = '1';
  };

  onMount(() => {
    document.documentElement.classList.add('hiddenCursor');
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    let animationFrameId: number;
    let lastFrameTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(Math.max(now - lastFrameTime, 0), 64);
      lastFrameTime = now;

      if (hasMoved && cursor) {
        if (!smoothCursor) {
          currentX = targetX;
          currentY = targetY;
        } else {
          // Continuous exponential damping half-life in ms (mathematically invariant across refresh rates).
          const halfLife = $cursorSmoothness > 50 ? 14 : Math.max(1, $cursorSmoothness || 14);
          currentX = dampContinuously(currentX, targetX, halfLife, dt);
          currentY = dampContinuously(currentY, targetY, halfLife, dt);
        }

        if (Math.abs(targetX - currentX) < 0.05) currentX = targetX;
        if (Math.abs(targetY - currentY) < 0.05) currentY = targetY;

        if (currentX !== prevAppliedX || currentY !== prevAppliedY) {
          cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
          prevAppliedX = currentX;
          prevAppliedY = currentY;
        }

        if (isMouseDown && applyRotation && cursorRotateWrapper) {
          const rotFactor = 1 - Math.pow(0.5, dt / 25);
          currentDegrees += (targetDegrees - currentDegrees) * rotFactor;
          cursorRotateWrapper.style.transform = `rotate(${currentDegrees}deg)`;
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove('hiddenCursor');
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
      if (rotateSpringAnim) {
        rotateSpringAnim.pause();
      }
    };
  });
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmousedown={handleMouseDown}
  onmouseup={handleMouseUp}
/>

<div class="h-7 w-7 fixed top-0 left-0 pointer-events-none z-[9999] opacity-0" bind:this={cursor}>
  <div class="relative origin-top-left" bind:this={cursorRotateWrapper}>
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
