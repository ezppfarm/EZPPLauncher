const { default: axios } = require("axios");
const { compareVersions } = require("compare-versions");

const appName = "EZPPLauncher"
const appVersion = "1.1.5";

const hasUpdate = async () => {
    const releaseInfo = await axios.get(`https://git.ez-pp.farm/api/v1/repos/EZPPFarm/${appName}/releases/latest`);
    if (releaseInfo.status !== 200) return false;
    const latestReleaseVersion = releaseInfo.data.tag_name;
    const updateAvailable = compareVersions(latestReleaseVersion, appVersion);
    if(updateAvailable > 0)
        return {
            version: latestReleaseVersion,
            url: releaseInfo.data.html_url,
        }
    return undefined;
}

module.exports = { appName, appVersion, hasUpdate };