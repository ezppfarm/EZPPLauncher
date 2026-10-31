<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { themeClassTokens } from '$lib/themeV2';
  import { Code2, RotateCcw } from '@lucide/svelte';

  let {
    idPrefix,
    value,
    onchange,
  }: {
    idPrefix: string;
    value?: string;
    onchange: (value: string | undefined) => void;
  } = $props();

  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const invalidTokens = $derived(
    typeof value === 'string'
      ? value
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .filter((token) => themeClassTokens(token).length === 0)
      : []
  );

  function setValue(raw: string) {
    onchange(raw.trim() ? raw : undefined);
  }
</script>

{#snippet resetAction()}
  <Button
    variant="ghost"
    size="sm"
    class="h-6 px-1.5 text-[10px] text-muted-foreground"
    disabled={!value}
    onclick={() => onchange(undefined)}
  >
    <RotateCcw class="size-3" />
    Reset
  </Button>
{/snippet}

<ThemeSection
  title="CSS classes"
  icon={Code2}
  open={false}
  actions={resetAction}
  contentClass="space-y-2 pt-2.5"
>
  <div class="space-y-1">
    <Label for={`${idPrefix}-css-classes`} class={label}>Classes</Label>
    <Input
      id={`${idPrefix}-css-classes`}
      class="h-8 border-theme-800 bg-theme-950 font-mono text-xs text-theme-50"
      value={value ?? ''}
      placeholder="glow-card hero-title"
      spellcheck="false"
      autocomplete="off"
      oninput={(event) => setValue(event.currentTarget.value)}
    />
  </div>

  <p class="text-[10px] leading-relaxed text-muted-foreground">
    Separate multiple classes with spaces and style them from the theme's Custom CSS, for example
    <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">.glow-card</code>.
  </p>

  {#if invalidTokens.length > 0}
    <p class="text-[10px] leading-relaxed text-amber-400">
      Ignored: <span class="font-mono">{invalidTokens.join(' ')}</span>. Use letters, numbers,
      dashes and underscores.
    </p>
  {/if}
</ThemeSection>
