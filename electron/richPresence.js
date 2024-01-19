const DiscordRPC = require("discord-auto-rpc");
const { appName, appVersion } = require("./appInfo.js");
const { get } = require("./config.js");

const clientId = "1032772293220384808";
let richPresence;

let showPresence = true;
let cleared = false;

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
        setInterval(() => {
          const settingPresence = get("presence");
          showPresence = settingPresence != undefined
            ? settingPresence.val == "true"
            : true;

          if (showPresence) {
            richPresence.setActivity(currentStatus);
            cleared = false;
          } else {
            if (cleared) return;
            cleared = true;
            richPresence.clearActivity();
          }
        }, 2500);
      });
    }
  },
  disconnect: async () => {
    if (richPresence) {
      await richPresence.clearActivity();
      await richPresence.destroy();
      richPresence = null;
    }
  },
  updateStatus: ({ state, details }) => {
    currentStatus.state = state ?? "  ";
    currentStatus.details = details ?? "  ";
  },
  updateVersion: (osuVersion) => {
    currentStatus.smallImageKey = osuVersion ? "osu" : "  ";
    currentStatus.smallImageText = osuVersion ? `osu! ${osuVersion}` : "  ";
  },
  update: () => {
    if (showPresence) {
      richPresence.setActivity(currentStatus);
    }
  },
};
