<script lang="ts">
  import { getThemeIconBody } from '$lib/themeIconCatalog';
  import { DEFAULT_THEME_ICON_SET, type ThemeIconName, type ThemeIconSet } from '$lib/themeIcons';

  let {
    name,
    set = DEFAULT_THEME_ICON_SET,
    size = '1em',
    class: className = '',
    style = '',
  }: {
    name: ThemeIconName;
    set?: ThemeIconSet;
    size?: number | string;
    class?: string;
    style?: string;
  } = $props();

  const icon = $derived(getThemeIconBody(name, set));
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox={`0 0 ${icon.width} ${icon.height}`}
  width={size}
  height={size}
  class={className}
  {style}
  aria-hidden="true"
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html icon.body}
</svg>
