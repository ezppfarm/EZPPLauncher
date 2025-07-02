import type { EZPPUser } from '@/types';
import { betterFetch } from '@better-fetch/fetch';

const BANCHO_ENDPOINT = 'https://c.ez-pp.farm/';
const ENDPOINT = 'https://ez-pp.farm/';

export const ezppfarm = {
  ping: async (): Promise<number | undefined> => {
    try {
      const start = Date.now();
      const request = await betterFetch(BANCHO_ENDPOINT);
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
        user?: {
          id: number;
          donor: boolean;
          name: string;
          email: string;
        };
      }
    | undefined
  > => {
    const request = await betterFetch<{
      code: number;
      message: string;
      user?: EZPPUser;
    }>('https://ez-pp.farm/login/check', {
      method: 'POST',
      body: JSON.stringify({
        username: username,
        password: password,
      }),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      },
    });
    if (request.error) return undefined;
    return request.data;
  },
};
