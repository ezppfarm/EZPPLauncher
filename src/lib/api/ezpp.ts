import ky from 'ky';

const BANCHO_ENDPOINT = 'https://c.ez-pp.farm/';
const ENDPOINT = 'https://ez-pp.farm/';

export const ezppfarm = {
  ping: async (): Promise<number | undefined> => {
    try {
      const start = Date.now();
      const request = await ky(BANCHO_ENDPOINT);
      if (!request.ok) return undefined;
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
    try {
      const request = await ky(`${ENDPOINT}login/check`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EZPPLauncher',
        },
      });
      if (!request.ok) return undefined;
      return await request.json<{
        code: number;
        message: string;
        user?: {
          id: number;
          donor: boolean;
          name: string;
          email: string;
        };
      }>();
    } catch {
      return undefined;
    }
  },
};
