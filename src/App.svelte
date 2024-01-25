<script lang="ts">
  import {
    Avatar,
    Dropdown,
    DropdownItem,
    DropdownHeader,
    DropdownDivider,
    Button,
    Indicator,
  } from "flowbite-svelte";
  import {
    ArrowLeftSolid,
    ArrowRightFromBracketSolid,
    ArrowRightToBracketSolid,
    HeartSolid,
    UserSettingsSolid,
  } from "flowbite-svelte-icons";
  import ezppLogo from "../public/favicon.png";
  import {
    currentPage,
    currentUser,
    launching,
    launchPercentage,
    launchStatus,
  } from "./storage/localStore";
  import { Page } from "./consts/pages";
  import Login from "./pages/Login.svelte";
  import Launch from "./pages/Launch.svelte";
  import toast, { Toaster } from "svelte-french-toast";
  import type { User } from "./types/user";
  import Settings from "./pages/Settings.svelte";
  import Swal from "sweetalert2";

  let user: User | undefined = undefined;
  let loggedIn = false;

  let updateInfo: Record<string, unknown>;

  currentUser.subscribe((newUser) => {
    loggedIn = newUser != undefined;
    user = newUser;
  });

  const logout = () => {
    window.dispatchEvent(new CustomEvent("logout"));
    currentUser.set(undefined);
    currentPage.set(Page.Login);
    toast.success("Successfully logged out!", {
      position: "bottom-center",
      className:
        "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
      duration: 2000,
    });
  };

  window.addEventListener("update", async (e) => {
    const update = (e as CustomEvent).detail;
    await Swal.fire({
      html: `EZPPLauncher ${update.tag_name} is now available!<br>Click the Button bellow to download the latest release!`,
      title: "It's your lucky day!",
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      confirmButtonText: "Thanks!",
    });
    window.dispatchEvent(new CustomEvent("updateExit"));
  });

  window.addEventListener("launchStatusUpdate", (e) => {
    const status = (e as CustomEvent).detail.status;
    launchStatus.set(status);
  });

  window.addEventListener("launchProgressUpdate", (e) => {
    const progress = (e as CustomEvent).detail.progress;
    launchPercentage.set(progress);
  });

  window.addEventListener("launch-abort", () => {
    launchPercentage.set(-1);
    launchStatus.set("");
    launching.set(false);
  });

  window.addEventListener("alert", (e) => {
    console.log((e as CustomEvent).detail);
    const toastMessage = (e as CustomEvent).detail;
    switch (toastMessage.type) {
      case "success": {
        toast.success(toastMessage.message, {
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 2000,
        });
        break;
      }
      case "error": {
        toast.error(toastMessage.message, {
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 4000,
        });
        break;
      }
      default: {
        toast(toastMessage.message, {
          icon: "ℹ",
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 1500,
        });
      }
    }
  });
</script>

<Toaster></Toaster>

{#if !updateInfo}
  <div class="p-2 flex flex-row justify-between items-center">
    <div class="flex flex-row items-center animate-fadeIn opacity-0">
      {#if $currentPage == Page.Settings}
        <Button
          class="!ring-0 w-10 h-10 mr-1 rounded-lg animate-sideIn opacity-0 active:scale-95 transition-transform duration-75"
          color="light"
          on:click={() => {
            currentPage.set(Page.Launch);
          }}
        >
          <ArrowLeftSolid class="outline-none border-none" size="sm" />
        </Button>
      {/if}
      <img src={ezppLogo} alt="EZPPFarm Logo" class="w-12 h-12 mr-2" />
      <span class="text-gray-700 dark:text-gray-100 text-xl font-extralight">
        EZPPLauncher
      </span>
    </div>
    {#if $currentPage == Page.Launch}
      <div
        class="flex flex-row gap-2 w-fill cursor-pointer md:order-2 animate-lsideIn opacity-0"
      >
        <Avatar
          class="rounded-lg border dark:border-gray-700 hover:ring-4 hover:ring-gray-200 dark:hover:ring-gray-800"
          src={loggedIn
            ? "https://a.ez-pp.farm/" + user?.id
            : "https://a.ez-pp.farm/0"}
          id="avatar-menu"
        />
        <!-- TODO: if user has donator, display heart indicator-->
        {#if $currentUser && $currentUser.donor}
          <Indicator
            class="pointer-events-none"
            color="red"
            border
            size="xl"
            placement="top-right"
          >
            <span class="text-red-300 text-xs font-bold">
              <HeartSolid class="select-none pointer-events-none" size="xs" />
            </span>
          </Indicator>
        {/if}
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
        <DropdownItem
          class="flex flex-row gap-2 border-0 transition-colors"
          on:click={() => {
            if (!$launching) currentPage.set(Page.Settings);
          }}
        >
          <UserSettingsSolid class="select-none outline-none border-none" />
          Settings
        </DropdownItem>
        <DropdownDivider />
        {#if loggedIn}
          <DropdownItem
            class="flex flex-row gap-2 border-0 transition-colors"
            on:click={() => {
              if (!$launching) logout();
            }}
          >
            <ArrowRightFromBracketSolid
              class="select-none outline-none border-none"
            />
            Sign out
          </DropdownItem>
        {:else}
          <DropdownItem
            class="flex flex-row gap-2 border-0 transition-colors"
            on:click={() => {
              if (!$launching) currentPage.set(Page.Login);
            }}
          >
            <ArrowRightToBracketSolid
              class="select-none outline-none border-none"
            />
            Login
          </DropdownItem>
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
{/if}
