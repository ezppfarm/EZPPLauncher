<script lang="ts">
  import Minimize from 'lucide-svelte/icons/minus';
  import Close from 'lucide-svelte/icons/x';

  import Logo from '$assets/logo.png';

  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { launcherVersion } from '@/global';
  import Badge from '../badge/badge.svelte';
  import { reduceAnimations } from '@/userSettings';

  onMount(() => {
    const appWindow = getCurrentWindow();

    document
      .getElementById('titlebar-minimize')
      ?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
  });
</script>

<div data-tauri-drag-region class="titlebar z-[100]">
  <div class="relative flex items-center justify-center p-1 group" id="titlebar-minimize">
    <div
      class="absolute inset-0 bg-background rounded
           scale-80 opacity-0
          group-hover:opacity-100
           group-hover:scale-100
           {$reduceAnimations ? '' : 'transition-all duration-200 ease-out'} 
           origin-center"
    ></div>

    <Minimize class="z-10 pointer-events-none" size={14} />
  </div>
  <div class="relative flex items-center justify-center p-1 group" id="titlebar-close">
    <div
      class="absolute inset-0 bg-red-500 rounded
           scale-80 opacity-0
            group-hover:opacity-100
           group-hover:scale-100
           {$reduceAnimations ? '' : 'transition-all duration-200 ease-out'} 
           origin-center"
    ></div>

    <Close class="z-10 pointer-events-none" size={14} />
  </div>
</div>

<style lang="scss">
  .titlebar {
    height: 35px;
    user-select: none;
    display: flex;
    justify-content: flex-end;
    gap: 5px;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    margin-bottom: 10px;
    padding-right: 5px;
    pointer-events: auto;
  }
</style>
