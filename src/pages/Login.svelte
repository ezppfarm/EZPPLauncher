<script lang="ts">
  import { Input, Button, Spinner } from "flowbite-svelte";
  import { performLogin } from "../util/loginUtil";
  import type { User } from "../types/user";
  import { currentUser } from "../storage/localStore";

  let loading = false;
  let username = "";
  let password = "";

  const processLogin = async () => {
    loading = true;
    const loginResult = await performLogin(username, password);
    if (loginResult instanceof Error) {
      loading = false;
      return;
    }
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
        disabled={loading}>Continue without login</Button
      >
    </div>
  </div>
</main>
