const exec = require('child_process').exec;

const execPromise = function (cmd) {
    return new Promise(function (resolve, reject) {
        exec(cmd, function (err, stdout) {
            if (err) return reject(err);
            resolve(stdout);
        });
    });
}

const execCommand = async (command) => {
    return await execPromise(command);
}

module.exports = { execCommand };