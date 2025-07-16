<script lang="ts">
  import Logo from '$assets/logo.png';
  import { ezppfarm } from '@/api/ezpp';
  import Button from '@/components/ui/button/button.svelte';
  import Input from '@/components/ui/input/input.svelte';
  import Label from '@/components/ui/label/label.svelte';
  import { currentView } from '@/global';
  import { currentUser, userAuth } from '@/userAuthentication';
  import { animate } from 'animejs';
  import { LoaderCircle } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import Launch from './Launch.svelte';
  import { currentUserInfo } from '@/data';
  import { preferredMode, preferredType } from '@/userSettings';

  let username = $state('');
  let password = $state('');
  let isLoading = $state(false);

  let ezppLogo: HTMLImageElement | undefined = $state(undefined);

  const logo_mouseenter = () => {
    if (ezppLogo) {
      animate(ezppLogo, {
        duration: 700,
        scale: 1.2,
        ease: (t: number) => Math.pow(2, -5 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
      });
    }
  };

  const logo_mouseleave = () => {
    if (ezppLogo) {
      animate(ezppLogo, {
        duration: 700,
        scale: 1,
        ease: (t: number) => (t - 1) ** 7 + 1,
      });
    }
  };

  const performLogin = async () => {
    isLoading = true;

    try {
      const loginResult = await ezppfarm.login(username, password);
      if (loginResult && loginResult.user) {
        toast.success('Login successful!', {
          description: `Welcome back, ${loginResult.user.name}!`,
        });

        $userAuth.value('username').set(username);
        $userAuth.value('password').set(password);
        await $userAuth.save();

        currentUser.set(loginResult.user);
        currentView.set(Launch);
      } else {
        toast.error('Login failed!', {
          description: 'Please check your username and password.',
        });
        isLoading = false;
      }
    } catch {
      toast.error('Server error occurred during login.', {
        description: 'There was an issue connecting to the server. Please try again later.',
      });
      isLoading = false;
    }

    if ($currentUser) {
      const userInfo = await ezppfarm.getUserInfo($currentUser.id);
      if (userInfo) {
        currentUserInfo.set(userInfo.player);

        preferredMode.set(userInfo.player.info.preferred_mode);
        preferredType.set(userInfo.player.info.preferred_type);
      }
    }
  };
</script>

<div class="mt-[50px] h-[calc(100vh-50px)] w-full">
  <div class="w-full h-full flex flex-col items-center justify-center">
    <img
      src={Logo}
      alt="EZPPLauncher Logo"
      class="w-52 h-52 mb-2"
      bind:this={ezppLogo}
      onmouseenter={logo_mouseenter}
      onmouseleave={logo_mouseleave}
    />
    <form onsubmit={performLogin} class="w-full max-w-sm">
      <div class="mb-4">
        <Label for="username" class="block text-sm font-medium">Username</Label>
        <Input
          class="mt-4 w-full bg-theme-900 border-theme-800"
          type="text"
          id="username"
          bind:value={username}
          disabled={isLoading}
          autocomplete="off"
          autocorrect="off"
        />
      </div>
      <div class="mb-4">
        <Label for="password" class="block text-sm font-medium">Password</Label>
        <Input
          class="mt-4 w-full bg-theme-900 border-theme-800"
          type="password"
          id="password"
          bind:value={password}
          disabled={isLoading}
          autocomplete="off"
          autocorrect="off"
        />
      </div>
      <Button class="w-full" type="submit" disabled={isLoading}>
        {#if isLoading}
          <LoaderCircle class="animate-spin" />
        {:else}
          Login
        {/if}
      </Button>
    </form>
  </div>
</div>
