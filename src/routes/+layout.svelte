<script lang="ts">
  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import '../app.css';
  import { setupValues } from '@/global';
  import { onMount } from 'svelte';
  import OsuCursor from '@/components/ui/osu-cursor/OsuCursor.svelte';
  import { cursorSmoothening, customCursor, userSettings } from '@/userSettings';
  import { Buffer } from 'buffer';
  let { children } = $props();

  onMount(async () => {
    window.Buffer = Buffer;
    setupValues();
    await $userSettings.init();

    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');

    console.log("yes", config_cursor_smoothening.get(true))

    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));

    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
  });
</script>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<Titlebar />
<main>
  {@render children()}
</main>
