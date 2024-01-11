const sqlite = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const configFolder = path.join(
  process.platform == "win32"
    ? process.env["LOCALAPPDATA"]
    : process.env["HOME"],
  "EZPPLauncher",
);
if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder);

const dbFile = path.join(configFolder, "ezpplauncher.db");

const db = sqlite(dbFile);
db.pragma("journal_mode = WAL");

db.exec(
  "CREATE TABLE IF NOT EXISTS config (configKey VARCHAR PRIMARY KEY, configValue VARCHAR);",
);

const set = (key, value) => {
  db.prepare(
    `INSERT OR REPLACE INTO config (configKey, configValue) VALUES (?, ?)`,
  ).run(key, value);
};

const remove = (key) => {
  db.prepare(`DELETE FROM config WHERE configKey = ?`).run(key);
};

const get = (
  key,
) => {
  const result = db.prepare(
    "SELECT configKey key, configValue val FROM config WHERE key = ?",
  ).get(key);
  return result ? result.val ?? undefined : undefined;
};

module.exports = {
  get,
  set,
  remove,
};
