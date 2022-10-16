const { ipcRenderer } = require('electron');
const { Titlebar, Color } = require('custom-electron-titlebar');
let titlebar;

window.addEventListener('DOMContentLoaded', () => {
    titlebar = new Titlebar({
        backgroundColor: Color.fromHex("#303030"),
        itemBackgroundColor: Color.fromHex("#121212"),
        icon: "https://ez-pp.farm/static/logos/circle.png",
        menu: null,
        maximizable: false
    });

    titlebar.updateTitle("EZPPLauncher");

    const $ = require('jquery');

    $("#folder-btn").on('click', async () => {
        const success = await ipcRenderer.invoke('set-osu-dir');
        if (success == undefined)
            return;
        if (success) {

        } else {
            //TODO: Alert User, invalid osu folder selected
        }
    });
})