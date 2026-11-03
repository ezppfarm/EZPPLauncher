import { getAuthHeaders, getThemesServiceUrl } from './communityThemes';

export type NotificationType =
  | 'theme_hidden'
  | 'theme_restored'
  | 'theme_taken_down'
  | 'report_resolved'
  | 'report_dismissed'
  | 'system';

export interface UserNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  themeId: string | null;
  themeName: string | null;
  actorId: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: UserNotification[];
  unreadCount: number;
  hasMore: boolean;
}

async function requireAuthHeaders(): Promise<Record<string, string>> {
  const headers = await getAuthHeaders();
  if (!headers['X-Username'] || !headers['X-Password']) {
    throw new Error('Please log in to view notifications.');
  }
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(errorJson.error || `${fallback} (HTTP ${res.status})`);
}

export async function fetchNotifications(options?: {
  limit?: number;
  beforeId?: number;
}): Promise<NotificationsResponse> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await requireAuthHeaders();
  const url = new URL(`${baseUrl}/v1/notifications`);
  if (options?.limit) url.searchParams.set('limit', String(options.limit));
  if (options?.beforeId) url.searchParams.set('beforeId', String(options.beforeId));

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw await parseError(res, 'Failed to load notifications');
  return (await res.json()) as NotificationsResponse;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await requireAuthHeaders();
  const res = await fetch(`${baseUrl}/v1/notifications/unread-count`, { headers });
  if (!res.ok) throw await parseError(res, 'Failed to load notification count');
  const data = (await res.json()) as { count?: number };
  return Number(data.count ?? 0);
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await requireAuthHeaders();
  const res = await fetch(`${baseUrl}/v1/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers,
  });
  if (!res.ok) throw await parseError(res, 'Failed to update notification');
}

export async function markAllNotificationsRead(): Promise<void> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await requireAuthHeaders();
  const res = await fetch(`${baseUrl}/v1/notifications/read-all`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw await parseError(res, 'Failed to update notifications');
}

export async function sendSystemAnnouncement(options: {
  title: string;
  message: string;
  audience?: 'all' | 'staff';
}): Promise<{ recipients: number }> {
  const baseUrl = await getThemesServiceUrl();
  const headers = await requireAuthHeaders();
  const res = await fetch(`${baseUrl}/v1/notifications/announce`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw await parseError(res, 'Failed to send announcement');
  return (await res.json()) as { recipients: number };
}
