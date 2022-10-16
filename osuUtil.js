const fs = require('fs');
const fu = require('./fileUtil');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios').default;
const { EventEmitter } = require('events');
const { DownloaderHelper } = require('node-downloader-helper');

const checkUpdateURL = "https://osu.ppy.sh/web/check-updates.php?action=check&stream=";
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
    const allFiles = await fs.promises.readdir(osuPath);
    const configFileInfo = {
        name: "",
        path: "",
        lastModified: 0,
        get: async (key) => {
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
    for (const file of allFiles) {
        if (file.startsWith('osu!.') && file.endsWith('.cfg') && file !== "osu!.cfg") {
            const fullFilePath = path.join(osuPath, file);
            const fileStats = await fs.promises.stat(fullFilePath);
            const lastModified = fileStats.mtimeMs;
            if (lastModified > configFileInfo.lastModified) {
                configFileInfo.name = file;
                configFileInfo.path = fullFilePath;
                configFileInfo.lastModified = lastModified;
            }
        }
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

        const fileOnDisk = path.join(osuPath, fileName);
        if (await fu.existsAsync(fileOnDisk)) {
            const binaryFileContents = await fs.promises.readFile(fileOnDisk);
            const existingFileMD5 = crypto.createHash("md5").update(binaryFileContents).digest("hex");
            if (existingFileMD5.toLowerCase() != fileHash.toLowerCase()) {
                filesToDownload.push({
                    fileName,
                    fileURL
                })
                console.log("hashes are not matching", `(${existingFileMD5} - ${fileHash})`);
            }
        } else {
            filesToDownload.push({
                fileName,
                fileURL
            });
            console.log("new file " + fileName);
        }
    }
    return filesToDownload;
}

async function downloadUpdateFiles(osuPath, filesToUpdate) {
    const eventEmitter = new EventEmitter();
    let completedIndex = 0;
    filesToUpdate.forEach(async (fileToUpdate) => {
        const filePath = path.join(osuPath, fileToUpdate.fileName);
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

        fileDownload.start().catch(err => console.error(err));
    });

    return eventEmitter;
}

module.exports = { isValidOsuFolder, getLatestConfig, getUpdateFiles, filesThatNeedUpdate, downloadUpdateFiles }