const fs = require('fs');
const path = require('path');

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

async function checkForUpdate(path) {

}

module.exports = { isValidOsuFolder, getLatestConfig }