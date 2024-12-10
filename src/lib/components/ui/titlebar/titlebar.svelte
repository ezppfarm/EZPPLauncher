<script lang="ts">
  import Minimize from "lucide-svelte/icons/minus";
  import Close from "lucide-svelte/icons/x";

  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";

  onMount(() => {
    const appWindow = getCurrentWindow();

    document
      .getElementById("titlebar-minimize")
      ?.addEventListener("click", () => appWindow.minimize());
    document
      .getElementById("titlebar-close")
      ?.addEventListener("click", () => appWindow.close());
  });
</script>

<div data-tauri-drag-region class="titlebar z-[9999]">
  <!-- <p class="mr-auto ms-2 text-sm">EZPPLauncher</p> -->
  <div class="titlebar-button" id="titlebar-minimize">
    <Minimize size={18} />
  </div>
  <div class="titlebar-button close" id="titlebar-close">
    <Close size={18} />
  </div>
</div>

<style lang="scss">
  .titlebar {
    height: 30px;
    /* background: #040612; */
    user-select: none;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    margin-bottom: 10px;
  }
  .titlebar-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 45px;
    height: 100%;
    user-select: none;
    -webkit-user-select: none;
  }
  .titlebar-button:hover {
    &.close {
      background: #c22e2e;
    }
    background: #2d3049;
  }
</style>
