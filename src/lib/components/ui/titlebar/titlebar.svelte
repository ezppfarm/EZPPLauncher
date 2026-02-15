<script lang="ts">
  import Minimize from 'lucide-svelte/icons/minus';
  import Close from 'lucide-svelte/icons/x';

  import Logo from '$assets/logo.png';

  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { launcherVersion } from '@/global';
  import Badge from '../badge/badge.svelte';

  onMount(() => {
    const appWindow = getCurrentWindow();

    document
      .getElementById('titlebar-minimize')
      ?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
  });
</script>

<div data-tauri-drag-region class="titlebar z-[100]">
  <div class="titlebar-button rounded transition-colors duration-75" id="titlebar-minimize">
    <Minimize size={14} />
  </div>
  <div class="titlebar-button close rounded transition-colors duration-75" id="titlebar-close">
    <Close size={14} />
  </div>
</div>

<style lang="scss">
  .titlebar {
    height: 35px;
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
    padding-right: 5px;
    pointer-events: auto;
  }
  .titlebar-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 25px;
    height: 25px;
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
