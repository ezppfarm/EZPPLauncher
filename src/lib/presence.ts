import { invoke } from '@tauri-apps/api/core';

export const connect = async () => await invoke('presence_connect');
export const disconnect = async () => await invoke('presence_disconnect');
export const updateStatus = async (status: {
  state?: string;
  details?: string;
  large_image_key?: string;
}) =>
  await invoke('presence_update_status', {
    state: status.state,
    details: status.details,
    largeImageKey: status.large_image_key,
  });
export const updateUser = async (user: { username: string; id: string }) =>
  await invoke('presence_update_user', { username: user.username, id: user.id });
export const isConnected = async () => await invoke<boolean>('presence_is_connected');
