import fs from 'fs';
import path from 'path';
import * as toml from '@iarna/toml';
import { cwd } from 'process';

const cargoTomlPath = path.join(cwd(), 'src-tauri', 'Cargo.toml');
const tauriConfPath = path.join(cwd(), 'src-tauri', 'tauri.conf.json');

const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
const cargo = toml.parse(cargoToml) as Record<string, string>;

const version = cargo.package['version'];
if (!version) throw new Error('Could not find version in Cargo.toml');

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
if (tauriConf.version !== version) {
  tauriConf.version = version;

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));
  console.log(`✅ Synced tauri.conf.json version to ${version}`);
}
