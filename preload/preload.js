const { ipcRenderer } = require('electron');
const { Titlebar, Color } = require('custom-electron-titlebar');
const appInfo = require('../appInfo');
let titlebar;
let currentPage = "loading";
let loggedIn = false;

window.addEventListener('DOMContentLoaded', () => {
    titlebar = new Titlebar({
        backgroundColor: Color.fromHex("#303030"),
        itemBackgroundColor: Color.fromHex("#121212"),
        menu: null,
        maximizable: false
    });

    titlebar.updateTitle(`${appInfo.appName} ${appInfo.appVersion}`);

    const $ = require('jquery');
    const axios = require('axios').default;
    const Swal = require('sweetalert2');

    $('#account-action').on('click', () => {
        if (!loggedIn) {
            changePage('login');
        } else {
            $('#welcome-text').text(`Nice to see you!`);
            $('#account-action').text('Click to login');
            $('.user-image').css('background-image', `url(https://a.ez-pp.farm/0)`)
            loggedIn = false;
            ipcRenderer.send("perform-logout");
            Swal.fire({
                title: 'See ya soon!',
                text: "Successfully logged out!",
                icon: 'success',
                confirmButtonText: 'Okay'
            });
        }
    });

    $('#action-cancel').on('click', () => {
        if (!loggedIn) {
            changePage('launch');
        }
    });

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

    $("#action-login").on('click', async () => {
        const username = $('#login-username').val();
        const password = $('#login-password').val();
        $("#action-login").attr('disabled', true);
        $("#action-cancel").attr('disabled', true);
        const responseData = await ipcRenderer.invoke('perform-login', { username, password });
        $("#action-login").attr('disabled', false);
        $("#action-cancel").attr('disabled', false);
        if (!responseData)
            return;
        if (responseData.code != 200) {
            Swal.fire({
                title: 'Uh oh!',
                text: responseData.message,
                icon: 'error',
                confirmButtonText: 'Oops.. my bad!'
            })
            return;
        }
        $('#login-username').val("");
        $('#login-password').val("");
        $('#welcome-text').text(`Welcome back, ${responseData.user.name}!`);
        $('#account-action').text('Not you?');
        $('.user-image').css('background-image', `url(https://a.ez-pp.farm/${responseData.user.id})`);
        loggedIn = true;
        changePage('launch');
    })

    $("#change-folder-btn").on('click', async () => {
        const responseData = await ipcRenderer.invoke('set-osu-dir');
        if (!responseData)
            return;
        if (responseData.validOsuDir) {
            Swal.fire({
                title: 'Success!',
                text: 'osu! folder set.',
                icon: 'success',
                confirmButtonText: 'Cool'
            })
            $('#currentOsuPath').text(responseData.folderPath);
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

    ipcRenderer.on('config_update', (event, data) => {
        if (data.osuPath) {
            $('#currentOsuPath').text(data.osuPath);
        }
    })

    ipcRenderer.on('account_update', (event, data) => {
        switch (data.type) {
            case "not-loggedin":
                changePage("launch");
                break;
            case "loggedin":
                changePage("launch");
                $('#welcome-text').text(`Welcome back, ${data.user.name}!`);
                $('#account-action').text('Not you?');
                $('.user-image').css('background-image', `url(https://a.ez-pp.farm/${data.user.id})`);
                loggedIn = true;
                break;
        }
    })

    ipcRenderer.on('status_update', (event, status) => {
        switch (status.type) {
            case "up-to-date":
                $("#launch-btn").attr('disabled', false);
                $('#launch-btn').html('Launch');
                currentState = status.type;
                break;
            case "update-available":
                $("#launch-btn").attr('disabled', false);
                $('#launch-btn').html('Update');
                currentState = status.type;
                break;
            case "missing-folder":
                $("#launch-btn").attr('disabled', true);
                $('#launch-btn').html('set your osu! folder');
                currentState = status.type;
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
            case "info":
                Swal.fire({
                    title: 'Info!',
                    text: status.message,
                    icon: 'info',
                    confirmButtonText: 'Okay'
                });
                break;
            case "package-issue":
                Swal.fire({
                    title: 'Uh oh!',
                    text: status.message,
                    icon: 'error',
                    confirmButtonText: 'Okay'
                });
                $("#launch-btn").attr('disabled', true);
                $('#launch-btn').html('missing packages');
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

    function changePage(page) {
        $(`#${currentPage}-page`).fadeOut(50, "swing", () => {
            $(`#${page}-page`).fadeIn(350);
        });
        currentPage = page;
    }

    // workaround for the dark theme
    $('head').append($('<link href="../assets/sweetalert2.dark.css" rel="stylesheet" />'));
})