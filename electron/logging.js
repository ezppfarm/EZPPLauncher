const fs = require("fs");
const path = require("path");

class Logger {
  constructor(directory) {
    this.directory = directory;
    this.enabled = false;
  }

  async init() {
    const filename = `${new Date().toISOString().replace(/:/g, "-")}.log`;
    this.logPath = path.join(this.directory, filename);
  }

  async log(message) {
    if (this.logPath === undefined || this.enabled == false) {
      return;
    }
    if (!fs.existsSync(this.logPath)) {
      await fs.promises.mkdir(this.directory, { recursive: true });
      await fs.promises.writeFile(this.logPath, "");
    }
    const logMessage = `[${new Date().toISOString()}] LOG: ${message}`;
    await fs.promises.appendFile(this.logPath, `${logMessage}\n`);
    console.log(logMessage);
  }

  async error(message, error) {
    if (this.logPath === undefined || this.enabled == false) {
      return;
    }
    if (!fs.existsSync(this.logPath)) {
      await fs.promises.mkdir(this.directory, { recursive: true });
      await fs.promises.writeFile(this.logPath, "");
    }
    const errorMessage = `[${
      new Date().toISOString()
    }] ERROR: ${message}\n${error.stack}`;
    await fs.promises.appendFile(this.logPath, `${errorMessage}\n`);
    console.error(errorMessage);
  }
}

module.exports = Logger;
