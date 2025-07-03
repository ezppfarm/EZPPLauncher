import { invoke } from '@tauri-apps/api/core';

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

export const getPreviousReleaseStream = async (folder: string) => {
  const result = await invoke('get_osu_previous_release_stream', { folder });
  return typeof result === 'string' ? result : undefined;
};
