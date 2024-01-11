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
  });
  window.dispatchEvent(new CustomEvent("login-result", { detail: loginResult }));
})