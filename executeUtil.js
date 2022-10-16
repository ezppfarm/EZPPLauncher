const childProcess = require('child_process');
module.exports = {
    runFile: (folder, file, args, onExit) => {
        childProcess.execFile(file, args, {
            cwd: folder
        }, (_err, _stdout, _stderr) => {
            onExit();
        });
    },
    runFileDetached: (folder, file, args) => {
        const subprocess = childProcess.spawn(file + " " + args, {
            cwd: folder,
            detached: true,
            stdio: 'ignore'
        })
        subprocess.unref()
    }
}