import { reduceAnimations } from '$lib/userSettings';
import { get } from 'svelte/store';

export type ThemeParallaxOptions = {
  enabled?: boolean;
  intensity?: number;
};

const clampIntensity = (intensity: number | undefined) =>
  Math.min(1, Math.max(0.05, typeof intensity === 'number' ? intensity : 0.25));

/**
 * Tracks the pointer for a theme host and exposes the smoothed offset as
 * `--mouse-px` / `--mouse-py`. The host must contain both the background and
 * the freeform layers so those variables are inherited by every layer.
 */
export function themeParallax(node: HTMLElement, options: ThemeParallaxOptions = {}) {
  let enabled = options.enabled === true;
  let intensity = clampIntensity(options.intensity);
  let mousePx = 0;
  let mousePy = 0;
  let targetPx = 0;
  let targetPy = 0;
  let animFrame: number | undefined;
  let reduced = get(reduceAnimations);

  function apply() {
    node.style.setProperty('--mouse-px', mousePx.toFixed(4));
    node.style.setProperty('--mouse-py', mousePy.toFixed(4));
  }

  function stop() {
    if (animFrame !== undefined) {
      cancelAnimationFrame(animFrame);
      animFrame = undefined;
    }
  }

  function reset() {
    stop();
    mousePx = 0;
    mousePy = 0;
    targetPx = 0;
    targetPy = 0;
    apply();
  }

  function updateParallax() {
    animFrame = undefined;
    const dx = targetPx - mousePx;
    const dy = targetPy - mousePy;

    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) {
      mousePx = targetPx;
      mousePy = targetPy;
      apply();
      return;
    }

    mousePx += dx * 0.12;
    mousePy += dy * 0.12;
    apply();
    animFrame = requestAnimationFrame(updateParallax);
  }

  function onWindowMouseMove(event: MouseEvent) {
    if (!enabled || reduced) return;

    const width = window.innerWidth || 1000;
    const height = window.innerHeight || 650;
    targetPx = (event.clientX / width - 0.5) * 2 * intensity;
    targetPy = (event.clientY / height - 0.5) * 2 * intensity;

    if (animFrame === undefined) {
      animFrame = requestAnimationFrame(updateParallax);
    }
  }

  const unsubscribe = reduceAnimations.subscribe((value) => {
    reduced = value;
    if (reduced) reset();
  });

  window.addEventListener('mousemove', onWindowMouseMove);
  apply();

  return {
    update(next: ThemeParallaxOptions = {}) {
      enabled = next.enabled === true;
      intensity = clampIntensity(next.intensity);
      if (!enabled || reduced) reset();
    },
    destroy() {
      unsubscribe();
      window.removeEventListener('mousemove', onWindowMouseMove);
      stop();
      node.style.removeProperty('--mouse-px');
      node.style.removeProperty('--mouse-py');
    },
  };
}
