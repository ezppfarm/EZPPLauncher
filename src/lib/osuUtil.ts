import type { UpdateFile, UpdateStatus } from './types';
import { betterFetch } from '@better-fetch/fetch';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const updateUrl = 'https://ez-pp.farm/api/ezpplauncher';

export function normalizeOsuName(name: string): string {
  return (
    name
      .trim()
      // Remove leading symbols/spaces
      .replace(/^[^a-zA-Z0-9]+/, '')
      // Normalize spacing
      .replace(/\s+/g, ' ')
      .toLowerCase()
  );
}

export const getHWID = async (): Promise<string | undefined> =>
  await invoke<string | undefined>('get_hwid');

export const isValidOsuFolder = async (folder: string): Promise<boolean | undefined> =>
  await invoke<boolean | undefined>('valid_osu_folder', { folder });

export const autoDetectOsuInstallFolder = async () =>
  await invoke<string | undefined>('find_osu_installation');

export const setUserConfigValues = async (
  osuFolderPath: string,
  entries: { key: string; value: string }[]
) =>
  await invoke('set_osu_user_config_values', {
    osuFolderPath,
    entries,
  });

export const setConfigValues = async (
  osuFolderPath: string,
  entries: { key: string; value: string }[]
) =>
  await invoke('set_osu_config_values', {
    osuFolderPath,
    entries,
  });

export const getReleaseStream = async (folder: string): Promise<string | undefined> =>
  await invoke<string | undefined>('get_osu_release_stream', { folder });

export const getVersion = async (folder: string): Promise<string | undefined> =>
  await invoke<string | undefined>('get_osu_version', { folder });

export const getBeatmapSetsCount = async (folder: string): Promise<number | undefined> =>
  await invoke<number | undefined>('get_beatmapsets_count', {
    folder,
  });

export const getSkin = async (folder: string) => {
  const result = await invoke<string | undefined>('get_osu_skin', {
    folder,
  });

  return result || 'Default';
};

export const runUpdater = async (folder: string) => await invoke('run_osu_updater', { folder });
export const runOsu = async (folder: string, patch: boolean) =>
  await invoke('run_osu', { folder, patch });

export const getEZPPLauncherStreams = async () => {
  const resp = await betterFetch<{ streams: string[] }>(updateUrl, {
    method: 'POST',
  });

  if (!resp.error) {
    return resp.data.streams;
  }
  return undefined;
};

export const getEZPPLauncherUpdateFiles = async (folder: string, updateStream: string) => {
  const result = await invoke('get_ezpp_launcher_update_files', {
    folder,
    updateUrl,
    updateStream,
  });
  if (typeof result === 'object') {
    const [filesToDownload, updateFiles] = result as [UpdateFile[], UpdateFile[]];
    return {
      filesToDownload,
      updateFiles,
    };
  }

  return undefined;
};

export const downloadEZPPLauncherUpdateFiles = async (
  folder: string,
  updateFiles: UpdateFile[],
  allFiles: UpdateFile[],
  progressCallback: (file: UpdateStatus) => void
) => {
  const downloadStatusListen = await listen<UpdateStatus>('download-progress', (event) =>
    progressCallback(event.payload)
  );
  try {
    await invoke('download_ezpp_launcher_update_files', { folder, updateFiles, allFiles });
  } finally {
    downloadStatusListen();
  }
};

export const replaceUIFiles = async (folder: string, revert: boolean) => {
  await invoke('replace_ui_files', { folder, revert });
};

export const isOsuRunning = async (): Promise<boolean> => await invoke<boolean>('is_osu_running');

export const getLauncherVersion = async () => await invoke<string>('get_launcher_version');
export const exit = async () => await invoke('exit');
export const getPlatform = async (): Promise<string> => await invoke<string>('get_platform');
export const isOsuCorrupted = async (folder: string): Promise<boolean> =>
  await invoke<boolean>('check_for_corruption', { folder });
export const hasWMCTRL = async (): Promise<boolean> => await invoke<boolean>('has_wmctrl');
export const hasOsuWinello = async (): Promise<boolean> => await invoke<boolean>('has_osuwinello');
export const hasNet8 = async (): Promise<boolean> => await invoke<boolean>('has_net8');
export const encryptString = async (str: string, entropy: string): Promise<string> =>
  await invoke<string>('encrypt_string', { string: str, entropy });
export const downloadUpdate = async (
  url: string,
  progressCallback: (file: UpdateStatus) => void
) => {
  const downloadStatusListen = await listen('download-progress', (event) =>
    progressCallback(event.payload as UpdateStatus)
  );
  try {
    await invoke<string>('download_ezpp_launcher_update', { url });
  } finally {
    downloadStatusListen();
  }
};
export const installUpdate = async () => await invoke('install_ezpp_launcher_update');
export const getSkins = async (folder: string) =>
  await invoke<{ name: string; author: string | undefined; modified: number }[] | undefined>(
    'get_skins',
    { folder }
  );
export const startOpenTabletDriver = async (otdDaemonPath: string) =>
  await invoke('run_open_tablet_driver', { path: otdDaemonPath });
export const stopOpenTabletDriver = async () => await invoke('stop_open_tablet_driver');
export const isOpenTabletDriverRunning = async () => await invoke('is_open_tablet_driver_running');
export const isOpenTabletDriverPathValid = async (path: string) =>
  await invoke('is_open_tablet_driver_path_valid', { path });
