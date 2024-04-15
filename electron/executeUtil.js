const childProcess = require("child_process");

const runFile = (folder, file, args, onExit) => {
  childProcess.execFile(file, args, {
    cwd: folder,
  }, (_err, _stdout, _stdin) => {
    if (onExit) onExit();
  });
};

const runFileDetached = (folder, file, args) => {
  const subProcess = childProcess.spawn(file + (args ? " " + args : ""), {
    cwd: folder,
    detached: true,
    stdio: "ignore",
  });
  subProcess.unref();
};

module.exports = { runFile, runFileDetached };
