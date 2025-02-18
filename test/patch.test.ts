const bs = require("bsdiff-bin")

(async () => {
    bs.patch('./osu!.exe', './osu!patched.exe', './osu!patch.diff', function(err){
        if(err) console.log("failed")
    });
})();
