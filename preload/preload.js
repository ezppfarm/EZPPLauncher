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

    let currentState;

    $("#launch-btn").on('click', async () => {
        switch (currentState) {
            case "up-to-date":
                $("#launch-btn").attr('disabled', true);
                $('#launch-btn').html('Launching...');
                const result = await ipcRenderer.invoke("launch");
                if (!result) {
                    Swal.fire({
                        title: 'Uh oh!',
                        text: "Something went wrong while launching!",
                        icon: 'error',
                        confirmButtonText: 'Okay'
                    });
                    $("#launch-btn").attr('disabled', false);
                    $('#launch-btn').html('Launch');
                } else {
                    $("#launch-btn").attr('disabled', true);
                    $('#launch-btn').html('Running...');
                }
                break;
            case "update-available":
                $("#launch-btn").attr('disabled', true);
                $('#launch-btn').html('Updating...');
                ipcRenderer.send("do-update");
                break;
        }
    });

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
            ipcRenderer.send("do-update-check");
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
        currentState = status.type;
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
                $('#launch-btn').html('Please set your osu! folder');
                break;
            case "error":
                Swal.fire({
                    title: 'Uh oh!',
                    text: status.message,
                    icon: 'error',
                    confirmButtonText: 'Okay'
                });
                ipcRenderer.send("do-update-check");
                break;
            case "update-complete":
                Swal.fire({
                    title: 'Yaaay!',
                    text: "Your osu! client has been successfully updated!",
                    icon: 'success',
                    confirmButtonText: 'Thanks :3'
                });
                ipcRenderer.send("do-update-check");
                break;
        }
    })

    // workaround for the dark theme
    $('head').append($('<link href="../assets/sweetalert2.dark.css" rel="stylesheet" />'));
})