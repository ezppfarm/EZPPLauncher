import { writable } from 'svelte/store';
import { ezppfarm } from './api/ezpp';
import type { Component } from 'svelte';
import Loading from '../pages/Loading.svelte';

export const currentView = writable<Component>(Loading);

export const currentLoadingInfo = writable<string>('Initializing...');

export const firstStartup = writable<boolean>(false);

export const serverPing = writable<number | undefined>(undefined);
export const serverConnectionFails = writable(0);

export const onlineFriends = writable<number | undefined>(undefined);

export const beatmapSets = writable<number | undefined>(undefined);
export const skins = writable<number | undefined>(undefined);

export const osuStream = writable<string | undefined>(undefined);
export const osuBuild = writable<string | undefined>(undefined);

export const setupValues = () => {
  updatePing();
  updateFriends();
  updateBeatmapSets();
  const pingUpdater = setInterval(updatePing, 5000 * 2);
  const friendUpdater = setInterval(updateFriends, 5000 * 2);

  return () => {
    clearInterval(pingUpdater);
    clearInterval(friendUpdater);
  };
};

const updatePing = async () => {
  const currentServerPing = await ezppfarm.ping();
  if (!currentServerPing) {
    serverConnectionFails.update((num) => num + 1);
  } else {
    serverConnectionFails.set(0);
    serverPing.set(currentServerPing);
  }
};

const updateFriends = async () => {
  await new Promise((res) => setTimeout(res, Math.random() * 300));
  const currentOnlineFriends = Math.round(Math.random() * 10);
  onlineFriends.set(currentOnlineFriends);
};

const updateBeatmapSets = async () => {};
