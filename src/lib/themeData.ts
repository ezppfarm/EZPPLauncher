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

export const formatInteger = (value: number) => Math.round(value).toLocaleString('en-US');

export const formatAccuracy = (value: number) =>
  `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export const formatPlaytime = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${formatInteger(hours)}h ${minutes}m`;
  return `${minutes}m`;
};

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);

/**
 * Realistic sample values displayed in the theme editor and preview thumbnails
 * when live launcher data is empty or unavailable (e.g. logged out or offline).
 */
export const getThemeDataSampleValue = (
  field: ThemeV2DataField,
  mode: ThemeV2DataMode = 'osu'
): string => {
  switch (field) {
    case 'user.name':
      return 'Player';
    case 'user.country':
      return 'US';
    case 'user.pp':
      return mode === 'catch'
        ? '6,280'
        : mode === 'taiko'
          ? '5,140'
          : mode === 'mania'
            ? '8,920'
            : '7,420';
    case 'user.rank':
      return mode === 'catch'
        ? '840'
        : mode === 'taiko'
          ? '2,150'
          : mode === 'mania'
            ? '412'
            : '1,337';
    case 'user.plays':
      return mode === 'catch'
        ? '18,500'
        : mode === 'taiko'
          ? '12,300'
          : mode === 'mania'
            ? '35,800'
            : '42,100';
    case 'user.accuracy':
      return '98.75%';
    case 'user.playtime':
      return '124h 30m';
    case 'launcher.version':
      return '';
    case 'server.friends':
      return '12';
    case 'osu.build':
      return 'b20241030';
    case 'osu.stream':
      return 'Stable40';
    case 'server.ping':
      return '24 ms';
    case 'theme.name':
      return 'Sample Theme';
    case 'theme.author':
      return 'Theme Creator';
    case 'theme.version':
      return '1.0.0';
    case 'screen':
      return 'Home';
    case 'clock.time':
      return '14:30:00';
    case 'clock.time12':
      return '2:30:00 PM';
    case 'clock.date':
      return formatDate(new Date());
    default:
      return '';
  }
};

/** Current value for a data layer field. Missing values render as an empty string. */
export const resolveThemeDataValue = (
  field: ThemeV2DataField,
  context: ThemeDataContext,
  options?: { preview?: boolean }
) => {
  const { global, theme, screen, mode = 'osu', now = new Date() } = context;
  const stats = global.user.stats[mode];

  let value = '';
  switch (field) {
    case 'user.name':
      value = global.user.name;
      break;
    case 'user.country':
      value = global.user.country ? global.user.country.toUpperCase() : '';
      break;
    case 'user.pp':
      value = stats ? formatInteger(stats.pp) : '';
      break;
    case 'user.rank':
      value = stats && stats.rank > 0 ? formatInteger(stats.rank) : '';
      break;
    case 'user.plays':
      value = stats ? formatInteger(stats.plays) : '';
      break;
    case 'user.accuracy':
      value = stats ? formatAccuracy(stats.accuracy) : '';
      break;
    case 'user.playtime':
      value = stats ? formatPlaytime(stats.playtime) : '';
      break;
    case 'launcher.version':
      value = global.launcher.version;
      break;
    case 'server.friends':
      value = global.launcher.friends === undefined ? '' : formatInteger(global.launcher.friends);
      break;
    case 'osu.build':
      value = global.osu.build ?? '';
      break;
    case 'osu.stream':
      value = global.osu.stream ?? '';
      break;
    case 'server.ping':
      value = global.server.ping === undefined ? '' : `${Math.round(global.server.ping)} ms`;
      break;
    case 'theme.name':
      value = theme.name;
      break;
    case 'theme.author':
      value = theme.author;
      break;
    case 'theme.version':
      value = theme.version;
      break;
    case 'screen':
      value = screen ? screen.charAt(0).toUpperCase() + screen.slice(1) : '';
      break;
    case 'clock.time':
      value = String(themeClockValues(now).time ?? '');
      break;
    case 'clock.time12':
      value = String(themeClockValues(now).time12 ?? '');
      break;
    case 'clock.date':
      value = formatDate(now);
      break;
    default:
      value = '';
      break;
  }

  if (options?.preview && (!value || value.trim() === '')) {
    return getThemeDataSampleValue(field, mode);
  }

  return value;
};
