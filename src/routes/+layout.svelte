<script lang="ts">
  import Logo from '$assets/logo.png';
  import '../app.css';

  import Titlebar from '@/components/ui/titlebar/titlebar.svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import {
    active_custom_theme,
    currentLoadingInfo,
    custom_theme_container,
    custom_theme_volume,
    custom_themes,
    discordPresence,
    firstStartup,
    launcherVersion,
    openTabletDriverEnabled,
    openTabletDriverPath,
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
  import { getDownloadableThemes, getThemes, loadTheme } from '@/themes';
  import { sileo } from 'sileo';
  import AnimatedBg from '@/components/ui/animated-bg/AnimatedBg.svelte';
  import { SemVer } from 'semver';
  import { trackMediaContainer } from '@/utils';

  let { children } = $props();

  let unsupported_platform = $state<boolean>(false);

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
    firstStartup.set(isFirstStartup);
    $userAuth.init();

    currentLoadingInfo.set('Loading config...');
    const config_theme = $userSettings.value('theme');
    const config_theme_volume = $userSettings.value('volume');
    const config_patching = $userSettings.value('patching');
    const config_custom_cursor = $userSettings.value('custom_cursor');
    const config_cursor_smoothening = $userSettings.value('cursor_smoothening');
    const config_reduce_animations = $userSettings.value('reduce_animations');
    const config_osu_installation_path = $userSettings.value('osu_installation_path');
    const config_discord_presence = $userSettings.value('discord_presence');
    const config_tracking_enabled = $userSettings.value('tracking_consent');
    const config_otd_enabled = $userSettings.value('otd_enabled');
    const config_otd_path = $userSettings.value('otd_path');

    const localThemes = await getThemes();
    const last_theme = localThemes.find((t) => t.name === config_theme.get('Default'));
    if (!last_theme) {
      $userSettings.value('theme').set('Default');
      await $userSettings.save();
      loadTheme(localThemes[0], $custom_theme_container!, config_theme_volume.get(0.15));
    } else {
      loadTheme(last_theme, $custom_theme_container!, config_theme_volume.get(0.15));
    }

    custom_theme_volume.set(config_theme_volume.get(0.15));
    patch.set(config_patching.get(true));
    customCursor.set(config_custom_cursor.get(true));
    cursorSmoothening.set(config_cursor_smoothening.get(true));
    reduceAnimations.set(config_reduce_animations.get(false));
    osuInstallationPath.set(config_osu_installation_path.get(''));
    discordPresence.set(config_discord_presence.get(true));
    openTabletDriverEnabled.set(config_otd_enabled.get(false));
    openTabletDriverPath.set(config_otd_path.get(''));
    if (config_tracking_enabled.exists()) {
      trackingEnabled.set(config_tracking_enabled.get(false));
    }

    patch.subscribe((val) => config_patching.set(val));
    customCursor.subscribe((val) => config_custom_cursor.set(val));
    cursorSmoothening.subscribe((val) => config_cursor_smoothening.set(val));
    reduceAnimations.subscribe((val) => config_reduce_animations.set(val));
    openTabletDriverEnabled.subscribe((val) => config_otd_enabled.set(val));

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
      } catch (err) {
        console.log(err);
        presenceLoading.set(false);
      }
    });

    try {
      if ($discordPresence) {
        currentLoadingInfo.set('Connecting to Discord RPC...');
        presenceLoading.set(true);
        await presence.connect();
        presenceLoading.set(false);
      }
    } catch (err) {
      console.log(err);
      presenceLoading.set(false);
    }

    try {
      currentLoadingInfo.set('Loading themes...');
      const downloadableThemes = await getDownloadableThemes();
      const combinedThemes = [...localThemes];
      for (const theme of downloadableThemes) {
        if (!combinedThemes.find((t) => t.name === theme.name)) combinedThemes.push(theme);
        const installedTheme = localThemes.find((t) => t.name === theme.name);
        if (installedTheme) {
          const installedThemeVersion = new SemVer(installedTheme.version);
          const downloadableThemeVersion = new SemVer(theme.version);
          if (downloadableThemeVersion.compare(installedThemeVersion) > 0) {
            installedTheme.updateAvailable = true;
            const index = combinedThemes.findIndex((t) => t.name === theme.name);
            combinedThemes[index] = installedTheme;
          }
        }
      }

      custom_themes.set(combinedThemes);
    } catch (err) {
      console.log(err);
      sileo.error({
        title: 'An error occured!',
        description: 'Failed to load themes',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });
    }

    platform.set(await getPlatform());
    if ($platform !== 'windows' && $platform !== 'linux') unsupported_platform = true;
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
    <div transition:fade={{ duration: $reduceAnimations ? 0 : 500 }}>
      <div
        class={$active_custom_theme && $active_custom_theme.name === 'Default'
          ? 'hidden'
          : 'absolute z-0 top-0 left-0 w-full h-full object-cover object-center aspect-video'}
        bind:this={$custom_theme_container}
        use:trackMediaContainer
      ></div>
      {#if ($active_custom_theme && $active_custom_theme.name === 'Default') || !$active_custom_theme}
        <AnimatedBg />
      {/if}
    </div>
  </div>
  {@render children()}
</main>
