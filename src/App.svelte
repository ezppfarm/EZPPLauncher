<script lang="ts">
  import {
    Avatar,
    Dropdown,
    DropdownItem,
    DropdownHeader,
    DropdownDivider,
    Button,
    Checkbox,
    DarkMode,
    Progressbar,
  } from "flowbite-svelte";
  import ezppLogo from "../public/favicon.png";

  let patch = true;
  let rand = 0;
</script>

<div class="p-2 flex flex-row justify-between items-center">
  <div class="flex flex-row items-center">
    <img src={ezppLogo} alt="EZPPFarm Logo" class="w-12 h-12 mr-2" />
    <span class="text-gray-700 dark:text-gray-100 text-xl font-extralight"
      >EZPPLauncher</span
    >
  </div>
  <div class="flex flex-row gap-2 w-fill cursor-pointer md:order-2">
    <DarkMode class="dark:border-gray-700"></DarkMode>
    <Avatar
      class="rounded-lg border dark:border-gray-700 hover:ring-4 hover:ring-gray-200 dark:hover:ring-gray-800"
      src="https://a.ez-pp.farm/1001"
      id="avatar-menu"
    />
  </div>
  <Dropdown placement="bottom" triggeredBy="#avatar-menu">
    <DropdownHeader>
      <span class="block text-sm">Quetzalcoatl</span>
      <span class="block truncate text-sm font-medium text-gray-200"
        >me@horizonco.de</span
      >
    </DropdownHeader>
    <DropdownItem
      class="border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
      >Profile</DropdownItem
    >
    <DropdownItem
      class="border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
      >Settings</DropdownItem
    >
    <DropdownDivider />
    <DropdownItem
      class="border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
      >Sign out</DropdownItem
    >
  </Dropdown>
</div>

<main class="p-5">
  <div
    class="container flex flex-col items-center justify-center gap-5 border border-gray-300 dark:border-gray-700 rounded-lg"
  >
    <Button
      color="light"
      size="xl"
      on:click={() => (rand = Math.random() * 100)}>Launch</Button
    >
    <Checkbox color="primary" bind:checked={patch}>
      Patching {patch ? "enabled" : "disabled"}
    </Checkbox>
    <Progressbar
      animate={true}
      progress={rand}
      labelInside={true}
      size="h-6"
      labelInsideClass="bg-primary-600 drop-shadow-xl text-gray-100 text-base font-medium text-center p-1 leading-none rounded-full"
    />
  </div>
</main>

<style>
  .container {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
  }
</style>
