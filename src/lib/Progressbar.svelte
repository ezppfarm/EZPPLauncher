<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import { twMerge, twJoin } from "tailwind-merge";
  import { clamp } from "../util/mathUtil";

  export let progress: number = 45;
  export let precision = 2;
  export let tweenDuration = 400;
  export let animate = false;
  export let size = "h-2.5";
  export let labelInside = false;
  export let labelOutside = "";
  export let easing = cubicOut;
  export let color = "primary";
  export let indeterminate = false;
  export let labelInsideClass =
    "text-primary-100 text-xs font-medium text-center p-0.5 leading-none rounded-full";
  export let divClass = "w-full bg-gray-200 rounded-full dark:bg-gray-700";

  const barColors: Record<string, string> = {
    primary: "bg-primary-600",
    blue: "bg-blue-600",
    gray: "bg-gray-600 dark:bg-gray-300",
    red: "bg-red-600 dark:bg-red-500",
    green: "bg-green-600 dark:bg-green-500",
    yellow: "bg-yellow-400",
    purple: "bg-purple-600 dark:bg-purple-500",
    indigo: "bg-indigo-600 dark:bg-indigo-500"
  };

  let _progress = tweened(0, {
    duration: tweenDuration,
    easing
  });

  $: {
    progress = clamp(Number(progress), 0, 100);
    _progress.set(progress);
  }
</script>

{#if labelOutside}
  <div
    {...$$restProps}
    class={twMerge("flex justify-between mb-1", $$props.classLabelOutside)}
  >
    <span class="text-base font-medium text-blue-700 dark:text-white"
      >{labelOutside}</span
    >
    <span class="text-sm font-medium text-blue-700 dark:text-white"
      >{animate
        ? isNaN($_progress)
          ? parseInt("100").toFixed(precision)
          : $_progress.toFixed(precision)
        : isNaN(progress)
          ? parseInt("100").toFixed(precision)
          : progress.toFixed(precision)}%</span
    >
  </div>
{/if}

<div class={twMerge(divClass, size, $$props.class)}>
  {#if labelInside}
    {#if !indeterminate}
      <div
        class={twJoin(labelInsideClass, barColors[color])}
        style="width: {animate ? $_progress : progress}%"
      >
        {animate
          ? isNaN($_progress)
            ? parseInt("100").toFixed(precision)
            : $_progress.toFixed(precision)
          : isNaN(progress)
            ? parseInt("100").toFixed(precision)
            : progress.toFixed(precision)}%
      </div>
    {:else}
      <div
        class={twJoin(
          barColors[color],
          size,
          "indeterminate rounded-full animate-pulse"
        )}
      />
    {/if}
  {:else if !indeterminate}
    <div
      class={twJoin(barColors[color], size, "rounded-full")}
      style="width: {animate ? $_progress : progress}%"
    />
  {:else}
    <div
      class={twJoin(
        barColors[color],
        size,
        "indeterminate rounded-full animate-pulse"
      )}
    />
  {/if}
</div>
