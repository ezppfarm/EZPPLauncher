<script lang="ts">
  import Calendar from '$lib/components/ui/calendar/calendar.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils.js';
  import TimePicker from './time-picker.svelte';
  import { CalendarDate, type DateValue } from '@internationalized/date';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import X from '@lucide/svelte/icons/x';

  let {
    value = $bindable(''),
    withTime = false,
    includeSeconds = false,
    placeholder = withTime ? 'Pick date & time...' : 'Pick a date...',
    disabled = false,
    clearable = true,
    class: className = '',
    contentClass = '',
    open = $bindable(false),
    id = undefined,
  }: {
    value?: string;
    withTime?: boolean;
    includeSeconds?: boolean;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    class?: string;
    contentClass?: string;
    open?: boolean;
    id?: string;
  } = $props();

  let calendarValue = $state<DateValue | undefined>(undefined);
  let hours = $state(0);
  let minutes = $state(0);
  let seconds = $state(0);
  let lastEmittedValue = '';

  // Synchronize incoming value -> internal state
  $effect(() => {
    if (value === lastEmittedValue) return;
    lastEmittedValue = value ?? '';

    if (!value || !value.trim()) {
      calendarValue = undefined;
      hours = 0;
      minutes = 0;
      seconds = 0;
      return;
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      const parsed = new Date(timestamp);
      calendarValue = new CalendarDate(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate()
      );
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
      seconds = parsed.getSeconds();
    } else {
      calendarValue = undefined;
    }
  });

  function emitChange() {
    if (!calendarValue) {
      lastEmittedValue = '';
      value = '';
      return;
    }

    let next = '';
    if (withTime) {
      const d = new Date(
        calendarValue.year,
        calendarValue.month - 1,
        calendarValue.day,
        hours,
        minutes,
        seconds
      );
      next = d.toISOString();
    } else {
      const pad = (n: number) => String(n).padStart(2, '0');
      next = `${calendarValue.year}-${pad(calendarValue.month)}-${pad(calendarValue.day)}`;
    }

    lastEmittedValue = next;
    value = next;
  }

  function handleDateChange(newDate: DateValue | undefined) {
    calendarValue = newDate;
    if (newDate) {
      emitChange();
      if (!withTime) {
        open = false;
      }
    } else {
      emitChange();
    }
  }

  function handleTimeChange() {
    if (!calendarValue) {
      const now = new Date();
      calendarValue = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    emitChange();
  }

  function handleClear(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    calendarValue = undefined;
    hours = 0;
    minutes = 0;
    seconds = 0;
    emitChange();
  }

  const formattedDisplay = $derived.by(() => {
    if (!value || !value.trim()) return '';
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) return value;
    const d = new Date(ts);
    try {
      if (withTime) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: includeSeconds ? 'medium' : 'short',
        }).format(d);
      }
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
    } catch {
      return value;
    }
  });
</script>

<Popover.Root bind:open>
  <div class="relative flex items-center">
    <Popover.Trigger
      {id}
      {disabled}
      class={cn(
        'flex h-8 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-xs font-normal text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background',
        !formattedDisplay && 'text-muted-foreground',
        className
      )}
    >
      <CalendarIcon class="size-3.5 shrink-0 text-muted-foreground" />
      <span class="truncate">
        {formattedDisplay || placeholder}
      </span>
    </Popover.Trigger>

    {#if clearable && formattedDisplay && !disabled}
      <button
        type="button"
        class="absolute right-2 flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        onclick={handleClear}
        title="Clear date"
      >
        <X class="size-3" />
        <span class="sr-only">Clear</span>
      </button>
    {/if}
  </div>

  <Popover.Content
    align="start"
    class={cn('w-auto border-border bg-popover p-0 shadow-lg', contentClass)}
  >
    <Calendar
      type="single"
      value={calendarValue}
      onValueChange={(val) => handleDateChange(val as DateValue | undefined)}
      class="p-3"
    />

    {#if withTime}
      <div class="border-t border-border/60 p-3 pt-2">
        <TimePicker
          bind:hours
          bind:minutes
          bind:seconds
          {includeSeconds}
          onchange={handleTimeChange}
        />
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
