import cryptojs from 'crypto-js';

export class Crypto {
  private key: cryptojs.lib.WordArray;
  private ivLength: number;

  constructor(key: string, opts?: { ivLength?: number }) {
    this.key = cryptojs.SHA256(key);
    this.ivLength = opts?.ivLength ?? 16;
  }

  encrypt(str: string): string {
    const iv = cryptojs.lib.WordArray.random(this.ivLength);
    const encrypted = cryptojs.AES.encrypt(str, this.key, { iv });

    const ivBase64 = iv.toString(cryptojs.enc.Base64);
    const ctBase64 = encrypted.ciphertext.toString(cryptojs.enc.Base64);

    return `${ivBase64}:${ctBase64}`;
  }

  decrypt(data: string): string {
    const [ivBase64, ctBase64] = data.split(':');

    if (!ivBase64 || !ctBase64) throw new Error('Invalid input format');

    const iv = cryptojs.enc.Base64.parse(ivBase64);
    const ciphertext = cryptojs.enc.Base64.parse(ctBase64);

    const cipherParams = cryptojs.lib.CipherParams.create({
      ciphertext,
    });

    const decrypted = cryptojs.AES.decrypt(cipherParams, this.key, { iv });
    return decrypted.toString(cryptojs.enc.Utf8);
  }
}
