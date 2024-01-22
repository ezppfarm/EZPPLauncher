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
  getPatcherUpdates,
  downloadPatcherUpdates,
  getUIFiles,
  downloadUIFiles,
  replaceUIFile,
  findOsuInstallation,
  updateOsuConfigHashes,
} = require("./electron/osuUtil");
const { formatBytes } = require("./electron/formattingUtil");
const windowName = require("get-window-by-name");
const { existsSync } = require("fs");
const { runFileDetached } = require("./electron/executeUtil");
const richPresence = require("./electron/richPresence");
const cryptUtil = require("./electron/cryptoUtil");
const { getHwId } = require("./electron/hwidUtil");
const { appName, appVersion } = require("./electron/appInfo");
const { updateAvailable, releasesUrl } = require("./electron/updateCheck");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let osuCheckInterval;
let userOsuPath;
let osuLoaded = false;
let patch = false;
let lastOsuStatus = "";
let lastStatusUpdate;

let currentUser = undefined;

function isDev() {
  return !app.isPackaged;
}

function startOsuStatus() {
  osuCheckInterval = setInterval(async () => {
    const osuWindowTitle = windowName.getWindowText("osu!.exe");
    if (osuWindowTitle.length < 0) {
      console.log("No osu! window found");
      return;
    }
    const firstInstance = osuWindowTitle[0];
    if (firstInstance) {
      if (!osuLoaded) {
        osuLoaded = true;
        setTimeout(() => {
          if (patch) {
            const patcherExecuteable = path.join(
              userOsuPath,
              "EZPPLauncher",
              "patcher.exe",
            );
            if (existsSync(patcherExecuteable)) {
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

      let details = "Idle...";
      let infoText = currentStatus.player_status.status.info_text.length > 0
        ? currentStatus.player_status.status.info_text
        : "  ";

      switch (currentStatus.player_status.status.action) {
        case 1:
          details = "AFK...";
          infoText = "  ";
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
          break;
        case 6:
          details = "Watching...";
          break;
        case 8:
          details = "Testing...";
          break;
        case 9:
          details = "Submitting...";
          break;
        case 11:
          details = "Multiplayer: Idle...";
          infoText = "  ";
          break;
        case 12:
          details = "Multiplayer: Playing...";
          break;
        case 13:
          details = "Browsing osu!direct...";
          infoText = "  ";
          break;
      }

      richPresence.updateStatus({
        details,
        state: infoText,
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
    const hwid = getHwId();
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), 8000);
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
        }
        return result;
      }
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    } catch (err) {
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
        }
        return result;
      } else {
        config.remove("password");
      }
      return {
        code: 500,
        message: "Something went wrong while logging you in.",
      };
    } catch (err) {
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
  });

  ipcMain.handle("ezpplauncher:logout", (e) => {
    config.remove("username");
    config.remove("password");
    config.remove("guest");
    currentUser = undefined;
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
      return;
    }
    if (!(await isValidOsuFolder(osuPath))) {
      mainWindow.webContents.send("ezpplauncher:launchabort");
      mainWindow.webContents.send("ezpplauncher:alert", {
        type: "error",
        message: "invalid osu! path!",
      });
      return;
    }
    mainWindow.webContents.send("ezpplauncher:launchstatus", {
      status: "Checking for osu! updates...",
    });
    await new Promise((res) => setTimeout(res, 1000));
    const releaseStream = await getGlobalConfig(osuPath).get("_ReleaseStream");
    const latestFiles = await getUpdateFiles(releaseStream);
    const uiFiles = await getUIFiles(osuPath);
    const updateFiles = await getFilesThatNeedUpdate(osuPath, latestFiles);
    if (uiFiles.length > 0) {
      const uiDownloader = downloadUIFiles(osuPath, uiFiles);
      let errored = false;
      uiDownloader.eventEmitter.on("error", (data) => {
        const filename = data.fileName;
        errored = true;
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message:
            `Failed to download/replace ${filename}!\nMaybe try to restart EZPPLauncher.`,
        });
      });
      uiDownloader.eventEmitter.on("data", (data) => {
        mainWindow.webContents.send("ezpplauncher:launchprogress", {
          progress: Math.ceil(data.progress),
        });
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${
            formatBytes(data.total)
          })...`,
        });
      });
      await uiDownloader.startDownload();
      mainWindow.webContents.send("ezpplauncher:launchprogress", {
        progress: -1,
      });
      if (errored) {
        mainWindow.webContents.send("ezpplauncher:launchabort");
        return;
      }
    }
    if (updateFiles.length > 0) {
      const updateDownloader = downloadUpdateFiles(osuPath, updateFiles);
      let errored = false;
      updateDownloader.eventEmitter.on("error", (data) => {
        const filename = data.fileName;
        errored = true;
        mainWindow.webContents.send("ezpplauncher:alert", {
          type: "error",
          message:
            `Failed to download/replace ${filename}!\nMaybe try to restart EZPPLauncher.`,
        });
      });
      updateDownloader.eventEmitter.on("data", (data) => {
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
      const patchFiles = await getPatcherUpdates(osuPath);
      if (patchFiles.length > 0) {
        const patcherDownloader = downloadPatcherUpdates(osuPath, patchFiles);
        let errored = false;
        patcherDownloader.eventEmitter.on("error", (data) => {
          const filename = data.fileName;
          errored = true;
          mainWindow.webContents.send("ezpplauncher:alert", {
            type: "error",
            message:
              `Failed to download/replace ${filename}!\nMaybe try to restart EZPPLauncher.`,
          });
        });
        patcherDownloader.eventEmitter.on("data", (data) => {
          mainWindow.webContents.send("ezpplauncher:launchprogress", {
            progress: Math.ceil(data.progress),
          });
          mainWindow.webContents.send("ezpplauncher:launchstatus", {
            status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${
              formatBytes(data.total)
            })...`,
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

    mainWindow.webContents.send("ezpplauncher:launchstatus", {
      status: "Preparing launch...",
    });
    await updateOsuConfigHashes(osuPath);
    await replaceUIFile(osuPath, false);

    const userConfig = getUserConfig(osuPath);
    richPresence.updateVersion(await userConfig.get("LastVersion"));
    richPresence.update();
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

    const onExitHook = () => {
      mainWindow.show();
      mainWindow.focus();
      stopOsuStatus();
      richPresence.updateVersion();
      richPresence.updateStatus({
        state: "Idle in Launcher...",
        details: undefined,
      });
      richPresence.update();
      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Waiting for cleanup...",
      });

      setTimeout(async () => {
        await replaceUIFile(osuPath, true);
        mainWindow.webContents.send("ezpplauncher:launchabort");
        osuLoaded = false;
      }, 5000);
    };
    runOsuWithDevServer(osuPath, "ez-pp.farm", onExitHook);
    mainWindow.hide();
    startOsuStatus();

    /* mainWindow.webContents.send("ezpplauncher:launchprogress", {
      progress: 0,
    });
    mainWindow.webContents.send("ezpplauncher:launchprogress", {
      progress: 100,
    }); */
    return true;
  });
}

function createWindow() {
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
    console.log(presenceEnabled);
    if (presenceEnabled == "true") {
      richPresence.connect();
    }
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
