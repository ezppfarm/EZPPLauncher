<script lang="ts">
  import NyanCat from '$assets/themes/nyan_cat/image.gif';
  import { reduceAnimations } from '$lib/userSettings';

  //TODO: maybe dynamic background images fetched from ezpp?

  const COUNT = 18;

  function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const streaks = Array.from({ length: COUNT })
    .map((_, i) => {
      const depth = rand(0, 2);

      const scale = 0.6 + depth * 0.8;
      const speed = 0.4 + depth * 1.35;

      const distance = 150;
      const duration = distance / speed;

      return {
        width: 290 * scale,
        height: 140 * scale,
        x: (i / COUNT) * 200 - 50,
        y: ((i * 137.5) % 100) - 20,
        opacity: 0.25 + depth * 0.65,
        duration,
        delay: rand(0, duration),
        scale,
      };
    })
    .sort((a, b) => a.scale - b.scale);
</script>

<div class="absolute bg blur-[2px]">
  <div
    class="relative h-full w-full from-0% to-90% bg-gradient-to-b from-transparent to-black z-50"
  ></div>
  {#each streaks as s, index (index)}
    <div
      class="streak drop-shadow-lg transition-opacity duration-1000"
      style="
        width:{s.width}px;
        height:{s.height}px;
        left:{s.x}%;
        top:{s.y}%;
        opacity:{$reduceAnimations ? 0 : s.opacity};
        animation-duration:{s.duration}s;
        animation-delay:-{s.delay}s;
      "
    >
      <img
        src={NyanCat}
        alt="nyan cat"
        class="w-full h-full"
        style="opacity:{$reduceAnimations ? 0 : s.opacity};"
      />
    </div>
  {/each}
</div>

<style>
  .bg {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: linear-gradient(
      180deg,
      var(--color-blue-800) 0%,
      var(--color-blue-600) 40%,
      var(--color-blue-900) 100%
    );
  }

  .streak {
    position: absolute;
    animation: move linear infinite;
    will-change: transform;
  }

  @keyframes move {
    from {
      transform: translate(-250vw, 0);
    }
    to {
      transform: translate(250vw, 0);
    }
  }
</style>
