<script lang="ts">
  import {
    Avatar,
    Dropdown,
    DropdownItem,
    DropdownHeader,
    DropdownDivider,
  } from "flowbite-svelte";
  import ezppLogo from "../public/favicon.png";
</script>

<div class="p-2 flex flex-row justify-between items-center">
  <div class="flex flex-row items-center">
    <img src={ezppLogo} class="w-12 h-12 mr-2" />
    <span class="text-gray-100 text-xl font-extralight">EZPPLauncher</span>
  </div>
  <div class="w-fill cursor-pointer flex md:order-2">
    <Avatar
      class="rounded-lg hover:ring hover:ring-4 hover:ring-gray-800"
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
      class="border-0 !bg-gray-700 active:!bg-gray-600 hover:!bg-gray-800 transition-colors"
      >Profile</DropdownItem
    >
    <DropdownItem
      class="border-0 !bg-gray-700 active:!bg-gray-600 hover:!bg-gray-800 transition-colors"
      >Settings</DropdownItem
    >
    <DropdownDivider />
    <DropdownItem
      class="border-0 !bg-gray-700 active:!bg-gray-600 hover:!bg-gray-800 transition-colors"
      >Sign out</DropdownItem
    >
  </Dropdown>
</div>

<main class="p-1">
  <div class="container border border-gray-700 rounded-lg"></div>
</main>

<style>
  .container {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
  }
  h1 {
    font-size: 2rem;
    margin: 0;
    font-weight: 300;
    font-style: normal;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 0 1px #000;
    text-align: center;
    padding: 0.5em 0;
    border-bottom: 1px solid #353535;
    margin-bottom: 1.5rem;
  }
</style>
