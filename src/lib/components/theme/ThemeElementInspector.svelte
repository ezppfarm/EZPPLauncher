<script lang="ts">
  import ThemeComponentEditor from '$lib/components/theme/ThemeComponentEditor.svelte';
  import ThemeCssClasses from '$lib/components/theme/ThemeCssClasses.svelte';
  import ThemeFilterControls from '$lib/components/theme/ThemeFilterControls.svelte';
  import ThemeLinkedLogic from '$lib/components/theme/ThemeLinkedLogic.svelte';
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import ThemeTextStyleControls from '$lib/components/theme/ThemeTextStyleControls.svelte';
  import ThemeTransformControls from '$lib/components/theme/ThemeTransformControls.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import DatePicker from '$lib/components/ui/date-picker/date-picker.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Select from '$lib/components/ui/select';
  import Slider from '$lib/components/ui/slider/slider.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import type { ThemeFontChoice } from '$lib/themeFonts';
  import { THEME_ICON_NAMES } from '$lib/themeIcons';
  import {
    THEME_DATA_FIELDS,
    THEME_PARTICLE_PRESETS,
    type ThemeV2Behavior,
    type ThemeV2BehaviorTarget,
    type ThemeV2Element,
    type ThemeV2Group,
    type ThemeV2MaskShape,
  } from '$lib/themeV2';
  import {
    Clock,
    Component,
    Film,
    Gauge,
    Image as ImageIcon,
    Megaphone,
    MousePointerClick,
    RefreshCw,
    Repeat,
    Shapes,
    Sparkles,
    Spline,
    Timer,
    Type,
  } from '@lucide/svelte';

  let {
    element,
    fontOptions,
    elements,
    behaviors,
    groups,
    variables = [],
    focusToken = 0,
    onreplace,
    onpickmask,
    onpickrepeater,
    onaddbehavior,
    ondeleterule,
  }: {
    element: ThemeV2Element;
    fontOptions: ThemeFontChoice[];
    elements: ThemeV2Element[];
    behaviors: ThemeV2Behavior[];
    groups: ThemeV2Group[];
    variables?: string[];
    focusToken?: number;
    onreplace: (kind: 'image' | 'video' | 'lottie') => void;
    onpickmask: () => void;
    onpickrepeater: () => void;
    onaddbehavior: (target: ThemeV2BehaviorTarget) => ThemeV2Behavior | undefined;
    ondeleterule: (id: string) => void;
  } = $props();

  const field = 'h-8 border-theme-800 bg-theme-950 text-xs text-theme-50';
  const label = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  let textArea = $state<HTMLElement | null>(null);

  function insertTextVariable(name: string) {
    if (element.type !== 'text') return;
    const token = `{${name}}`;
    const node = textArea as HTMLTextAreaElement | null;
    if (!node) {
      element.text = `${element.text}${token}`;
      return;
    }

    const start = node.selectionStart ?? element.text.length;
    const end = node.selectionEnd ?? start;
    element.text = `${element.text.slice(0, start)}${token}${element.text.slice(end)}`;
    requestAnimationFrame(() => {
      node.focus();
      const caret = start + token.length;
      node.setSelectionRange(caret, caret);
    });
  }
</script>

<div class="space-y-3 p-3">
  <div class="flex items-center gap-2 border-b border-theme-800 pb-2.5">
    <div class="flex size-8 items-center justify-center rounded-md bg-primary/20 text-primary">
      {#if element.type === 'text' || element.type === 'data'}
        <Type class="size-4" />
      {:else if element.type === 'svelte'}
        <Component class="size-4" />
      {:else if element.type === 'shape'}
        <Shapes class="size-4" />
      {:else if element.type === 'icon'}
        <Sparkles class="size-4" />
      {:else if element.type === 'repeater'}
        <Repeat class="size-4" />
      {:else if element.type === 'gauge'}
        <Gauge class="size-4" />
      {:else if element.type === 'ticker'}
        <Megaphone class="size-4" />
      {:else if element.type === 'lottie'}
        <Film class="size-4" />
      {:else if element.type === 'button'}
        <MousePointerClick class="size-4" />
      {:else if element.type === 'path'}
        <Spline class="size-4" />
      {:else if element.type === 'particles'}
        <Sparkles class="size-4" />
      {:else if element.type === 'clock'}
        <Clock class="size-4" />
      {:else if element.type === 'countdown'}
        <Timer class="size-4" />
      {:else}
        <ImageIcon class="size-4" />
      {/if}
    </div>
    <div class="min-w-0">
      <p class="truncate text-xs font-semibold capitalize text-theme-50">{element.type} layer</p>
      <p class="truncate font-mono text-[10px] text-muted-foreground">{element.id}</p>
    </div>
  </div>

  <ThemeSection title="Position & size" bordered={false} contentClass="space-y-3 pt-2">
    <div class="space-y-1">
      <Label for="element-name" class={label}>Layer name</Label>
      <Input
        id="element-name"
        class={field}
        value={element.name ?? ''}
        placeholder="Optional label, for example Logo"
        oninput={(event) => (element.name = (event.currentTarget as HTMLInputElement).value)}
      />
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
      <div class="col-span-2 space-y-1">
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
  </ThemeSection>

  <ThemeTransformControls
    transform={element}
    idPrefix="element"
    onchange={(patch) => Object.assign(element, patch)}
  />

  <ThemeSection
    title="Layer state"
    contentClass="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5"
  >
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="element-hidden"
        checked={element.hidden === true}
        onCheckedChange={(checked) => (element.hidden = checked === true)}
      />
      <Label for="element-hidden" class="text-[10px] font-normal text-muted-foreground">
        Hidden
      </Label>
    </div>
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="element-locked"
        checked={element.locked === true}
        onCheckedChange={(checked) => (element.locked = checked === true)}
      />
      <Label for="element-locked" class="text-[10px] font-normal text-muted-foreground">
        Locked
      </Label>
    </div>
    <div
      class="flex items-center gap-1.5"
      title="Receive clicks and hovers from linked Logic rules. Interactive layers block controls underneath them."
    >
      <Checkbox
        id="element-interactive"
        checked={element.interactive === true}
        onCheckedChange={(checked) => (element.interactive = checked === true)}
      />
      <Label for="element-interactive" class="text-[10px] font-normal text-muted-foreground">
        Interactive
      </Label>
    </div>
  </ThemeSection>

  <ThemeCssClasses
    idPrefix="element"
    value={element.cssClasses}
    onchange={(value) => (element.cssClasses = value)}
  />

  <ThemeLinkedLogic
    target={{ type: 'element', id: element.id }}
    {behaviors}
    {elements}
    {groups}
    {variables}
    {focusToken}
    onadd={onaddbehavior}
    ondelete={ondeleterule}
  />

  {#if element.type === 'text' || element.type === 'data'}
    <ThemeSection title={element.type === 'data' ? 'Data' : 'Text'} contentClass="space-y-3 pt-2.5">
      {#if element.type === 'data'}
        <div class="space-y-1">
          <Label for="element-data-field" class={label}>Value</Label>
          <Select.Root
            type="single"
            value={element.field}
            onValueChange={(value) => {
              if (value) element.field = value as typeof element.field;
            }}
          >
            <Select.Trigger
              id="element-data-field"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {THEME_DATA_FIELDS.find((field) => field.value === element.field)?.label ??
                element.field}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each THEME_DATA_FIELDS as field (field.value)}
                <Select.Item value={field.value} label={`${field.label} · ${field.group}`} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        {#if element.field.startsWith('user.') && element.field !== 'user.name' && element.field !== 'user.country'}
          <div class="space-y-1">
            <Label for="element-data-mode" class={label}>Gamemode</Label>
            <Select.Root
              type="single"
              value={element.mode ?? 'osu'}
              onValueChange={(value) => {
                if (value) element.mode = value as typeof element.mode;
              }}
            >
              <Select.Trigger
                id="element-data-mode"
                class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
              >
                {element.mode ?? 'osu'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                <Select.Item value="osu" label="osu!standard" />
                <Select.Item value="taiko" label="osu!taiko" />
                <Select.Item value="catch" label="osu!catch" />
                <Select.Item value="mania" label="osu!mania" />
              </Select.Content>
            </Select.Root>
          </div>
        {/if}
        <div class="space-y-1">
          <Label for="element-data-template" class={label}>Template</Label>
          <Input
            id="element-data-template"
            class={field}
            bind:value={element.text}
            placeholder={'Welcome, {value}!'}
          />
          <p class="text-[9px] leading-relaxed text-muted-foreground">
            <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">&#123;value&#125;</code>
            is replaced with the live value. Rule variables such as
            <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">&#123;score&#125;</code>
            still work too.
          </p>
        </div>
      {:else}
        <div class="space-y-1">
          <Label for="element-text" class={label}>Text</Label>
          <Textarea
            id="element-text"
            bind:ref={textArea}
            class="min-h-20 resize-y border-theme-800 bg-theme-950 text-xs normal-case tracking-normal text-theme-50"
            bind:value={element.text}
          />
          <p class="text-[9px] leading-relaxed text-muted-foreground">
            Use <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100"
              >&#123;score&#125;</code
            >
            for a rule variable, or live clock values such as
            <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">&#123;time&#125;</code>,
            <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">&#123;time12&#125;</code>
            and
            <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">&#123;hour&#125;</code>.
            Clock values refresh every second; other variables update when a script changes them.
          </p>
          {#if variables.length > 0}
            <div class="flex flex-wrap items-center gap-1">
              <span class="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                Insert
              </span>
              {#each variables as variable (variable)}
                <button
                  type="button"
                  class="rounded bg-theme-900 px-1.5 py-0.5 font-mono text-[9px] text-theme-100 transition-colors hover:bg-theme-800"
                  title={`Insert {${variable}}`}
                  onclick={() => insertTextVariable(variable)}
                >
                  &#123;{variable}&#125;
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
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
      <ThemeTextStyleControls {element} onchange={(patch) => Object.assign(element, patch)} />
    </ThemeSection>
  {:else if element.type === 'svelte'}
    <ThemeSection title="Svelte component" contentClass="space-y-3 pt-2.5">
      <div
        class="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-[9px] leading-relaxed text-amber-100"
      >
        Custom layers run theme JavaScript. Only preview code you trust, and keep it plain
        JavaScript: the layer compiler has no TypeScript pass.
      </div>
      <ThemeComponentEditor
        value={element.source}
        {variables}
        height={330}
        onchange={(source) => (element.source = source)}
      />
      <div class="space-y-1 rounded-md border border-theme-800 bg-black/20 p-2">
        <p class="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Props</p>
        <p class="font-mono text-[9px] leading-relaxed text-theme-100">
          variables · screen · layer · theme · asset(path)
        </p>
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          `variables` is live, so Logic rules update your component without a recompile. Use
          <code class="rounded bg-theme-900 px-1 py-0.5 text-theme-100">asset("image.png")</code> for
          files in the theme's assets folder.
        </p>
      </div>
    </ThemeSection>
  {:else if element.type === 'image' || element.type === 'video'}
    <ThemeSection title="Media" contentClass="space-y-3 pt-2.5">
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
      {#if element.type === 'image'}
        <div class="space-y-1.5 rounded-md border border-theme-800 bg-black/20 p-2">
          <div class="flex items-center justify-between">
            <Label for="element-tint" class="text-[10px] font-normal text-theme-100">
              Tint silhouette
            </Label>
            {#if element.tint}
              <button
                type="button"
                class="text-[9px] text-muted-foreground transition-colors hover:text-theme-100"
                onclick={() => (element.tint = '')}
              >
                Clear
              </button>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            <Input
              id="element-tint"
              class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              value={element.tint || '#ffffff'}
              oninput={(event) => (element.tint = (event.currentTarget as HTMLInputElement).value)}
            />
            <Input
              class="{field} flex-1 font-mono"
              value={element.tint ?? ''}
              placeholder="Leave empty to keep colors"
              oninput={(event) => (element.tint = (event.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <p class="text-[9px] leading-relaxed text-muted-foreground">
            Repaints the image's alpha silhouette, so monochrome SVG logos match the theme accent.
          </p>
        </div>
      {/if}
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
    </ThemeSection>
  {:else if element.type === 'lottie'}
    <ThemeSection title="Lottie animation" contentClass="space-y-3 pt-2.5">
      <div class="rounded-md border border-theme-800 bg-black/20 p-2">
        <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Animation</p>
        <p class="mt-1 truncate font-mono text-[10px] text-theme-100">{element.src}</p>
      </div>
      <Button
        variant="secondary"
        class="h-8 w-full gap-2 text-xs"
        onclick={() => onreplace('lottie')}
      >
        <RefreshCw class="size-3.5" />
        Replace animation
      </Button>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center gap-1.5">
          <Checkbox
            id="element-lottie-loop"
            checked={element.loop !== false}
            onCheckedChange={(checked) => (element.loop = checked === true)}
          />
          <Label for="element-lottie-loop" class="text-[10px] font-normal text-muted-foreground">
            Loop
          </Label>
        </div>
        <div class="flex items-center gap-1.5">
          <Checkbox
            id="element-lottie-autoplay"
            checked={element.autoplay !== false}
            onCheckedChange={(checked) => (element.autoplay = checked === true)}
          />
          <Label
            for="element-lottie-autoplay"
            class="text-[10px] font-normal text-muted-foreground"
          >
            Autoplay
          </Label>
        </div>
      </div>
      <div class="space-y-1">
        <Label for="element-lottie-speed" class={label}>Speed</Label>
        <Input
          id="element-lottie-speed"
          class={field}
          type="number"
          min="0.1"
          max="4"
          step="0.1"
          bind:value={element.speed}
        />
      </div>
      <p class="text-[10px] leading-relaxed text-muted-foreground">
        Lottie JSON scales to any size and is usually far smaller than a WebM. Animations pause when
        the system asks for reduced motion.
      </p>
    </ThemeSection>
  {:else if element.type === 'shape'}
    <ThemeSection title="Shape" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-shape" class={label}>Shape</Label>
        <Select.Root
          type="single"
          value={element.shape}
          onValueChange={(value) => {
            if (value) element.shape = value as typeof element.shape;
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
            <Select.Item value="polygon" label="Polygon" />
            <Select.Item value="star" label="Star" />
            <Select.Item value="arc" label="Arc / ring" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if element.shape === 'arc'}
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="element-arc-start" class={label}>Start angle</Label>
            <Input
              id="element-arc-start"
              class={field}
              type="number"
              min="-360"
              max="360"
              step="15"
              bind:value={element.startAngle}
            />
          </div>
          <div class="space-y-1">
            <Label for="element-arc-end" class={label}>End angle</Label>
            <Input
              id="element-arc-end"
              class={field}
              type="number"
              min="-360"
              max="720"
              step="15"
              bind:value={element.endAngle}
            />
          </div>
          <div class="space-y-1">
            <Label for="element-arc-thickness" class={label}>Thickness</Label>
            <Input
              id="element-arc-thickness"
              class={field}
              type="number"
              min="1"
              max="120"
              bind:value={element.thickness}
            />
          </div>
          <div class="flex items-center gap-1.5 self-end pb-1.5">
            <Checkbox
              id="element-arc-rounded"
              checked={element.rounded !== false}
              onCheckedChange={(checked) => (element.rounded = checked === true)}
            />
            <Label for="element-arc-rounded" class="text-[10px] font-normal text-muted-foreground">
              Rounded caps
            </Label>
          </div>
        </div>
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          0° points up and angles run clockwise. A full 360° arc becomes a ring.
        </p>
      {/if}
      {#if element.shape === 'polygon' || element.shape === 'star'}
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="element-shape-points" class={label}>Points</Label>
            <Input
              id="element-shape-points"
              class={field}
              type="number"
              min="3"
              max="24"
              bind:value={element.points}
            />
          </div>
          {#if element.shape === 'star'}
            <div class="space-y-1">
              <Label for="element-shape-inner" class={label}>Inner radius</Label>
              <Input
                id="element-shape-inner"
                class={field}
                type="number"
                min="0.1"
                max="0.95"
                step="0.05"
                bind:value={element.innerRadius}
              />
            </div>
          {/if}
        </div>
      {/if}
      <div class="space-y-1">
        <Label for="element-fill" class={label}>Fill</Label>
        <Select.Root
          type="single"
          value={element.fillMode ?? 'solid'}
          onValueChange={(value) => {
            if (value) element.fillMode = value as 'solid' | 'gradient';
          }}
        >
          <Select.Trigger
            id="element-fill"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.fillMode ?? 'solid'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="solid" label="Solid" />
            <Select.Item value="gradient" label="Gradient" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if element.fillMode === 'gradient'}
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="element-gradient-from" class={label}>From</Label>
            <Input
              id="element-gradient-from"
              class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              bind:value={element.gradientFrom}
            />
          </div>
          <div class="space-y-1">
            <Label for="element-gradient-to" class={label}>To</Label>
            <Input
              id="element-gradient-to"
              class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              bind:value={element.gradientTo}
            />
          </div>
        </div>
        <div class="space-y-1">
          <Label for="element-gradient-angle" class={label}>Angle</Label>
          <Input
            id="element-gradient-angle"
            class={field}
            type="number"
            min="0"
            max="360"
            bind:value={element.gradientAngle}
          />
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <Input
            class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.fill}
          />
          <Input class="{field} flex-1 font-mono" bind:value={element.fill} />
        </div>
      {/if}
      {#if element.shape === 'rectangle' || element.shape === 'line'}
        <div class="space-y-1">
          <Label for="element-shape-radius" class={label}>Corner radius</Label>
          <Input
            id="element-shape-radius"
            class={field}
            type="number"
            min="0"
            max="999"
            value={element.radius ?? 16}
            oninput={(event) => {
              element.radius = Number((event.currentTarget as HTMLInputElement).value) || 0;
              element.cornerRadii = undefined;
            }}
          />
        </div>
        <div class="space-y-1">
          <Label class={label}>Per-corner radii</Label>
          <div class="grid grid-cols-4 gap-1.5">
            {#each ['TL', 'TR', 'BR', 'BL'] as corner, index (corner)}
              <Input
                class="h-8 px-1.5 text-center text-xs"
                type="number"
                min="0"
                max="999"
                value={element.cornerRadii?.[index] ?? element.radius ?? 16}
                oninput={(event) => {
                  const radii = element.cornerRadii ?? [
                    element.radius ?? 16,
                    element.radius ?? 16,
                    element.radius ?? 16,
                    element.radius ?? 16,
                  ];
                  radii[index] = Number((event.currentTarget as HTMLInputElement).value) || 0;
                  element.cornerRadii = [...radii] as [number, number, number, number];
                }}
              />
            {/each}
          </div>
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
          <Label for="element-border-style" class={label}>Border style</Label>
          <Select.Root
            type="single"
            value={element.borderStyle ?? 'solid'}
            onValueChange={(value) => {
              if (value) element.borderStyle = value as 'solid' | 'dashed' | 'dotted';
            }}
          >
            <Select.Trigger
              id="element-border-style"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.borderStyle ?? 'solid'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="solid" label="Solid" />
              <Select.Item value="dashed" label="Dashed" />
              <Select.Item value="dotted" label="Dotted" />
            </Select.Content>
          </Select.Root>
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
        <div class="space-y-1">
          <Label for="element-backdrop" class={label}>Backdrop blur</Label>
          <Input
            id="element-backdrop"
            class={field}
            type="number"
            min="0"
            max="60"
            bind:value={element.backdropBlur}
          />
        </div>
      </div>
    </ThemeSection>
  {:else if element.type === 'icon'}
    <ThemeSection title="Icon" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-icon" class={label}>Icon</Label>
        <Select.Root
          type="single"
          value={element.icon}
          onValueChange={(value) => {
            if (value) element.icon = value as typeof element.icon;
          }}
        >
          <Select.Trigger
            id="element-icon"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.icon}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            {#each THEME_ICON_NAMES as name (name)}
              <Select.Item value={name} label={name} />
            {/each}
          </Select.Content>
        </Select.Root>
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          Icons follow the theme's icon set, so the same layer switches families with the theme.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-icon-color" class={label}>Color</Label>
          <Input
            id="element-icon-color"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-icon-scale" class={label}>Size %</Label>
          <Input
            id="element-icon-scale"
            class={field}
            type="number"
            min="10"
            max="100"
            bind:value={element.scale}
          />
        </div>
      </div>
    </ThemeSection>
  {:else if element.type === 'repeater'}
    <ThemeSection title="Repeater" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-repeater-source" class={label}>Tile</Label>
        <Select.Root
          type="single"
          value={element.source}
          onValueChange={(value) => {
            if (value) element.source = value as 'image' | 'icon';
          }}
        >
          <Select.Trigger
            id="element-repeater-source"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.source === 'image' ? 'Image' : 'Icon'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="image" label="Image" />
            <Select.Item value="icon" label="Icon" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if element.source === 'image'}
        <div class="space-y-2 rounded-md border border-theme-800 bg-black/20 p-2">
          <p class="truncate font-mono text-[10px] text-theme-100">
            {element.src ?? 'No image yet'}
          </p>
          <Button variant="secondary" class="h-8 w-full gap-2 text-xs" onclick={onpickrepeater}>
            <RefreshCw class="size-3.5" />
            Choose image
          </Button>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="element-repeater-icon" class={label}>Icon</Label>
            <Select.Root
              type="single"
              value={element.icon ?? 'music'}
              onValueChange={(value) => {
                if (value) element.icon = value as typeof element.icon;
              }}
            >
              <Select.Trigger
                id="element-repeater-icon"
                class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
              >
                {element.icon ?? 'music'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                {#each THEME_ICON_NAMES as name (name)}
                  <Select.Item value={name} label={name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <Label for="element-repeater-color" class={label}>Color</Label>
            <Input
              id="element-repeater-color"
              class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              bind:value={element.color}
            />
          </div>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-tile-width" class={label}>Tile width</Label>
          <Input
            id="element-tile-width"
            class={field}
            type="number"
            min="4"
            max="400"
            bind:value={element.tileWidth}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-tile-height" class={label}>Tile height</Label>
          <Input
            id="element-tile-height"
            class={field}
            type="number"
            min="4"
            max="400"
            bind:value={element.tileHeight}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-gap-x" class={label}>Gap X</Label>
          <Input
            id="element-gap-x"
            class={field}
            type="number"
            min="0"
            max="200"
            bind:value={element.gapX}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-gap-y" class={label}>Gap Y</Label>
          <Input
            id="element-gap-y"
            class={field}
            type="number"
            min="0"
            max="200"
            bind:value={element.gapY}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-columns" class={label}>Columns</Label>
          <Input
            id="element-columns"
            class={field}
            type="number"
            min="0"
            max="60"
            bind:value={element.columns}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-rows" class={label}>Rows</Label>
          <Input
            id="element-rows"
            class={field}
            type="number"
            min="0"
            max="60"
            bind:value={element.rows}
          />
        </div>
      </div>
      <p class="text-[9px] leading-relaxed text-muted-foreground">
        Columns and rows of 0 fill the layer bounds automatically. Up to 240 tiles are drawn.
      </p>
    </ThemeSection>
  {:else if element.type === 'gauge'}
    <ThemeSection title="Gauge" contentClass="space-y-3 pt-2.5">
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-gauge-mode" class={label}>Style</Label>
          <Select.Root
            type="single"
            value={element.mode ?? 'bar'}
            onValueChange={(value) => {
              if (value) element.mode = value as 'bar' | 'ring';
            }}
          >
            <Select.Trigger
              id="element-gauge-mode"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.mode ?? 'bar'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="bar" label="Bar" />
              <Select.Item value="ring" label="Ring" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-gauge-thickness" class={label}>Thickness</Label>
          <Input
            id="element-gauge-thickness"
            class={field}
            type="number"
            min="2"
            max="80"
            bind:value={element.thickness}
          />
        </div>
      </div>
      <div class="space-y-1">
        <Label for="element-gauge-variable" class={label}>Bound variable</Label>
        <Select.Root
          type="single"
          value={element.variable ?? 'none'}
          onValueChange={(value) => {
            element.variable = value && value !== 'none' ? value : undefined;
          }}
        >
          <Select.Trigger
            id="element-gauge-variable"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.variable ?? 'None (use the value below)'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="none" label="None (use the value below)" />
            {#each variables as variable (variable)}
              <Select.Item value={variable} label={variable} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      {#if !element.variable}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class={label}>Value</Label>
            <span class="text-[10px] text-muted-foreground"
              >{Math.round((element.value ?? 0.5) * 100)}%</span
            >
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={element.value ?? 0.5}
            onValueChange={(value) => (element.value = value)}
          />
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-gauge-track" class={label}>Track</Label>
          <Input
            id="element-gauge-track"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.trackColor}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-gauge-fill" class={label}>Fill</Label>
          <Input
            id="element-gauge-fill"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.fillColor}
          />
        </div>
      </div>
      <div class="space-y-1">
        <Label for="element-gauge-label" class={label}>Label</Label>
        <Input
          id="element-gauge-label"
          class={field}
          bind:value={element.label}
          placeholder={'e.g. {percent}%'}
        />
      </div>
      <div class="flex items-center gap-1.5">
        <Checkbox
          id="element-gauge-rounded"
          checked={element.rounded !== false}
          onCheckedChange={(checked) => (element.rounded = checked === true)}
        />
        <Label for="element-gauge-rounded" class="text-[10px] font-normal text-muted-foreground">
          Rounded caps
        </Label>
      </div>
    </ThemeSection>
  {:else if element.type === 'ticker'}
    <ThemeSection title="Ticker" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-ticker-text" class={label}>Text</Label>
        <Textarea
          id="element-ticker-text"
          class="min-h-16 resize-y border-theme-800 bg-theme-950 text-xs normal-case tracking-normal text-theme-50"
          bind:value={element.text}
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-ticker-font" class={label}>Font</Label>
          <Select.Root
            type="single"
            value={element.fontFamily ?? 'Sora Variable'}
            onValueChange={(value) => {
              if (value) element.fontFamily = value;
            }}
          >
            <Select.Trigger
              id="element-ticker-font"
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
        <div class="space-y-1">
          <Label for="element-ticker-size" class={label}>Size</Label>
          <Input
            id="element-ticker-size"
            class={field}
            type="number"
            min="6"
            max="200"
            bind:value={element.fontSize}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-ticker-speed" class={label}>Loop seconds</Label>
          <Input
            id="element-ticker-speed"
            class={field}
            type="number"
            min="2"
            max="240"
            bind:value={element.speed}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-ticker-gap" class={label}>Gap</Label>
          <Input
            id="element-ticker-gap"
            class={field}
            type="number"
            min="0"
            max="400"
            bind:value={element.gap}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-ticker-color" class={label}>Text color</Label>
          <Input
            id="element-ticker-color"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-ticker-background" class={label}>Background</Label>
          <Input
            id="element-ticker-background"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            value={element.background || '#000000'}
            oninput={(event) =>
              (element.background = (event.currentTarget as HTMLInputElement).value)}
          />
        </div>
      </div>
      {#if element.background}
        <button
          type="button"
          class="text-[10px] text-muted-foreground transition-colors hover:text-theme-100"
          onclick={() => (element.background = '')}
        >
          Remove background
        </button>
      {/if}
    </ThemeSection>
  {:else if element.type === 'button'}
    <ThemeSection title="Button" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-button-label" class={label}>Label</Label>
        <Input id="element-button-label" class={field} bind:value={element.label} />
      </div>
      <div class="space-y-1">
        <Label for="element-button-action" class={label}>Action</Label>
        <Select.Root
          type="single"
          value={element.action.type}
          onValueChange={(value) => {
            if (!value) return;
            if (value === 'launch') element.action = { type: 'launch' };
            else if (value === 'url') element.action = { type: 'url', url: '' };
            else element.action = { type: 'navigate', screen: 'home' };
          }}
        >
          <Select.Trigger
            id="element-button-action"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.action.type === 'navigate'
              ? `Navigate to ${element.action.screen}`
              : element.action.type === 'launch'
                ? 'Launch osu!'
                : 'Open a website'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="navigate" label="Navigate to a screen" />
            <Select.Item value="launch" label="Launch osu!" />
            <Select.Item value="url" label="Open a website" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if element.action.type === 'navigate'}
        <div class="space-y-1">
          <Label for="element-button-screen" class={label}>Screen</Label>
          <Select.Root
            type="single"
            value={element.action.screen}
            onValueChange={(value) => {
              if (value && element.action.type === 'navigate') {
                element.action = {
                  type: 'navigate',
                  screen: value as typeof element.action.screen,
                };
              }
            }}
          >
            <Select.Trigger
              id="element-button-screen"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.action.screen}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="home" label="Home" />
              <Select.Item value="themes" label="Themes" />
              <Select.Item value="settings" label="Settings" />
              <Select.Item value="login" label="Login" />
            </Select.Content>
          </Select.Root>
        </div>
      {:else if element.action.type === 'url'}
        <div class="space-y-1">
          <Label for="element-button-url" class={label}>URL</Label>
          <Input
            id="element-button-url"
            class={field}
            placeholder="https://example.com"
            value={element.action.url}
            oninput={(event) => {
              if (element.action.type === 'url') {
                element.action = {
                  type: 'url',
                  url: (event.currentTarget as HTMLInputElement).value,
                };
              }
            }}
          />
          <p class="text-[9px] leading-relaxed text-muted-foreground">
            The launcher always shows the full address and asks for confirmation before opening a
            website.
          </p>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-button-icon" class={label}>Icon</Label>
          <Select.Root
            type="single"
            value={element.icon ?? 'none'}
            onValueChange={(value) => {
              element.icon = value && value !== 'none' ? (value as typeof element.icon) : undefined;
            }}
          >
            <Select.Trigger
              id="element-button-icon"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.icon ?? 'None'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="none" label="None" />
              {#each THEME_ICON_NAMES as name (name)}
                <Select.Item value={name} label={name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-button-radius" class={label}>Radius</Label>
          <Input
            id="element-button-radius"
            class={field}
            type="number"
            min="0"
            max="999"
            bind:value={element.radius}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-button-background" class={label}>Background</Label>
          <Input
            id="element-button-background"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.background}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-button-hover" class={label}>Hover</Label>
          <Input
            id="element-button-hover"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.hoverBackground}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-button-color" class={label}>Text color</Label>
          <Input
            id="element-button-color"
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-button-font-size" class={label}>Font size</Label>
          <Input
            id="element-button-font-size"
            class={field}
            type="number"
            min="6"
            max="120"
            bind:value={element.fontSize}
          />
        </div>
      </div>
    </ThemeSection>
  {:else if element.type === 'path'}
    <ThemeSection title="Vector path" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-path-data" class={label}>SVG path data</Label>
        <Textarea
          id="element-path-data"
          class="min-h-20 resize-y border-theme-800 bg-theme-950 font-mono text-[10px] normal-case tracking-normal text-theme-50"
          bind:value={element.path}
        />
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          Draw inside a 0–100 box, for example <code>M 5 95 L 50 5 L 95 95 Z</code>. The path is
          stretched to the layer bounds. M, L, H, V, C, S, Q, T, A and Z commands are supported.
        </p>
      </div>
      <div class="space-y-1">
        <Label for="element-path-fill" class={label}>Fill</Label>
        <Select.Root
          type="single"
          value={element.fillMode ?? 'solid'}
          onValueChange={(value) => {
            if (value) element.fillMode = value as 'solid' | 'gradient';
          }}
        >
          <Select.Trigger
            id="element-path-fill"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.fillMode ?? 'solid'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="solid" label="Solid" />
            <Select.Item value="gradient" label="Gradient" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if element.fillMode === 'gradient'}
        <div class="grid grid-cols-3 gap-2">
          <div class="space-y-1">
            <Label class={label}>From</Label>
            <Input
              class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              bind:value={element.gradientFrom}
            />
          </div>
          <div class="space-y-1">
            <Label class={label}>To</Label>
            <Input
              class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              bind:value={element.gradientTo}
            />
          </div>
          <div class="space-y-1">
            <Label for="element-path-angle" class={label}>Angle</Label>
            <Input
              id="element-path-angle"
              class={field}
              type="number"
              min="0"
              max="360"
              bind:value={element.gradientAngle}
            />
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <Input
            class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.fill}
          />
          <Input class="{field} flex-1 font-mono" bind:value={element.fill} />
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label class={label}>Outline color</Label>
          <div class="flex items-center gap-2">
            <Input
              class="h-8 w-10 shrink-0 cursor-pointer border-theme-800 bg-theme-950 p-0.5"
              type="color"
              value={element.stroke || '#ffffff'}
              oninput={(event) =>
                (element.stroke = (event.currentTarget as HTMLInputElement).value)}
            />
            <Input class="{field} flex-1 font-mono" bind:value={element.stroke} />
          </div>
        </div>
        <div class="space-y-1">
          <Label for="element-path-stroke-width" class={label}>Outline width</Label>
          <Input
            id="element-path-stroke-width"
            class={field}
            type="number"
            min="0"
            max="60"
            bind:value={element.strokeWidth}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-path-stroke-style" class={label}>Outline style</Label>
          <Select.Root
            type="single"
            value={element.strokeStyle ?? 'solid'}
            onValueChange={(value) => {
              if (value) element.strokeStyle = value as 'solid' | 'dashed' | 'dotted';
            }}
          >
            <Select.Trigger
              id="element-path-stroke-style"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.strokeStyle ?? 'solid'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="solid" label="Solid" />
              <Select.Item value="dashed" label="Dashed" />
              <Select.Item value="dotted" label="Dotted" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label for="element-path-linecap" class={label}>Line cap</Label>
          <Select.Root
            type="single"
            value={element.strokeLinecap ?? 'round'}
            onValueChange={(value) => {
              if (value) element.strokeLinecap = value as 'butt' | 'round' | 'square';
            }}
          >
            <Select.Trigger
              id="element-path-linecap"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.strokeLinecap ?? 'round'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              <Select.Item value="butt" label="Butt" />
              <Select.Item value="round" label="Round" />
              <Select.Item value="square" label="Square" />
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    </ThemeSection>
  {:else if element.type === 'particles'}
    <ThemeSection title="Particles" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-particles-preset" class={label}>Preset</Label>
        <Select.Root
          type="single"
          value={element.preset}
          onValueChange={(value) => {
            if (value) element.preset = value as typeof element.preset;
          }}
        >
          <Select.Trigger
            id="element-particles-preset"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.preset}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            {#each THEME_PARTICLE_PRESETS as preset (preset.value)}
              <Select.Item value={preset.value} label={preset.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="space-y-1">
          <Label for="element-particles-density" class={label}>Count</Label>
          <Input
            id="element-particles-density"
            class={field}
            type="number"
            min="4"
            max="120"
            bind:value={element.density}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-particles-size" class={label}>Size</Label>
          <Input
            id="element-particles-size"
            class={field}
            type="number"
            min="1"
            max="24"
            bind:value={element.size}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-particles-speed" class={label}>Speed</Label>
          <Input
            id="element-particles-speed"
            class={field}
            type="number"
            min="0.1"
            max="3"
            step="0.1"
            bind:value={element.speed}
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label class={label}>Color</Label>
          <Input
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
        <div class="space-y-1">
          <Label class={label}>Second color</Label>
          <Input
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color2}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-particles-wind" class={label}>Wind</Label>
          <Input
            id="element-particles-wind"
            class={field}
            type="number"
            min="-1"
            max="1"
            step="0.1"
            bind:value={element.wind}
          />
        </div>
        <div class="flex items-center gap-1.5 self-end pb-1.5">
          <Checkbox
            id="element-particles-fade"
            checked={element.fade !== false}
            onCheckedChange={(checked) => (element.fade = checked === true)}
          />
          <Label for="element-particles-fade" class="text-[10px] font-normal text-muted-foreground">
            Fade at edges
          </Label>
        </div>
      </div>
      <p class="text-[9px] leading-relaxed text-muted-foreground">
        Particles animate forever and pause when the system asks for reduced motion.
      </p>
    </ThemeSection>
  {:else if element.type === 'clock'}
    <ThemeSection title="Clock" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1">
        <Label for="element-clock-mode" class={label}>Style</Label>
        <Select.Root
          type="single"
          value={element.mode ?? 'digital'}
          onValueChange={(value) => {
            if (value) element.mode = value as 'digital' | 'analog';
          }}
        >
          <Select.Trigger
            id="element-clock-mode"
            class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
          >
            {element.mode ?? 'digital'}
          </Select.Trigger>
          <Select.Content class="border-theme-800 bg-theme-950">
            <Select.Item value="digital" label="Digital" />
            <Select.Item value="analog" label="Analog" />
          </Select.Content>
        </Select.Root>
      </div>
      {#if (element.mode ?? 'digital') === 'digital'}
        <div class="space-y-1">
          <Label for="element-clock-label" class={label}>Caption</Label>
          <Input
            id="element-clock-label"
            class={field}
            placeholder="Optional, for example Local time"
            bind:value={element.label}
          />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="element-clock-font" class={label}>Font</Label>
            <Select.Root
              type="single"
              value={element.fontFamily ?? 'Sora Variable'}
              onValueChange={(value) => {
                if (value) element.fontFamily = value;
              }}
            >
              <Select.Trigger
                id="element-clock-font"
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
          <div class="space-y-1">
            <Label for="element-clock-size" class={label}>Size</Label>
            <Input
              id="element-clock-size"
              class={field}
              type="number"
              min="6"
              max="240"
              bind:value={element.fontSize}
            />
          </div>
          <div class="space-y-1">
            <Label for="element-clock-weight" class={label}>Weight</Label>
            <Select.Root
              type="single"
              value={String(element.fontWeight ?? 700)}
              onValueChange={(value) => {
                if (value) element.fontWeight = Number(value);
              }}
            >
              <Select.Trigger
                id="element-clock-weight"
                class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
              >
                {element.fontWeight ?? 700}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                {#each [300, 400, 500, 600, 700, 800, 900] as weight (weight)}
                  <Select.Item value={String(weight)} label={String(weight)} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <Label for="element-clock-align" class={label}>Align</Label>
            <Select.Root
              type="single"
              value={element.align ?? 'center'}
              onValueChange={(value) => {
                if (value) element.align = value as 'left' | 'center' | 'right';
              }}
            >
              <Select.Trigger
                id="element-clock-align"
                class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
              >
                {element.align ?? 'center'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                <Select.Item value="left" label="Left" />
                <Select.Item value="center" label="Center" />
                <Select.Item value="right" label="Right" />
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label class={label}>Text / hands</Label>
          <Input
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
        <div class="space-y-1">
          <Label class={label}>Accent</Label>
          <Input
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.accentColor}
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5">
          <Checkbox
            id="element-clock-seconds"
            checked={element.showSeconds !== false}
            onCheckedChange={(checked) => (element.showSeconds = checked === true)}
          />
          <Label for="element-clock-seconds" class="text-[10px] font-normal text-muted-foreground">
            Seconds
          </Label>
        </div>
        <div class="flex items-center gap-1.5">
          <Checkbox
            id="element-clock-hour12"
            checked={element.hour12 === true}
            onCheckedChange={(checked) => (element.hour12 = checked === true)}
          />
          <Label for="element-clock-hour12" class="text-[10px] font-normal text-muted-foreground">
            12-hour
          </Label>
        </div>
        <div class="flex items-center gap-1.5">
          <Checkbox
            id="element-clock-date"
            checked={element.showDate === true}
            onCheckedChange={(checked) => (element.showDate = checked === true)}
          />
          <Label for="element-clock-date" class="text-[10px] font-normal text-muted-foreground">
            Date
          </Label>
        </div>
      </div>
      <p class="text-[9px] leading-relaxed text-muted-foreground">
        Clocks always show the viewer's local time and tick once per second.
      </p>
    </ThemeSection>
  {:else if element.type === 'countdown'}
    <ThemeSection title="Countdown" contentClass="space-y-3 pt-2.5">
      <div class="space-y-1.5">
        <Label for="element-countdown-target" class={label}>Target date & time</Label>
        <DatePicker
          id="element-countdown-target"
          bind:value={element.target}
          withTime={true}
          placeholder="Pick a target date & time..."
          class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50 hover:bg-theme-900"
          contentClass="border-theme-800 bg-theme-950 text-theme-50"
        />
        <Input
          class="{field} font-mono text-[10px]"
          placeholder="2027-01-01T00:00:00Z"
          bind:value={element.target}
        />
        <p class="text-[9px] leading-relaxed text-muted-foreground">
          Pick a date and time with the calendar, or paste an ISO date-time directly.
        </p>
      </div>
      <div class="space-y-1">
        <Label for="element-countdown-text" class={label}>Template</Label>
        <Input id="element-countdown-text" class={field} bind:value={element.text} />
        <p class="text-[9px] text-muted-foreground">
          Variables: <code>&#123;days&#125;</code>, <code>&#123;hours&#125;</code>,
          <code>&#123;minutes&#125;</code>, <code>&#123;seconds&#125;</code>
        </p>
      </div>
      <div class="space-y-1">
        <Label for="element-countdown-finished" class={label}>Finished text</Label>
        <Input id="element-countdown-finished" class={field} bind:value={element.finishedText} />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-countdown-font" class={label}>Font</Label>
          <Select.Root
            type="single"
            value={element.fontFamily ?? 'Sora Variable'}
            onValueChange={(value) => {
              if (value) element.fontFamily = value;
            }}
          >
            <Select.Trigger
              id="element-countdown-font"
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
        <div class="space-y-1">
          <Label for="element-countdown-size" class={label}>Size</Label>
          <Input
            id="element-countdown-size"
            class={field}
            type="number"
            min="6"
            max="240"
            bind:value={element.fontSize}
          />
        </div>
        <div class="space-y-1">
          <Label for="element-countdown-weight" class={label}>Weight</Label>
          <Select.Root
            type="single"
            value={String(element.fontWeight ?? 700)}
            onValueChange={(value) => {
              if (value) element.fontWeight = Number(value);
            }}
          >
            <Select.Trigger
              id="element-countdown-weight"
              class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
            >
              {element.fontWeight ?? 700}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each [300, 400, 500, 600, 700, 800, 900] as weight (weight)}
                <Select.Item value={String(weight)} label={String(weight)} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <Label class={label}>Color</Label>
          <Input
            class="h-8 w-full cursor-pointer border-theme-800 bg-theme-950 p-0.5"
            type="color"
            bind:value={element.color}
          />
        </div>
      </div>
    </ThemeSection>
  {/if}

  <ThemeSection title="Mask" contentClass="space-y-3 pt-2.5">
    <div class="space-y-1">
      <Label for="element-mask-shape" class={label}>Clip shape</Label>
      <Select.Root
        type="single"
        value={element.mask?.shape ?? 'none'}
        onValueChange={(value) => {
          if (!value) return;
          if (value === 'none') {
            element.mask = undefined;
            return;
          }
          element.mask = {
            shape: value as ThemeV2MaskShape,
            radius: element.mask?.radius ?? 24,
            sides: element.mask?.sides ?? 6,
            innerRadius: element.mask?.innerRadius ?? 0.5,
            src: element.mask?.src,
            fit: element.mask?.fit ?? 'cover',
          };
        }}
      >
        <Select.Trigger
          id="element-mask-shape"
          class="h-8 border-theme-800 bg-theme-950 text-xs text-theme-50"
        >
          {element.mask?.shape ?? 'None'}
        </Select.Trigger>
        <Select.Content class="border-theme-800 bg-theme-950">
          <Select.Item value="none" label="None" />
          <Select.Item value="rectangle" label="Rectangle" />
          <Select.Item value="ellipse" label="Ellipse" />
          <Select.Item value="polygon" label="Polygon" />
          <Select.Item value="star" label="Star" />
          <Select.Item value="image" label="Image alpha" />
        </Select.Content>
      </Select.Root>
    </div>
    {#if element.mask?.shape === 'rectangle'}
      <div class="space-y-1">
        <Label for="element-mask-radius" class={label}>Corner radius</Label>
        <Input
          id="element-mask-radius"
          class={field}
          type="number"
          min="0"
          max="999"
          value={element.mask.radius ?? 0}
          oninput={(event) => {
            if (element.mask) {
              element.mask.radius = Number((event.currentTarget as HTMLInputElement).value) || 0;
            }
          }}
        />
      </div>
    {/if}
    {#if element.mask?.shape === 'polygon' || element.mask?.shape === 'star'}
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="element-mask-sides" class={label}>Points</Label>
          <Input
            id="element-mask-sides"
            class={field}
            type="number"
            min="3"
            max="24"
            value={element.mask.sides ?? 6}
            oninput={(event) => {
              if (element.mask) {
                element.mask.sides = Number((event.currentTarget as HTMLInputElement).value) || 3;
              }
            }}
          />
        </div>
        {#if element.mask.shape === 'star'}
          <div class="space-y-1">
            <Label for="element-mask-inner" class={label}>Inner radius</Label>
            <Input
              id="element-mask-inner"
              class={field}
              type="number"
              min="0.1"
              max="0.95"
              step="0.05"
              value={element.mask.innerRadius ?? 0.5}
              oninput={(event) => {
                if (element.mask) {
                  element.mask.innerRadius =
                    Number((event.currentTarget as HTMLInputElement).value) || 0.5;
                }
              }}
            />
          </div>
        {/if}
      </div>
    {/if}
    {#if element.mask?.shape === 'image'}
      <div class="space-y-2 rounded-md border border-theme-800 bg-black/20 p-2">
        <p class="truncate font-mono text-[10px] text-theme-100">
          {element.mask.src ?? 'No mask image yet'}
        </p>
        <Button variant="secondary" class="h-8 w-full gap-2 text-xs" onclick={onpickmask}>
          <RefreshCw class="size-3.5" />
          Choose mask image
        </Button>
      </div>
    {/if}
  </ThemeSection>

  <ThemeFilterControls
    filters={element.filters}
    onchange={(filters) => (element.filters = filters)}
  />
</div>
