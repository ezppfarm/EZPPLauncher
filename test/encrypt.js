const dpapi = require('wincrypt');
const entropyBuffer = Buffer.from('cu24180ncjeiu0ci1nwui', 'utf-8');

const run = async () => {
    const stringToEncrypt = "Test123456!";
    

    const encrypted = await encryptString(stringToEncrypt)
    console.log(encrypted);
    const decrypted = await decryptString(encrypted);
    console.log(decrypted);

}

async function encryptString(value) {
    const encryptedString = await dpapi.protect(Buffer.from(value, 'utf-8'), entropyBuffer, 'CurrentUser');
    const encodedBase64 = Buffer.from(encryptedString, 'utf-8').toString('base64');
    return encodedBase64;
}

async function decryptString(value) {
    const decrypted = await dpapi.unprotect(Buffer.from(value, 'base64'), entropyBuffer, 'CurrentUser');
    return decrypted.toString();
}

run();