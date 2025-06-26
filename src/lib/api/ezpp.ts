import ky from 'ky';

const BANCHO_ENDPOINT = 'https://c.ez-pp.farm/';

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
};
