<script lang="ts">
  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import '../app.css';
  import { setupValues } from '@/global';
  import { onMount } from 'svelte';
  let { children } = $props();

  onMount(setupValues);
</script>

<Titlebar />
<main>
  {@render children()}
</main>
