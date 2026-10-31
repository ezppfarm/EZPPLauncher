<script lang="ts">
  import ThemeSection from '$lib/components/theme/ThemeSection.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { currentUserInfo } from '$lib/data';
  import {
    DEFAULT_DISCORD_PRESENCE_CONFIG,
    DISCORD_PRESENCE_PRESETS,
    discordPresenceCustomConfig,
    interpolatePresenceString,
    loadDiscordPresenceConfig,
    pushIdlePresenceFromConfig,
    saveDiscordPresenceConfig,
    type DiscordPresenceConfig,
    type PresenceVariableContext,
  } from '$lib/discordPresenceConfig';
  import { discordPresence, launcherVersion } from '$lib/global';
  import * as presence from '$lib/presence';
  import { currentUser } from '$lib/userAuthentication';
  import {
    Check,
    Clock,
    Code2,
    Copy,
    ExternalLink,
    Eye,
    Gamepad2,
    Globe,
    Home,
    Image as ImageIcon,
    Info,
    Link,
    LoaderCircle,
    Maximize2,
    Minus,
    MousePointerClick,
    Play,
    Plus,
    RotateCcw,
    Save,
    Sparkles,
    Type,
    User,
    X,
  } from '@lucide/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { emit, listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { sileo } from 'sileo';
  import { onDestroy, onMount } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';

  let {
    open = $bindable(false),
    standalone = false,
    onclose,
  }: {
    open?: boolean;
    standalone?: boolean;
    onclose?: () => void;
  } = $props();

  // Active studio tab: 'idle' | 'playing' | 'buttons' | 'presets'
  let activeTab = $state<'idle' | 'playing' | 'buttons' | 'presets'>('idle');

  // Preview stage mode: 'idle' | 'playing'
  let previewMode = $state<'idle' | 'playing'>('idle');

  // Card interaction mode: 'edit' (clicking elements focuses input) | 'test' (clicking tests buttons)
  let cardInteractionMode = $state<'edit' | 'test'>('edit');

  // Canvas zoom scale (0.7 to 1.4)
  let canvasScale = $state<number>(1);

  // Working copy of config
  let workingConfig = $state<DiscordPresenceConfig>({
    ...DEFAULT_DISCORD_PRESENCE_CONFIG,
    idleButton1: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.idleButton1 },
    playingButton1: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.playingButton1 },
    button2: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.button2 },
  });

  // Track initial snapshot for dirty state
  let initialConfigJson = $state<string>('');
  let isDirty = $derived(
    initialConfigJson !== '' && JSON.stringify(workingConfig) !== initialConfigJson
  );

  // Saving state
  let isSaving = $state(false);

  // Track currently focused input field for placeholder chip insertions.
  // When no input is actively clicked/focused, this is null and the ribbon is hidden.
  let focusedInputKey = $state<string | null>(null);
  let blurTimeout: ReturnType<typeof setTimeout> | null = null;

  // Preset selector
  let selectedPresetName = $state<string>('EZPPFarm Default');

  // Simulation parameters for preview
  let simMode = $state<'osu!' | 'taiko' | 'catch' | 'mania'>('osu!');
  let simAction = $state<string>('Playing...');
  let simBeatmapIndex = $state<number>(0);
  let simRank = $state<number>(1337);
  let simPp = $state<number>(6850);
  let simAccuracy = $state<string>('98.84%');
  let simUserStatus = $state<'online' | 'idle' | 'dnd'>('online');

  // Live ticking simulation clock for authentic elapsed timestamp
  let simElapsedSeconds = $state<number>(161); // starts at 02:41
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const TARGET_LABELS: Record<string, string> = {
    idleDetails: 'Idle Details',
    idleState: 'Idle State',
    idleLargeImageText: 'Idle Large Tooltip',
    playingDetails: 'Playing Details',
    playingState: 'Playing State',
    playingLargeImageText: 'Playing Large Tooltip',
    playingSmallImageText: 'Playing Avatar Tooltip',
    idleButton1Label: 'Idle Button 1 Label',
    idleButton1Url: 'Idle Button 1 URL',
    playingButton1Label: 'Playing Button 1 Label',
    playingButton1Url: 'Playing Button 1 URL',
    button2Label: 'Button 2 Label',
    button2Url: 'Button 2 URL',
  };

  const FIELD_ELEMENT_IDS: Record<string, string> = {
    idleDetails: 'idle-details',
    idleState: 'idle-state',
    idleLargeImageText: 'idle-large-text',
    playingDetails: 'playing-details',
    playingState: 'playing-state',
    playingLargeImageText: 'playing-large-text',
    playingSmallImageText: 'playing-small-text',
    idleButton1Label: 'idle-btn1-label',
    idleButton1Url: 'idle-btn1-url',
    playingButton1Label: 'playing-btn1-label',
    playingButton1Url: 'playing-btn1-url',
    button2Label: 'btn2-label',
    button2Url: 'btn2-url',
  };

  const SAMPLE_BEATMAPS = [
    {
      artist: 'Reol',
      title: 'No title',
      diff: 'Insane',
      cover: 'https://assets.ppy.sh/beatmaps/320118/covers/list@2x.jpg',
      setId: 320118,
      id: 712376,
    },
    {
      artist: 'Camellia',
      title: 'GHOST',
      diff: 'Final Boss',
      cover: 'https://assets.ppy.sh/beatmaps/1013444/covers/list@2x.jpg',
      setId: 1013444,
      id: 2121386,
    },
    {
      artist: 'Kano',
      title: 'Stella-rium',
      diff: 'Celestial',
      cover: 'https://assets.ppy.sh/beatmaps/399404/covers/list@2x.jpg',
      setId: 399404,
      id: 869286,
    },
    {
      artist: 'xi',
      title: 'FREEDOM DiVE',
      diff: 'FOUR DIMENSIONS',
      cover: 'https://assets.ppy.sh/beatmaps/39804/covers/list@2x.jpg',
      setId: 39804,
      id: 129891,
    },
  ];

  const PLACEHOLDERS = [
    { token: '{username}', label: 'Player Name', desc: 'Current player username' },
    { token: '{rank}', label: 'Rank', desc: 'Global leaderboard rank' },
    { token: '{pp}', label: 'PP', desc: 'Performance points' },
    { token: '{accuracy}', label: 'Accuracy', desc: 'Profile or play accuracy' },
    { token: '{mode}', label: 'Game Mode', desc: 'Active osu! mode (osu!, taiko...)' },
    { token: '{action}', label: 'Action', desc: 'Playing, Editing, AFK...' },
    { token: '{beatmap}', label: 'Beatmap', desc: 'Full artist - title [diff]' },
    { token: '{artist}', label: 'Artist', desc: 'Beatmap song artist' },
    { token: '{title}', label: 'Title', desc: 'Beatmap song title' },
    { token: '{diff}', label: 'Difficulty', desc: 'Beatmap diff name' },
    { token: '{version}', label: 'Version', desc: 'Launcher version' },
    { token: '{beatmapUrl}', label: 'Map URL', desc: 'Beatmap URL on ez-pp.farm' },
    { token: '{profileUrl}', label: 'Profile URL', desc: 'User profile URL on ez-pp.farm' },
  ];

  let unlistenSync: (() => void) | undefined;

  onMount(async () => {
    const loaded = await loadDiscordPresenceConfig();
    workingConfig = JSON.parse(JSON.stringify(loaded));
    initialConfigJson = JSON.stringify(loaded);

    if (standalone) {
      try {
        unlistenSync = await listen<any>('sync-theme-editor-global-data', (event) => {
          if (event.payload?.user) currentUser.set(event.payload.user);
          if (event.payload?.info) currentUserInfo.set(event.payload.info);
          if (event.payload?.launcherVersion) launcherVersion.set(event.payload.launcherVersion);
        });
        await emit('request-theme-editor-global-data');
      } catch (err) {
        console.warn('Could not sync global data to presence editor:', err);
      }
    }

    timerInterval = setInterval(() => {
      simElapsedSeconds++;
    }, 1000);
  });

  onDestroy(() => {
    unlistenSync?.();
    if (blurTimeout) clearTimeout(blurTimeout);
    if (timerInterval) clearInterval(timerInterval);
  });

  // When open changes, sync working config from store
  $effect(() => {
    if (open) {
      loadDiscordPresenceConfig().then((loaded) => {
        workingConfig = JSON.parse(JSON.stringify(loaded));
        initialConfigJson = JSON.stringify(loaded);
      });
    }
  });

  const currentBeatmap = $derived(SAMPLE_BEATMAPS[simBeatmapIndex] ?? SAMPLE_BEATMAPS[0]);

  // Evaluated variable context for preview
  const previewContext = $derived<PresenceVariableContext>({
    username: $currentUser?.name ?? 'Cookiezi',
    id: $currentUser?.id ? String($currentUser.id) : '1001',
    rank: simRank,
    pp: simPp,
    accuracy: simAccuracy,
    mode: simMode,
    action: simAction,
    beatmap: `${currentBeatmap.artist} - ${currentBeatmap.title} [${currentBeatmap.diff}]`,
    artist: currentBeatmap.artist,
    title: currentBeatmap.title,
    diff: currentBeatmap.diff,
    version: $launcherVersion || '',
    beatmapUrl: `https://ez-pp.farm/beatmapsets/${currentBeatmap.setId}/${currentBeatmap.id}`,
    profileUrl: $currentUser?.id ? `https://ez-pp.farm/u/${$currentUser.id}` : 'https://ez-pp.farm',
  });

  // Interpolated fields for live preview
  const livePreview = $derived.by(() => {
    const isIdle = previewMode === 'idle';
    if (isIdle) {
      const details = interpolatePresenceString(workingConfig.idleDetails, previewContext);
      const state = interpolatePresenceString(workingConfig.idleState, previewContext);
      const largeText = interpolatePresenceString(workingConfig.idleLargeImageText, previewContext);
      const btn1 = workingConfig.idleButton1.enabled
        ? {
            label: interpolatePresenceString(workingConfig.idleButton1.label, previewContext),
            url: interpolatePresenceString(workingConfig.idleButton1.url, previewContext),
          }
        : null;
      const btn2 = workingConfig.button2.enabled
        ? {
            label: interpolatePresenceString(workingConfig.button2.label, previewContext),
            url: interpolatePresenceString(workingConfig.button2.url, previewContext),
          }
        : null;

      return {
        gameTitle: 'EZPPFarm Launcher',
        details: details || 'In Launcher',
        state: state || 'Chilling...',
        largeImage: '/logo.png',
        largeImageTooltip: largeText || 'EZPPFarm Launcher',
        showSmallImage: workingConfig.idleShowUserAvatar,
        smallImage: $currentUser?.id
          ? `https://a.ez-pp.farm/${$currentUser.id}`
          : 'https://a.ez-pp.farm/1',
        smallImageTooltip: $currentUser?.name ?? 'Player',
        showTime: workingConfig.idleShowTime,
        button1: btn1,
        button2: btn2,
      };
    } else {
      const details = interpolatePresenceString(workingConfig.playingDetails, previewContext);
      const state = interpolatePresenceString(workingConfig.playingState, previewContext);
      const largeText = interpolatePresenceString(
        workingConfig.playingLargeImageText,
        previewContext
      );
      const smallText = interpolatePresenceString(
        workingConfig.playingSmallImageText,
        previewContext
      );
      const btn1 = workingConfig.playingButton1.enabled
        ? {
            label: interpolatePresenceString(workingConfig.playingButton1.label, previewContext),
            url: interpolatePresenceString(workingConfig.playingButton1.url, previewContext),
          }
        : null;
      const btn2 = workingConfig.button2.enabled
        ? {
            label: interpolatePresenceString(workingConfig.button2.label, previewContext),
            url: interpolatePresenceString(workingConfig.button2.url, previewContext),
          }
        : null;

      return {
        gameTitle: 'osu!',
        details: details || '[osu!] Playing...',
        state:
          state || `${currentBeatmap.artist} - ${currentBeatmap.title} [${currentBeatmap.diff}]`,
        largeImage: workingConfig.playingShowBeatmapCover ? currentBeatmap.cover : '/logo.png',
        largeImageTooltip: largeText || `${currentBeatmap.artist} - ${currentBeatmap.title}`,
        showSmallImage: workingConfig.playingShowUserAvatar,
        smallImage: $currentUser?.id
          ? `https://a.ez-pp.farm/${$currentUser.id}`
          : 'https://a.ez-pp.farm/1',
        smallImageTooltip: smallText || `${previewContext.username} (#${previewContext.rank})`,
        showTime: workingConfig.playingShowTime,
        button1: btn1,
        button2: btn2,
      };
    }
  });

  const handleInputFocus = (key: string) => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    focusedInputKey = key;
  };

  const handleInputBlur = () => {
    // Delay clearing target to allow clicking placeholder buttons or switching inputs smoothly
    blurTimeout = setTimeout(() => {
      focusedInputKey = null;
    }, 150);
  };

  // Jump to and focus a field when clicking on the live Discord card
  const focusField = (key: string, tab?: 'idle' | 'playing' | 'buttons') => {
    if (tab) {
      activeTab = tab;
      if (tab === 'idle' || tab === 'playing') {
        previewMode = tab;
      }
    }
    handleInputFocus(key);
    requestAnimationFrame(() => {
      const elId = FIELD_ELEMENT_IDS[key] ?? key;
      const el = document.getElementById(elId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const applyPreset = (presetName: string) => {
    selectedPresetName = presetName;
    const found = DISCORD_PRESENCE_PRESETS.find((p) => p.name === presetName);
    if (!found) return;
    workingConfig = {
      ...DEFAULT_DISCORD_PRESENCE_CONFIG,
      ...found.config,
      idleButton1: {
        ...DEFAULT_DISCORD_PRESENCE_CONFIG.idleButton1,
        ...(found.config.idleButton1 ?? {}),
      },
      playingButton1: {
        ...DEFAULT_DISCORD_PRESENCE_CONFIG.playingButton1,
        ...(found.config.playingButton1 ?? {}),
      },
      button2: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.button2, ...(found.config.button2 ?? {}) },
    };
    sileo.info({ title: 'Preset Applied', description: presetName });
  };

  const resetToDefaults = () => {
    selectedPresetName = 'EZPPFarm Default';
    workingConfig = JSON.parse(JSON.stringify(DEFAULT_DISCORD_PRESENCE_CONFIG));
    sileo.info({ title: 'Default Presets Restored' });
  };

  const insertPlaceholder = (token: string) => {
    if (!focusedInputKey) return;

    // Helper to insert into string at current input cursor position if applicable, else append
    const insertInto = (current: string | undefined): string => {
      const val = current ?? '';
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLInputElement &&
        typeof document.activeElement.selectionStart === 'number'
      ) {
        const start = document.activeElement.selectionStart;
        const end = document.activeElement.selectionEnd ?? start;
        const next = val.slice(0, start) + token + val.slice(end);
        const nextCursor = start + token.length;
        requestAnimationFrame(() => {
          if (document.activeElement instanceof HTMLInputElement) {
            document.activeElement.setSelectionRange(nextCursor, nextCursor);
          }
        });
        return next;
      }
      return val + token;
    };

    switch (focusedInputKey) {
      case 'idleDetails':
        workingConfig.idleDetails = insertInto(workingConfig.idleDetails);
        break;
      case 'idleState':
        workingConfig.idleState = insertInto(workingConfig.idleState);
        break;
      case 'idleLargeImageText':
        workingConfig.idleLargeImageText = insertInto(workingConfig.idleLargeImageText);
        break;
      case 'playingDetails':
        workingConfig.playingDetails = insertInto(workingConfig.playingDetails);
        break;
      case 'playingState':
        workingConfig.playingState = insertInto(workingConfig.playingState);
        break;
      case 'playingLargeImageText':
        workingConfig.playingLargeImageText = insertInto(workingConfig.playingLargeImageText);
        break;
      case 'playingSmallImageText':
        workingConfig.playingSmallImageText = insertInto(workingConfig.playingSmallImageText);
        break;
      case 'idleButton1Label':
        workingConfig.idleButton1.label = insertInto(workingConfig.idleButton1.label);
        break;
      case 'idleButton1Url':
        workingConfig.idleButton1.url = insertInto(workingConfig.idleButton1.url);
        break;
      case 'playingButton1Label':
        workingConfig.playingButton1.label = insertInto(workingConfig.playingButton1.label);
        break;
      case 'playingButton1Url':
        workingConfig.playingButton1.url = insertInto(workingConfig.playingButton1.url);
        break;
      case 'button2Label':
        workingConfig.button2.label = insertInto(workingConfig.button2.label);
        break;
      case 'button2Url':
        workingConfig.button2.url = insertInto(workingConfig.button2.url);
        break;
    }
  };

  const handleSave = async () => {
    isSaving = true;
    try {
      await saveDiscordPresenceConfig(workingConfig);
      initialConfigJson = JSON.stringify(workingConfig);
      if ($discordPresence && (await presence.isConnected())) {
        await pushIdlePresenceFromConfig(
          {
            user: $currentUser,
            version: $launcherVersion || undefined,
            rank: simRank,
            pp: simPp,
            accuracy: simAccuracy,
          },
          workingConfig
        );
      }
      sileo.success({ title: 'Discord Rich Presence Saved', description: 'Activity updated' });
      await handleClose();
    } catch (err) {
      console.error(err);
      sileo.error({ title: 'Failed to save configuration' });
    } finally {
      isSaving = false;
    }
  };

  const handleClose = async () => {
    open = false;
    onclose?.();
    if (standalone) {
      try {
        await invoke('close_presence_editor');
      } catch {
        try {
          await getCurrentWindow().close();
        } catch {}
      }
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (open || standalone)) {
      handleClose();
    }
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} elapsed`;
  };

  const zoomIn = () => {
    canvasScale = Math.min(1.4, Math.round((canvasScale + 0.1) * 10) / 10);
  };

  const zoomOut = () => {
    canvasScale = Math.max(0.7, Math.round((canvasScale - 0.1) * 10) / 10);
  };

  const resetZoom = () => {
    canvasScale = 1;
  };

  const testButtonClick = (label: string, url: string) => {
    if (!url) {
      sileo.warning({
        title: 'No URL configured',
        description: 'Provide a target link for this button',
      });
      return;
    }
    sileo.info({
      title: `Button Action: ${label || 'Button'}`,
      description: url,
    });
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank');
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if standalone || open}
  <div
    class={standalone
      ? 'flex h-screen w-screen flex-col overflow-hidden bg-theme-950 text-theme-50 select-none'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none backdrop-blur-sm sm:p-6'}
    transition:fade={{ duration: 120 }}
  >
    <!-- Modal Window (or full-window frame if standalone) -->
    <div
      class={standalone
        ? 'flex size-full flex-col overflow-hidden bg-theme-950 text-theme-50'
        : 'flex h-[92vh] max-h-[880px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-theme-800 bg-theme-950 text-theme-50 shadow-2xl'}
      transition:scale={{ duration: 150, start: 0.98 }}
      role="dialog"
      aria-modal="true"
    >
      <!-- Studio Header (Same design as Theme Editor) -->
      <header
        class="flex h-14 shrink-0 items-center justify-between border-b border-theme-800 bg-black/40 px-4"
        data-tauri-drag-region
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="rounded-xl bg-primary/25 p-1 ring-1 ring-inset ring-white/15">
            <!-- Discord icon -->
            <svg class="size-7 fill-primary" viewBox="0 0 24 24">
              <path
                d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="truncate text-sm font-semibold">Discord Rich Presence</h1>
              <Badge
                variant="outline"
                class="border-primary/25 bg-primary/15 px-2 py-0.5 text-[9px] text-primary"
              >
                Discord RPC
              </Badge>
              {#if $discordPresence}
                <Badge
                  variant="outline"
                  class="border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-400"
                >
                  Connected
                </Badge>
              {:else}
                <Badge
                  variant="outline"
                  class="border-zinc-500/25 bg-zinc-500/15 px-2 py-0.5 text-[9px] text-zinc-400"
                >
                  Disabled
                </Badge>
              {/if}
            </div>
            <p class="truncate text-[10px] text-muted-foreground">
              Customize activity details, state text, dynamic buttons, and interactive card
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="mr-2 hidden text-[10px] sm:block {isDirty
              ? 'text-amber-300'
              : 'text-muted-foreground'}"
            title={isDirty ? 'You have unsaved changes' : 'All changes saved'}
          >
            {isDirty ? 'Unsaved changes' : 'All changes saved'}
          </span>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-white"
            onclick={resetToDefaults}
            title="Reset to default settings"
          >
            <RotateCcw class="size-3.5" />
            Reset
          </Button>

          <Button
            size="sm"
            class="h-8 gap-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/90"
            onclick={handleSave}
            disabled={isSaving}
          >
            {#if isSaving}
              <LoaderCircle class="size-3.5 animate-spin" />
              Saving...
            {:else}
              <Check class="size-3.5" />
              Save Changes
            {/if}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="size-8 text-muted-foreground hover:text-white"
            onclick={handleClose}
            aria-label="Close"
          >
            <X class="size-4" />
          </Button>
        </div>
      </header>

      <!-- Main Studio Body: Sidebar Controls + Interactive Canvas Stage -->
      <div
        class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[380px_minmax(0,1fr)]"
      >
        <!-- Left Sidebar: Studio Controls & Configuration (380px) -->
        <aside
          class="flex min-h-0 flex-col border-r border-theme-800 bg-theme-900/25 overflow-hidden"
        >
          <!-- Navigation Tabs (Matching Theme Editor design) -->
          <div class="grid shrink-0 grid-cols-4 gap-1 border-b border-theme-800 p-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-1.5 text-[10px] {activeTab === 'idle'
                ? 'bg-primary/20 text-primary hover:bg-primary/25'
                : 'text-muted-foreground'}"
              aria-pressed={activeTab === 'idle'}
              onclick={() => {
                activeTab = 'idle';
                previewMode = 'idle';
              }}
            >
              <Home class="size-3.5" />
              Idle
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-1.5 text-[10px] {activeTab === 'playing'
                ? 'bg-primary/20 text-primary hover:bg-primary/25'
                : 'text-muted-foreground'}"
              aria-pressed={activeTab === 'playing'}
              onclick={() => {
                activeTab = 'playing';
                previewMode = 'playing';
              }}
            >
              <Gamepad2 class="size-3.5" />
              In-Game
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-1.5 text-[10px] {activeTab === 'buttons'
                ? 'bg-primary/20 text-primary hover:bg-primary/25'
                : 'text-muted-foreground'}"
              aria-pressed={activeTab === 'buttons'}
              onclick={() => (activeTab = 'buttons')}
            >
              <Link class="size-3.5" />
              Buttons
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-1.5 text-[10px] {activeTab === 'presets'
                ? 'bg-primary/20 text-primary hover:bg-primary/25'
                : 'text-muted-foreground'}"
              aria-pressed={activeTab === 'presets'}
              onclick={() => (activeTab = 'presets')}
            >
              <Sparkles class="size-3.5" />
              Presets
            </Button>
          </div>

          <!-- Tab Content (Scrollable with ThemeSection components) -->
          <div class="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {#if activeTab === 'idle'}
              <!-- Idle Tab -->
              <ThemeSection
                title="Activity Text"
                icon={Type}
                description="Text shown on the first and second lines of your Discord status when launcher is idle"
                bordered={false}
              >
                <div class="space-y-3">
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label class="text-[11px] font-medium text-theme-200" for="idle-details">
                        Details (First Line)
                      </Label>
                      <span class="text-[10px] text-muted-foreground">e.g. In Launcher</span>
                    </div>
                    <Input
                      id="idle-details"
                      bind:value={workingConfig.idleDetails}
                      onfocus={() => handleInputFocus('idleDetails')}
                      onblur={handleInputBlur}
                      placeholder="In Launcher"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label class="text-[11px] font-medium text-theme-200" for="idle-state">
                        State (Second Line)
                      </Label>
                      <span class="text-[10px] text-muted-foreground">e.g. Chilling...</span>
                    </div>
                    <Input
                      id="idle-state"
                      bind:value={workingConfig.idleState}
                      onfocus={() => handleInputFocus('idleState')}
                      onblur={handleInputBlur}
                      placeholder="Chilling..."
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>
                </div>
              </ThemeSection>

              <ThemeSection
                title="Media & Badges"
                icon={ImageIcon}
                description="Launcher icon tooltips and user avatar overlay"
              >
                <div class="space-y-3">
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label class="text-[11px] font-medium text-theme-200" for="idle-large-text">
                        Large Image Tooltip
                      </Label>
                      <span class="text-[10px] text-muted-foreground">Hovering launcher logo</span>
                    </div>
                    <Input
                      id="idle-large-text"
                      bind:value={workingConfig.idleLargeImageText}
                      onfocus={() => handleInputFocus('idleLargeImageText')}
                      onblur={handleInputBlur}
                      placeholder="EZPPFarm Launcher"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>

                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <div class="space-y-0.5">
                      <Label class="text-[11px] font-medium text-white" for="idle-avatar">
                        Show Avatar Badge
                      </Label>
                      <p class="text-[10px] text-muted-foreground">
                        Overlay your profile avatar on the corner of launcher icon
                      </p>
                    </div>
                    <Checkbox id="idle-avatar" bind:checked={workingConfig.idleShowUserAvatar} />
                  </div>
                </div>
              </ThemeSection>

              <ThemeSection
                title="Timestamp & Elapsed"
                icon={Clock}
                description="Live clock elapsed time display"
              >
                <div
                  class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                >
                  <div class="space-y-0.5">
                    <Label class="text-[11px] font-medium text-white" for="idle-timer">
                      Show Elapsed Time
                    </Label>
                    <p class="text-[10px] text-muted-foreground">
                      Display time elapsed since launcher started
                    </p>
                  </div>
                  <Checkbox id="idle-timer" bind:checked={workingConfig.idleShowTime} />
                </div>
              </ThemeSection>
            {:else if activeTab === 'playing'}
              <!-- In-Game Tab -->
              <ThemeSection
                title="Gameplay Activity Text"
                icon={Type}
                description="Text shown on your Discord profile when playing in-game (supports beatmap tokens)"
                bordered={false}
              >
                <div class="space-y-3">
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label class="text-[11px] font-medium text-theme-200" for="playing-details">
                        Details (First Line)
                      </Label>
                      <span class="text-[10px] text-muted-foreground"
                        >[{'{'}mode{'}'}] {'{'}action{'}'}</span
                      >
                    </div>
                    <Input
                      id="playing-details"
                      bind:value={workingConfig.playingDetails}
                      onfocus={() => handleInputFocus('playingDetails')}
                      onblur={handleInputBlur}
                      placeholder="[{'{'}mode{'}'}] {'{'}action{'}'}"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label class="text-[11px] font-medium text-theme-200" for="playing-state">
                        State (Second Line)
                      </Label>
                      <span class="text-[10px] text-muted-foreground">{'{'}beatmap{'}'}</span>
                    </div>
                    <Input
                      id="playing-state"
                      bind:value={workingConfig.playingState}
                      onfocus={() => handleInputFocus('playingState')}
                      onblur={handleInputBlur}
                      placeholder="{'{'}beatmap{'}'}"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>
                </div>
              </ThemeSection>

              <ThemeSection
                title="Beatmap Artwork & Badges"
                icon={ImageIcon}
                description="Beatmap cover banner, player badge, and hover tooltips"
              >
                <div class="space-y-3">
                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <div class="space-y-0.5">
                      <Label class="text-[11px] font-medium text-white" for="playing-cover">
                        Show Beatmap Cover Art
                      </Label>
                      <p class="text-[10px] text-muted-foreground">
                        Display active beatmap banner instead of generic icon
                      </p>
                    </div>
                    <Checkbox
                      id="playing-cover"
                      bind:checked={workingConfig.playingShowBeatmapCover}
                    />
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label
                        class="text-[11px] font-medium text-theme-200"
                        for="playing-large-text"
                      >
                        Cover Art Hover Tooltip
                      </Label>
                      <span class="text-[10px] text-muted-foreground">{'{'}beatmap{'}'}</span>
                    </div>
                    <Input
                      id="playing-large-text"
                      bind:value={workingConfig.playingLargeImageText}
                      onfocus={() => handleInputFocus('playingLargeImageText')}
                      onblur={handleInputBlur}
                      placeholder="{'{'}beatmap{'}'}"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>

                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <div class="space-y-0.5">
                      <Label class="text-[11px] font-medium text-white" for="playing-avatar">
                        Show Player Avatar Badge
                      </Label>
                      <p class="text-[10px] text-muted-foreground">
                        Overlay small avatar badge on beatmap cover
                      </p>
                    </div>
                    <Checkbox
                      id="playing-avatar"
                      bind:checked={workingConfig.playingShowUserAvatar}
                    />
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label
                        class="text-[11px] font-medium text-theme-200"
                        for="playing-small-text"
                      >
                        Small Badge Hover Tooltip
                      </Label>
                      <span class="text-[10px] text-muted-foreground"
                        >{'{'}username{'}'} (#{'{'}rank{'}'})</span
                      >
                    </div>
                    <Input
                      id="playing-small-text"
                      bind:value={workingConfig.playingSmallImageText}
                      onfocus={() => handleInputFocus('playingSmallImageText')}
                      onblur={handleInputBlur}
                      placeholder="{'{'}username{'}'} (#{'{'}rank{'}'})"
                      class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                    />
                  </div>
                </div>
              </ThemeSection>

              <ThemeSection
                title="In-Game Timestamp"
                icon={Clock}
                description="Live gameplay match timer"
              >
                <div
                  class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                >
                  <div class="space-y-0.5">
                    <Label class="text-[11px] font-medium text-white" for="playing-timer">
                      Show Playing Elapsed Time
                    </Label>
                    <p class="text-[10px] text-muted-foreground">
                      Display elapsed playtime for current map
                    </p>
                  </div>
                  <Checkbox id="playing-timer" bind:checked={workingConfig.playingShowTime} />
                </div>
              </ThemeSection>
            {:else if activeTab === 'buttons'}
              <!-- Buttons Tab -->
              <ThemeSection
                title="Button 1 (Idle in Launcher)"
                icon={Link}
                description="Primary action button shown when idle in the launcher"
                bordered={false}
              >
                <div class="space-y-3">
                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <Label class="text-[11px] font-medium text-white">Enable Button 1 (Idle)</Label>
                    <Checkbox bind:checked={workingConfig.idleButton1.enabled} />
                  </div>

                  {#if workingConfig.idleButton1.enabled}
                    <div class="space-y-2 pt-1">
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="idle-btn1-label">
                          Button Label
                        </Label>
                        <Input
                          id="idle-btn1-label"
                          bind:value={workingConfig.idleButton1.label}
                          onfocus={() => handleInputFocus('idleButton1Label')}
                          onblur={handleInputBlur}
                          placeholder="Download Launcher"
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="idle-btn1-url">
                          Target URL
                        </Label>
                        <Input
                          id="idle-btn1-url"
                          bind:value={workingConfig.idleButton1.url}
                          onfocus={() => handleInputFocus('idleButton1Url')}
                          onblur={handleInputBlur}
                          placeholder="https://..."
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                    </div>
                  {/if}
                </div>
              </ThemeSection>

              <ThemeSection
                title="Button 1 (Playing In-Game)"
                icon={Link}
                description="Primary action button shown while playing osu! (supports {'{'}beatmapUrl{'}'})"
              >
                <div class="space-y-3">
                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <Label class="text-[11px] font-medium text-white"
                      >Enable Button 1 (Playing)</Label
                    >
                    <Checkbox bind:checked={workingConfig.playingButton1.enabled} />
                  </div>

                  {#if workingConfig.playingButton1.enabled}
                    <div class="space-y-2 pt-1">
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="playing-btn1-label">
                          Button Label
                        </Label>
                        <Input
                          id="playing-btn1-label"
                          bind:value={workingConfig.playingButton1.label}
                          onfocus={() => handleInputFocus('playingButton1Label')}
                          onblur={handleInputBlur}
                          placeholder="View Beatmap"
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="playing-btn1-url">
                          Target URL
                        </Label>
                        <Input
                          id="playing-btn1-url"
                          bind:value={workingConfig.playingButton1.url}
                          onfocus={() => handleInputFocus('playingButton1Url')}
                          onblur={handleInputBlur}
                          placeholder="{'{'}beatmapUrl{'}'}"
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                    </div>
                  {/if}
                </div>
              </ThemeSection>

              <ThemeSection
                title="Button 2 (Community & Profile)"
                icon={Globe}
                description="Secondary button displayed across both idle and gameplay states"
              >
                <div class="space-y-3">
                  <div
                    class="flex items-center justify-between rounded-lg border border-theme-800/60 bg-theme-900/30 p-2.5"
                  >
                    <Label class="text-[11px] font-medium text-white">Enable Button 2</Label>
                    <Checkbox bind:checked={workingConfig.button2.enabled} />
                  </div>

                  {#if workingConfig.button2.enabled}
                    <div class="space-y-2 pt-1">
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="btn2-label">
                          Button Label
                        </Label>
                        <Input
                          id="btn2-label"
                          bind:value={workingConfig.button2.label}
                          onfocus={() => handleInputFocus('button2Label')}
                          onblur={handleInputBlur}
                          placeholder="Join EZPPFarm"
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                      <div class="space-y-1">
                        <Label class="text-[10px] text-theme-300" for="btn2-url">Target URL</Label>
                        <Input
                          id="btn2-url"
                          bind:value={workingConfig.button2.url}
                          onfocus={() => handleInputFocus('button2Url')}
                          onblur={handleInputBlur}
                          placeholder="https://ez-pp.farm/discord"
                          class="h-8 bg-black/40 text-xs border-theme-800 focus:border-primary"
                        />
                      </div>
                    </div>
                  {/if}
                </div>
              </ThemeSection>
            {:else if activeTab === 'presets'}
              <!-- Presets Tab -->
              <ThemeSection
                title="Built-in Presets"
                icon={Sparkles}
                description="Apply carefully tuned activity templates"
                bordered={false}
              >
                <div class="space-y-2">
                  {#each DISCORD_PRESENCE_PRESETS as preset}
                    <div
                      class="flex flex-col gap-1.5 rounded-xl border border-theme-800/80 bg-theme-900/40 p-3 transition-colors hover:border-theme-700 {selectedPresetName ===
                      preset.name
                        ? 'ring-1 ring-primary/60 bg-primary/5'
                        : ''}"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-semibold text-white">{preset.name}</span>
                          {#if selectedPresetName === preset.name}
                            <Badge
                              variant="outline"
                              class="border-primary/30 bg-primary/10 text-[9px] text-primary"
                            >
                              Active
                            </Badge>
                          {/if}
                        </div>
                        <Button
                          variant={selectedPresetName === preset.name ? 'secondary' : 'ghost'}
                          size="sm"
                          class="h-7 text-[10px]"
                          onclick={() => applyPreset(preset.name)}
                        >
                          Apply
                        </Button>
                      </div>
                      <p class="text-[10px] leading-relaxed text-muted-foreground">
                        {preset.description}
                      </p>
                    </div>
                  {/each}
                </div>
              </ThemeSection>

              <ThemeSection
                title="Dynamic Placeholders"
                icon={Code2}
                description="Click any variable to copy or evaluate in the active field"
              >
                <div class="space-y-1.5">
                  {#each PLACEHOLDERS as p}
                    <div
                      class="flex items-center justify-between rounded-lg border border-theme-800/40 bg-black/30 px-2.5 py-1.5 text-[11px]"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <code class="font-mono text-primary font-semibold text-[10px]"
                          >{p.token}</code
                        >
                        <span class="truncate text-muted-foreground text-[10px]">{p.label}</span>
                      </div>
                      <span class="font-mono text-[9px] text-theme-300 truncate max-w-[120px]">
                        {interpolatePresenceString(p.token, previewContext)}
                      </span>
                    </div>
                  {/each}
                </div>
              </ThemeSection>
            {/if}
          </div>

          <!-- Clickable Variables / Placeholder Ribbon (only shown when an input is actively clicked/focused) -->
          {#if focusedInputKey}
            <div
              transition:slide={{ duration: 160 }}
              role="toolbar"
              aria-label="Placeholder tokens"
              tabindex="-1"
              class="border-t border-theme-800/80 bg-black/60 p-3 shrink-0"
              onmousedown={(e) => {
                // Prevent blurring the active input when clicking anywhere within the ribbon
                e.preventDefault();
              }}
            >
              <div class="mb-1.5 flex items-center justify-between">
                <span class="text-[10px] font-medium text-muted-foreground">
                  Click token to insert at cursor:
                </span>
                <span class="text-[10px] text-theme-400">
                  Target: <code
                    class="rounded bg-theme-800 px-1.5 py-0.5 text-primary font-mono font-medium text-[9px]"
                    >{TARGET_LABELS[focusedInputKey] ?? focusedInputKey}</code
                  >
                </span>
              </div>
              <div class="flex flex-wrap gap-1">
                {#each PLACEHOLDERS as p}
                  <button
                    type="button"
                    class="group flex items-center gap-1 rounded border border-theme-800 bg-theme-900/90 px-1.5 py-0.5 text-[10px] text-theme-200 transition-all hover:border-primary/60 hover:bg-primary/20 hover:text-white active:scale-95"
                    onmousedown={(e) => e.preventDefault()}
                    onclick={() => insertPlaceholder(p.token)}
                    title={`${p.label}: ${p.desc}`}
                  >
                    <span class="font-mono text-primary group-hover:text-primary-foreground">+</span
                    >
                    <span class="font-mono">{p.token}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </aside>

        <!-- Right Main Stage: Live Interactive Canvas (Matching Theme Editor canvas design) -->
        <main class="flex min-h-0 min-w-0 flex-col bg-theme-900/50 overflow-hidden">
          <!-- Canvas Toolbar Header -->
          <div
            class="flex h-10 shrink-0 items-center justify-between border-b border-theme-800 bg-theme-900/30 px-3 text-[10px] text-muted-foreground"
          >
            <div class="flex items-center gap-2">
              <span class="size-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-medium text-theme-200">Discord Embed</span>
              <span class="text-theme-600">·</span>
              <span class="text-muted-foreground">Live Interactive Canvas</span>
            </div>

            <div class="flex items-center gap-1.5">
              <!-- Preview Mode Switcher (Idle vs In-Game) -->
              <div class="flex items-center rounded-lg border border-theme-800 bg-black/40 p-0.5">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors {previewMode ===
                  'idle'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-white'}"
                  onclick={() => (previewMode = 'idle')}
                >
                  <Home class="size-3" />
                  Idle
                </button>
                <button
                  type="button"
                  class="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors {previewMode ===
                  'playing'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-white'}"
                  onclick={() => (previewMode = 'playing')}
                >
                  <Gamepad2 class="size-3" />
                  In-Game
                </button>
              </div>

              <span class="h-4 w-px bg-theme-800"></span>

              <!-- Interaction Mode: Click-to-Edit vs Test Actions -->
              <div class="flex items-center rounded-lg border border-theme-800 bg-black/40 p-0.5">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors {cardInteractionMode ===
                  'edit'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-white'}"
                  title="Click elements on the card to focus their field in the editor"
                  onclick={() => (cardInteractionMode = 'edit')}
                >
                  <MousePointerClick class="size-3" />
                  Edit on Click
                </button>
                <button
                  type="button"
                  class="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors {cardInteractionMode ===
                  'test'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-white'}"
                  title="Click buttons on the card to test links and actions"
                  onclick={() => (cardInteractionMode = 'test')}
                >
                  <Play class="size-3" />
                  Test Embed
                </button>
              </div>

              <span class="h-4 w-px bg-theme-800"></span>

              <!-- Zoom Controls -->
              <div class="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title="Zoom out"
                  onclick={zoomOut}
                >
                  <Minus class="size-3" />
                </Button>
                <button
                  type="button"
                  class="h-6 min-w-10 px-1 font-mono text-[10px] text-theme-100 hover:text-primary transition-colors"
                  title="Reset zoom to 100%"
                  onclick={resetZoom}
                >
                  {Math.round(canvasScale * 100)}%
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title="Zoom in"
                  onclick={zoomIn}
                >
                  <Plus class="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground"
                  title="Reset zoom"
                  onclick={resetZoom}
                >
                  <Maximize2 class="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Simulator Bar (when in-game is previewed) -->
          {#if previewMode === 'playing'}
            <div
              class="flex flex-wrap items-center justify-between gap-2 border-b border-theme-800 bg-theme-900/20 px-3 py-1.5 text-[10px]"
            >
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">Mode:</span>
                <div class="flex gap-0.5">
                  {#each ['osu!', 'taiko', 'catch', 'mania'] as mode}
                    <button
                      type="button"
                      class="rounded px-2 py-0.5 text-[10px] font-semibold transition-colors {simMode ===
                      mode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-black/40 text-theme-300 hover:text-white'}"
                      onclick={() => (simMode = mode as any)}
                    >
                      {mode}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">Action:</span>
                <div class="flex gap-0.5">
                  {#each ['Playing...', 'Editing...', 'AFK...'] as act}
                    <button
                      type="button"
                      class="rounded px-2 py-0.5 text-[10px] transition-colors {simAction === act
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-black/40 text-theme-300 hover:text-white'}"
                      onclick={() => (simAction = act)}
                    >
                      {act.replace('...', '')}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Beatmap:</span>
                <select
                  bind:value={simBeatmapIndex}
                  class="rounded border border-theme-800 bg-black/60 px-2 py-0.5 text-[10px] text-theme-200"
                >
                  {#each SAMPLE_BEATMAPS as b, idx}
                    <option value={idx}>{b.artist} - {b.title}</option>
                  {/each}
                </select>
              </div>
            </div>
          {/if}

          <!-- Canvas Stage with Dotted Grid Background -->
          <div
            class="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
            style="background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0);background-size:24px 24px;"
            role="presentation"
          >
            <!-- Scalable Card Container -->
            <div
              class="transition-transform duration-150 ease-out origin-center"
              style="transform: scale({canvasScale});"
            >
              <Tooltip.Provider delayDuration={150}>
                <!-- Authentic Discord Profile & Rich Presence Card -->
                <div
                  class="w-[340px] overflow-hidden rounded-2xl bg-[#1e1f22] text-[#dbdee1] shadow-2xl ring-1 ring-[#2b2d31]"
                >
                  <!-- Discord Banner -->
                  <div
                    class="relative h-14 bg-gradient-to-r from-[#5865F2]/40 via-[#3ba55d]/30 to-[#f47b67]/40"
                  >
                    <!-- Avatar circle overlapping banner -->
                    <div class="absolute -bottom-6 left-4">
                      <div class="relative size-14 rounded-full bg-[#111214] ring-4 ring-[#1e1f22]">
                        <img
                          src={$currentUser?.id
                            ? `https://a.ez-pp.farm/${$currentUser.id}`
                            : 'https://a.ez-pp.farm/1'}
                          alt="Avatar"
                          class="size-full rounded-full object-cover"
                          onerror={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                        <!-- Interactive Status Badge (Click to cycle online/idle/dnd) -->
                        <button
                          type="button"
                          class="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-2 border-[#1e1f22] cursor-pointer transition-transform hover:scale-110 {simUserStatus ===
                          'online'
                            ? 'bg-[#23a55a]'
                            : simUserStatus === 'idle'
                              ? 'bg-[#f0b232]'
                              : 'bg-[#f23f43]'}"
                          title={`Status: ${simUserStatus} (Click to toggle)`}
                          onclick={() => {
                            simUserStatus =
                              simUserStatus === 'online'
                                ? 'idle'
                                : simUserStatus === 'idle'
                                  ? 'dnd'
                                  : 'online';
                          }}
                        ></button>
                      </div>
                    </div>
                  </div>

                  <!-- User Handle Area -->
                  <div class="px-4 pt-7 pb-3">
                    <div class="text-sm font-bold text-white">
                      {$currentUser?.name ?? 'Cookiezi'}
                    </div>
                    <div class="text-[11px] font-medium text-[#949ba4]">
                      @{$currentUser?.name ? $currentUser.name.toLowerCase() : 'cookiezi'}
                    </div>
                  </div>

                  <div class="mx-4 border-t border-[#2b2d31]"></div>

                  <!-- Rich Presence Activity Section -->
                  <div class="p-4 space-y-3">
                    <!-- Header: PLAYING A GAME -->
                    <div
                      class="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#b5bac1] uppercase"
                    >
                      <span>PLAYING A GAME</span>
                      <span class="text-[9px] font-normal text-[#80848e] capitalize">
                        {previewMode === 'idle' ? 'Launcher' : 'Game'}
                      </span>
                    </div>

                    <!-- Activity Details Row -->
                    <div class="flex items-start gap-3">
                      <!-- Large Activity Image with shadcn Tooltip & Small Badge Container -->
                      <div class="relative size-20 shrink-0">
                        <Tooltip.Root>
                          <Tooltip.Trigger
                            class="relative size-full overflow-hidden rounded-xl bg-[#2b2d31] ring-1 ring-white/5 transition-all {focusedInputKey ===
                            (previewMode === 'idle'
                              ? 'idleLargeImageText'
                              : 'playingLargeImageText')
                              ? 'ring-2 ring-primary scale-105'
                              : cardInteractionMode === 'edit'
                                ? 'hover:ring-2 hover:ring-primary/60 cursor-pointer'
                                : ''}"
                            title={cardInteractionMode === 'edit'
                              ? 'Click to edit image tooltip'
                              : ''}
                            onclick={() => {
                              if (cardInteractionMode === 'edit') {
                                focusField(
                                  previewMode === 'idle'
                                    ? 'idleLargeImageText'
                                    : 'playingLargeImageText',
                                  previewMode
                                );
                              }
                            }}
                          >
                            <img
                              src={livePreview.largeImage}
                              alt="Activity Icon"
                              class="size-full object-cover"
                              onerror={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/logo.png';
                              }}
                            />
                          </Tooltip.Trigger>
                          {#if livePreview.largeImageTooltip}
                            <Tooltip.Content
                              side="top"
                              sideOffset={8}
                              class="bg-[#111214] text-white border-zinc-800 text-[11px] font-semibold px-2.5 py-1 shadow-2xl z-50 pointer-events-none"
                            >
                              {livePreview.largeImageTooltip}
                              <Tooltip.Arrow
                                class="text-[#111214] fill-[#111214]"
                                style="color: #111214;"
                              />
                            </Tooltip.Content>
                          {/if}
                        </Tooltip.Root>

                        <!-- Small Avatar Badge Overlay (with shadcn Tooltip) -->
                        {#if livePreview.showSmallImage}
                          <Tooltip.Root>
                            <Tooltip.Trigger
                              class="absolute -bottom-1 -right-1 size-7 overflow-hidden rounded-full border-2 border-[#1e1f22] bg-[#111214] transition-all z-20 {focusedInputKey ===
                              (previewMode === 'idle'
                                ? 'idleLargeImageText'
                                : 'playingSmallImageText')
                                ? 'ring-2 ring-primary scale-110'
                                : cardInteractionMode === 'edit'
                                  ? 'hover:ring-2 hover:ring-primary/60 cursor-pointer'
                                  : ''}"
                              title={cardInteractionMode === 'edit'
                                ? 'Click to edit avatar badge'
                                : ''}
                              onclick={() => {
                                if (cardInteractionMode === 'edit') {
                                  focusField(
                                    previewMode === 'idle'
                                      ? 'idleLargeImageText'
                                      : 'playingSmallImageText',
                                    previewMode
                                  );
                                }
                              }}
                            >
                              <img
                                src={livePreview.smallImage}
                                alt="Badge"
                                class="size-full object-cover"
                                onerror={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                                }}
                              />
                            </Tooltip.Trigger>
                            {#if livePreview.smallImageTooltip}
                              <Tooltip.Content
                                side="top"
                                sideOffset={6}
                                class="bg-[#111214] text-white border-zinc-800 text-[10px] font-semibold px-2 py-0.5 shadow-2xl z-50 pointer-events-none"
                              >
                                {livePreview.smallImageTooltip}
                                <Tooltip.Arrow
                                  class="text-[#111214] fill-[#111214]"
                                  style="color: #111214;"
                                />
                              </Tooltip.Content>
                            {/if}
                          </Tooltip.Root>
                        {/if}
                      </div>

                      <!-- Text Block (Interactive Fields) -->
                      <div class="min-w-0 flex-1 space-y-0.5">
                        <!-- Game Title -->
                        <div class="truncate text-xs font-bold text-white">
                          {livePreview.gameTitle}
                        </div>

                        <!-- Details Line -->
                        <button
                          type="button"
                          class="w-full text-left truncate text-xs transition-all rounded px-1 -mx-1 {focusedInputKey ===
                          (previewMode === 'idle' ? 'idleDetails' : 'playingDetails')
                            ? 'ring-2 ring-primary bg-primary/15 text-white font-medium'
                            : cardInteractionMode === 'edit'
                              ? 'text-[#dbdee1] hover:ring-1 hover:ring-primary/60 hover:bg-white/5 cursor-pointer'
                              : 'text-[#dbdee1]'}"
                          title={cardInteractionMode === 'edit' ? 'Click to edit details' : ''}
                          onclick={() => {
                            if (cardInteractionMode === 'edit') {
                              focusField(
                                previewMode === 'idle' ? 'idleDetails' : 'playingDetails',
                                previewMode
                              );
                            }
                          }}
                        >
                          {livePreview.details}
                        </button>

                        <!-- State Line -->
                        <button
                          type="button"
                          class="w-full text-left truncate text-xs transition-all rounded px-1 -mx-1 {focusedInputKey ===
                          (previewMode === 'idle' ? 'idleState' : 'playingState')
                            ? 'ring-2 ring-primary bg-primary/15 text-white font-medium'
                            : cardInteractionMode === 'edit'
                              ? 'text-[#949ba4] hover:ring-1 hover:ring-primary/60 hover:bg-white/5 cursor-pointer'
                              : 'text-[#949ba4]'}"
                          title={cardInteractionMode === 'edit' ? 'Click to edit state' : ''}
                          onclick={() => {
                            if (cardInteractionMode === 'edit') {
                              focusField(
                                previewMode === 'idle' ? 'idleState' : 'playingState',
                                previewMode
                              );
                            }
                          }}
                        >
                          {livePreview.state}
                        </button>

                        <!-- Elapsed Time (Real-Time Counter) -->
                        {#if livePreview.showTime}
                          <button
                            type="button"
                            class="flex items-center gap-1 text-[11px] text-[#949ba4] transition-all rounded px-1 -mx-1 {cardInteractionMode ===
                            'edit'
                              ? 'hover:ring-1 hover:ring-primary/60 hover:bg-white/5 cursor-pointer'
                              : ''}"
                            title={cardInteractionMode === 'edit'
                              ? 'Click to configure timestamp'
                              : ''}
                            onclick={() => {
                              if (cardInteractionMode === 'edit') {
                                focusField(
                                  previewMode === 'idle' ? 'idleDetails' : 'playingDetails',
                                  previewMode
                                );
                              }
                            }}
                          >
                            <Clock class="size-3" />
                            <span>{formatElapsed(simElapsedSeconds)}</span>
                          </button>
                        {/if}
                      </div>
                    </div>

                    <!-- Discord Action Buttons (Interactive) -->
                    <div class="space-y-1.5 pt-1">
                      {#if livePreview.button1}
                        <div
                          class="flex items-center gap-1 w-full rounded-md bg-[#2b2d31] p-1 text-xs font-semibold text-white transition-all hover:bg-[#35373c] border border-white/5 {focusedInputKey ===
                            (previewMode === 'idle' ? 'idleButton1Label' : 'playingButton1Label') ||
                          focusedInputKey ===
                            (previewMode === 'idle' ? 'idleButton1Url' : 'playingButton1Url')
                            ? 'ring-2 ring-primary bg-primary/20'
                            : ''}"
                        >
                          <button
                            type="button"
                            class="flex-1 flex items-center justify-center gap-1.5 py-1 text-xs truncate cursor-pointer"
                            title={cardInteractionMode === 'edit'
                              ? 'Click to edit Button 1'
                              : `Opens: ${livePreview.button1.url}`}
                            onclick={() => {
                              if (cardInteractionMode === 'edit') {
                                focusField(
                                  previewMode === 'idle'
                                    ? 'idleButton1Label'
                                    : 'playingButton1Label',
                                  'buttons'
                                );
                              } else {
                                testButtonClick(
                                  livePreview.button1?.label ?? '',
                                  livePreview.button1?.url ?? ''
                                );
                              }
                            }}
                          >
                            <ExternalLink class="size-3 text-[#b5bac1]" />
                            <span class="truncate">{livePreview.button1.label || 'Button 1'}</span>
                          </button>

                          <button
                            type="button"
                            class="size-6 flex items-center justify-center rounded hover:bg-white/10 text-[#b5bac1] hover:text-white cursor-pointer"
                            title={`Test Link: ${livePreview.button1.url}`}
                            onclick={() =>
                              testButtonClick(
                                livePreview.button1?.label ?? '',
                                livePreview.button1?.url ?? ''
                              )}
                          >
                            <Play class="size-2.5" />
                          </button>
                        </div>
                      {/if}

                      {#if livePreview.button2}
                        <div
                          class="flex items-center gap-1 w-full rounded-md bg-[#2b2d31] p-1 text-xs font-semibold text-white transition-all hover:bg-[#35373c] border border-white/5 {focusedInputKey ===
                            'button2Label' || focusedInputKey === 'button2Url'
                            ? 'ring-2 ring-primary bg-primary/20'
                            : ''}"
                        >
                          <button
                            type="button"
                            class="flex-1 flex items-center justify-center gap-1.5 py-1 text-xs truncate cursor-pointer"
                            title={cardInteractionMode === 'edit'
                              ? 'Click to edit Button 2'
                              : `Opens: ${livePreview.button2.url}`}
                            onclick={() => {
                              if (cardInteractionMode === 'edit') {
                                focusField('button2Label', 'buttons');
                              } else {
                                testButtonClick(
                                  livePreview.button2?.label ?? '',
                                  livePreview.button2?.url ?? ''
                                );
                              }
                            }}
                          >
                            <ExternalLink class="size-3 text-[#b5bac1]" />
                            <span class="truncate">{livePreview.button2.label || 'Button 2'}</span>
                          </button>

                          <button
                            type="button"
                            class="size-6 flex items-center justify-center rounded hover:bg-white/10 text-[#b5bac1] hover:text-white cursor-pointer"
                            title={`Test Link: ${livePreview.button2.url}`}
                            onclick={() =>
                              testButtonClick(
                                livePreview.button2?.label ?? '',
                                livePreview.button2?.url ?? ''
                              )}
                          >
                            <Play class="size-2.5" />
                          </button>
                        </div>
                      {/if}

                      {#if !livePreview.button1 && !livePreview.button2}
                        <button
                          type="button"
                          class="w-full rounded-md border border-dashed border-[#2b2d31] py-2 text-center text-[10px] text-[#80848e] hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                          onclick={() => {
                            activeTab = 'buttons';
                            focusField(
                              previewMode === 'idle' ? 'idleButton1Label' : 'playingButton1Label',
                              'buttons'
                            );
                          }}
                        >
                          + Add interactive buttons in Buttons tab
                        </button>
                      {/if}
                    </div>
                  </div>
                </div></Tooltip.Provider
              >
            </div>
          </div>

          <!-- Canvas Footer Bar -->
          <div
            class="flex h-8 shrink-0 items-center justify-between border-t border-theme-800 bg-theme-900/30 px-4 text-[9px] text-muted-foreground"
          >
            <div class="flex items-center gap-2">
              {#if cardInteractionMode === 'edit'}
                <span class="flex items-center gap-1 text-primary">
                  <MousePointerClick class="size-3" />
                  Click any field on the card to edit directly in the form
                </span>
              {:else}
                <span class="flex items-center gap-1 text-emerald-400">
                  <Play class="size-3" />
                  Interactive test mode — click buttons to test links and actions
                </span>
              {/if}
              <span class="text-theme-700">|</span>
              <span>Esc to close</span>
            </div>

            <div class="flex items-center gap-3 font-mono">
              <span>Preset: <strong class="text-theme-200">{selectedPresetName}</strong></span>
              <span class="text-theme-700">|</span>
              <span>Discord IPC v2</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
{/if}
