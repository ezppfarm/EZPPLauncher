import { config } from './config';
import {
  reloadThemes,
  themesDirectory,
  updateInstalledThemeTags,
  updateInstalledThemeWorkshopId,
} from './themes';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';

export interface CommunityThemeAuthor {
  id: number;
  name: string;
  donor: boolean;
  role?: 'owner' | 'moderator' | 'supporter' | null;
  avatarUrl: string;
}

export interface CommunityThemeForkOrigin {
  id: string;
  name: string;
  authorName: string;
}

export type ThemeSearchField = 'id' | 'name' | 'tag' | 'author' | 'description';

export interface ThemeSearchMatch {
  field: ThemeSearchField;
  value: string;
  score: number;
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
  allowForking: boolean;
  createdAt: string;
  updatedAt: string;
  author: CommunityThemeAuthor;
  isLiked: boolean;
  isOwner: boolean;
  isHidden: boolean;
  hiddenReason: string | null;
  hiddenAt: string | null;
  hiddenBy: number | null;
  hiddenByName: string | null;
  isQuarantined: boolean;
  quarantineReason: string | null;
  quarantinedAt: string | null;
  quarantinedBy: number | null;
  quarantinedByName: string | null;
  deletedAt: string | null;
  forkedFrom: CommunityThemeForkOrigin | null;
  previewUrl: string;
  downloadUrl: string;
  searchMatch?: ThemeSearchMatch | null;
}

export interface CommunityThemesResponse {
  items: CommunityTheme[];
  total: number;
  page: number;
  totalPages: number;
  canModerate: boolean;
}

export interface CommunityTagSummary {
  tag: string;
  count: number;
}

export type ThemeReportStatus = 'open' | 'resolved' | 'dismissed';
export type ThemeReportCategory =
  | 'spam'
  | 'harassment'
  | 'malware'
  | 'copyright'
  | 'broken'
  | 'other';

export interface ThemeReport {
  id: number;
  themeId: string;
  themeName: string;
  themeAuthorName: string;
  themeHidden: boolean;
  themeDeleted: boolean;
  themeQuarantined: boolean;
  reporterId: number;
  reporterName: string;
  category: ThemeReportCategory;
  reason: string;
  status: ThemeReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
}

export interface ThemeReportQuery {
  status?: ThemeReportStatus | 'all';
  q?: string;
  category?: ThemeReportCategory | 'all';
  author?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ModerationEvent {
  id: number;
  themeId: string;
  themeName: string;
  actorId: number;
  actorName: string;
  action: string;
  reason: string | null;
  createdAt: string;
}

export interface ModerationEventQuery {
  themeId?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ModerationEventsResponse {
  events: ModerationEvent[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ThemeReportsResponse {
  reports: ThemeReport[];
  total: number;
  page: number;
  totalPages: number;
}

const DEFAULT_THEMES_SERVICE_URL = 'https://themes.ez-pp.farm';

export async function getThemesServiceUrl(): Promise<string> {
  const customUrl = await config.value<string>('themes_service_url').get('');
  return customUrl.trim().length > 0
    ? customUrl.trim().replace(/\/+$/, '')
    : DEFAULT_THEMES_SERVICE_URL;
}

/**
 * Returns authentication headers using stored username and password.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const username = await config.value<string>('username').get('');
  const password = await config.value<string>('password').get('');

  if (username.length > 0 && password.length > 0) {
    headers['X-Username'] = username;
    headers['X-Password'] = password;
  }

  return headers;
}

export async function fetchCommunityThemes(options?: {
  q?: string;
  tag?: string;
  authorId?: number;
  sort?: 'relevance' | 'popular' | 'recent' | 'likes' | 'downloads';
  page?: number;
  limit?: number;
  hidden?: boolean;
  quarantined?: boolean;
  trashed?: boolean;
}): Promise<CommunityThemesResponse> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  const url = new URL(`${baseUrl}/v1/themes`);
  if (options?.q) url.searchParams.set('q', options.q);
  if (options?.tag) url.searchParams.set('tag', options.tag);
  if (options?.authorId) url.searchParams.set('authorId', String(options.authorId));
  if (options?.sort) url.searchParams.set('sort', options.sort);
  if (options?.page) url.searchParams.set('page', String(options.page));
  if (options?.limit) url.searchParams.set('limit', String(options.limit));
  if (options?.hidden) url.searchParams.set('hidden', '1');
  if (options?.quarantined) url.searchParams.set('quarantined', '1');
  if (options?.trashed) url.searchParams.set('trashed', '1');

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to load themes (HTTP ${res.status})`);
  }

  const remoteData = (await res.json()) as CommunityThemesResponse;
  for (const item of remoteData.items) {
    if (item.previewUrl && !item.previewUrl.startsWith('http')) {
      item.previewUrl = `${baseUrl}${item.previewUrl}`;
    }
    if (item.downloadUrl && !item.downloadUrl.startsWith('http')) {
      item.downloadUrl = `${baseUrl}${item.downloadUrl}`;
    }
  }

  return {
    items: remoteData.items,
    total: remoteData.total,
    page: remoteData.page || 1,
    totalPages: Number.isFinite(remoteData.totalPages)
      ? Math.max(1, remoteData.totalPages)
      : Math.ceil(Number(remoteData.total || 0) / Math.max(1, options?.limit || 24)) || 1,
    canModerate: remoteData.canModerate ?? false,
  };
}

export async function fetchCommunityTags(): Promise<CommunityTagSummary[]> {
  const baseUrl = await getThemesServiceUrl();
  const res = await fetch(`${baseUrl}/v1/themes/tags`);
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to load tags (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { tags?: unknown };
  if (!Array.isArray(data.tags)) return [];

  const tags: CommunityTagSummary[] = [];
  for (const item of data.tags) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { tag?: unknown; count?: unknown };
    if (typeof candidate.tag !== 'string' || typeof candidate.count !== 'number') continue;
    const tag = candidate.tag.trim().toLowerCase();
    if (!tag) continue;
    tags.push({ tag, count: candidate.count });
  }
  return tags;
}

export async function fetchCommunityThemeDetails(themeId: string): Promise<CommunityTheme> {
  const cleanId = themeId.trim().toLowerCase();
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();
  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(cleanId)}`, { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || 'Theme not found.');
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

export async function toggleCommunityThemeLike(
  themeId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
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

export async function forkCommunityTheme(themeId: string): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to fork community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/fork`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to fork theme (HTTP ${res.status})`);
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

export async function deleteCommunityTheme(themeId: string): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
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

export async function permanentlyDeleteCommunityTheme(themeId: string): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to permanently delete community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/permanent`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to permanently delete theme (HTTP ${res.status})`);
  }
}

export async function reportCommunityTheme(
  themeId: string,
  reason: string,
  category: ThemeReportCategory = 'other'
): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to report community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/report`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, category }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to report theme (HTTP ${res.status})`);
  }
}

export async function restoreCommunityTheme(themeId: string): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to restore community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/restore`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to restore theme (HTTP ${res.status})`);
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

export async function fetchThemeReports(
  options: ThemeReportQuery = {}
): Promise<ThemeReportsResponse> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to view theme reports.');
  }

  const url = new URL(`${baseUrl}/v1/themes/moderation/reports`);
  url.searchParams.set('status', options.status ?? 'open');
  if (options.q?.trim()) url.searchParams.set('q', options.q.trim());
  if (options.category && options.category !== 'all') {
    url.searchParams.set('category', options.category);
  }
  if (options.author?.trim()) url.searchParams.set('author', options.author.trim());
  if (options.from) url.searchParams.set('from', options.from);
  if (options.to) url.searchParams.set('to', options.to);
  if (options.page) url.searchParams.set('page', String(options.page));
  if (options.limit) url.searchParams.set('limit', String(options.limit));

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to load reports (HTTP ${res.status})`);
  }
  return (await res.json()) as ThemeReportsResponse;
}

export async function resolveThemeReport(
  reportId: number,
  status: 'resolved' | 'dismissed',
  note?: string
): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to manage theme reports.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/moderation/reports/${reportId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to update report (HTTP ${res.status})`);
  }
}

export async function bulkResolveThemeReports(
  reportIds: number[],
  action: 'hide' | 'resolved' | 'dismissed',
  note?: string
): Promise<{ updated: number; themes: number }> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to manage theme reports.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/moderation/reports/bulk`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportIds, action, note }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to update reports (HTTP ${res.status})`);
  }
  return (await res.json()) as { updated: number; themes: number };
}

export async function downloadThemeReportsCsv(options: ThemeReportQuery = {}): Promise<boolean> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to export theme reports.');
  }

  const url = new URL(`${baseUrl}/v1/themes/moderation/reports/export`);
  url.searchParams.set('status', options.status ?? 'open');
  if (options.q?.trim()) url.searchParams.set('q', options.q.trim());
  if (options.category && options.category !== 'all') {
    url.searchParams.set('category', options.category);
  }
  if (options.author?.trim()) url.searchParams.set('author', options.author.trim());
  if (options.from) url.searchParams.set('from', options.from);
  if (options.to) url.searchParams.set('to', options.to);

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to export reports (HTTP ${res.status})`);
  }

  const truncated = res.headers.get('x-export-truncated') === 'true';
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'theme-reports.csv';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return truncated;
}

export async function setCommunityThemeQuarantine(
  themeId: string,
  quarantined: boolean,
  reason?: string
): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to moderate community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/quarantine`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ quarantined, reason: quarantined ? reason : undefined }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to update theme takedown (HTTP ${res.status})`);
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

export async function fetchModerationEvents(
  options: ModerationEventQuery = {}
): Promise<ModerationEventsResponse> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to view moderation history.');
  }

  const url = new URL(`${baseUrl}/v1/themes/moderation/events`);
  if (options.themeId) url.searchParams.set('themeId', options.themeId);
  if (options.action && options.action !== 'all') url.searchParams.set('action', options.action);
  if (options.actor?.trim()) url.searchParams.set('actor', options.actor.trim());
  if (options.from) url.searchParams.set('from', options.from);
  if (options.to) url.searchParams.set('to', options.to);
  if (options.page) url.searchParams.set('page', String(options.page));
  url.searchParams.set('limit', String(options.limit ?? 50));

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to load moderation history (HTTP ${res.status})`);
  }
  return (await res.json()) as ModerationEventsResponse;
}

export async function downloadModerationEventsCsv(
  options: ModerationEventQuery = {}
): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to export moderation history.');
  }

  const url = new URL(`${baseUrl}/v1/themes/moderation/events/export`);
  if (options.themeId) url.searchParams.set('themeId', options.themeId);
  if (options.action && options.action !== 'all') url.searchParams.set('action', options.action);
  if (options.actor?.trim()) url.searchParams.set('actor', options.actor.trim());
  if (options.from) url.searchParams.set('from', options.from);
  if (options.to) url.searchParams.set('to', options.to);

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to export moderation history (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'theme-moderation-events.csv';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function setCommunityThemeTags(
  themeId: string,
  tags: string[]
): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to edit community theme tags.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/tags`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to update theme tags (HTTP ${res.status})`);
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

export async function setCommunityThemeVisibility(
  themeId: string,
  hidden: boolean,
  reason?: string
): Promise<CommunityTheme> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await getAuthHeaders();

  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to moderate community themes.');
  }

  const res = await fetch(`${baseUrl}/v1/themes/${encodeURIComponent(themeId)}/visibility`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden, reason: hidden ? reason : undefined }),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Failed to update theme visibility (HTTP ${res.status})`);
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

/**
 * 3-step Cloudflare-compliant chunked upload protocol (~15 MB slices).
 */
export async function publishThemeToWorkshop(options: {
  themeFolder: string;
  themeId: string;
  /** Existing server-assigned ID when updating an already-published theme. */
  workshopId?: string;
  name: string;
  description?: string;
  version?: string;
  apiVersion?: string;
  tags?: string[];
  allowForking?: boolean;
  previewImageBase64?: string;
  onProgress?: (status: string, percentage: number) => void;
}): Promise<{ success: boolean; themeId: string; theme: unknown }> {
  const { onProgress = () => {} } = options;
  const baseUrl = await getThemesServiceUrl();
  const authHeaders = await getAuthHeaders();

  if (!authHeaders['X-Username'] || !authHeaders['X-Password']) {
    throw new Error('You must be logged in to EZPPFarm to publish themes.');
  }

  onProgress('Packaging theme archive...', 5);

  const baseThemesDir = await themesDirectory();
  const tmpDir = await path.join(baseThemesDir, 'export_temp');
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
        // The service uses this only when it belongs to an existing theme owned
        // by the caller. Otherwise it assigns a fresh UUID and ignores it.
        themeId: options.workshopId || options.themeId,
        name: options.name,
        description: options.description || '',
        version: options.version || '1.0.0',
        apiVersion: options.apiVersion || '2.0.0',
        totalSize,
        totalChunks,
        sha256,
        tags: options.tags || [],
        allowForking: options.allowForking,
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

    const completeData = (await completeRes.json()) as Record<string, unknown> & {
      themeId?: unknown;
    };
    onProgress('Theme published successfully!', 100);

    return {
      success: true,
      themeId: typeof completeData.themeId === 'string' ? completeData.themeId : '',
      theme: completeData,
    };
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

  // Progress events are global, so ignore those belonging to other themes that are
  // downloading at the same time.
  const unlistenDownload = await listen<{
    theme_name: string;
    received: number;
    total: number;
    progress: number;
  }>('download_progress', (event) => {
    if (event.payload.theme_name !== theme.name) return;
    reportProgress('Downloading theme package...', Math.round(10 + event.payload.progress * 50));
  });

  const unlistenExtract = await listen<{
    theme_name: string;
    extracted: number;
    total: number;
    progress: number;
  }>('extract_progress', (event) => {
    if (event.payload.theme_name !== theme.name) return;
    reportProgress('Extracting theme files...', Math.round(60 + event.payload.progress * 38));
  });

  try {
    try {
      await invoke('download_and_extract_community_theme', {
        downloadUrl: theme.downloadUrl,
        themeFolder: targetFolder,
        themeName: theme.name,
      });
    } catch (err) {
      // Fallback for legacy themes directly to git repo
      if (theme.apiVersion === '1.0' || theme.tags?.includes('legacy')) {
        const fallbackUrl = `https://git.ez-pp.farm/EZPPFarm/EZPPLauncher-Themes/raw/branch/main/themes/${theme.id}.ezpplauncher-theme`;
        await invoke('download_and_extract_community_theme', {
          downloadUrl: fallbackUrl,
          themeFolder: targetFolder,
          themeName: theme.name,
        });
      } else {
        throw err;
      }
    }

    try {
      // Keep the installed manifest aligned with the workshop record.
      await updateInstalledThemeTags(folderName, theme.tags);
      await updateInstalledThemeWorkshopId(folderName, theme.id);
    } catch (err) {
      console.warn('[Workshop] Could not write workshop metadata into the installed theme:', err);
    }

    reportProgress('Theme installed!', 100);

    // Refresh themes in launcher state
    await reloadThemes();

    return { success: true, folderName };
  } finally {
    unlistenDownload();
    unlistenExtract();
  }
}
