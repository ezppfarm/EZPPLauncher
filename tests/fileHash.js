const fs = require("fs");
const crypto = require("crypto");

(async () => {
    const correctHash = 'b66478cc0f9ec50810489a039ced642b';
    const filePath = 'C:\\Users\\horiz\\AppData\\Local\\osu!\\avcodec-51.dll';
    const fileHash = crypto.createHash('md5').update(await fs.promises.readFile(filePath)).digest('hex');

    console.log({
        correctHash,
        fileHash,
        matching: correctHash === fileHash,
    })
})();