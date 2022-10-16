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
    const Swal = require('sweetalert2');

    $("#folder-btn").on('click', async () => {
        const success = await ipcRenderer.invoke('set-osu-dir');
        if (success == undefined)
            return;
        if (success) {
            Swal.fire({
                title: 'Success!',
                text: 'osu! folder set.',
                icon: 'success',
                confirmButtonText: 'Cool'
            })
        } else {
            Swal.fire({
                title: 'Uh oh!',
                text: 'The selected folder is not a osu! directory.',
                icon: 'error',
                confirmButtonText: 'Oops.. my bad!'
            })
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
            case "missing-folder":
                $('#launch-btn').html('Please set your osu folder!');
        }
    })

    // workaround for the dark theme
    $('head').append($('<link href="../assets/sweetalert2.dark.css" rel="stylesheet" />'));
})