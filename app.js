const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { setupTitlebar, attachTitlebarToWindow } = require('custom-electron-titlebar/main');
const windowManager = require('./ui/windowManager');
const osuUtil = require('./osuUtil');
const ezppUtil = require('./ezppUtil');
const config = require('./config');
const fs = require('fs');
const rpc = require('./discordPresence');
const windowName = require('get-window-by-name');

let tempOsuPath;
let osuWindowInfo;
let isIngame;
const platform = process.platform;

const run = () => {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit();
        return;
    }

    setInterval(async () => {
        if (platform == "win32") {
            osuWindowInfo = windowName.getWindowText("osu!.exe");
            const firstInstance = osuWindowInfo[0];
            if (firstInstance) {
                if (firstInstance.processTitle && firstInstance.processTitle.length > 0) {
                    const windowTitle = firstInstance.processTitle;
                    let rpcOsuVersion = "";
                    let currentMap = undefined;
                    if (!windowTitle.includes("-")) {
                        rpcOsuVersion = windowTitle;
                        rpc.updateState("Idle...");
                    } else {
                        var string = windowTitle;
                        var components = string.split(' - ');
                        const splitArray = [components.shift(), components.join(' - ')];
                        rpcOsuVersion = splitArray[0];
                        currentMap = splitArray[1];
                        rpc.updateState("Playing...");
                    }

                    rpc.updateStatus(currentMap, rpcOsuVersion);
                } else {
                    rpc.updateState("Idle in Launcher...");
                    rpc.updateStatus(undefined, undefined);
                }
            } else {
                rpc.updateState("Idle in Launcher...");
                rpc.updateStatus(undefined, undefined);
            }
        } else {
            if(isIngame){
                rpc.updateState("Playing...");
                rpc.updateStatus("Clicking circles!", "runningunderwine");
            }else{
                rpc.updateState("Idle in Launcher...");
                rpc.updateStatus(undefined, undefined);
            }
        }
    }, 2000);

    setupTitlebar();

    rpc.connect();


    let mainWindow;
    app.whenReady().then(() => {

        mainWindow = createWindow();
        mainWindow.on('show', async () => {
            await updateConfigVars(mainWindow);
            await tryLogin(mainWindow);
            await doUpdateCheck(mainWindow);
        })
        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
        })
        app.on('window-all-closed', () => {
            app.quit()
        })
        ipcMain.handle('launch', async () => {
            const osuConfig = await osuUtil.getLatestConfig(tempOsuPath);
            const username = await config.get('username');
            const password = await config.get('password');
            if (password && username) {
                await osuUtil.setConfigValue(osuConfig.path, "SaveUsername", "1");
                await osuUtil.setConfigValue(osuConfig.path, "SavePassword", "1");
                await osuUtil.setConfigValue(osuConfig.path, "Username", username);
                await osuUtil.setConfigValue(osuConfig.path, "Password", password);
                await osuUtil.setConfigValue(osuConfig.path, "CredentialEndpoint", "ez-pp.farm");
            } else {
                await osuUtil.setConfigValue(osuConfig.path, "Username", "");
                await osuUtil.setConfigValue(osuConfig.path, "Password", "");
            }
            rpc.updateState("Launching osu!...");
            isIngame = true;
            const result = await osuUtil.startOsuWithDevServer(tempOsuPath, "ez-pp.farm", async () => {
                isIngame = false;
                await doUpdateCheck(mainWindow);
            });
            return result;
        })
        ipcMain.on('do-update-check', async () => {
            await doUpdateCheck(mainWindow);
        })
        ipcMain.on('do-update', async () => {
            const osuPath = await config.get("osuPath", "");
            const isValid = await osuUtil.isValidOsuFolder(osuPath);
            if (osuPath.trim == "" || !isValid) {
                mainWindow.webContents.send('status_update', {
                    type: "error",
                    message: "Invalid osu! folder"
                });
                return;
            }
            if (fs.existsSync(osuPath)) {
                tempOsuPath = osuPath;
                const osuConfig = await osuUtil.getLatestConfig(tempOsuPath);
                const lastVersion = await osuConfig.get("LastVersion");
                let releaseStream = "stable40";
                if (lastVersion.endsWith("cuttingedge"))
                    releaseStream = "cuttingedge"
                else if (lastVersion.endsWith("beta"))
                    releaseStream = "beta";

                const releaseFiles = await osuUtil.getUpdateFiles(releaseStream);
                const filesToDownload = await osuUtil.filesThatNeedUpdate(tempOsuPath, releaseFiles);
                const downloadTask = await osuUtil.downloadUpdateFiles(osuPath, filesToDownload);
                downloadTask.on('completed', () => {
                    mainWindow.webContents.send('status_update', {
                        type: "update-complete"
                    })
                });
                downloadTask.on('error', () => {
                    mainWindow.webContents.send('status_update', {
                        type: "error",
                        message: "An error occured while updating."
                    });
                });

            } else
                mainWindow.webContents.send('status_update', {
                    type: "error",
                    message: "Invalid osu! folder"
                });
        })
        ipcMain.handle('set-osu-dir', async (event) => {
            const yes = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })
            if (yes.filePaths.length <= 0)
                return undefined;
            const folderPath = yes.filePaths[0];
            const validOsuDir = await osuUtil.isValidOsuFolder(folderPath);

            if (validOsuDir) await config.set("osuPath", folderPath);

            return { validOsuDir, folderPath };
        })
        ipcMain.handle('perform-login', async (event, data) => {
            const { username, password } = data;
            const loginData = await ezppUtil.performLogin(username, password);
            if (loginData && loginData.code === 200) {
                await config.set("username", username);
                await config.set("password", password);
            }
            return loginData;
        })
        ipcMain.on('perform-logout', async (event) => {
            await config.remove("username");
            await config.remove("password");
        })
    })
}

async function updateConfigVars(window) {
    const osuPath = await config.get("osuPath", "");
    window.webContents.send('config_update', {
        osuPath: osuPath
    })
}

async function tryLogin(window) {
    const username = await config.get("username", "");
    const password = await config.get("password", "");
    if ((username && username.length > 0) && (password && password.length > 0)) {
        const passwordPlain = password;
        const loginResponse = await ezppUtil.performLogin(username, passwordPlain);
        if (loginResponse && loginResponse.code === 200) {
            window.webContents.send('account_update', {
                type: "loggedin",
                user: loginResponse.user
            })
        } else {
            window.webContents.send('account_update', {
                type: "login-failed"
            })
        }
    } else {
        window.webContents.send('account_update', {
            type: "not-loggedin"
        })
    }
}

async function doUpdateCheck(window) {
    const osuPath = await config.get("osuPath");
    if (!osuPath || osuPath.trim == "") {
        window.webContents.send('status_update', {
            type: "missing-folder"
        })
        return;
    }
    const isValid = await osuUtil.isValidOsuFolder(osuPath);
    if (!isValid) {
        window.webContents.send('status_update', {
            type: "missing-folder"
        })
        return;
    }
    if (fs.existsSync(osuPath)) {
        tempOsuPath = osuPath;
        const osuConfig = await osuUtil.getLatestConfig(tempOsuPath);
        const lastVersion = await osuConfig.get("LastVersion");
        let releaseStream = "stable40";
        if (lastVersion.endsWith("cuttingedge"))
            releaseStream = "cuttingedge"
        else if (lastVersion.endsWith("beta"))
            releaseStream = "beta";

        const releaseFiles = await osuUtil.getUpdateFiles(releaseStream);
        const filesToDownload = await osuUtil.filesThatNeedUpdate(tempOsuPath, releaseFiles);
        window.webContents.send('status_update', {
            type: filesToDownload.length > 0 ? "update-available" : "up-to-date"
        })
    } else
        window.webContents.send('status_update', {
            type: "missing-folder"
        })
}

function createWindow() {
    // Create the browser window.
    const win = windowManager.createWindow(700, 420);

    win.loadFile('./html/index.html');

    attachTitlebarToWindow(win);
    win.webContents.setWindowOpenHandler(() => "deny");
    win.webContents.on('did-finish-load', function () {
        if (win.webContents.getZoomFactor() != 0.9)
            win.webContents.setZoomFactor(0.9)
    });

    return win;
}

run();