import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  readTextFile,
  writeFile,
} from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { Crypto } from './crypto';
import { enc } from 'crypto-js';

export class Config {
  private config: Record<string, unknown> = {};
  private crypto: Crypto | undefined;
  private configFilePath: string | undefined;

  async init() {
    const hwid: string = (await invoke('get_hwid')) ?? 'recorderinsandybridge';

    this.crypto = new Crypto(hwid);

    const homeDir = await path.homeDir();
    const folderPath = await path.join(homeDir, '.ezpplauncher');
    this.configFilePath = await path.join(folderPath, 'user_settings');

    const createFolder = !(await exists(folderPath));
    if (createFolder) await mkdir(folderPath);

    const createConfig = !(await exists(this.configFilePath));
    if (createConfig) await this.save();
    else await this.load();
  }

  private async load() {
    if (!this.configFilePath) throw Error('configFilePath not set');
    if (!this.crypto) throw Error('crypto not initialized');

    const fileStream = await readTextFile(this.configFilePath);
    try {
      const decryptedJSON = JSON.parse(this.crypto.decrypt(fileStream)) as Record<string, unknown>;
      this.config = decryptedJSON;
      console.log('config file loaded');
      console.log(JSON.stringify(this.config));
    } catch (err) {
      console.log('failed to read file');
      this.config = {};
      await this.save();
    }
  }

  async save() {
    if (!this.configFilePath) throw Error('configFilePath not set');
    if (!this.crypto) throw Error('crypto not initialized');
    const encryptedJSON = this.crypto.encrypt(JSON.stringify(this.config));

    console.log(this.config);
    console.log('saving file...');
    console.log(encryptedJSON);
    await writeFile(this.configFilePath, Buffer.from(encryptedJSON), {
      append: false,
    });
  }

  value(key: string) {
    console.log(this.config);
    return {
      set: <T>(val: T) => {
        this.config[key] = val;
      },
      get: <T>(fallback: T): T => {
        return (this.config[key] as T) ?? fallback;
      },
    };
  }
}
