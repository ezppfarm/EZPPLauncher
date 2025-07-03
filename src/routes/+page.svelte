<script lang="ts">
  import { currentView } from '@/global';
  import { fade } from 'svelte/transition';

  const View = $derived($currentView);
</script>

{#key View}
  <div in:fade={{ duration: 300 }}>
    <View />
  </div>
{/key}
