<script lang="ts">
  import { Button, Checkbox } from "flowbite-svelte";
  import Progressbar from "../lib/Progressbar.svelte";
  import { launching, patch } from "./../storage/localStore";
  let progressbarFix = true;

  setTimeout(() => {
    progressbarFix = false;
  }, 1000);
</script>

<main
  class="h-[265px] my-auto flex flex-col justify-center items-center p-5 animate-fadeIn"
>
  <div
    class="container flex flex-col items-center justify-center gap-3 rounded-lg p-3"
  >
    <Button
      color="light"
      size="xl"
      class="dark:active:!bg-gray-900 {$launching
        ? ''
        : 'active:scale-95 '}transition-transform duration-75"
      disabled={$launching}
      on:click={() => launching.set(!$launching)}>Launch</Button
    >
    <Checkbox
      disabled={$launching}
      bind:checked={$patch}
      on:click={() => patch.set(!$patch)}>Patch</Checkbox
    >
    <div
      class="w-full flex flex-col justify-center items-center gap-2 mt-2 {$launching
        ? 'animate-fadeIn '
        : 'animate-fadeOut '}{progressbarFix ? '!opacity-0' : 'opacity-0'}"
    >
      <Progressbar
        animate={true}
        progress={null}
        labelInside={true}
        size="h-3"
        labelInsideClass="bg-primary-600 drop-shadow-xl text-gray-100 text-base font-medium text-center p-1 leading-none rounded-full"
      />
      <p class="m-0 p-0 dark:text-gray-400 font-light">Waiting...</p>
    </div>
  </div>
</main>
