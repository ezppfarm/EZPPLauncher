<script lang="ts">
  import Minimize from 'lucide-svelte/icons/minus';
  import Close from 'lucide-svelte/icons/x';

  import Logo from '$assets/logo.png';

  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';

  onMount(() => {
    const appWindow = getCurrentWindow();

    document
      .getElementById('titlebar-minimize')
      ?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
  });
</script>

<div data-tauri-drag-region class="titlebar z-[60] border-b border-theme-800/90">
  <div class="mr-auto ms-2 flex flex-row gap-2 items-center text-[1.05rem] font-semibold">
    <img src={Logo} alt="EZPP Launcher Logo" class="h-11 w-11 inline-block" />
    <span>EZPPLauncher</span>
  </div>
  <div class="titlebar-button rounded-lg transition-colors duration-75" id="titlebar-minimize">
    <Minimize size={18} />
  </div>
  <div class="titlebar-button close rounded-lg transition-colors duration-75" id="titlebar-close">
    <Close size={18} />
  </div>
</div>

<style lang="scss">
  .titlebar {
    height: 50px;
    /* background: #040612; */
    user-select: none;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    margin-bottom: 10px;
    margin-right: 8px;
    pointer-events: all !important;
  }
  .titlebar-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 40px;
    height: 40px;
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
