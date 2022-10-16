const { ipcRenderer } = require('electron');
const { Titlebar, Color } = require('custom-electron-titlebar');
let titlebar;

window.addEventListener('DOMContentLoaded', () => {
    titlebar = new Titlebar({
        backgroundColor: Color.fromHex("#303030"),
        itemBackgroundColor: Color.fromHex("#121212"),
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
            //TODO: Alert User, folder set.
        } else {
            //TODO: Alert User, invalid osu folder selected
        }
    });

    ipcRenderer.on('status_update', (event, status) => {
        switch (status.type) {
            case "up-to-date":
                $("#launch-btn").attr('disabled', false);
                $('#launch-btn').html('Launch');
                break;
            case "update-available":
                $("#launch-btn").attr('disabled', false);
                $('#launch-btn').html('Update');
                break;
        }
    })
})