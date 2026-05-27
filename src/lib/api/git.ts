import type { Release } from '$lib/types';
import { betterFetch } from '@better-fetch/fetch';
import semver from 'semver';

const ENDPOINT = 'https://git.ez-pp.farm/';

const timeout = 5000; // 5 seconds;

export const git = {
  hasUpdate: async (version: string): Promise<Release | undefined> => {
    try {
      const request = await betterFetch<Release[]>(
        `${ENDPOINT}api/v1/repos/EZPPFarm/EZPPLauncher/releases?limit=1`,
        {
          timeout,
          headers: {
            'User-Agent': 'EZPPLauncher',
          },
        }
      );
      if (request.error) return undefined;

      const latestRelease = request.data[0];
      if (!latestRelease) return undefined;

      const hasUpdate = semver.lt(version, latestRelease.tag_name);

      return hasUpdate ? latestRelease : undefined;
    } catch {
      return undefined;
    }
  },
};
