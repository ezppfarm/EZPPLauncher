const fs = require('fs');

async function existsAsync(filePath) {
    return new Promise(function (resolve, _reject) {
        fs.stat(filePath, function (err, _stat) {
            if (err == null) {
                resolve(true)
            } else {
                resolve(false);
            }
        })
    })
}

module.exports = { existsAsync };