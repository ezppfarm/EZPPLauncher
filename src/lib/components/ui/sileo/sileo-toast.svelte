<script lang="ts">
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import type { SileoOptions } from 'sileo';

  let props: SileoOptions = $props();
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

<div bind:this={rootEl}></div>
