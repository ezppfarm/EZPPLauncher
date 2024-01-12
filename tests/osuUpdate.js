const { getUpdateFiles } = require("../src/util/osuUtil");

(async () => {
  const osuPath = "";
  const latestFiles = await getUpdateFiles("stable40");
  console.log(latestFiles);
})();
