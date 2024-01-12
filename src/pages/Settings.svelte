<script lang="ts">
  import { Button, ButtonGroup, Input } from "flowbite-svelte";
  import { FolderSolid } from "flowbite-svelte-icons";
  import { currentPage } from "../storage/localStore";
  import { Page } from "../consts/pages";

  let folderPath: string = "";

  window.addEventListener("settings-result", (e) => {
    const settings: Record<string, string>[] = (e as CustomEvent).detail;
    const osuPath = settings.find((setting) => setting.key == "osuPath");
    folderPath = osuPath ? osuPath.val : "";
  });
  window.dispatchEvent(new CustomEvent("settings-get"));

  const setFolderPath = () => {
    window.dispatchEvent(new CustomEvent("folder-set"));
  };
</script>

<main
  class="h-[265px] my-auto flex flex-col justify-center items-center p-5 animate-fadeIn opacity-0"
>
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
      <Button color="light" class="dark:active:!bg-gray-900">Save</Button>
      <Button
        color="red"
        class="dark:active:!bg-red-900 border-red-400"
        on:click={() => currentPage.set(Page.Launch)}>Cancel</Button
      >
    </div>
  </div>
</main>
