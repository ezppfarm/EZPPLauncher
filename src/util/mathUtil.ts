export const clamp = (val: number, min: number, max: number) => {
  return val <= min ? min : val >= max ? max : val;
};
