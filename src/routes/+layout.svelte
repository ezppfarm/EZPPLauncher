<script lang="ts">
  import { browser } from '$app/environment';
  import Logo from '$assets/logo.png';
  import DiscordPresenceEditor from '$lib/components/presence/DiscordPresenceEditor.svelte';
  import ThemeEditorWindow from '$lib/components/theme/ThemeEditorWindow.svelte';
  import ThemeV2Background from '$lib/components/theme/ThemeV2Background.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import AnimatedBg from '$lib/components/ui/animated-bg/AnimatedBg.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import OsuCursor from '$lib/components/ui/osu-cursor/OsuCursor.svelte';
  import SileoToast from '$lib/components/ui/sileo/sileo-toast.svelte';
  import Titlebar from '$lib/components/ui/titlebar/titlebar.svelte';
  import { config } from '$lib/config';
  import { Config } from '$lib/config_old';
  import { currentUserInfo } from '$lib/data';
  import {
    active_custom_theme,
    currentLoadingInfo,
    custom_theme_container,
    custom_theme_volume,
    custom_themes,
    discordPresence,
    firstStartup,
    launcherVersion,
    onlineFriends,
    openTabletDriverEnabled,
    openTabletDriverPath,
    osuBuild,
    osuStream,
    platform,
    presenceLoading,
    serverPing,
    setupValues,
    theme_reload_token,
    trackingEnabled,
  } from '$lib/global';
  import { initLogging } from '$lib/logging';
  import { exit, getLauncherVersion, getPlatform, setLoggingEnabled } from '$lib/osuUtil';
  import * as presence from '$lib/presence';
  import {
    smoothThemeMedia,
    themeMediaPreparing,
    themeMediaStatus,
    themeMediaSuspended,
    themeMediaSuspension,
  } from '$lib/themeMedia';
  import { isThemeTrusted } from '$lib/themeTrust';
  import { themeV2Css } from '$lib/themeV2';
  import { getDownloadableThemes, getThemes, loadTheme } from '$lib/themes';
  import { currentUser } from '$lib/userAuthentication';
  import {
    cursorSmoothening,
    customCursor,
    loggingEnabled,
    patch,
    reduceAnimations,
  } from '$lib/userSettings';
  import { trackMediaContainer } from '$lib/utils';
  import '../app.css';
  import { Sparkles } from '@lucide/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { emit, listen } from '@tauri-apps/api/event';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { Buffer } from 'buffer';
  import { SemVer } from 'semver';
  import { sileo } from 'sileo';
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fade } from 'svelte/transition';

  let { children } = $props();

  let unlistenEditorState: (() => void) | undefined;
  let unlistenRequestEditorData: (() => void) | undefined;
  let unlistenPresenceEditorState: (() => void) | undefined;
  onDestroy(() => {
    unlistenEditorState?.();
    unlistenRequestEditorData?.();
    unlistenPresenceEditorState?.();
  });

  if (browser) initLogging();

  const editorWindow = (() => {
    if (!browser) return false;
    try {
      return getCurrentWindow().label === 'theme-editor';
    } catch {
      return false;
    }
  })();

  const presenceEditorWindow = (() => {
    if (!browser) return false;
    try {
      return getCurrentWindow().label === 'presence-editor';
    } catch {
      return false;
    }
  })();

  let unsupported_platform = $state<boolean>(false);
  let editorOpen = $state(false);
  let presenceEditorOpen = $state(false);

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
    try {
      const ver = await getLauncherVersion();
      if (ver) launcherVersion.set(ver);
    } catch {
      // ignore
    }

    if (editorWindow || presenceEditorWindow) return;

    // The editor is a separate WebView, so the launcher cannot observe its
    // focus directly. Native code emits this state when the window is created
    // or destroyed, and the launcher pauses its own theme media while it is
    // open so both previews cannot play over each other.
    const syncThemeEditorData = async () => {
      try {
        await emit('sync-theme-editor-global-data', {
          user: get(currentUser),
          info: get(currentUserInfo),
          friends: get(onlineFriends),
          osuBuild: get(osuBuild),
          osuStream: get(osuStream),
          serverPing: get(serverPing),
          launcherVersion: get(launcherVersion),
        });
      } catch {}
    };

    try {
      unlistenRequestEditorData = await listen('request-theme-editor-global-data', () => {
        syncThemeEditorData();
      });
    } catch (error) {
      console.warn('Could not listen for theme editor data requests', error);
    }

    try {
      unlistenEditorState = await listen<boolean>('theme-editor-state', (event) => {
        const isOpen = event.payload === true;
        themeMediaSuspended.set(isOpen);
        editorOpen = isOpen;
        if (isOpen) syncThemeEditorData();
      });
      if (await WebviewWindow.getByLabel('theme-editor')) {
        themeMediaSuspended.set(true);
        editorOpen = true;
        syncThemeEditorData();
      }
    } catch (error) {
      console.warn('Could not sync the theme editor media state', error);
    }

    try {
      unlistenPresenceEditorState = await listen<boolean>('presence-editor-state', (event) => {
        const isOpen = event.payload === true;
        presenceEditorOpen = isOpen;
        if (isOpen) syncThemeEditorData();
      });
      if (await WebviewWindow.getByLabel('presence-editor')) {
        presenceEditorOpen = true;
        syncThemeEditorData();
      }
    } catch (error) {
      console.warn('Could not sync the presence editor state', error);
    }

    window.Buffer = Buffer;

    disableReload();
    setupValues();
    launcherVersion.set(await getLauncherVersion());

    const currentPlatform = await getPlatform();
    platform.set(currentPlatform);
    if (!['windows', 'linux', 'macos'].includes(currentPlatform)) unsupported_platform = true;

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
    const config_logging_enabled = config.value<boolean>('logging_enabled');
    const config_discord_presence = config.value<boolean>('discord_presence');
    const config_tracking_enabled = config.value<boolean>('tracking_consent');
    const config_otd_enabled = config.value<boolean>('otd_enabled');
    const config_otd_path = config.value<string>('otd_path');

    const localThemes = await getThemes();
    const lastThemeName = await config_theme.get('Default');
    const defaultTheme = localThemes.find((t) => t.name === 'Default') ?? localThemes[0];
    const last_theme = localThemes.find((t) => t.name === lastThemeName);
    const canLoadLastTheme = Boolean(last_theme && isThemeTrusted(last_theme));

    if (!last_theme || !canLoadLastTheme) {
      await config.value<string>('theme').set('Default');
      loadTheme(defaultTheme, $custom_theme_container!, await config_theme_volume.get(0.15));
      if (last_theme && !canLoadLastTheme) {
        sileo.error({
          title: 'Theme needs approval',
          description:
            'The last theme runs executable code and has not been trusted on this device. The default theme was loaded instead.',
        });
      }
    } else {
      loadTheme(last_theme, $custom_theme_container!, await config_theme_volume.get(0.15));
    }

    custom_theme_volume.set(await config_theme_volume.get(0.15));
    patch.set(await config_patching.get(true));
    customCursor.set(await config_custom_cursor.get(true));
    cursorSmoothening.set(await config_cursor_smoothening.get(true));
    reduceAnimations.set(await config_reduce_animations.get(false));
    loggingEnabled.set(await config_logging_enabled.get(true));
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
    loggingEnabled.subscribe(async (val) => {
      await config_logging_enabled.set(val);
      await setLoggingEnabled(val);
    });
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
  });
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<style>${$active_custom_theme?.cssStyle || ''}</style>`}
  {#if $active_custom_theme?.definition}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html `<style>${themeV2Css(
      $active_custom_theme.definition,
      $active_custom_theme.assets
    )}</style>`}
  {/if}
</svelte:head>

<SileoToast
  position="top-center"
  options={{
    fill: '#181825',
    styles: {
      description: 'text-white/90 text-center!',
    },
  }}
/>

{#if editorWindow}
  <ThemeEditorWindow />
{:else if presenceEditorWindow}
  <DiscordPresenceEditor standalone />
{:else}
  {#if editorOpen}
    <div
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-6 text-center select-none backdrop-blur-md"
    >
      <div
        class="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/20 text-primary ring-1 ring-inset ring-white/10"
      >
        <Sparkles class="size-7" />
      </div>
      <h2 class="text-base font-semibold text-white">Theme editor is open</h2>
      <p class="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        The launcher is locked while editing themes. Finish your changes or close the editor to
        resume.
      </p>
      <div class="mt-5 flex items-center gap-2.5">
        <Button class="h-8 gap-1.5 px-3 text-xs" onclick={() => invoke('focus_theme_editor')}>
          Bring Editor to Front
        </Button>
        <Button
          variant="secondary"
          class="h-8 px-3 text-xs"
          onclick={() => invoke('close_theme_editor')}
        >
          Close Editor
        </Button>
      </div>
    </div>
  {:else if presenceEditorOpen}
    <div
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-6 text-center select-none backdrop-blur-md"
    >
      <div
        class="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#5865F2]/20 text-[#5865F2] ring-1 ring-inset ring-[#5865F2]/30"
      >
        <svg class="size-7 fill-current" viewBox="0 0 24 24">
          <path
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          />
        </svg>
      </div>
      <h2 class="text-base font-semibold text-white">Discord Rich Presence editor is open</h2>
      <p class="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        The launcher is locked while editing your Rich Presence embed. Finish your changes or close
        the editor to resume.
      </p>
      <div class="mt-5 flex items-center gap-2.5">
        <Button class="h-8 gap-1.5 px-3 text-xs" onclick={() => invoke('focus_presence_editor')}>
          Bring Editor to Front
        </Button>
        <Button
          variant="secondary"
          class="h-8 px-3 text-xs"
          onclick={() => invoke('close_presence_editor')}
        >
          Close Editor
        </Button>
      </div>
    </div>
  {/if}

  {#if $customCursor}
    <OsuCursor smoothCursor={$cursorSmoothening} />
  {/if}

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

  <main use:themeMediaSuspension>
    <div class:hidden={!!$active_custom_theme?.definition}>
      <div class="opacity-30">
        <div transition:fade={{ duration: $reduceAnimations ? 0 : 500 }}>
          <div
            class={$active_custom_theme && $active_custom_theme.name === 'Default'
              ? 'hidden'
              : 'absolute z-0 top-0 left-0 w-full h-full object-cover object-center aspect-video'}
            bind:this={$custom_theme_container}
            use:trackMediaContainer
            use:smoothThemeMedia
          ></div>
          {#if ($active_custom_theme && $active_custom_theme.name === 'Default') || !$active_custom_theme}
            <AnimatedBg />
          {/if}
        </div>
      </div>
    </div>
    {#if $active_custom_theme?.definition}
      <div class="absolute inset-0 z-0">
        {#key $theme_reload_token}
          <ThemeV2Background
            definition={$active_custom_theme.definition}
            assets={$active_custom_theme.assets}
          />
        {/key}
      </div>
    {/if}
    {@render children()}
  </main>

  {#if $themeMediaPreparing}
    <div
      class="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-xs font-medium text-white/80 shadow-xl backdrop-blur animate-pulse"
    >
      {$themeMediaStatus || 'Preparing theme video for smooth playback…'}
    </div>
  {/if}
{/if}
