<script lang="ts">
  import Logo from '$assets/logo.png';
  import { estimateRefreshRate } from '@/displayUtils';
  import { current_view, first_startup } from '@/global';
  import { cursorSmoothness } from '@/userSettings';
  import { animate, utils } from 'animejs';
  import { onMount } from 'svelte';
  import SetupWizard from './SetupWizard.svelte';
  import Launch from './Launch.svelte';

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

  const calculateCursorSmoothness = async () => {
    const refreshRate = await estimateRefreshRate();
    const hzMin = 60;
    const hzMax = 144;
    const durationMin = 70;
    const durationMax = 180;

    const duration =
      durationMin + ((refreshRate - hzMin) / (hzMax - hzMin)) * (durationMax - durationMin);

    cursorSmoothness.set(Math.round(duration));
  };

  const prepare = async () => {
    await calculateCursorSmoothness();
    animate(ezppLogo, {
      opacity: [1, 0],
      scale: [1, 1.05],
      duration: 1000,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: () => {},
    });
    animate(spinnerCircle, {
      opacity: 0,
      duration: 1000,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: () => {},
    });
    setTimeout(() => {
      if ($first_startup) current_view.set(SetupWizard);
      else current_view.set(Launch);
    }, 250);
  };

  onMount(() => {
    animate(ezppLogo, {
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 900,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: doBPMAnimation,
    });
    animate(spinnerCircle, {
      strokeDashoffset: [0, -565],
      duration: 1800,
      easing: 'linear',
      loop: true,
    });

    prepare();

    return () => {
      utils.remove(ezppLogo);
      utils.remove(spinnerCircle);
    };
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
