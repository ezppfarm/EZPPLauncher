const fs = require('fs');
const fu = require('./fileUtil');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios').default;
const executeUtil = require('./executeUtil');
const { EventEmitter } = require('events');
const { DownloaderHelper } = require('node-downloader-helper');

const checkUpdateURL = "https://osu.ppy.sh/web/check-updates.php?action=check&stream=";
const customUIDLLPath = "https://ez-pp.farm/assets/ezpp!ui.dll";
const customUIDLLHash = "https://ez-pp.farm/assets/ezpp!ui.md5";
const customUIDLLName = "ezpp!ui.dll";

const patcherHook = "https://ez-pp.farm/assets/patch.hook.dll";
const patcherHookHash = "https://ez-pp.farm/assets/patch.hook.md5";
const patcherHookName = "patch.hook.dll";
const patcherExe = "https://ez-pp.farm/assets/patcher.exe";
const patcherExeHash = "https://ez-pp.farm/assets/patcher.md5"
const patcherExeName = "patcher.exe";

const ignoredOsuEntities = [
  'osu!auth.dll',
]
const osuEntities = [
  'avcodec-51.dll',
  'avformat-52.dll',
  'avutil-49.dll',
  'bass.dll',
  'bass_fx.dll',
  'collection.db',
  'd3dcompiler_47.dll',
  'libEGL.dll',
  'libGLESv2.dll',
  'Microsoft.Ink.dll',
  'OpenTK.dll',
  'osu!.cfg',
  'osu!.db',
  'osu!.exe',
  'osu!auth.dll',
  'osu!gameplay.dll',
  'osu!seasonal.dll',
  'osu!ui.dll',
  'presence.db',
  'pthreadGC2.dll',
  'scores.db',
]

async function isValidOsuFolder(path) {
  const allFiles = await fs.promises.readdir(path);
  let matches = 0;
  for (const file of allFiles) {
    if (osuEntities.includes(file)) matches = matches + 1;
  }
  return Math.round((matches / osuEntities.length) * 100) >= 60;
}

async function getLatestConfig(osuPath) {
  const configFileInfo = {
    name: "",
    path: "",
    get: async (key) => {
      if (!configFileInfo.path)
        return "";
      const fileStream = await fs.promises.readFile(configFileInfo.path, "utf-8");
      const lines = fileStream.split(/\r?\n/)
      for (const line of lines) {
        if (line.includes(' = ')) {
          const argsPair = line.split(' = ', 2);
          const keyname = argsPair[0]
          const value = argsPair[1];
          if (keyname == key) {
            return value;
          }
        }
      }
    }
  }
  const userOsuConfig = path.join(osuPath, `osu!.${process.env['USERNAME']}.cfg`)
  if (fs.existsSync(userOsuConfig)) {
    configFileInfo.name = `osu!.${process.env['USERNAME']}.cfg`;
    configFileInfo.path = userOsuConfig;
  }
  return configFileInfo;
}

async function getUpdateFiles(releaseStream) {
  const releaseData = await axios.get(checkUpdateURL + releaseStream, {});
  return releaseData.data;
}

async function getEZPPUIMD5() {
  const releaseData = await axios.get(customUIDLLHash, {});
  return releaseData.data;
}

async function getMD5Hash(url) {
  const releaseData = await axios.get(url, {});
  return releaseData.data;
}

async function filesThatNeedUpdate(osuPath, updateFiles) {
  const filesToDownload = [];
  for (const updatedFile of updateFiles) {
    let fileName = updatedFile.filename;
    let fileHash = updatedFile.file_hash;
    let fileURL = updatedFile.url_full;

    if ("url_patch" in updatedFile && updatedFile.url_patch != undefined) {
      const stripped = updatedFile.url_patch.split("_");
      fileHash = stripped[stripped.length - 1];
      const lastIndex = fileURL.lastIndexOf("/");
      const baseUrl = fileURL.slice(0, lastIndex);
      fileURL = baseUrl + "/f_" + fileHash;
    }

    if (ignoredOsuEntities.includes(fileName)) continue;

    const fileOnDisk = path.join(osuPath, fileName);
    if (await fu.existsAsync(fileOnDisk)) {
      const binaryFileContents = await fs.promises.readFile(fileOnDisk);
      const existingFileMD5 = crypto.createHash("md5").update(binaryFileContents).digest("hex");
      if (existingFileMD5.toLowerCase() != fileHash.toLowerCase()) {
        filesToDownload.push({
          fileName,
          fileURL
        });
      }
    } else {
      filesToDownload.push({
        fileName,
        fileURL
      });
    }
  }

  const ezppUI = path.join(osuPath, "EZPPLauncher", customUIDLLName);
  const hook = path.join(osuPath, "EZPPLauncher", patcherHookName);
  const patcher = path.join(osuPath, "EZPPLauncher", patcherExeName);

  if (await fu.existsAsync(hook)) {
    const latestHookMd5Hash = (await getMD5Hash(patcherHookHash)).toLowerCase().trim();
    const binaryHookContents = await fs.promises.readFile(hook);
    const existingHookMD5 = crypto.createHash("md5").update(binaryHookContents).digest("hex").toLowerCase().trim();
    if (existingHookMD5 != latestHookMd5Hash) {
      filesToDownload.push({
        folder: "EZPPLauncher",
        fileName: patcherHookName,
        fileURL: patcherHook
      });
      console.log("patcher has wrong hashsum (" + existingHookMD5 + " / " + latestHookMd5Hash + ")");
    }
  } else {
    filesToDownload.push({
      folder: "EZPPLauncher",
      fileName: patcherHookName,
      fileURL: patcherHook
    });
    console.log("patcher does not exist");
  }

  if (await fu.existsAsync(patcher)) {
    const latestPatchMd5Hash = (await getMD5Hash(patcherExeHash)).toLowerCase().trim();
    const binaryPatchContents = await fs.promises.readFile(patcher);
    const existingPatchMD5 = crypto.createHash("md5").update(binaryPatchContents).digest("hex").toLowerCase().trim();
    if (existingPatchMD5 != latestPatchMd5Hash) {
      filesToDownload.push({
        folder: "EZPPLauncher",
        fileName: patcherExeName,
        fileURL: patcherExe
      });
      console.log("patcher has wrong hashsum (" + existingPatchMD5 + " / " + latestPatchMd5Hash + ")")
    }
  } else {
    filesToDownload.push({
      folder: "EZPPLauncher",
      fileName: patcherExeName,
      fileURL: patcherExe
    });
    console.log("patcher does not exist");
  }

  if (await fu.existsAsync(ezppUI)) {
    const latestUIMd5Hash = (await getMD5Hash(customUIDLLHash)).toLowerCase().trim();
    const binaryUIContents = await fs.promises.readFile(ezppUI);
    const existingUIMD5 = crypto.createHash("md5").update(binaryUIContents).digest("hex").toLowerCase().trim();
    if (existingUIMD5 != latestUIMd5Hash) {
      filesToDownload.push({
        folder: "EZPPLauncher",
        fileName: "ezpp!ui.dll",
        fileURL: customUIDLLPath
      })
    }
  } else {
    filesToDownload.push({
      folder: "EZPPLauncher",
      fileName: "ezpp!ui.dll",
      fileURL: customUIDLLPath
    })
  }

  console.log(JSON.stringify(filesToDownload, null, 2))

  return filesToDownload;
}

async function downloadUpdateFiles(osuPath, filesToUpdate) {
  const eventEmitter = new EventEmitter();
  let completedIndex = 0;
  filesToUpdate.forEach(async (fileToUpdate) => {

    let tempPath = osuPath;

    if ("folder" in fileToUpdate) {
      tempPath = path.join(tempPath, fileToUpdate.folder);
      if (!(await fu.existsAsync(tempPath))) await fs.promises.mkdir(tempPath);
    }

    const filePath = path.join(tempPath, fileToUpdate.fileName);
    if (await fu.existsAsync(filePath))
      await fs.promises.rm(filePath);

    const fileDownload = new DownloaderHelper(fileToUpdate.fileURL, tempPath, {
      fileName: fileToUpdate.fileName,
      override: true,
    });
    fileDownload.on('end', () => {
      completedIndex = completedIndex + 1;
      if (completedIndex >= filesToUpdate.length)
        eventEmitter.emit('completed');
    });
    fileDownload.on('error', (err) => {
      console.log(err);
      eventEmitter.emit('error');
    });

    fileDownload.start().catch(err => console.error(err));
  });

  return eventEmitter;
}

async function startWithDevServer(osuPath, serverDomain, onExit) {
  const osuExe = path.join(osuPath, "osu!.exe");
  if (!await fu.existsAsync(osuExe)) return false;
  switch (process.platform) {
    case "linux":
      executeUtil.runFile(osuPath, 'osu-stable', ["-devserver", serverDomain], onExit);
      return true;
    case "win32":
      executeUtil.runFile(osuPath, osuExe, ["-devserver", serverDomain], onExit);
      return true;
  }
  return false;
}

async function setConfigValue(configPath, key, value) {
  const configLines = new Array();
  const fileStream = await fs.promises.readFile(configPath, "utf-8");
  const lines = fileStream.split(/\r?\n/)
  for (const line of lines) {
    if (line.includes(' = ')) {
      const argsPair = line.split(' = ', 2);
      const keyname = argsPair[0].trim();
      if (key == keyname) {
        configLines.push(`${keyname} = ${value}`);
      } else {
        configLines.push(line);
      }
    } else {
      configLines.push(line);
    }
  }
  await fs.promises.writeFile(configPath, configLines.join("\n"), 'utf-8');
}

async function updateOsuCfg(cfgPath) {
  const osuFolder = path.dirname(cfgPath);
  const fileStream = await fs.promises.readFile(cfgPath, "utf-8");
  const lines = fileStream.split(/\r?\n/);
  const newLines = [];
  for (const line of lines) {
    if (line.includes(' = ')) {
      const argsPair = line.split(' = ', 2);
      const keyname = argsPair[0]
      const value = argsPair[1];

      if (keyname.startsWith("h_")) {
        const filename = keyname.substring(2, keyname.length);
        const filepath = path.join(osuFolder, filename);
        if (!fs.existsSync(filepath)) continue;
        const binaryFileContents = await fs.promises.readFile(filepath);
        const existingFileMD5 = crypto.createHash("md5").update(binaryFileContents).digest("hex");
        if (value == existingFileMD5) newLines.push(line)
        else newLines.push(`${keyname} = ${existingFileMD5}`);
      } else {
        newLines.push(line);
      }
    }
  }

  const ezppUI = path.join(osuFolder, customUIDLLName);
  if (fs.existsSync(ezppUI)) {
    const binaryFileContents = await fs.promises.readFile(ezppUI);
    const existingFileMD5 = crypto.createHash("md5").update(binaryFileContents).digest("hex");
    newLines.push(`h_${customUIDLLName} = ${existingFileMD5}`);
  }
  await fs.promises.writeFile(cfgPath, newLines.join("\n"), 'utf-8');
}

async function findOsuInstallation() {
  const regedit = require('qiao-regedit');

  const osuLocationFromDefaultIcon = "HKLM\\SOFTWARE\\Classes\\osu\\DefaultIcon";
  const osuStruct = await regedit.listValuesSync(osuLocationFromDefaultIcon);
  for (const line of osuStruct.split("\n")) {
    if (line.includes("REG_SZ")) {
      let value = (line.trim().split("    ")[2]);
      value = value.substring(1, value.length - 3);
      return path.dirname(value.trim());
    }
  }
  return undefined;
}

async function replaceUI(folder, isStart) {
  const ezppUIFile = path.join(folder, "EZPPLauncher", customUIDLLName);
  const osuUIFile = path.join(folder, "osu!ui.dll");
  const osuUIFileBackup = path.join(folder, "osu!ui.dll.bak");
  if (isStart) {
    if (fs.existsSync(osuUIFileBackup)) await fs.promises.unlink(osuUIFileBackup);
    await fs.promises.rename(osuUIFile, osuUIFileBackup);
    await new Promise((res) => setTimeout(res, 1000));
    await fs.promises.copyFile(ezppUIFile, osuUIFile);
  } else {
    if (!fs.existsSync(osuUIFileBackup)) return;
    await fs.promises.unlink(osuUIFile);
    await new Promise((res) => setTimeout(res, 1000));
    await fs.promises.rename(osuUIFileBackup, osuUIFile);
  }

}

module.exports = {
  isValidOsuFolder, getLatestConfig, getUpdateFiles, filesThatNeedUpdate,
  downloadUpdateFiles, startOsuWithDevServer: startWithDevServer, setConfigValue,
  findOsuInstallation, replaceUI, updateOsuCfg, getEZPPUIMD5
}