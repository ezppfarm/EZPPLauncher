import { exists, mkdir, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { Crypto } from './crypto';
import { getHWID } from './osuUtil';

export class Config {
  private fileName: string;
  private config: Record<string, unknown> = {};
  private crypto: Crypto | undefined;
  private configFilePath: string | undefined;
  private encrypt: boolean;

  constructor(fileName: string, encrypt?: boolean) {
    this.fileName = fileName;
    this.encrypt = encrypt ?? false;
  }

  async init(): Promise<boolean> {
    const hwid = (await getHWID()) ?? 'recorderinsandybridge';

    this.crypto = new Crypto(hwid);

    const homeDir = await path.homeDir();
    const folderPath = await path.join(homeDir, '.ezpplauncher');
    this.configFilePath = await path.join(folderPath, this.fileName);

    const createFolder = !(await exists(folderPath));
    if (createFolder) await mkdir(folderPath);

    const configExists = await exists(this.configFilePath);
    if (!configExists) return true;

    await this.load();
    return false;
  }

  private async load() {
    if (!this.configFilePath) throw Error('configFilePath not set');
    if (this.encrypt && !this.crypto) throw Error('crypto not initialized');

    const fileStream = await readTextFile(this.configFilePath);
    try {
      const decryptedJSON = JSON.parse(
        this.encrypt && this.crypto ? this.crypto.decrypt(fileStream) : fileStream
      ) as Record<string, unknown>;
      this.config = decryptedJSON;
    } catch (err) {
      console.log(err);
      this.config = {};
      await this.save();
    }
  }

  async save() {
    if (!this.configFilePath) throw Error('configFilePath not set');
    if (this.encrypt && !this.crypto) throw Error('crypto not initialized');
    const encryptedJSON =
      this.encrypt && this.crypto
        ? this.crypto.encrypt(JSON.stringify(this.config))
        : JSON.stringify(this.config);

    await writeFile(this.configFilePath, Buffer.from(encryptedJSON), {
      append: false,
    });
  }

  value(key: string) {
    return {
      set: <T>(val: T) => {
        this.config[key] = val;
      },
      get: <T>(fallback: T): T => {
        return (this.config[key] as T) ?? fallback;
      },
      del: () => {
        delete this.config[key];
      },
    };
  }
}
