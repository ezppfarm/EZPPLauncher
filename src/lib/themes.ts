import { active_custom_theme, custom_themes } from './global';
import { calculateGitBlobSha, setGlobalVolume } from './utils';
import { betterFetch } from '@better-fetch/fetch';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import zip from 'jszip';
import { SemVer } from 'semver';

export type Theme = {
  folder_name: string;
  name: string;
  version: string;
  author: string;
  scriptUrl: string;
  assets: string;
  preview: string;
  status: 'installed' | 'downloading' | 'extracting' | 'deleting' | 'not-installed';
  progress: number;
  updateAvailable: boolean;
};

export type ThemeInfo = {
  name: string;
  version: string;
  apiVersion: string;
  author: string;
  entry: string;
  style: string;
  preview: string;
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
        folder_name: `${toSafeName(theme.name)}-${generateRandomString(16)}`,
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
    folder_name: 'default',
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
        const theme = JSON.parse(themeConfig) as ThemeInfo;
        const scriptFile = await path.join(folderPath, themeFolder.name, theme.entry);
        if (await fs.exists(scriptFile)) {
          themes.push({
            folder_name: themeFolder.name,
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

export const downloadTheme = async (
  theme: Theme,
  force = false
): Promise<{ success: boolean; error?: string }> => {
  if (theme.status !== 'not-installed' && !force) return { success: false };

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === theme.name);
    if (matchedTheme) {
      matchedTheme.status = 'downloading';
    }
    return themes;
  });
  const themeFileName = `${toSafeName(theme.name)}.ezpplauncher-theme`;
  const themeContents = await betterFetch<{
    file_contents: {
      sha: string;
      download_url: string;
    };
  }>(
    `https://git.ez-pp.farm/api/v1/repos/EZPPFarm/EZPPLauncher-Themes/contents-ext/themes/${themeFileName}?ref=main`
  );
  if (themeContents.error) {
    custom_themes.update((themes) => {
      const matchedTheme = themes.find((t) => t.name === theme.name);
      if (matchedTheme) {
        matchedTheme.status = 'not-installed';
      }
      return themes;
    });
    return {
      success: false,
      error: themeContents.error.message ?? 'An unknown error occurred',
    };
  }
  const downloadUrl = `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/${themeFileName}`;
  const downloadReq = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    },
  });

  if (!downloadReq.ok || downloadReq.body === null) {
    custom_themes.update((themes) => {
      const matchedTheme = themes.find((t) => t.name === theme.name);
      if (matchedTheme) {
        matchedTheme.status = 'not-installed';
      }
      return themes;
    });
    return {
      success: false,
      error: 'Failed to download theme file.',
    };
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

  const fileBuffer = combineChunks(chunks, total);

  const sha = calculateGitBlobSha(Buffer.from(fileBuffer));
  if (sha !== themeContents.data.file_contents.sha) {
    custom_themes.update((themes) => {
      const matchedTheme = themes.find((t) => t.name === theme.name);
      if (matchedTheme) {
        matchedTheme.status = 'not-installed';
      }
      return themes;
    });
    return {
      success: false,
      error: 'Failed to verify downloaded theme file hash.',
    };
  }

  //TODO: check file hash

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

  const zipFile = await zip.loadAsync(fileBuffer);
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
        custom_themes.update((themes) => {
          const matchedTheme = themes.find((t) => t.name === theme.name);
          if (matchedTheme) {
            matchedTheme.status = 'not-installed';
          }
          return themes;
        });
        return {
          success: false,
          error: 'Failed to extract theme file.',
        };
      }
    }
  }
  const themeInfo = await fs.readTextFile(await path.join(themeFolder, 'theme.json'));
  const themeInfoObj = JSON.parse(themeInfo) as ThemeInfo;
  const themeScriptUrl = convertFileSrc(
    await path.normalize(`${themeFolder}/${themeInfoObj.entry}`)
  );
  const themeAssets = convertFileSrc(await path.normalize(`${themeFolder}/assets`));
  const themePreview = convertFileSrc(
    await path.normalize(`${themeFolder}/assets/${themeInfoObj.preview}`)
  );

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === theme.name);
    if (matchedTheme) {
      matchedTheme.scriptUrl = themeScriptUrl;
      matchedTheme.assets = themeAssets;
      matchedTheme.preview = themePreview;
      matchedTheme.status = 'installed';
      matchedTheme.progress = 1;
    }
    return themes;
  });

  await reloadThemes();
  return {
    success: true,
  };
};

export const loadTheme = async (theme: Theme, themeContainer: HTMLElement, volume = 0.15) => {
  active_custom_theme.set(theme);
  themeContainer.innerHTML = '';
  if (theme.scriptUrl.length > 0) {
    const themeScript = await import(/* @vite-ignore */ theme.scriptUrl);
    themeScript.mountTheme(themeContainer, { assets: theme.assets });
  }
  setGlobalVolume(volume);
};

export const deleteTheme = async (themeToUninstall: Theme) => {
  if (themeToUninstall.status !== 'installed') return false;
  const baseThemeFolder = await path.join(await path.homeDir(), '.ezpplauncher', 'themes');
  if (!(await fs.exists(baseThemeFolder))) return false;
  const themeFolder = await path.join(baseThemeFolder, themeToUninstall.folder_name);
  if (!(await fs.exists(themeFolder))) return false;
  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === themeToUninstall.name);
    if (matchedTheme) {
      matchedTheme.status = 'deleting';
    }
    return themes;
  });
  await fs.remove(themeFolder, { recursive: true });

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === themeToUninstall.name);
    if (matchedTheme) {
      matchedTheme.scriptUrl = '';
      matchedTheme.assets = '';
      matchedTheme.preview = `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/${toSafeName(themeToUninstall.name)}.png`;
      matchedTheme.status = 'not-installed';
      matchedTheme.updateAvailable = false;
    }
    return themes;
  });

  await reloadThemes();
  return true;
};

export const checkThemeFromFile = async (filePath: string) => {
  const normalizedFilePath = await path.normalize(filePath);
  if (!(await fs.exists(normalizedFilePath))) {
    return {
      success: false,
      error: 'File not found',
    };
  }
  const fileBuffer = await fs.readFile(normalizedFilePath);

  let themeInfo: ThemeInfo | undefined = undefined;

  try {
    const zipFile = await zip.loadAsync(fileBuffer);

    const themeConfig = zipFile.file('theme.json');
    if (!themeConfig) {
      return {
        success: false,
        error: 'Theme config file not found',
      };
    }
    const themeConfigData = await themeConfig.async('string');
    themeInfo = JSON.parse(themeConfigData) as {
      name: string;
      version: string;
      apiVersion: string;
      author: string;
      entry: string;
      style: string;
      preview: string;
    };
  } catch (err) {
    console.log(err);
    return {
      success: false,
      error: 'Could not read theme file',
    };
  }

  return {
    success: !!themeInfo,
    themeInfo,
  };
};

export const importThemeFromFile = async (themeName: string, filePath: string) => {
  const baseThemeFolder = await path.join(await path.homeDir(), '.ezpplauncher', 'themes');
  const themeFolder = await path.join(baseThemeFolder, toSafeName(themeName));
  if (!(await fs.exists(baseThemeFolder))) await fs.mkdir(baseThemeFolder, { recursive: true });
  if (!(await fs.exists(themeFolder))) await fs.mkdir(themeFolder, { recursive: true });

  const fileBuffer = await fs.readFile(filePath);
  const zipFile = await zip.loadAsync(fileBuffer);
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
      } catch (err) {
        console.log(err);
        return {
          success: false,
          error: 'Failed to extract theme file.',
        };
      }
    }
  }

  const themeInfo = await fs.readTextFile(await path.join(themeFolder, 'theme.json'));
  const themeInfoObj = JSON.parse(themeInfo) as ThemeInfo;
  const themeScriptUrl = convertFileSrc(
    await path.normalize(`${themeFolder}/${themeInfoObj.entry}`)
  );
  const themeAssets = convertFileSrc(await path.normalize(`${themeFolder}/assets`));
  const themePreview = convertFileSrc(
    await path.normalize(`${themeFolder}/assets/${themeInfoObj.preview}`)
  );

  custom_themes.update((themes) => {
    const matchedTheme = themes.find((t) => t.name === themeInfoObj.name);
    if (matchedTheme) {
      matchedTheme.scriptUrl = themeScriptUrl;
      matchedTheme.assets = themeAssets;
      matchedTheme.preview = themePreview;
      matchedTheme.status = 'installed';
      matchedTheme.progress = 1;
    }
    return themes;
  });

  await reloadThemes();
  return {
    success: true,
  };
};

export const reloadThemes = async () => {
  const [downloadableThemes, installedThemes] = await Promise.all([
    getDownloadableThemes(),
    getThemes(),
  ]);

  const installedMap = new Map(installedThemes.map((t) => [t.name, t]));
  const combinedMap = new Map(installedThemes.map((t) => [t.name, { ...t }]));

  for (const downloadable of downloadableThemes) {
    const installed = installedMap.get(downloadable.name);

    if (installed) {
      if (new SemVer(downloadable.version).compare(new SemVer(installed.version)) > 0) {
        combinedMap.get(downloadable.name)!.updateAvailable = true;
      }
    } else {
      combinedMap.set(downloadable.name, downloadable);
    }
  }

  const combinedThemes = [...combinedMap.values()];

  custom_themes.update((storeThemes) => {
    const storeMap = new Map(storeThemes.map((t) => [t.name, t]));
    const ACTIVE_STATUSES = new Set(['downloading', 'extracting', 'deleting']);

    for (const theme of combinedThemes) {
      const storeTheme = storeMap.get(theme.name);
      if (!storeTheme || ACTIVE_STATUSES.has(storeTheme.status)) continue;

      storeTheme.scriptUrl = theme.scriptUrl;
      storeTheme.assets = theme.assets;
      storeTheme.preview = theme.preview;
      storeTheme.version = theme.version;
      storeTheme.author = theme.author;
      storeTheme.updateAvailable = theme.updateAvailable;
    }

    const newThemes = combinedThemes.filter((t) => !storeMap.has(t.name));
    const merged = [...storeThemes, ...newThemes];

    return merged.sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      if (a.status === 'installed' && b.status !== 'installed') return -1;
      if (a.status !== 'installed' && b.status === 'installed') return 1;
      return a.name.localeCompare(b.name);
    });
  });
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
      .replace(/[. ]+$/g, '_')
  );
};

const generateRandomString = (length: number) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join('');
};
