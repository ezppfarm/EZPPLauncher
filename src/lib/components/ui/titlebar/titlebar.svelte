<script lang="ts">
  import Minimize from 'lucide-svelte/icons/minus';
  import Close from 'lucide-svelte/icons/x';
  import Volume2 from 'lucide-svelte/icons/volume-2';

  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { custom_theme_audio_playing, custom_theme_volume } from '@/global';
  import { reduceAnimations, userSettings } from '@/userSettings';
  import { Volume, Volume1, VolumeOff } from 'lucide-svelte';

  onMount(() => {
    const appWindow = getCurrentWindow();

    document
      .getElementById('titlebar-minimize')
      ?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
  });
</script>

<div data-tauri-drag-region class="titlebar z-[100]">
  {#if $custom_theme_audio_playing}
    {#if $custom_theme_audio_playing}
      <div class="relative flex items-center justify-center group">
        <div class="relative flex items-center justify-center p-1 cursor-pointer">
          <div
            class="absolute inset-0 bg-background rounded
               scale-80 opacity-0
               group-hover:opacity-100
               group-hover:scale-100
               {$reduceAnimations ? '' : 'transition-all duration-200 ease-out'}"
          ></div>

          {#if $custom_theme_volume > 0.7}
            <Volume2 class="z-10 pointer-events-none" size={14} />
          {:else if $custom_theme_volume >= 0.15}
            <Volume1 class="z-10 pointer-events-none" size={14} />
          {:else if $custom_theme_volume > 0}
            <Volume class="z-10 pointer-events-none" size={14} />
          {:else}
            <VolumeOff class="z-10 pointer-events-none" size={14} />
          {/if}
        </div>

        <div
          class="absolute top-full right-0 translate-x-[7px]
             opacity-0 invisible pointer-events-none -translate-y-2
             group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-hover:translate-y-0
             {$reduceAnimations ? '' : 'transition-all duration-200 ease-out'}
             z-50"
        >
          <div class="h-2 w-full"></div>

          <div
            class="flex items-center justify-center h-[120px] w-[35px]
               bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl"
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              bind:value={$custom_theme_volume}
              on:input={() => {
                $userSettings.value('volume').set($custom_theme_volume);
                $userSettings.save();
              }}
              class="volume-slider"
            />
          </div>
        </div>
      </div>
    {/if}
  {/if}
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

  .volume-slider {
    appearance: none;
    -webkit-appearance: none;

    width: 100px; /* becomes vertical */
    height: 6px;

    background: transparent;
    cursor: pointer;

    transform: rotate(-90deg);
  }

  /* track */
  .volume-slider::-webkit-slider-runnable-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
  }

  /* thumb */
  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;

    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    border: none;

    margin-top: -4px; /* center thumb */
  }

  /* Firefox */
  .volume-slider::-moz-range-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
  }

  .volume-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    border: none;
  }
</style>
