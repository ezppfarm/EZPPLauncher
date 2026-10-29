<script lang="ts">
  import { custom_theme_volume } from '$lib/global';
  import { themeMediaSource, themeVideoLifecycle } from '$lib/themeMedia';
  import type { ThemeV2Definition } from '$lib/themeV2';
  import { themeAssetUrl } from '$lib/themeV2';
  import { reduceAnimations } from '$lib/userSettings';
  import { trackMediaContainer } from '$lib/utils';

  let {
    definition,
    assets = '',
    assetOverrides = {},
    preview = false,
  }: {
    definition: ThemeV2Definition;
    assets?: string;
    assetOverrides?: Record<string, string>;
    preview?: boolean;
  } = $props();

  let audioElement = $state<HTMLAudioElement | undefined>(undefined);

  const assetUrl = (path: string | undefined) => {
    if (!path) return '';
    return assetOverrides[path] ?? themeAssetUrl(assets, path);
  };

  const background = $derived(definition.background);
  const overlay = $derived(definition.overlay);
  const effects = $derived(definition.effects);

  const random = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };

  const particles = $derived.by(() => {
    if ($reduceAnimations) return [];
    if (!effects || effects.type === 'none') return [];

    const count = Math.min(120, Math.max(0, Math.round(effects.density ?? 30)));
    const speed = Math.max(0.2, effects.speed ?? 1);
    return Array.from({ length: count }, (_, index) => {
      const value = (offset: number) => random(index + 1 + offset);
      const isStar = effects.type === 'stars';
      const size = isStar ? 1 + value(1) * 2.5 : 4 + value(1) * 7;
      const duration = (isStar ? 2 + value(2) * 3 : 9 + value(2) * 11) / speed;
      return {
        id: index,
        left: value(3) * 100,
        top: isStar ? value(4) * 100 : value(4) * 15,
        size,
        duration,
        delay: value(5) * duration,
        drift: -90 + value(6) * 180,
        opacity: 0.25 + value(7) * 0.65,
        rotate: value(8) * 360,
      };
    });
  });

  function trackMedia(node: HTMLElement) {
    if (preview) return {};
    return trackMediaContainer(node);
  }

  // `muted` is not reliably reflected after load, so keep the live property in
  // sync when the theme toggles it in the editor.
  function applyMuted(node: HTMLVideoElement, muted: boolean) {
    node.muted = muted;
    return {
      update(value: boolean) {
        node.muted = value;
      },
    };
  }

  $effect(() => {
    if (!audioElement || !definition.audio) return;
    audioElement.volume = $custom_theme_volume;
    if (!preview) {
      audioElement.play().catch(() => {
        // Autoplay can be rejected until the window has been interacted with.
      });
    }
  });
</script>

<div class="theme-v2 absolute inset-0 overflow-hidden" use:trackMedia>
  {#if background.type === 'color'}
    <div
      class="absolute inset-0"
      style="background-color:{background.color};opacity:{background.opacity ?? 1}"
    ></div>
  {:else if background.type === 'gradient'}
    <div
      class="absolute inset-0"
      style="background-image:linear-gradient({background.angle ??
        135}deg, {background.from}, {background.to});opacity:{background.opacity ?? 1}"
    ></div>
  {:else if background.type === 'image'}
    {#if background.src}
      <img
        class="absolute inset-0 h-full w-full"
        src={assetUrl(background.src)}
        alt=""
        aria-hidden="true"
        style="object-fit:{background.fit ?? 'cover'};opacity:{background.opacity ??
          1};filter:{background.blur
          ? `blur(${background.blur}px)`
          : 'none'};transform:{background.blur ? 'scale(1.05)' : 'none'};"
      />
    {/if}
  {:else if background.type === 'video'}
    {#if background.src}
      <video
        class="absolute inset-0 h-full w-full object-cover"
        use:themeMediaSource={assetUrl(background.src)}
        use:themeVideoLifecycle
        autoplay
        loop
        muted={background.muted !== false}
        use:applyMuted={background.muted !== false}
        playsinline
        disablepictureinpicture
        style="object-fit:{background.fit ?? 'cover'};opacity:{background.opacity ??
          1};filter:{background.blur
          ? `blur(${background.blur}px)`
          : 'none'};transform:{background.blur ? 'scale(1.05)' : 'none'};"
      ></video>
    {/if}
  {/if}

  {#if overlay && (overlay.opacity ?? 0) > 0}
    <div
      class="absolute inset-0 pointer-events-none"
      style="background-color:{overlay.color ?? '#000000'};opacity:{overlay.opacity ?? 0}"
    ></div>
  {/if}

  {#if overlay && (overlay.vignette ?? 0) > 0}
    <div
      class="vignette absolute inset-0 pointer-events-none"
      style="opacity:{overlay.vignette ?? 0}"
    ></div>
  {/if}

  {#if effects && effects.type !== 'none'}
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {#each particles as particle (particle.id)}
        <span
          class="particle {effects.type}"
          style="left:{particle.left}%;top:{particle.top}%;width:{particle.size}px;height:{particle.size}px;opacity:{particle.opacity};--particle-color:{effects.color ??
            '#ffffff'};--particle-drift:{particle.drift}px;--particle-duration:{particle.duration}s;--particle-delay:-{particle.delay}s;--particle-rotate:{particle.rotate}deg;animation-duration:{particle.duration}s;animation-delay:-{particle.delay}s;"
        ></span>
      {/each}
    </div>
  {/if}

  {#if definition.audio && !preview}
    <audio
      bind:this={audioElement}
      use:themeMediaSource={assetUrl(definition.audio.src)}
      loop={definition.audio.loop !== false}
      autoplay
    ></audio>
  {/if}
</div>

<style lang="scss">
  .vignette {
    background: radial-gradient(ellipse at center, transparent 38%, rgba(0, 0, 0, 0.92) 100%);
  }

  .particle {
    position: absolute;
    display: block;
    background: var(--particle-color);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform, opacity;

    &.snow {
      border-radius: 9999px;
      filter: blur(0.5px);
      animation-name: v2-snow;
    }

    &.petals {
      border-radius: 70% 0 70% 0;
      animation-name: v2-petals;
    }

    &.bubbles {
      border-radius: 9999px;
      border: 1px solid var(--particle-color);
      background: color-mix(in srgb, var(--particle-color) 16%, transparent);
      animation-name: v2-bubbles;
    }

    &.stars {
      border-radius: 9999px;
      box-shadow: 0 0 6px var(--particle-color);
      animation-name: v2-stars;
      animation-timing-function: ease-in-out;
    }
  }

  @keyframes v2-snow {
    from {
      transform: translate3d(0, -12vh, 0);
    }
    to {
      transform: translate3d(var(--particle-drift), 112vh, 0);
    }
  }

  @keyframes v2-petals {
    from {
      transform: translate3d(0, -12vh, 0) rotate(var(--particle-rotate));
    }
    50% {
      transform: translate3d(calc(var(--particle-drift) * 0.55), 50vh, 0)
        rotate(calc(var(--particle-rotate) + 180deg));
    }
    to {
      transform: translate3d(var(--particle-drift), 112vh, 0)
        rotate(calc(var(--particle-rotate) + 360deg));
    }
  }

  @keyframes v2-bubbles {
    from {
      transform: translate3d(0, 110vh, 0);
    }
    to {
      transform: translate3d(var(--particle-drift), -12vh, 0);
    }
  }

  @keyframes v2-stars {
    0%,
    100% {
      opacity: 0.15;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
</style>
