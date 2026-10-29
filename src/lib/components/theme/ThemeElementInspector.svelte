<script lang="ts">
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import Slider from '$lib/components/ui/slider/slider.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import type { ThemeFontChoice } from '$lib/themeFonts';
  import type { ThemeV2Element } from '$lib/themeV2';
  import { Image as ImageIcon, RefreshCw, Type } from '@lucide/svelte';

  let {
    element,
    fontOptions,
    onreplace,
  }: {
    element: ThemeV2Element;
    fontOptions: ThemeFontChoice[];
    onreplace: (kind: 'image' | 'video') => void;
  } = $props();

  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
</script>

<div class="space-y-4 p-4">
  <div class="flex items-center gap-2 border-b border-theme-800 pb-3">
    <div class="flex size-8 items-center justify-center rounded-md bg-primary/20 text-primary">
      {#if element.type === 'text'}
        <Type class="size-4" />
      {:else}
        <ImageIcon class="size-4" />
      {/if}
    </div>
    <div class="min-w-0">
      <p class="truncate text-xs font-semibold capitalize text-theme-50">{element.type} layer</p>
      <p class="truncate font-mono text-[10px] text-muted-foreground">{element.id}</p>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <Label for="element-x" class={label}>X</Label>
      <Input id="element-x" class={field} type="number" step="1" bind:value={element.x} />
    </div>
    <div class="space-y-1">
      <Label for="element-y" class={label}>Y</Label>
      <Input id="element-y" class={field} type="number" step="1" bind:value={element.y} />
    </div>
    <div class="space-y-1">
      <Label for="element-width" class={label}>Width</Label>
      <Input
        id="element-width"
        class={field}
        type="number"
        min="24"
        max="1000"
        bind:value={element.width}
      />
    </div>
    <div class="space-y-1">
      <Label for="element-height" class={label}>Height</Label>
      <Input
        id="element-height"
        class={field}
        type="number"
        min="24"
        max="650"
        bind:value={element.height}
      />
    </div>
    <div class="space-y-1">
      <Label for="element-rotation" class={label}>Rotation</Label>
      <Input
        id="element-rotation"
        class={field}
        type="number"
        min="-360"
        max="360"
        bind:value={element.rotation}
      />
    </div>
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <Label class={label}>Opacity</Label>
        <span class="text-[10px] text-muted-foreground"
          >{Math.round((element.opacity ?? 1) * 100)}%</span
        >
      </div>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={element.opacity ?? 1}
        onValueChange={(value) => (element.opacity = value)}
      />
    </div>
  </div>

  {#if element.type === 'text'}
    <div class="space-y-3 border-t border-theme-800 pt-3">
      <div class="space-y-1">
        <Label for="element-text" class={label}>Text</Label>
        <Textarea
          id="element-text"
          class="min-h-20 resize-y border-theme-800 bg-theme-950 text-xs normal-case tracking-normal text-theme-50"
          bind:value={element.text}
        />
      </div>
      <div class="space-y-1">
        <Label for="element-font" class={label}>Font</Label>
        <Select.Root
          type="single"
          value={element.fontFamily ?? 'Sora Variable'}
          onValueChange={(value) => {
            if (value) element.fontFamily = value;
          }}
        >
          <Select.Trigger
            id="element-font"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.fontFamily ?? 'Sora Variable'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            {#each fontOptions as font (font.family)}
              <Select.Item value={font.family} label={`${font.label} · ${font.category}`} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-font-size" class={label}>Size</Label>
          <Input
            id="element-font-size"
            class={field}
            type="number"
            min="6"
            max="240"
            bind:value={element.fontSize}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-font-weight" class={label}>Weight</Label>
          <Select.Root
            type="single"
            value={String(element.fontWeight ?? 400)}
            onValueChange={(value) => {
              if (value) element.fontWeight = Number(value);
            }}
          >
            <Select.Trigger
              id="element-font-weight"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.fontWeight ?? 400}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each [100, 200, 300, 400, 500, 600, 700, 800, 900] as weight (weight)}
                <Select.Item value={String(weight)} label={String(weight)} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-align" class={label}>Align</Label>
          <Select.Root
            type="single"
            value={element.align ?? 'left'}
            onValueChange={(value) => {
              if (value) element.align = value as 'left' | 'center' | 'right';
            }}
          >
            <Select.Trigger
              id="element-align"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.align ?? 'left'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="left" label="Left" />
              <Select.Item value="center" label="Center" />
              <Select.Item value="right" label="Right" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-vertical-align" class={label}>Vertical</Label>
          <Select.Root
            type="single"
            value={element.verticalAlign ?? 'top'}
            onValueChange={(value) => {
              if (value) element.verticalAlign = value as 'top' | 'center' | 'bottom';
            }}
          >
            <Select.Trigger
              id="element-vertical-align"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.verticalAlign ?? 'top'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="top" label="Top" />
              <Select.Item value="center" label="Middle" />
              <Select.Item value="bottom" label="Bottom" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-line-height" class={label}>Line height</Label>
          <Input
            id="element-line-height"
            class={field}
            type="number"
            min="0.7"
            max="3"
            step="0.05"
            bind:value={element.lineHeight}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-letter-spacing" class={label}>Spacing</Label>
          <Input
            id="element-letter-spacing"
            class={field}
            type="number"
            min="-20"
            max="40"
            step="0.5"
            bind:value={element.letterSpacing}
          />
        </div>
      </div>
      <div class="space-y-1">
        <Label for="element-color" class={label}>Color</Label>
        <div class="flex items-center gap-2">
          <Input
            class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
          <Input id="element-color" class="{field} flex-1 font-mono" bind:value={element.color} />
        </div>
      </div>
    </div>
  {:else if element.type === 'image' || element.type === 'video'}
    <div class="space-y-3 border-t border-theme-800 pt-3">
      <div class="rounded-md border border-theme-800 bg-black/20 p-2">
        <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Asset</p>
        <p class="mt-1 truncate font-mono text-[10px] text-theme-100">{element.src}</p>
      </div>
      <Button
        variant="secondary"
        class="h-8 w-full gap-2 text-xs"
        onclick={() => onreplace(element.type as 'image' | 'video')}
      >
        <RefreshCw class="size-3.5" />
        Replace {element.type}
      </Button>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-fit" class={label}>Fit</Label>
          <Select.Root
            type="single"
            value={element.fit ?? 'cover'}
            onValueChange={(value) => {
              if (value) element.fit = value as 'cover' | 'contain';
            }}
          >
            <Select.Trigger
              id="element-fit"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.fit ?? 'cover'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="cover" label="Cover" />
              <Select.Item value="contain" label="Contain" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-radius" class={label}>Radius</Label>
          <Input
            id="element-radius"
            class={field}
            type="number"
            min="0"
            max="999"
            bind:value={element.radius}
          />
        </div>
      </div>
      {#if element.type === 'video'}
        <div class="flex items-start gap-2 rounded-md border border-theme-800 bg-black/20 p-2">
          <Checkbox
            id="element-muted"
            class="mt-0.5"
            checked={element.muted !== false}
            onCheckedChange={(checked) => {
              element.muted = checked === true;
            }}
          />
          <div class="space-y-0.5">
            <Label for="element-muted" class="text-[10px] font-normal text-theme-100">
              Mute video
            </Label>
            <p class="text-[10px] leading-relaxed text-muted-foreground">
              Unmuted videos may wait for a click before they start, because of autoplay policies.
            </p>
          </div>
        </div>
        <p class="text-[10px] leading-relaxed text-muted-foreground">
          Videos autoplay and loop. WebM keeps theme packages small; MP4 also works.
        </p>
      {/if}
    </div>
  {:else}
    <div class="space-y-3 border-t border-theme-800 pt-3">
      <div class="space-y-1">
        <Label for="element-shape" class={label}>Shape</Label>
        <Select.Root
          type="single"
          value={element.shape}
          onValueChange={(value) => {
            if (value) element.shape = value as 'rectangle' | 'ellipse' | 'line';
          }}
        >
          <Select.Trigger
            id="element-shape"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.shape}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="rectangle" label="Rectangle" />
            <Select.Item value="ellipse" label="Ellipse" />
            <Select.Item value="line" label="Line" />
          </Select.Content>
        </Select.Root>
      </div>
      <div class="space-y-1">
        <Label for="element-fill" class={label}>Fill</Label>
        <div class="flex items-center gap-2">
          <Input
            class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.fill}
          />
          <Input id="element-fill" class="{field} flex-1 font-mono" bind:value={element.fill} />
        </div>
      </div>
      {#if element.shape !== 'ellipse'}
        <div class="space-y-1">
          <Label for="element-shape-radius" class={label}>Corner radius</Label>
          <Input
            id="element-shape-radius"
            class={field}
            type="number"
            min="0"
            max="999"
            bind:value={element.radius}
          />
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-border-width" class={label}>Border</Label>
          <Input
            id="element-border-width"
            class={field}
            type="number"
            min="0"
            max="40"
            bind:value={element.borderWidth}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-border-color" class={label}>Border color</Label>
          <Input
            id="element-border-color"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.borderColor}
          />
        </div>
      </div>
    </div>
  {/if}
</div>
