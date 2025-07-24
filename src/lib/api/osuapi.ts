import type { StreamsResult } from '@/types';
import { betterFetch } from '@better-fetch/fetch';

const API_ENDPOINT = 'https://osu.ppy.sh/api/';

const timeout = 5000; // 5 seconds;

export const osuapi = {
  latestBuildVersion: async (releaseStream: string): Promise<string | undefined> => {
    const request = await betterFetch<StreamsResult>(`${API_ENDPOINT}v2/changelog`, {
      timeout,
      query: {
        stream: 'none',
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EZPPLauncher',
      },
    });
    if (request.error) {
      return undefined;
    }
    const releaseData = request.data;
    if (!releaseData || !releaseData.streams) {
      return undefined;
    }
    if (releaseData.streams.length === 0) return undefined;
    const selectedRelease = releaseData.streams.find(
      (releaseBuild) =>
        releaseBuild.name.toLowerCase() === releaseStream.replaceAll(' ', '').toLowerCase()
    );
    if (!selectedRelease) return undefined;
    return selectedRelease.latest_build.display_version;
  },
};
