<script lang="ts">
  import { THEME_ICON_BODIES } from '$lib/themeIconData';
  import { DEFAULT_THEME_ICON_SET, type ThemeIconName, type ThemeIconSet } from '$lib/themeIcons';

  let {
    name,
    set = DEFAULT_THEME_ICON_SET,
    size = '1em',
    class: className = '',
  }: {
    name: ThemeIconName;
    set?: ThemeIconSet;
    size?: number | string;
    class?: string;
  } = $props();

  const icon = $derived(
    THEME_ICON_BODIES[set]?.[name] ?? THEME_ICON_BODIES[DEFAULT_THEME_ICON_SET][name]
  );
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox={`0 0 ${icon.width} ${icon.height}`}
  width={size}
  height={size}
  class={className}
  aria-hidden="true"
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html icon.body}
</svg>
