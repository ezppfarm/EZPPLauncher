import type {
  EZPPUser,
  EZPPUserInfoResponse,
  EZPPUserResponse,
  EZPPUSerStatusResponse,
} from '@/types';
import { betterFetch } from '@better-fetch/fetch';

const BANCHO_ENDPOINT = 'https://c.ez-pp.farm/';
const API_ENDPOINT = 'https://api.ez-pp.farm/';
const ENDPOINT = 'https://ez-pp.farm/';

const timeout = 5000; // 5 seconds;

export const ezppfarm = {
  ping: async (): Promise<number | undefined> => {
    try {
      const start = Date.now();
      const request = await betterFetch(BANCHO_ENDPOINT, {
        timeout,
        headers: {
          'User-Agent': 'EZPPLauncher',
        },
      });
      if (request.error) return undefined;
      const ping = Date.now() - start;
      return ping;
    } catch {
      return undefined;
    }
  },
  login: async (
    username: string,
    password: string
  ): Promise<
    | {
        code: number;
        message: string;
        user?: EZPPUser;
      }
    | undefined
  > => {
    const request = await betterFetch<EZPPUserResponse>(`${ENDPOINT}login/check`, {
      method: 'POST',
      timeout,
      body: JSON.stringify({
        username: username,
        password: password,
      }),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EZPPLauncher',
      },
    });
    if (request.error) {
      if (request.error.status >= 500 && request.error.status < 600)
        throw new Error('Server not reachable');
      return undefined;
    }
    return request.data;
  },
  getUserInfo: async (userId: number, scope: 'all' | 'info' | 'stats' = 'all') => {
    const request = await betterFetch<EZPPUserInfoResponse>(`${API_ENDPOINT}v1/get_player_info`, {
      timeout,
      query: {
        id: userId,
        scope,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EZPPLauncher',
      },
    });
    return request.error ? undefined : request.data;
  },
  getUserStatus: async (userId: number) => {
    const request = await betterFetch<EZPPUSerStatusResponse>(
      `${API_ENDPOINT}v1/get_player_status`,
      {
        timeout,
        query: {
          id: userId,
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EZPPLauncher',
        },
      }
    );
    return request.error ? undefined : request.data;
  },
};
