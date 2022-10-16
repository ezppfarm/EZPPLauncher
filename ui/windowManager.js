const path = require("path");
const { BrowserWindow } = require('electron');
const { attachTitlebarToWindow } = require('custom-electron-titlebar/main');

module.exports = {
    createWindow: function (windowWidth, windowHeight) {
        const window = new BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            minHeight: windowHeight / 1.25,
            minWidth: windowWidth / 1.25,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: "#121212",
            resizable: false,
            maximizable: false,
            minimizable: true,
            alwaysOnTop: false,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                show: false,
                zoomFactor: 0.9,
                preload: path.join(__dirname, '../preload/preload.js')
            },
            icon: './assets/logo.png'
        })
        window.hide();

        window.webContents.once("did-finish-load", function (event, input) {
            window.show();
        });

        window.webContents.setUserAgent("EZPPLauncher");
        attachTitlebarToWindow(window);
        window.webContents.openDevTools();

        return window;
    },
}