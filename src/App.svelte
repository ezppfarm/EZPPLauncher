<script lang="ts">
  import {
    Avatar,
    Dropdown,
    DropdownItem,
    DropdownHeader,
    DropdownDivider,
    Button,
    Checkbox,
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
  import { currentPage, currentUser } from "./storage/localStore";
  import { Page } from "./consts/pages";
  import Login from "./pages/Login.svelte";
  import Launch from "./pages/Launch.svelte";
  import { Toaster } from "svelte-french-toast";
  import type { User } from "./types/user";
  import Settings from "./pages/Settings.svelte";

  let user: User | undefined = undefined;
  let loggedIn = false;

  currentUser.subscribe((newUser) => {
    loggedIn = newUser != undefined;
    user = newUser;
  });

  const logout = () => {
    window.dispatchEvent(new CustomEvent("logout"));
    currentUser.set(undefined);
    currentPage.set(Page.Login);
  };
</script>

<Toaster></Toaster>

<div class="p-2 flex flex-row justify-between items-center">
  <div class="flex flex-row items-center">
    <img src={ezppLogo} alt="EZPPFarm Logo" class="w-12 h-12 mr-2" />
    <span class="text-gray-700 dark:text-gray-100 text-xl font-extralight"
      >EZPPLauncher</span
    >
  </div>
  {#if $currentPage == Page.Launch}
    <div class="flex flex-row gap-2 w-fill cursor-pointer md:order-2">
      <Avatar
        class="rounded-lg border dark:border-gray-700 hover:ring-4 hover:ring-gray-200 dark:hover:ring-gray-800"
        src={loggedIn
          ? "https://a.ez-pp.farm/" + user?.id
          : "https://a.ez-pp.farm/0"}
        id="avatar-menu"
      />
    </div>
    <Dropdown placement="bottom-start" triggeredBy="#avatar-menu">
      <DropdownHeader>
        <span class="block text-sm">{loggedIn ? user?.name : "Guest"}</span>
        <span
          class="block truncate text-sm font-medium text-gray-500 dark:text-gray-200"
        >
          {loggedIn ? user?.email : "Please log in!"}
        </span>
      </DropdownHeader>
      {#if loggedIn}
        <!-- <DropdownItem
          class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
        >
          <UserSolid class="select-none outline-none border-none" />
          Profile
        </DropdownItem> -->
      {/if}
      <DropdownItem
        class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
        on:click={() => currentPage.set(Page.Settings)}
      >
        <UserSettingsSolid class="select-none outline-none border-none" />
        Settings
      </DropdownItem>
      <DropdownDivider />
      {#if loggedIn}
        <DropdownItem
          class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
          on:click={logout}
        >
          <ArrowRightFromBracketSolid
            class="select-none outline-none border-none"
          />
          Sign out
        </DropdownItem>
      {:else}
        <DropdownItem
          class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
          on:click={() => currentPage.set(Page.Login)}
        >
          <ArrowRightToBracketSolid
            class="select-none outline-none border-none"
          />
          Login
        </DropdownItem>
        <!-- <DropdownItem
          class="flex flex-row gap-2 border-0 dark:!bg-gray-700 dark:active:!bg-gray-900 dark:hover:!bg-gray-800 transition-colors"
        >
          <UserPlusSolid class="select-none outline-none border-none" />
          Register
        </DropdownItem> -->
      {/if}
    </Dropdown>
  {/if}
</div>

{#if $currentPage == Page.Login}
  <Login />
{:else if $currentPage == Page.Settings}
  <Settings />
{:else}
  <Launch />
{/if}

<style>
  .container {
    text-align: center;
    padding: 1em;
    margin: auto;
  }
</style>
