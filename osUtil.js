const fs = require("fs");

const getLinuxDistroInfo = async() => {
    let os = await fs.promises.readFile('/etc/os-release', 'utf8')
    let opj = {}

    os?.split('\n')?.forEach((line, index) => {
        let words = line?.split('=')
        let key = words[0]?.toLowerCase()
        if (key === '') return
        let value = words[1]?.replace(/"/g, '')
        opj[key] = value
    })
    return opj;
}

module.exports = { getLinuxDistroInfo };