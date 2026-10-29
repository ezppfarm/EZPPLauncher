<script lang="ts">
  import DefaultThemePreview from '$assets/default_preview.png';
  import Logo from '$assets/logo.png';
  import { ezppfarm } from '$lib/api/ezpp';
  import ThemeV2Elements from '$lib/components/theme/ThemeV2Elements.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Avatar from '$lib/components/ui/avatar';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import DownloadButton from '$lib/components/ui/download-button/DownloadButton.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import Progress from '$lib/components/ui/progress/progress.svelte';
  import ScrollContainer from '$lib/components/ui/scroll-container/ScrollContainer.svelte';
  import * as Select from '$lib/components/ui/select';
  import { config } from '$lib/config';
  import { currentUserInfo } from '$lib/data';
  import { useDropZone } from '$lib/dropZone.svelte';
  import {
    getGamemodeInt,
    getGamemodeName,
    getModeAndTypeFromGamemode,
    modeIntToStr,
    typeIntToStr,
    validModeTypeCombinationsSorted,
  } from '$lib/gamemode';
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
    openTabletDriverEnabled,
    openTabletDriverPath,
    osuBuild,
    osuStream,
    platform,
    presenceLoading,
    serverConnectionFails,
    serverPing,
    skinsCount,
    trackingEnabled,
  } from '$lib/global';
  import {
    downloadEZPPLauncherUpdateFiles,
    downloadUpdate,
    encryptString,
    exit,
    getBeatmapSetsCount,
    getEZPPLauncherUpdateFiles,
    getReleaseStream,
    getSkin,
    getSkinsCount,
    getVersion,
    hasNet8,
    hasOsuWinello,
    hasWMCTRL,
    installUpdate,
    isOpenTabletDriverPathValid,
    isOpenTabletDriverRunning,
    isOsuCorrupted,
    isOsuRunning,
    isValidOsuFolder,
    openLogsFolder,
    pickOsuInstallation,
    resolveOsuFolder,
    runOsu,
    runUpdater,
    setConfigValues,
    setUserConfigValues,
    startOpenTabletDriver,
    stopOpenTabletDriver,
  } from '$lib/osuUtil';
  import * as presence from '$lib/presence';
  import { themeAssetUrl, themeV2ThumbnailStyle } from '$lib/themeV2';
  import {
    checkThemeFromFile,
    deleteTheme,
    downloadTheme,
    importThemeFromFile,
    loadTheme,
    openThemesFolder,
    reloadThemes,
    themesDirectory,
    type Theme,
    type ThemeInfo,
  } from '$lib/themes';
  import { EZPPActionStatus, type LaunchView } from '$lib/types';
  import { currentUser } from '$lib/userAuthentication';
  import {
    cursorSmoothening,
    customCursor,
    loggingEnabled,
    osuInstallationPath,
    patch,
    preferredMode,
    preferredType,
    reduceAnimations,
  } from '$lib/userSettings';
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
  } from '$lib/utils';
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
    Plus,
    Pencil,
    RefreshCw,
    FolderOpen,
    Search,
    Gamepad2,
    HardDrive,
    Palette,
    Plug,
    ScrollText,
  } from '@lucide/svelte';
  import NumberFlow from '@number-flow/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import * as path from '@tauri-apps/api/path';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open } from '@tauri-apps/plugin-dialog';
  import { animate } from 'animejs';
  import { sileo } from 'sileo';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fade, fly, scale } from 'svelte/transition';
  import { TextMorph } from 'torph/svelte';

  let selectedView = $state<LaunchView>('HOME');
  let progress = $state(-1);
  let launchInfo = $state('');
  let launchError = $state<Error | undefined>(undefined);
  let ezppLogo: HTMLImageElement;

  let askForTrackingPermission = $state(false);

  let downloadingUpdate = $state(false);

  let updateCheckFailed = $state(false);

  let dragAndDrop = useDropZone({
    onDrop: async (file) => {
      const firstFile = file[0];
      if (!firstFile.endsWith('.ezpplauncher-theme')) {
        sileo.error({
          title: 'Uhh...',
          description: 'Dropped file is not a valid theme file.',
        });
        return;
      }
      const importResult = await checkThemeFromFile(firstFile);
      if (!importResult.success || !importResult.themeInfo) {
        sileo.error({
          title: 'Hmmm...',
          description: importResult.error || 'An unknown error occurred.',
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
  let themeSearch = $state('');
  let themeSavedUnlisten: (() => void) | undefined;
  let refreshingThemes = $state(false);

  const filteredThemes = $derived(
    $custom_themes.filter((theme) => {
      const query = themeSearch.trim().toLowerCase();
      if (!query) return true;
      return `${theme.name} ${theme.author} ${theme.description} ${theme.apiVersion}`
        .toLowerCase()
        .includes(query);
    })
  );

  const themeButtonLabel = (theme: Theme, activeFolder: string | undefined) => {
    if (activeFolder === theme.folder_name) return 'Theme in use';
    if (theme.status === 'downloading') {
      return `${theme.updateAvailable ? 'Updating' : 'Downloading'} Theme... (${Math.round(theme.progress * 100)}%)`;
    }
    if (theme.status === 'extracting') {
      return `Extracting Theme... (${Math.round(theme.progress * 100)}%)`;
    }
    if (theme.status === 'deleting') return 'Uninstalling Theme...';
    if (theme.status === 'installed') return 'Use Theme';
    return 'Download Theme';
  };

  const openThemeEditor = async (theme?: Theme) => {
    try {
      const themeFolder = theme
        ? await path.join(await themesDirectory(), theme.folder_name)
        : null;
      await invoke('open_theme_editor', { themeFolder });
    } catch (error) {
      console.error(error);
      sileo.error({
        title: 'Could not open the theme editor',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const applySavedTheme = async (folderName: string) => {
    await reloadThemes();
    const savedTheme = get(custom_themes).find((theme) => theme.folder_name === folderName);
    if (!savedTheme) return;

    if ($custom_theme_container) {
      await loadTheme(savedTheme, $custom_theme_container, $custom_theme_volume);
      await config.value<string>('theme').set(savedTheme.name);
    }
  };

  const refreshThemes = async () => {
    refreshingThemes = true;
    try {
      await reloadThemes();
    } catch (error) {
      console.error(error);
      sileo.error({ title: 'Could not refresh themes' });
    } finally {
      refreshingThemes = false;
    }
  };

  const themeBackgroundVideo = (theme: Theme) =>
    theme.definition?.background.type === 'video'
      ? themeAssetUrl(theme.assets, theme.definition.background.src)
      : '';

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
    const selectedPath = await pickOsuInstallation($platform);

    if (typeof selectedPath === 'string') {
      if (selectedPath === $osuInstallationPath) {
        return;
      }
      const resolvedPath = await resolveOsuFolder(selectedPath);
      if (!resolvedPath) {
        sileo.error({
          title: 'Hmm...',
          description:
            $platform === 'macos'
              ? 'The selected item does not contain a valid osu! installation. Pick your osu!.app wrapper.'
              : 'The selected folder is not a valid osu! installation folder. Please select the correct folder.',
        });
        return;
      }
      osuInstallationPath.set(resolvedPath);
      await config.value<string>('osu_installation_path').set(resolvedPath);
      sileo.success({
        title: 'Yay!',
        description: 'osu! installation path set successfully.',
      });

      const beatmapSetCount = await getBeatmapSetsCount(resolvedPath);
      if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

      const skins_count = await getSkinsCount(resolvedPath);
      if (skins_count) {
        /* skins.set(skins_list); */
        skinsCount.set(skins_count);
      }

      const skin: string = await getSkin(resolvedPath);
      currentSkin.set(skin);

      const osuReleaseStream = await getReleaseStream(resolvedPath);
      osuStream.set(osuReleaseStream);
      const osuVersion = await getVersion(resolvedPath);
      osuBuild.set(osuVersion);
    }
  };

  const launch = async (skipUpdateCheck = false) => {
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
      });
      launching.set(false);
      return;
    }
    launchInfo = 'Checking osu! installation...';
    if (!$osuBuild) {
      sileo.error({
        title: 'Hmmm...',
        description: 'There was an issue detecting your installed osu! version',
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
      });
      launching.set(false);
      return;
    }

    if ($platform === 'linux') {
      if (!(await hasWMCTRL())) {
        sileo.error({
          title: 'Hmmm...',
          description: 'wmctrl seems to be missing, please install via AUR.',
        });
        launching.set(false);
        return;
      }
      if (!(await hasOsuWinello())) {
        sileo.error({
          title: 'Hmmm...',
          description: 'osu-winello seems to be missing, please install it.',
        });
        launching.set(false);
        return;
      }
    }

    if (!skipUpdateCheck) {
      try {
        launchInfo = 'Looking for file updates...';
        let launchStream = $launcherStream;
        if ($platform !== 'windows') launchStream = 'stable'; //fallback to stable for non windows systems
        const updateResult = await getEZPPLauncherUpdateFiles(osuPath, launchStream);

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
    }

    try {
      if (!skipUpdateCheck) {
        const streamInfo = await ezppfarm.latestBuildVersion('stable40');
        if (!streamInfo) {
          sileo.error({
            title: 'Hmmm...',
            description: 'Failed to check for updates, maybe osu! is down?',
          });
          launching.set(false);
          updateCheckFailed = true;
          return;
        }

        const releaseStream = await getReleaseStream(osuPath);

        if (releaseStream === undefined) {
          sileo.error({
            title: 'Hmmm...',
            description: 'Failed to get osu! release stream.',
          });
          launching.set(false);
          return;
        }

        // only stable osu! release streams are supported for now
        if (!releaseStream.toLowerCase().includes('stable')) {
          sileo.error({
            title: 'Hmmm...',
            description: 'You are not on the stable release stream, please switch to it.',
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
      }
      if ($currentUser) {
        const [username, password] = await Promise.all([
          config.value<string>('username').get(''),
          config.value<string>('password').get(''),
        ]);
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

      let otd_run = false;
      if ($openTabletDriverEnabled && $openTabletDriverPath.length > 0) {
        const otdRunning = await isOpenTabletDriverRunning();
        if (!otdRunning) {
          launchInfo = 'Starting OpenTabletDriver...';
          const validDaemon = await isOpenTabletDriverPathValid($openTabletDriverPath);
          if (!validDaemon) {
            sileo.error({
              title: 'Hmmm...',
              description: 'Failed to start OpenTabletDriver, executable not found.',
            });
            launching.set(false);
            return;
          }
          try {
            await startOpenTabletDriver($openTabletDriverPath);
            otd_run = true;
          } catch (err) {
            console.log('Failed to start OpenTabletDriver:', err);
            sileo.error({
              title: 'Hmmm...',
              description: 'Failed to start OpenTabletDriver.',
            });
            launching.set(false);
            return;
          }
        }
      }
      await new Promise((res) => setTimeout(res, 1500));
      launchInfo = 'Launching osu!...';

      fadeGlobalVolume($custom_theme_volume, 0, 2000, pauseGlobalMedia);

      /* await replaceUIFiles(osuPath, false); */
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
                if (userStatus.player_status.status.action !== EZPPActionStatus.DIRECT)
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
                  presence.updateUser({
                    username,
                    id: $currentUser.id.toFixed(),
                  }),
                  presence.updateButton(customButton),
                  presence.updateStatus({
                    details,
                    state,
                    largeImageKey,
                  }),
                ]);
              } catch (err) {
                console.log(err);
              }
            }
          }
        }, 1000 * 2);
      }

      await runOsu(osuPath, $patch);
      if ($trackingEnabled) umami.track('app_exit_osu');
      cleanup = true;
      launchInfo = 'Cleaning up...';

      if (otd_run) await stopOpenTabletDriver();

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
        } catch (err) {
          console.log(err);
        }
      }
      await new Promise((res) => setTimeout(res, 1000));
      /* await replaceUIFiles(osuPath, true); */

      const osuReleaseStream = await getReleaseStream(osuPath);
      osuStream.set(osuReleaseStream);
      const osuVersion = await getVersion(osuPath);
      osuBuild.set(osuVersion);

      const beatmapSetCount = await getBeatmapSetsCount(osuPath);
      if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

      const skins_count = await getSkinsCount(osuPath);
      if (skins_count) {
        /* skins.set(skinsList); */
        skinsCount.set(skins_count);
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
      await getCurrentWindow().show();
      if (error.name === 'AbortError') {
        sileo.error({
          title: 'Hmmm...',
          description: 'Failed to launch.',
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
        });
        await Promise.all([
          config.value<string>('username').set(username, { encrypt: true }),
          config.value<string>('password').set(password, { encrypt: true }),
        ]);

        currentUser.set(loginResult.user);
        selectedView = 'HOME';
      } else {
        sileo.error({
          title: 'Login failed!',
          description: 'Please check your username and password.',
        });
        loginIsLoading = false;
      }
    } catch (err) {
      console.log(err);
      sileo.error({
        title: 'Login failed!',
        description: 'There was an issue connecting to the server. Please try again later.',
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
    if (initialUrls.length > 0 && !droppedTheme) {
      const firstFile = initialUrls[0];
      if (!firstFile.endsWith('.ezpplauncher-theme')) {
        sileo.error({
          title: 'Uhh...',
          description: 'Dropped file is not a valid theme file.',
        });
        return;
      }
      const importResult = await checkThemeFromFile(firstFile);
      if (!importResult.success || !importResult.themeInfo) {
        sileo.error({
          title: 'Hmmm...',
          description: importResult.error || 'An unknown error occurred.',
        });
        return;
      }
      droppedTheme = {
        filePath: firstFile,
        themeInfo: importResult.themeInfo,
      };
    }

    await listen<string[]>('opened', async (event) => {
      if (droppedTheme) return;
      const files = event.payload;
      if (files.length > 0) {
        const firstFile = files[0];
        if (!firstFile.endsWith('.ezpplauncher-theme')) {
          sileo.error({
            title: 'Uhh...',
            description: 'Dropped file is not a valid theme file.',
          });
          return;
        }
        const importResult = await checkThemeFromFile(firstFile);
        if (!importResult.success || !importResult.themeInfo) {
          sileo.error({
            title: 'Hmmm...',
            description: importResult.error || 'An unknown error occurred.',
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

  const browse_otd = async () => {
    const selectedPath = await open({
      directory: false,
      multiple: false,
      title: 'Select OpenTabletDriver.Daemon Executable',
      defaultPath: $openTabletDriverPath ?? undefined,
      canCreateDirectories: false,
      filters:
        $platform === 'windows'
          ? [
              {
                name: 'OpenTabletDriver.Daemon.exe',
                extensions: ['exe'],
              },
            ]
          : undefined,
    });

    if (typeof selectedPath === 'string') {
      const fileName = selectedPath.split(/[\\/]/).pop();
      if ($platform === 'windows' && fileName?.toLowerCase() !== 'opentabletdriver.daemon.exe') {
        sileo.error({
          title: 'Wrong executable',
          description: 'Please select OpenTabletDriver.Daemon.exe',
        });
        return;
      }

      openTabletDriverPath.set(selectedPath);
      await config.value<string>('otd_path').set(selectedPath);
      sileo.success({
        title: 'Yay!',
        description: 'OpenTabletDriver set successfully.',
      });
    }
  };

  onMount(() => {
    (async () => {
      const trackingConsent = config.value<boolean>('tracking_consent');
      if (await trackingConsent.exists()) {
        trackingEnabled.set(await trackingConsent.get(false));
      } else {
        askForTrackingPermission = true;
      }
    })();

    animate(ezppLogo, {
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 900,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: doBPMAnimation,
    });

    setupThemeImport();
    listen<string>('theme-saved', async (event) => {
      try {
        await applySavedTheme(event.payload);
      } catch (error) {
        console.error(error);
        sileo.error({ title: 'Could not apply the saved theme' });
      }
    }).then((unlisten) => (themeSavedUnlisten = unlisten));

    return () => {
      window.clearInterval(animateInterval);
      themeSavedUnlisten?.();
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
          await config.value<boolean>('tracking_consent').set(true);
          askForTrackingPermission = false;
        }}>Yes, I consent</Button
      >
      <Button
        variant="outline"
        onclick={async () => {
          trackingEnabled.set(false);
          await config.value<boolean>('tracking_consent').set(false);
          askForTrackingPermission = false;
        }}>No, I do not consent</Button
      >
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={updateCheckFailed}>
  <AlertDialog.Content
    class="bg-theme-950 border-theme-800 p-0 max-w-2xl"
    escapeKeydownBehavior="ignore"
    interactOutsideBehavior="ignore"
  >
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <Import size={40} />
      <span class="font-semibold text-xl">Update check failed</span>
    </div>

    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      <p class="mb-4">Failed to check for updates.</p>
      <p>Do you want to launch anyway?</p>
    </div>
    <div class="flex items-center justify-center mb-3 gap-4 mt-4">
      <Button
        class="min-w-28"
        onclick={async () => {
          await launch(true);
          updateCheckFailed = false;
        }}
      >
        Launch anyways
      </Button>
      <Button
        variant="outline"
        onclick={async () => {
          updateCheckFailed = false;
        }}
      >
        Abort
      </Button>
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={$newVersion === undefined && !!droppedTheme && !themeInstalling}>
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
            });
            return;
          }
          themeInstalling = true;

          try {
            if ($active_custom_theme && $active_custom_theme.name === droppedTheme.themeInfo.name) {
              const defaultTheme = $custom_themes.find((t) => t.name === 'Default');
              if (defaultTheme) {
                loadTheme(defaultTheme, $custom_theme_container!, $custom_theme_volume);
                await config.value<string>('theme').set(defaultTheme.name);
              }
            }
            await sileo.promise(
              importThemeFromFile(droppedTheme.themeInfo.name, droppedTheme.filePath),
              {
                loading: {
                  title: 'Importing theme...',
                },
                error() {
                  return {
                    title: 'Hmmm...',
                    description: 'An unknown error occurred while importing your theme.',
                  };
                },
                success(data) {
                  return {
                    title: data.success ? 'Yay!' : 'Hmmm...',
                    description: data.success
                      ? 'Theme imported successfully'
                      : data.error || 'An unknown error occurred while importing your theme.',
                    type: data.success ? 'success' : 'error',
                  };
                },
              }
            );
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

<div class="grid grid-cols-[0.085fr_1fr] h-screen relative" bind:this={dragAndDrop.ref}>
  {#if dragAndDrop.isDraggingOverApp && !droppedTheme}
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
      'HOME'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'HOME';
      }}
    >
      <House class="text-theme-200 size-5!" />
    </Button>
    <Button
      class="flex size-12 items-center gap-2 ring-1 ring-inset ring-white/15  {selectedView ===
      'THEMES'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'THEMES';
      }}
    >
      <Paintbrush class="text-theme-200 size-5!" />
    </Button>
    <Button
      class="flex size-12 items-center gap-2 ring-1 ring-inset ring-white/15  {selectedView ===
      'SETTINGS'
        ? 'bg-primary/50'
        : 'bg-black/20 border-black/20'} hover:bg-primary/50 rounded-[0.85rem] p-3 mt-3"
      disabled={$launching}
      onclick={() => {
        if (!$launching) selectedView = 'SETTINGS';
      }}
    >
      <Settings class="text-theme-200 size-5!" />
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
                await Promise.all([
                  config.value<string>('username').set(''),
                  config.value<string>('password').set(''),
                ]);
                sileo.success({
                  title: 'Logout successful!',
                  description: 'See you soon!',
                  fill: '#181825',
                });
                currentUser.set(undefined);
                currentUserInfo.set(undefined);
                selectedView = 'HOME';
              }}
            >
              <LogOut class="size-3.5 mr-2" />
              Logout
            </DropdownMenu.Item>
          {:else}
            <DropdownMenu.Item class="text-xs" onclick={() => (selectedView = 'LOGIN')}>
              <LogIn class="size-3.5 mr-2" />
              Login
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
  <div class="z-10 h-full overflow-hidden">
    {#if selectedView === 'HOME'}
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
                class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/6"
              >
                {#if $osuStream}
                  {releaseStreamToReadable($osuStream)}
                {:else}
                  <LoaderCircle class="animate-spin" size={10} />
                {/if}
              </span>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-mono border border-white/6"
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
            onClick={async () => await launch()}
          />
        </div>
        <div class="relative h-50">
          {#if $currentUserInfo}
            <div
              class="m-1 w-72 h-48 bg-black/40 backdrop-blur-sm rounded-md ring-1 ring-inset ring-white/5 flex flex-col items-center p-3 absolute top-0 left-0"
              in:fly={{ duration: $reduceAnimations ? 0 : 400, y: 5, opacity: 0 }}
              out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
            >
              <Select.Root
                type="single"
                value={selectedGamemode.toFixed()}
                onValueChange={updateGamemode}
              >
                <Select.Trigger
                  class="border-theme-800/90 bg-theme-900/90 hover:bg-theme-800/90 text-muted-foreground! font-semibold"
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
                <Select.Content class="bg-theme-950 border border-theme-900 rounded-lg max-h-72">
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
                            #{numberHumanReadable(
                              $currentUserInfo.stats[selectedGamemode].rank ?? 0
                            )}
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
                            {numberHumanReadable(
                              $currentUserInfo.stats[selectedGamemode].pp ?? 0
                            )}pp
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
                            {numberHumanReadable(
                              $currentUserInfo.stats[selectedGamemode].plays ?? 0
                            )}
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
          {:else}
            <div
              class="m-1 w-72 h-48 bg-black/40 backdrop-blur-sm rounded-md ring-1 ring-inset ring-white/5 flex flex-col items-center justify-center p-3 gap-3 absolute top-0 left-0"
              in:fly={{ duration: $reduceAnimations ? 0 : 400, y: 5, opacity: 0 }}
              out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
            >
              <div class="flex flex-col items-center gap-1 text-center">
                <span class="font-semibold text-theme-50 text-sm">See your stats here</span>
                <span class="text-xs text-muted-foreground"
                  >Log in with your EZPPFarm account to track your rank, PP, accuracy and playcount.</span
                >
              </div>
              <div class="flex flex-col gap-2 w-full">
                <Button
                  class="flex-1 h-7 text-xs"
                  onclick={() => {
                    selectedView = 'LOGIN';
                  }}>Log In</Button
                >
                <Button
                  variant="outline"
                  class="flex-1 h-7 text-xs border-theme-800 text-muted-foreground hover:text-theme-50"
                  onclick={async () => {
                    await openURL('https://ez-pp.farm/register');
                  }}>Register</Button
                >
              </div>
            </div>
          {/if}
        </div>
        <div class="flex flex-col mb-auto mt-12 px-6">
          <span class="theme-heading text-4xl font-bold drop-shadow-lg">EZPPLauncher</span>
          <span class="text-muted-foreground font-semibold drop-shadow-lg"
            >Hello {$currentUser?.name ?? 'Guest'}!</span
          >
        </div>
      </div>
    {:else if selectedView === 'SETTINGS'}
      <div
        class="h-screen w-full bg-black/20 backdrop-blur-sm"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <ScrollContainer class="px-6">
          <div class="mx-auto w-full max-w-3xl pt-12 pb-12">
            <header class="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 class="text-xl font-bold tracking-tight">Settings</h1>
                <p class="mt-1 text-xs text-muted-foreground">
                  Manage gameplay, appearance, integrations and diagnostics.
                </p>
              </div>
              <p class="text-[11px] text-muted-foreground/60">Changes are saved automatically.</p>
            </header>

            <div class="flex flex-col gap-5">
              <section>
                <h2
                  class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <Gamepad2 class="size-3.5" />
                  Gameplay
                </h2>
                <div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-patch">Patching</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Shows misses in Relax and Autopilot.
                        {#if $platform === 'macos'}
                          Runs through your osu! Wine prefix, which needs .NET installed.
                        {/if}
                      </p>
                    </div>
                    <Checkbox
                      id="setting-patch"
                      checked={$patch}
                      onCheckedChange={async (e) => {
                        patch.set(e);
                      }}
                      class="mt-0.5"
                    />
                  </div>

                  {#if $platform === 'windows'}
                    <div class="py-3">
                      <Label class="text-sm">Patcher release stream</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Test different versions of the patcher.
                      </p>
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
                          await config.value<string>('patcherStream').set(newStream);
                          launcherStream.set(newStream);
                        }}
                      >
                        <Select.Trigger class="mt-2.5 border-theme-800 bg-theme-950">
                          <div class="flex flex-row items-center gap-2 font-normal text-foreground">
                            {$launcherStream}
                          </div>
                        </Select.Trigger>
                        <Select.Content class="rounded-lg border border-theme-950 bg-theme-950">
                          {#each $launcherStreams as stream (stream)}
                            <Select.Item value={stream}>
                              <div class="flex flex-row items-center gap-2">
                                {stream}
                              </div>
                            </Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </div>
                  {/if}
                </div>
              </section>

              <section>
                <h2
                  class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <Palette class="size-3.5" />
                  Appearance
                </h2>
                <div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-custom-cursor">Lazer-style cursor</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Enable a custom cursor in the launcher, like the lazer build of osu!.
                      </p>
                    </div>
                    <Checkbox
                      id="setting-custom-cursor"
                      checked={$customCursor}
                      onCheckedChange={async (e) => {
                        if (!e) {
                          cursorSmoothening.set(false);
                        }
                        customCursor.set(e);
                      }}
                      class="mt-0.5"
                    />
                  </div>

                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-cursor-smoothening"
                        >Cursor smoothening</Label
                      >
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Makes the custom cursor movement smoother.
                      </p>
                    </div>
                    <Checkbox
                      id="setting-cursor-smoothening"
                      checked={$cursorSmoothening}
                      onCheckedChange={async (e) => {
                        if (!$customCursor) return;
                        cursorSmoothening.set(e);
                      }}
                      disabled={!$customCursor}
                      class="mt-0.5"
                    />
                  </div>

                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-reduce-animations"
                        >Reduce animations</Label
                      >
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Disables some launcher animations to improve performance on low-end devices.
                      </p>
                    </div>
                    <Checkbox
                      id="setting-reduce-animations"
                      checked={$reduceAnimations}
                      onCheckedChange={async (e) => {
                        reduceAnimations.set(e);
                      }}
                      class="mt-0.5"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2
                  class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <Plug class="size-3.5" />
                  Integrations
                </h2>
                <div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-rich-presence"
                        >Discord Rich Presence</Label
                      >
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Let other Discord users see what you are doing right now 👀
                      </p>
                    </div>
                    <div class="mt-0.5 flex items-center gap-3">
                      {#if $presenceLoading}
                        <LoaderCircle class="size-4 animate-spin text-muted-foreground" />
                      {/if}
                      <Checkbox
                        id="setting-rich-presence"
                        bind:checked={$discordPresence}
                        disabled={$presenceLoading}
                      />
                    </div>
                  </div>

                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-tracking">App tracking</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Allow anonymous usage data to be collected to help improve the application.
                      </p>
                    </div>
                    <Checkbox
                      id="setting-tracking"
                      checked={$trackingEnabled}
                      onCheckedChange={async (e) => {
                        trackingEnabled.set(e);
                        await config.value<boolean>('tracking_consent').set(e);
                      }}
                      class="mt-0.5"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2
                  class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <HardDrive class="size-3.5" />
                  Installation
                </h2>
                <div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
                  <div class="py-3">
                    <Label class="text-sm" for="setting-osu-path">osu! installation path</Label>
                    <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      The path to your osu! installation.
                      {#if $platform === 'macos'}
                        Select your <code>osu!.app</code> bundle directly. The launcher will locate osu!
                        inside the Wineskin wrapper for you.
                      {/if}
                    </p>
                    <div class="mt-2.5 flex gap-2">
                      <Input
                        id="setting-osu-path"
                        class="flex-1 border-theme-800 bg-theme-950"
                        type="text"
                        value={$osuInstallationPath}
                        placeholder="Path to osu! installation"
                        readonly
                      />
                      <Button
                        variant="outline"
                        class="shrink-0 border-theme-800 bg-theme-950"
                        onclick={browse_osu_installation}
                      >
                        <FolderOpen class="size-4" />
                        Browse
                      </Button>
                    </div>
                  </div>

                  {#if $platform === 'windows'}
                    <div class="py-3">
                      <div class="flex items-start justify-between gap-8">
                        <div class="min-w-0">
                          <Label class="text-sm" for="setting-otd">OpenTabletDriver</Label>
                          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            Automatically start OpenTabletDriver when launching osu!.
                          </p>
                        </div>
                        <Checkbox
                          id="setting-otd"
                          bind:checked={$openTabletDriverEnabled}
                          class="mt-0.5"
                        />
                      </div>
                      <div class="mt-2.5 flex gap-2">
                        <Input
                          class="flex-1 border-theme-800 bg-theme-950"
                          type="text"
                          value={$openTabletDriverPath}
                          placeholder="Path to OpenTabletDriver.Daemon.exe"
                          readonly
                          disabled={!$openTabletDriverEnabled}
                        />
                        <Button
                          variant="outline"
                          class="shrink-0 border-theme-800 bg-theme-950"
                          disabled={!$openTabletDriverEnabled}
                          onclick={browse_otd}
                        >
                          <FolderOpen class="size-4" />
                          Browse
                        </Button>
                      </div>
                    </div>
                  {/if}
                </div>
              </section>

              <section>
                <h2
                  class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <ScrollText class="size-3.5" />
                  Logging
                  <Badge
                    variant={$loggingEnabled ? 'secondary' : 'outline'}
                    class="ml-auto text-[10px]"
                  >
                    {$loggingEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </h2>
                <div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
                  <div class="flex items-start justify-between gap-8 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm" for="setting-logging">Save logs to disk</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Capture launcher, osu! and patcher output. Rotated logs are bundled into one
                        ZIP per session, and the last five bundles are kept.
                      </p>
                    </div>
                    <Checkbox
                      id="setting-logging"
                      checked={$loggingEnabled}
                      onCheckedChange={(enabled) => loggingEnabled.set(enabled)}
                      class="mt-0.5"
                    />
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-4 py-3">
                    <div class="min-w-0">
                      <Label class="text-sm">Log bundles</Label>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Stored in
                        <span class="font-mono text-[11px] text-theme-300"
                          >{$platform === 'windows'
                            ? '%USERPROFILE%\\.ezpplauncher\\logs'
                            : '~/.ezpplauncher/logs'}</span
                        >.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      class="shrink-0 border-theme-800 bg-theme-950"
                      onclick={async () => {
                        try {
                          await openLogsFolder();
                        } catch (error) {
                          console.error(error);
                          sileo.error({ title: 'Could not open the logs folder' });
                        }
                      }}
                    >
                      <FolderOpen class="size-4" />
                      Open folder
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </ScrollContainer>
      </div>
    {:else if selectedView === 'LOGIN'}
      <div
        class="h-screen w-full flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm"
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
    {:else if selectedView === 'THEMES'}
      <div
        class="h-screen w-full flex flex-col items-center bg-black/20 backdrop-blur-sm"
        in:fly={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 400,
          y: 5,
          opacity: 0,
        }}
        out:fly={{ duration: $reduceAnimations ? 0 : 400, y: -5, opacity: 0 }}
      >
        <div class="relative z-20 mt-12 flex w-full max-w-5xl shrink-0 items-center gap-2 px-4">
          <div class="relative flex-1">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              class="border-theme-800 bg-theme-950/80 pl-9"
              placeholder="Search themes..."
              bind:value={themeSearch}
            />
          </div>
          <Button class="shrink-0" onclick={() => openThemeEditor()}>
            <Plus />
            Create theme
          </Button>
          <Button
            class="shrink-0"
            variant="secondary"
            size="icon"
            title="Refresh themes"
            onclick={refreshThemes}
            disabled={refreshingThemes}
          >
            <RefreshCw class={refreshingThemes ? 'animate-spin' : ''} />
          </Button>
          <Button
            class="shrink-0"
            variant="secondary"
            size="icon"
            title="Open themes folder"
            onclick={async () => {
              try {
                await openThemesFolder();
              } catch (error) {
                console.error(error);
                sileo.error({ title: 'Could not open the themes folder' });
              }
            }}
          >
            <FolderOpen />
          </Button>
        </div>
        <div class="min-h-0 w-full flex-1 pt-3">
          <ScrollContainer topOffset={45}>
            <div class="grid w-full gap-1 grid-cols-3 p-3 pr-5">
              {#each filteredThemes as theme (theme.folder_name)}
                <div
                  class="group flex flex-col overflow-hidden rounded-3xl border {$active_custom_theme &&
                  $active_custom_theme.folder_name === theme.folder_name
                    ? 'border-primary'
                    : 'border-theme-800'} bg-theme-950 transition hover:border-white/20"
                >
                  <div class="relative h-40 w-full shrink-0 overflow-hidden">
                    {#if theme.preview}
                      <img
                        src={theme.preview}
                        alt="Preview of {theme.name}"
                        class="h-full w-full object-cover object-center pointer-events-none select-none"
                      />
                    {:else if themeBackgroundVideo(theme)}
                      <video
                        src={themeBackgroundVideo(theme)}
                        class="h-full w-full object-cover object-center pointer-events-none"
                        autoplay
                        loop
                        muted
                        playsinline
                      ></video>
                    {:else if theme.definition}
                      <div
                        class="h-full w-full"
                        style={themeV2ThumbnailStyle(theme.definition, theme.assets)}
                      ></div>
                    {:else}
                      <img
                        src={DefaultThemePreview}
                        alt="Preview of {theme.name}"
                        class="h-full w-full object-cover object-center pointer-events-none select-none"
                      />
                    {/if}
                    <div
                      class="pointer-events-none absolute inset-0 bg-gradient-to-t from-theme-950/70 via-transparent to-transparent"
                    ></div>
                    {#if $active_custom_theme && $active_custom_theme.folder_name === theme.folder_name}
                      <Badge class="absolute left-2 top-2 text-[10px]">In use</Badge>
                    {/if}
                    <Badge
                      variant="secondary"
                      class="absolute right-2 top-2 px-1.5 py-0 text-[10px]"
                    >
                      API {theme.apiVersion.startsWith('2') ? '2' : '1'}
                    </Badge>
                    {#if theme.nsfw}
                      <Badge
                        variant="destructive"
                        class="absolute bottom-2 right-2 px-1.5 py-0 text-[10px]"
                        title="Adult content"
                      >
                        18+
                      </Badge>
                    {/if}
                  </div>
                  <div class="flex flex-1 flex-col gap-1 p-3">
                    <div class="mb-2 flex items-start justify-between gap-2">
                      <div class="flex min-w-0 flex-col items-start">
                        <span class="truncate text-sm font-semibold">{theme.name}</span>
                        <span class="text-xs text-muted-foreground">by {theme.author}</span>
                      </div>
                      <span class="shrink-0 text-xs text-muted-foreground">v{theme.version}</span>
                    </div>
                    {#if theme.description}
                      <p class="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {theme.description}
                      </p>
                    {/if}
                    <div class="mt-auto flex items-center gap-1">
                      <Button
                        class="relative w-full overflow-hidden {theme.status === 'downloading' ||
                        theme.status === 'extracting'
                          ? 'disabled:bg-primary disabled:opacity-100'
                          : ''}"
                        aria-busy={theme.status === 'downloading' || theme.status === 'extracting'}
                        disabled={($active_custom_theme &&
                          $active_custom_theme.folder_name === theme.folder_name) ||
                          theme.status === 'downloading' ||
                          theme.status === 'extracting' ||
                          theme.status === 'deleting'}
                        onclick={async () => {
                          if (theme.status === 'installed') {
                            if ($custom_theme_container) {
                              loadTheme(theme, $custom_theme_container, $custom_theme_volume);
                              await config.value<string>('theme').set(theme.name);
                            } else {
                              sileo.error({
                                title: 'Uhhm..',
                                description: 'Failed to apply theme.',
                              });
                            }
                          } else {
                            const downloadThemeResult = await downloadTheme(theme);
                            if (!downloadThemeResult.success) {
                              if (
                                downloadThemeResult.error &&
                                downloadThemeResult.error.length > 0
                              ) {
                                sileo.error({
                                  title: 'Uhhm..',
                                  description: downloadThemeResult.error,
                                });
                              }
                            } else {
                              sileo.success({
                                title: 'Yaay!',
                                description: 'Theme installed successfully!',
                              });
                            }
                          }
                        }}
                      >
                        {#if theme.status === 'downloading' || theme.status === 'extracting'}
                          <span
                            class="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300 ease-out"
                            style={`width: ${Math.min(100, Math.max(0, theme.progress * 100))}%`}
                          ></span>
                          {#if !$reduceAnimations}
                            <span
                              class="theme-download-shimmer absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                            ></span>
                          {/if}
                        {/if}
                        <span class="relative z-10 flex items-center justify-center gap-2">
                          {#if theme.status === 'extracting'}
                            <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
                          {/if}
                          <TextMorph
                            text={themeButtonLabel(theme, $active_custom_theme?.folder_name)}
                            duration={260}
                            ease="cubic-bezier(0.19, 1, 0.22, 1)"
                            disabled={$reduceAnimations}
                            class="whitespace-nowrap"
                          />
                        </span>
                      </Button>
                      {#if theme.status === 'installed' && theme.definition}
                        <Button
                          class="min-w-10"
                          size="icon"
                          variant="secondary"
                          title="Edit theme"
                          onclick={() => openThemeEditor(theme)}
                        >
                          <Pencil />
                        </Button>
                      {/if}
                      {#if theme.status === 'installed' && theme.updateAvailable}
                        <Button
                          class="min-w-10"
                          size="icon"
                          variant="secondary"
                          title="Update theme"
                          onclick={async () => {
                            const wasActive =
                              $active_custom_theme?.folder_name === theme.folder_name;
                            const updateResult = await downloadTheme(theme, true);
                            if (!updateResult.success) {
                              sileo.error({
                                title: 'Uhhm..',
                                description: updateResult.error || 'Failed to update theme.',
                              });
                              return;
                            }

                            if (wasActive && $custom_theme_container) {
                              const updatedTheme = get(custom_themes).find(
                                (candidate) => candidate.name === theme.name
                              );
                              if (updatedTheme) {
                                await loadTheme(
                                  updatedTheme,
                                  $custom_theme_container,
                                  $custom_theme_volume
                                );
                              }
                            }

                            sileo.success({
                              title: 'Yaay!',
                              description: 'Theme updated successfully!',
                            });
                          }}
                        >
                          <CloudDownload />
                        </Button>
                      {/if}
                      {#if (theme.status === 'installed' || theme.status === 'deleting') && $active_custom_theme && $active_custom_theme.folder_name !== theme.folder_name && theme.name !== 'Default'}
                        <Button
                          class="min-w-10"
                          size="icon"
                          variant="destructive"
                          disabled={theme.status !== 'installed'}
                          onclick={async () => {
                            try {
                              const deleteResult = await deleteTheme(theme);
                              if (deleteResult) {
                                sileo.success({
                                  title: 'Yaay!',
                                  description: 'Theme uninstalled successfully!',
                                });
                              } else {
                                sileo.error({
                                  title: 'Uhhm..',
                                  description: 'Failed to uninstall theme.',
                                });
                              }
                            } catch (err) {
                              console.log(err);
                              sileo.error({
                                title: 'Uhhm..',
                                description: 'Failed to uninstall theme.',
                              });
                            }
                          }}
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
            {#if filteredThemes.length === 0}
              <div
                class="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
              >
                <Search class="size-8 opacity-50" />
                <p class="text-sm font-semibold text-theme-100">No themes found</p>
                <p class="max-w-sm text-xs">
                  Try another search, or create a new API 2.0 theme with the button above.
                </p>
              </div>
            {/if}
          </ScrollContainer>
        </div>
      </div>
    {/if}
  </div>
  {#if selectedView === 'HOME' && $active_custom_theme?.definition?.elements?.length}
    <div class="pointer-events-none absolute inset-0 z-20">
      <ThemeV2Elements
        elements={$active_custom_theme.definition.elements}
        assets={$active_custom_theme.assets}
      />
    </div>
  {/if}
</div>

<style>
  @keyframes theme-download-shimmer {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(200%);
    }
  }

  .theme-download-shimmer {
    animation: theme-download-shimmer 1.8s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .theme-download-shimmer {
      animation: none;
    }
  }
</style>
