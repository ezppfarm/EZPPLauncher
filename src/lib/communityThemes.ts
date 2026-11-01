import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { config } from './config';
import { reloadThemes, themesDirectory } from './themes';

export interface CommunityThemeAuthor {
  id: number;
  name: string;
  donor: boolean;
  avatarUrl: string;
}

export interface CommunityTheme {
  id: string;
  name: string;
  description: string;
  version: string;
  apiVersion: string;
  hasExecutableCode: boolean;
  fileSize: number;
  checksumSha256: string;
  downloadCount: number;
  likeCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: CommunityThemeAuthor;
  isLiked: boolean;
  previewUrl: string;
  downloadUrl: string;
}

export interface CommunityThemesResponse {
  items: CommunityTheme[];
  total: number;
  page: number;
  totalPages: number;
}

export const LEGACY_COMMUNITY_THEMES: CommunityTheme[] = [
  {
    id: 'execution_clap',
    name: 'Execution Clap',
    description: '',
    version: '1.0.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 59213509,
    checksumSha256: '',
    downloadCount: 142,
    likeCount: 28,
    tags: ['legacy', 'apiv1', 'video', 'anime'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/execution_clap.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/execution_clap.ezpplauncher-theme',
  },
  {
    id: 'dance',
    name: 'Dance',
    description: '',
    version: '1.0.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 21956554,
    checksumSha256: '',
    downloadCount: 98,
    likeCount: 19,
    tags: ['legacy', 'apiv1', 'video', 'anime'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/dance.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/dance.ezpplauncher-theme',
  },
  {
    id: 'lagtrain',
    name: 'Lagtrain',
    description: '',
    version: '1.1.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 45781440,
    checksumSha256: '',
    downloadCount: 230,
    likeCount: 54,
    tags: ['legacy', 'apiv1', 'video', 'anime'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/lagtrain.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/lagtrain.ezpplauncher-theme',
  },
  {
    id: 'looping_the_rooms',
    name: 'Looping the Rooms',
    description: '',
    version: '1.0.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 14507000,
    checksumSha256: '',
    downloadCount: 76,
    likeCount: 14,
    tags: ['legacy', 'apiv1', 'video'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/looping_the_rooms.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/looping_the_rooms.ezpplauncher-theme',
  },
  {
    id: 'daidaidaidaidaikirai',
    name: 'Daidaidaidaidaikirai',
    description: '',
    version: '1.1.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 19800000,
    checksumSha256: '',
    downloadCount: 185,
    likeCount: 41,
    tags: ['legacy', 'apiv1', 'video', 'anime'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/daidaidaidaidaikirai.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/daidaidaidaidaikirai.ezpplauncher-theme',
  },
  {
    id: 'teto_the_31st',
    name: 'Teto the 31st',
    description: '',
    version: '1.1.0',
    apiVersion: '1.0',
    hasExecutableCode: true,
    fileSize: 23400000,
    checksumSha256: '',
    downloadCount: 310,
    likeCount: 82,
    tags: ['legacy', 'apiv1', 'video', 'anime'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: {
      id: 1001,
      name: 'HorizonCode',
      donor: true,
      avatarUrl: 'https://a.ez-pp.farm/1001',
    },
    isLiked: false,
    previewUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/previews/teto_the_31st.png',
    downloadUrl: 'https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/teto_the_31st.ezpplauncher-theme',
  },
];

const DEFAULT_THEMES_SERVICE_URL = 'http://127.0.0.1:3000';
let cachedSessionToken: string | null = null;

export async function getThemesServiceUrl(): Promise<string> {
  const customUrl = await config.value<string>('themes_service_url').get('');
  return customUrl.trim().length > 0 ? customUrl.trim().replace(/\/+$/, '') : DEFAULT_THEMES_SERVICE_URL;
}

/**
 * Returns authentication headers using stored username and password,
 * plus session token if available.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const username = await config.value<string>('username').get('');
  const password = await config.value<string>('password').get('');

  if (username.length > 0 && password.length > 0) {
    headers['X-Username'] = username;
    headers['X-Password'] = password;
  }

  const token = await getThemesAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function getThemesAuthToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedSessionToken) {
    return cachedSessionToken;
  }

  const storedToken = await config.value<string>('themes_auth_token').get('');
  if (!forceRefresh && storedToken.trim().length > 0) {
    cachedSessionToken = storedToken.trim();
    return cachedSessionToken;
  }

  // Attempt automatic login using saved username & password
  const username = await config.value<string>('username').get('');
  const password = await config.value<string>('password').get('');

  if (username.length > 0 && password.length > 0) {
    try {
      const baseUrl = await getThemesServiceUrl();
      const res = await fetch(`${baseUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = (await res.json()) as { token: string };
        if (data.token) {
          cachedSessionToken = data.token;
          await config.value<string>('themes_auth_token').set(data.token);
          return cachedSessionToken;
        }
      }
    } catch (err) {
      console.warn('[CommunityThemes] Auto-login failed:', err);
    }
  }

  return null;
}

export async function fetchCommunityThemes(options?: {
  q?: string;
  tag?: string;
  authorId?: number;
  sort?: 'popular' | 'recent' | 'likes' | 'downloads';
  page?: number;
  limit?: number;
}): Promise<CommunityThemesResponse> {
  let remoteData: CommunityThemesResponse | null = null;
  let remoteError: Error | null = null;

  try {
    const baseUrl = await getThemesServiceUrl();
    const headers = await getAuthHeaders();

    const url = new URL(`${baseUrl}/v1/themes`);
    if (options?.q) url.searchParams.set('q', options.q);
    if (options?.tag) url.searchParams.set('tag', options.tag);
    if (options?.authorId) url.searchParams.set('authorId', String(options.authorId));
    if (options?.sort) url.searchParams.set('sort', options.sort);
    if (options?.page) url.searchParams.set('page', String(options.page));
    if (options?.limit) url.searchParams.set('limit', String(options.limit));

    const res = await fetch(url.toString(), { headers });
    if (res.ok) {
      remoteData = (await res.json()) as CommunityThemesResponse;
      for (const item of remoteData.items) {
        if (item.previewUrl && !item.previewUrl.startsWith('http')) {
          item.previewUrl = `${baseUrl}${item.previewUrl}`;
        }
        if (item.downloadUrl && !item.downloadUrl.startsWith('http')) {
          item.downloadUrl = `${baseUrl}${item.downloadUrl}`;
        }
      }
    } else {
      remoteError = new Error(`Failed to load themes (HTTP ${res.status})`);
    }
  } catch (err) {
    remoteError = err instanceof Error ? err : new Error(String(err));
    console.warn('[CommunityThemes] Microservice unavailable, falling back to legacy catalogue:', err);
  }

  // Filter legacy themes based on options
  const matchingLegacy = LEGACY_COMMUNITY_THEMES.filter((item) => {
    if (options?.authorId && options.authorId !== item.author.id) return false;
    if (options?.tag && options.tag !== 'all' && !item.tags.includes(options.tag.toLowerCase())) return false;
    if (options?.q && options.q.trim().length > 0) {
      const q = options.q.trim().toLowerCase();
      const text = `${item.name} ${item.description} ${item.id}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  if (!remoteData) {
    if (matchingLegacy.length > 0 || !remoteError) {
      return {
        items: matchingLegacy,
        total: matchingLegacy.length,
        page: 1,
        totalPages: 1,
      };
    }
    throw remoteError;
  }

  // If remoteData returned, merge legacy themes if not already present in the list
  const existingIds = new Set(remoteData.items.map((i) => i.id.toLowerCase()));
  const missingLegacy = matchingLegacy.filter((l) => !existingIds.has(l.id.toLowerCase()));

  const allItems = [...remoteData.items, ...missingLegacy];
  return {
    items: allItems,
    total: remoteData.total + missingLegacy.length,
    page: remoteData.page,
    totalPages: Math.ceil((remoteData.total + missingLegacy.length) / (options?.limit || 24)) || 1,
  };
}

export async function fetchCommunityThemeDetails(themeId: string): Promise<CommunityTheme> {
  const cleanId = themeId.trim().toLowerCase();
  try {
    const baseUrl = await getThemesServiceUrl();
    const headers = await getAuthHeaders();

    const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(cleanId)}`, { headers });
    if (res.ok) {
      const item = (await res.json()) as CommunityTheme;
      if (item.previewUrl && !item.previewUrl.startsWith('http')) {
        item.previewUrl = `${baseUrl}${item.previewUrl}`;
      }
      if (item.downloadUrl && !item.downloadUrl.startsWith('http')) {
        item.downloadUrl = `${baseUrl}${item.downloadUrl}`;
      }
      return item;
    }
  } catch {}

  const legacy = LEGACY_COMMUNITY_THEMES.find((t) => t.id === cleanId);
  if (legacy) return legacy;

  throw new Error('Theme not found.');
}

export async function toggleCommunityThemeLike(themeId: string): Promise<{ liked: boolean; likeCount: number }> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] && !headers['Authorization']) {
    throw new Error('Please log in to like community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/like`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to like theme (HTTP ${res.status})`);
  }

  return (await res.json()) as { liked: boolean; likeCount: number };
}

export async function deleteCommunityTheme(themeId: string): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] && !headers['Authorization']) {
    throw new Error('Please log in to manage your community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to delete theme (HTTP ${res.status})`);
  }
}

/**
 * 3-step Cloudflare-compliant chunked upload protocol (~15 MB slices).
 */
export async function publishThemeToWorkshop(options: {
  themeFolder: string;
  themeId: string;
  name: string;
  description?: string;
  version?: string;
  apiVersion?: string;
  tags?: string[];
  previewImageBase64?: string;
  onProgress?: (status: string, percentage: number) => void;
}): Promise<{ success: boolean; theme: any }> {
  const { onProgress = () => {} } = options;
  const baseUrl = await getThemesServiceUrl();
  const authHeaders = await getAuthHeaders();

  if (!authHeaders['X-Username'] && !authHeaders['Authorization']) {
    throw new Error('You must be logged in to EZPPFarm to publish themes.');
  }

  onProgress('Packaging theme archive...', 5);

  const baseThemesDir = await themesDirectory();
  const tmpDir = await path.join(baseThemesDir, '.tmp');
  if (!(await fs.exists(tmpDir))) {
    await fs.mkdir(tmpDir, { recursive: true });
  }

  const destinationZip = await path.join(tmpDir, `${options.themeId}_workshop_export.zip`);

  try {
    // 1. Export theme to a local zip archive
    await invoke('export_theme', {
      themeFolder: options.themeFolder,
      destinationPath: destinationZip,
    });

    onProgress('Calculating checksum...', 10);

    const totalSize = (await invoke<number>('file_size', { path: destinationZip })) ?? 0;
    if (totalSize === 0) {
      throw new Error('Failed to create theme archive (0 bytes).');
    }

    const sha256 = await invoke<string>('hash_file_sha256', { path: destinationZip });

    const CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    onProgress('Initializing upload session...', 15);

    // Step 1: Init upload session
    const initRes = await fetch(`${baseUrl}/v1/themes/upload/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        themeId: options.themeId,
        name: options.name,
        description: options.description || '',
        version: options.version || '1.0.0',
        apiVersion: options.apiVersion || '2.0.0',
        totalSize,
        totalChunks,
        sha256,
        tags: options.tags || [],
      }),
    });

    if (!initRes.ok) {
      const errData = (await initRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `Upload initialization failed (HTTP ${initRes.status})`);
    }

    const { uploadId } = (await initRes.json()) as { uploadId: string };

    // Step 2: Upload chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const length = Math.min(CHUNK_SIZE, totalSize - offset);

      const progressStart = 20 + Math.round((i / totalChunks) * 65);
      onProgress(`Uploading chunk ${i + 1} of ${totalChunks}...`, progressStart);

      const chunkBytes = await invoke<number[]>('read_file_chunk', {
        path: destinationZip,
        offset,
        length,
      });

      const chunkData = new Uint8Array(chunkBytes);

      const chunkRes = await fetch(`${baseUrl}/v1/themes/upload/${uploadId}/chunk/${i}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...authHeaders,
        },
        body: chunkData,
      });

      if (!chunkRes.ok) {
        const errData = (await chunkRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `Failed uploading chunk ${i + 1}`);
      }
    }

    // Step 3: Complete upload
    onProgress('Verifying integrity & finalizing...', 90);

    const completeRes = await fetch(`${baseUrl}/v1/themes/upload/${uploadId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        previewImageBase64: options.previewImageBase64,
      }),
    });

    if (!completeRes.ok) {
      const errData = (await completeRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `Finalizing upload failed (HTTP ${completeRes.status})`);
    }

    const completeData = await completeRes.json();
    onProgress('Theme published successfully!', 100);

    return { success: true, theme: completeData };
  } finally {
    // Clean up temporary local zip
    if (await fs.exists(destinationZip)) {
      await fs.remove(destinationZip).catch(() => {});
    }
  }
}

/**
 * Download, extract, and register a community theme into ~/.ezpplauncher/themes/.
 */
export async function downloadAndInstallCommunityTheme(
  theme: CommunityTheme,
  onProgress?: (status: string, percentage: number) => void
): Promise<{ success: boolean; folderName: string }> {
  const { onProgress: reportProgress = () => {} } = { onProgress };
  const baseThemesDir = await themesDirectory();
  const folderName = theme.id;
  const targetFolder = await path.join(baseThemesDir, folderName);

  reportProgress('Downloading theme package...', 10);

  let res: Response;
  try {
    res = await fetch(theme.downloadUrl);
    if (!res.ok && (theme.apiVersion === '1.0' || theme.tags?.includes('legacy'))) {
      res = await fetch(
        `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/${theme.id}.ezpplauncher-theme`,
        { headers: { 'User-Agent': 'EZPPLauncher' } }
      );
    }
  } catch (err) {
    if (theme.apiVersion === '1.0' || theme.tags?.includes('legacy')) {
      res = await fetch(
        `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/${theme.id}.ezpplauncher-theme`,
        { headers: { 'User-Agent': 'EZPPLauncher' } }
      );
    } else {
      throw err;
    }
  }

  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status})`);
  }

  const tmpDir = await path.join(baseThemesDir, '.tmp');
  if (!(await fs.exists(tmpDir))) {
    await fs.mkdir(tmpDir, { recursive: true });
  }

  const tempFile = await path.join(tmpDir, `${folderName}_download.ezpplauncher-theme`);

  try {
    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(tempFile, new Uint8Array(arrayBuffer));

    reportProgress('Extracting theme files...', 70);

    if (!(await fs.exists(targetFolder))) {
      await fs.mkdir(targetFolder, { recursive: true });
    }

    await invoke('extract_theme', {
      filePath: tempFile,
      themeFolder: targetFolder,
      themeName: theme.name,
    });

    reportProgress('Theme installed!', 100);

    // Refresh themes in launcher state
    await reloadThemes();

    return { success: true, folderName };
  } finally {
    if (await fs.exists(tempFile)) {
      await fs.remove(tempFile).catch(() => {});
    }
  }
}
