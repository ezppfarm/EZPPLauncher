<script lang="ts">
  let {
    loadingText,
    progress,
    indeterminate,
  }: { loadingText: string; progress: number; indeterminate: boolean } =
    $props();
</script>

<div
  class="relative flex items-center justify-center w-[80vw] h-10 bg-gray-900/70 border rounded overflow-hidden"
>
  <div
    class="absolute h-full rounded top-0 left-0 bg-pink-600 transition-all"
    style="width: {indeterminate
      ? 100
      : Math.min(100, Math.max(0, progress))}%;"
  ></div>
  <p class="text-xs z-10">{loadingText}</p>
</div>
