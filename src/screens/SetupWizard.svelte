<script lang="ts">
  import { dev } from '$app/environment';
  import Logo from '$assets/logo.png';
  import Button from '$lib/components/ui/button/button.svelte';
  import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import {
    beatmapSets,
    currentSkin,
    currentView,
    discordPresence,
    osuBuild,
    osuStream,
    platform,
    presenceLoading,
    skins,
    skinsCount,
  } from '$lib/global';
  import {
    autoDetectOsuInstallFolder,
    getBeatmapSetsCount,
    getReleaseStream,
    getSkin,
    getSkins,
    getVersion,
    isValidOsuFolder,
  } from '$lib/osuUtil';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    patch,
    reduceAnimations,
    userSettings,
  } from '$lib/userSettings';
  import Launch from './Launch.svelte';
  import { Check, CircleCheckBig, CircleOff, LoaderCircle } from '@lucide/svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { animate } from 'animejs';
  import { onMount } from 'svelte';
  import Confetti from 'svelte-confetti';
  import { fade } from 'svelte/transition';

  let selectedStep = $state(1);
  const steps = ['Welcome', 'Locate your osu! Installation', 'Appearance Settings'];

  let osuInstallPath = $state('');
  let manualSelect = $state(false);
  let manualSelectValid = $state(false);
  let autoDetectedOsuPath = $state(false);
  let wizardFinished = $state(false);

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

  const browse_osu_installation = async () => {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Select osu! Installation Folder',
    });

    if (typeof selectedPath === 'string') {
      const validFolder = await isValidOsuFolder(selectedPath);
      manualSelect = true;
      if (!validFolder) {
        manualSelectValid = false;
        osuInstallPath = '';
        return;
      }
      osuInstallPath = selectedPath;
      autoDetectedOsuPath = false;
      manualSelectValid = true;
    }
  };

  const saveConfig = async () => {
    $userSettings.value('osu_installation_path').set(osuInstallPath);
    await $userSettings.save();
    osuInstallationPath.set(osuInstallPath);

    const beatmapSetCount = await getBeatmapSetsCount(osuInstallPath);
    if (beatmapSetCount) {
      beatmapSets.set(beatmapSetCount);
    }

    const skins_list = await getSkins(osuInstallPath);
    if (skins_list) {
      skins.set(skins_list);
      skinsCount.set(skins_list.length);
    } else {
      skinsCount.set(0);
    }

    const skin: string = await getSkin(osuInstallPath);
    currentSkin.set(skin);

    const osuReleaseStream = await getReleaseStream(osuInstallPath);
    osuStream.set(osuReleaseStream);
    const osuVersion = await getVersion(osuInstallPath);
    osuBuild.set(osuVersion);

    currentView.set(Launch);
  };

  onMount(async () => {
    const osuPath = await autoDetectOsuInstallFolder();
    if (osuPath) {
      osuInstallPath = osuPath;
      autoDetectedOsuPath = true;
      $userSettings.value('osu_installation_path').set(osuInstallPath);
    }
  });
</script>

{#if wizardFinished}
  <div class="relative flex flex-col items-center justify-center h-screen z-50">
    <div class="absolute h-fit w-fit top-1/2 left-1/2">
      <Confetti amount={200} y={[-1, 1.5]} x={[-2.3, 2.3]} colorArray={['#C6A0F3']} />
    </div>
    <h1 class="text-3xl font-semibold">EZPPLauncher Setup completed!</h1>
    <p class="text-muted-foreground mt-2">You are now ready to farm some maps!</p>
    <Button class="mt-4" onclick={saveConfig}>Finish</Button>
  </div>
{:else}
  <div class="grid grid-cols-[0.41fr_1fr] h-screen z-50">
    <div
      class="w-full h-full border-r border-black/40 bg-black/40 backdrop-blur-md flex flex-col gap-6 p-3 z-50"
    >
      {#each steps as step, i (step)}
        <div
          class="flex flex-row items-center gap-2 border {selectedStep === i + 1
            ? 'border-primary-600/30 bg-primary-700/30'
            : selectedStep > i
              ? 'border-green-800/30 bg-green-900/30'
              : 'border-black/30 bg-black/30'} rounded-lg p-2 transition-all"
        >
          <div
            class="flex flex-col items-center justify-center h-8 w-8 border-2 {selectedStep > i + 1
              ? 'border-green-600'
              : 'border-theme-600'} rounded-full"
          >
            {#if selectedStep > i + 1}
              <Check class="mt-0.5 text-green-400" />
            {:else}
              <span class="text-lg font-semibold text-theme-100">{i + 1}</span>
            {/if}
          </div>
          <span
            class="{selectedStep === i + 1
              ? 'text-white'
              : selectedStep > i
                ? 'text-green-500'
                : "'text-muted-foreground'"} transition-all text-sm font-bold">{step}</span
          >
        </div>
      {/each}
    </div>
    <div class="flex flex-col gap-6 w-full h-full backdrop-blur-md p-6 z-50">
      {#if selectedStep === 1}
        <div
          class="my-auto h-full w-full bg-black/40 rounded-lg border border-black/40 p-6 mt-5 flex flex-col items-center justify-center"
          in:fade={{ duration: $reduceAnimations ? 0 : 200 }}
        >
          <img
            src={Logo}
            alt="EZPPLauncher Logo"
            class="w-52 h-52 mb-2"
            bind:this={ezppLogo}
            onmouseenter={logo_mouseenter}
            onmouseleave={logo_mouseleave}
          />
          <h1 class="text-3xl font-semibold">Welcome to EZPPLauncher!</h1>
          <p class="text-muted-foreground mt-2">
            This setup wizard will guide you through the initial setup of EZPPLauncher.
          </p>
          <div class="bg-red-800 border border-red-900 text-red-200 p-4 rounded-lg mt-4">
            Please make sure you have osu! installed on your system before proceeding.
          </div>
        </div>
      {:else if selectedStep === 2}
        <div
          class="my-auto h-full w-full bg-black/40 rounded-lg border border-black/40 p-6 mt-5 flex flex-col items-center justify-center"
          in:fade={{ duration: $reduceAnimations ? 0 : 200 }}
        >
          <h1 class="text-3xl font-semibold">Locate your osu! Installation</h1>
          <p class="text-muted-foreground mt-2">
            Please select the folder where your osu! installation is located.
          </p>
          <div class="flex flex-row w-full">
            <Input
              class="mt-4 w-full bg-theme-950 border-theme-800 border-r-0 rounded-r-none"
              type="text"
              placeholder="Path to osu! installation"
              value={osuInstallPath}
            />
            <Button
              class="mt-4 bg-theme-950 border-theme-800 rounded-l-none"
              variant="outline"
              onclick={browse_osu_installation}>Browse</Button
            >
          </div>
          {#if !manualSelect}
            {#if autoDetectedOsuPath}
              <div
                class="flex flex-row gap-3 bg-green-800 border border-green-900 text-green-500 p-4 rounded-lg mt-4"
              >
                <CircleCheckBig />
                <span>Auto-detected osu! installation path! Please check if its correct!</span>
              </div>
            {:else}
              <div
                class="flex flex-row gap-3 bg-red-800 border border-red-900 text-red-500 p-4 rounded-lg mt-4"
              >
                <CircleOff />
                <span>Could not auto-detect osu! installation path. Please select it manually.</span
                >
              </div>
            {/if}
          {:else if manualSelectValid}
            <div
              class="flex flex-row gap-3 bg-green-800 border border-green-900 text-green-500 p-4 rounded-lg mt-4"
            >
              <CircleCheckBig />
              <span>Selected osu! installation path is valid!</span>
            </div>
          {:else}
            <div
              class="flex flex-row gap-3 bg-red-800 border border-red-900 text-red-500 p-4 rounded-lg mt-4"
            >
              <CircleOff />
              <span
                >Selected osu! installation path is invalid! Please select a valid osu!
                installation.</span
              >
            </div>
          {/if}
        </div>
      {:else if selectedStep === 3}
        <div class="h-full w-full flex items-center justify-center">
          <div
            class="bg-black/40 backdrop-blur-sm py-8 px-8 rounded-lg"
            in:fade={{ duration: $reduceAnimations ? 0 : 200 }}
          >
            <div class="grid grid-cols-[1fr_auto] gap-y-5 items-center px-6">
              <div class="flex flex-col">
                <Label class="text-sm" for="setting-patch">Patching</Label>
                <div class="text-muted-foreground text-xs">
                  Shows misses in Relax and Autopilot {#if $platform !== 'windows'}<span
                      class="text-red-500 bg-red-800/20 border border-red-600/20 p-0.5 mx-1 px-2 rounded-lg text-[0.55rem]!"
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
                }}
                disabled={!$customCursor}
                class="flex items-center justify-center w-5 h-5"
              ></Checkbox>

              <div class="flex flex-col">
                <Label class="text-sm" for="setting-reduce-animations">Reduce Animations</Label>
                <div class="text-muted-foreground text-xs">
                  Disables some animations in the Launcher to improve performance on low-end
                  devices.
                </div>
              </div>
              <Checkbox
                id="setting-reduce-animations"
                checked={$reduceAnimations}
                onCheckedChange={async (e) => {
                  reduceAnimations.set(e);
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
          </div>
        </div>
      {/if}

      <div class="mt-auto flex flex-row items-center justify-between">
        <Button
          class="bg-theme-950 hover:bg-theme-800"
          variant="outline"
          onclick={() => (selectedStep = Math.max(selectedStep - 1, 1))}
          disabled={selectedStep <= 1}>Previous</Button
        >
        <Button
          onclick={() => {
            if (selectedStep >= steps.length) wizardFinished = true;
            else selectedStep = Math.min(selectedStep + 1, steps.length);
          }}
          disabled={selectedStep > steps.length ||
            (selectedStep === 2 && !dev && osuInstallPath.length <= 0)}
          >{selectedStep >= steps.length ? 'Finish' : 'Next'}</Button
        >
      </div>
    </div>
  </div>
{/if}
