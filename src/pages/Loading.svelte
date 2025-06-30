<script lang="ts">
  import Logo from '$assets/logo.png';
  import { animate } from 'animejs';
  import { onMount } from 'svelte';

  let ezppLogo: HTMLImageElement;
  let spinnerCircle: SVGCircleElement;

  //TODO: use this to check for updates upon launch

  const doBPMAnimation = () => {
    setInterval(async () => {
      animate(ezppLogo, {
        scale: 1.1,
        duration: 900,
        ease: (t: number) => Math.pow(2, -5 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
        onComplete: () => {},
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      animate(ezppLogo, {
        scale: 1,
        duration: 900,
        ease: (t: number) => (t - 1) ** 7 + 1,
        onComplete: () => {},
      });
    }, 450);
  };

  // Animate logo on mount: pop-in, then pulse
  onMount(() => {
    // Logo pop-in and pulse
    animate(ezppLogo, {
      opacity: [0, 1],
      scale: [0, 1],
      duration: 900,
      ease: (t: number) => Math.pow(2, -5 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
      onComplete: doBPMAnimation,
    });
    // Spinner animation (seamless, starts at 12 o'clock)
    if (spinnerCircle) {
      animate(spinnerCircle, {
        strokeDashoffset: [0, -565],
        duration: 1800,
        easing: 'linear',
        loop: true,
      });
    }
  });
</script>

<div class="flex flex-col items-center justify-center mt-[50px] h-[calc(100vh-50px)] w-full">
  <div class="relative w-80 h-80 flex items-center justify-center">
    <svg
      class="absolute top-0 left-0 w-full h-full animate-spin"
      style="animation-duration: 5s;"
      viewBox="0 0 208 208"
    >
      <circle
        cx="104"
        cy="104"
        r="90"
        fill="none"
        stroke="#ff0098"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="180 385"
        stroke-dashoffset="0"
        bind:this={spinnerCircle}
      />
    </svg>
    <img
      src={Logo}
      alt="EZPPLauncher Logo"
      class="w-52 h-52 mb-2 relative z-10"
      bind:this={ezppLogo}
    />
  </div>
</div>
