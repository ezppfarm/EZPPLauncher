<script lang="ts">
  import { Button, ButtonGroup, Input, Toggle } from "flowbite-svelte";
  import { FileSearchSolid, FolderSolid } from "flowbite-svelte-icons";
  import { patch, presence, logging } from "./../storage/localStore";

  let folderPath: string = "";

  window.addEventListener("settings-result", (e) => {
    const settings: Record<string, string>[] = (e as CustomEvent).detail;
    const osuPath = settings.find((setting) => setting.key == "osuPath");
    const settingPatch = settings.find((setting) => setting.key == "patch");
    const settingPresence = settings.find(
      (setting) => setting.key == "presence"
    );
    const settingLogging = settings.find((setting) => setting.key == "logging");
    patch.set(settingPatch ? settingPatch.val == "true" : true);
    presence.set(settingPresence ? settingPresence.val == "true" : true);
    logging.set(settingLogging ? settingLogging.val == "true" : false);
    folderPath = osuPath ? osuPath.val : "";
  });
  window.dispatchEvent(new CustomEvent("settings-get"));

  const setFolderPath = () => {
    window.dispatchEvent(new CustomEvent("folder-set"));
  };

  const detectFolderPath = () => {
    window.dispatchEvent(new CustomEvent("folder-auto"));
  };

  const togglePatching = () => {
    patch.set(!$patch);
    window.dispatchEvent(
      new CustomEvent("setting-update", { detail: { patch: $patch } })
    );
  };

  const togglePresence = () => {
    presence.set(!$presence);
    window.dispatchEvent(
      new CustomEvent("setting-update", { detail: { presence: $presence } })
    );
  };

  const toggleLogging = () => {
    logging.set(!$logging);
    window.dispatchEvent(
      new CustomEvent("setting-update", { detail: { logging: $logging } })
    );
  };
</script>

<main
  class="h-[265px] flex flex-col justify-start p-3 animate-fadeIn opacity-0"
>
  <div
    class="container flex flex-col items-center justify-center gap-5 rounded-lg p-3"
  >
    <ButtonGroup class="w-full">
      <Input
        type="text"
        id="oip"
        placeholder="Path to your osu! installation"
        value={folderPath}
        readonly
      />
      <Button color="light" on:click={detectFolderPath}>
        <FileSearchSolid
          size="sm"
          class="dark:text-gray-300 text-gray-500 outline-none border-none select-none pointer-events-none"
        />
      </Button>
      <Button color="light" class="active:!rounded-lg" on:click={setFolderPath}>
        <FolderSolid
          size="sm"
          class="dark:text-gray-300 text-gray-500 outline-none border-none select-none pointer-events-none"
        />
      </Button>
    </ButtonGroup>
  </div>
  <div class="flex flex-col gap-2 p-3">
    <Toggle class="w-fit" bind:checked={$presence} on:click={togglePresence}
      >Discord Presence</Toggle
    >
    <Toggle class="w-fit" bind:checked={$patch} on:click={togglePatching}
      >Patching</Toggle
    >
    <Toggle class="w-fit" bind:checked={$logging} on:click={toggleLogging}
      >Debug Logging</Toggle
    >
  </div>
</main>
