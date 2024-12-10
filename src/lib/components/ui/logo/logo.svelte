<script lang="ts">
  import ezppLogo from "../../../../assets/logo.png";
</script>

<div class="w-screen pointer-events-none">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="logo-animation relative w-44 h-44 mx-auto">
    <img class="absolute main-logo" src={ezppLogo} alt="logo" />
    <img class="absolute pulse-logo" src={ezppLogo} alt="logo-pulse" />
  </div>
</div>

<style lang="scss">
  .logo-animation {
    .pulse-logo {
      animation: 0.4s infinite forwards beat-pulse;
    }
    .main-logo {
      animation: 0.4s infinite forwards beat;
    }
  }

  @keyframes beat {
    0%,
    100% {
      scale: 1;
    }
    90% {
      scale: 1.05;
    }
  }
  @keyframes beat-pulse {
    0%,
    100% {
      scale: 0.9;
      opacity: 0;
    }
    85% {
      scale: 1.15;
      opacity: 0.25;
    }
  }
</style>
