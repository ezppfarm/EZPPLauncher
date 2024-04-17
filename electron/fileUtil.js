const fs = require("fs");

function isWritable(filePath) {
  let fileAccess = false;
  try {
    fs.closeSync(fs.openSync(filePath, "r+"));
    fileAccess = true;
  } catch {
  }
  return fileAccess;
}

module.exports = {
  isWritable,
};
