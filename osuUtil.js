const fs = require('fs');
const fu = require('./fileUtil');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios').default;
const executeUtil = require('./executeUtil');
const { EventEmitter } = require('events');
const { DownloaderHelper } = require('node-downloader-helper');

const checkUpdateURL = "https://osu.ppy.sh/web/check-updates.php?action=check&stream=";
const ignoredOsuEntities = [
    'osu!auth.dll'
]
const osuEntities = [
    'avcodec-51.dll',
    'avformat-52.dll',
    'avutil-49.dll',
    'bass.dll',
    'bass_fx.dll',
    'collection.db',
    'd3dcompiler_47.dll',
    'Data',
    'Downloads',
    'libEGL.dll',
    'libGLESv2.dll',
    'Logs',
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
    'Skins',
    'Songs'
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

async function filesThatNeedUpdate(osuPath, updateFiles) {
    const filesToDownload = [];
    for (const updatedFile of updateFiles) {
        const fileName = updatedFile.filename;
        const fileHash = updatedFile.file_hash;
        const fileURL = updatedFile.url_full;

        if (ignoredOsuEntities.includes(fileName)) continue;

        const fileOnDisk = path.join(osuPath, fileName);
        if (await fu.existsAsync(fileOnDisk)) {
            const binaryFileContents = await fs.promises.readFile(fileOnDisk);
            const existingFileMD5 = crypto.createHash("md5").update(binaryFileContents).digest("hex");
            if (existingFileMD5.toLowerCase() != fileHash.toLowerCase()) {
                filesToDownload.push({
                    fileName,
                    fileURL
                })
            }
        } else {
            filesToDownload.push({
                fileName,
                fileURL
            });
        }
    }
    return filesToDownload;
}

async function downloadUpdateFiles(osuPath, filesToUpdate) {
    const eventEmitter = new EventEmitter();
    let completedIndex = 0;
    filesToUpdate.forEach(async (fileToUpdate) => {
        const filePath = path.join(osuPath, fileToUpdate.fileName);
        console.log(filePath);
        if (await fu.existsAsync(filePath))
            await fs.promises.rm(filePath);

        const fileDownload = new DownloaderHelper(fileToUpdate.fileURL, osuPath, {
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
async function findOsuInstallation() {
    const regedit = require('qiao-regedit');

    const osuLocationFromDefaultIcon = "HKLM\\SOFTWARE\\Classes\\osu\\DefaultIcon";
    const osuStruct = await regedit.listValuesSync(osuLocationFromDefaultIcon);
    for (const line of osuStruct.split("\n")) {
        if (line.includes("REG_SZ")) {
            let value = (line.trim().split("    ")[2]);
            value = value.substring(1, value.length - 3);
            return value.trim();
        }
    }
    return undefined;
}

module.exports = {
    isValidOsuFolder, getLatestConfig, getUpdateFiles, filesThatNeedUpdate,
    downloadUpdateFiles, startOsuWithDevServer: startWithDevServer, setConfigValue,
    findOsuInstallation
}