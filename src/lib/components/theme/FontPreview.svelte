<script module lang="ts">
  let previewCount = 0;
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  type Props = {
    family: string;
    src: string;
    weight?: string;
    style?: 'normal' | 'italic';
    text?: string;
    class?: string;
  };

  let {
    family,
    src,
    weight = '400',
    style = 'normal',
    text = family,
    class: className = '',
  }: Props = $props();

  let host = $state<HTMLSpanElement>();
  let visible = $state(false);
  let renderedFamily = $state<string>();
  let face: FontFace | undefined;

  onMount(() => {
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visible = true;
        observer.disconnect();
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!visible) return;
    if (!src) {
      renderedFamily = family;
      return;
    }
    let cancelled = false;
    const previewFamily = `EZPPSourcePreview_${previewCount++}`;

    void (async () => {
      try {
        const candidate = new FontFace(previewFamily, `url("${src}")`, {
          weight,
          style,
          display: 'swap',
        });
        const loaded = await candidate.load();
        if (cancelled) return;
        document.fonts.add(loaded);
        face = loaded;
        renderedFamily = previewFamily;
      } catch {
        // A preview failure should leave the row readable in the fallback font.
      }
    })();

    return () => {
      cancelled = true;
      if (face && face.family === previewFamily) {
        document.fonts.delete(face);
        face = undefined;
      }
      if (renderedFamily === previewFamily) renderedFamily = undefined;
    };
  });
</script>

<span
  bind:this={host}
  class={className}
  style:font-family={renderedFamily
    ? `"${renderedFamily}", ui-sans-serif, system-ui, sans-serif`
    : undefined}
  style:font-weight={weight}
  style:font-style={style}
>
  {text}
</span>
