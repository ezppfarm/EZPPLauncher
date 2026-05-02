import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { active_custom_theme, custom_themes } from './global';
import { setGlobalVolume } from './utils';
import { betterFetch } from '@better-fetch/fetch';
import zip from 'jszip';
import { SemVer } from 'semver';

export type Theme = {
  name: string;
  version: string;
  author: string;
  scriptUrl: string;
  assets: string;
  preview: string;
  status: 'installed' | 'downloading' | 'extracting' | 'not-installed';
  progress: number;
  updateAvailable: boolean;
};

export const getDownloadableThemes = async () => {
  const themes: Theme[] = [];

  const downloadableThemes = await betterFetch<
    {
      name: string;
      version: string;
      author: string;
    }[]
  >('https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes.json', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    },
  });
  if (downloadableThemes.data) {
    for (const theme of downloadableThemes.data) {
      themes.push({
        name: theme.name,
        version: theme.version,
        author: theme.author,
        scriptUrl: '',
        assets: '',
        preview: `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/${toSafeName(theme.name)}.png`,
        status: 'not-installed',
        progress: 0,
        updateAvailable: false,
      });
    }
  } else {
    console.error('Failed to fetch downloadable themes');
    console.error(downloadableThemes.error);
  }
  return themes;
};

export const getThemes = async (): Promise<Theme[]> => {
  const themes: Theme[] = [];
  themes.push({
    author: 'EZPPFarm',
    name: 'Default',
    version: '1.0.0',
    scriptUrl: '',
    assets: '',
    preview: '',
    status: 'installed',
    progress: 0,
    updateAvailable: false,
  });
  const folderPath = await path.join(await path.homeDir(), '.ezpplauncher', 'themes');
  if (await fs.exists(folderPath)) {
    const themeFolders = await fs.readDir(folderPath);
    for (const themeFolder of themeFolders) {
      const themeFolderPath = await path.join(folderPath, themeFolder.name);
      const themeConfigFilePath = await path.join(folderPath, themeFolder.name, 'theme.json');
      if (await fs.exists(themeConfigFilePath)) {
        const themeConfig = await fs.readTextFile(themeConfigFilePath);
        const theme = JSON.parse(themeConfig) as {
          name: string;
          version: string;
          apiVersion: string;
          author: string;
          entry: string;
          style: string;
          preview: string;
        };
        const scriptFile = await path.join(folderPath, themeFolder.name, theme.entry);
        if (await fs.exists(scriptFile)) {
          themes.push({
            name: theme.name,
            version: theme.version,
            author: theme.author,
            scriptUrl: convertFileSrc(await path.normalize(`${themeFolderPath}/${theme.entry}`)),
            assets: convertFileSrc(await path.normalize(`${themeFolderPath}/assets`)),
            preview: convertFileSrc(
              await path.normalize(`${themeFolderPath}/assets/${theme.preview}`)
            ),
            status: 'installed',
            progress: 0,
            updateAvailable: false,
          });
        }
      }
    }
  }
  return themes;
};

function combineChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export const downloadTheme = async (theme: Theme, force = false): Promise<boolean> => {
  if (theme.status !== 'not-installed' && !force) return false;

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === theme.name);
    if (matchedTheme) {
      matchedTheme.status = 'downloading';
    }
    return themes;
  });
  const downloadUrl = `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/${toSafeName(
    theme.name
  )}.ezpplauncher-theme`;
  const downloadReq = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    },
  });

  if (!downloadReq.ok || downloadReq.body === null) {
    console.log(downloadUrl);
    custom_themes.update((themes) => {
      const matchedTheme = themes.find((t) => t.name === theme.name);
      if (matchedTheme) {
        matchedTheme.status = 'not-installed';
      }
      return themes;
    });
    return false;
  }
  const total = Number(downloadReq.headers.get('content-length')) || 0;
  const reader = downloadReq.body.getReader();
  let received = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const progress = received / total;
    custom_themes.update((themes) => {
      const matchedTheme = themes.find((t) => t.name === theme.name);
      if (matchedTheme) {
        matchedTheme.progress = progress;
      }
      return themes;
    });
  }

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === theme.name);
    if (matchedTheme) {
      matchedTheme.status = 'extracting';
    }
    return themes;
  });
  const baseThemeFolder = await path.join(await path.homeDir(), '.ezpplauncher', 'themes');
  const themeFolder = await path.join(baseThemeFolder, toSafeName(theme.name));
  if (!(await fs.exists(baseThemeFolder))) await fs.mkdir(baseThemeFolder, { recursive: true });
  if (!(await fs.exists(themeFolder))) await fs.mkdir(themeFolder, { recursive: true });

  const zipFile = await zip.loadAsync(combineChunks(chunks, total));
  const totalFiles = Object.keys(zipFile.files).length;
  let extractedFiles = 0;
  for (const zipEntry of Object.keys(zipFile.files)) {
    const file = zipFile.file(zipEntry);
    if (file) {
      try {
        const fileData = await file.async('uint8array');
        const filePath = await path.join(themeFolder, zipEntry);
        const dirPath = await path.dirname(filePath);
        if (!(await fs.exists(dirPath))) await fs.mkdir(dirPath, { recursive: true });
        await new Promise((res) => setTimeout(res, 250));
        await fs.writeFile(filePath, fileData);
        extractedFiles++;
        custom_themes.update((themes) => {
          const matchedTheme = themes.find((t) => t.name === theme.name);
          if (matchedTheme) {
            matchedTheme.progress = extractedFiles / totalFiles;
          }
          return themes;
        });
      } catch (err) {
        console.log(err);
      }
    }
  }
  const themeInfo = await fs.readTextFile(await path.join(themeFolder, 'theme.json'));
  const themeInfoObj = JSON.parse(themeInfo) as {
    name: string;
    version: string;
    apiVersion: string;
    author: string;
    entry: string;
    style: string;
    preview: string;
  };
  const themeScriptUrl = convertFileSrc(
    await path.normalize(`${themeFolder}/${themeInfoObj.entry}`)
  );
  const themeAssets = convertFileSrc(await path.normalize(`${themeFolder}/assets`));
  const themePreview = convertFileSrc(
    await path.normalize(`${themeFolder}/assets/${themeInfoObj.preview}`)
  );

  const downloadableThemes = await getDownloadableThemes();
  custom_themes.update((themes) => {
    const reloadedThemes = [...themes];
    for (const theme of downloadableThemes) {
      if (!reloadedThemes.find((t) => t.name === theme.name)) reloadedThemes.push(theme);

      const installedTheme = reloadedThemes.find((t) => t.name === theme.name);
      if (installedTheme) {
        const installedThemeVersion = new SemVer(installedTheme.version);
        const downloadableThemeVersion = new SemVer(theme.version);
        if (downloadableThemeVersion.compare(installedThemeVersion) > 0) {
          installedTheme.updateAvailable = true;
          const index = reloadedThemes.findIndex((t) => t.name === theme.name);
          reloadedThemes[index] = installedTheme;
        }
      }
    }
    for (const installedThemes of reloadedThemes) {
      if (installedThemes.name === theme.name) {
        installedThemes.name = themeInfoObj.name;
        installedThemes.author = themeInfoObj.author;
        installedThemes.version = themeInfoObj.version;
        installedThemes.scriptUrl = themeScriptUrl;
        installedThemes.assets = themeAssets;
        installedThemes.preview = themePreview;
        installedThemes.status = 'installed';
      }
    }
    return reloadedThemes.sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      if (a.status === 'installed' && b.status !== 'installed') return -1;
      if (a.status !== 'installed' && b.status === 'installed') return 1;
      return a.name.localeCompare(b.name);
    });
  });
  return true;
};

export const loadTheme = async (theme: Theme, themeContainer: HTMLElement, volume = 0.15) => {
  active_custom_theme.set(theme);
  themeContainer.innerHTML = '';
  if (theme.scriptUrl.length > 0) {
    const themeScript = await import(theme.scriptUrl);
    /* @vite-ignore */
    themeScript.mountTheme(themeContainer, { assets: theme.assets });
  }
  setGlobalVolume(volume);
};

export const deleteTheme = async (themeToUninstall: Theme) => {
  if (themeToUninstall.status !== 'installed') return false;
  const baseThemeFolder = await path.join(await path.homeDir(), '.ezpplauncher', 'themes');
  if (!(await fs.exists(baseThemeFolder))) return false;
  const themeFolder = await path.join(baseThemeFolder, toSafeName(themeToUninstall.name));
  if (!(await fs.exists(themeFolder))) return false;
  await fs.remove(themeFolder, { recursive: true });
  const downloadableThemes = await getDownloadableThemes();
  custom_themes.update((themes) => {
    const reloadedThemes = [...themes];
    for (const theme of downloadableThemes) {
      if (theme.name === themeToUninstall.name) {
        const themeIndex = reloadedThemes.findIndex((t) => t.name === theme.name);
        reloadedThemes.splice(themeIndex, 1);
        reloadedThemes.push(theme);
      }

      const installedTheme = reloadedThemes.find((t) => t.name === theme.name);
      if (installedTheme) {
        const installedThemeVersion = new SemVer(installedTheme.version);
        const downloadableThemeVersion = new SemVer(theme.version);
        if (downloadableThemeVersion.compare(installedThemeVersion) > 0) {
          installedTheme.updateAvailable = true;
          const index = reloadedThemes.findIndex((t) => t.name === theme.name);
          reloadedThemes[index] = installedTheme;
        }
      }
    }
    return reloadedThemes.sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      if (a.status === 'installed' && b.status !== 'installed') return -1;
      if (a.status !== 'installed' && b.status === 'installed') return 1;
      return a.name.localeCompare(b.name);
    });
  });
  return true;
};

export const toSafeName = (name: string) => {
  return (
    name
      .toLowerCase()
      .replace(/[<>:"/\\|?*]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '_')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/[. ]+$/g, '')
  );
};
