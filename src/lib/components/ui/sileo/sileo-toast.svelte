<script lang="ts">
  import type { SileoToasterProps } from './types';
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';

  let props: SileoToasterProps = $props();
  let rootEl: HTMLElement;

  $effect(() => {
    const root = createRoot(rootEl);

    import('sileo').then(({ Toaster }) => {
      const sileo = createElement(Toaster, { ...props });
      root.render(sileo);
    });

    return () => root.unmount();
  });
</script>

<div class="z-9999" bind:this={rootEl}></div>
