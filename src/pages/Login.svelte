<script lang="ts">
  import { Input, Button, Spinner } from "flowbite-svelte";
  import { performLogin } from "../util/loginUtil";
  import type { User } from "../types/user";
  import type { Error } from "../types/error";
  import { currentPage, currentUser } from "../storage/localStore";
  import toast from "svelte-french-toast";
  import { Page } from "../consts/pages";

  let loading = false;
  let username = "";
  let password = "";

  const processLogin = async () => {
    loading = true;
    window.addEventListener(
      "login-result",
      (e) => {
        const customEvent = e as CustomEvent;
        const resultData = customEvent.detail;
        const wasSuccessful = "user" in resultData;

        if (!wasSuccessful) {
          toast.error(resultData.message, {
            position: "bottom-center",
            className:
              "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
            duration: 1500,
          });
          loading = false;
          return;
        }
        console.log(resultData);
        currentUser.set(resultData.user as User);
        currentPage.set(Page.Launch);
        toast.success(`Welcome back ${resultData.user.name}!`, {
          position: "bottom-center",
          className:
            "dark:!bg-gray-800 border-1 dark:!border-gray-700 dark:!text-gray-100",
          duration: 5000,
        });
      },
      { once: true }
    );
    window.dispatchEvent(
      new CustomEvent("login-attempt", { detail: { username, password } })
    );
  };
</script>

<main class="h-[265px] my-auto flex flex-col justify-center items-center p-5">
  <div
    class="container flex flex-col items-center justify-center gap-5 rounded-lg p-3"
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
    <div class="flex flex-col justify-center items-center gap-5 mt-2">
      <Button
        class="dark:active:!bg-gray-900"
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
        class="!bg-transparent border-none dark:text-gray-700 hover:!bg-gray-700/15 ring-primary active:ring-2 focus:ring-2"
        color="none"
        disabled={loading}
        on:click={() => currentPage.set(Page.Launch)}
        >Continue without login</Button
      >
    </div>
  </div>
</main>
