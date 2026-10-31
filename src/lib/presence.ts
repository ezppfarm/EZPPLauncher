import { invoke } from '@tauri-apps/api/core';

export type PresenceButtonPayload = {
  label: string;
  url: string;
};

export type PresenceActivityPayload = {
  state?: string;
  details?: string;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string | null;
  smallImageText?: string | null;
  button1?: PresenceButtonPayload | null;
  button2?: PresenceButtonPayload | null;
  showTimestamp?: boolean;
};

export const connect = async () => await invoke('presence_connect');
export const disconnect = async () => await invoke('presence_disconnect');
export const isConnected = async () => await invoke<boolean>('presence_is_connected');

export const updateActivity = async (activity: PresenceActivityPayload) =>
  await invoke('presence_update_activity', { activity });

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
  await invoke('presence_update_button', { button });
