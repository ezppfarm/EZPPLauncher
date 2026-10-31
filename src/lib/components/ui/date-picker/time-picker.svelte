<script lang="ts">
  import Button from '$lib/components/ui/button/button.svelte';
  import { cn } from '$lib/utils.js';
  import Clock from '@lucide/svelte/icons/clock';

  let {
    hours = $bindable(0),
    minutes = $bindable(0),
    seconds = $bindable(0),
    includeSeconds = false,
    disabled = false,
    class: className = '',
    onchange,
  }: {
    hours?: number;
    minutes?: number;
    seconds?: number;
    includeSeconds?: boolean;
    disabled?: boolean;
    class?: string;
    onchange?: () => void;
  } = $props();

  const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

  function updateHours(val: number) {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(23, Number.isNaN(val) ? 0 : val));
    if (hours !== clamped) {
      hours = clamped;
      onchange?.();
    }
  }

  function updateMinutes(val: number) {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(59, Number.isNaN(val) ? 0 : val));
    if (minutes !== clamped) {
      minutes = clamped;
      onchange?.();
    }
  }

  function updateSeconds(val: number) {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(59, Number.isNaN(val) ? 0 : val));
    if (seconds !== clamped) {
      seconds = clamped;
      onchange?.();
    }
  }

  function setNow() {
    if (disabled) return;
    const now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
    seconds = now.getSeconds();
    onchange?.();
  }

  function setMidnight() {
    if (disabled) return;
    hours = 0;
    minutes = 0;
    seconds = 0;
    onchange?.();
  }

  function setNoon() {
    if (disabled) return;
    hours = 12;
    minutes = 0;
    seconds = 0;
    onchange?.();
  }
</script>

<div class={cn('space-y-2', className)}>
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Clock class="size-3.5" />
      <span>Time (24h)</span>
    </div>
    <div class="flex items-center gap-1 font-mono text-xs">
      <label class="sr-only" for="tp-hours">Hours</label>
      <input
        id="tp-hours"
        type="number"
        min="0"
        max="23"
        {disabled}
        value={pad(hours)}
        oninput={(e) => updateHours(parseInt(e.currentTarget.value, 10))}
        class="h-7 w-11 rounded border border-input bg-background text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span class="select-none font-bold text-muted-foreground">:</span>
      <label class="sr-only" for="tp-minutes">Minutes</label>
      <input
        id="tp-minutes"
        type="number"
        min="0"
        max="59"
        {disabled}
        value={pad(minutes)}
        oninput={(e) => updateMinutes(parseInt(e.currentTarget.value, 10))}
        class="h-7 w-11 rounded border border-input bg-background text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {#if includeSeconds}
        <span class="select-none font-bold text-muted-foreground">:</span>
        <label class="sr-only" for="tp-seconds">Seconds</label>
        <input
          id="tp-seconds"
          type="number"
          min="0"
          max="59"
          {disabled}
          value={pad(seconds)}
          oninput={(e) => updateSeconds(parseInt(e.currentTarget.value, 10))}
          class="h-7 w-11 rounded border border-input bg-background text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      {/if}
    </div>
  </div>
  <div class="flex items-center gap-1.5 pt-0.5">
    <Button
      variant="ghost"
      size="sm"
      {disabled}
      class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
      onclick={setNow}
    >
      Now
    </Button>
    <Button
      variant="ghost"
      size="sm"
      {disabled}
      class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
      onclick={setMidnight}
    >
      00:00
    </Button>
    <Button
      variant="ghost"
      size="sm"
      {disabled}
      class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
      onclick={setNoon}
    >
      12:00
    </Button>
  </div>
</div>
