const { exec } = require("child_process");

async function isNet8Installed() {
    return new Promise((resolve, reject) => {
        exec("dotnet --version", (error, stdout, stderr) => {
            if (error) {
                resolve(false);
                return;
            }
            if (stderr) {
                resolve(false);
                return;
            }
            const version = stdout.trim();
            resolve(version.startsWith("8."));
        })
    });
}

module.exports = { isNet8Installed };