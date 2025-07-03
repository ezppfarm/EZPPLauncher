<script lang="ts">
  import Logo from '$assets/logo.png';
  import * as Avatar from '@/components/ui/avatar';
  import Badge from '@/components/ui/badge/badge.svelte';
  import Button from '@/components/ui/button/button.svelte';
  import * as Select from '@/components/ui/select';
  import { beatmapSets, currentView, serverConnectionFails, serverPing } from '@/global';
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
  } from 'lucide-svelte';
  import NumberFlow from '@number-flow/svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import Progress from '@/components/ui/progress/progress.svelte';
  import { formatTimeReadable, numberHumanReadable } from '@/utils';
  import { fade, scale } from 'svelte/transition';
  import { Checkbox } from '@/components/ui/checkbox';
  import Label from '@/components/ui/label/label.svelte';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    preferredMode,
    preferredType,
    reduceAnimations,
    userSettings,
  } from '@/userSettings';
  import Input from '@/components/ui/input/input.svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
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

  let selectedTab = $state('home');
  let launching = $state(false);

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
      const validFolder: boolean = await invoke('valid_osu_folder', { folder: selectedPath });
      if (!validFolder) {
        toast.error(
          'The selected folder is not a valid osu! installation folder. Please select the correct folder.'
        );
        return;
      }
      osuInstallationPath.set(selectedPath);
      $userSettings.value('osu_installation_path').set(selectedPath);
      $userSettings.save();
      toast.success('osu! installation path set successfully.');

      const beatmapSetCount: number | null = await invoke('get_beatmapsets_count', {
        folder: selectedPath,
      });
      if (beatmapSetCount) {
        beatmapSets.set(beatmapSetCount);
      }
    }
  };
</script>

<AlertDialog.Root bind:open={launching}>
  <AlertDialog.Content class="bg-theme-950 border-theme-800 p-0">
    <div
      class="flex flex-col items-center justify-center border-b border-theme-800 bg-black/40 rounded-t-lg p-3"
    >
      <img class="h-20 w-20" src={Logo} alt="logo" />
      <span class="font-semibold text-xl">Launching...</span>
    </div>
    <div class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg">
      <Progress indeterminate />
      <span class="text-muted-foreground">Downloading update files...</span>
    </div>
  </AlertDialog.Content>
</AlertDialog.Root>

<div class="grid grid-cols-[0.41fr_1fr] mt-[50px] h-[calc(100vh-50px)]">
  <div class="w-full h-full border-r border-theme-800/90 flex flex-col gap-6 py-3">
    <div class="flex flex-col items-center gap-2 border-b pb-6">
      <Avatar.Root class="w-20 h-20 border-2 border-theme-800">
        <Avatar.Image src="https://a.ez-pp.farm/{$currentUser?.id ?? 0}" />
        <Avatar.Fallback class="bg-theme-900">
          <LoaderCircle class="animate-spin" size={32} />
        </Avatar.Fallback>
      </Avatar.Root>
      <span class="font-semibold text-2xl text-theme-50">{$currentUser?.name ?? 'Guest'}</span>
      <div class="flex flex-row gap-2">
        <!-- <Badge variant="destructive">Owner</Badge> -->
        {#if !$currentUser}
          <Button
            variant="outline"
            size="sm"
            class="bg-theme-900 hover:bg-theme-700/40 border-theme-800"
            onclick={() => currentView.set(Login)}
          >
            <LogIn size={16} />
            Login
          </Button>
        {:else}
          <Button
            variant="outline"
            size="sm"
            class="bg-theme-900 hover:bg-theme-700/40 border-theme-800"
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
            <LogOut size={16} />
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
              {#each validModeTypeCombinationsSorted as gamemode}
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
                    <NumberFlow
                      trend={0}
                      prefix="#"
                      value={$currentUserInfo.stats[selectedGamemode].rank ?? 0}
                    ></NumberFlow>
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
                    <NumberFlow trend={0} value={$currentUserInfo.stats[selectedGamemode].pp ?? 0}
                    ></NumberFlow>
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
            <span class="text-sm text-muted-foreground font-semibold">Accuracy</span>
            <div
              class="flex items-center flex-row-reverse h-full text-sm text-end font-semibold text-theme-50"
            >
              {#if $currentUserInfo}
                <div in:fade>
                  <NumberFlow
                    trend={0}
                    suffix="%"
                    value={$currentUserInfo.stats[selectedGamemode].acc.toFixed(2) ?? 0}
                  ></NumberFlow>
                </div>
              {:else}
                <div in:fade>
                  <LoaderCircle class="animate-spin" size={21} />
                </div>
              {/if}
            </div>

            <span class="text-sm text-muted-foreground font-semibold">Play Count</span>
            <div
              class="flex items-center flex-row-reverse h-full text-sm text-end font-semibold text-theme-50"
            >
              {#if $currentUserInfo}
                <div in:fade>
                  <NumberFlow trend={0} value={$currentUserInfo.stats[selectedGamemode].plays ?? 0}
                  ></NumberFlow>
                </div>
              {:else}
                <div in:fade>
                  <LoaderCircle class="animate-spin" size={21} />
                </div>
              {/if}
            </div>

            <span class="text-sm text-muted-foreground font-semibold">Play Time</span>
            <div
              class="flex items-center flex-row-reverse h-full text-sm text-end font-semibold text-theme-50"
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
      class="flex flex-row flex-nowrap h-11 w-full bg-theme-800/50 border border-theme-800/90 rounded-lg p-[4px]"
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
        <div class="grid grid-cols-2 w-full gap-3">
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
            <div class="text-muted-foreground text-sm">Beatmap Sets imported</div>
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
            <div class="text-muted-foreground text-sm">Ping to Server</div>
          </div>
        </div>
        <Button
          size="lg"
          disabled={launching || $osuInstallationPath === ''}
          onclick={() => {
            launching = true;
            setTimeout(() => {
              launching = false;
            }, 5000);
          }}
        >
          <Play />
          Launch {$serverConnectionFails > 1 ? 'offline' : ''}
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
        <div class="grid grid-cols-[1fr_auto] gap-1 mt-2 border-t border-theme-800 pt-2 px-2 pb-2">
          <span class="text-sm text-muted-foreground font-semibold">osu! Version</span>
          <span class="text-sm font-semibold text-end text-theme-50">
            <Badge>20250626.1</Badge>
          </span>

          <span class="text-sm text-muted-foreground font-semibold">Beatmap Sets</span>
          <span class="text-sm font-semibold text-end text-theme-50"
            >{numberHumanReadable($beatmapSets ?? 0)}</span
          >

          <span class="text-sm text-muted-foreground font-semibold">Skins</span>
          <span class="text-sm font-semibold text-end text-theme-50"
            >{numberHumanReadable(727)}</span
          >
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
        <div
          class="grid grid-cols-[1fr_auto] gap-y-5 items-center border-t border-theme-800 py-3 px-6"
        >
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
            <Label class="text-sm" for="setting-cursor-smoothening">Reduce Animations</Label>
            <div class="text-muted-foreground text-xs">
              Disables some animations in the Launcher to improve performance on low-end devices.
            </div>
          </div>
          <Checkbox
            id="setting-cursor-smoothening"
            checked={$reduceAnimations}
            onCheckedChange={async (e) => {
              reduceAnimations.set(e);
              $userSettings.save();
            }}
            disabled={!$customCursor}
            class="flex items-center justify-center w-5 h-5"
          ></Checkbox>
        </div>
      </div>
      <div
        class="bg-theme-900/90 flex flex-col justify-center gap-3 border border-theme-800/90 rounded-lg"
        in:scale={{
          duration: $reduceAnimations ? 0 : 400,
          delay: $reduceAnimations ? 0 : 50,
          start: 0.98,
        }}
      >
        <div class="flex flex-row items-center gap-3 font-semibold text-xl px-3 pt-3">
          <Settings2 /> osu! Settings
        </div>
        <div
          class="grid grid-cols-[0.7fr_auto] gap-y-5 items-center border-t border-theme-800 py-3 px-6"
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
    {/if}
  </div>
</div>
