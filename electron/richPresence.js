const DiscordRPC = require("discord-auto-rpc");
const { appName, appVersion } = require("./appInfo.js");

const clientId = "1032772293220384808";

/** @type {DiscordRPC.AutoClient} */
let richPresence;

let intervalId;

let currentStatus = {
  details: "  ",
  state: "Idle in Launcher...",
  startTimestamp: new Date(),
  largeImageKey: "ezppfarm",
  largeImageText: `${appName} ${appVersion}`,
  smallImageKey: "  ",
  smallImageText: "  ",
  buttons: [
    {
      label: "Download the Launcher",
      url: "https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest",
    },
    {
      label: "Join EZPPFarm",
      url: "https://ez-pp.farm/discord",
    },
  ],
  instance: false,
};

module.exports = {
  connect: () => {
    if (!richPresence) {
      richPresence = new DiscordRPC.AutoClient({ transport: "ipc" });
      richPresence.endlessLogin({ clientId });
      richPresence.once("ready", () => {
        console.log("connected presence with user " + richPresence.user.username);
        richPresence.setActivity(currentStatus);
        intervalId = setInterval(() => {
          richPresence.setActivity(currentStatus);
        }, 2500);
      });
    }
  },
  disconnect: async () => {
    if (richPresence) {
      clearInterval(intervalId);
      await richPresence.clearActivity();
      await richPresence.destroy();
      richPresence = null;
    }
  },
  updateStatus: ({ state, details, largeImageKey }) => {
    currentStatus.state = state ?? "  ";
    currentStatus.details = details ?? "  ";
    currentStatus.largeImageKey = largeImageKey ?? "ezppfarm";
  },
  updateVersion: (osuVersion) => {
    currentStatus.smallImageKey = osuVersion ? "osu" : "  ";
    currentStatus.smallImageText = osuVersion ? `osu! ${osuVersion}` : "  ";
  },
  update: () => {
    if (richPresence && richPresence.user) {
      richPresence.setActivity(currentStatus);
    }
  },
  hasPresence: () => richPresence != undefined,
};
