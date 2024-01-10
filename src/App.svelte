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
  } from "flowbite-svelte";
  import Progressbar from "./lib/Progressbar.svelte";
  import {
    ArrowRightFromBracketSolid,
    ArrowRightToBracketSolid,
    UserPlusSolid,
    UserSettingsSolid,
    UserSolid,
  } from "flowbite-svelte-icons";
  import ezppLogo from "../public/favicon.png";

  let loggedIn = true;

  let patch = true;
  let loading = false;
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
      src={loggedIn ? "https://a.ez-pp.farm/1001" : "https://a.ez-pp.farm/0"}
      id="avatar-menu"
    />
  </div>
  <Dropdown placement="bottom" triggeredBy="#avatar-menu">
    <DropdownHeader>
      <span class="block text-sm">{loggedIn ? "Quetzalcoatl" : "Guest"}</span>
      <span
        class="block truncate text-sm font-medium text-gray-500 dark:text-gray-200"
      >
        {loggedIn ? "me@horizonco.de" : "Please log in!"}
      </span>
    </DropdownHeader>
    {#if loggedIn}
      <DropdownItem
        class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
      >
        <UserSolid class="select-none outline-none border-none" />
        Profile
      </DropdownItem>
    {/if}
    <DropdownItem
      class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
    >
      <UserSettingsSolid class="select-none outline-none border-none" />
      Settings
    </DropdownItem>
    <DropdownDivider />
    {#if loggedIn}
      <DropdownItem
        class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
        on:click={() => (loggedIn = false)}
      >
        <ArrowRightFromBracketSolid
          class="select-none outline-none border-none"
        />
        Sign out
      </DropdownItem>
    {:else}
      <DropdownItem
        class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
        on:click={() => (loggedIn = true)}
      >
        <ArrowRightToBracketSolid
          class="select-none outline-none border-none"
        />
        Login
      </DropdownItem>
      <DropdownItem
        class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
      >
        <UserPlusSolid class="select-none outline-none border-none" />
        Register
      </DropdownItem>
    {/if}
  </Dropdown>
</div>

<main class="h-[265px] my-auto flex flex-col justify-center items-center p-5">
  <div
    class="container flex flex-col items-center justify-center gap-5 border border-gray-300 dark:border-gray-700 rounded-lg"
  >
    <Button
      color="light"
      size="xl"
      on:click={() => {
        rand = Math.random() * 100;
        loading = true;
      }}>Launch</Button
    >
    <Checkbox color="primary" bind:checked={patch}>
      Patching {patch ? "enabled" : "disabled"}
    </Checkbox>
    {#if loading}
      <div class="w-full flex flex-col justify-center items-center gap-2">
        <p class="m-0 p-0 dark:text-gray-100">Waiting...</p>
        <Progressbar
          animate={true}
          progress={rand}
          labelInside={true}
          size="h-6"
          indeterminate
          labelInsideClass="bg-primary-600 drop-shadow-xl text-gray-100 text-base font-medium text-center p-1 leading-none rounded-full"
        />
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    text-align: center;
    padding: 1em;
    margin: auto;
  }
</style>
