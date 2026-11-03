<script lang="ts">
  import { Bell, CheckCheck, LoaderCircle, Megaphone, RefreshCw, ShieldAlert, X } from '@lucide/svelte';
  import { Portal } from 'bits-ui';
  import { Button } from '$lib/components/ui/button';
  import { currentUser } from '$lib/userAuthentication';
  import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
    type UserNotification,
  } from '$lib/notifications';

  let open = $state(false);
  let loading = $state(false);
  let loadingMore = $state(false);
  let markingAll = $state(false);
  let notifications = $state<UserNotification[]>([]);
  let unreadCount = $state(0);
  let hasMore = $state(false);
  let error = $state<string | null>(null);

  const unreadLabel = $derived(unreadCount > 9 ? '9+' : String(unreadCount));

  $effect(() => {
    const userId = $currentUser?.id;
    if (!userId) {
      open = false;
      notifications = [];
      unreadCount = 0;
      hasMore = false;
      error = null;
      return;
    }

    void refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !open) void refreshCount();
    }, 60_000);
    return () => clearInterval(timer);
  });

  async function refreshCount() {
    if (!$currentUser) return;
    try {
      unreadCount = await fetchUnreadNotificationCount();
    } catch {
      // The badge is best-effort; the panel surfaces actionable errors.
    }
  }

  async function loadNotifications() {
    if (!$currentUser) return;
    loading = true;
    error = null;
    try {
      const data = await fetchNotifications({ limit: 30 });
      notifications = data.notifications;
      unreadCount = data.unreadCount;
      hasMore = data.hasMore;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function openHub() {
    if (!$currentUser) return;
    open = true;
    void loadNotifications();
  }

  async function loadOlder() {
    if (loadingMore || notifications.length === 0) return;
    loadingMore = true;
    try {
      const data = await fetchNotifications({
        limit: 30,
        beforeId: notifications[notifications.length - 1].id,
      });
      const known = new Set(notifications.map((item) => item.id));
      notifications = [...notifications, ...data.notifications.filter((item) => !known.has(item.id))];
      unreadCount = data.unreadCount;
      hasMore = data.hasMore;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loadingMore = false;
    }
  }

  async function markRead(notification: UserNotification) {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      notifications = notifications.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      );
      unreadCount = Math.max(0, unreadCount - 1);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return;
    markingAll = true;
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      notifications = notifications.map((item) => ({
        ...item,
        readAt: item.readAt ?? now,
      }));
      unreadCount = 0;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      markingAll = false;
    }
  }

  function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
</script>

<button
  type="button"
  class="relative flex size-12 items-center justify-center rounded-[0.85rem] bg-black/20 text-theme-200 ring-1 ring-inset ring-white/15 transition-colors hover:bg-primary/20 hover:text-theme-50 disabled:cursor-not-allowed disabled:opacity-50"
  title={$currentUser ? 'Notifications' : 'Log in to view notifications'}
  aria-label={$currentUser
    ? `Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`
    : 'Notifications'}
  disabled={!$currentUser}
  onclick={openHub}
>
  <Bell class="size-5" />
  {#if unreadCount > 0}
    <span
      class="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-theme-950"
    >
      {unreadLabel}
    </span>
  {/if}
</button>

{#if open}
  <Portal>
  <button
    type="button"
    class="fixed inset-0 z-[80] cursor-default bg-black/30 backdrop-blur-[1px]"
    aria-label="Close notifications"
    onclick={() => (open = false)}
  ></button>

  <div
    class="fixed bottom-4 left-[4.75rem] z-[90] flex max-h-[min(34rem,calc(100vh-2rem))] w-[22rem] flex-col overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="notification-hub-title"
  >
    <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
      <div>
        <h2 id="notification-hub-title" class="flex items-center gap-2 text-sm font-semibold text-white">
          <Bell class="size-4 text-primary" />
          Notifications
          {#if unreadCount > 0}
            <span class="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              {unreadCount} new
            </span>
          {/if}
        </h2>
        <p class="mt-1 text-[11px] text-muted-foreground">Moderation updates and system messages.</p>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="size-7 text-muted-foreground hover:text-white"
          title="Refresh notifications"
          onclick={() => void loadNotifications()}
          disabled={loading}
        >
          <RefreshCw class="size-3.5 {loading ? 'animate-spin' : ''}" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-7 text-muted-foreground hover:text-white"
          title="Close"
          onclick={() => (open = false)}
        >
          <X class="size-4" />
        </Button>
      </div>
    </div>

    <div class="flex items-center justify-between border-b border-theme-800/50 px-4 py-2">
      <span class="text-[10px] text-muted-foreground">
        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        class="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-white"
        onclick={() => void markAllRead()}
        disabled={markingAll || unreadCount === 0}
      >
        {#if markingAll}
          <LoaderCircle class="size-3 animate-spin" />
        {:else}
          <CheckCheck class="size-3" />
        {/if}
        Mark all read
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      {#if error}
        <div class="m-2 rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-[11px] text-red-300">
          {error}
        </div>
      {/if}

      {#if loading && notifications.length === 0}
        <div class="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle class="size-4 animate-spin text-primary" /> Loading notifications...
        </div>
      {:else if notifications.length === 0}
        <div class="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
          <Bell class="size-7 text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No notifications yet.</p>
          <p class="text-[10px] text-muted-foreground/70">
            Moderation decisions about your themes and reports will appear here.
          </p>
        </div>
      {:else}
        <div class="space-y-1">
          {#each notifications as notification (notification.id)}
            <button
              type="button"
              class="w-full rounded-lg border p-3 text-left transition-colors {notification.readAt
                ? 'border-transparent bg-transparent hover:bg-theme-900/50'
                : 'border-primary/20 bg-primary/5 hover:bg-primary/10'}"
              onclick={() => void markRead(notification)}
            >
              <div class="flex items-start gap-2.5">
                <div
                  class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full {notification.type ===
                  'theme_hidden' || notification.type === 'theme_taken_down'
                    ? 'bg-red-500/10 text-red-300'
                    : notification.type === 'report_resolved'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : notification.type === 'system'
                        ? 'bg-cyan-500/10 text-cyan-300'
                        : 'bg-amber-500/10 text-amber-300'}"
                >
                  {#if notification.type === 'system'}
                    <Megaphone class="size-3.5" />
                  {:else}
                    <ShieldAlert class="size-3.5" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-[11px] font-semibold text-white">{notification.title}</p>
                    {#if !notification.readAt}
                      <span class="mt-1 size-1.5 shrink-0 rounded-full bg-primary"></span>
                    {/if}
                  </div>
                  <p class="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {notification.message}
                  </p>
                  <p class="mt-1.5 text-[9px] text-muted-foreground/70">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          {/each}
        </div>

        {#if hasMore}
          <div class="flex justify-center p-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-[10px] text-muted-foreground"
              onclick={() => void loadOlder()}
              disabled={loadingMore}
            >
              {#if loadingMore}
                <LoaderCircle class="mr-1 size-3 animate-spin" />
              {/if}
              Load older
            </Button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
  </Portal>
{/if}
