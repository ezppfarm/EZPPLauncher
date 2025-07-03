<script lang="ts">
  import Logo from '$assets/logo.png';
  import Button from '@/components/ui/button/button.svelte';
  import Input from '@/components/ui/input/input.svelte';
  import { animate } from 'animejs';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { Check, CheckCircle, CircleOff, Settings2 } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import Checkbox from '@/components/ui/checkbox/checkbox.svelte';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    reduceAnimations,
    userSettings,
  } from '@/userSettings';
  import Label from '@/components/ui/label/label.svelte';
  import { beatmapSets, currentView, osuBuild, osuStream, skins } from '@/global';
  import Launch from './Launch.svelte';
  import Confetti from 'svelte-confetti';

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
      const validFolder: boolean = await invoke('valid_osu_folder', { folder: selectedPath });
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

    const beatmapSetCount: number | null = await invoke('get_beatmapsets_count', {
      folder: osuInstallPath,
    });
    if (beatmapSetCount) {
      beatmapSets.set(beatmapSetCount);
    }

    const skinsCount: number | null = await invoke('get_skins_count', {
      folder: osuInstallPath,
    });
    if (skinsCount) {
      skins.set(skinsCount);
    }

    const osuReleaseStream: string = await invoke('get_osu_release_stream', {
      folder: $osuInstallationPath,
    });
    osuStream.set(osuReleaseStream);
    const osuVersion: string = await invoke('get_osu_version', {
      folder: $osuInstallationPath,
    });
    osuBuild.set(osuVersion);

    currentView.set(Launch);
  };

  onMount(async () => {
    const osuPath: string | null = await invoke('find_osu_installation');
    if (osuPath) {
      osuInstallPath = osuPath;
      autoDetectedOsuPath = true;
      $userSettings.value('osu_installation_path').set(osuInstallPath);
    }
  });
</script>

{#if wizardFinished}
  <div class="relative flex flex-col items-center justify-center mt-[50px] h-[calc(100vh-50px)]">
    <div class="absolute h-fit w-fit top-1/2 left-1/2">
      <Confetti amount={200} y={[-1, 1.5]} x={[-2.3, 2.3]} colorArray={['#C6A0F3']} />
    </div>
    <h1 class="text-3xl font-semibold">EZPPLauncher Setup completed!</h1>
    <p class="text-muted-foreground mt-2">You are now ready to farm some maps!</p>
    <Button class="mt-4" onclick={saveConfig}>Finish</Button>
  </div>
{:else}
  <div class="grid grid-cols-[0.41fr_1fr] mt-[50px] h-[calc(100vh-50px)]">
    <div class="w-full h-full border-r border-theme-800/90 flex flex-col gap-6 p-3">
      {#each steps as step, i (step)}
        <div
          class="flex flex-row items-center gap-2 border {selectedStep === i + 1
            ? 'border-primary-800/30 bg-primary-900/30'
            : selectedStep > i
              ? 'border-green-800/30 bg-green-900/30'
              : 'border-theme-800 bg-theme-900'} rounded-lg p-2 transition-all"
        >
          <div
            class="flex flex-col items-center justify-center h-8 w-8 border-[2px] {selectedStep >
            i + 1
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
    <div class="flex flex-col gap-6 w-full h-full bg-theme-900/40 p-6">
      {#if selectedStep === 1}
        <div
          class="my-auto h-full w-full bg-theme-800/15 rounded-lg border border-900/60 p-6 flex flex-col items-center justify-center"
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
          <div class="bg-red-800/20 border border-red-900/20 text-red-500 p-4 rounded-lg mt-4">
            Please make sure you have osu! installed on your system before proceeding.
          </div>
        </div>
      {:else if selectedStep === 2}
        <div
          class="my-auto h-full w-full bg-theme-800/15 rounded-lg border border-900/60 p-6 flex flex-col items-center justify-center"
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
                class="flex flex-row gap-3 bg-green-800/20 border border-green-900/20 text-green-500 p-4 rounded-lg mt-4"
              >
                <CheckCircle />
                <span>Auto-detected osu! installation path! Please check if its correct!</span>
              </div>
            {:else}
              <div
                class="flex flex-row gap-3 bg-red-800/20 border border-red-900/20 text-red-500 p-4 rounded-lg mt-4"
              >
                <CircleOff />
                <span>Could not auto-detect osu! installation path. Please select it manually.</span
                >
              </div>
            {/if}
          {:else if manualSelectValid}
            <div
              class="flex flex-row gap-3 bg-green-800/20 border border-green-900/20 text-green-500 p-4 rounded-lg mt-4"
            >
              <CheckCircle />
              <span>Selected osu! installation path is valid!</span>
            </div>
          {:else}
            <div
              class="flex flex-row gap-3 bg-red-800/20 border border-red-900/20 text-red-500 p-4 rounded-lg mt-4"
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
        <div
          class="bg-theme-900/90 flex flex-col justify-center gap-3 border border-theme-800/90 rounded-lg"
          in:fade={{ duration: $reduceAnimations ? 0 : 200 }}
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
              }}
              disabled={!$customCursor}
              class="flex items-center justify-center w-5 h-5"
            ></Checkbox>
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
            (selectedStep === 2 && osuInstallPath.length <= 0)}
          >{selectedStep >= steps.length ? 'Finish' : 'Next'}</Button
        >
      </div>
    </div>
  </div>
{/if}
