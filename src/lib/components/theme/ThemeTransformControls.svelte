<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import type { ThemeV2Transform } from '$lib/themeV2';
  import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from '@lucide/svelte';

  type TransformTarget = ThemeV2Transform & { offsetX?: number; offsetY?: number };
  type TransformPatch = Partial<TransformTarget>;

  let {
    transform,
    idPrefix,
    includeTranslate = false,
    onchange,
  }: {
    transform: TransformTarget;
    idPrefix: string;
    includeTranslate?: boolean;
    onchange: (patch: TransformPatch) => void;
  } = $props();

  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';

  const scaleX = $derived(transform.scaleX ?? transform.scale ?? 1);
  const scaleY = $derived(transform.scaleY ?? transform.scale ?? 1);
  const isDefault = $derived(
    (transform.rotation ?? 0) === 0 &&
      scaleX === 1 &&
      scaleY === 1 &&
      (transform.skewX ?? 0) === 0 &&
      (transform.skewY ?? 0) === 0 &&
      !transform.flipX &&
      !transform.flipY &&
      (!includeTranslate || ((transform.offsetX ?? 0) === 0 && (transform.offsetY ?? 0) === 0))
  );

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  function numberValue(value: string): number | undefined {
    if (value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function setScale(axis: 'scaleX' | 'scaleY', value: string) {
    const parsed = numberValue(value);
    if (parsed === undefined) return;
    const scale = clamp(parsed / 100, 0.05, 10);
    onchange(axis === 'scaleX' ? { scaleX: scale } : { scaleY: scale });
  }

  function setSkew(axis: 'skewX' | 'skewY', value: string) {
    const parsed = numberValue(value);
    if (parsed === undefined) return;
    const skew = clamp(parsed, -89, 89);
    onchange(axis === 'skewX' ? { skewX: skew } : { skewY: skew });
  }

  function setRotation(value: string) {
    const parsed = numberValue(value);
    if (parsed === undefined) return;
    onchange({ rotation: clamp(parsed, -360, 360) });
  }

  function rotateBy(delta: number) {
    const next = (transform.rotation ?? 0) + delta;
    onchange({ rotation: ((((next + 180) % 360) + 360) % 360) - 180 });
  }

  function setOffset(axis: 'offsetX' | 'offsetY', value: string) {
    const parsed = numberValue(value);
    if (parsed === undefined) return;
    const offset = clamp(parsed, -2000, 2000);
    onchange(axis === 'offsetX' ? { offsetX: offset } : { offsetY: offset });
  }

  function resetTransform() {
    onchange({
      rotation: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      flipX: false,
      flipY: false,
      ...(includeTranslate ? { offsetX: 0, offsetY: 0 } : {}),
    });
  }
</script>

{#snippet transformActions()}
  <Button
    variant="ghost"
    size="sm"
    class="h-6 gap-1 px-1.5 text-[9px] text-muted-foreground"
    title={includeTranslate
      ? 'Reset translation, rotation, scale, skew and flips'
      : 'Reset rotation, scale, skew and flips'}
    disabled={isDefault}
    onclick={resetTransform}
  >
    <RotateCcw class="size-3" />
    Reset
  </Button>
{/snippet}

<ThemeSection
  title="Transform"
  open={false}
  actions={transformActions}
  contentClass="space-y-2 pt-2.5"
>
  {#if includeTranslate}
    <div class="grid grid-cols-2 gap-2">
      <div class="space-y-1">
        <Label for="{idPrefix}-translate-x" class={label}>Translate X</Label>
        <Input
          id="{idPrefix}-translate-x"
          class={field}
          type="number"
          min="-2000"
          max="2000"
          value={transform.offsetX ?? 0}
          onchange={(event) => setOffset('offsetX', event.currentTarget.value)}
        />
      </div>
      <div class="space-y-1">
        <Label for="{idPrefix}-translate-y" class={label}>Translate Y</Label>
        <Input
          id="{idPrefix}-translate-y"
          class={field}
          type="number"
          min="-2000"
          max="2000"
          value={transform.offsetY ?? 0}
          onchange={(event) => setOffset('offsetY', event.currentTarget.value)}
        />
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <Label for="{idPrefix}-scale-x" class={label}>Scale X %</Label>
      <Input
        id="{idPrefix}-scale-x"
        class={field}
        type="number"
        min="5"
        max="1000"
        step="5"
        value={Math.round(scaleX * 100)}
        onchange={(event) => setScale('scaleX', event.currentTarget.value)}
      />
    </div>
    <div class="space-y-1">
      <Label for="{idPrefix}-scale-y" class={label}>Scale Y %</Label>
      <Input
        id="{idPrefix}-scale-y"
        class={field}
        type="number"
        min="5"
        max="1000"
        step="5"
        value={Math.round(scaleY * 100)}
        onchange={(event) => setScale('scaleY', event.currentTarget.value)}
      />
    </div>
    <div class="space-y-1">
      <Label for="{idPrefix}-skew-x" class={label}>Skew X °</Label>
      <Input
        id="{idPrefix}-skew-x"
        class={field}
        type="number"
        min="-89"
        max="89"
        step="1"
        value={transform.skewX ?? 0}
        onchange={(event) => setSkew('skewX', event.currentTarget.value)}
      />
    </div>
    <div class="space-y-1">
      <Label for="{idPrefix}-skew-y" class={label}>Skew Y °</Label>
      <Input
        id="{idPrefix}-skew-y"
        class={field}
        type="number"
        min="-89"
        max="89"
        step="1"
        value={transform.skewY ?? 0}
        onchange={(event) => setSkew('skewY', event.currentTarget.value)}
      />
    </div>
  </div>

  <div class="flex items-end gap-2">
    <div class="min-w-0 flex-1 space-y-1">
      <Label for="{idPrefix}-rotation" class={label}>Rotation °</Label>
      <Input
        id="{idPrefix}-rotation"
        class={field}
        type="number"
        min="-360"
        max="360"
        step="1"
        value={transform.rotation ?? 0}
        onchange={(event) => setRotation(event.currentTarget.value)}
      />
    </div>
    <div class="flex shrink-0 items-center gap-0.5">
      <Button
        variant={transform.flipX ? 'default' : 'secondary'}
        size="icon"
        class="size-7"
        title="Flip horizontally"
        aria-label="Flip horizontally"
        aria-pressed={transform.flipX === true}
        onclick={() => onchange({ flipX: !transform.flipX })}
      >
        <FlipHorizontal2 class="size-3.5" />
      </Button>
      <Button
        variant={transform.flipY ? 'default' : 'secondary'}
        size="icon"
        class="size-7"
        title="Flip vertically"
        aria-label="Flip vertically"
        aria-pressed={transform.flipY === true}
        onclick={() => onchange({ flipY: !transform.flipY })}
      >
        <FlipVertical2 class="size-3.5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        class="size-7"
        title="Rotate left 90°"
        aria-label="Rotate left 90 degrees"
        onclick={() => rotateBy(-90)}
      >
        <RotateCcw class="size-3.5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        class="size-7"
        title="Rotate right 90°"
        aria-label="Rotate right 90 degrees"
        onclick={() => rotateBy(90)}
      >
        <RotateCw class="size-3.5" />
      </Button>
    </div>
  </div>
</ThemeSection>
