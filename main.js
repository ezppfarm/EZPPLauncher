// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const serve = require("electron-serve");
const loadURL = serve({ directory: "public" });
const config = require("./src/config/config");
const { setupTitlebar, attachTitlebarToWindow } = require(
  "custom-electron-titlebar/main",
);
const { isValidOsuFolder } = require("./src/util/osuUtil");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function isDev() {
  return !app.isPackaged;
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
  });

  ipcMain.handle("ezpplauncher:logout", (e) => {
    config.remove("username");
    config.remove("password");
    config.remove("guest");
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

  ipcMain.handle("ezpplauncher:launch", async (e) => {
    mainWindow.webContents.send("ezpplauncher:launchstatus", {
      status: "Checking osu! directory...",
    });
    await new Promise((res) => setTimeout(res, 1000));
    const osuPath = config.get("osuPath");
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
app.on("window-all-closed", function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
