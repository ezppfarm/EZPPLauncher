<script lang="ts">
  import '../app.css';
  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import { first_startup, setupValues } from '@/global';
  import { onMount } from 'svelte';
  import OsuCursor from '@/components/ui/osu-cursor/OsuCursor.svelte';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    reduceAnimations,
    userSettings,
  } from '@/userSettings';
  import { Buffer } from 'buffer';
  import { Toaster } from '@/components/ui/sonner';
  let { children } = $props();

  function disableReload() {
    if (window.location.hostname !== 'tauri.localhost') {
      return;
    }
    document.addEventListener('keydown', function (event) {
      if (
        event.key === 'F3' ||
        event.key === 'F5' ||
        event.key === 'F7' ||
        event.key === 'F8' ||
        event.key === 'F10' ||
        event.key === 'F12' ||
        (event.ctrlKey && event.key === 'r') ||
        (event.metaKey && event.key === 'r') ||
        (event.ctrlKey && event.key === 'f') ||
        (event.metaKey && event.key === 'f') ||
        (event.ctrlKey && event.key === 'g') ||
        (event.metaKey && event.key === 'g') ||
        (event.ctrlKey && event.key === 'j') ||
        (event.metaKey && event.key === 'j') ||
        (event.ctrlKey && event.key === 'p') ||
        (event.metaKey && event.key === 'p') ||
        (event.ctrlKey && event.key === 'u') ||
        (event.metaKey && event.key === 'u')
      ) {
        event.preventDefault();
      }
    });

    document.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );

    document.addEventListener(
      'selectstart',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );
  }

  onMount(async () => {
    window.Buffer = Buffer;
    disableReload();
    setupValues();
    const firstStartup = await $userSettings.init();

    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');
    const config_reduce_animations = $userSettings.value('reduce_animations');
    const config_osu_installation_path = $userSettings.value('osu_installation_path');

    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));
    reduceAnimations.set(config_reduce_animations.get(false));
    osuInstallationPath.set(config_osu_installation_path.get(''));

    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
    reduceAnimations.subscribe((val) => config_reduce_animations.set(val));

    first_startup.set(firstStartup);
  });
</script>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<Toaster richColors closeButton />

<Titlebar />
<main>
  {@render children()}
</main>
