<script lang="ts">
  import Logo from '$assets/logo.png';
  import NyanCatSong from '$assets/nyan-cat.mp3';
  import '../app.css';

  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import {
    currentLoadingInfo,
    discordPresence,
    firstStartup,
    launcherVersion,
    nyanCatSong,
    platform,
    presenceLoading,
    setupValues,
    trackingEnabled,
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
  import SileoToast from '@/components/ui/sileo/sileo-toast.svelte';
  import { userAuth } from '@/userAuthentication';
  import { exit, getLauncherVersion, getPlatform } from '@/osuUtil';
  import Button from '@/components/ui/button/button.svelte';
  import * as presence from '@/presence';
  import { fade } from 'svelte/transition';

  import '@fontsource/sora';
  import '@fontsource/space-mono';
  import AnimatedBg from '@/components/ui/animated-bg/AnimatedBg.svelte';
  import NyanCatBg from '@/components/ui/animated-bg/NyanCatBg.svelte';
  import { sileo } from 'sileo';

  let { children } = $props();

  let unsupported_platform = $state<boolean>(false);
  let secret_enabled = $state<boolean>(false);

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

  let konami_code = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];

  onMount(async () => {
    window.Buffer = Buffer;

    disableReload();
    setupValues();
    launcherVersion.set(await getLauncherVersion());
    platform.set(await getPlatform());
    if ($platform !== 'windows' && $platform !== 'linux') unsupported_platform = true;
    const isFirstStartup = await $userSettings.init();
    firstStartup.set(isFirstStartup);
    $userAuth.init();

    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === konami_code[0].toLowerCase()) {
        konami_code.shift();
        if (konami_code.length === 0) {
          if (secret_enabled) {
            sileo.success({
              title: 'Cheatcode deactivated!',
              duration: 3000,
              fill: '#181825',
              styles: {
                description: 'text-center!',
              },
            });
            const audio = $nyanCatSong;
            if (audio) {
              const fadeOutDuration = 2000; // 2 seconds
              const fadeOutSteps = 20;
              const fadeOutStepTime = fadeOutDuration / fadeOutSteps;
              const volumeStep = audio.volume / fadeOutSteps;

              const fadeOutInterval = setInterval(() => {
                if (audio.volume > 0) {
                  audio.volume = Math.max(0, audio.volume - volumeStep);
                } else {
                  audio.pause();
                  clearInterval(fadeOutInterval);
                }
              }, fadeOutStepTime);
            }
            nyanCatSong.set(undefined);
            secret_enabled = false;
            konami_code = [
              'ArrowUp',
              'ArrowUp',
              'ArrowDown',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
              'ArrowLeft',
              'ArrowRight',
              'b',
              'a',
            ];
            return;
          }
          sileo.success({
            title: 'Cheatcode activated!',
            duration: 3000,
            fill: '#181825',
            styles: {
              description: 'text-center!',
            },
          });
          const audio = new Audio(NyanCatSong);
          audio.loop = true;
          audio.volume = 0;
          audio.play();
          const fadeInVolume = 0.15;
          const fadeInDuration = 2000; // 2 seconds
          const fadeInSteps = 20;
          const fadeInStepTime = fadeInDuration / fadeInSteps;
          const volumeStep = (fadeInVolume - audio.volume) / fadeInSteps;

          const fadeInInterval = setInterval(() => {
            if (audio.volume < fadeInVolume) {
              audio.volume = Math.min(fadeInVolume, audio.volume + volumeStep);
            } else {
              clearInterval(fadeInInterval);
            }
          }, fadeInStepTime);
          nyanCatSong.set(audio);

          secret_enabled = true;
          konami_code = [
            'ArrowUp',
            'ArrowUp',
            'ArrowDown',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'ArrowLeft',
            'ArrowRight',
            'b',
            'a',
          ];
        }
      } else {
        konami_code = [
          'ArrowUp',
          'ArrowUp',
          'ArrowDown',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ArrowLeft',
          'ArrowRight',
          'b',
          'a',
        ];
      }
    });

    currentLoadingInfo.set('Loading config...');
    const config_patching = $userSettings.value('patching');
    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');
    const config_reduce_animations = $userSettings.value('reduce_animations');
    const config_osu_installation_path = $userSettings.value('osu_installation_path');
    const config_discord_presence = $userSettings.value('discord_presence');
    const config_tracking_enabled = $userSettings.value('tracking_consent');

    patch.set(config_patching.get(true));
    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));
    reduceAnimations.set(config_reduce_animations.get(false));
    osuInstallationPath.set(config_osu_installation_path.get(''));
    discordPresence.set(config_discord_presence.get(true));
    if (config_tracking_enabled.exists()) {
      trackingEnabled.set(config_tracking_enabled.get(false));
    }

    patch.subscribe((val) => config_patching.set(val));
    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
    reduceAnimations.subscribe((val) => config_reduce_animations.set(val));
    discordPresence.subscribe(async (val) => {
      config_discord_presence.set(val);
      try {
        presenceLoading.set(true);
        if (val) {
          await presence.connect();
        } else {
          await presence.disconnect();
        }
        presenceLoading.set(false);
      } catch {}
    });

    try {
      if ($discordPresence) {
        currentLoadingInfo.set('Connecting to Discord RPC...');
        presenceLoading.set(true);
        await presence.connect();
        presenceLoading.set(false);
      }
    } catch {}
  });
</script>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<SileoToast position="top-center" fill="black" />

<Titlebar />

<AlertDialog.Root open={unsupported_platform}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Unsupported Platform!</span>
    </div>
    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      This Platform is not supported by EZPPLauncher.
    </div>
    <div class="flex items-center justify-center mb-3">
      <Button
        onclick={async () => {
          await exit();
        }}>Close</Button
      >
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<main>
  <div class="opacity-30">
    {#if secret_enabled}
      <div transition:fade={{ duration: $reduceAnimations ? 0 : 500 }}>
        <NyanCatBg />
      </div>
    {:else}
      <div transition:fade={{ duration: $reduceAnimations ? 0 : 500 }}>
        <AnimatedBg />
      </div>
    {/if}
  </div>
  {@render children()}
</main>
