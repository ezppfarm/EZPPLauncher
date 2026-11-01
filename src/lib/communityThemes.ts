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

const DEFAULT_THEMES_SERVICE_URL = 'http://127.0.0.1:3000';
let cachedSessionToken: string | null = null;

export async function getThemesServiceUrl(): Promise<string> {
  const customUrl = await config.value<string>('themes_service_url').get('');
  return customUrl.trim().length > 0 ? customUrl.trim().replace(/\/+$/, '') : DEFAULT_THEMES_SERVICE_URL;
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
  const baseUrl = await getThemesServiceUrl();
  const token = await getThemesAuthToken();

  const url = new URL(`${baseUrl}/v1/themes`);
  if (options?.q) url.searchParams.set('q', options.q);
  if (options?.tag) url.searchParams.set('tag', options.tag);
  if (options?.authorId) url.searchParams.set('authorId', String(options.authorId));
  if (options?.sort) url.searchParams.set('sort', options.sort);
  if (options?.page) url.searchParams.set('page', String(options.page));
  if (options?.limit) url.searchParams.set('limit', String(options.limit));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Failed to load themes (HTTP ${res.status})`);
  }

  const data = (await res.json()) as CommunityThemesResponse;
  // Ensure absolute preview and download URLs
  for (const item of data.items) {
    if (item.previewUrl && !item.previewUrl.startsWith('http')) {
      item.previewUrl = `${baseUrl}${item.previewUrl}`;
    }
    if (item.downloadUrl && !item.downloadUrl.startsWith('http')) {
      item.downloadUrl = `${baseUrl}${item.downloadUrl}`;
    }
  }
  return data;
}

export async function fetchCommunityThemeDetails(themeId: string): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const token = await getThemesAuthToken();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}`, { headers });
  if (!res.ok) {
    throw new Error(`Theme not found (HTTP ${res.status})`);
  }

  const item = (await res.json()) as CommunityTheme;
  if (item.previewUrl && !item.previewUrl.startsWith('http')) {
    item.previewUrl = `${baseUrl}${item.previewUrl}`;
  }
  if (item.downloadUrl && !item.downloadUrl.startsWith('http')) {
    item.downloadUrl = `${baseUrl}${item.downloadUrl}`;
  }
  return item;
}

export async function toggleCommunityThemeLike(themeId: string): Promise<{ liked: boolean; likeCount: number }> {
  const baseUrl = await getThemesServiceUrl();
  const token = await getThemesAuthToken();

  if (!token) {
    throw new Error('Please log in to like community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to like theme (HTTP ${res.status})`);
  }

  return (await res.json()) as { liked: boolean; likeCount: number };
}

export async function deleteCommunityTheme(themeId: string): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const token = await getThemesAuthToken();

  if (!token) {
    throw new Error('Please log in to manage your community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
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
  const token = await getThemesAuthToken();

  if (!token) {
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
        Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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

  const res = await fetch(theme.downloadUrl);
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
