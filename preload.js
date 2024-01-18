const { Titlebar, TitlebarColor } = require("custom-electron-titlebar");
const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const titlebar = new Titlebar({
    backgroundColor: TitlebarColor.fromHex("#202020"),
    itemBackgroundColor: TitlebarColor.fromHex("#202020"),
    menu: null,
    enableMnemonics: false,
    maximizable: false,
  });
});

window.addEventListener("login-attempt", async (e) => {
  const loginResult = await ipcRenderer.invoke("ezpplauncher:login", {
    username: e.detail.username,
    password: e.detail.password,
    saveCredentials: e.detail.saveCredentials,
  });
  window.dispatchEvent(
    new CustomEvent("login-result", { detail: loginResult }),
  );
});

window.addEventListener("autologin-active", async (e) => {
  const autologin = await ipcRenderer.invoke(
    "ezpplauncher:autologin-active",
  );
  window.dispatchEvent(
    new CustomEvent("autologin-result", { detail: autologin }),
  );
});

window.addEventListener("autologin-attempt", async () => {
  const loginResult = await ipcRenderer.invoke("ezpplauncher:autologin");
  window.dispatchEvent(
    new CustomEvent("login-result", { detail: loginResult }),
  );
});

window.addEventListener("logout", async () => {
  await ipcRenderer.invoke("ezpplauncher:logout");
});

window.addEventListener("guest-login", async () => {
  await ipcRenderer.invoke("ezpplauncher:guestlogin");
});

window.addEventListener("launch", async (e) => {
  await ipcRenderer.invoke("ezpplauncher:launch", e.detail);
});

window.addEventListener("settings-get", async () => {
  const settings = await ipcRenderer.invoke("ezpplauncher:settings");
  window.dispatchEvent(
    new CustomEvent("settings-result", { detail: settings }),
  );
});

window.addEventListener("folder-auto", async (e) => {
  const result = await ipcRenderer.invoke("ezpplauncher:detect-folder");
  window.dispatchEvent(
    new CustomEvent("settings-result", { detail: result }),
  );
});

window.addEventListener("folder-set", async (e) => {
  const result = await ipcRenderer.invoke("ezpplauncher:set-folder");
  window.dispatchEvent(
    new CustomEvent("settings-result", { detail: result }),
  );
});

window.addEventListener("settings-set", async (e) => {
  await ipcRenderer.invoke("ezpplauncher:settings-set", e.detail);
});

ipcRenderer.addListener("ezpplauncher:launchabort", (e, args) => {
  window.dispatchEvent(
    new CustomEvent("launch-abort"),
  );
});

ipcRenderer.addListener("ezpplauncher:alert", (e, args) => {
  window.dispatchEvent(
    new CustomEvent("alert", { detail: args }),
  );
});

ipcRenderer.addListener("ezpplauncher:launchstatus", (e, args) => {
  window.dispatchEvent(
    new CustomEvent("launchStatusUpdate", { detail: args }),
  );
});

ipcRenderer.addListener("ezpplauncher:launchprogress", (e, args) => {
  window.dispatchEvent(
    new CustomEvent("launchProgressUpdate", { detail: args }),
  );
});
