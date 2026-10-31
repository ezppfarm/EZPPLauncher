<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import type { ThemeV2ScriptValue } from '$lib/themeV2';
  import { RotateCcw } from '@lucide/svelte';

  let {
    variables,
    defaults,
    onchange,
  }: {
    variables: string[];
    defaults: Record<string, ThemeV2ScriptValue>;
    onchange: (name: string, value: ThemeV2ScriptValue | undefined) => void;
  } = $props();

  const hasDefault = (name: string) => Object.prototype.hasOwnProperty.call(defaults, name);

  const valueLabel = (value: ThemeV2ScriptValue) =>
    typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text';

  const displayValue = (name: string) => {
    if (!hasDefault(name)) return '';
    const value = defaults[name];
    return typeof value === 'string' ? value : String(value);
  };

  const parseValue = (raw: string): ThemeV2ScriptValue | undefined => {
    if (!raw.trim()) return undefined;
    if (raw.trim() === 'true') return true;
    if (raw.trim() === 'false') return false;
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) {
      const number = Number(raw.trim());
      if (Number.isFinite(number)) return number;
    }
    return raw;
  };
</script>

<ThemeSection title="Variables" badge={variables.length} contentClass="space-y-2 pt-2">
  <p class="text-[10px] leading-relaxed text-muted-foreground">
    Starting values for
    <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">{'{name}'}</code>
    placeholders and logic variables. Leave a field empty to start at
    <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">0</code>.
  </p>

  {#if variables.length === 0}
    <p
      class="rounded-md border border-dashed border-theme-800 p-2.5 text-[10px] leading-relaxed text-muted-foreground"
    >
      Add a
      <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">{'{placeholder}'}</code>
      to a text layer or use a variable in a rule to see it here.
    </p>
  {:else}
    <div class="space-y-1.5">
      {#each variables as name (name)}
        <div
          class="flex items-center gap-1.5 rounded-md border border-theme-800 bg-theme-950 px-2 py-1.5"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate font-mono text-[10px] text-theme-100" title={`{${name}}`}>
              {name}
            </div>
            <div class="text-[8px] leading-tight text-muted-foreground">
              {hasDefault(name) ? valueLabel(defaults[name]) : 'no default · starts at 0'}
            </div>
          </div>
          <Input
            class="h-7 w-24 shrink-0 border-theme-800 bg-theme-950 px-2 font-mono text-[10px] text-theme-50"
            value={displayValue(name)}
            placeholder="0"
            spellcheck="false"
            aria-label={`Default value for ${name}`}
            onchange={(event) => onchange(name, parseValue(event.currentTarget.value))}
          />
          <Button
            variant="ghost"
            size="icon"
            class="size-7 shrink-0 text-muted-foreground hover:text-theme-100"
            title={hasDefault(name) ? `Reset ${name} to 0` : `${name} already starts at 0`}
            aria-label={hasDefault(name) ? `Reset ${name} to 0` : `${name} already starts at 0`}
            disabled={!hasDefault(name)}
            onclick={() => onchange(name, undefined)}
          >
            <RotateCcw class="size-3" />
          </Button>
        </div>
      {/each}
    </div>
  {/if}
</ThemeSection>
