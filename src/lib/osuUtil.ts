import { invoke } from '@tauri-apps/api/core';

export const setUserConfigValue = async (osuFolderPath: string, key: string, value: string) =>
  await invoke('set_osu_user_config_value', {
    osuFolderPath,
    key,
    value,
  });

export const setConfigValue = async (osuFolderPath: string, key: string, value: string) =>
  await invoke('set_osu_config_value', {
    osuFolderPath,
    key,
    value,
  });
