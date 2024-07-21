const child_process = require("child_process");
const options = { encoding: "ascii", windowsHide: true, timeout: 200 };
const platforms = {
  win32: [
    "REG QUERY HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
    /MachineGuid\s+REG_SZ\s+(.*?)\s/,
  ],
  darwin: [
    "ioreg -rd1 -c IOPlatformExpertDevice",
    /"IOPlatformUUID" = "(.*?)"/,
  ],
  linux: [
    "cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || true",
    /^([\da-f]+)/,
  ],
};
const crypto = require("crypto");

const defaultHWID = "recorderinthesandybridge";

/**
 * Returns machine hardware id.
 * Returns `undefined` if cannot determine.
 * @return {Promise<string>}
 */
function getHwId() {
  return new Promise((resolve) => {
    const getter = platforms[process.platform];
    if (getter) {
      const result = getter[1].exec(child_process.execSync(getter[0], options));
      if (result) resolve(crypto.createHash("md5").update(result[1]).digest("hex"));
    }
    resolve(crypto.createHash("md5").update(defaultHWID).digest("hex"));
  })
}
exports.getHwId = getHwId;
