<script lang="ts">
  import ezppLogo from "../../../../assets/logo.png";
  import { playAudio } from "@/utils";

  type logoProps = {
    extended: boolean;
    onclick: () => void;
  };

  let { extended, onclick }: logoProps = $props();

  let hovered = $state(false);
  const bpm = $state(130);
</script>

<div
  class="w-screen {extended
    ? hovered
      ? '-translate-y-1 scale-100'
      : '-translate-y-1 scale-90'
    : hovered
      ? 'translate-y-5 scale-150'
      : 'translate-y-5 scale-125'} transition-transform select-none"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="logo-animation relative w-44 h-44 mx-auto cursor-pointer"
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    onclick={() => {
      if (extended) {
        playAudio("/audio/menuBack.wav", 0.35);
      } else {
        playAudio("/audio/menuHit.wav", 0.35);
      }
      onclick();
    }}
  >
    <img
      class="absolute pulse-logo"
      style="animation-duration: {(1000 * 60) / bpm}ms;"
      src={ezppLogo}
      alt="logo-pulse"
    />
    <img
      class="absolute main-logo"
      style="animation-duration: {(1000 * 60) / bpm}ms;"
      src={ezppLogo}
      alt="logo"
    />
  </div>
</div>

<style lang="scss">
  .logo-animation {
    .pulse-logo {
      animation: 0.5s 0.2s infinite forwards beat-pulse;
    }
    .main-logo {
      animation: 0.5s infinite forwards beat;
    }
  }

  @keyframes beat {
    0%,
    100% {
      scale: 1.08;
    }
    90% {
      scale: 1;
    }
  }
  @keyframes beat-pulse {
    0%,
    10% {
      scale: 0.5;
      opacity: 0.5;
      filter: blur(0px);
    }
    100% {
      scale: 1.4;
      opacity: 0;
      filter: blur(2px);
    }
  }
</style>
