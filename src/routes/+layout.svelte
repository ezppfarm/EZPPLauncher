<script lang="ts">
  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import '../app.css';
  import { current_view, first_startup, setupValues } from '@/global';
  import { onMount } from 'svelte';
  import OsuCursor from '@/components/ui/osu-cursor/OsuCursor.svelte';
  import { cursorSmoothening, customCursor, reduceAnimations, userSettings } from '@/userSettings';
  import { Buffer } from 'buffer';
  import SetupWizard from '../pages/SetupWizard.svelte';
  import Launch from '../pages/Launch.svelte';
  let { children } = $props();

  onMount(async () => {
    window.Buffer = Buffer;
    setupValues();
    const firstStartup = await $userSettings.init();

    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');
    const config_reduce_animations = $userSettings.value('reduce_animations');

    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));
    reduceAnimations.set(config_reduce_animations.get(false));

    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
    reduceAnimations.subscribe((val) => config_reduce_animations.set(val));

    first_startup.set(firstStartup);
  });
</script>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<Titlebar />
<main>
  {@render children()}
</main>
