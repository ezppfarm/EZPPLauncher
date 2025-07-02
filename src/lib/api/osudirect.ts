const API_ENDPOINT = "https://osu.direct/api/";

export const osudirect = {
  osu: async (mapId: number): Promise<string | undefined> => {
    try {
      return await (await fetch(API_ENDPOINT + `osu/${mapId}?raw`)).text();
    } catch {
      return undefined;
    }
  },
};
