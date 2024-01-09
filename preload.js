const { Titlebar, TitlebarColor } = require("custom-electron-titlebar");

window.addEventListener("DOMContentLoaded", () => {
  const titlebar = new Titlebar({
    backgroundColor: TitlebarColor.fromHex("#202020"),
    itemBackgroundColor: TitlebarColor.fromHex("#202020"),
    menu: null,
    
    enableMnemonics: false,
    maximizable: false,
  });

  //titlebar.updateTitle(`${appInfo.appName} ${appInfo.appVersion}`);
});
