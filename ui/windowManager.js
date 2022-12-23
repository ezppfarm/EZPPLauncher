const path = require("path");
const appInfo = require('../appInfo');
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
            backgroundColor: "#24283B",
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

        window.webContents.setUserAgent(`${appInfo.appName} ${appInfo.appVersion}`);
        attachTitlebarToWindow(window);

        return window;
    },
}