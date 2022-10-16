const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { setupTitlebar, attachTitlebarToWindow } = require('custom-electron-titlebar/main');
const windowManager = require('./ui/windowManager');

const run = () => {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit();
        return;
    }
    setupTitlebar();

    let mainWindow;
    app.whenReady().then(() => {

        mainWindow = createWindow()
        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
        })
        app.on('window-all-closed', () => {
            app.quit()
        })
        ipcMain.handle('open-folder-dialog', async (event) => {
            const yes = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })
            return yes.filePaths;
        })
    })
}

function createWindow() {
    // Create the browser window.
    const win = windowManager.createWindow(480, 420);

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