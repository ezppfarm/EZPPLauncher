<script lang="ts">
  import { dev } from '$app/environment';
  import Logo from '$assets/logo.png';
  import ConfettiCannon from '$lib/components/confetti/ConfettiCannon.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { config } from '$lib/config';
  import {
    beatmapSets,
    currentSkin,
    currentView,
    discordPresence,
    osuBuild,
    osuStream,
    platform,
    presenceLoading,
    skinsCount,
  } from '$lib/global';
  import {
    autoDetectOsuInstallFolder,
    getBeatmapSetsCount,
    getReleaseStream,
    getSkin,
    getSkinsCount,
    getVersion,
    pickOsuInstallation,
    resolveOsuFolder,
  } from '$lib/osuUtil';
  import {
    cursorSmoothening,
    customCursor,
    osuInstallationPath,
    patch,
    reduceAnimations,
  } from '$lib/userSettings';
  import Launch from './Launch.svelte';
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    CircleAlert,
    CircleCheckBig,
    FolderOpen,
    Info,
    LoaderCircle,
    Palette,
    RefreshCw,
    Rocket,
    Search,
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  const steps = ['Welcome', 'osu! installation', 'Personalize'];

  type DetectionStatus = 'detecting' | 'valid' | 'invalid' | 'missing';

  let stepIndex = $state(0);
  let osuInstallPath = $state('');
  let manualSelection = $state(false);
  let selectionError = $state(false);
  let detecting = $state(true);
  let detectionFinished = $state(false);
  let selecting = $state(false);
  let saving = $state(false);
  let saveError = $state<string | undefined>(undefined);
  let finished = $state(false);
  let detectionRun = 0;

  const stepNumber = $derived(stepIndex + 1);

  const status: DetectionStatus = $derived(
    detecting
      ? 'detecting'
      : selectionError
        ? 'invalid'
        : osuInstallPath
          ? 'valid'
          : detectionFinished
            ? 'missing'
            : 'detecting'
  );

  const statusTitle = $derived(
    status === 'detecting'
      ? 'Looking for osu!'
      : status === 'valid'
        ? manualSelection
          ? 'osu! installation selected'
          : 'osu! found'
        : status === 'invalid'
          ? 'No osu! in that folder'
          : 'osu! not found yet'
  );

  const statusDescription = $derived(
    status === 'detecting'
      ? 'Checking your applications and Wine bottles…'
      : status === 'valid'
        ? manualSelection
          ? 'That folder contains a valid osu! installation.'
          : 'This installation was found automatically.'
        : status === 'invalid'
          ? $platform === 'macos'
            ? 'Pick the osu!.app wrapper, or the folder that contains osu!.exe.'
            : 'Pick the folder that contains osu!.exe.'
          : 'Browse to your installation to continue.'
  );

  const statusBorderClass = $derived(
    status === 'valid'
      ? 'border-emerald-500/25 bg-emerald-500/5'
      : status === 'invalid'
        ? 'border-red-500/25 bg-red-500/5'
        : 'border-theme-800/70 bg-black/15'
  );

  const statusIconClass = $derived(
    status === 'valid'
      ? 'bg-emerald-500/10 text-emerald-400'
      : status === 'invalid'
        ? 'bg-red-500/10 text-red-400'
        : status === 'missing'
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-primary/10 text-primary'
  );

  const canContinue = $derived(stepIndex !== 1 || osuInstallPath.length > 0 || dev);

  const detectOsu = async () => {
    const run = ++detectionRun;
    detecting = true;
    selectionError = false;

    try {
      const detectedPath = await autoDetectOsuInstallFolder();
      if (run !== detectionRun) return;
      if (detectedPath) {
        osuInstallPath = detectedPath;
        manualSelection = false;
      }
    } catch (error) {
      console.warn('Could not auto-detect the osu! installation.', error);
    } finally {
      if (run === detectionRun) {
        detecting = false;
        detectionFinished = true;
      }
    }
  };

  const browseOsu = async () => {
    if (selecting) return;

    detectionRun += 1;
    detecting = false;
    detectionFinished = true;
    selectionError = false;
    selecting = true;

    try {
      const selectedPath = await pickOsuInstallation($platform);
      if (typeof selectedPath !== 'string') return;

      const resolvedPath = await resolveOsuFolder(selectedPath);
      if (!resolvedPath) {
        osuInstallPath = '';
        manualSelection = false;
        selectionError = true;
        return;
      }

      osuInstallPath = resolvedPath;
      manualSelection = true;
    } catch (error) {
      console.error('Could not select the osu! installation.', error);
      osuInstallPath = '';
      manualSelection = false;
      selectionError = true;
    } finally {
      selecting = false;
    }
  };

  const nextStep = () => {
    if (stepIndex < steps.length - 1) {
      stepIndex += 1;
      return;
    }
    finished = true;
  };

  const previousStep = () => {
    if (finished) {
      finished = false;
      return;
    }
    stepIndex = Math.max(stepIndex - 1, 0);
  };

  const saveConfig = async () => {
    if (saving) return;
    saving = true;
    saveError = undefined;

    try {
      await config.value<string>('osu_installation_path').set(osuInstallPath);
      osuInstallationPath.set(osuInstallPath);
      await config.value<boolean>('setup_complete').set(true);

      if (osuInstallPath.length > 0) {
        try {
          const [beatmapSetCount, skinCount, skin, stream, version] = await Promise.all([
            getBeatmapSetsCount(osuInstallPath),
            getSkinsCount(osuInstallPath),
            getSkin(osuInstallPath),
            getReleaseStream(osuInstallPath),
            getVersion(osuInstallPath),
          ]);

          beatmapSets.set(beatmapSetCount ?? 0);
          skinsCount.set(skinCount ?? 0);
          currentSkin.set(skin ?? '');
          osuStream.set(stream);
          osuBuild.set(version);
        } catch (error) {
          console.warn('Could not load the osu! installation details.', error);
        }
      }

      currentView.set(Launch);
    } catch (error) {
      console.error('Could not finish the setup.', error);
      saveError = error instanceof Error ? error.message : String(error);
      saving = false;
    }
  };

  onMount(() => {
    void detectOsu();
  });
</script>

{#if finished}
  <div
    class="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden px-6"
  >
    <div
      class="pointer-events-none absolute -top-32 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
    ></div>

    {#if !$reduceAnimations}
      <ConfettiCannon count={820} colors={['#ff006e', '#a78bfa', '#7dd3fc', '#fbbf24']} />
    {/if}

    <div
      class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-theme-800/80 bg-theme-950/75 shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <div class="flex flex-col items-center px-7 py-8 text-center">
        <div
          class="rounded-3xl bg-primary/20 p-3 ring-1 ring-inset ring-primary/25 shadow-xl shadow-primary/10"
        >
          <img src={Logo} alt="EZPPLauncher logo" class="size-20 object-contain" />
        </div>
        <h1 class="mt-5 text-2xl font-bold tracking-tight">You're all set!</h1>
        <p class="mt-1.5 text-sm text-muted-foreground">
          Everything is configured. Time to farm some pp.
        </p>

        {#if osuInstallPath}
          <div
            class="mt-5 w-full rounded-xl border border-theme-800/70 bg-black/20 px-3 py-2.5 text-left"
          >
            <div
              class="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
            >
              <FolderOpen class="size-3" />
              osu! installation
            </div>
            <p class="mt-1 truncate font-mono text-[11px] text-theme-200" title={osuInstallPath}>
              {osuInstallPath}
            </p>
          </div>
        {/if}

        {#if saveError}
          <div
            class="mt-4 flex w-full items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-left text-xs text-red-300"
          >
            <CircleAlert class="mt-0.5 size-3.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        {/if}
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-theme-800/70 bg-black/20 px-5 py-3.5"
      >
        <Button
          variant="ghost"
          class="text-muted-foreground hover:text-foreground"
          onclick={previousStep}
          disabled={saving}
        >
          <ArrowLeft />
          Back
        </Button>
        <Button onclick={saveConfig} disabled={saving || (osuInstallPath.length === 0 && !dev)}>
          {#if saving}
            <LoaderCircle class="animate-spin" />
            Saving…
          {:else}
            <Rocket />
            Start farming
          {/if}
        </Button>
      </div>
    </div>

    <p class="relative z-10 mt-4 text-[11px] text-muted-foreground">See you on the leaderboards.</p>
  </div>
{:else}
  <div class="relative h-screen w-full overflow-x-hidden overflow-y-auto">
    <div
      class="pointer-events-none absolute -top-32 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
    ></div>

    <div
      class="relative z-10 mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 pt-10 pb-3"
    >
      <header class="mb-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div
            class="rounded-2xl bg-primary/20 p-1 ring-1 ring-inset ring-primary/25 shadow-lg shadow-primary/10"
          >
            <img src={Logo} alt="EZPPLauncher logo" class="size-10 object-contain" />
          </div>
          <div>
            <p class="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              EZPPLauncher setup
            </p>
            <p class="text-sm font-semibold tracking-tight">Welcome aboard</p>
          </div>
        </div>
        <span
          class="rounded-full border border-theme-800/80 bg-theme-950/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
        >
          Step {stepNumber} of {steps.length}
        </span>
      </header>

      <ol class="mb-3 grid grid-cols-3 gap-1.5" aria-label="Setup progress">
        {#each steps as step, index (step)}
          <li
            class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors {index ===
            stepIndex
              ? 'border-primary/30 bg-primary/10'
              : index < stepIndex
                ? 'border-theme-800/70 bg-theme-900/50'
                : 'border-theme-800/40 bg-black/10'}"
            aria-current={index === stepIndex ? 'step' : undefined}
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold {index <
              stepIndex
                ? 'bg-primary text-primary-foreground'
                : index === stepIndex
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/30 ring-inset'
                  : 'bg-theme-800 text-muted-foreground'}"
            >
              {#if index < stepIndex}
                <Check class="size-3" />
              {:else}
                {index + 1}
              {/if}
            </span>
            <span
              class="truncate text-[11px] font-semibold {index === stepIndex
                ? 'text-foreground'
                : index < stepIndex
                  ? 'text-theme-200'
                  : 'text-muted-foreground'}">{step}</span
            >
          </li>
        {/each}
      </ol>

      <div
        class="overflow-hidden rounded-2xl border border-theme-800/80 bg-theme-950/75 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div class="p-5">
          {#key stepIndex}
            <div in:fly={{ y: 6, duration: $reduceAnimations ? 0 : 200, opacity: 0 }}>
              {#if stepIndex === 0}
                <div class="flex min-h-[332px] flex-col">
                  <div>
                    <p class="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
                      Welcome
                    </p>
                    <h2 class="mt-1.5 text-2xl font-bold tracking-tight">Let's get you farming.</h2>
                    <p class="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      EZPPLauncher keeps osu! updated, patched and looking the way you want. This
                      takes less than a minute.
                    </p>
                  </div>

                  <div class="mt-4 grid gap-1.5">
                    <div
                      class="flex items-start gap-3 rounded-xl border border-theme-800/60 bg-black/15 p-2.5"
                    >
                      <div
                        class="rounded-lg bg-primary/10 p-2 text-primary ring-1 ring-primary/15 ring-inset"
                      >
                        <Rocket class="size-4" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-[13px] leading-tight font-semibold">One-click launch</p>
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Checks for updates, applies the patch and starts osu!.
                        </p>
                      </div>
                    </div>

                    <div
                      class="flex items-start gap-3 rounded-xl border border-theme-800/60 bg-black/15 p-2.5"
                    >
                      <div
                        class="rounded-lg bg-primary/10 p-2 text-primary ring-1 ring-primary/15 ring-inset"
                      >
                        <Palette class="size-4" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-[13px] leading-tight font-semibold">Make it yours</p>
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Themes with images, videos and custom fonts.
                        </p>
                      </div>
                    </div>

                    <div
                      class="flex items-start gap-3 rounded-xl border border-theme-800/60 bg-black/15 p-2.5"
                    >
                      <div
                        class="rounded-lg bg-primary/10 p-2 text-primary ring-1 ring-primary/15 ring-inset"
                      >
                        <RefreshCw class="size-4" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-[13px] leading-tight font-semibold">Always up to date</p>
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Keeps launcher files in sync before every launch.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="mt-auto flex items-start gap-2.5 pt-3">
                    <Info class="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <p class="text-xs leading-relaxed text-muted-foreground">
                      Make sure osu! is installed and signed in before continuing.
                    </p>
                  </div>
                </div>
              {:else if stepIndex === 1}
                <div class="flex min-h-[332px] flex-col">
                  <div>
                    <p class="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
                      osu! installation
                    </p>
                    <h2 class="mt-1.5 text-2xl font-bold tracking-tight">Where's osu!?</h2>
                    <p class="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      {#if $platform === 'macos'}
                        Point us at your osu!.app wrapper, or the folder that contains osu!.exe.
                      {:else}
                        Point us at the folder that contains osu!.exe.
                      {/if}
                    </p>
                  </div>
                  <div class="mt-4 rounded-xl border p-4 transition-colors {statusBorderClass}">
                    <div class="flex items-start gap-3">
                      <div class="rounded-full p-2 {statusIconClass}">
                        {#if status === 'detecting'}
                          <LoaderCircle class="size-4 animate-spin" />
                        {:else if status === 'valid'}
                          <CircleCheckBig class="size-4" />
                        {:else if status === 'invalid'}
                          <CircleAlert class="size-4" />
                        {:else}
                          <Search class="size-4" />
                        {/if}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm leading-tight font-semibold">{statusTitle}</p>
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {statusDescription}
                        </p>
                        {#if osuInstallPath}
                          <div
                            class="mt-2.5 flex items-center gap-2 rounded-lg border border-theme-800/80 bg-theme-950/70 px-2.5 py-1.5"
                          >
                            <FolderOpen class="size-3.5 shrink-0 text-muted-foreground" />
                            <span
                              class="truncate font-mono text-[11px] text-theme-200"
                              title={osuInstallPath}>{osuInstallPath}</span
                            >
                          </div>
                        {/if}
                      </div>
                    </div>

                    <div class="mt-3.5 flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        class="border-theme-700 bg-theme-900/80 hover:bg-theme-800"
                        onclick={browseOsu}
                        disabled={selecting}
                      >
                        <FolderOpen />
                        Browse…
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground hover:text-foreground"
                        onclick={detectOsu}
                        disabled={detecting || selecting}
                      >
                        <RefreshCw class={detecting ? 'animate-spin' : ''} />
                        Scan again
                      </Button>
                    </div>
                  </div>

                  {#if $platform === 'macos'}
                    <div
                      class="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3"
                    >
                      <Info class="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <p class="text-xs leading-relaxed text-theme-200">
                        Pick <code class="rounded bg-black/25 px-1 py-0.5 font-mono text-[11px]"
                          >osu!.app</code
                        > directly — you don't need to open its package contents. The launcher finds osu!
                        inside the Wineskin wrapper.
                      </p>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="flex min-h-[332px] flex-col">
                  <div>
                    <p class="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
                      Personalize
                    </p>
                    <h2 class="mt-1.5 text-2xl font-bold tracking-tight">Make it yours.</h2>
                    <p class="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      Choose how the launcher should look and behave.
                    </p>
                  </div>

                  <div
                    class="mt-3 divide-y divide-theme-800/50 rounded-xl border border-theme-800/60 bg-black/15"
                  >
                    <div class="flex items-start justify-between gap-6 px-4 py-1">
                      <div class="min-w-0">
                        <Label class="text-[13px]" for="wizard-patch">Patching</Label>
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Shows misses in Relax and Autopilot.{#if $platform === 'macos'}{' '}Requires
                            .NET in your Wine prefix.{/if}
                        </p>
                      </div>
                      <Checkbox
                        id="wizard-patch"
                        class="mt-0.5"
                        checked={$patch}
                        onCheckedChange={(checked) => patch.set(checked)}
                      />
                    </div>

                    <div class="flex items-start justify-between gap-6 px-4 py-1">
                      <div class="min-w-0">
                        <Label class="text-[13px]" for="wizard-custom-cursor"
                          >Lazer-style cursor</Label
                        >
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Use a custom cursor in the launcher, like in osu!lazer.
                        </p>
                      </div>
                      <Checkbox
                        id="wizard-custom-cursor"
                        class="mt-0.5"
                        checked={$customCursor}
                        onCheckedChange={(checked) => {
                          if (!checked) cursorSmoothening.set(false);
                          customCursor.set(checked);
                        }}
                      />
                    </div>

                    <div class="flex items-start justify-between gap-6 px-4 py-1">
                      <div class="min-w-0">
                        <Label class="text-[13px]" for="wizard-cursor-smoothing"
                          >Cursor smoothening</Label
                        >
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Makes the custom cursor movement smoother.
                        </p>
                      </div>
                      <Checkbox
                        id="wizard-cursor-smoothing"
                        class="mt-0.5"
                        checked={$cursorSmoothening}
                        onCheckedChange={(checked) => {
                          if (!$customCursor) return;
                          cursorSmoothening.set(checked);
                        }}
                        disabled={!$customCursor}
                      />
                    </div>

                    <div class="flex items-start justify-between gap-6 px-4 py-1">
                      <div class="min-w-0">
                        <Label class="text-[13px]" for="wizard-reduce-animations"
                          >Reduce animations</Label
                        >
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Disables some launcher animations on low-end devices.
                        </p>
                      </div>
                      <Checkbox
                        id="wizard-reduce-animations"
                        class="mt-0.5"
                        checked={$reduceAnimations}
                        onCheckedChange={(checked) => reduceAnimations.set(checked)}
                      />
                    </div>

                    <div class="flex items-start justify-between gap-6 px-4 py-1">
                      <div class="min-w-0">
                        <Label class="text-[13px]" for="wizard-presence"
                          >Discord Rich Presence</Label
                        >
                        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Let other Discord users see what you are doing right now 👀
                        </p>
                      </div>
                      <div class="flex items-center gap-2.5">
                        {#if $presenceLoading}
                          <LoaderCircle class="size-3.5 animate-spin text-muted-foreground" />
                        {/if}
                        <Checkbox
                          id="wizard-presence"
                          class="mt-0.5"
                          bind:checked={$discordPresence}
                          disabled={$presenceLoading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/key}
        </div>

        <div
          class="flex items-center justify-between gap-3 border-t border-theme-800/70 bg-black/20 px-5 py-3"
        >
          <Button
            variant="ghost"
            class={stepIndex === 0
              ? 'invisible text-muted-foreground'
              : 'text-muted-foreground hover:text-foreground'}
            onclick={previousStep}
            disabled={stepIndex === 0}
          >
            <ArrowLeft />
            Back
          </Button>
          <div class="flex items-center gap-3">
            {#if stepIndex === 1 && osuInstallPath.length === 0 && !dev}
              <span class="hidden text-[11px] text-muted-foreground sm:inline">
                Select an installation to continue
              </span>
            {/if}
            <Button class="group" onclick={nextStep} disabled={!canContinue}>
              {stepIndex === 0 ? 'Get started' : 'Continue'}
              <ArrowRight class="transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>

      <p class="mt-3 text-center text-[11px] text-muted-foreground">
        You can change all of this later in Settings.
      </p>
    </div>
  </div>
{/if}
