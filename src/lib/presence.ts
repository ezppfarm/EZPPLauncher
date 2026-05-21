import { invoke } from '@tauri-apps/api/core';

export const connect = async () => await invoke('presence_connect');
export const disconnect = async () => await invoke('presence_disconnect');
export const updateStatus = async (status: {
  state: string;
  details: string;
  largeImageKey?: string;
}) =>
  await invoke('presence_update_status', {
    status: {
      state: status.state,
      details: status.details,
      largeImageKey: status.largeImageKey,
    },
  });
export const updateUser = async (user: { username: string; id?: string | null }) =>
  await invoke('presence_update_user', { user: { username: user.username, id: user.id } });
export const updateButton = async (button: { text?: string; url?: string }) =>
  await invoke('presence_update_button', { button: button });
export const isConnected = async () => await invoke<boolean>('presence_is_connected');
