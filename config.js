const path = require('path');
const fs = require('fs');

const configFolder = path.join(process.platform == "win32" ? process.env['LOCALAPPDATA'] : process.env['HOME'], 'EZPPLauncher');
if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder);

const configLocation = path.join(configFolder, `ezpplauncher.${path.basename(process.env['USERNAME'])}.cfg`);
if (!fs.existsSync(configLocation)) fs.writeFileSync(configLocation, "");


async function get(key, defaultValue) {
    const fileStream = await fs.promises.readFile(configLocation, "utf-8");
    const lines = fileStream.split(/\r?\n/)
    for (const line of lines) {
        if (line.includes('=')) {
            const argsPair = line.split('=', 2);
            const keyname = argsPair[0]
            const value = argsPair[1];
            if (keyname == key) {
                return value;
            }
        }
    }
    return defaultValue;
}

async function set(key, value) {
    const configValues = new Map();
    const fileStream = await fs.promises.readFile(configLocation, "utf-8");
    const lines = fileStream.split(/\r?\n/)
    for (const line of lines) {
        if (line.includes('=')) {
            const argsPair = line.split('=', 2);
            const keyname = argsPair[0]
            const value = argsPair[1];
            configValues.set(keyname, value);
        }
    }

    configValues.set(key, value);

    const arr = [];
    for (var [storkey, storvalue] of configValues.entries())
        arr.push(`${storkey}=${storvalue}`);

    await fs.promises.writeFile(configLocation, arr.join('\n'));
}

async function remove(key) {
    const configValues = new Map();
    const fileStream = await fs.promises.readFile(configLocation, "utf-8");
    const lines = fileStream.split(/\r?\n/)
    for (const line of lines) {
        if (line.includes('=')) {
            const argsPair = line.split('=', 2);
            const keyname = argsPair[0]
            const value = argsPair[1];
            configValues.set(keyname, value);
        }
    }

    const arr = [];
    for (var [storkey, storvalue] of configValues.entries()) {
        if (storkey != key)
            arr.push(`${storkey}=${storvalue}`);
    }

    await fs.promises.writeFile(configLocation, arr.join('\n'));
}

module.exports = { get, set, remove }