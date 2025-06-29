<script lang="ts">
  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import '../app.css';
  import { setupValues } from '@/global';
  import { onMount } from 'svelte';
  import OsuCursor from '@/components/ui/osu-cursor/OsuCursor.svelte';
  let { children } = $props();

  onMount(setupValues);
</script>

<OsuCursor />

<Titlebar />
<main>
  {@render children()}
</main>
