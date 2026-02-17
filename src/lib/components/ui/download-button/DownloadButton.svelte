<script lang="ts">
  import Ellipsis from 'lucide-svelte/icons/ellipsis';
  import Play from 'lucide-svelte/icons/play';

  const prop: {
    downloading: boolean;
    progress: number;
    text: string;
    subtext?: string;
    disabled?: boolean;
    onClick?: () => void;
  } = $props();

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = $derived(circumference - (prop.progress / 100) * circumference);
</script>

<button
  class="group flex items-center h-12 rounded-full bg-primary-300 disabled:bg-primary-300/70 shadow-lg shadow-primary/25 transition-all not-disabled:hover:shadow-primary/40 not-disabled:hover:brightness-110 not-disabled:active:scale-[0.98] cursor-pointer w-fit"
  disabled={prop.disabled}
  onclick={prop.onClick}
>
  <div class="relative size-12 shrink-0 flex items-center justify-center">
    {#if prop.downloading}
      {#if prop.progress === -1}
        <svg class="absolute inset-0 animate-spin" viewBox="0 0 48 48">
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
        <svg class="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
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
    <div class="size-9 rounded-full bg-black/30 flex items-center justify-center relative z-10">
      {#if prop.downloading}
        {#if prop.progress === -1}
          <Ellipsis class="size-4 text-primary-foreground fill-current animate-pulse" />
        {:else}
          <span class="text-[10px] font-bold text-primary-foreground">
            {prop.progress.toFixed()}
          </span>
        {/if}
      {:else}
        <Play class="size-4 text-primary-foreground fill-current ml-0.5" />
      {/if}
    </div>
  </div>

  <div class="pr-6 pl-1 text-center w-52">
    <p class="text-sm font-bold text-primary-foreground leading-tight">
      {prop.text}
    </p>
    {#if prop.subtext}
      <p class="text-[10px] text-primary-foreground/70 leading-tight">
        {prop.subtext}
      </p>
    {/if}
  </div>
</button>
