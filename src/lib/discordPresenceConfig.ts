import { config } from '$lib/config';
import { updateActivity } from '$lib/presence';
import { get, writable } from 'svelte/store';

export type DiscordPresenceButtonConfig = {
  enabled: boolean;
  label: string;
  url: string;
};

export type DiscordPresenceConfig = {
  // Idle (Launcher) Configuration
  idleDetails: string;
  idleState: string;
  idleLargeImageKey: string;
  idleLargeImageText: string;
  idleShowTime: boolean;
  idleShowUserAvatar: boolean;

  // Playing (osu!) Configuration
  playingDetails: string;
  playingState: string;
  playingShowBeatmapCover: boolean;
  playingLargeImageKey: string;
  playingLargeImageText: string;
  playingShowUserAvatar: boolean;
  playingSmallImageText: string;
  playingShowTime: boolean;

  // Contextual Buttons
  idleButton1: DiscordPresenceButtonConfig;
  playingButton1: DiscordPresenceButtonConfig;

  // Secondary Button
  button2: DiscordPresenceButtonConfig;
};

export const DEFAULT_DISCORD_PRESENCE_CONFIG: DiscordPresenceConfig = {
  idleDetails: 'In Launcher',
  idleState: 'Chilling...',
  idleLargeImageKey: 'ezppfarm',
  idleLargeImageText: 'EZPPFarm Launcher',
  idleShowTime: true,
  idleShowUserAvatar: true,

  playingDetails: '[{mode}] {action}',
  playingState: '{beatmap}',
  playingShowBeatmapCover: true,
  playingLargeImageKey: 'ezppfarm',
  playingLargeImageText: '{beatmap}',
  playingShowUserAvatar: true,
  playingSmallImageText: '{username} (#{rank})',
  playingShowTime: true,

  idleButton1: {
    enabled: true,
    label: 'Download Launcher',
    url: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest',
  },
  playingButton1: {
    enabled: true,
    label: 'View Beatmap',
    url: '{beatmapUrl}',
  },
  button2: {
    enabled: true,
    label: 'Join EZPPFarm',
    url: 'https://ez-pp.farm/discord',
  },
};

export type DiscordPresencePreset = {
  name: string;
  description: string;
  config: Partial<DiscordPresenceConfig>;
};

export const DISCORD_PRESENCE_PRESETS: DiscordPresencePreset[] = [
  {
    name: 'EZPPFarm Default',
    description: 'Standard presence with beatmap covers, actions, and official links.',
    config: DEFAULT_DISCORD_PRESENCE_CONFIG,
  },
  {
    name: 'Clean & Minimal',
    description: 'Clean look without buttons or cluttered stats.',
    config: {
      idleDetails: 'In Launcher',
      idleState: 'Chilling',
      idleShowTime: true,
      idleShowUserAvatar: false,
      playingDetails: '{action}',
      playingState: '{beatmap}',
      playingShowBeatmapCover: true,
      playingShowUserAvatar: false,
      playingShowTime: true,
      idleButton1: { enabled: false, label: '', url: '' },
      playingButton1: { enabled: false, label: '', url: '' },
      button2: { enabled: false, label: '', url: '' },
    },
  },
  {
    name: 'Competitive Stats',
    description: 'Highlights your rank, performance points, and live accuracy.',
    config: {
      idleDetails: '{username} · #{rank} ({pp}pp)',
      idleState: 'Preparing to farm...',
      idleShowTime: true,
      idleShowUserAvatar: true,
      playingDetails: '[{mode}] {action} · {accuracy}',
      playingState: '{beatmap}',
      playingShowBeatmapCover: true,
      playingShowUserAvatar: true,
      playingSmallImageText: '{username} (#{rank} · {pp}pp)',
      playingShowTime: true,
      idleButton1: {
        enabled: true,
        label: 'View Profile',
        url: '{profileUrl}',
      },
      playingButton1: {
        enabled: true,
        label: 'View Beatmap',
        url: '{beatmapUrl}',
      },
      button2: {
        enabled: true,
        label: 'View Profile',
        url: '{profileUrl}',
      },
    },
  },
  {
    name: 'Streamer / Privacy',
    description: 'Hides exact map titles, player rank, and avatar for privacy.',
    config: {
      idleDetails: 'osu!',
      idleState: 'In Launcher',
      idleShowTime: false,
      idleShowUserAvatar: false,
      playingDetails: 'Playing osu!',
      playingState: 'Offline practice',
      playingShowBeatmapCover: false,
      playingShowUserAvatar: false,
      playingLargeImageKey: 'ezppfarm',
      playingLargeImageText: 'osu!',
      playingSmallImageText: '',
      playingShowTime: false,
      idleButton1: { enabled: false, label: '', url: '' },
      playingButton1: { enabled: false, label: '', url: '' },
      button2: { enabled: false, label: '', url: '' },
    },
  },
];

export type PresenceVariableContext = {
  username?: string;
  id?: string;
  rank?: string | number;
  pp?: string | number;
  accuracy?: string | number;
  mode?: string;
  action?: string;
  beatmap?: string;
  artist?: string;
  title?: string;
  diff?: string;
  version?: string;
  beatmapUrl?: string;
  profileUrl?: string;
};

export const interpolatePresenceString = (
  template: string,
  context: PresenceVariableContext
): string => {
  if (!template) return '';
  return template
    .replaceAll('{username}', context.username ?? 'Player')
    .replaceAll(
      '{rank}',
      context.rank !== undefined && context.rank !== '' ? String(context.rank) : '-'
    )
    .replaceAll('{pp}', context.pp !== undefined && context.pp !== '' ? String(context.pp) : '0')
    .replaceAll(
      '{accuracy}',
      context.accuracy !== undefined && context.accuracy !== '' ? String(context.accuracy) : '100%'
    )
    .replaceAll('{mode}', context.mode ?? 'osu!')
    .replaceAll('{action}', context.action ?? 'Playing...')
    .replaceAll('{beatmap}', context.beatmap ?? 'Idle...')
    .replaceAll('{artist}', context.artist ?? '')
    .replaceAll('{title}', context.title ?? '')
    .replaceAll('{diff}', context.diff ?? '')
    .replaceAll(
      '{version}',
      context.version !== undefined && context.version !== '' ? String(context.version) : ''
    )
    .replaceAll('{beatmapUrl}', context.beatmapUrl ?? 'https://ez-pp.farm')
    .replaceAll(
      '{profileUrl}',
      context.profileUrl ??
        (context.id ? `https://ez-pp.farm/u/${context.id}` : 'https://ez-pp.farm')
    );
};

export const discordPresenceCustomConfig = writable<DiscordPresenceConfig>(
  DEFAULT_DISCORD_PRESENCE_CONFIG
);

export const loadDiscordPresenceConfig = async (): Promise<DiscordPresenceConfig> => {
  try {
    const raw = await config
      .value<Partial<DiscordPresenceConfig>>('discord_presence_config')
      .get({});
    const merged: DiscordPresenceConfig = {
      ...DEFAULT_DISCORD_PRESENCE_CONFIG,
      ...raw,
      idleButton1: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.idleButton1, ...(raw?.idleButton1 ?? {}) },
      playingButton1: {
        ...DEFAULT_DISCORD_PRESENCE_CONFIG.playingButton1,
        ...(raw?.playingButton1 ?? {}),
      },
      button2: { ...DEFAULT_DISCORD_PRESENCE_CONFIG.button2, ...(raw?.button2 ?? {}) },
    };
    discordPresenceCustomConfig.set(merged);
    return merged;
  } catch {
    return DEFAULT_DISCORD_PRESENCE_CONFIG;
  }
};

export const saveDiscordPresenceConfig = async (
  newConfig: DiscordPresenceConfig
): Promise<void> => {
  discordPresenceCustomConfig.set(newConfig);
  try {
    await config.value<DiscordPresenceConfig>('discord_presence_config').set(newConfig);
  } catch (err) {
    console.error('Failed to save discord presence config:', err);
  }
};

export type IdlePresenceParams = {
  user?: { id?: number | string; name?: string } | null;
  version?: string;
  rank?: number | string;
  pp?: number | string;
  accuracy?: number | string;
};

export type PlayingPresenceParams = {
  user?: { id?: number | string; name?: string } | null;
  mode?: string;
  action?: string;
  beatmap?: string;
  artist?: string;
  title?: string;
  diff?: string;
  version?: string;
  beatmapCoverUrl?: string | null;
  beatmapUrl?: string | null;
  profileUrl?: string | null;
  rank?: number | string;
  pp?: number | string;
  accuracy?: number | string;
};

const isValidHttpUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

export const pushIdlePresenceFromConfig = async (
  params?: IdlePresenceParams,
  cfg?: DiscordPresenceConfig
): Promise<void> => {
  const currentCfg = cfg ?? get(discordPresenceCustomConfig);
  const context: PresenceVariableContext = {
    username: params?.user?.name,
    id: params?.user?.id ? String(params.user.id) : undefined,
    rank: params?.rank,
    pp: params?.pp,
    accuracy: params?.accuracy,
    version: params?.version,
    profileUrl: params?.user?.id ? `https://ez-pp.farm/u/${params.user.id}` : 'https://ez-pp.farm',
  };

  const details = interpolatePresenceString(currentCfg.idleDetails, context);
  const state = interpolatePresenceString(currentCfg.idleState, context);
  const largeImageKey = currentCfg.idleLargeImageKey || 'ezppfarm';
  const largeImageText = interpolatePresenceString(currentCfg.idleLargeImageText, context);

  let smallImageKey: string | null = null;
  let smallImageText: string | null = null;
  if (currentCfg.idleShowUserAvatar && params?.user?.id) {
    smallImageKey = `https://a.ez-pp.farm/${params.user.id}`;
    smallImageText = params.user.name ?? 'Player';
  }

  let button1: { label: string; url: string } | null = null;
  if (currentCfg.idleButton1.enabled && currentCfg.idleButton1.label.trim()) {
    const rawUrl = interpolatePresenceString(currentCfg.idleButton1.url, context);
    if (isValidHttpUrl(rawUrl)) {
      button1 = {
        label: interpolatePresenceString(currentCfg.idleButton1.label, context),
        url: rawUrl,
      };
    }
  }

  let button2: { label: string; url: string } | null = null;
  if (currentCfg.button2.enabled && currentCfg.button2.label.trim()) {
    const rawUrl = interpolatePresenceString(currentCfg.button2.url, context);
    if (isValidHttpUrl(rawUrl)) {
      button2 = {
        label: interpolatePresenceString(currentCfg.button2.label, context),
        url: rawUrl,
      };
    }
  }

  try {
    await updateActivity({
      state,
      details,
      largeImageKey,
      largeImageText,
      smallImageKey,
      smallImageText,
      button1,
      button2,
      showTimestamp: currentCfg.idleShowTime,
    });
  } catch (err) {
    console.warn('Failed to push idle Discord presence:', err);
  }
};

export const pushPlayingPresenceFromConfig = async (
  params: PlayingPresenceParams,
  cfg?: DiscordPresenceConfig
): Promise<void> => {
  const currentCfg = cfg ?? get(discordPresenceCustomConfig);
  const context: PresenceVariableContext = {
    username: params.user?.name,
    id: params.user?.id ? String(params.user.id) : undefined,
    rank: params.rank,
    pp: params.pp,
    accuracy: params.accuracy,
    mode: params.mode,
    action: params.action,
    beatmap: params.beatmap,
    artist: params.artist,
    title: params.title,
    diff: params.diff,
    version: params.version,
    beatmapUrl: params.beatmapUrl ?? 'https://ez-pp.farm',
    profileUrl:
      params.profileUrl ??
      (params.user?.id ? `https://ez-pp.farm/u/${params.user.id}` : 'https://ez-pp.farm'),
  };

  const details = interpolatePresenceString(currentCfg.playingDetails, context);
  const state = interpolatePresenceString(currentCfg.playingState, context);

  let largeImageKey = currentCfg.playingLargeImageKey || 'ezppfarm';
  if (currentCfg.playingShowBeatmapCover && params.beatmapCoverUrl) {
    largeImageKey = params.beatmapCoverUrl;
  }
  const largeImageText = interpolatePresenceString(currentCfg.playingLargeImageText, context);

  let smallImageKey: string | null = null;
  let smallImageText: string | null = null;
  if (currentCfg.playingShowUserAvatar && params.user?.id) {
    smallImageKey = `https://a.ez-pp.farm/${params.user.id}`;
    smallImageText = interpolatePresenceString(currentCfg.playingSmallImageText, context);
  }

  let button1: { label: string; url: string } | null = null;
  if (currentCfg.playingButton1.enabled && currentCfg.playingButton1.label.trim()) {
    const rawUrl = interpolatePresenceString(currentCfg.playingButton1.url, context);
    if (isValidHttpUrl(rawUrl)) {
      button1 = {
        label: interpolatePresenceString(currentCfg.playingButton1.label, context),
        url: rawUrl,
      };
    }
  }

  let button2: { label: string; url: string } | null = null;
  if (currentCfg.button2.enabled && currentCfg.button2.label.trim()) {
    const rawUrl = interpolatePresenceString(currentCfg.button2.url, context);
    if (isValidHttpUrl(rawUrl)) {
      button2 = {
        label: interpolatePresenceString(currentCfg.button2.label, context),
        url: rawUrl,
      };
    }
  }

  try {
    await updateActivity({
      state,
      details,
      largeImageKey,
      largeImageText,
      smallImageKey,
      smallImageText,
      button1,
      button2,
      showTimestamp: currentCfg.playingShowTime,
    });
  } catch (err) {
    console.warn('Failed to push playing Discord presence:', err);
  }
};
