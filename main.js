// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require(
  "electron",
);

const path = require("path");
const serve = require("electron-serve");
const loadURL = serve({ directory: "public" });
const config = require("./electron/config");
const { setupTitlebar, attachTitlebarToWindow } = require(
  "custom-electron-titlebar/main",
);
const {
  isValidOsuFolder,
  getUpdateFiles,
  getGlobalConfig,
  getFilesThatNeedUpdate,
  downloadUpdateFiles,
  getUserConfig,
  runOsuWithDevServer,
  replaceUIFiles,
  findOsuInstallation,
  updateOsuConfigHashes,
  runOsuUpdater,
  gamemodes,
  getEZPPLauncherUpdateFiles,
  downloadEZPPLauncherUpdateFiles,
} = require("./electron/osuUtil");
const { formatBytes } = require("./electron/formattingUtil");
const windowName = require("get-window-by-name");
const fs = require("fs");
const { runFileDetached } = require("./electron/executeUtil");
const richPresence = require("./electron/richPresence");
const cryptUtil = require("./electron/cryptoUtil");
const { getHwId } = require("./electron/hwidUtil");
const { appName, appVersion } = require("./electron/appInfo");
const { updateAvailable, releasesUrl } = require("./electron/updateCheck");
const fkill = require("fkill");
const { checkImageExists } = require("./electron/imageUtil");
const { isNet8Installed } = require("./electron/netUtils");
const Logger = require("./electron/logging");
const { isWritable } = require("./electron/fileUtil");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let osuCheckInterval;
let userOsuPath;
let osuLoaded = false;
let patch = false;
let logger = new Logger(path.join(
  process.platform == "win32"
    ? process.env["LOCALAPPDATA"]
    : process.env["HOME"],
  "EZPPLauncher",
  "logs",
));

let currentUser = undefined;

function isDev() {
  return !app.isPackaged;
}

function startOsuStatus() {
  osuCheckInterval = setInterval(async () => {
    const osuWindowTitle = windowName.getWindowText("osu!.exe");
    if (osuWindowTitle.length < 0) {
      return;
    }
    const firstInstance = osuWindowTitle[0];

    if (firstInstance) {
      if (!osuLoaded) {
        osuLoaded = true;

        try {
          const currentUserInfo = await fetch(
            `https://api.ez-pp.farm/get_player_info?name=${currentUser.username}&scope=info`,
          );
          const currentUserInfoJson = await currentUserInfo.json();
          if (
            "player" in currentUserInfoJson &&
            currentUserInfoJson.player != null
          ) {
            if (
              "info" in currentUserInfoJson.player &&
              currentUserInfoJson.player.info != null
            ) {
              const id = currentUserInfoJson.player.info.id;
              const username = currentUserInfoJson.player.info.name;
              richPresence.updateUser({
                id,
                username,
              });
              richPresence.update();
            }
          }
        } catch {
        }

        setTimeout(() => {
          if (patch) {
            const patcherExecuteable = path.join(
              userOsuPath,
              "EZPPLauncher",
              "patcher",
              "osu!.patcher.exe",
            );
            if (fs.existsSync(patcherExecuteable)) {
              runFileDetached(userOsuPath, patcherExecuteable);
            }
          }
        }, 3000);
      }

      const windowTitle = firstInstance.processTitle;
      lastOsuStatus = windowTitle;
      const currentStatusRequest = await fetch(
        "https://api.ez-pp.farm/get_player_status?name=" + currentUser.username,
      );
      const currentStatus = await currentStatusRequest.json();

      if (!("player_status" in currentStatus)) return;
      if (!("status" in currentStatus.player_status)) return;

      const currentMode = currentStatus.player_status.status.mode;
      const currentModeString = gamemodes[currentMode];

      const currentInfoRequest = await fetch(
        "https://api.ez-pp.farm/get_player_info?name=" + currentUser.username +
          "&scope=all",
      );
      const currentInfo = await currentInfoRequest.json();
      let currentUsername = currentInfo.player.info.name;
      const currentId = currentInfo.player.info.id;
      const currentStats = currentInfo.player.stats[currentMode];

      currentUsername += ` (#${currentStats.rank})`;

      let largeImageKey = "ezppfarm";
      let details = "Idle...";
      let infoText = currentStatus.player_status.status.info_text.length > 0
        ? currentStatus.player_status.status.info_text
        : "  ";
      if (
        "beatmap" in currentStatus.player_status.status &&
        currentStatus.player_status.status.beatmap !== null
      ) {
        const setId = currentStatus.player_status.status.beatmap.set_id;
        if (setId) {
          const coverImage =
            `https://assets.ppy.sh/beatmaps/${setId}/covers/list@2x.jpg`;
          if (
            checkImageExists(coverImage)
          ) {
            largeImageKey = coverImage;
          }
        }
      }

      switch (currentStatus.player_status.status.action) {
        case 1:
          details = "AFK...";
          infoText = "  ";
          largeImageKey = "ezppfarm";
          break;
        case 2:
          details = "Playing...";
          break;
        case 3:
          details = "Editing...";
          break;
        case 4:
          details = "Modding...";
          break;
        case 5:
          details = "Multiplayer: Selecting a Beatmap...";
          infoText = "  ";
          largeImageKey = "ezppfarm";
          break;
        case 6:
          details = "Watching...";
          break;
        case 8:
          details = "Testing...";
          break;
        case 9:
          details = "Submitting...";
          largeImageKey = "ezppfarm";
          break;
        case 11:
          details = "Multiplayer: Idle...";
          infoText = "  ";
          largeImageKey = "ezppfarm";
          break;
        case 12:
          details = "Multiplayer: Playing...";
          break;
        case 13:
          details = "Browsing osu!direct...";
          infoText = "  ";
          largeImageKey = "ezppfarm";
          break;
      }

      details = `[${currentModeString}] ${details}`;

      richPresence.updateUser({
        username: currentUsername,
        id: currentId,
      });

      richPresence.updateStatus({
        details,
        state: infoText,
        largeImageKey,
      });

      richPresence.update();
    }
  }, 2500);
}

function stopOsuStatus() {
  clearInterval(osuCheckInterval);
}

function registerIPCPipes() {
  ipcMain.handle("ezpplauncher:login", async (e, args) => {
    let hwid = "";
    try {
      hwid = getHwId();
    } catch (err) {
      logger.error(`Failed to get HWID.`, err);
      return {
        code: 500,
        message: "Failed to get HWID.",
      };
    }
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), 8000);
    logger.log(`Logging in with user ${args.username}...`);
    try {
      const fetchResult = await fetch("https://ez-pp.farm/login/check", {
        signal: timeout.signal,
        method: "POST",
        body: JSON.stringify({
          username: args.username,
          password: args.password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (fetchResult.ok) {
        const result = await fetchResult.json();
        if ("user" in result) {
          if (args.saveCredentials) {
            config.set("username", args.username);
            config.set("password", cryptUtil.encrypt(args.password, hwid));
          }
          currentUser = args;
          config.remove("guest");
          logger.log(`Logged in as user ${args.username}!`);
        } else logger.log(`Login failed for user ${args.username}.`);
        return result;
      }
      logger.log(
        `Login failed for user ${username}.\nResponse:\n${await fetchResult
          .text()}`,
      );
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    } catch (err) {
      logger.error("Error while logging in:", err);
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    }
  });

  ipcMain.handle("ezpplauncher:autologin-active", async (e) => {
    const username = config.get("username");
    const password = config.get("password");
    const guest = config.get("guest");
    if (guest != undefined) return true;
    return username != undefined && password != undefined;
  });

  ipcMain.handle("ezpplauncher:autologin", async (e) => {
    const hwid = getHwId();
    const username = config.get("username");
    const guest = config.get("guest");
    if (guest) return { code: 200, message: "Login as guest", guest: true };
    if (username == undefined) {
      return { code: 200, message: "No autologin" };
    }
    const password = cryptUtil.decrypt(config.get("password"), hwid);
    if (username == undefined || password == undefined) {
      return { code: 200, message: "No autologin" };
    }
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), 8000);
    logger.log(`Logging in with user ${username}...`);
    try {
      const fetchResult = await fetch("https://ez-pp.farm/login/check", {
        signal: timeout.signal,
        method: "POST",
        body: JSON.stringify({
          username: username,
          password: password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (fetchResult.ok) {
        const result = await fetchResult.json();
        if ("user" in result) {
          currentUser = {
            username: username,
            password: password,
          };
          logger.log(`Logged in as user ${username}!`);
        } else logger.log(`Login failed for user ${username}.`);

        return result;
      } else {
        config.remove("password");
      }
      logger.log(
        `Login failed for user ${username}.\nResponse:\n${await fetchResult
          .text()}`,
      );
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    } catch (err) {
      logger.error("Error while logging in:", err);
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    }
  });

  ipcMain.handle("ezpplauncher:guestlogin", (e) => {
    config.remove("username");
    config.remove("password");
    config.set("guest", "1");
    currentUser = undefined;
    logger.log("Logged in as guest user.");
  });

  ipcMain.handle("ezpplauncher:logout", (e) => {
    config.remove("username");
    config.remove("password");
    config.remove("guest");
    currentUser = undefined;
    logger.log("Loging out.");
    return true;
  });

  ipcMain.handle("ezpplauncher:settings", async (e) => {
    return config.all();
  });

  ipcMain.handle("ezpplauncher:setting-update", async (e, args) => {
    for (const key of Object.keys(args)) {
      const value = args[key];

      if (key == "presence") {
        if (!value) richPresence.disconnect();
        else richPresence.connect();
      }

      if (key == "logging") {
        logger.enabled = logging;
      }

      if (typeof value == "boolean") {
        config.set(key, value ? "true" : "false");
      } else {
        config.set(key, value);
      }
    }
  });

  ipcMain.handle("ezpplauncher:detect-folder", async (e) => {
    const detected = await findOsuInstallation();
    if (detected && await isValidOsuFolder(detected)) {
      mainWindow.webContents.send("ezpplauncher:alert", {
        type: "success",
        message: "osu! path successfully saved!",
      });
      config.set("osuPath", detected);
    }
    return config.all();
  });

  ipcMain.handle("ezpplauncher:set-folder", async (e) => {
    const folderResult = await dialog.showOpenDialog({
      title: "Select osu! installation directory",
      properties: ["openDirectory"],
    });
    if (!folderResult.canceled) {
      const folder = folderResult.filePaths[0];
      if (await isValidOsuFolder(folder)) {
        config.set("osuPath", folder);
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "success",
          message: "osu! path successfully saved!",
        });
      } else {
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message: "invalid osu! path!",
        });
      }
    }
    return config.all();
  });

  ipcMain.handle("ezpplauncher:exitAndUpdate", async (e) => {
    await shell.openExternal(releasesUrl);
    app.exit();
  });

  ipcMain.handle("ezpplauncher:launch", async (e) => {
    try {
      const osuWindowTitle = windowName.getWindowText("osu!.exe");
      if (osuWindowTitle.length > 0) {
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message: "osu! is running, please exit.",
        });
        mainWindow.webContents.send("ezpplauncher:launchabort");
        return;
      }

      logger.log("Preparing launch...");
      const configPatch = config.get("patch");
      patch = configPatch != undefined ? configPatch == "true" : true;
      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Checking osu! directory...",
      });
      await new Promise((res) => setTimeout(res, 1000));
      const osuPath = config.get("osuPath");
      userOsuPath = osuPath;
      if (osuPath == undefined) {
        mainWindow.webContents.send("ezpplauncher:launchabort");
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message: "osu! path not set!",
        });
        mainWindow.webContents.send("ezpplauncher:open-settings");
        logger.log("osu! path is not set.");
        return;
      }
      if (!(await isValidOsuFolder(osuPath))) {
        mainWindow.webContents.send("ezpplauncher:launchabort");
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message: "invalid osu! path!",
        });
        logger.log("osu! path is invalid.");
        return;
      }
      if (patch) {
        if (!(await isNet8Installed())) {
          mainWindow.webContents.send("ezpplauncher:launchabort");
          mainWindow.webContents.send("ezpplauncher:alert", {
            type: "error",
            message: ".NET 8 is not installed.",
          });
          //open .net 8 download in browser
          shell.openExternal(
            "https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-8.0.4-windows-x64-installer",
          );
          logger.log(".NET 8 is not installed.");
        }
      }
      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Checking for osu! updates...",
      });
      await new Promise((res) => setTimeout(res, 1000));
      const releaseStream = await getGlobalConfig(osuPath).get(
        "_ReleaseStream",
      );
      const latestFiles = await getUpdateFiles(releaseStream);
      const updateFiles = await getFilesThatNeedUpdate(osuPath, latestFiles);
      if (updateFiles.length > 0) {
        logger.log("osu! updates found.");
        const updateDownloader = downloadUpdateFiles(osuPath, updateFiles);
        let errored = false;
        updateDownloader.eventEmitter.on("error", (data) => {
          const filename = data.fileName;
          logger.error(
            `Failed to download/replace ${filename}!`,
            data.error,
          );
          errored = true;
          mainWindow.webContents.send("ezpplauncher:alert", {
            type: "error",
            message:
              `Failed to download/replace ${filename}!\nMaybe try to restart EZPPLauncher.`,
          });
        });
        updateDownloader.eventEmitter.on("data", (data) => {
          if (data.progress >= 100) {
            logger.log(`Downloaded ${data.fileName} successfully.`);
          }
          mainWindow.webContents.send("ezpplauncher:launchprogress", {
            progress: Math.ceil(data.progress),
          });
          mainWindow.webContents.send("ezpplauncher:launchstatus", {
            status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${
              formatBytes(data.total)
            })...`,
          });
        });
        await updateDownloader.startDownload();
        mainWindow.webContents.send("ezpplauncher:launchprogress", {
          progress: -1,
        });
        if (errored) {
          mainWindow.webContents.send("ezpplauncher:launchabort");
          return;
        }
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: "osu! is now up to date!",
        });
        await new Promise((res) => setTimeout(res, 1000));
      } else {
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: "osu! is up to date!",
        });
        await new Promise((res) => setTimeout(res, 1000));
      }

      if (patch) {
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: "Looking for patcher updates...",
        });
        await new Promise((res) => setTimeout(res, 1000));
        const patchFiles = await getEZPPLauncherUpdateFiles(osuPath);
        if (patchFiles.length > 0) {
          logger.log("EZPPLauncher updates found.");
          const patcherDownloader = await downloadEZPPLauncherUpdateFiles(
            osuPath,
            patchFiles,
          );
          let errored = false;
          patcherDownloader.eventEmitter.on("error", (data) => {
            const filename = data.fileName;
            logger.error(`Failed to download/replace ${filename}!`, data.error);
            errored = true;
            mainWindow.webContents.send("ezpplauncher:alert", {
              type: "error",
              message:
                `Failed to download/replace ${filename}!\nMaybe try to restart EZPPLauncher.`,
            });
          });
          patcherDownloader.eventEmitter.on("data", (data) => {
            if (data.progress >= 100) {
              logger.log(`Downloaded ${data.fileName} successfully.`);
            }
            mainWindow.webContents.send("ezpplauncher:launchprogress", {
              progress: Math.ceil(data.progress),
            });
            mainWindow.webContents.send("ezpplauncher:launchstatus", {
              status: `Downloading ${data.fileName}(${
                formatBytes(data.loaded)
              }/${formatBytes(data.total)})...`,
            });
          });
          await patcherDownloader.startDownload();
          mainWindow.webContents.send("ezpplauncher:launchprogress", {
            progress: -1,
          });
          if (errored) {
            mainWindow.webContents.send("ezpplauncher:launchabort");
            return;
          }
          mainWindow.webContents.send("ezpplauncher:launchstatus", {
            status: "Patcher is now up to date!",
          });
        } else {
          mainWindow.webContents.send("ezpplauncher:launchstatus", {
            status: "Patcher is up to date!",
          });
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
      if (updateFiles.length > 0) {
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: "Launching osu! updater to verify updates...",
        });
        await new Promise((res) => setTimeout(res, 1000));

        await new Promise((res) => {
          runOsuUpdater(osuPath, async () => {
            await new Promise((res) => setTimeout(res, 500));
            const terminationThread = setInterval(async () => {
              const osuWindowTitle = windowName.getWindowText("osu!.exe");
              if (osuWindowTitle.length < 0) {
                return;
              }
              const firstInstance = osuWindowTitle[0];
              if (firstInstance) {
                const processId = firstInstance.processId;
                await fkill(processId, { force: true, silent: true });
                clearInterval(terminationThread);
                res();
              }
            }, 500);
          });
        });
      }

      await new Promise((res) => setTimeout(res, 1000));

      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Preparing launch...",
      });

      /* await updateOsuConfigHashes(osuPath); */
      logger.log("Replacing UI files...");
      try {
        await replaceUIFiles(osuPath, false);
        logger.log("UI files replaced successfully.");
      } catch (err) {
        logger.error("Failed to replace UI files:", err);
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message: "Failed to replace UI files. try restarting EZPPLauncher.",
        });
        mainWindow.webContents.send("ezpplauncher:launchabort");
        return;
      }

      const forceUpdateFiles = [
        ".require_update",
        "help.txt",
        "_pending",
      ];

      try {
        for (const updateFileName of forceUpdateFiles) {
          const updateFile = path.join(osuPath, updateFileName);
          if (fs.existsSync(updateFile)) {
            await fs.promises.rm(updateFile, {
              force: true,
              recursive: (await fs.promises.lstat(updateFile)).isDirectory,
            });
          }
        }
      } catch (err) {
        logger.error("Failed to remove force update files:", err);
      }

      const userConfig = getUserConfig(osuPath);
      if (richPresence.hasPresence) {
        await userConfig.set("DiscordRichPresence", "0");
      }
      await userConfig.set("ShowInterfaceDuringRelax", "1");
      if (currentUser) {
        await userConfig.set("CredentialEndpoint", "ez-pp.farm");
        await userConfig.set("SavePassword", "1");
        await userConfig.set("SaveUsername", "1");
        await userConfig.set("Username", currentUser.username);
        await userConfig.set("Password", currentUser.password);
      }

      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Launching osu!...",
      });

      await new Promise((res) => setTimeout(res, 1000));

      logger.log("Launching osu!...");

      const onExitHook = () => {
        logger.log("osu! has exited.");
        mainWindow.show();
        mainWindow.focus();
        stopOsuStatus();
        richPresence.updateUser({
          username: "  ",
          id: undefined,
        });
        richPresence.updateStatus({
          state: "Idle in Launcher...",
          details: undefined,
        });
        richPresence.update();
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: "Waiting for cleanup...",
        });
        const timeStart = performance.now();
        logger.log("Waiting for cleanup...");

        const cleanup = setInterval(async () => {
          const osuUIFile = path.join(osuPath, "osu!ui.dll");
          const osuGameplayFile = path.join(osuPath, "osu!gameplay.dll");
          if (isWritable(osuUIFile) && isWritable(osuGameplayFile)) {
            logger.log(
              `Cleanup complete, took ${
                ((performance.now() - timeStart) / 1000).toFixed(3)
              } seconds.`,
            );
            clearInterval(cleanup);
            await replaceUIFiles(osuPath, true);
            mainWindow.webContents.send("ezpplauncher:launchabort");
            osuLoaded = false;
          }
        }, 1000);
      };
      runOsuWithDevServer(osuPath, "ez-pp.farm", onExitHook);
      mainWindow.hide();
      startOsuStatus();
      return true;
    } catch (err) {
      logger.error("Failed to launch", err);
      mainWindow.webContents.send("ezpplauncher:alert", {
        type: "error",
        message: "Failed to launch osu!. Please try again.",
      });
      mainWindow.webContents.send("ezpplauncher:launchabort");
    }
  });
}

function createWindow() {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  setupTitlebar();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 550,
    height: 350,
    resizable: false,
    frame: false,
    titleBarStyle: "hidden",
    title: `${appName} ${appVersion}`,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "public/favicon.png"),
    show: false,
  });

  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);

  // disable electron toolbar
  /* if (!isDev()) */
  mainWindow.setMenu(null);

  attachTitlebarToWindow(mainWindow);

  // This block of code is intended for development purpose only.
  // Delete this entire block of code when you are ready to package the application.
  if (isDev()) {
    mainWindow.loadURL("http://localhost:8080/");
  } else {
    loadURL(mainWindow);
  }

  registerIPCPipes();

  const presenceEnabled = config.get("presence");
  if (presenceEnabled == undefined) {
    richPresence.connect();
  } else {
    if (presenceEnabled == "true") {
      richPresence.connect();
    }
  }

  logger.init();

  const loggingEnabled = config.get("logging");
  if (loggingEnabled && loggingEnabled == "true") {
    logger.enabled = true;
  }
  // Uncomment the following line of code when app is ready to be packaged.
  // loadURL(mainWindow);

  // Open the DevTools and also disable Electron Security Warning.
  if (isDev()) {
    process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = true;
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Emitted when the window is ready to be shown
  // This helps in showing the window gracefully.
  mainWindow.once("ready-to-show", async () => {
    const updateInfo = await updateAvailable();
    if (updateInfo.update) {
      mainWindow.webContents.send("ezpplauncher:update", updateInfo.release);
    }
    mainWindow.show();
    mainWindow.focus();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", async function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  await richPresence.disconnect();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
