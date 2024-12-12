<script lang="ts">
  import ezppLogo from "../../../../assets/logo.png";

  type logoProps = {
    extended: boolean;
    onclick: () => void;
  };

  let { extended, onclick }: logoProps = $props();
</script>

<div
  class="w-screen {extended
    ? '-translate-y-2 scale-90'
    : 'translate-y-5 scale-125'} transition-transform select-none"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="logo-animation relative w-44 h-44 mx-auto cursor-pointer" {onclick}>
    <img class="absolute pulse-logo" src={ezppLogo} alt="logo-pulse" />
    <img class="absolute main-logo" src={ezppLogo} alt="logo" />
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
    0% {
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
