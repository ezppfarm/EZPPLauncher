<script lang="ts">
  //TODO: maybe dynamic background images fetched from ezpp?

  const COUNT = 60;

  function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const streaks = Array.from({ length: COUNT }).map((_, i) => {
    const depth = rand(0, 2);

    const scale = 0.6 + depth * 0.8;
    const speed = 0.4 + depth * 1.35;

    const distance = 150;
    const duration = distance / speed;

    return {
      width: rand(180, 320) * scale,
      height: rand(16, 32) * scale,
      x: ((i * (180 / COUNT)) % 180) - 80,
      y: rand(-80, 100),
      opacity: 0.25 + depth * 0.65,
      duration,
      delay: rand(0, duration),
      scale,
    };
  });
</script>

<div class="absolute bg blur-[2px]">
  <div
    class="relative h-full w-full from-0% to-90% bg-gradient-to-b from-transparent to-black z-50"
  ></div>
  {#each streaks as s}
    <div
      class="streak drop-shadow-lg"
      style="
        width:{s.width}px;
        height:{s.height}px;
        left:{s.x}%;
        top:{s.y}%;
        opacity:{s.opacity};
        animation-duration:{s.duration}s;
        animation-delay:-{s.delay}s;
      "
    ></div>
  {/each}
</div>

<style>
  .bg {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: linear-gradient(180deg, #8f2f64 0%, #963f75 40%, #9a6c7f 100%);
  }

  .streak {
    position: absolute;
    background: #d6f3ff;
    border-radius: 999px;
    transform: rotate(-35deg);
    animation: move linear infinite;
    will-change: transform;
  }

  @keyframes move {
    from {
      transform: translate(-150vw, 150vh) rotate(-35deg);
    }
    to {
      transform: translate(150vw, -150vh) rotate(-35deg);
    }
  }
</style>
