<script lang="ts">
  import { Button, ButtonGroup, Input, Toggle } from "flowbite-svelte";
  import { FolderSolid } from "flowbite-svelte-icons";
  import { currentPage } from "../storage/localStore";
  import { Page } from "../consts/pages";

  let folderPath: string = "";

  let patching: boolean = true;
  let presence: boolean = true;

  window.addEventListener("settings-result", (e) => {
    const settings: Record<string, string>[] = (e as CustomEvent).detail;
    const osuPath = settings.find((setting) => setting.key == "osuPath");
    folderPath = osuPath ? osuPath.val : "";
  });
  window.dispatchEvent(new CustomEvent("settings-get"));

  const setFolderPath = () => {
    window.dispatchEvent(new CustomEvent("folder-set"));
  };

  const togglePatching = () => {
    patching = !patching;
  };

  const togglePresence = () => {
    presence = !presence;
  };
</script>

<main
  class="h-[265px] flex flex-col justify-start p-3 animate-fadeIn opacity-0"
>
  <div class="flex flex-col gap-2 p-3">
    <Toggle class="w-fit" bind:checked={presence} on:click={togglePresence}
      >Discord Presence</Toggle
    >
    <Toggle class="w-fit" bind:checked={patching} on:click={togglePatching}
      >Patching</Toggle
    >
  </div>
  <div
    class="container flex flex-col items-center justify-center gap-5 rounded-lg p-3"
  >
    <ButtonGroup class="w-full">
      <Input
        type="text"
        placeholder="Path to your osu! installation"
        value={folderPath}
        readonly
      />
      <Button
        color="light"
        class="dark:active:!bg-gray-900"
        on:click={setFolderPath}
        ><FolderSolid
          size="sm"
          class="dark:text-gray-300 text-gray-500 outline-none border-none select-none pointer-events-none"
        /></Button
      >
    </ButtonGroup>
    <div class="flex flex-row justify-center items-center gap-5">
      <Button
        color="light"
        class="dark:active:!bg-gray-900"
        on:click={() => currentPage.set(Page.Launch)}>Go Back</Button
      >
    </div>
  </div>
</main>
