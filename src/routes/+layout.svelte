<script lang="ts">
  import Titlebar from "@/components/ui/titlebar/titlebar.svelte";
  import "../app.css";
  let { children } = $props();
</script>

<Titlebar />
<main>
  {@render children()}
</main>
