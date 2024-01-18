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

/**
 * Returns machine hardware id.
 * Returns `undefined` if cannot determine.
 * @return {string?}
 */
function getHwId() {
  const getter = platforms[process.platform];
  if (!getter) return;
  const result = getter[1].exec(child_process.execSync(getter[0], options));
  if (!result) return;
  return crypto.createHash("md5").update(result[1]).digest("hex") ||
    undefined;
}
exports.getHwId = getHwId;
