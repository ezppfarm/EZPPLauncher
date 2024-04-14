const { exec } = require("child_process");

async function isNet8Installed() {
    return new Promise((resolve) => {
        exec("dotnet --list-runtimes", (error, stdout, stderr) => {
            if (error) {
                resolve(false);
                return;
            }
            if (stderr) {
                resolve(false);
                return;
            }
            const version = stdout.trim();
            for (const line of version.split('\n')) {
                if (line.startsWith("Microsoft.WindowsDesktop.App 8.")) {
                    resolve(true);
                    break;
                }
            }
            resolve(false);
        })
    });
}

module.exports = { isNet8Installed };