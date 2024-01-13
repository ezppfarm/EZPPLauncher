const { getGlobalConfig } = require("../src/util/osuUtil");
const config = require("../src/config/config");
(async () => {
    const osuPath = config.get("osuPath");
    const globalConfig = getGlobalConfig(osuPath);

    const globalConfigContent = await globalConfig.get("_ReleaseStream");
    console.log(globalConfigContent);
})();