<script lang="ts">
  import { Button, Checkbox } from "flowbite-svelte";
  import Progressbar from "../lib/Progressbar.svelte";
  import {
    launching,
    patch,
    launchStatus,
    launchPercentage,
  } from "./../storage/localStore";
  let progressbarFix = true;

  setTimeout(() => {
    progressbarFix = false;
  }, 1000);

  const launch = () => {
    launching.set(true);
    const patching = $patch;
    window.dispatchEvent(
      new CustomEvent("launch", { detail: { patch: patching } })
    );
  };
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
      class="{$launching
        ? ''
        : 'active:scale-95 '}transition-transform duration-75"
      disabled={$launching}
      on:click={launch}>Launch</Button
    >
    <div
      class="w-full flex flex-col justify-center items-center gap-2 mt-2 {$launching
        ? 'animate-fadeIn '
        : 'animate-fadeOut '}{progressbarFix ? '!opacity-0' : 'opacity-0'}"
    >
      <Progressbar
        animate={true}
        progress={$launchPercentage}
        indeterminate={$launchPercentage == -1}
        labelInside={true}
        size="h-3"
        class=""
        labelInsideClass="bg-primary-600 drop-shadow-xl text-gray-100 text-base font-medium text-center p-1 leading-none rounded-full !text-[0.7rem] !leading-[0.45]"
      />
      <p class="m-0 p-0 dark:text-gray-400 font-light">{$launchStatus}</p>
    </div>
  </div>
</main>
