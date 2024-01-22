const semver = require("semver");
const { appVersion } = require("./appInfo");

const repoApiUrl =
  "https://git.ez-pp.farm/api/v1/repos/EZPPFarm/EZPPLauncher/releases?limit=1";

const releasesUrl =
  "https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest";

module.exports = {
  updateAvailable: async () => {
    try {
      const latestRelease = await fetch(repoApiUrl);
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
  releasesUrl,
};
