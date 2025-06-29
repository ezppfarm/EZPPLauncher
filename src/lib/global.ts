import { writable } from 'svelte/store';
import { ezppfarm } from './api/ezpp';

export const server_ping = writable<number | undefined>(undefined);
export const server_connection_fails = writable(0);

export const online_friends = writable<number | undefined>(undefined);

export const beatmap_sets = writable<number | undefined>(undefined);

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
  const serverPing = await ezppfarm.ping();
  if (!serverPing) {
    server_connection_fails.update((num) => num + 1);
  } else {
    server_connection_fails.set(0);
    server_ping.set(serverPing);
  }
};

const updateFriends = async () => {
  await new Promise((res) => setTimeout(res, Math.random() * 300));
  const onlineFriends = Math.round(Math.random() * 10);
  online_friends.set(onlineFriends);
};

const updateBeatmapSets = async () => {
  await new Promise((res) => setTimeout(res, Math.random() * 1500));
  const beatmapSets = Math.round(Math.random() * 5000);
  beatmap_sets.set(beatmapSets);
};
