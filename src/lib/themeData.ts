import { currentUserInfo } from './data';
import { launcherVersion, onlineFriends, osuBuild, osuStream, serverPing } from './global';
import { themeClockValues } from './themeClock';
import type { ThemeV2DataField, ThemeV2DataMode } from './themeV2';
import { currentUser } from './userAuthentication';
import { derived } from 'svelte/store';

export type ThemeDataStats = {
  pp: number;
  rank: number;
  plays: number;
  accuracy: number;
  playtime: number;
};

/** Live launcher values shared by every data layer. */
export type ThemeGlobalData = {
  user: {
    name: string;
    country: string;
    stats: Record<ThemeV2DataMode, ThemeDataStats | undefined>;
  };
  launcher: { version: string; friends: number | undefined };
  osu: { build: string | undefined; stream: string | undefined };
  server: { ping: number | undefined };
};

export type ThemeDataContext = {
  global: ThemeGlobalData;
  theme: { name: string; author: string; version: string };
  screen: string;
  mode?: ThemeV2DataMode;
  now?: Date;
};

const MODE_KEYS: Record<ThemeV2DataMode, number> = {
  osu: 0,
  taiko: 1,
  catch: 2,
  mania: 3,
};

const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const emptyStats = (): Record<ThemeV2DataMode, ThemeDataStats | undefined> => ({
  osu: undefined,
  taiko: undefined,
  catch: undefined,
  mania: undefined,
});

export const themeGlobalData = derived(
  [currentUser, currentUserInfo, launcherVersion, osuBuild, osuStream, serverPing, onlineFriends],
  ([$user, $info, $version, $build, $stream, $ping, $friends]): ThemeGlobalData => {
    const stats = emptyStats();
    for (const mode of Object.keys(MODE_KEYS) as ThemeV2DataMode[]) {
      const raw = $info?.stats?.[MODE_KEYS[mode]];
      if (!raw) continue;
      stats[mode] = {
        pp: number(raw.pp) ?? 0,
        rank: number(raw.rank) ?? 0,
        plays: number(raw.plays) ?? 0,
        accuracy: number(raw.acc) ?? 0,
        playtime: number(raw.playtime) ?? 0,
      };
    }

    return {
      user: {
        name: $user?.name ?? $info?.info.name ?? '',
        country: $info?.info.country ?? '',
        stats,
      },
      launcher: {
        version: $version ?? '',
        friends: $friends,
      },
      osu: { build: $build, stream: $stream },
      server: { ping: $ping },
    };
  }
);

const formatInteger = (value: number) => Math.round(value).toLocaleString('en-US');

const formatAccuracy = (value: number) =>
  `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const formatPlaytime = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${formatInteger(hours)}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);

/** Current value for a data layer field. Missing values render as an empty string. */
export const resolveThemeDataValue = (field: ThemeV2DataField, context: ThemeDataContext) => {
  const { global, theme, screen, mode = 'osu', now = new Date() } = context;
  const stats = global.user.stats[mode];

  switch (field) {
    case 'user.name':
      return global.user.name;
    case 'user.country':
      return global.user.country.toUpperCase();
    case 'user.pp':
      return stats ? formatInteger(stats.pp) : '';
    case 'user.rank':
      return stats && stats.rank > 0 ? formatInteger(stats.rank) : '';
    case 'user.plays':
      return stats ? formatInteger(stats.plays) : '';
    case 'user.accuracy':
      return stats ? formatAccuracy(stats.accuracy) : '';
    case 'user.playtime':
      return stats ? formatPlaytime(stats.playtime) : '';
    case 'launcher.version':
      return global.launcher.version;
    case 'server.friends':
      return global.launcher.friends === undefined ? '' : formatInteger(global.launcher.friends);
    case 'osu.build':
      return global.osu.build ?? '';
    case 'osu.stream':
      return global.osu.stream ?? '';
    case 'server.ping':
      return global.server.ping === undefined ? '' : `${Math.round(global.server.ping)} ms`;
    case 'theme.name':
      return theme.name;
    case 'theme.author':
      return theme.author;
    case 'theme.version':
      return theme.version;
    case 'screen':
      return screen ? screen.charAt(0).toUpperCase() + screen.slice(1) : '';
    case 'clock.time':
      return String(themeClockValues(now).time ?? '');
    case 'clock.time12':
      return String(themeClockValues(now).time12 ?? '');
    case 'clock.date':
      return formatDate(now);
    default:
      return '';
  }
};
