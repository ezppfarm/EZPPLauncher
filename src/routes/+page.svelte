<script lang="ts">
  import { currentView, launcherVersion, trackingEnabled } from '@/global';
  import { fade } from 'svelte/transition';

  const View = $derived($currentView);
</script>

<svelte:head>
  {#if $launcherVersion !== '' && $trackingEnabled}
    <script
      defer
      src="https://analytics.ez-pp.farm/script.js"
      data-website-id="b03f0013-64f0-42ce-85c0-abd56e8b3c64"
      data-tag={$launcherVersion}
    ></script>
  {/if}
</svelte:head>

{#key View}
  <div in:fade={{ duration: 300 }}>
    <View />
  </div>
{/key}
