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

window.addEventListener("autologin-attempt", async (e) => {
  const loginResult = await ipcRenderer.invoke("ezpplauncher:autologin");
  window.dispatchEvent(
    new CustomEvent("login-result", { detail: loginResult }),
  );
});

window.addEventListener("logout", async (e) => {
  await ipcRenderer.invoke("ezpplauncher:logout");
});

window.addEventListener("guest-login", async (e) => {
  await ipcRenderer.invoke("ezpplauncher:guestlogin");
});

window.addEventListener("launch", async (e) => {
  await ipcRenderer.invoke("ezpplauncher:launch");
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
