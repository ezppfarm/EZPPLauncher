const cryptojs = require("crypto-js");

const encrypt = (string, salt) => {
  return cryptojs.AES.encrypt(string, salt).toString();
};

const decrypt = (string, salt) => {
  return cryptojs.AES.decrypt(string, salt).toString(cryptojs.enc.Utf8);
};

module.exports = { encrypt, decrypt };
