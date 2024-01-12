const fs = require("fs");
const path = require("path");

const ignoredOsuEntities = [
  "osu!auth.dll",
];
const osuEntities = [
  "avcodec-51.dll",
  "avformat-52.dll",
  "avutil-49.dll",
  "bass.dll",
  "bass_fx.dll",
  "collection.db",
  "d3dcompiler_47.dll",
  "libEGL.dll",
  "libGLESv2.dll",
  "Microsoft.Ink.dll",
  "OpenTK.dll",
  "osu!.cfg",
  "osu!.db",
  "osu!.exe",
  "osu!auth.dll",
  "osu!gameplay.dll",
  "osu!seasonal.dll",
  "osu!ui.dll",
  "presence.db",
  "pthreadGC2.dll",
  "scores.db",
];

async function isValidOsuFolder(path) {
  const allFiles = await fs.promises.readdir(path);
  let matches = 0;
  for (const file of allFiles) {
    if (osuEntities.includes(file)) matches = matches + 1;
  }
  return (Math.round((matches / osuEntities.length) * 100) >= 60);
}

module.exports = { isValidOsuFolder };
