<script lang="ts">
  import Logo from '$assets/logo.png';
  import DefaultThemePreview from '$assets/default_preview.png';
  import * as Avatar from '@/components/ui/avatar';
  import Badge from '@/components/ui/badge/badge.svelte';
  import Button from '@/components/ui/button/button.svelte';
  import * as Select from '@/components/ui/select';
  import {
    active_custom_theme,
    beatmapSets,
    currentSkin,
    custom_theme_container,
    custom_theme_volume,
    custom_themes,
    discordPresence,
    launcherStream,
    launcherStreams,
    launcherVersion,
    launching,
    newVersion,
    osuBuild,
    osuStream,
    platform,
    presenceLoading,
    serverConnectionFails,
    serverPing,
    skins,
    skinsCount,
    trackingEnabled,
  } from '@/global';
  import {
    LoaderCircle,
    Music,
    Wifi,
    WifiOff,
    Drum,
    Cherry,
    Piano,
    Circle,
    LogOut,
    LogIn,
    Brush,
    ArrowRight,
    Settings,
    House,
    Paintbrush,
    Trash,
    CloudDownload,
    Import,
  } from 'lucide-svelte';
  import NumberFlow from '@number-flow/svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import Progress from '@/components/ui/progress/progress.svelte';
  import {
    compareBuildNumbers,
    fadeGlobalVolume,
    formatBytes,
    numberHumanReadable,
    openURL,
    pauseGlobalMedia,
    releaseStreamToReadable,
    resumeGlobalMedia,
    setCurrentTimeGlobalMedia,
    urlIsValidImage,
  } from '@/utils';
  import { fade, fly, scale } from 'svelte/transition';
  import { Checkbox } from '@/components/ui/checkbox';
  import Label from '@/components/ui/label/label.svelte';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    patch,
    preferredMode,
    preferredType,
    reduceAnimations,
    userSettings,
  } from '@/userSettings';
  import Input from '@/components/ui/input/input.svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { currentUser, userAuth } from '@/userAuthentication';
  import {
    getGamemodeInt,
    getGamemodeName,
    getModeAndTypeFromGamemode,
    modeIntToStr,
    typeIntToStr,
    validModeTypeCombinationsSorted,
  } from '@/gamemode';
  import { currentUserInfo } from '@/data';
  import { osuapi } from '@/api/osuapi';
  import {
    downloadEZPPLauncherUpdateFiles,
    downloadUpdate,
    encryptString,
    exit,
    getBeatmapSetsCount,
    getEZPPLauncherUpdateFiles,
    getReleaseStream,
    getSkin,
    getSkins,
    getVersion,
    hasNet8,
    hasOsuWinello,
    hasWMCTRL,
    installUpdate,
    isOsuCorrupted,
    isOsuRunning,
    isValidOsuFolder,
    replaceUIFiles,
    runOsu,
    runUpdater,
    setConfigValues,
    setUserConfigValues,
  } from '@/osuUtil';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { ezppfarm } from '@/api/ezpp';
  import { EZPPActionStatus } from '@/types';
  import * as presence from '@/presence';
  import { onMount } from 'svelte';
  import * as DropdownMenu from '@/components/ui/dropdown-menu';
  import DownloadButton from '@/components/ui/download-button/DownloadButton.svelte';
  import { animate } from 'animejs';
  import { sileo } from 'sileo';
  import ScrollContainer from '@/components/ui/scroll-container/ScrollContainer.svelte';
  import {
    checkThemeFromFile,
    deleteTheme,
    downloadTheme,
    importThemeFromFile,
    loadTheme,
    type ThemeInfo,
  } from '@/themes';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { useDropZone } from '@/dropZone.svelte';

  let selectedView = $state('home');
  let progress = $state(-1);
  let launchInfo = $state('');
  let launchError = $state<Error | undefined>(undefined);
  let ezppLogo: HTMLImageElement;

  let askForTrackingPermission = $state(false);

  let downloadingUpdate = $state(false);

  let dragAndDrop = useDropZone({
    onDrop: async (file) => {
      const firstFile = file[0];
      if (!firstFile.endsWith('.ezpplauncher-theme')) {
        sileo.error({
          title: 'Uhh...',
          description: 'Dropped file is not a valid theme file.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        return;
      }
      const importResult = await checkThemeFromFile(firstFile);
      if (!importResult.success || !importResult.themeInfo) {
        sileo.error({
          title: 'Hmmm...',
          description: importResult.error || 'An unknown error occurred.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        return;
      }
      droppedTheme = {
        filePath: firstFile,
        themeInfo: importResult.themeInfo,
      };
    },
  });
  let droppedTheme = $state<
    | {
        filePath: string;
        themeInfo: ThemeInfo;
      }
    | undefined
  >(undefined);
  let themeInstalling = $state(false);

  let downloadingEZPPFiles = $state(false);
  let cleanup = $state(false);

  let selectedGamemode = $derived(
    getGamemodeInt(modeIntToStr($preferredMode), typeIntToStr($preferredType))
  );
  let selectedMode = $derived(getModeAndTypeFromGamemode(selectedGamemode).mode);
  let selectedType = $derived(getModeAndTypeFromGamemode(selectedGamemode).type);

  const updateGamemode = (newGamemode: string) => {
    selectedGamemode = Number(newGamemode);
  };

  const browse_osu_installation = async () => {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Select osu! Installation Folder',
    });

    if (typeof selectedPath === 'string') {
      if (selectedPath === $osuInstallationPath) {
        return;
      }
      const validFolder = await isValidOsuFolder(selectedPath);
      if (!validFolder) {
        sileo.error({
          title: 'Hmm...',
          description:
            'The selected folder is not a valid osu! installation folder. Please select the correct folder.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        return;
      }
      osuInstallationPath.set(selectedPath);
      $userSettings.value('osu_installation_path').set(selectedPath);
      $userSettings.save();
      sileo.success({
        title: 'Yay!',
        description: 'osu! installation path set successfully.',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });

      const beatmapSetCount = await getBeatmapSetsCount(selectedPath);
      if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

      const skins_list = await getSkins(selectedPath);
      if (skins_list) {
        skins.set(skins_list);
        skinsCount.set(skins_list.length);
      }

      const skin: string = await getSkin(selectedPath);
      currentSkin.set(skin);

      const osuReleaseStream = await getReleaseStream($osuInstallationPath);
      osuStream.set(osuReleaseStream);
      const osuVersion = await getVersion($osuInstallationPath);
      osuBuild.set(osuVersion);
    }
  };

  const launch = async () => {
    if ($launching) return;
    launchInfo = 'Checking if osu! is already running...';
    launching.set(true);
    if ($trackingEnabled) umami.track('app_launch_osu');
    const osuRunning = await isOsuRunning();
    if (osuRunning) {
      sileo.error({
        title: 'Hold on a second!',
        description:
          'osu! is currently running, please exit osu! before launching via EZPPLauncher!',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });
      launching.set(false);
      return;
    }
    launchInfo = 'Checking osu! installation...';
    if (!$osuBuild) {
      sileo.error({
        title: 'Hmmm...',
        description: 'There was an issue detecting your installed osu! version',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });
      launching.set(false);
      return;
    }
    const osuPath = $osuInstallationPath;

    launchInfo = 'Validating osu! installation...';

    const validFolder = await isValidOsuFolder(osuPath);
    if (!validFolder) {
      sileo.error({
        title: 'Hmmm...',
        description: 'Your selected osu! installation folder is not valid.',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });
      launching.set(false);
      return;
    }

    if ($platform === 'linux') {
      if (!(await hasWMCTRL())) {
        sileo.error({
          title: 'Hmmm...',
          description: 'wmctrl seems to be missing, please install via AUR.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        return;
      }
      if (!(await hasOsuWinello())) {
        sileo.error({
          title: 'Hmmm...',
          description: 'osu-winello seems to be missing, please install it.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        return;
      }
    }

    try {
      launchInfo = 'Looking for file updates...';
      const updateResult = await getEZPPLauncherUpdateFiles(osuPath, $launcherStream);

      if (updateResult) {
        if (updateResult.filesToDownload.length > 0) {
          downloadingEZPPFiles = true;
          launchInfo = 'Found file updates!';
          await new Promise((res) => setTimeout(res, 1000));
          await downloadEZPPLauncherUpdateFiles(
            osuPath,
            updateResult.filesToDownload,
            updateResult.updateFiles,
            (file) => {
              progress = file.progress;
              launchInfo = `${file.fileName}(${formatBytes(
                file.downloaded
              )}/${formatBytes(file.size)})...`;
            }
          );
          progress = -1;
          downloadingEZPPFiles = false;
        } else {
          launchInfo = 'EZPPLauncher Files are up to date!';
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    } catch (err) {
      launchError = err as Error;
      launching.set(false);
      return;
    }

    try {
      const streamInfo = await osuapi.latestBuildVersion('stable40');
      if (!streamInfo) {
        sileo.error({
          title: 'Hmmm...',
          description: 'Failed to check for updates, maybe osu! is down?',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        return;
      }

      const releaseStream = await getReleaseStream(osuPath);

      if (releaseStream === undefined) {
        sileo.error({
          title: 'Hmmm...',
          description: 'Failed to get osu! release stream.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        return;
      }

      // only stable osu! release streams are supported for now
      if (!releaseStream.toLowerCase().includes('stable')) {
        sileo.error({
          title: 'Hmmm...',
          description: 'You are not on the stable release stream, please switch to it.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        return;
      }

      const osuCorrupted = await isOsuCorrupted(osuPath);
      let forceUpdate =
        (releaseStream && releaseStream.toLowerCase() !== 'stable40') || osuCorrupted;

      const versions = compareBuildNumbers($osuBuild, streamInfo);
      if (versions > 0 || forceUpdate) {
        launchInfo = 'Update found!';
        await new Promise((res) => setTimeout(res, 1500));
        launchInfo = 'Running osu! updater...';
        await setUserConfigValues(osuPath, [
          {
            key: 'LastVersion',
            value: `b${streamInfo}`,
          },
        ]);
        await setConfigValues(osuPath, [
          {
            key: '_ReleaseStream',
            value: 'Stable40',
          },
        ]);
        osuStream.set('Stable40');
        osuBuild.set(`b${streamInfo}`);
        await runUpdater(osuPath);
        launchInfo = 'osu! is now up to date!';
        if (forceUpdate)
          await setConfigValues(osuPath, [
            {
              key: '_UpdateFailCount',
              value: '0',
            },
          ]);
      } else {
        launchInfo = 'You are up to date!';
      }
      if ($currentUser) {
        const username = $userAuth.value('username').get('');
        const password = $userAuth.value('password').get('');
        if (username.length > 0 && password.length > 0) {
          await setUserConfigValues(osuPath, [
            {
              key: 'Username',
              value: username,
            },
            {
              key: 'Password',
              value:
                $platform === 'windows'
                  ? await encryptString(password, 'cu24180ncjeiu0ci1nwui')
                  : password,
            },
            {
              key: 'SaveUsername',
              value: '1',
            },
            {
              key: 'SavePassword',
              value: '1',
            },
            {
              key: 'CredentialEndpoint',
              value: 'ez-pp.farm',
            },
          ]);
        }
      } else {
        await setUserConfigValues(osuPath, [
          {
            key: 'Username',
            value: '',
          },
          {
            key: 'Password',
            value: '',
          },
          {
            key: 'SaveUsername',
            value: '1',
          },
          {
            key: 'SavePassword',
            value: '0',
          },
          {
            key: 'CredentialEndpoint',
            value: 'ez-pp.farm',
          },
        ]);
      }
      await new Promise((res) => setTimeout(res, 1500));
      launchInfo = 'Launching osu!...';

      fadeGlobalVolume($custom_theme_volume, 0, 2000, pauseGlobalMedia);

      await replaceUIFiles(osuPath, false);
      await new Promise((res) => setTimeout(res, 1000));
      await getCurrentWindow().hide();

      let presenceUpdater: number | undefined = undefined;

      const isPresenceConnected = await presence.isConnected();

      if ($discordPresence && isPresenceConnected) {
        let osuDetected = false;
        presenceUpdater = window.setInterval(async () => {
          if (!osuDetected) {
            const osuRunning = await isOsuRunning();
            if (osuRunning) osuDetected = true;
            return;
          }
          if ($currentUser) {
            const userStats = await ezppfarm.getUserInfo($currentUser.id, 'stats');
            const userStatus = await ezppfarm.getUserStatus($currentUser.id);
            if (userStatus?.player_status.online) {
              let largeImageKey = 'ezppfarm';
              let details = 'Idle...';
              let customButton: { text?: string; url?: string } = {
                text: undefined,
                url: undefined,
              };
              let state =
                userStatus.player_status.status.info_text.length > 0
                  ? userStatus.player_status.status.info_text
                  : '  ';

              const gamemode = getModeAndTypeFromGamemode(userStatus.player_status.status.mode);
              const gamemodeName = getGamemodeName(
                modeIntToStr(gamemode.mode),
                typeIntToStr(gamemode.type)
              );

              switch (userStatus.player_status.status.action) {
                case EZPPActionStatus.AFK:
                  details = 'AFK...';
                  state = '  ';
                  break;
                case EZPPActionStatus.PLAYING:
                  details = 'Playing...';
                  break;
                case EZPPActionStatus.EDITING:
                  details = 'Editing...';
                  break;
                case EZPPActionStatus.MODDING:
                  details = 'Modding...';
                  break;
                case EZPPActionStatus.MULTIPLAYER_SELECT:
                  details = 'Multiplayer: Selecting a Beatmap...';
                  state = '  ';
                  break;
                case EZPPActionStatus.WATCHING:
                  details = 'Watching...';
                  break;
                case EZPPActionStatus.TESTING:
                  details = 'Testing...';
                  break;
                case EZPPActionStatus.SUBMITTING:
                  details = 'Submitting...';
                  break;
                case EZPPActionStatus.MULTIPLAYER_IDLE:
                  details = 'Multiplayer: Idle...';
                  state = '  ';
                  break;
                case EZPPActionStatus.MULTIPLAYER_PLAYING:
                  details = 'Multiplayer: Playing...';
                  break;
                case EZPPActionStatus.DIRECT:
                  details = 'Browsing osu!direct...';
                  state = '  ';
                  break;
              }

              if (userStatus.player_status.status.beatmap !== null) {
                const beatmapCoverImage = `https://assets.ppy.sh/beatmaps/${userStatus.player_status.status.beatmap.set_id}/covers/list@2x.jpg`;
                const isValidImage = await urlIsValidImage(beatmapCoverImage);
                if (isValidImage) largeImageKey = beatmapCoverImage;
                customButton = {
                  text: 'View Beatmap',
                  url: `https://ez-pp.farm/beatmapsets/${userStatus.player_status.status.beatmap.set_id}/${userStatus.player_status.status.beatmap.id}`,
                };
              }

              details = `[${gamemodeName}] ${details}`;
              try {
                const currentModeStats =
                  userStats?.player.stats[userStatus.player_status.status.mode];
                let username = $currentUser.name;

                if (currentModeStats && currentModeStats.rank > 0)
                  username += ` (#${currentModeStats.rank})`;

                await Promise.all([
                  presence.updateButton(customButton),
                  presence.updateUser({
                    username,
                    id: $currentUser.id.toFixed(),
                  }),
                  presence.updateStatus({
                    details,
                    state,
                    largeImageKey,
                  }),
                ]);
              } catch {}
            }
          }
        }, 1000 * 2);
      }

      await runOsu(osuPath, true);
      if ($trackingEnabled) umami.track('app_exit_osu');
      cleanup = true;
      launchInfo = 'Cleaning up...';

      setCurrentTimeGlobalMedia(0);
      resumeGlobalMedia();
      fadeGlobalVolume(0, $custom_theme_volume, 2000);

      await getCurrentWindow().show();
      if (presenceUpdater) {
        window.clearInterval(presenceUpdater);
        try {
          await Promise.all([
            presence.updateUser({
              username: '  ',
              id: null,
            }),
            presence.updateStatus({
              details: '  ',
              state: 'Idle in Launcher...',
              largeImageKey: 'ezppfarm',
            }),
          ]);
        } catch {}
      }
      await new Promise((res) => setTimeout(res, 1000));
      await replaceUIFiles(osuPath, true);

      const osuReleaseStream = await getReleaseStream(osuPath);
      osuStream.set(osuReleaseStream);
      const osuVersion = await getVersion(osuPath);
      osuBuild.set(osuVersion);

      const beatmapSetCount = await getBeatmapSetsCount(osuPath);
      if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

      const skinsList = await getSkins(osuPath);
      if (skinsList) {
        skins.set(skinsList);
        skinsCount.set(skinsList.length);
      }

      const skin = await getSkin(osuPath);
      currentSkin.set(skin);

      if ($currentUser) {
        const userInfo = await ezppfarm.getUserInfo($currentUser.id);
        if (userInfo) currentUserInfo.set(userInfo.player);
      }

      launching.set(false);
      cleanup = false;
    } catch (err) {
      cleanup = false;
      const error = err as Error;
      if (error.name === 'AbortError') {
        sileo.error({
          title: 'Hmmm...',
          description: 'Failed to launch.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        launchError = {
          name: error.name,
          message: 'Network request connection timed out.',
        };
      } else {
        launchError = error;
        sileo.error({
          title: 'Hmmm...',
          description: 'Failed to launch.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        launching.set(false);
        if ($trackingEnabled) umami.track('app_launch_fail', { error: err });
      }
    }
  };

  let username = $state('');
  let password = $state('');
  let loginIsLoading = $state(false);

  const performLogin = async () => {
    loginIsLoading = true;

    try {
      const loginResult = await ezppfarm.login(username, password);
      if (loginResult && loginResult.user) {
        sileo.success({
          title: 'Login successful!',
          description: `Welcome back, ${loginResult.user.name}!`,
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });

        $userAuth.value('username').set(username);
        $userAuth.value('password').set(password);
        await $userAuth.save();

        currentUser.set(loginResult.user);
        selectedView = 'home';
      } else {
        sileo.error({
          title: 'Login failed!',
          description: 'Please check your username and password.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        loginIsLoading = false;
      }
    } catch {
      sileo.error({
        title: 'Login failed!',
        description: 'There was an issue connecting to the server. Please try again later.',
        fill: '#181825',
        styles: {
          description: 'text-center!',
        },
      });
      loginIsLoading = false;
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

  let animateInterval: number | undefined;
  const doBPMAnimation = () => {
    if (animateInterval) return;
    animateInterval = window.setInterval(async () => {
      animate(ezppLogo, {
        scale: 1.1,
        duration: 900,
        ease: (t: number) => Math.pow(2, -5 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
        onComplete: () => {},
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      animate(ezppLogo, {
        scale: 1,
        duration: 900,
        ease: (t: number) => (t - 1) ** 7 + 1,
        onComplete: () => {},
      });
    }, 450);
  };

  const setupThemeImport = async () => {
    const initialUrls = await invoke<string[]>('opened_urls');
    if (initialUrls.length > 0) {
      const firstFile = initialUrls[0];
      if (!firstFile.endsWith('.ezpplauncher-theme')) {
        sileo.error({
          title: 'Uhh...',
          description: 'Dropped file is not a valid theme file.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        return;
      }
      const importResult = await checkThemeFromFile(firstFile);
      if (!importResult.success || !importResult.themeInfo) {
        sileo.error({
          title: 'Hmmm...',
          description: importResult.error || 'An unknown error occurred.',
          fill: '#181825',
          styles: {
            description: 'text-center!',
          },
        });
        return;
      }
      droppedTheme = {
        filePath: firstFile,
        themeInfo: importResult.themeInfo,
      };
    }

    await listen<string[]>('opened', async (event) => {
      const files = event.payload;
      if (files.length > 0) {
        const firstFile = files[0];
        if (!firstFile.endsWith('.ezpplauncher-theme')) {
          sileo.error({
            title: 'Uhh...',
            description: 'Dropped file is not a valid theme file.',
            fill: '#181825',
            styles: {
              description: 'text-center!',
            },
          });
          return;
        }
        const importResult = await checkThemeFromFile(firstFile);
        if (!importResult.success || !importResult.themeInfo) {
          sileo.error({
            title: 'Hmmm...',
            description: importResult.error || 'An unknown error occurred.',
            fill: '#181825',
            styles: {
              description: 'text-center!',
            },
          });
          return;
        }
        droppedTheme = {
          filePath: firstFile,
          themeInfo: importResult.themeInfo,
        };
      }
    });
  };

  onMount(() => {
    const config = $userSettings;
    const trackingConsent = config.value('tracking_consent');
    if (trackingConsent.exists()) {
      trackingEnabled.set(trackingConsent.get(false));
    } else {
      askForTrackingPermission = true;
    }

    animate(ezppLogo, {
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 900,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: doBPMAnimation,
    });

    setupThemeImport();
    return () => {
      window.clearInterval(animateInterval);
    };
  });
</script>

<AlertDialog.Root open={launchError !== undefined}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0 max-w-[90vw]">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Error on Launch!</span>
    </div>
    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3 overflow-hidden"
    >
      {#if launchError}
        <pre class="text-wrap text-start overflow-auto w-full">{JSON.stringify(
            launchError,
            Object.getOwnPropertyNames(launchError),
            2
          )}</pre>
      {:else}
        Unexpected error
      {/if}
    </div>
    <div class="flex items-center justify-center mb-3">
      <Button
        onclick={async () => {
          launchError = undefined;
        }}>Close</Button
      >
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={$newVersion !== undefined}>
  <AlertDialog.Content
    class="bg-theme-950 border-theme-800 p-0"
    escapeKeydownBehavior="ignore"
    interactOutsideBehavior="ignore"
  >
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
      {#if $platform === 'windows'}
        {#if downloadingUpdate}
          <div class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg w-full">
            <Progress indeterminate={progress === -1} value={progress} />
            <span class="text-muted-foreground text-sm mt-4">{launchInfo}</span>
          </div>
        {:else}
          <Button
            onclick={async () => {
              const updateFile = $newVersion?.assets.find((asset) => asset.name.endsWith('.exe'));
              if (!updateFile) {
                sileo.error({
                  title: 'Hmmm...',
                  description: 'No update file found.',
                  fill: '#181825',
                  styles: {
                    description: 'text-center!',
                  },
                });
                $newVersion = undefined;
                return;
              }
              downloadingUpdate = true;
              launchInfo = 'Downloading Update...';
              await downloadUpdate(updateFile.browser_download_url, (file) => {
                progress = file.progress;
                launchInfo = `Downloading Update (${formatBytes(file.downloaded)}/${formatBytes(file.size)})...`;
              });
              progress = -1;
              launchInfo = 'Update downloaded, installing...';
              await installUpdate();
            }}>Install Update now</Button
          >
        {/if}
      {:else}
        <Button
          onclick={async () => {
            if ($newVersion) {
              await openURL($newVersion.html_url);
              await exit();
            }
          }}>Update now</Button
        >
      {/if}
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={$newVersion === undefined && askForTrackingPermission}>
  <AlertDialog.Content
    class="bg-theme-950 border-theme-800 p-0"
    escapeKeydownBehavior="ignore"
    interactOutsideBehavior="ignore"
  >
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">App Tracking Consent</span>
    </div>

    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      <p class="mb-4">
        We value your privacy. To enhance your experience and improve our services, we would like to
        collect anonymous usage data. This data helps us understand how the application is used and
        identify areas for improvement.
      </p>
      <p class="mb-4">
        No personal information is collected, and all data is anonymized. You can choose to enable
        or disable this tracking at any time in the application settings.
      </p>
      <p>
        Do you consent to the collection of anonymous usage data to help us improve the application?
      </p>
    </div>
    <div class="flex items-center justify-center mb-3 gap-4 mt-4">
      <Button
        onclick={async () => {
          trackingEnabled.set(true);
          const config = $userSettings;
          config.value('tracking_consent').set(true);
          await config.save();
          askForTrackingPermission = false;
        }}>Yes, I consent</Button
      >
      <Button
        variant="outline"
        onclick={async () => {
          trackingEnabled.set(false);
          const config = $userSettings;
          config.value('tracking_consent').set(false);
          await config.save();
          askForTrackingPermission = false;
        }}>No, I do not consent</Button
      >
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={$newVersion === undefined && !!droppedTheme}>
  <AlertDialog.Content
    class="bg-theme-950 border-theme-800 p-0 max-w-2xl"
    escapeKeydownBehavior="ignore"
    interactOutsideBehavior="ignore"
  >
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <Import size={40} />
      <span class="font-semibold text-xl">Import Theme</span>
    </div>

    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      <p class="mb-4">
        You are about to import the theme <strong>"{droppedTheme?.themeInfo.name}"</strong> by
        <strong>{droppedTheme?.themeInfo.author}</strong>.
      </p>
      <div
        class="mb-4 text-red-400 bg-red-800/20 border border-red-700/20 rounded-lg p-2 flex flex-col items-center justify-center"
      >
        <div class="text-base font-semibold">Warning</div>
        <div>Themes from external sources may contain malicious code or assets.</div>
        <div>Only import themes from creators you trust.</div>
      </div>
      <p>Are you sure you want to proceed with the installation?</p>
    </div>
    <div class="flex items-center justify-center mb-3 gap-4 mt-4">
      <Button
        class="min-w-28"
        onclick={async () => {
          if (!droppedTheme) {
            sileo.error({
              title: 'Hmmm...',
              description: 'Failed to install theme.',
              fill: '#181825',
              styles: {
                description: 'text-center!',
              },
            });
            return;
          }
          themeInstalling = true;
          try {
            const importResult = await importThemeFromFile(
              droppedTheme.themeInfo.name,
              droppedTheme.filePath
            );
            if (!importResult.success) {
              sileo.error({
                title: 'Hmmm...',
                description:
                  importResult.error || 'An unknown error occurred while importing your theme.',
                fill: '#181825',
                styles: {
                  description: 'text-center!',
                },
              });
              return;
            }
            sileo.success({
              title: 'Yay!',
              description: 'Theme imported successfully',
              fill: '#181825',
              styles: {
                description: 'text-center!',
              },
            });
          } catch {
            sileo.error({
              title: 'Hmmm...',
              description: 'An unknown error occurred while importing your theme.',
              fill: '#181825',
              styles: {
                description: 'text-center!',
              },
            });
          } finally {
            droppedTheme = undefined;
            themeInstalling = false;
          }
        }}
        disabled={themeInstalling}
      >
        {#if themeInstalling}
          <LoaderCircle class="animate-spin" size={18} />
        {:else}
          Yes, import
        {/if}
      </Button>
      <Button
        variant="outline"
        onclick={async () => {
          themeInstalling = false;
          droppedTheme = undefined;
        }}
        disabled={themeInstalling}
      >
        No, don't import
      </Button>
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<div class="grid grid-cols-[0.085fr_1fr] h-[100vh] relative" bind:this={dragAndDrop.ref}>
  {#if dragAndDrop.isDraggingOverApp}
    <div
      class="fixed top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      transition:fade={{ duration: 300 }}
    >
      <div
        class="w-[90vw] h-[90vh] flex flex-col items-center justify-center bg-theme-900 border border-theme-800 rounded-lg"
        transition:scale={{ start: 0.7, duration: 300 }}
      >
        <Import size={64} />
        <p>Drag and Drop a .ezpplauncher-theme file here to import</p>
      </div>
    </div>
  {/if}
  <div
    class="p-3 border-r border-r-theme-900 flex flex-col items-center gap-2 z-10 bg-black/40 backdrop-blur-sm"
  >
    <div class="bg-primary/30 ring-1 ring-inset ring-white/15 rounded-[1.1rem] p-1.5">
      <img class="pointer-events-none" src={Logo} alt="logo" bind:this={ezppLogo} />
    </div>
    <Badge class="text-[0.5rem] py-0 px-2">{$launcherVersion || 'dev'}</Badge>
    <Button
      class="flex size-12 items-center gap-2 ring-1 ring-inset ring-white/15 {selectedView ===
      'home'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'home';
      }}
    >
      <House class="text-theme-200 !size-5" />
    </Button>
    <Button
      class="flex size-12 items-center gap-2 ring-1 ring-inset ring-white/15  {selectedView ===
      'themes'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'themes';
      }}
    >
      <Paintbrush class="text-theme-200 !size-5" />
    </Button>
    <Button
      class="flex size-12 items-center gap-2 ring-1 ring-inset ring-white/15  {selectedView ===
      'settings'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'settings';
      }}
    >
      <Settings class="text-theme-200 !size-5" />
    </Button>
    <div class="mt-auto">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={$launching}>
          <Avatar.Root class="size-10">
            <Avatar.Image src="https://a.ez-pp.farm/{$currentUser?.id ?? 0}" />
            <Avatar.Fallback class="bg-theme-900">
              <LoaderCircle class="animate-spin" size={32} />
            </Avatar.Fallback>
          </Avatar.Root>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" side="right" class="w-44">
          {#if $currentUser}
            <DropdownMenu.Item
              class="text-destructive focus:text-destructive text-xs"
              onclick={async () => {
                $userAuth.value('username').del();
                $userAuth.value('password').del();
                await $userAuth.save();
                sileo.success({
                  title: 'Logout successful!',
                  description: 'See you soon!',
                  fill: '#181825',
                  styles: {
                    description: 'text-center!',
                  },
                });
                currentUser.set(undefined);
                currentUserInfo.set(undefined);
                selectedView = 'home';
              }}
            >
              <LogOut class="size-3.5 mr-2" />
              Logout
            </DropdownMenu.Item>
          {:else}
            <DropdownMenu.Item class="text-xs" onclick={() => (selectedView = 'login')}>
              <LogIn class="size-3.5 mr-2" />
              Login
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
  <div class="z-10 h-full overflow-hidden">
    {#if selectedView === 'home'}
      <div
        class="flex flex-col-reverse h-full"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <div
          class="relative z-10 px-8 py-4 flex items-center justify-between bg-black/40 backdrop-blur-sm border-t border-t-theme-900"
        >
          <div class="flex items-center gap-4">
            {#if $osuInstallationPath !== ''}
              <div class="flex items-center gap-2">
                <Music class="size-3.5 text-blue-400" />
                <span class="text-[11px] text-white/70 font-medium">
                  {#if !$beatmapSets && $beatmapSets !== 0}
                    <LoaderCircle class="animate-spin" size={12} />
                  {:else}
                    {numberHumanReadable($beatmapSets ?? 0)}
                  {/if}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <Brush class="size-3.5 text-amber-400" />
                <span class="text-[11px] text-white/70 font-medium">
                  {#if !$skinsCount && $skinsCount !== 0}
                    <LoaderCircle class="animate-spin" size={12} />
                  {:else}
                    {numberHumanReadable($skinsCount ?? 0)}
                  {/if}
                </span>
              </div>
            {/if}
            <div class="flex items-center gap-2">
              {#if $serverConnectionFails > 1}
                <WifiOff class="size-3.5 text-red-400" />
              {:else}
                <Wifi class="size-3.5 text-emerald-400" />
              {/if}
              <span class="relative text-[11px] text-white/70 font-medium">
                <div
                  class="absolute top-0.5 left-1/2 -translate-x-1/2 {!$serverPing ||
                  $serverConnectionFails > 1
                    ? 'opacity-100'
                    : 'opacity-0'} transition-opacity duration-1000"
                >
                  <LoaderCircle class="size-3.5 animate-spin" />
                </div>
                <div
                  class="{!$serverPing || $serverConnectionFails > 1
                    ? 'opacity-0'
                    : 'opacity-100'} transition-opacity duration-1000"
                >
                  {#if $reduceAnimations}
                    <span>{$serverPing}ms</span>
                  {:else}
                    <NumberFlow value={$serverPing ?? 0} trend={0} suffix="ms" />
                  {/if}
                </div>
              </span>
            </div>

            {#if $osuInstallationPath !== ''}
              <div class="w-px h-4 bg-white/10"></div>

              <span
                class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/[0.06]"
              >
                {#if $osuStream}
                  {releaseStreamToReadable($osuStream)}
                {:else}
                  <LoaderCircle class="animate-spin" size={10} />
                {/if}
              </span>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-mono border border-white/[0.06]"
              >
                {#if $osuBuild}
                  {$osuBuild}
                {:else}
                  <LoaderCircle class="animate-spin" size={10} />
                {/if}
              </span>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/20"
              >
                {#if $currentSkin}
                  {#if $currentSkin.length > 23}
                    {$currentSkin.slice(0, 23) + '...'}
                  {:else}
                    {$currentSkin}
                  {/if}
                {:else}
                  <LoaderCircle class="animate-spin" size={10} />
                {/if}
              </span>
            {/if}
          </div>

          <DownloadButton
            downloading={$launching}
            {progress}
            text={$launching
              ? downloadingEZPPFiles
                ? 'Downloading...'
                : cleanup
                  ? 'Cleaning up...'
                  : 'Launching...'
              : $serverConnectionFails > 1
                ? 'No connection'
                : $osuInstallationPath === ''
                  ? 'Hmmm..'
                  : 'Launch'}
            subtext={$launching && !cleanup
              ? launchInfo
              : $osuInstallationPath === ''
                ? 'osu! path is not set!'
                : $serverConnectionFails > 1
                  ? 'No connection...'
                  : undefined}
            disabled={$osuInstallationPath === '' || $serverConnectionFails > 1}
            onClick={launch}
          />
        </div>

        {#if $currentUserInfo}
          <div
            class="m-1 w-72 h-48 bg-black/40 backdrop-blur-sm rounded-md ring-1 ring-inset ring-white/5 flex flex-col items-center p-3"
            in:fly={{ duration: $reduceAnimations ? 0 : 400, y: 5, opacity: 0 }}
            out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
          >
            <Select.Root
              type="single"
              value={selectedGamemode.toFixed()}
              onValueChange={updateGamemode}
            >
              <Select.Trigger
                class="border-theme-800/90 bg-theme-900/90 hover:bg-theme-800/90 !text-muted-foreground font-semibold"
              >
                <div class="flex flex-row items-center gap-2">
                  {#if selectedMode === 0}
                    <Circle size={16} class="text-theme-200" />
                  {:else if selectedMode === 1}
                    <Drum size={16} class="text-theme-200" />
                  {:else if selectedMode === 2}
                    <Cherry size={16} class="text-theme-200" />
                  {:else if selectedMode === 3}
                    <Piano size={16} class="text-theme-200" />
                  {/if}
                  {getGamemodeName(modeIntToStr(selectedMode), typeIntToStr(selectedType))}
                </div>
              </Select.Trigger>
              <Select.Content class="bg-theme-950 border border-theme-900 rounded-lg">
                {#each validModeTypeCombinationsSorted as gamemode (gamemode)}
                  {@const gamemod = getModeAndTypeFromGamemode(gamemode)}
                  <Select.Item value={gamemode.toFixed()}>
                    <div class="flex flex-row gap-2 items-center">
                      {#if gamemod.mode === 0}
                        <Circle size={16} />
                      {:else if gamemod.mode === 1}
                        <Drum size={16} />
                      {:else if gamemod.mode === 2}
                        <Cherry size={16} />
                      {:else if gamemod.mode === 3}
                        <Piano size={16} />
                      {/if}
                      {getGamemodeName(modeIntToStr(gamemod.mode), typeIntToStr(gamemod.type))}
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <div class="grid grid-cols-2 gap-2 w-full m-3">
              <div class="flex flex-col">
                <span class="text-xs text-muted-foreground font-semibold">Rank</span>
                <div class="flex items-center h-full font-semibold text-theme-50">
                  {#if $currentUserInfo}
                    <div in:fade>
                      {#if $reduceAnimations}
                        <span>
                          #{numberHumanReadable($currentUserInfo.stats[selectedGamemode].rank ?? 0)}
                        </span>
                      {:else}
                        <NumberFlow
                          trend={0}
                          prefix="#"
                          value={$currentUserInfo.stats[selectedGamemode].rank ?? 0}
                        />
                      {/if}
                    </div>
                  {:else}
                    <div in:fade>
                      <LoaderCircle class="animate-spin" size={21} />
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-muted-foreground font-semibold">PP</span>
                <div class="flex items-center h-full font-semibold text-primary-200">
                  {#if $currentUserInfo}
                    <div in:fade>
                      {#if $reduceAnimations}
                        <span>
                          {numberHumanReadable($currentUserInfo.stats[selectedGamemode].pp ?? 0)}pp
                        </span>
                      {:else}
                        <NumberFlow
                          trend={0}
                          suffix="pp"
                          value={$currentUserInfo.stats[selectedGamemode].pp ?? 0}
                        />
                      {/if}
                    </div>
                  {:else}
                    <div in:fade>
                      <LoaderCircle class="animate-spin" size={21} />
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-muted-foreground font-semibold">Accuracy</span>
                <div class="flex items-center h-full font-semibold text-theme-50">
                  {#if $currentUserInfo}
                    <div in:fade>
                      {#if $reduceAnimations}
                        <span>
                          {($currentUserInfo.stats[selectedGamemode].acc ?? 0).toFixed(2)}%
                        </span>
                      {:else}
                        <NumberFlow
                          trend={0}
                          suffix="%"
                          value={$currentUserInfo.stats[selectedGamemode].acc.toFixed(2) ?? 0}
                        />
                      {/if}
                    </div>
                  {:else}
                    <div in:fade>
                      <LoaderCircle class="animate-spin" size={21} />
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-muted-foreground font-semibold">Playcount</span>
                <div class="flex items-center h-full font-semibold text-theme-50">
                  {#if $currentUserInfo}
                    <div in:fade>
                      {#if $reduceAnimations}
                        <span>
                          {numberHumanReadable($currentUserInfo.stats[selectedGamemode].plays ?? 0)}
                        </span>
                      {:else}
                        <NumberFlow
                          trend={0}
                          value={$currentUserInfo.stats[selectedGamemode].plays ?? 0}
                        />
                      {/if}
                    </div>
                  {:else}
                    <div in:fade>
                      <LoaderCircle class="animate-spin" size={21} />
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/if}
        <div class="flex flex-col mb-auto mt-12 px-6">
          <span class="text-4xl font-bold drop-shadow-lg">EZPPLauncher</span>
          <span class="text-muted-foreground font-semibold drop-shadow-lg"
            >Hello {$currentUser?.name ?? 'Guest'}!</span
          >
        </div>
      </div>
    {:else if selectedView === 'settings'}
      <div
        class="h-[100vh] w-full flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <div class="grid grid-cols-[1fr_auto] w-full gap-y-5 items-center px-6">
          <div class="flex flex-col">
            <Label class="text-sm" for="setting-patch">Patching</Label>
            <div class="text-muted-foreground text-xs">
              Shows misses in Relax and Autopilot {#if $platform !== 'windows'}<span
                  class="text-red-500 bg-red-800/20 border border-red-600/20 p-0.5 mx-1 px-2 rounded-lg !text-[0.55rem]"
                  >currently only on windows!</span
                >
              {/if}
            </div>
          </div>
          <Checkbox
            id="setting-patch"
            checked={$platform === 'windows' ? $patch : false}
            disabled={$platform !== 'windows'}
            onCheckedChange={async (e) => {
              patch.set(e);
              $userSettings.save();
            }}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>

          <div class="flex flex-col">
            <Label class="text-sm" for="setting-custom-cursor">Lazer-Style Cursor</Label>
            <div class="text-muted-foreground text-xs">
              Enable a custom cursor in the Launcher like in the lazer build of osu!
            </div>
          </div>
          <Checkbox
            id="setting-custom-cursor"
            checked={$customCursor}
            onCheckedChange={async (e) => {
              if (!e) {
                cursorSmoothening.set(false);
              }
              customCursor.set(e);

              $userSettings.save();
            }}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>

          <div class="flex flex-col">
            <Label class="text-sm" for="setting-cursor-smoothening">Cursor Smoothening</Label>
            <div class="text-muted-foreground text-xs">
              Makes the custom cursor movement smoother.
            </div>
          </div>
          <Checkbox
            id="setting-cursor-smoothening"
            checked={$cursorSmoothening}
            onCheckedChange={async (e) => {
              if (!$customCursor) return;
              cursorSmoothening.set(e);
              $userSettings.save();
            }}
            disabled={!$customCursor}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>

          <div class="flex flex-col">
            <Label class="text-sm" for="setting-reduce-animations">Reduce Animations</Label>
            <div class="text-muted-foreground text-xs">
              Disables some animations in the Launcher to improve performance on low-end devices.
            </div>
          </div>
          <Checkbox
            id="setting-reduce-animations"
            checked={$reduceAnimations}
            onCheckedChange={async (e) => {
              reduceAnimations.set(e);
              $userSettings.save();
            }}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>

          <div class="flex flex-col">
            <Label class="text-sm" for="setting-rich-presence">Discord Rich Presence</Label>
            <div class="text-muted-foreground text-xs">
              Let other discord users show what you are doing right now 👀
            </div>
          </div>
          <div class="relative">
            {#if $presenceLoading}
              <div class="-left-8 absolute" transition:fade>
                <LoaderCircle class="animate-spin" />
              </div>
            {/if}
            <Checkbox
              id="setting-rich-presence"
              bind:checked={$discordPresence}
              disabled={$presenceLoading}
              class="flex items-center justify-center w-5 h-5"
            ></Checkbox>
          </div>

          <div class="flex flex-col">
            <Label class="text-sm" for="setting-tracking">App Tracking</Label>
            <div class="text-muted-foreground text-xs">
              Allow anonymous usage data to be collected to help improve the application.
            </div>
          </div>
          <Checkbox
            id="setting-tracking"
            checked={$trackingEnabled}
            onCheckedChange={async (e) => {
              trackingEnabled.set(e);
              $userSettings.value('tracking_consent').set(e);
              await $userSettings.save();
            }}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>
        </div>
        <div
          class="grid grid-cols-[0.7fr_auto] gap-y-1 mt-3 w-full items-center border-theme-800 pl-6 pr-5 pb-4"
        >
          <div class="flex flex-col">
            <Label class="text-sm" for="setting-custom-cursor">osu! installation path</Label>
            <div class="text-muted-foreground text-xs">The path to your osu! installation.</div>
          </div>
          <div class="flex flex-row w-full">
            <Input
              class="mt-4 w-full bg-theme-950 border-theme-800 border-r-0 rounded-r-none"
              type="text"
              value={$osuInstallationPath}
              placeholder="Path to osu! installation"
              readonly
            />
            <Button
              class="mt-4 bg-theme-950 border-theme-800 rounded-l-none"
              variant="outline"
              onclick={browse_osu_installation}>Browse</Button
            >
          </div>
          {#if $platform === 'windows'}
            <div class="flex flex-col">
              <Label class="text-sm" for="setting-custom-cursor">patcher release stream</Label>
              <div class="text-muted-foreground text-xs">
                test different versions of the patcher
              </div>
            </div>
            <div class="flex flex-row w-full">
              <Select.Root
                type="single"
                bind:value={$launcherStream}
                onValueChange={async (newStream) => {
                  const isNet8Installed = await hasNet8();
                  if (!isNet8Installed) {
                    launcherStream.set('stable');
                    sileo.error({
                      title: 'Hmm...',
                      description: '.NET 8.0 Desktop Runtime not found!',
                      fill: '#181825',
                      styles: {
                        description: 'text-center!',
                      },
                      button: {
                        title: 'Download .NET 8.0',
                        onClick: async () =>
                          await openURL(
                            'https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-8.0.22-windows-x64-installer'
                          ),
                      },
                    });
                    return;
                  }
                  $userSettings.value('patcherStream').set(newStream);
                  launcherStream.set(newStream);
                  await $userSettings.save();
                }}
              >
                <Select.Trigger
                  class="border-theme-800 bg-theme-950 !text-muted-foreground font-semibold"
                >
                  <div class="flex flex-row items-center gap-2 font-normal text-foreground">
                    {$launcherStream}
                  </div>
                </Select.Trigger>
                <Select.Content class="bg-theme-950 border border-theme-950 rounded-lg">
                  {#each $launcherStreams as stream (stream)}
                    <Select.Item value={stream}>
                      <div class="flex flex-row gap-2 items-center">
                        {stream}
                      </div>
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </div>
      </div>
    {:else if selectedView === 'login'}
      <div
        class="h-[100vh] w-full flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <form onsubmit={performLogin} class="w-96">
          <div class="flex flex-col items-center justify-center mb-8">
            <span class="text-xl font-semibold">Login to EZPPFarm</span>
            <span class="text-xs text-muted-foreground"
              >Use your EZPPFarm account to login to EZPPLauncher</span
            >
          </div>
          <div class="mb-4">
            <Label for="username" class="block text-sm font-medium">Username</Label>
            <Input
              class="mt-4 w-full bg-theme-900 border-theme-800"
              type="text"
              id="username"
              bind:value={username}
              disabled={loginIsLoading}
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
              disabled={loginIsLoading}
              autocomplete="off"
              autocorrect="off"
            />
          </div>
          <Button class="w-full" type="submit" disabled={loginIsLoading}>
            {#if loginIsLoading}
              <LoaderCircle class="animate-spin" />
            {:else}
              Login
            {/if}
          </Button>
        </form>
      </div>
    {:else if selectedView === 'themes'}
      <div
        class="h-[100vh] w-full flex flex-col items-center bg-black/20 backdrop-blur-sm"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <ScrollContainer class="pt-8" topOffset={45}>
          <div class="grid w-full gap-1 grid-cols-3 p-3 pr-5">
            {#each $custom_themes as theme (theme.folder_name)}
              <div
                class="group overflow-hidden rounded-3xl border {$active_custom_theme &&
                $active_custom_theme.folder_name === theme.folder_name
                  ? 'border-primary'
                  : 'border-theme-800'} bg-theme-950 transition hover:border-white/20 h-[295px]"
              >
                <img
                  src={theme.preview || DefaultThemePreview}
                  alt="Preview of {theme.name}"
                  class="mb-2 h-40 w-full rounded-t-3xl object-cover object-center pointer-events-none select-none"
                />
                <div class="flex flex-col gap-1 p-3">
                  <div class="mb-4 flex items-center justify-between gap-2">
                    <div class="flex flex-col items-start">
                      <span class="text-sm font-semibold">{theme.name}</span>
                      <span class="text-xs text-muted-foreground">by {theme.author}</span>
                    </div>
                    <span class="text-xs text-muted-foreground">v{theme.version}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button
                      class="w-full"
                      disabled={($active_custom_theme &&
                        $active_custom_theme.folder_name === theme.folder_name) ||
                        theme.status === 'downloading' ||
                        theme.status === 'extracting' ||
                        theme.status === 'deleting'}
                      onclick={async () => {
                        if (theme.status === 'installed') {
                          if ($custom_theme_container) {
                            loadTheme(theme, $custom_theme_container, $custom_theme_volume);
                            $userSettings.value('theme').set(theme.name);
                            $userSettings.save();
                          } else {
                            sileo.error({
                              title: 'Uhhm..',
                              description: 'Failed to apply theme.',
                            });
                          }
                        } else {
                          const downloadThemeResult = await downloadTheme(theme);
                          if (!downloadThemeResult.success) {
                            if (downloadThemeResult.error && downloadThemeResult.error.length > 0) {
                              sileo.error({
                                title: 'Uhhm..',
                                description: downloadThemeResult.error,
                                fill: '#181825',
                                styles: {
                                  description: 'text-center!',
                                },
                              });
                            }
                          } else {
                            sileo.success({
                              title: 'Yaay!',
                              description: 'Theme installed successfully!',
                              fill: '#181825',
                              styles: {
                                description: 'text-center!',
                              },
                            });
                          }
                        }
                      }}
                    >
                      {#if $active_custom_theme && $active_custom_theme.folder_name === theme.folder_name}
                        Theme in use
                      {:else if theme.status !== 'installed'}
                        {#if theme.status === 'downloading'}
                          {theme.updateAvailable ? 'Updating' : 'Downloading'} Theme... ({Math.round(
                            theme.progress * 100
                          )}%)
                        {:else if theme.status === 'extracting'}
                          Extracting Theme... ({Math.round(theme.progress * 100)}%)
                        {:else if theme.status === 'deleting'}
                          Uninstalling Theme...
                        {:else}
                          Download Theme
                        {/if}
                      {:else}
                        Use Theme
                      {/if}
                    </Button>
                    {#if theme.status === 'installed' && theme.updateAvailable}
                      <Button
                        class="min-w-[40px]"
                        size="icon"
                        variant="secondary"
                        onclick={async () => {
                          const defaultTheme = $custom_themes.find((t) => t.name === 'Default');
                          if (defaultTheme) {
                            loadTheme(defaultTheme, $custom_theme_container!, $custom_theme_volume);
                            $userSettings.value('theme').set(defaultTheme.name);
                            $userSettings.save();

                            if (!(await downloadTheme(theme, true))) {
                              sileo.error({
                                title: 'Uhhm..',
                                description: 'Failed to update theme.',
                              });
                            }
                          }
                        }}
                      >
                        <CloudDownload />
                      </Button>
                    {/if}
                    {#if (theme.status === 'installed' || theme.status === 'deleting') && $active_custom_theme && $active_custom_theme.folder_name !== theme.folder_name && theme.name !== 'Default'}
                      <Button
                        class="min-w-[40px]"
                        size="icon"
                        variant="destructive"
                        disabled={theme.status !== 'installed'}
                        onclick={() => deleteTheme(theme)}
                      >
                        {#if theme.status === 'deleting'}
                          <LoaderCircle class="animate-spin" />
                        {:else}
                          <Trash />
                        {/if}
                      </Button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </ScrollContainer>
      </div>
    {/if}
  </div>
</div>
