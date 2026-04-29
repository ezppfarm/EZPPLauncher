import { writable } from 'svelte/store';
import { ezppfarm } from './api/ezpp';
import type { Component } from 'svelte';
import Loading from '../screens/Loading.svelte';
import type { Release } from './types';
import { THEMES } from './themes';

export const currentView = writable<Component>(Loading);

export const platform = writable<string>('');

export const launcherVersion = writable<string>('');
export const newVersion = writable<Release | undefined>(undefined);

export const launcherStreams = writable<string[]>(['stable']);
export const launcherStream = writable<string>('stable');

export const trackingEnabled = writable<boolean>(false);

export const discordPresence = writable<boolean>(false);
export const presenceLoading = writable<boolean>(false);

export const currentLoadingInfo = writable<string>('Initializing...');

export const firstStartup = writable<boolean>(false);

export const launching = writable<boolean>(false);
export const theme = writable<(typeof THEMES)[number]>(THEMES[0]);
export const theme_video = writable<HTMLVideoElement | undefined>(undefined);

export const serverPing = writable<number | undefined>(undefined);
export const serverConnectionFails = writable(0);

export const onlineFriends = writable<number | undefined>(undefined);

export const beatmapSets = writable<number | undefined>(undefined);
export const skinsCount = writable<number | undefined>(undefined);
export const skins = writable<{ name: string; author: string | undefined; modified: number }[]>([]);

export const osuStream = writable<string | undefined>(undefined);
export const osuBuild = writable<string | undefined>(undefined);

export const currentSkin = writable<string>('');

let updateValues = true;
launching.subscribe((val) => (updateValues = !val));

export const setupValues = () => {
  updatePing();
  const pingUpdater = setInterval(updatePing, 5000 * 2);

  return () => {
    clearInterval(pingUpdater);
  };
};

const updatePing = async () => {
  if (!updateValues) return;
  const currentServerPing = await ezppfarm.ping();
  if (!currentServerPing) {
    serverConnectionFails.update((num) => num + 1);
  } else {
    serverConnectionFails.set(0);
    serverPing.set(currentServerPing);
  }
};
