<script lang="ts">
  import '../app.css';
  import Logo from '$assets/logo.png';

  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import {
    currentLoadingInfo,
    firstStartup,
    launcherVersion,
    newVersion,
    setupValues,
  } from '@/global';
  import { onMount } from 'svelte';
  import OsuCursor from '@/components/ui/osu-cursor/OsuCursor.svelte';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    patch,
    reduceAnimations,
    userSettings,
  } from '@/userSettings';
  import { Buffer } from 'buffer';
  import { Toaster } from '@/components/ui/sonner';
  import { userAuth } from '@/userAuthentication';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import { exit, getLauncherVersion } from '@/osuUtil';

  import '@fontsource/sora';
  import '@fontsource/space-mono';
  import { ArrowRight } from 'lucide-svelte';
  import Button from '@/components/ui/button/button.svelte';
  import { openURL } from '@/utils';

  let { children } = $props();

  function disableReload() {
    if (window.location.hostname !== 'tauri.localhost') {
      return;
    }
    document.addEventListener('keydown', function (event) {
      if (
        event.key === 'F3' ||
        event.key === 'F5' ||
        event.key === 'F7' ||
        event.key === 'F8' ||
        event.key === 'F10' ||
        event.key === 'F12' ||
        (event.ctrlKey && event.key === 'r') ||
        (event.metaKey && event.key === 'r') ||
        (event.ctrlKey && event.key === 'f') ||
        (event.metaKey && event.key === 'f') ||
        (event.ctrlKey && event.key === 'g') ||
        (event.metaKey && event.key === 'g') ||
        (event.ctrlKey && event.key === 'j') ||
        (event.metaKey && event.key === 'j') ||
        (event.ctrlKey && event.key === 'p') ||
        (event.metaKey && event.key === 'p') ||
        (event.ctrlKey && event.key === 'u') ||
        (event.metaKey && event.key === 'u')
      ) {
        event.preventDefault();
      }
    });

    document.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );

    document.addEventListener(
      'selectstart',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );
  }

  onMount(async () => {
    window.Buffer = Buffer;

    disableReload();
    setupValues();
    launcherVersion.set(await getLauncherVersion());
    const isFirstStartup = await $userSettings.init();
    $userAuth.init();

    currentLoadingInfo.set('Loading config...');
    const config_patching = $userSettings.value('patching');
    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');
    const config_reduce_animations = $userSettings.value('reduce_animations');
    const config_osu_installation_path = $userSettings.value('osu_installation_path');

    patch.set(config_patching.get(true));
    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));
    reduceAnimations.set(config_reduce_animations.get(false));
    osuInstallationPath.set(config_osu_installation_path.get(''));

    patch.subscribe((val) => config_patching.set(val));
    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
    reduceAnimations.subscribe((val) => config_reduce_animations.set(val));

    firstStartup.set(isFirstStartup);
  });
</script>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<Toaster richColors closeButton />

<Titlebar />

<AlertDialog.Root open={$newVersion !== undefined}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Update available!</span>
    </div>
    <div
      class="grid grid-cols-3 items-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      <div class="flex flex-col items-center justify-center">
        <span class="text-sm text-muted-foreground">Current Version</span>
        <span>{$launcherVersion}</span>
      </div>
      <div class="flex items-center justify-center">
        <ArrowRight />
      </div>
      <div class="flex flex-col items-center justify-center">
        <span class="text-sm text-muted-foreground">New Version</span>
        <span class="text-green-400">{$newVersion?.tag_name}</span>
      </div>
    </div>
    <div class="flex items-center justify-center mb-3">
      <Button
        onclick={async () => {
          if ($newVersion) {
            await openURL($newVersion.html_url);
            await exit();
          }
        }}>Update now</Button
      >
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<main>
  {@render children()}
</main>
