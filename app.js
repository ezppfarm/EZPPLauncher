const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { setupTitlebar, attachTitlebarToWindow } = require('custom-electron-titlebar/main');
const windowManager = require('./ui/windowManager');
const osuUtil = require('./osuUtil');
const config = require('./config');
const fs = require('fs');

let tempOsuPath;

const run = () => {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit();
        return;
    }

    setupTitlebar();

    let mainWindow;
    app.whenReady().then(() => {

        mainWindow = createWindow();
        mainWindow.on('show', async () => {
            const osuPath = await config.get("osuPath", "");
            if(fs.existsSync(osuPath)){
                tempOsuPath = osuPath;
                const osuConfig = await osuUtil.getLatestConfig(tempOsuPath);
                console.log(osuConfig);
                const lastVersion = await osuConfig.get("LastVersion");
                console.log(lastVersion);
                //Do update check
            }
        })
        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
        })
        app.on('window-all-closed', () => {
            app.quit()
        })
        ipcMain.handle('set-osu-dir', async (event) => {
            const yes = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })
            if (yes.filePaths.length <= 0)
                return undefined;
            const folderPath = yes.filePaths[0];
            const validOsuDir = osuUtil.isValidOsuFolder(folderPath);

            if (validOsuDir) await config.set("osuPath", folderPath);

            return validOsuDir;
        })
    })
}

function createWindow() {
    // Create the browser window.
    const win = windowManager.createWindow(480, 350);

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