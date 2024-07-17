const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");
const { default: axios } = require("axios");
const { runFile } = require("./executeUtil.js");

const checkUpdateURL =
  "https://osu.ppy.sh/web/check-updates.php?action=check&stream=";
const ignoredOsuEntities = [
  "osu!auth.dll",
];
const gamemodes = {
  0: "osu!",
  1: "taiko",
  2: "catch",
  3: "mania",
  4: "osu!(rx)",
  5: "taiko(rx)",
  6: "catch(rx)",
  8: "osu!(ap)",
};
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

const ezppLauncherUpdateList = "https://ez-pp.farm/ezpplauncher";

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
  const releaseData = await fetch(checkUpdateURL + releaseStream, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    },
  });
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
      const fileHashOnDisk = crypto.createHash("md5").update(
        fs.readFileSync(fileOnDisk),
      ).digest("hex");
      if (
        fileHashOnDisk.trim().toLowerCase() != fileHash.trim().toLowerCase()
      ) {
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
      try {
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
              progress: Math.floor((loaded / total) * 100),
            });
          },
        });

        if (fs.existsSync(path.join(osuPath, fileName))) {
          await fs.promises.rm(path.join(osuPath, fileName), {
            force: true,
          });
        }
        await fs.promises.writeFile(
          path.join(osuPath, fileName),
          axiosDownloadWithProgress.data,
        );
      } catch (err) {
        console.log(err);
        eventEmitter.emit("error", {
          fileName,
          error: err,
        });
      }
    }

    // wait until all files are downloaded
    return true;
  };

  return {
    eventEmitter,
    startDownload,
  };
}

function runOsuUpdater(osuPath, onExit) {
  const osuExecuteable = path.join(osuPath, "osu!.exe");
  runFile(osuPath, osuExecuteable, ["-repair"], onExit);
}

function runOsuWithDevServer(osuPath, serverDomain, onExit) {
  const osuExecuteable = path.join(osuPath, "osu!.exe");
  runFile(osuPath, osuExecuteable, ["-devserver", serverDomain], onExit);
}

async function getEZPPLauncherUpdateFiles(osuPath) {
  const filesToDownload = [];
  const updateFilesRequest = await fetch(ezppLauncherUpdateList, {
    method: "PATCH",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    },
  });
  const updateFiles = await updateFilesRequest.json();
  for (const updateFile of updateFiles) {
    const filePath = path.join(
      osuPath,
      ...updateFile.folder.split("/"),
      updateFile.name,
    );
    if (fs.existsSync(filePath)) {
      const fileHash = updateFile.md5.toLowerCase();
      const localFileHash = crypto.createHash("md5").update(
        fs.readFileSync(filePath),
      ).digest("hex").toLowerCase();
      if (fileHash !== localFileHash) {
        filesToDownload.push(updateFile);
      }
    } else {
      filesToDownload.push(updateFile);
    }
  }
  return [filesToDownload, updateFiles];
}

async function downloadEZPPLauncherUpdateFiles(osuPath, updateFiles, allFiles) {
  const eventEmitter = new EventEmitter();

  const startDownload = async () => {
    //NOTE: delete files that are not in the updateFiles array
    const foldersToPrune = allFiles.map((file) =>
      path.dirname(path.join(osuPath, ...file.folder.split("/"), file.name))
    ).filter((folder, index, self) => self.indexOf(folder) === index);
    for (const pruneFolder of foldersToPrune) {
      //NOTE: check if the folder is not the osu root folder.
      if (path.basename(pruneFolder) == "osu!") {
        continue;
      }
      if (fs.existsSync(pruneFolder)) {
        for (const files of await fs.promises.readdir(pruneFolder)) {
          const filePath = path.join(pruneFolder, files);
          const validFolder = allFiles.find((file) =>
            path.dirname(filePath).endsWith(file.folder)
          );
          if (!validFolder) {
            if (
              allFiles.find((file) => file.name == path.basename(filePath)) ===
                undefined
            ) {
              eventEmitter.emit("data", {
                fileName: path.basename(filePath),
              });
              try {
                await fs.promises.rm(filePath, {
                  recursive: true,
                  force: true,
                });
              } catch {}
            }
          }
        }
      }
    }

    for (const updateFile of updateFiles) {
      try {
        const filePath = path.join(
          osuPath,
          ...updateFile.folder.split("/"),
          updateFile.name,
        );
        const folder = path.dirname(filePath);
        if (!fs.existsSync(folder)) {
          await fs.promises.mkdir(folder, { recursive: true });
        }
        const axiosDownloadWithProgress = await axios.get(updateFile.url, {
          responseType: "stream",
          onDownloadProgress: (progressEvent) => {
            const fileSize = updateFile.size;
            const { loaded } = progressEvent;
            eventEmitter.emit("data", {
              fileName: path.basename(filePath),
              loaded,
              total: fileSize,
              progress: Math.floor((loaded / fileSize) * 100),
            });
          },
        });

        if (fs.existsSync(filePath)) {
          await fs.promises.rm(filePath, {
            force: true,
          });
        }
        await fs.promises.writeFile(
          filePath,
          axiosDownloadWithProgress.data,
        );
      } catch (err) {
        console.log(err);
        eventEmitter.emit("error", {
          fileName: path.basename(filePath),
          error: err,
        });
      }
    }
  };

  return {
    eventEmitter,
    startDownload,
  };
}

async function replaceUIFiles(osuPath, revert) {
  if (!revert) {
    const ezppUIFile = path.join(osuPath, "EZPPLauncher", "ezpp!ui.dll");
    const oldOsuUIFile = path.join(osuPath, "osu!ui.dll");
    const ezppGameplayFile = path.join(
      osuPath,
      "EZPPLauncher",
      "ezpp!gameplay.dll",
    );
    const oldOsuGameplayFile = path.join(osuPath, "osu!gameplay.dll");

    await fs.promises.rename(
      oldOsuUIFile,
      path.join(osuPath, "osu!ui.dll.bak"),
    );
    await fs.promises.rename(ezppUIFile, oldOsuUIFile);

    await fs.promises.rename(
      oldOsuGameplayFile,
      path.join(osuPath, "osu!gameplay.dll.bak"),
    );
    await fs.promises.rename(ezppGameplayFile, oldOsuGameplayFile);
  } else {
    const oldOsuUIFile = path.join(osuPath, "osu!ui.dll");
    const ezppUIFile = path.join(osuPath, "EZPPLauncher", "ezpp!ui.dll");
    const oldOsuGameplayFile = path.join(osuPath, "osu!gameplay.dll");
    const ezppGameplayFile = path.join(
      osuPath,
      "EZPPLauncher",
      "ezpp!gameplay.dll",
    );

    await fs.promises.rename(oldOsuUIFile, ezppUIFile);
    await fs.promises.rename(
      path.join(osuPath, "osu!ui.dll.bak"),
      oldOsuUIFile,
    );

    await fs.promises.rename(oldOsuGameplayFile, ezppGameplayFile);
    await fs.promises.rename(
      path.join(osuPath, "osu!gameplay.dll.bak"),
      oldOsuGameplayFile,
    );
  }
}

async function findOsuInstallation() {
  const regedit = require("regedit-rs");

  const osuLocationFromDefaultIcon =
    "HKLM\\SOFTWARE\\Classes\\osu\\DefaultIcon";
  const osuKey = regedit.listSync(osuLocationFromDefaultIcon);
  if (osuKey[osuLocationFromDefaultIcon].exists) {
    const key = osuKey[osuLocationFromDefaultIcon].values[""];
    let value = key.value;
    value = value.substring(1, value.length - 3);
    return path.dirname(value.trim());
  }
  return undefined;
}

async function updateOsuConfigHashes(osuPath) {
  const osuCfg = path.join(osuPath, "osu!.cfg");
  const fileStream = await fs.promises.readFile(osuCfg, "utf-8");
  const lines = fileStream.split(/\r?\n/);
  const newLines = [];
  for (const line of lines) {
    if (line.includes(" = ")) {
      const argsPair = line.split(" = ", 2);
      const key = argsPair[0];
      const value = argsPair[1];

      if (key.startsWith("h_")) {
        const fileName = key.substring(2, key.length);
        const filePath = path.join(osuPath, fileName);
        if (!fs.existsSync(filePath)) continue;
        const binaryFileContents = await fs.promises.readFile(filePath);
        const existingFileMD5 = crypto.createHash("md5").update(
          binaryFileContents,
        ).digest("hex");
        if (value == existingFileMD5) newLines.push(line);
        else newLines.push(`${key} = ${existingFileMD5}`);
      } else if (line.startsWith("u_UpdaterAutoStart")) {
        newLines.push(`${key} = 0`);
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  await fs.promises.writeFile(osuCfg, newLines.join("\n"), "utf-8");
}

module.exports = {
  isValidOsuFolder,
  getUserConfig,
  getGlobalConfig,
  getUpdateFiles,
  getFilesThatNeedUpdate,
  downloadUpdateFiles,
  runOsuWithDevServer,
  replaceUIFiles,
  findOsuInstallation,
  updateOsuConfigHashes,
  runOsuUpdater,
  getEZPPLauncherUpdateFiles,
  downloadEZPPLauncherUpdateFiles,
  gamemodes,
};
