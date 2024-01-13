const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");
const { default: axios } = require("axios");
const { runFile } = require("./executeUtil");

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

const patcherFiles = [
  {
    name: "patcher.exe",
    url_download: "https://ez-pp.farm/assets/patcher.exe",
    url_hash: "https://ez-pp.farm/assets/patcher.md5"
  },
  {
    name: "patch.hook.dll",
    url_download: "https://ez-pp.farm/assets/patch.hook.dll",
    url_hash: "https://ez-pp.farm/assets/patch.hook.md5"
  }
]

const uiFiles = [
  {
    name: "ezpp!ui.dll",
    url_download: "https://ez-pp.farm/assets/ezpp!ui.dll",
    url_hash: "https://ez-pp.farm/assets/ezpp!ui.md5"
  }
]

async function isValidOsuFolder(path) {
  const allFiles = await fs.promises.readdir(path);
  let matches = 0;
  for (const file of allFiles) {
    if (osuEntities.includes(file)) matches = matches + 1;
  }
  return (Math.round((matches / osuEntities.length) * 100) >= 60);
}

function getGlobalConfig(osuPath) {
  const configFileInfo = {
    name: "",
    path: "",
    get: async (key) => {
      if (!configFileInfo.path) {
        console.log("config file not loaded");
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
  const globalOsuConfig = path.join(osuPath, "osu!.cfg");
  if (fs.existsSync(globalOsuConfig)) {
    configFileInfo.name = "osu!.cfg";
    configFileInfo.path = globalOsuConfig;
  }
  return configFileInfo;
}

function getUserConfig(osuPath) {
  const configFileInfo = {
    name: "",
    path: "",
    set: async (key, newValue) => {
      if (!configFileInfo.path) {
        return "";
      }
      const fileContents = [];
      const fileStream = await fs.promises.readFile(
        configFileInfo.path,
        "utf-8",
      );
      const lines = fileStream.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(" = ")) {
          const argsPair = line.split(" = ", 2);
          const keyname = argsPair[0];
          if (keyname == key) {
            fileContents.push(`${key} = ${newValue}`);
          } else {
            fileContents.push(line);
          }
        } else {
          fileContents.push(line);
        }
      }
      await fs.promises.writeFile(configFileInfo.path, fileContents.join("\n"));

      return true;
    },
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

async function getFilesThatNeedUpdate(osuPath, releaseStreamFiles) {
  const updateFiles = [];
  for (const updatePatch of releaseStreamFiles) {
    const fileName = updatePatch.filename;
    const fileHash = updatePatch.file_hash;

    const fileOnDisk = path.join(osuPath, fileName);
    if (fs.existsSync(fileOnDisk)) {
      if (ignoredOsuEntities.includes(fileName)) continue;
      const fileHashOnDisk = crypto.createHash("md5").update(fs.readFileSync(fileOnDisk)).digest("hex");
      if (fileHashOnDisk.trim().toLowerCase() != fileHash.trim().toLowerCase()) {
        console.log({
          fileOnDisk,
          fileHashOnDisk,
          fileHash
        })
        updateFiles.push(updatePatch);
      }
    } else updateFiles.push(updatePatch);
  }

  return updateFiles;
}

function downloadUpdateFiles(osuPath, updateFiles) {
  const eventEmitter = new EventEmitter();

  const startDownload = async () => {
    for (const updatePatch of updateFiles) {
      const fileName = updatePatch.filename;
      const fileSize = updatePatch.filesize;
      const fileURL = updatePatch.url_full;

      const axiosDownloadWithProgress = await axios.get(fileURL, {
        responseType: "stream",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          eventEmitter.emit("data", {
            fileName,
            loaded,
            total,
            progress: Math.floor((loaded / total) * 100)
          });
        },
      });
      axiosDownloadWithProgress.data.on("end", () => {
        eventEmitter.emit("data", {
          fileName,
          loaded: fileSize,
          total: fileSize,
          progress: 100
        });
      })
      await fs.promises.writeFile(path.join(osuPath, fileName), axiosDownloadWithProgress.data);
    }

    // wait until all files are downloaded
    return true;
  }

  return {
    eventEmitter,
    startDownload,
  }
}

function runOsuWithDevServer(osuPath, serverDomain, onExit) {
  const osuExecuteable = path.join(osuPath, "osu!.exe");
  runFile(osuPath, osuExecuteable, ["-devserver", serverDomain], onExit);
}

async function getPatcherUpdates(osuPath) {

  const filesToDownload = [];

  const patcherDir = path.join(osuPath, "EZPPLauncher");
  if (!fs.existsSync(patcherDir)) fs.mkdirSync(patcherDir);

  for (const patcherFile of patcherFiles) {
    if (fs.existsSync(path.join(patcherDir, patcherFile.name))) {
      const latestPatchFileHash = await (await fetch(patcherFile.url_hash)).text();
      const localPatchFileHash = crypto.createHash("md5").update(fs.readFileSync(path.join(patcherDir, patcherFile.name))).digest("hex");
      if (latestPatchFileHash.trim().toLowerCase() != localPatchFileHash.trim().toLowerCase()) filesToDownload.push(patcherFile);
    } else filesToDownload.push(patcherFile);
  }

  return filesToDownload;
}

function downloadPatcherUpdates(osuPath, patcherUpdates) {
  const eventEmitter = new EventEmitter();

  const startDownload = async () => {

    const patcherDir = path.join(osuPath, "EZPPLauncher");
    if (!fs.existsSync(patcherDir)) fs.mkdirSync(patcherDir);

    for (const patcherFile of patcherUpdates) {
      const fileName = patcherFile.name;
      const fileURL = patcherFile.url_download;
      const axiosDownloadWithProgress = await axios.get(fileURL, {
        responseType: "stream",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          eventEmitter.emit("data", {
            fileName,
            loaded,
            total,
            progress: Math.floor((loaded / total) * 100)
          });
        },
      });

      await fs.promises.writeFile(path.join(osuPath, "EZPPLauncher", fileName), axiosDownloadWithProgress.data);
    }
  }

  return {
    eventEmitter,
    startDownload,
  }
}

async function getUIFiles(osuPath) {

  const filesToDownload = [];

  const ezppLauncherDir = path.join(osuPath, "EZPPLauncher");
  if (!fs.existsSync(ezppLauncherDir)) fs.mkdirSync(ezppLauncherDir);

  for (const uiFile of uiFiles) {
    if (fs.existsSync(path.join(ezppLauncherDir, uiFile.name))) {
      const latestPatchFileHash = await (await fetch(uiFile.url_hash)).text();
      const localPatchFileHash = crypto.createHash("md5").update(fs.readFileSync(path.join(ezppLauncherDir, uiFile.name))).digest("hex");
      if (latestPatchFileHash.trim().toLowerCase() != localPatchFileHash.trim().toLowerCase()) filesToDownload.push(uiFile);
    } else filesToDownload.push(uiFile);
  }

  return filesToDownload;
}

function downloadUIFiles(osuPath, uiFiles) {
  const eventEmitter = new EventEmitter();

  const startDownload = async () => {

    const ezpplauncherDir = path.join(osuPath, "EZPPLauncher");
    if (!fs.existsSync(ezpplauncherDir)) fs.mkdirSync(ezpplauncherDir);

    for (const uiFile of uiFiles) {
      const fileName = uiFile.name;
      const fileURL = uiFile.url_download;
      const axiosDownloadWithProgress = await axios.get(fileURL, {
        responseType: "stream",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          eventEmitter.emit("data", {
            fileName,
            loaded,
            total,
            progress: Math.floor((loaded / total) * 100)
          });
        },
      });

      await fs.promises.writeFile(path.join(osuPath, "EZPPLauncher", fileName), axiosDownloadWithProgress.data);
    }
  }

  return {
    eventEmitter,
    startDownload,
  }
}

async function replaceUIFile(osuPath, revert) {
  if (!revert) {
    const ezppUIFile = path.join(osuPath, "EZPPLauncher", "ezpp!ui.dll");
    const oldOsuUIFile = path.join(osuPath, "osu!ui.dll");
    await fs.promises.rename(oldOsuUIFile, path.join(osuPath, "osu!ui.dll.bak"));
    await fs.promises.rename(ezppUIFile, oldOsuUIFile);
  } else {
    const oldOsuUIFile = path.join(osuPath, "osu!ui.dll");
    const ezppUIFile = path.join(osuPath, "EZPPLauncher", "ezpp!ui.dll");
    await fs.promises.rename(oldOsuUIFile, ezppUIFile);
    await fs.promises.rename(path.join(osuPath, "osu!ui.dll.bak"), oldOsuUIFile);
  }

}

module.exports = { isValidOsuFolder, getUserConfig, getGlobalConfig, getUpdateFiles, getFilesThatNeedUpdate, downloadUpdateFiles, runOsuWithDevServer, getPatcherUpdates, downloadPatcherUpdates, downloadUIFiles, getUIFiles, replaceUIFile };
