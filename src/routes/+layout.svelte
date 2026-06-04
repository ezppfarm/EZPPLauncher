<script lang="ts">
  import Logo from '$assets/logo.png';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import AnimatedBg from '$lib/components/ui/animated-bg/AnimatedBg.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import OsuCursor from '$lib/components/ui/osu-cursor/OsuCursor.svelte';
  import SileoToast from '$lib/components/ui/sileo/sileo-toast.svelte';
  import Titlebar from '$lib/components/ui/titlebar/titlebar.svelte';
  import { config } from '$lib/config';
  import { Config } from '$lib/config_old';
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
  } from '$lib/global';
  import { exit, getLauncherVersion, getPlatform } from '$lib/osuUtil';
  import * as presence from '$lib/presence';
  import { getDownloadableThemes, getThemes, loadTheme } from '$lib/themes';
  import { cursorSmoothening, customCursor, patch, reduceAnimations } from '$lib/userSettings';
  import { trackMediaContainer } from '$lib/utils';
  import '../app.css';
  import { Buffer } from 'buffer';
  import { SemVer } from 'semver';
  import { sileo } from 'sileo';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

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
        ((event.ctrlKey || event.metaKey) && event.key === 'r') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'f') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'g') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'j') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'p') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'u')
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

    const oldUserConfig = new Config('user_settings', false);
    const oldUserConfigExists = await oldUserConfig.init();
    if (oldUserConfigExists) {
      const oldUserConfigValues = oldUserConfig.values();
      if (Object.keys(oldUserConfigValues).length > 0) {
        await config.value<boolean>('setup_complete').set(true);

        for (const key in oldUserConfigValues) {
          const value = oldUserConfigValues[key];
          await config.value<typeof value>(key).set(value);
        }
      }
      await oldUserConfig.delete();
    }

    const oldUserAuth = new Config('user_auth', true);
    const oldUserAuthExists = await oldUserAuth.init();
    if (oldUserAuthExists) {
      const oldUserAuthValues = oldUserAuth.values();
      if (Object.keys(oldUserAuthValues).length > 0) {
        for (const key in oldUserAuthValues) {
          const value = oldUserAuthValues[key];
          await config.value<typeof value>(key).set(value);
        }
      }
      await oldUserAuth.delete();
    }

    const isSetupComplete = await config.value<boolean>('setup_complete').get(false);
    firstStartup.set(!isSetupComplete);

    currentLoadingInfo.set('Loading config...');
    const config_theme = config.value<string>('theme');
    const config_theme_volume = config.value<number>('volume');
    const config_patching = config.value<boolean>('patching');
    const config_custom_cursor = config.value<boolean>('custom_cursor');
    const config_cursor_smoothening = config.value<boolean>('cursor_smoothening');
    const config_reduce_animations = config.value<boolean>('reduce_animations');
    const config_discord_presence = config.value<boolean>('discord_presence');
    const config_tracking_enabled = config.value<boolean>('tracking_consent');
    const config_otd_enabled = config.value<boolean>('otd_enabled');
    const config_otd_path = config.value<string>('otd_path');

    const localThemes = await getThemes();
    const lastThemeName = await config_theme.get('Default');
    const last_theme = localThemes.find((t) => t.name === lastThemeName);
    if (!last_theme || $platform === 'linux') {
      await config.value<string>('theme').set('Default');
      loadTheme(localThemes[0], $custom_theme_container!, await config_theme_volume.get(0.15));
    } else {
      loadTheme(last_theme, $custom_theme_container!, await config_theme_volume.get(0.15));
    }

    custom_theme_volume.set(await config_theme_volume.get(0.15));
    patch.set(await config_patching.get(true));
    customCursor.set(await config_custom_cursor.get(true));
    cursorSmoothening.set(await config_cursor_smoothening.get(true));
    reduceAnimations.set(await config_reduce_animations.get(false));
    discordPresence.set(await config_discord_presence.get(true));
    openTabletDriverEnabled.set(await config_otd_enabled.get(false));
    openTabletDriverPath.set(await config_otd_path.get(''));
    if (await config_tracking_enabled.exists()) {
      trackingEnabled.set(await config_tracking_enabled.get(false));
    }

    patch.subscribe(async (val) => await config_patching.set(val));
    customCursor.subscribe(async (val) => await config_custom_cursor.set(val));
    cursorSmoothening.subscribe(async (val) => await config_cursor_smoothening.set(val));
    reduceAnimations.subscribe(async (val) => await config_reduce_animations.set(val));
    openTabletDriverEnabled.subscribe(async (val) => config_otd_enabled.set(val));

    discordPresence.subscribe(async (val) => {
      config_discord_presence.set(val);
      try {
        presenceLoading.set(true);

        if (val) await presence.connect();
        else await presence.disconnect();

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

      combinedThemes.sort((a, b) => {
        if (a.name === 'Default') return -1;
        if (b.name === 'Default') return 1;
        if (a.status === 'installed' && b.status !== 'installed') return -1;
        if (a.status !== 'installed' && b.status === 'installed') return 1;
        return a.name.localeCompare(b.name);
      });

      custom_themes.set(combinedThemes);
    } catch (err) {
      console.log(err);
      sileo.error({
        title: 'An error occured!',
        description: 'Failed to load themes',
      });
    }

    platform.set(await getPlatform());
    if ($platform !== 'windows' && $platform !== 'linux') unsupported_platform = true;
  });
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<style>${$active_custom_theme?.cssStyle || ''}</style>`}
</svelte:head>

{#if $customCursor}
  <OsuCursor smoothCursor={$cursorSmoothening} />
{/if}

<SileoToast
  position="top-center"
  options={{
    fill: '#181825',
    styles: {
      description: 'text-white/90 text-center!',
    },
  }}
/>

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
