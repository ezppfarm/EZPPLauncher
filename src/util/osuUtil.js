const fs = require("fs");
const path = require("path");

const checkUpdateURL =
  "https://osu.ppy.sh/web/check-updates.php?action=check&stream=";
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

async function getUserConfig(osuPath) {
  const configFileInfo = {
    name: "",
    path: "",
    get: async (key) => {
      if (!configFileInfo.path) {
        return "";
      }
      const fileStream = await fs.promises.readFile(
        configFileInfo.path,
        "utf-8",
      );
      const lines = fileStream.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(" = ")) {
          const argsPair = line.split(" = ", 2);
          const keyname = argsPair[0];
          const value = argsPair[1];
          if (keyname == key) {
            return value;
          }
        }
      }
    },
  };
  const userOsuConfig = path.join(
    osuPath,
    `osu!.${process.env["USERNAME"]}.cfg`,
  );
  if (fs.existsSync(userOsuConfig)) {
    configFileInfo.name = `osu!.${process.env["USERNAME"]}.cfg`;
    configFileInfo.path = userOsuConfig;
  }
  return configFileInfo;
}

async function getUpdateFiles(releaseStream) {
  const releaseData = await fetch(checkUpdateURL + releaseStream);
  return releaseData.ok ? await releaseData.json() : undefined;
}

module.exports = { isValidOsuFolder, getUserConfig, getUpdateFiles };
