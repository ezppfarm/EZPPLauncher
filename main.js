// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const serve = require("electron-serve");
const loadURL = serve({ directory: "public" });
const config = require("./src/config/config");
const { setupTitlebar, attachTitlebarToWindow } = require(
  "custom-electron-titlebar/main",
);
const { isValidOsuFolder, getUpdateFiles, getGlobalConfig, getFilesThatNeedUpdate, downloadUpdateFiles, getUserConfig, runOsuWithDevServer, getPatcherUpdates, downloadPatcherUpdates, getUIFiles, downloadUIFiles, replaceUIFile } = require("./src/util/osuUtil");
const { formatBytes } = require("./src/util/formattingUtil");
const windowName = require("get-window-by-name");
const { existsSync } = require("fs");
const { runFileDetached } = require("./src/util/executeUtil");
const richPresence = require("./src/discord/richPresence");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let osuCheckInterval;
let userOsuPath;
let osuLoaded = false;
let lastOsuStatus = "";

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
          const patcherExecuteable = path.join(userOsuPath, "EZPPLauncher", "patcher.exe");
          if (existsSync(patcherExecuteable)) {
            runFileDetached(userOsuPath, patcherExecuteable);
          }
        }, 3000);
      }

      const windowTitle = firstInstance.processTitle;
      if (lastOsuStatus == windowTitle) return;
      lastOsuStatus = windowTitle;
      if (!windowTitle.includes("-")) {
        richPresence.updateStatus({
          details: undefined,
          state: "Idle..."
        })
      } else {
        const components = windowTitle.split(" - ");
        const splitTitle = [components.shift(), components.join(" - ")]
        const currentMap = splitTitle[1];
        if (!currentMap.endsWith(".osu")) {
          richPresence.updateStatus({
            state: "Playing...",
            details: currentMap
          })
        }
      }
    }
  }, 1000);
}

function stopOsuStatus() {
  clearInterval(osuCheckInterval);
}

function registerIPCPipes() {
  ipcMain.handle("ezpplauncher:login", async (e, args) => {
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
            config.set("password", args.password);
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

  ipcMain.handle("ezpplauncher:autologin", async (e) => {
    const username = config.get("username");
    const password = config.get("password");
    const guest = config.get("guest");
    if (guest) return { code: 200, message: "Login as guest", guest: true };
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
    currentUser = undefined
    return true;
  });

  ipcMain.handle("ezpplauncher:settings", async (e) => {
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

  ipcMain.handle("ezpplauncher:launch", async (e, args) => {
    const patch = args.patch;
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
      uiDownloader.eventEmitter.on("data", (data) => {
        mainWindow.webContents.send("ezpplauncher:launchprogress", {
          progress: Math.ceil(data.progress),
        });
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${formatBytes(data.total)})...`,
        });
      });
      await uiDownloader.startDownload();
      mainWindow.webContents.send("ezpplauncher:launchprogress", {
        progress: -1,
      });
    }
    if (updateFiles.length > 0) {
      const updateDownloader = downloadUpdateFiles(osuPath, updateFiles);
      updateDownloader.eventEmitter.on("data", (data) => {
        mainWindow.webContents.send("ezpplauncher:launchprogress", {
          progress: Math.ceil(data.progress),
        });
        mainWindow.webContents.send("ezpplauncher:launchstatus", {
          status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${formatBytes(data.total)})...`,
        });
      });
      await updateDownloader.startDownload();
      mainWindow.webContents.send("ezpplauncher:launchprogress", {
        progress: -1,
      });
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
        patcherDownloader.eventEmitter.on("data", (data) => {
          mainWindow.webContents.send("ezpplauncher:launchprogress", {
            progress: Math.ceil(data.progress),
          });
          mainWindow.webContents.send("ezpplauncher:launchstatus", {
            status: `Downloading ${data.fileName}(${formatBytes(data.loaded)}/${formatBytes(data.total)})...`,
          });
        });
        await patcherDownloader.startDownload();
        mainWindow.webContents.send("ezpplauncher:launchprogress", {
          progress: -1,
        })
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

    const userConfig = getUserConfig(osuPath);
    richPresence.updateVersion(await userConfig.get("LastVersion"));
    if (currentUser) {
      await userConfig.set("Username", currentUser.username);
      await userConfig.set("Password", currentUser.password);
    }

    mainWindow.webContents.send("ezpplauncher:launchstatus", {
      status: "Launching osu!...",
    });

    const onExitHook = () => {
      mainWindow.show();
      stopOsuStatus();
      richPresence.updateVersion();
      richPresence.updateStatus({
        state: "Idle in Launcher...",
        details: undefined
      })
      mainWindow.webContents.send("ezpplauncher:launchstatus", {
        status: "Waiting for cleanup...",
      });

      setTimeout(async () => {
        await replaceUIFile(osuPath, true);
        mainWindow.webContents.send("ezpplauncher:launchabort");
      }, 5000);
    }
    await replaceUIFile(osuPath, false);
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
    width: 600,
    height: 380,
    resizable: false,
    frame: false,
    titleBarStyle: "hidden",
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
  richPresence.connect();
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
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
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
