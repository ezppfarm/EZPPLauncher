const appInfo = require('./appInfo.js');
const DiscordAutoRPC = require("discord-auto-rpc");
const { app } = require('electron');
const DiscordRPC = require("discord-rpc").default;
const clientId = "1032772293220384808";
let client = undefined;
let lastState = "Idle in Launcher...";
let presenceEnabled = true;
let startDate = new Date();
let lastActivity = {
    details: "  ",
    state: lastState,
    startTimestamp: startDate,
    largeImageKey: "ezppfarm",
    largeImageText: appInfo.appName + " " + appInfo.appVersion,
    buttons: [
        {
            label: "Download the Launcher",
            url: "https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest"
        },
        {
            label: "Join EZPPFarm",
            url: "https://ez-pp.farm/discord"
        }
    ],
    instance: false,
};

module.exports = {
    connect: () => {
        if (client === undefined) {
            client = new DiscordAutoRPC.AutoClient({ transport: "ipc" });
            client.endlessLogin({ clientId: clientId });
            client.once("ready", () => {
                setInterval(() => {
                    if (lastActivity !== undefined)
                        lastActivity.state = lastState;
                    client.setActivity(presenceEnabled ? lastActivity : undefined);
                }, 2500);
            });
        }
    },
    enablePresence: () => presenceEnabled = true,
    disablePresence: () => presenceEnabled = false,
    updateStartDate: () => startDate = new Date(),
    updateState: (state) => lastState = state,
    updateStatus: (details, osuVersion) => {
        lastActivity = {
            details: details ? details : "  ",
            state: lastState,
            startTimestamp: startDate,
            smallImageKey: osuVersion ? "osu" : "  ",
            smallImageText: osuVersion ? osuVersion : "  ",
            largeImageKey: "ezppfarm",
            largeImageText: appInfo.appName + " " + appInfo.appVersion,
            buttons: [
                {
                    label: "Download the Launcher",
                    url: "https://ez-pp.farm/download"
                },
                {
                    label: "Join EZPPFarm",
                    url: "https://discord.com/invite/g8Bh7RaKPg"
                }
            ],
            instance: false,
        }
    }
}