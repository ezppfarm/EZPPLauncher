export enum Gamemodes {
  VANILLA_OSU = 0,
  VANILLA_TAIKO = 1,
  VANILLA_CATCH = 2,
  VANILLA_MANIA = 3,

  RELAX_OSU = 4,
  RELAX_TAIKO = 5,
  RELAX_CATCH = 6,

  AUTOPILOT_OSU = 8,
}

export enum Mode {
  OSU = 0,
  TAIKO = 1,
  CATCH = 2,
  MANIA = 3,
}

export enum Type {
  VANILLA = 0,
  RELAX = 4,
  AUTOPILOT = 8,
}

export const validModes = [Mode.OSU, Mode.TAIKO, Mode.CATCH, Mode.MANIA];
export const validTypes = [Type.VANILLA, Type.RELAX, Type.AUTOPILOT];
export const validModeTypeCombinations = [0, 1, 2, 3, 4, 5, 6, 8];
export const validModeTypeCombinationsSorted = [0, 4, 8, 1, 5, 2, 6, 3];

export const validMode = (modeStr: string) => modeStrToInt(modeStr) !== undefined;
export const validType = (typeStr: string) => typeStrToInt(typeStr) !== undefined;

export const modeStrToInt = (modeStr: 'osu' | 'taiko' | 'catch' | 'mania' | string) => {
  switch (modeStr) {
    case 'taiko':
      return Mode.TAIKO;
    case 'catch':
      return Mode.CATCH;
    case 'mania':
      return Mode.MANIA;
    case 'osu':
      return Mode.OSU;
  }
  return undefined;
};

export const modeIntToStr = (modeInt: number) => {
  switch (modeInt) {
    case Mode.TAIKO:
      return 'taiko';
    case Mode.CATCH:
      return 'catch';
    case Mode.MANIA:
      return 'mania';
    case Mode.OSU:
      return 'osu';
  }
  return undefined;
};

export const typeStrToInt = (typeStr: 'vanilla' | 'relax' | 'autopilot' | string) => {
  switch (typeStr) {
    case 'relax':
      return Type.RELAX;
    case 'autopilot':
      return Type.AUTOPILOT;
    case 'vanilla':
      return Type.VANILLA;
  }
  return undefined;
};

export const typeIntToStr = (typeInt: number) => {
  switch (typeInt) {
    case Type.RELAX:
      return 'relax';
    case Type.AUTOPILOT:
      return 'autopilot';
    case Type.VANILLA:
      return 'vanilla';
  }
  return undefined;
};

export const getGamemodeInt = (
  mode: 'osu' | 'taiko' | 'catch' | 'mania' | string | undefined,
  type: 'vanilla' | 'relax' | 'autopilot' | string | undefined
) => {
  let modee = 0;
  switch (mode) {
    case 'taiko':
      modee += Mode.TAIKO;
      break;
    case 'catch':
      modee += Mode.CATCH;
      break;
    case 'mania':
      modee += Mode.MANIA;
      break;
  }

  switch (type) {
    case 'relax':
      modee += Type.RELAX;
      break;
    case 'autopilot':
      modee += Type.AUTOPILOT;
      break;
  }

  return modee;
};

export const getGamemodeName = (
  mode: 'osu' | 'taiko' | 'catch' | 'mania' | string | undefined,
  type: 'vanilla' | 'relax' | 'autopilot' | string | undefined
) => {
  let modeStr = '';
  switch (mode) {
    case 'taiko':
      modeStr += 'taiko!';
      break;
    case 'catch':
      modeStr += 'catch!';
      break;
    case 'mania':
      modeStr += 'mania!';
      break;
    default:
      modeStr += 'osu!';
      break;
  }

  switch (type) {
    case 'relax':
      modeStr += 'rx';
      break;
    case 'autopilot':
      modeStr += 'ap';
      break;
    default:
      modeStr += 'vn';
      break;
  }

  return modeStr;
};

export const getModeAndTypeFromGamemode = (gamemode: number) => {
  let mode = Mode.OSU;
  let type = Type.VANILLA;
  const vanillaMode = gamemode % 4;

  switch (vanillaMode) {
    case Mode.TAIKO:
      mode = Mode.TAIKO;
      break;
    case Mode.CATCH:
      mode = Mode.CATCH;
      break;
    case Mode.MANIA:
      mode = Mode.MANIA;
      break;
  }

  const typee = gamemode - vanillaMode;
  switch (typee) {
    case Type.RELAX:
      type = Type.RELAX;
      break;
    case Type.AUTOPILOT:
      type = Type.AUTOPILOT;
      break;
  }

  return {
    mode,
    type,
  };
};

export const isValidGamemode = (gamemodeInt: number) => {
  return validModeTypeCombinations.includes(gamemodeInt);
};
