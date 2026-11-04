<script lang="ts">
  import lottie, { type AnimationItem } from 'lottie-web';
  import { onDestroy, onMount } from 'svelte';

  let {
    src,
    loop = true,
    autoplay = true,
    speed = 1,
  }: {
    src: string;
    loop?: boolean;
    autoplay?: boolean;
    speed?: number;
  } = $props();

  let container = $state<HTMLDivElement | undefined>(undefined);
  let animation: AnimationItem | undefined;
  let reducedMotion = false;
  let windowActive = true;

  function syncPlayback() {
    if (!animation) return;
    animation.loop = loop;
    animation.setSpeed(speed);
    if (autoplay && !reducedMotion && windowActive && document.visibilityState === 'visible') {
      animation.play();
    } else {
      animation.pause();
    }
  }

  onMount(() => {
    if (!container || !src) return;
    reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let cancelled = false;

    const onBlur = () => {
      windowActive = false;
      syncPlayback();
    };
    const onFocus = () => {
      windowActive = true;
      syncPlayback();
    };
    const onVisibilityChange = () => syncPlayback();

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const start = (animationData?: unknown) => {
      if (cancelled || !container) return;
      try {
        animation = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop,
          autoplay:
            autoplay && !reducedMotion && windowActive && document.visibilityState === 'visible',
          ...(animationData ? { animationData } : { path: src }),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        animation.setSpeed(speed);
        if (reducedMotion) {
          animation.addEventListener('DOMLoaded', () => animation?.goToAndStop(0, true));
        }
      } catch (error) {
        console.warn('Could not load the Lottie layer', error);
      }
    };

    // Fetching the JSON ourselves works with Tauri's asset protocols, where
    // lottie-web's internal XHR can be blocked. Fall back to its own loader.
    void fetch(src)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data) => start(data))
      .catch(() => start());

    return () => {
      cancelled = true;
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });

  $effect(() => {
    syncPlayback();
  });

  onDestroy(() => {
    animation?.destroy();
    animation = undefined;
  });
</script>

<div bind:this={container} class="h-full w-full" aria-hidden="true"></div>
