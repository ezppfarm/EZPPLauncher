import { invoke } from '@tauri-apps/api/core';
import type { UpdateFile, UpdateStatus } from './types';
import { listen } from '@tauri-apps/api/event';
import { betterFetch } from '@better-fetch/fetch';

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

export const getHWID = async () => {
  const hwid = await invoke('get_hwid');
  return typeof hwid === 'string' ? hwid : undefined;
};

export const isValidOsuFolder = async (folder: string): Promise<boolean> => {
  const result = await invoke('valid_osu_folder', { folder });
  return typeof result === 'boolean' ? result : false;
};

export const autoDetectOsuInstallFolder = async () => {
  const result = await invoke('find_osu_installation');
  return typeof result === 'string' ? result : undefined;
};

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

export const getReleaseStream = async (folder: string) => {
  const result = await invoke('get_osu_release_stream', { folder });
  return typeof result === 'string' ? result : undefined;
};

export const getVersion = async (folder: string) => {
  const result = await invoke('get_osu_version', { folder });
  return typeof result === 'string' ? result : undefined;
};

export const getBeatmapSetsCount = async (folder: string) => {
  const result = await invoke('get_beatmapsets_count', {
    folder,
  });
  return typeof result === 'number' ? result : 0;
};

export const getSkin = async (folder: string) => {
  const result = await invoke('get_osu_skin', {
    folder,
  });

  return typeof result === 'string' ? result : 'Default';
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
  const downloadStatusListen = await listen('download-progress', (event) =>
    progressCallback(event.payload as UpdateStatus)
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

export const isOsuRunning = async () => {
  const result = await invoke('is_osu_running');
  return typeof result === 'boolean' ? result : false;
};

export const getLauncherVersion = async () => await invoke<string>('get_launcher_version');
export const exit = async () => await invoke('exit');
export const getPlatform = async () => await invoke<string>('get_platform');
export const isOsuCorrupted = async (folder: string) =>
  await invoke<boolean>('check_for_corruption', { folder });
export const hasWMCTRL = async () => await invoke<boolean>('has_wmctrl');
export const hasOsuWinello = async () => await invoke<boolean>('has_osuwinello');
export const hasNet8 = async () => await invoke<boolean>('has_net8');
export const encryptString = async (str: string, entropy: string) =>
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
