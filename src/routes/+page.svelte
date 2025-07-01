<script lang="ts">
  import { current_view } from '@/global';
  import { fade } from 'svelte/transition';

  const View = $derived($current_view);
</script>

{#key View}
  <div in:fade={{ duration: 300 }}>
    <View />
  </div>
{/key}
