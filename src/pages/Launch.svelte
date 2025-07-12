<script lang="ts">
  import Logo from '$assets/logo.png';
  import * as Avatar from '@/components/ui/avatar';
  import Badge from '@/components/ui/badge/badge.svelte';
  import Button from '@/components/ui/button/button.svelte';
  import * as Select from '@/components/ui/select';
  import {
    beatmapSets,
    currentSkin,
    currentView,
    discordPresence,
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
  } from '@/global';
  import {
    LoaderCircle,
    Logs,
    Music2,
    Play,
    Wifi,
    Gamepad2,
    WifiOff,
    Settings2,
    Drum,
    Cherry,
    Piano,
    Circle,
    LogOut,
    LogIn,
    Brush,
    Heart,
    ArrowRight,
  } from 'lucide-svelte';
  import NumberFlow from '@number-flow/svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import Progress from '@/components/ui/progress/progress.svelte';
  import {
    compareBuildNumbers,
    formatBytes,
    formatTimeReadable,
    numberHumanReadable,
    openURL,
    releaseStreamToReadable,
    urlIsValidImage,
  } from '@/utils';
  import { fade, scale } from 'svelte/transition';
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
  import { toast } from 'svelte-sonner';
  import Login from './Login.svelte';
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
    exit,
    getBeatmapSetsCount,
    getEZPPLauncherUpdateFiles,
    getReleaseStream,
    getSkin,
    getSkinsCount,
    getVersion,
    hasOsuWinello,
    hasWMCTRL,
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
  import Hearts from '@/components/ui/effects/Hearts.svelte';
  import { EZPPActionStatus } from '@/types';
  import * as presence from '@/presence';

  let selectedTab = $state('home');
  let progress = $state(-1);
  let launchInfo = $state('');
  let launchError = $state<Error | undefined>(undefined);

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
        toast.error('Oops...', {
          description:
            'The selected folder is not a valid osu! installation folder. Please select the correct folder.',
        });
        return;
      }
      osuInstallationPath.set(selectedPath);
      $userSettings.value('osu_installation_path').set(selectedPath);
      $userSettings.save();
      toast.success('osu! installation path set successfully.');

      const beatmapSetCount: number | null = await getBeatmapSetsCount(selectedPath);
      if (beatmapSetCount) {
        beatmapSets.set(beatmapSetCount);
      }

      const skinsCount: number | null = await getSkinsCount(selectedPath);
      if (skinsCount) {
        skins.set(skinsCount);
      }
      const skin: string = await getSkin(selectedPath);
      currentSkin.set(skin);
    }
  };

  const launch = async () => {
    const osuRunning = await isOsuRunning();
    if (osuRunning) {
      toast.error('Hold on a second!', {
        description:
          'osu! is currently running, please exit osu! before launching via EZPPLauncher!',
      });
      return;
    }
    if (!$osuBuild) {
      toast.error('Hmmm...', {
        description: 'There was an issue detecting your installed osu! version',
      });
      return;
    }
    const osuPath = $osuInstallationPath;

    launchInfo = 'Validating osu! installation...';
    launching.set(true);

    const validFolder = await isValidOsuFolder(osuPath);
    if (!validFolder) {
      toast.error('Hmmm...', {
        description: 'Your selected osu! installation folder is not valid.',
      });
      launching.set(false);
      return;
    }

    if($platform === "linux"){
      if(!(await hasWMCTRL())){
        toast.error('Hmmm...', {
          description: 'wmctrl seems to be missing, please install via AUR.',
        });
        launching.set(false);
      return;
      }
      if(!(await hasOsuWinello())){
        toast.error('Hmmm...', {
          description: 'osu-winello seems to be missing, please install it.',
        });
        launching.set(false);
      return;
      }
    }

    try {
      launchInfo = 'Looking for EZPPLauncher File updates...';
      const updateResult = await getEZPPLauncherUpdateFiles(osuPath);

      if (updateResult) {
        if (updateResult.filesToDownload.length > 0) {
          launchInfo = 'Found EZPPLauncher File updates!';
          await new Promise((res) => setTimeout(res, 1000));
          await downloadEZPPLauncherUpdateFiles(
            osuPath,
            updateResult.filesToDownload,
            updateResult.updateFiles,
            (file) => {
              progress = file.progress;
              launchInfo = `Downloading ${file.fileName}(${formatBytes(
                file.downloaded
              )}/${formatBytes(file.size)})...`;
            }
          );
          progress = -1;
        } else {
          launchInfo = 'EZPPLauncher Files are up to date!';
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    } catch (err) {
      console.log(err);
      launchError = err as Error;
      launching.set(false);
      return;
    }

    try {
      const streamInfo = await osuapi.latestBuildVersion('stable40');
      if (!streamInfo) {
        toast.error('Hmmm...', {
          description: 'Failed to check for updates.',
        });
        launching.set(false);
        return;
      }

      const releaseStream = await getReleaseStream(osuPath);
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
              value: password,
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

      launchInfo = 'Cleaning up...';
      await getCurrentWindow().show();
      if (presenceUpdater) {
        window.clearInterval(presenceUpdater);
        console.log('clearing discord presence...');
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
        console.log('discord presence cleared...');
      }
      await new Promise((res) => setTimeout(res, 1000));
      await replaceUIFiles(osuPath, true);

      const osuReleaseStream = await getReleaseStream(osuPath);
      osuStream.set(osuReleaseStream);
      const osuVersion = await getVersion(osuPath);
      osuBuild.set(osuVersion);

      const beatmapSetCount = await getBeatmapSetsCount(osuPath);
      if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

      const skinCount = await getSkinsCount(osuPath);
      if (skinCount) skins.set(skinCount);

      const skin = await getSkin(osuPath);
      currentSkin.set(skin);

      if ($currentUser) {
        const userInfo = await ezppfarm.getUserInfo($currentUser.id);
        if (userInfo) currentUserInfo.set(userInfo.player);
      }

      launching.set(false);
    } catch (err) {
      launchError = err as Error;
      console.log(err);
      toast.error('Hmmm...', {
        description: 'Failed to launch.',
      });
      launching.set(false);
    }
  };
</script>

<AlertDialog.Root open={launchError !== undefined}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Error on Launch!</span>
    </div>
    <div
      class="flex flex-col items-center text-sm text-center bg-theme-900 border border-theme-800 rounded-lg mx-3 p-3"
    >
      {#if launchError}
        <pre class="text-wrap text-start">{JSON.stringify(
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

<AlertDialog.Root bind:open={$launching}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Launching...</span>
    </div>
    <div class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg">
      <Progress indeterminate={progress === -1} value={progress} />
      <span class="text-muted-foreground text-sm mt-4">{launchInfo}</span>
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<div class="grid grid-cols-[0.41fr_1fr] mt-[50px] h-[calc(100vh-50px)]">
  <div class="w-full h-full border-r border-theme-800/90 flex flex-col gap-6 py-3">
    <div class="flex flex-col items-center gap-2 border-b pb-6">
      <div class="size-20 relative">
        {#if $currentUser?.donor}
          <Hearts className="top-0 left-0 h-[70px] w-[60px] absolute"></Hearts>
        {/if}
        <Avatar.Root class="w-20 h-20 border-2 border-theme-800">
          <Avatar.Image src="https://a.ez-pp.farm/{$currentUser?.id ?? 0}" />
          <Avatar.Fallback class="bg-theme-900">
            <LoaderCircle class="animate-spin" size={32} />
          </Avatar.Fallback>
        </Avatar.Root>
      </div>
      <span class="font-semibold text-2xl text-theme-50">{$currentUser?.name ?? 'Guest'}</span>
      <div class="flex flex-row gap-2">
        {#if !$currentUser}
          <Button
            variant="outline"
            size="sm"
            class="bg-theme-900 hover:bg-theme-700/40 border-theme-800 text-xs"
            onclick={() => currentView.set(Login)}
          >
            <LogIn class="!size-4" />
            Login
          </Button>
        {:else}
          <Button
            variant="outline"
            size="sm"
            class="bg-theme-900 hover:bg-theme-700/40 border-theme-800 text-xs"
            onclick={async () => {
              $userAuth.value('username').del();
              $userAuth.value('password').del();
              await $userAuth.save();
              toast.success('Logout successful!', {
                description: 'See you soon!',
              });
              currentUser.set(undefined);
              currentUserInfo.set(undefined);
            }}
          >
            <LogOut class="!size-4" />
            Logout
          </Button>
        {/if}
      </div>
    </div>
    {#if $currentUser}
      <div class="flex flex-col gap-6 h-full px-3">
        <div
          in:scale={{ duration: $reduceAnimations ? 0 : 400, start: 0.98 }}
          out:scale={{ duration: $reduceAnimations ? 0 : 400, start: 0.98 }}
        >
          <Select.Root
            type="single"
            value={selectedGamemode.toFixed()}
            onValueChange={updateGamemode}
          >
            <Select.Trigger
              class="border-theme-800/90 bg-theme-900/90 !text-muted-foreground font-semibold"
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
                      <Circle size={16} class="text-theme-200" />
                    {:else if gamemod.mode === 1}
                      <Drum size={16} class="text-theme-200" />
                    {:else if gamemod.mode === 2}
                      <Cherry size={16} class="text-theme-200" />
                    {:else if gamemod.mode === 3}
                      <Piano size={16} class="text-theme-200" />
                    {/if}
                    {getGamemodeName(modeIntToStr(gamemod.mode), typeIntToStr(gamemod.type))}
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div
          class="bg-theme-900/90 border border-theme-800/90 rounded-lg p-2"
          in:scale={{
            duration: $reduceAnimations ? 0 : 400,
            delay: $reduceAnimations ? 0 : 50,
            start: 0.98,
          }}
          out:scale={{
            duration: $reduceAnimations ? 0 : 400,
            delay: $reduceAnimations ? 0 : 50,
            start: 0.98,
          }}
        >
          <div class="flex flex-row items-center gap-2">
            <Logs class="text-muted-foreground" size="16" />
            <span class="font-semibold text-muted-foreground text-sm">Mode Stats</span>
          </div>
          <div class="grid grid-cols-2 mt-2 border-t border-theme-800 pt-2 pb-2">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm text-muted-foreground font-semibold">Rank</span>
              <div class="flex items-center h-full text-lg font-semibold text-theme-50">
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
            <div class="flex flex-col gap-0.5">
              <span class="text-sm text-muted-foreground font-semibold">PP</span>
              <div class="flex items-center h-full text-lg font-semibold text-theme-50">
                {#if $currentUserInfo}
                  <div in:fade>
                    {#if $reduceAnimations}
                      <span>
                        {numberHumanReadable($currentUserInfo.stats[selectedGamemode].pp ?? 0)}
                      </span>
                    {:else}
                      <NumberFlow
                        trend={0}
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
          </div>
          <div class="grid grid-cols-[1fr_auto] border-t border-theme-800 pt-2">
            <span class="text-xs text-muted-foreground font-semibold">Accuracy</span>
            <div
              class="flex items-center flex-row-reverse h-full text-xs text-end font-semibold text-theme-50"
            >
              {#if $currentUserInfo}
                <div in:fade>
                  {#if $reduceAnimations}
                    <span>{($currentUserInfo.stats[selectedGamemode].acc ?? 0).toFixed(2)}%</span>
                  {:else}
                    <NumberFlow
                      class="leading-none"
                      trend={0}
                      suffix="%"
                      value={($currentUserInfo.stats[selectedGamemode].acc ?? 0).toFixed(2)}
                    />
                  {/if}
                </div>
              {:else}
                <div in:fade>
                  <LoaderCircle class="animate-spin" size={21} />
                </div>
              {/if}
            </div>

            <span class="text-xs text-muted-foreground font-semibold">Play Count</span>
            <div
              class="flex items-center flex-row-reverse h-full text-xs text-end font-semibold text-theme-50"
            >
              {#if $currentUserInfo}
                <div in:fade>
                  {#if $reduceAnimations}
                    <span
                      >{numberHumanReadable(
                        $currentUserInfo.stats[selectedGamemode].plays ?? 0
                      )}</span
                    >
                  {:else}
                    <NumberFlow
                      class="leading-none"
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

            <span class="text-xs text-muted-foreground font-semibold">Play Time</span>
            <div
              class="flex items-center flex-row-reverse h-full text-xs text-end font-semibold text-theme-50"
            >
              {#if $currentUserInfo}
                <div in:fade>
                  {formatTimeReadable($currentUserInfo.stats[selectedGamemode].playtime ?? 0)}
                </div>
              {:else}
                <div in:fade>
                  <LoaderCircle class="animate-spin" size={21} />
                </div>
              {/if}
            </div>
          </div>
        </div>
        <!-- <div class="mt-auto bg-theme-900/90 border border-theme-800/90 rounded-lg p-2">
        <div class="flex flex-row items-center justify-between">
          <div class="flex flex-row items-center gap-2">
            <Users class="text-muted-foreground" size="16" />
            <span class="font-semibold text-muted-foreground text-sm"> Friends </span>
          </div>
          <Badge class="h-5 bg-green-500/20 hover:bg-green-500/20 text-green-500">3 online</Badge>
        </div>
      </div> -->
      </div>
    {/if}
  </div>
  <div class="flex flex-col gap-6 w-full h-full bg-theme-900/40 p-6">
    <div
      class="flex flex-row flex-nowrap h-11 gap-1 w-full bg-theme-800/50 border border-theme-800/90 rounded-lg p-[4px]"
    >
      <button
        class="w-full flex justify-center items-center font-semibold text-sm rounded-lg {selectedTab ===
        'home'
          ? 'bg-white/70 border border-white/60 text-theme-950'
          : ''} transition-all"
        onclick={() => (selectedTab = 'home')}
      >
        Home
      </button>
      <button
        class="w-full flex justify-center items-center font-semibold text-sm rounded-lg {selectedTab ===
        'settings'
          ? 'bg-white/70 border border-white/60 text-theme-950'
          : ''} transition-all"
        onclick={() => (selectedTab = 'settings')}
      >
        Settings
      </button>
    </div>
    {#if selectedTab === 'home'}
      <div
        class="my-auto bg-theme-900/90 flex flex-col items-center justify-center gap-6 border border-theme-800/90 rounded-lg p-6"
        in:scale={{ duration: $reduceAnimations ? 0 : 400, start: 0.98 }}
      >
        <div class="grid grid-cols-3 w-full gap-3">
          <div
            class="bg-theme-800/90 border border-theme-700/90 rounded-lg px-2 py-4 w-full flex flex-col gap-1 items-center justify-center"
          >
            <div class="flex items-center justify-center p-2 rounded-lg bg-blue-500/20">
              <Music2 class="text-blue-500" size="26" />
            </div>
            <div class="relative font-bold text-xl text-blue-400">
              <div
                class="absolute top-1 left-1/2 -translate-x-1/2 {!$beatmapSets
                  ? 'opacity-100'
                  : 'opacity-0'} transition-opacity duration-1000"
              >
                <LoaderCircle class="animate-spin" />
              </div>
              <div
                class="{!$beatmapSets
                  ? 'opacity-0'
                  : 'opacity-100'} transition-opacity duration-1000"
              >
                {#if $reduceAnimations}
                  <span>{numberHumanReadable($beatmapSets ?? 0)}</span>
                {:else}
                  <NumberFlow value={$beatmapSets ?? 0} trend={0} />
                {/if}
              </div>
            </div>
            <div class="text-muted-foreground text-[12px] leading-4">Beatmap Sets imported</div>
          </div>
          <div
            class="bg-theme-800/90 border border-theme-700/90 rounded-lg px-2 py-4 w-full flex flex-col gap-1 items-center justify-center"
          >
            <div class="flex items-center justify-center p-2 rounded-lg bg-yellow-500/20">
              <Brush class="text-yellow-500" size="26" />
            </div>
            <div class="relative font-bold text-xl text-yellow-400">
              <div
                class="absolute top-1 left-1/2 -translate-x-1/2 {!$skins
                  ? 'opacity-100'
                  : 'opacity-0'} transition-opacity duration-1000"
              >
                <LoaderCircle class="animate-spin" />
              </div>
              <div class="{!$skins ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000">
                {#if $reduceAnimations}
                  <span>{numberHumanReadable($skins ?? 0)}</span>
                {:else}
                  <NumberFlow value={$skins ?? 0} trend={0} />
                {/if}
              </div>
            </div>
            <div class="text-muted-foreground text-[12px] leading-4">Skins</div>
          </div>
          <!-- <div
          class="bg-theme-800/90 border border-theme-700/90 rounded-lg px-2 py-4 w-full flex flex-col gap-1 items-center justify-center"
        >
          <div
            class="flex items-center justify-center p-2 rounded-lg {$server_connection_fails > 1
              ? 'bg-red-500/20'
              : 'bg-yellow-500/20'}"
          >
            {#if $server_connection_fails > 1}
              <Users class="text-red-500" size="26" />
            {:else}
              <Users class="text-yellow-500" size="26" />
            {/if}
          </div>
          <div
            class="relative font-bold text-xl {$server_connection_fails > 1
              ? 'text-red-400'
              : 'text-yellow-400'}"
          >
            <div
              class="absolute top-1 left-1/2 -translate-x-1/2 {!$online_friends ||
              $server_connection_fails > 1
                ? 'opacity-100'
                : 'opacity-0'} transition-opacity duration-1000"
            >
              <LoaderCircle class="animate-spin" />
            </div>
            <div
              class="{!$online_friends || $server_connection_fails > 1
                ? 'opacity-0'
                : 'opacity-100'} transition-opacity duration-1000"
            >
              <NumberFlow value={$online_friends ?? 0} trend={0} />
            </div>
          </div>
          <div class="text-muted-foreground text-sm">Friends online</div>
        </div> -->
          <div
            class="bg-theme-800/90 border border-theme-700/90 rounded-lg px-2 py-4 w-full flex flex-col gap-1 items-center justify-center"
          >
            <div
              class="flex items-center justify-center p-2 rounded-lg {$serverConnectionFails > 1
                ? 'bg-red-500/20'
                : 'bg-green-500/20'}"
            >
              {#if $serverConnectionFails > 1}
                <WifiOff class="text-red-500" size="26" />
              {:else}
                <Wifi class="text-green-500" size="26" />
              {/if}
            </div>
            <div
              class="relative font-bold text-xl {$serverConnectionFails > 1
                ? 'text-red-400'
                : 'text-green-400'}"
            >
              <div
                class="absolute top-1 left-1/2 -translate-x-1/2 {!$serverPing ||
                $serverConnectionFails > 1
                  ? 'opacity-100'
                  : 'opacity-0'} transition-opacity duration-1000"
              >
                <LoaderCircle class="animate-spin" />
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
            </div>
            <div class="text-muted-foreground text-[12px] leading-4">Ping to Server</div>
          </div>
        </div>
        <Button
          size="lg"
          disabled={$launching || $osuInstallationPath === '' || $serverConnectionFails > 1}
          onclick={launch}
        >
          <Play />
          {$serverConnectionFails > 1 ? 'No connection' : 'Launch'}
        </Button>
      </div>
      <div
        class="mt-auto bg-theme-900/90 border border-theme-800/90 rounded-lg px-6 py-3"
        in:scale={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 50,
          start: 0.98,
        }}
      >
        <div class="flex flex-row items-center gap-2">
          <Gamepad2 class="text-muted-foreground" size="24" />
          <span class="font-semibold text-muted-foreground text-sm">Client Info</span>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-1 mt-2 border-t border-theme-800 pt-2 px-2 pb-0">
          <span class="text-xs text-muted-foreground font-semibold">osu! Release Stream</span>
          <span class="text-xs font-semibold text-end text-theme-50">
            <Badge class="text-[0.65rem] py-0.5 px-2 leading-none">
              {#if $osuStream}
                {releaseStreamToReadable($osuStream)}
              {:else}
                <LoaderCircle class="animate-spin" size={12} />
              {/if}
            </Badge>
          </span>
          <span class="text-xs text-muted-foreground font-semibold">osu! Version</span>
          <span class="text-xs font-semibold text-end text-theme-50">
            <Badge class="text-[0.65rem] py-0.5 px-2 leading-none">
              {#if $osuBuild}
                {$osuBuild}
              {:else}
                <LoaderCircle class="animate-spin" size={12} />
              {/if}
            </Badge>
          </span>
          <span class="text-xs text-muted-foreground font-semibold">Skin</span>
          <span class="text-xs font-semibold text-end text-theme-50">
            <Badge class="text-[0.65rem] py-0.5 px-2 leading-none">
              {#if $currentSkin}
                {$currentSkin}
              {:else}
                <LoaderCircle class="animate-spin" size={12} />
              {/if}
            </Badge>
          </span>
        </div>
      </div>
    {:else if selectedTab === 'settings'}
      <div
        class="bg-theme-900/90 flex flex-col justify-center gap-3 border border-theme-800/90 rounded-lg"
        in:scale={{ duration: $reduceAnimations ? 0 : 400, start: 0.98 }}
      >
        <div class="flex flex-row items-center gap-3 font-semibold text-xl px-3 pt-3">
          <Settings2 /> EZPPLauncher Settings
        </div>
        <div>
          <div
            class="grid grid-cols-[1fr_auto] gap-y-5 items-center border-t border-theme-800 pt-4 pb-1 px-6"
          >
            <div class="flex flex-col">
              <Label class="text-sm" for="setting-custom-cursor">Patching</Label>
              <div class="text-muted-foreground text-xs">Shows misses in Relax and Autopilot {#if $platform !== "windows"}<span class="text-red-500 bg-red-800/20 border border-red-600/20 p-0.5 mx-1 px-2 rounded-lg">currently only on windows!</span> {/if}</div>
            </div>
            <Checkbox
              id="setting-custom-cursor"
              checked={$platform === "windows" ? $patch : false}
              disabled={$platform !== "windows"}
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
          </div>
          <div
            class="grid grid-cols-[0.7fr_auto] gap-y-5 items-center border-theme-800 pl-6 pr-5 pb-4"
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
          </div>
        </div>
      </div>
      <div
        class="mt-auto mx-auto flex flex-row items-center gap-2"
        in:scale={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 50,
          start: 0.97,
        }}
      >
        <Button
          variant="link"
          class="font-light font-mono text-sm text-theme-100/70"
          onclick={() => openURL('https://ez-pp.farm/u/1001')}
        >
          made with
          <Heart class="text-red-600 fill-red-600 animate-pulse" />
          by horizoncode
        </Button>
      </div>
    {/if}
  </div>
</div>
