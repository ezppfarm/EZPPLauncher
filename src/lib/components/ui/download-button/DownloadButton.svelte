<script lang="ts">
  import ThemeIcon from '$lib/components/theme/ThemeIcon.svelte';
  import { DEFAULT_THEME_ICON_SET, type ThemeIconSet } from '$lib/themeIcons';

  const prop: {
    downloading: boolean;
    progress: number;
    text: string;
    subtext?: string;
    disabled?: boolean;
    iconSet?: ThemeIconSet;
    class?: string;
    onClick?: () => void;
  } = $props();

  let buttonHeight = $state(48);
  let buttonWidth = $state(200);

  const baseDim = $derived(
    Math.min(buttonHeight > 0 ? buttonHeight : 48, buttonWidth > 0 ? buttonWidth : 200)
  );

  // Circle scales with button dimensions: ~70% of base dimension (no artificial upper clamp)
  const circleSize = $derived(Math.max(16, Math.round(baseDim * 0.7)));
  // Icon scales with circle size: ~44% of circle size
  const iconSize = $derived(Math.max(10, Math.round(circleSize * 0.44)));
  // Progress font size scales with circle size
  const percentFontSize = $derived(Math.max(8, Math.round(circleSize * 0.32)));
  // Optical horizontal nudge for the play triangle
  const iconNudge = $derived(Math.max(1, Math.round(circleSize * 0.04)));

  // Responsive font scaling for label and subtext
  const availableTextWidth = $derived(
    Math.max(50, (buttonWidth > 0 ? buttonWidth : 200) - baseDim)
  );
  const textChars = $derived(Math.max(6, (prop.text || 'Launch').length));
  const maxFontFromWidth = $derived((availableTextWidth * 0.85) / textChars);
  const maxFontFromHeight = $derived(baseDim * (prop.subtext ? 0.24 : 0.32));
  const labelFontSize = $derived(
    Math.max(10, Math.round(Math.min(maxFontFromHeight, maxFontFromWidth)))
  );
  const subtextFontSize = $derived(Math.max(8, Math.round(labelFontSize * 0.72)));

  const radius = 16.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = $derived(
    circumference - (Math.max(0, Math.min(100, prop.progress)) / 100) * circumference
  );
</script>

<button
  bind:clientHeight={buttonHeight}
  bind:clientWidth={buttonWidth}
  class="group flex items-center rounded-full bg-primary disabled:bg-primary/70 shadow-lg shadow-primary/25 transition-all not-disabled:hover:shadow-primary/40 not-disabled:hover:brightness-110 not-disabled:active:scale-[0.98] cursor-pointer {prop.class ??
    'h-12 w-fit'}"
  disabled={prop.disabled}
  onclick={prop.onClick}
>
  <div class="relative h-full aspect-square shrink-0 flex items-center justify-center">
    {#if prop.downloading}
      {#if prop.progress === -1}
        <svg
          class="absolute inset-0 h-full w-full animate-spin pointer-events-none"
          viewBox="0 0 48 48"
        >
          <circle class="stroke-black/10" cx="24" cy="24" r={radius} fill="none" stroke-width="3" />
          <circle
            class="stroke-pink-950"
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray={circumference}
            stroke-dashoffset={circumference * 0.7}
          />
        </svg>
      {:else}
        <svg
          class="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
          viewBox="0 0 48 48"
        >
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            stroke-width="3"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.7)"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray={circumference}
            stroke-dashoffset={strokeDashoffset}
            class="transition-[stroke-dashoffset] duration-100"
          />
        </svg>
      {/if}
    {/if}
    <div
      class="aspect-square rounded-full bg-black/30 flex items-center justify-center relative z-10 max-h-[72%] max-w-[72%]"
      style="width: {circleSize}px; height: {circleSize}px;"
    >
      {#if prop.downloading}
        {#if prop.progress === -1}
          <ThemeIcon
            name="ellipsis"
            set={prop.iconSet ?? DEFAULT_THEME_ICON_SET}
            size={iconSize}
            class="text-primary-foreground fill-current animate-pulse max-w-[50%] max-h-[50%]"
          />
        {:else}
          <span
            class="font-bold text-primary-foreground leading-none"
            style="font-size: {percentFontSize}px;"
          >
            {prop.progress.toFixed()}%
          </span>
        {/if}
      {:else}
        <ThemeIcon
          name="launch"
          set={prop.iconSet ?? DEFAULT_THEME_ICON_SET}
          size={iconSize}
          class="text-primary-foreground fill-current max-w-[50%] max-h-[50%]"
          style="margin-left: {iconNudge}px;"
        />
      {/if}
    </div>
  </div>

  <div
    class="text-center flex-1 min-w-0 max-w-full {prop.class ? '' : 'w-48'}"
    style="padding-right: {Math.max(8, Math.round(baseDim * 0.25))}px; padding-left: {Math.max(
      4,
      Math.round(baseDim * 0.08)
    )}px;"
  >
    <p
      class="font-bold text-primary-foreground leading-tight truncate"
      style="font-size: {labelFontSize}px;"
    >
      {prop.text}
    </p>
    {#if prop.subtext}
      <p
        class="text-primary-foreground/70 leading-tight truncate"
        style="font-size: {subtextFontSize}px;"
      >
        {prop.subtext}
      </p>
    {/if}
  </div>
</button>
