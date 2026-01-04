import fs from 'fs';
import path from 'path';
import * as toml from '@iarna/toml';
import { cwd } from 'process';

const packageJsonPath = path.join(cwd(), 'package.json');
const cargoTomlPath = path.join(cwd(), 'src-tauri', 'Cargo.toml');
const tauriConfPath = path.join(cwd(), 'src-tauri', 'tauri.conf.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
if (!version) throw new Error('Could not find version in package.json');

let cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
const cargo = toml.parse(cargoTomlContent) as { package: { version: string } };

if (cargo.package.version !== version) {
  cargoTomlContent = cargoTomlContent.replace(/version = ".*?"/, `version = "${version}"`);
  fs.writeFileSync(cargoTomlPath, cargoTomlContent);
  console.log(`✅ Synced Cargo.toml version to ${version}`);
}

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
if (tauriConf.version !== version) {
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));
  console.log(`✅ Synced tauri.conf.json version to ${version}`);
}
