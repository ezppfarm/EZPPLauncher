<script lang="ts">
  import { Input, Button, Spinner, Checkbox } from "flowbite-svelte";
  import { performLogin } from "../util/loginUtil";
  import type { User } from "../types/user";
  import type { Error } from "../types/error";
  import { currentPage, currentUser, startup } from "../storage/localStore";
  import toast from "svelte-french-toast";
  import { Page } from "../consts/pages";

  let loading = false;
  let username = "";
  let password = "";
  let saveCredentials = false;

  const processLogin = async () => {
    loading = true;
    window.addEventListener(
      "login-result",
      (e) => {
        const customEvent = e as CustomEvent;
        const resultData = customEvent.detail;
        const wasSuccessful = "user" in resultData;

        if (!wasSuccessful) {
          const errorResult = resultData as Error;
          toast.error(errorResult.message, {
            position: "bottom-center",
            className:
              "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
            duration: 1500,
          });
          loading = false;
          return;
        }
        const userResult = resultData.user as User;
        currentUser.set(userResult);
        currentPage.set(Page.Launch);
        toast.success(`Welcome back, ${userResult.name}!`, {
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 3000,
        });
      },
      { once: true }
    );
    window.dispatchEvent(
      new CustomEvent("login-attempt", {
        detail: { username, password, saveCredentials },
      })
    );
  };

  const tryAutoLogin = async () => {
    loading = true;
    await new Promise((res) => setTimeout(res, 1500));
    window.addEventListener(
      "login-result",
      (e) => {
        const customEvent = e as CustomEvent;
        const resultData = customEvent.detail;
        const isGuest = "guest" in resultData;
        const wasSuccessful = "user" in resultData;
        if (isGuest) {
          currentPage.set(Page.Launch);
          toast.success(`Logged in as Guest`, {
            position: "bottom-center",
            className:
              "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
            duration: 3000,
          });
          return;
        }
        if (!wasSuccessful) {
          loading = false;
          return;
        }
        const userResult = resultData.user as User;
        currentUser.set(userResult);
        currentPage.set(Page.Launch);
        toast.success(`Welcome back, ${userResult.name}!`, {
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 3000,
        });
        loading = false;
      },
      { once: true }
    );
    window.dispatchEvent(new CustomEvent("autologin-attempt"));
  };

  const proceedAsGuest = () => {
    window.dispatchEvent(new CustomEvent("guest-login"));
    currentPage.set(Page.Launch);
    toast.success(`Logged in as Guest`, {
      position: "bottom-center",
      className:
        "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
      duration: 3000,
    });
  };

  if (!$startup) {
    startup.set(true);
    tryAutoLogin();
  }
</script>

<main
  class="h-[265px] my-auto flex flex-col justify-center items-center p-5 animate-fadeIn opacity-0"
>
  <div
    class="container flex flex-col items-center justify-center gap-3 rounded-lg p-3"
  >
    <Input
      type="text"
      placeholder="Username"
      size="md"
      disabled={loading}
      bind:value={username}
    />
    <Input
      type="password"
      placeholder="Password"
      size="md"
      disabled={loading}
      bind:value={password}
    />
    <Checkbox bind:checked={saveCredentials}>Save credentials</Checkbox>
    <div class="flex flex-col justify-center items-center gap-5 mt-1">
      <Button
        class="dark:active:!bg-gray-900  active:scale-95 transition-transform duration-75"
        color="light"
        disabled={loading}
        on:click={processLogin}
      >
        {#if loading}
          <Spinner size={"5"} color="white"></Spinner>
        {:else}
          Login
        {/if}
      </Button>
      <Button
        class="!bg-transparent font-light border-none dark:text-gray-700 hover:!bg-gray-700/15 ring-primary active:ring-2 focus:ring-2 active:scale-95 transition-transform duration-75"
        color="none"
        disabled={loading}
        on:click={proceedAsGuest}>Continue without login</Button
      >
    </div>
  </div>
</main>
