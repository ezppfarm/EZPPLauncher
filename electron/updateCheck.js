const semver = require("semver");
const { appVersion } = require("./appInfo");

const repoUrl =
  "https://git.ez-pp.farm/api/v1/repos/EZPPFarm/EZPPLauncher/releases?limit=1";

module.exports = {
  updateAvailable: async () => {
    try {
      const latestRelease = await fetch(repoUrl);
      const json = await latestRelease.json();
      if (json.length <= 0) return false;
      return {
        update: semver.lt(appVersion, json[0].tag_name),
        release: json[0],
      };
    } catch (err) {
      return { update: false };
    }
  },
};
