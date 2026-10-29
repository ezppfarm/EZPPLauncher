<script lang="ts">
  import { onMount } from 'svelte';

  type ConfettiCannonProps = {
    colors?: string[];
    count?: number;
  };

  let { colors = ['#ff006e', '#a78bfa', '#7dd3fc', '#fbbf24'], count = 820 }: ConfettiCannonProps =
    $props();

  let canvas = $state<HTMLCanvasElement>();

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    rotation: number;
    spin: number;
    flutterPhase: number;
    flutterSpeed: number;
    swayPhase: number;
    swaySpeed: number;
    swayAmount: number;
    terminalVelocity: number;
    wind: number;
    color: string;
    delay: number;
    age: number;
    lifetime: number;
  };

  onMount(() => {
    const element = canvas;
    if (!element) return;

    const context = element.getContext('2d');
    if (!context) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let particles: Particle[] = [];

    const spawn = () => {
      const rect = element.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      element.width = Math.max(1, Math.round(width * dpr));
      element.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = Array.from({ length: count }, (_, index) => {
        const fromLeft = index % 2 === 0;
        const direction = fromLeft ? 1 : -1;
        const streamer = Math.random() < 0.35;
        const pieceWidth = streamer ? random(3, 5) : random(5, 8);
        const pieceHeight = streamer ? random(12, 24) : random(7, 14);

        return {
          x: fromLeft ? random(0, 28) : width - random(0, 28),
          y: height - random(0, 16),
          // Aim inward and up from each bottom corner. Horizontal drag and
          // gravity turn the straight launch into a natural arc.
          vx: direction * random(160, 900),
          vy: -random(1050, 1450),
          width: pieceWidth,
          height: pieceHeight,
          rotation: random(0, Math.PI * 2),
          spin: random(-4, 4),
          flutterPhase: random(0, Math.PI * 2),
          flutterSpeed: random(2.5, 6.5),
          swayPhase: random(0, Math.PI * 2),
          swaySpeed: random(2.2, 4.2),
          swayAmount: random(4, 14),
          terminalVelocity: random(130, 230),
          wind: random(-8, 8),
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: random(0, 0.25),
          age: 0,
          lifetime: random(7, 9.5),
        };
      });
    };

    const paint = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      elapsed += delta;

      context.clearRect(0, 0, width, height);

      let alive = false;

      for (const particle of particles) {
        if (elapsed < particle.delay) {
          alive = true;
          continue;
        }
        if (particle.age >= particle.lifetime) continue;

        particle.age += delta;
        if (particle.age >= particle.lifetime) continue;
        alive = true;

        particle.vx *= Math.exp(-0.5 * delta);

        if (particle.vy < 0) {
          // The upward burst is slowed by gravity...
          particle.vy += 1400 * delta;
        } else {
          // ...then the paper drifts down at its own slow terminal speed
          // instead of accelerating like a solid object.
          particle.vy += (particle.terminalVelocity - particle.vy) * (1 - Math.exp(-2.6 * delta));
        }

        particle.x += (particle.vx + particle.wind) * delta;
        particle.y += particle.vy * delta;
        particle.rotation += particle.spin * delta;

        if (particle.x < -80 || particle.x > width + 80 || particle.y > height + 120) {
          continue;
        }

        const fadeStart = particle.lifetime - 1.8;
        const alpha =
          particle.age > fadeStart ? Math.max(0, 1 - (particle.age - fadeStart) / 1.8) : 1;
        if (alpha <= 0) continue;

        const flutter = Math.cos(particle.flutterPhase + particle.age * particle.flutterSpeed);
        const sway = Math.sin(particle.age * particle.swaySpeed + particle.swayPhase);
        const scaleX = 0.15 + Math.abs(flutter) * 0.85;

        context.save();
        context.translate(particle.x + sway * particle.swayAmount, particle.y + sway * 3.5);
        context.rotate(particle.rotation + flutter * 0.5);
        context.scale(scaleX, 1);
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.fillRect(
          -particle.width / 2,
          -particle.height / 2,
          particle.width,
          particle.height
        );
        context.restore();
      }

      if (alive) {
        frame = requestAnimationFrame(paint);
      } else {
        context.clearRect(0, 0, width, height);
      }
    };

    spawn();
    frame = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(frame);
    };
  });
</script>

<canvas
  bind:this={canvas}
  aria-hidden="true"
  class="pointer-events-none absolute inset-0 z-20 h-full w-full"
></canvas>
