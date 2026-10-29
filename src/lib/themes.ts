import { active_custom_theme, custom_theme_audio_playing, custom_themes } from './global';
import { clearThemeMediaCache } from './themeMedia';
import { isThemeV2, normalizeThemeV2, type ThemeV2Asset, type ThemeV2Definition } from './themeV2';
import { disableMediaControls, setGlobalVolume } from './utils';
import { betterFetch } from '@better-fetch/fetch';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { SemVer } from 'semver';

export type Theme = {
  folder_name: string;
  name: string;
  version: string;
  apiVersion: string;
  author: string;
  description: string;
  nsfw: boolean;
  scriptUrl: string;
  cssStyle: string;
  assets: string;
  preview: string;
  status: 'installed' | 'downloading' | 'extracting' | 'deleting' | 'not-installed';
  progress: number;
  updateAvailable: boolean;
  /** The version available in the repository when an update is pending. */
  availableVersion?: string;
  definition?: ThemeV2Definition;
  backups?: ThemeBackup[];
};

export type ThemeBackup = {
  path: string;
  label: string;
  createdAt: number;
  size: number;
};

export type ThemeInfo = {
  name: string;
  version?: string;
  apiVersion?: string;
  author?: string;
  description?: string;
  nsfw?: boolean;
  entry?: string;
  style?: string;
  preview?: string;
};

type DownloadProgress = {
  theme_name: string;
  received: number;
  total: number;
  progress: number;
};

type ExtractProgress = {
  theme_name: string;
  total: number;
  extracted: number;
  progress: number;
  current_file: string;
};

const THEME_REPOSITORY = 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes';

let themeAssetBasePromise: Promise<string> | undefined;

/**
 * Linux cannot load theme media from the custom asset protocol, so the native
 * side exposes a loopback HTTP base for theme files. Everywhere else this is
 * empty and the normal asset protocol is used.
 */
export const themeAssetBase = (): Promise<string> => {
  themeAssetBasePromise ??= invoke<string>('theme_asset_base').catch(() => '');
  return themeAssetBasePromise;
};

const encodeThemePath = (value: string) =>
  value
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const themesDirectory = async () =>
  await path.join(await path.homeDir(), '.ezpplauncher', 'themes');

/**
 * Replace a theme in the store instead of mutating it. The theme list is
 * rendered from a filtered derived list, and Svelte treats each item as
 * immutable there, so in-place mutation would not update the cards (e.g. the
 * download status and progress would stay at their initial values).
 */
const patchTheme = (name: string, patch: (theme: Theme) => Theme) => {
  custom_themes.update((themes) =>
    themes.map((theme) => (theme.name === name ? patch(theme) : theme))
  );
};

export const getDownloadableThemes = async () => {
  const themes: Theme[] = [];

  const downloadableThemes = await betterFetch<
    {
      name: string;
      version: string;
      author: string;
      apiVersion?: string;
      description?: string;
      nsfw?: boolean;
    }[]
  >(`${THEME_REPOSITORY}/raw/branch/main/themes.json`, {
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
        apiVersion: theme.apiVersion ?? '1.0',
        author: theme.author,
        description: theme.description ?? '',
        nsfw: theme.nsfw === true,
        scriptUrl: '',
        assets: '',
        preview: `${THEME_REPOSITORY}/raw/branch/main/previews/${toSafeName(theme.name)}.png`,
        status: 'not-installed',
        progress: 0,
        updateAvailable: false,
        cssStyle: '',
      });
    }
  } else {
    console.error('Failed to fetch downloadable themes');
    console.error(downloadableThemes.error);
  }
  return themes;
};

const themeFromFolder = async (
  folderName: string,
  folderPath: string
): Promise<Theme | undefined> => {
  const themeConfigFilePath = await path.join(folderPath, 'theme.json');
  if (!(await fs.exists(themeConfigFilePath))) return undefined;

  try {
    const themeConfig = await fs.readTextFile(themeConfigFilePath);
    const parsed = JSON.parse(themeConfig) as ThemeInfo & Partial<ThemeV2Definition>;
    if (!parsed.name) return undefined;

    const apiVersion = parsed.apiVersion ?? '1.0';
    const isV2 = isThemeV2(apiVersion);
    const definition = isV2
      ? normalizeThemeV2(parsed as unknown as Partial<ThemeV2Definition>)
      : undefined;

    const httpBase = await themeAssetBase();
    const httpFolder = httpBase ? `${httpBase}/${encodeURIComponent(folderName)}` : '';

    const entry = parsed.entry ?? '';
    let scriptUrl = '';
    if (!isV2 && entry) {
      const scriptFile = await path.join(folderPath, entry);
      if (!(await fs.exists(scriptFile))) return undefined;
      scriptUrl = httpFolder
        ? `${httpFolder}/${encodeThemePath(entry)}`
        : convertFileSrc(await path.normalize(scriptFile));
    }

    const style = parsed.style ?? '';
    let cssStyle = '';
    if (style) {
      const cssStylePath = await path.join(folderPath, style);
      if (await fs.exists(cssStylePath)) cssStyle = await fs.readTextFile(cssStylePath);
    }

    const assets = httpFolder
      ? `${httpFolder}/assets`
      : convertFileSrc(await path.normalize(await path.join(folderPath, 'assets')));
    const previewName = parsed.preview || (isV2 ? 'preview.png' : '');
    let preview = '';
    if (previewName) {
      const previewPath = await path.join(folderPath, 'assets', previewName);
      if (await fs.exists(previewPath)) {
        // The editor rewrites preview.png on every save. A cache-busting query
        // makes the WebView pick up the new file instead of its cached asset.
        preview = httpFolder
          ? `${httpFolder}/assets/${encodeThemePath(previewName)}?v=${Date.now()}`
          : `${convertFileSrc(await path.normalize(previewPath))}?v=${Date.now()}`;
      }
    }

    return {
      folder_name: folderName,
      name: parsed.name,
      version: parsed.version ?? '1.0.0',
      apiVersion,
      author: parsed.author ?? 'Unknown',
      description: parsed.description ?? '',
      nsfw: parsed.nsfw === true,
      scriptUrl,
      assets,
      preview,
      status: 'installed',
      progress: 0,
      updateAvailable: false,
      cssStyle,
      definition,
    };
  } catch (error) {
    console.error(`Failed to read theme ${folderName}`, error);
    return undefined;
  }
};

export const getThemes = async (): Promise<Theme[]> => {
  const themes: Theme[] = [];
  themes.push({
    folder_name: 'default',
    author: 'EZPPFarm',
    name: 'Default',
    version: '1.0.0',
    apiVersion: '1.0',
    description: 'The default EZPPLauncher look.',
    nsfw: false,
    scriptUrl: '',
    assets: '',
    preview: '',
    status: 'installed',
    progress: 0,
    updateAvailable: false,
    cssStyle: '',
  });

  const folderPath = await themesDirectory();
  if (await fs.exists(folderPath)) {
    const themeFolders = await fs.readDir(folderPath);
    for (const themeFolder of themeFolders) {
      // Finder drops .DS_Store into this folder; never let a stray file or an
      // unreadable package hide every other installed theme.
      if (!themeFolder.isDirectory || themeFolder.name.startsWith('.')) continue;

      const themeFolderPath = await path.join(folderPath, themeFolder.name);
      try {
        const theme = await themeFromFolder(themeFolder.name, themeFolderPath);
        if (theme) {
          try {
            theme.backups = await invoke<ThemeBackup[]>('list_theme_backups', {
              themeFolder: themeFolderPath,
            });
          } catch {
            theme.backups = [];
          }
          themes.push(theme);
        }
      } catch (error) {
        console.error(`Failed to load theme ${themeFolder.name}`, error);
      }
    }
  }
  return themes;
};

export const downloadTheme = async (
  theme: Theme,
  force = false
): Promise<{ success: boolean; error?: string }> => {
  if (theme.status !== 'not-installed' && !force) return { success: false };
  const wasInstalled = theme.status === 'installed';

  patchTheme(theme.name, (current) => ({ ...current, status: 'downloading' }));

  const themeFileName = `${toSafeName(theme.name)}.ezpplauncher-theme`;
  const themeContents = await betterFetch<{
    file_contents: { sha: string; download_url: string };
  }>(
    `https://git.ez-pp.farm/api/v1/repos/EZPPFarm/EZPPLauncher-Themes/contents-ext/themes/${themeFileName}?ref=main`
  );

  if (themeContents.error) {
    patchTheme(theme.name, (current) => ({
      ...current,
      status: wasInstalled ? 'installed' : 'not-installed',
    }));
    return {
      success: false,
      error: themeContents.error.message ?? 'An unknown error occurred',
    };
  }

  const baseThemeFolder = await themesDirectory();
  const folderName = toSafeName(theme.name);
  const themeFolder = await path.join(baseThemeFolder, folderName);
  if (!(await fs.exists(baseThemeFolder))) await fs.mkdir(baseThemeFolder, { recursive: true });
  if (!(await fs.exists(themeFolder))) await fs.mkdir(themeFolder, { recursive: true });

  const downloadUrl = `${THEME_REPOSITORY}/raw/branch/main/themes/${themeFileName}`;

  patchTheme(theme.name, (current) => ({
    ...current,
    status: 'downloading',
    progress: 0,
  }));

  let updateBackup: string | undefined;
  const restoreUpdateBackup = async () => {
    if (!updateBackup) return;
    try {
      await invoke('restore_theme_backup', {
        themeFolder,
        backupFolder: updateBackup,
      });
    } catch (error) {
      console.error('Could not restore the theme backup after a failed update', error);
    }
  };

  let extractionStartedAt = 0;
  const beginExtraction = (progress: number) => {
    if (extractionStartedAt === 0) extractionStartedAt = Date.now();

    patchTheme(theme.name, (current) => ({
      ...current,
      status: 'extracting',
      progress,
    }));
  };

  const unlistenDownload = await listen<DownloadProgress>('download_progress', (event) => {
    if (event.payload.theme_name !== theme.name) return;

    if (event.payload.total > 0 && event.payload.received >= event.payload.total) {
      beginExtraction(0);
      return;
    }

    patchTheme(theme.name, (current) => ({
      ...current,
      status: 'downloading',
      progress: event.payload.progress,
    }));
  });

  const unlistenExtract = await listen<ExtractProgress>('extract_progress', (event) => {
    if (event.payload.theme_name !== theme.name) return;
    beginExtraction(event.payload.progress);
  });

  try {
    // Keep the currently installed files before an update overwrites them.
    // The backup also covers a failed/partial download so the user can roll back.
    if (theme.status === 'installed') {
      try {
        updateBackup = await invoke<string>('backup_theme_folder', { themeFolder });
      } catch (error) {
        console.warn('Could not back up the theme before updating it', error);
      }
    }

    await invoke('download_and_extract_theme', {
      downloadUrl,
      expectedSha: themeContents.data.file_contents.sha,
      themeFolder,
      themeName: theme.name,
    });
  } catch (err) {
    console.log(err);
    const erro = err as Error;
    await restoreUpdateBackup();
    patchTheme(theme.name, (current) => ({
      ...current,
      status: wasInstalled ? 'installed' : 'not-installed',
    }));
    return { success: false, error: erro.message || 'Failed to download or extract theme.' };
  } finally {
    unlistenDownload();
    unlistenExtract();
  }

  // Small themes can extract in a few milliseconds, before the webview paints
  // the extracting state. Keep it visible long enough to be readable, while
  // still letting large themes finish naturally.
  if (extractionStartedAt === 0) {
    beginExtraction(0);
  }

  const minimumExtractionMs = 700;
  const elapsed = Date.now() - extractionStartedAt;
  if (elapsed < minimumExtractionMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumExtractionMs - elapsed));
  }

  const installedTheme = await themeFromFolder(folderName, themeFolder);
  if (!installedTheme) {
    await restoreUpdateBackup();
    patchTheme(theme.name, (current) => ({
      ...current,
      status: wasInstalled ? 'installed' : 'not-installed',
    }));
    return { success: false, error: 'The downloaded theme package is invalid.' };
  }

  patchTheme(theme.name, (current) => ({
    ...current,
    ...installedTheme,
    status: 'installed',
    progress: 1,
  }));

  await reloadThemes();
  return { success: true };
};

export const loadTheme = async (theme: Theme, themeContainer: HTMLElement, volume = 0.15) => {
  // Theme media is buffered as blob URLs; the previous theme's URLs are no
  // longer needed once it is replaced.
  clearThemeMediaCache();
  active_custom_theme.set(theme);
  custom_theme_audio_playing.set(false);
  themeContainer.innerHTML = '';
  if (theme.definition) {
    setGlobalVolume(volume);
    disableMediaControls();
    return;
  }
  if (theme.scriptUrl.length > 0) {
    const themeScript = await import(/* @vite-ignore */ theme.scriptUrl);
    themeScript.mountTheme(themeContainer, { assets: theme.assets });
  }
  setGlobalVolume(volume);
  disableMediaControls();
};

export const deleteTheme = async (themeToUninstall: Theme) => {
  if (themeToUninstall.status !== 'installed') {
    return false;
  }
  const baseThemeFolder = await themesDirectory();
  if (!(await fs.exists(baseThemeFolder))) {
    return false;
  }
  const themeFolder = await path.join(baseThemeFolder, themeToUninstall.folder_name);
  if (!(await fs.exists(themeFolder))) {
    return false;
  }
  patchTheme(themeToUninstall.name, (current) => ({ ...current, status: 'deleting' }));
  await fs.remove(themeFolder, { recursive: true });

  patchTheme(themeToUninstall.name, (current) => ({
    ...current,
    scriptUrl: '',
    cssStyle: '',
    assets: '',
    definition: undefined,
    preview: `${THEME_REPOSITORY}/raw/branch/main/previews/${toSafeName(themeToUninstall.name)}.png`,
    status: 'not-installed',
    updateAvailable: false,
  }));

  await reloadThemes();
  return true;
};

export const checkThemeFromFile = async (filePath: string) => {
  const normalizedFilePath = await path.normalize(filePath);
  if (!(await fs.exists(normalizedFilePath))) {
    return { success: false, error: 'File not found' };
  }

  try {
    const themeInfo = await invoke<ThemeInfo>('read_theme_info', {
      filePath: normalizedFilePath,
    });
    return { success: true, themeInfo };
  } catch (err) {
    console.log(err);
    return { success: false, error: 'Could not read theme file' };
  }
};

export const importThemeFromFile = async (themeName: string, filePath: string) => {
  const baseThemeFolder = await themesDirectory();
  const themeFolder = await path.join(baseThemeFolder, toSafeName(themeName));
  if (!(await fs.exists(baseThemeFolder))) await fs.mkdir(baseThemeFolder, { recursive: true });
  if (!(await fs.exists(themeFolder))) await fs.mkdir(themeFolder, { recursive: true });

  const unlisten = await listen<ExtractProgress>('extract_progress', (event) => {
    if (event.payload.theme_name !== themeName) return;
    patchTheme(themeName, (current) => ({ ...current, progress: event.payload.progress }));
  });

  try {
    await invoke('extract_theme', {
      filePath,
      themeFolder,
      themeName,
    });
  } catch (err) {
    console.log(err);
    return { success: false, error: 'Failed to extract theme file.' };
  } finally {
    unlisten();
  }

  if (!(await themeFromFolder(toSafeName(themeName), themeFolder))) {
    return { success: false, error: 'The theme package is missing its theme.json or entry file.' };
  }

  await reloadThemes();
  return { success: true };
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
      try {
        if (new SemVer(downloadable.version).compare(new SemVer(installed.version)) > 0) {
          const installedTheme = combinedMap.get(downloadable.name)!;
          installedTheme.updateAvailable = true;
          installedTheme.availableVersion = downloadable.version;
        }
      } catch {
        // Ignore malformed versions instead of breaking the whole theme list.
      }
    } else {
      combinedMap.set(downloadable.name, downloadable);
    }
  }

  const combinedThemes = [...combinedMap.values()];

  custom_themes.update((storeThemes) => {
    const storeMap = new Map(storeThemes.map((t) => [t.name, t]));
    const ACTIVE_STATUSES = new Set(['downloading', 'extracting', 'deleting']);

    const updatedThemes = storeThemes.map((storeTheme) => {
      if (ACTIVE_STATUSES.has(storeTheme.status)) return storeTheme;
      const theme = combinedMap.get(storeTheme.name);
      if (!theme) return storeTheme;

      // Replace the object rather than mutating it so the theme cards see the
      // new values when the list is rendered from a filtered derived array.
      return {
        ...storeTheme,
        scriptUrl: theme.scriptUrl,
        assets: theme.assets,
        preview: theme.preview,
        version: theme.version,
        author: theme.author,
        apiVersion: theme.apiVersion,
        description: theme.description,
        nsfw: theme.nsfw,
        definition: theme.definition,
        updateAvailable: theme.updateAvailable,
        availableVersion: theme.availableVersion,
        cssStyle: theme.cssStyle,
        backups: theme.backups ?? storeTheme.backups,
      };
    });

    const newThemes = combinedThemes.filter((t) => !storeMap.has(t.name));
    const merged = [...updatedThemes, ...newThemes];

    return merged.sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      if (a.status === 'installed' && b.status !== 'installed') return -1;
      if (a.status !== 'installed' && b.status === 'installed') return 1;
      return a.name.localeCompare(b.name);
    });
  });

  active_custom_theme.update((active) => {
    if (!active) return active;
    const updated = combinedMap.get(active.name);
    return updated ? { ...active, ...updated } : active;
  });
};

export const saveThemeProject = async (
  folderName: string,
  definition: ThemeV2Definition,
  assets: ThemeV2Asset[] = []
) => {
  const themeFolder = await path.join(await themesDirectory(), folderName);
  await invoke('save_theme_project', {
    themeFolder,
    config: JSON.stringify(definition, null, 2),
    assets,
  });
  return themeFolder;
};

export const exportThemeFolder = async (folderName: string, destinationPath: string) => {
  const themeFolder = await path.join(await themesDirectory(), folderName);
  await invoke('export_theme', { themeFolder, destinationPath });
};

export const listThemeBackups = async (themeFolder: string) =>
  await invoke<ThemeBackup[]>('list_theme_backups', { themeFolder });

export const restoreThemeBackup = async (themeFolder: string, backupFolder: string) =>
  await invoke('restore_theme_backup', { themeFolder, backupFolder });

export const exportTheme = async (theme: Theme, destinationPath: string) =>
  exportThemeFolder(theme.folder_name, destinationPath);

export const openThemesFolder = async () => {
  const folder = await themesDirectory();
  await invoke('open_theme_folder', { themeFolder: folder });
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
