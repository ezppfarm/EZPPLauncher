<script lang="ts">
  import DefaultThemePreview from '$assets/default_preview.png';
  import { activeThemeDownloads, themeDownloadProgress } from '$lib/communityThemeDownloads';
  import {
    fetchCommunityTags,
    fetchCommunityThemes,
    fetchCommunityThemeDetails,
    toggleCommunityThemeLike,
    downloadAndInstallCommunityTheme,
    forkCommunityTheme,
    deleteCommunityTheme,
    permanentlyDeleteCommunityTheme,
    restoreCommunityTheme,
    setCommunityThemeVisibility,
    setCommunityThemeQuarantine,
    setCommunityThemeTags,
    reportCommunityTheme,
    fetchThemeReports,
    fetchThemeReviewQueue,
    reviewCommunityTheme,
    resolveThemeReport,
    bulkResolveThemeReports,
    downloadThemeReportsCsv,
    downloadModerationEventsCsv,
    fetchModerationEvents,
    type CommunityTagSummary,
    type CommunityTheme,
    type ModerationEvent,
    type ModerationEventQuery,
    type ThemeReport,
    type ThemeReportCategory,
    type ThemeReportQuery,
    type ThemeReportStatus,
  } from '$lib/communityThemes';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import DatePicker from '$lib/components/ui/date-picker/date-picker.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import ScrollContainer from '$lib/components/ui/scroll-container/ScrollContainer.svelte';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { active_custom_theme, custom_themes } from '$lib/global';
  import { sendSystemAnnouncement } from '$lib/notifications';
  import { isThemeTrusted } from '$lib/themeTrust';
  import { normalizeThemeTags } from '$lib/themeV2';
  import { reloadThemes, updateInstalledThemeTags, type Theme } from '$lib/themes';
  import { currentUser } from '$lib/userAuthentication';
  import WorkshopTooltip from './WorkshopTooltip.svelte';
  import {
    Archive,
    Ban,
    Check,
    ChevronDown,
    Code2,
    CopyPlus,
    Crown,
    Download,
    Ellipsis,
    ExternalLink,
    Eye,
    EyeOff,
    Flag,
    GitFork,
    Globe,
    Heart,
    History,
    LoaderCircle,
    Megaphone,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    Sparkles,
    Tag,
    Trash2,
    TriangleAlert,
    X,
  } from '@lucide/svelte';
  import { sileo } from 'sileo';
  import { onDestroy, onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  let {
    onApplyTheme,
    onRequestTrust,
    onEditTheme,
  }: {
    onApplyTheme: (theme: Theme) => Promise<void>;
    onRequestTrust: (theme: Theme) => void;
    onEditTheme: (theme: Theme) => Promise<void>;
  } = $props();

  type WorkshopSort = 'relevance' | 'popular' | 'recent' | 'likes' | 'downloads';
  type WorkshopView = 'workshop' | 'trash';

  type PendingAction =
    | { kind: 'refresh'; theme: CommunityTheme }
    | { kind: 'hide'; theme: CommunityTheme }
    | { kind: 'unhide'; theme: CommunityTheme }
    | { kind: 'delete'; theme: CommunityTheme }
    | { kind: 'review-approve'; theme: CommunityTheme }
    | { kind: 'review-reject'; theme: CommunityTheme }
    | { kind: 'bulk-reports'; action: 'hide' | 'resolved' | 'dismissed'; reportIds: number[] }
    | { kind: 'report-hide'; report: ThemeReport }
    | { kind: 'report-dismiss'; report: ThemeReport };

  type ActionDialogConfig = {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    note?: {
      label: string;
      placeholder: string;
      maxLength: number;
    };
  };

  let searchQuery = $state('');
  let selectedTag = $state('all');
  let tagFilterOpen = $state(false);
  let tagSearch = $state('');
  let communityTags = $state<CommunityTagSummary[]>([]);
  let tagsLoading = $state(false);
  let tagsRequestId = 0;
  let selectedSort = $state<WorkshopSort>('relevance');
  let selectedView = $state<WorkshopView>('workshop');
  let showHiddenOnly = $state(false);

  let themes = $state<CommunityTheme[]>([]);
  let totalThemes = $state(0);
  let page = $state(1);
  let totalPages = $state(1);
  let loading = $state(false);
  let loadingMore = $state(false);
  let error = $state<string | null>(null);
  let latestRequestId = 0;

  let forkingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let moderatingId = $state<string | null>(null);
  let restoringId = $state<string | null>(null);
  let purgingId = $state<string | null>(null);
  let restoreTarget = $state<CommunityTheme | null>(null);
  let purgeTarget = $state<CommunityTheme | null>(null);
  let trashActionError = $state<string | null>(null);
  let canModerate = $state(false);
  const likePending = new SvelteSet<string>();

  let showModerationPanel = $state(false);
  let moderationReports = $state<ThemeReport[]>([]);
  let moderationEvents = $state<ModerationEvent[]>([]);
  let moderationLoading = $state(false);
  let moderationError = $state<string | null>(null);
  let moderationTotal = $state(0);
  let moderationPage = $state(1);
  let moderationTotalPages = $state(1);
  let moderationStatus = $state<ThemeReportStatus | 'all'>('open');
  let moderationQuery = $state('');
  let moderationAuthor = $state('');
  let moderationCategory = $state<ThemeReportCategory | 'all'>('all');
  let moderationFrom = $state('');
  let moderationTo = $state('');
  let moderationEventAction = $state('all');
  let moderationEventActor = $state('');
  let moderationEventsPage = $state(1);
  let moderationEventsTotalPages = $state(1);
  let moderationRequestId = 0;
  let eventsLoadingMore = $state(false);
  let reviewQueue = $state<CommunityTheme[]>([]);
  let reviewTotal = $state(0);
  let reviewPage = $state(1);
  let reviewTotalPages = $state(1);
  let reviewLoadingMore = $state(false);
  let reviewActionId = $state<string | null>(null);
  let selectedReportIds = $state<number[]>([]);
  let reportActionId = $state<number | null>(null);
  let bulkAction = $state<'hide' | 'resolved' | 'dismissed' | null>(null);
  let exportingReports = $state(false);
  let exportingEvents = $state(false);
  let quarantineId = $state<string | null>(null);
  let quarantineTarget = $state<CommunityTheme | null>(null);
  let quarantineAction = $state<'take_down' | 'lift'>('take_down');
  let quarantineReason = $state('');
  let quarantineError = $state<string | null>(null);

  let tagEditorTarget = $state<CommunityTheme | null>(null);
  let tagEditorTags = $state<string[]>([]);
  let tagEditorInput = $state('');
  let tagEditorError = $state<string | null>(null);
  let tagSaving = $state(false);

  let announcementOpen = $state(false);
  let announcementTitle = $state('');
  let announcementMessage = $state('');
  let announcementAudience = $state<'all' | 'staff'>('all');
  let announcementSending = $state(false);
  let announcementError = $state<string | null>(null);

  let reportTarget = $state<CommunityTheme | null>(null);
  let reportCategory = $state<ThemeReportCategory>('other');
  let reportDetails = $state('');
  let reportError = $state<string | null>(null);
  let reportSubmitting = $state(false);

  let historyOpen = $state(false);
  let historyTarget = $state<{ id: string; name: string } | null>(null);
  let historyEvents = $state<ModerationEvent[]>([]);
  let historyPage = $state(1);
  let historyTotalPages = $state(1);
  let historyLoading = $state(false);
  let historyLoadingMore = $state(false);
  let historyRequestId = 0;
  let historyError = $state<string | null>(null);

  let sourceDialogOpen = $state(false);
  let sourceTheme = $state<CommunityTheme | null>(null);
  let sourceLoading = $state(false);
  let sourceError = $state<string | null>(null);

  let pendingAction = $state<PendingAction | null>(null);
  let actionNote = $state('');
  let actionError = $state<string | null>(null);
  let actionBusy = $state(false);
  let actionDialogContent = $state<HTMLElement | null>(null);

  const REPORT_CATEGORIES: Array<{ id: ThemeReportCategory; label: string }> = [
    { id: 'spam', label: 'Spam / advertising' },
    { id: 'harassment', label: 'Harassment / hate' },
    { id: 'malware', label: 'Malware / unsafe code' },
    { id: 'copyright', label: 'Copyright / stolen content' },
    { id: 'broken', label: 'Broken / unusable' },
    { id: 'other', label: 'Other' },
  ];
  const SORT_OPTIONS: Array<{ id: WorkshopSort; label: string }> = [
    { id: 'relevance', label: 'Best match' },
    { id: 'popular', label: 'Most Popular' },
    { id: 'recent', label: 'Most Recent' },
    { id: 'likes', label: 'Most Liked' },
    { id: 'downloads', label: 'Most Downloaded' },
  ];
  const REPORT_STATUS_OPTIONS: Array<{ id: ThemeReportStatus | 'all'; label: string }> = [
    { id: 'open', label: 'Open reports' },
    { id: 'resolved', label: 'Resolved reports' },
    { id: 'dismissed', label: 'Dismissed reports' },
    { id: 'all', label: 'All reports' },
  ];
  const MODERATION_ACTIONS: Record<string, string> = {
    hide: 'Hidden from the workshop',
    restore: 'Visibility restored',
    delete: 'Moved to trash',
    restore_deleted: 'Restored from trash',
    delete_permanent: 'Permanently deleted',
    report: 'Reported',
    report_resolved: 'Report resolved',
    report_dismissed: 'Report dismissed',
    quarantine: 'Taken down',
    quarantine_restore: 'Takedown lifted',
    review_approved: 'Theme approved',
    review_rejected: 'Theme rejected',
  };
  const AUDIT_ACTIONS = [
    { id: 'all', label: 'All actions' },
    { id: 'hide', label: 'Hidden' },
    { id: 'restore', label: 'Visibility restored' },
    { id: 'quarantine', label: 'Taken down' },
    { id: 'quarantine_restore', label: 'Takedown lifted' },
    { id: 'report', label: 'Reported' },
    { id: 'report_resolved', label: 'Report resolved' },
    { id: 'report_dismissed', label: 'Report dismissed' },
    { id: 'review_approved', label: 'Theme approved' },
    { id: 'review_rejected', label: 'Theme rejected' },
    { id: 'delete', label: 'Trashed' },
    { id: 'restore_deleted', label: 'Restored from trash' },
    { id: 'delete_permanent', label: 'Permanently deleted' },
  ];

  const localThemeMap = $derived.by(() => {
    const map = new SvelteMap<string, Theme>();
    for (const t of $custom_themes) {
      map.set(t.folder_name.toLowerCase(), t);
      map.set(t.name.toLowerCase(), t);
    }
    return map;
  });

  const actionDialog = $derived.by((): ActionDialogConfig | null => {
    const action = pendingAction;
    if (!action) return null;

    switch (action.kind) {
      case 'refresh': {
        const installed =
          localThemeMap.get(action.theme.id.toLowerCase()) ??
          localThemeMap.get(action.theme.name.toLowerCase());
        return {
          title: `Refresh "${action.theme.name}"?`,
          description: installed
            ? `This replaces your installed v${installed.version} with workshop v${action.theme.version}. Any local edits will be lost.`
            : `This replaces your installed copy with workshop v${action.theme.version}.`,
          confirmLabel: 'Refresh installed copy',
        };
      }
      case 'hide':
        return {
          title: `Hide "${action.theme.name}"?`,
          description:
            'The theme will disappear from public search, previews, downloads and updates until you restore it.',
          confirmLabel: 'Hide theme',
          destructive: true,
          note: {
            label: 'Reason (optional)',
            placeholder: 'Explain why the theme is being hidden...',
            maxLength: 255,
          },
        };
      case 'unhide':
        return {
          title: `Restore "${action.theme.name}"?`,
          description:
            'The theme will become publicly visible again unless it is still awaiting review or taken down.',
          confirmLabel: 'Restore visibility',
        };
      case 'delete':
        return {
          title: `Move "${action.theme.name}" to trash?`,
          description:
            'You can restore it from the Trash view later. Installed copies on computers are not affected.',
          confirmLabel: 'Move to trash',
          destructive: true,
        };
      case 'review-approve':
        return {
          title: `Approve "${action.theme.name}"?`,
          description: 'The theme will be listed publicly in the Community Workshop.',
          confirmLabel: 'Approve theme',
        };
      case 'review-reject':
        return {
          title: `Reject "${action.theme.name}"?`,
          description:
            'The theme stays hidden until the creator republishes it. Your note is included in their notification.',
          confirmLabel: 'Reject theme',
          destructive: true,
          note: {
            label: 'Note for the creator (optional)',
            placeholder: 'What should the creator change before republishing?',
            maxLength: 500,
          },
        };
      case 'bulk-reports': {
        const count = action.reportIds.length;
        const label = `${count} report${count === 1 ? '' : 's'}`;
        return action.action === 'hide'
          ? {
              title: `Hide themes for ${label}?`,
              description:
                'Every affected theme will be hidden from the workshop and the selected reports will be resolved.',
              confirmLabel: 'Hide themes',
              destructive: true,
              note: {
                label: 'Note for owners and reporters (optional)',
                placeholder: 'Add context for the audit log and notifications...',
                maxLength: 500,
              },
            }
          : {
              title: `Dismiss ${label}?`,
              description: 'The reports will be dismissed without changing the themes.',
              confirmLabel: 'Dismiss reports',
              note: {
                label: 'Note for reporters (optional)',
                placeholder: 'Add context for the audit log and notifications...',
                maxLength: 500,
              },
            };
      }
      case 'report-hide':
        return {
          title: `Hide "${action.report.themeName}"?`,
          description:
            'The theme will be hidden from the workshop and this report will be resolved.',
          confirmLabel: 'Hide theme',
          destructive: true,
          note: {
            label: 'Note for the reporter and audit log (optional)',
            placeholder: 'Add context for the resolution...',
            maxLength: 500,
          },
        };
      case 'report-dismiss':
        return {
          title: `Dismiss the report on "${action.report.themeName}"?`,
          description: 'The theme will stay visible and the reporter will be notified.',
          confirmLabel: 'Dismiss report',
          note: {
            label: 'Note for the reporter (optional)',
            placeholder: 'Explain why no action was taken...',
            maxLength: 500,
          },
        };
    }

    return null;
  });

  function openPendingAction(action: PendingAction, note = '') {
    if (actionBusy) return;
    pendingAction = action;
    actionNote = note;
    actionError = null;
  }

  function closePendingAction() {
    if (actionBusy) return;
    pendingAction = null;
    actionNote = '';
    actionError = null;
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action || actionBusy) return;

    actionBusy = true;
    actionError = null;
    try {
      switch (action.kind) {
        case 'refresh':
          await performRefreshOwnedTheme(action.theme);
          break;
        case 'hide':
          await applyVisibilityChange(action.theme, actionNote.trim() || undefined);
          break;
        case 'unhide':
          await applyVisibilityChange(action.theme);
          break;
        case 'delete':
          await applyDeleteTheme(action.theme);
          break;
        case 'review-approve':
          await performThemeReview(action.theme, 'approved');
          break;
        case 'review-reject':
          await performThemeReview(action.theme, 'rejected', actionNote.trim() || undefined);
          break;
        case 'bulk-reports':
          await applyBulkReportAction(
            action.action,
            actionNote.trim() || undefined,
            action.reportIds
          );
          break;
        case 'report-hide':
          await applyReportHide(action.report, actionNote.trim() || undefined);
          break;
        case 'report-dismiss':
          await applyReportDismiss(action.report, actionNote.trim() || undefined);
          break;
      }
      pendingAction = null;
      actionNote = '';
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
    } finally {
      actionBusy = false;
    }
  }

  const tagOptions = $derived.by(() => {
    const counts = new SvelteMap<string, number>();

    // The service returns every used tag. While it is unavailable or loading,
    // fall back to tags visible on the current page so filtering still works.
    if (communityTags.length > 0) {
      for (const item of communityTags) counts.set(item.tag, item.count);
    } else {
      for (const theme of themes) {
        for (const tag of theme.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    if (selectedTag !== 'all' && !counts.has(selectedTag)) counts.set(selectedTag, 0);

    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  });

  const filteredTagOptions = $derived.by(() => {
    const query = tagSearch.trim().toLowerCase();
    return query ? tagOptions.filter((option) => option.tag.includes(query)) : tagOptions;
  });

  const isOwnedByCurrentUser = (theme: CommunityTheme) =>
    theme.isOwner || ($currentUser !== undefined && theme.author.id === $currentUser.id);

  const selectableReports = $derived(
    moderationReports.filter((report) => report.status === 'open' && !report.themeDeleted)
  );
  const allSelectableReportsSelected = $derived(
    selectableReports.length > 0 &&
      selectableReports.every((report) => selectedReportIds.includes(report.id))
  );

  async function loadWorkshopTags() {
    const requestId = ++tagsRequestId;
    tagsLoading = true;
    try {
      const tags = await fetchCommunityTags();
      if (requestId === tagsRequestId) communityTags = tags;
    } catch (err) {
      console.warn('[Workshop] Failed to load tag list:', err);
    } finally {
      if (requestId === tagsRequestId) tagsLoading = false;
    }
  }

  async function loadWorkshopThemes(options: { append?: boolean; page?: number } = {}) {
    const append = options.append === true;
    const targetPage = options.page ?? (append ? page + 1 : 1);
    const requestId = ++latestRequestId;

    if (append) {
      loadingMore = true;
    } else {
      loading = true;
    }
    error = null;

    try {
      const res = await fetchCommunityThemes({
        q: searchQuery.trim().length > 0 ? searchQuery.trim() : undefined,
        tag: selectedView === 'workshop' && selectedTag !== 'all' ? selectedTag : undefined,
        sort: selectedSort,
        page: targetPage,
        limit: 24,
        hidden: selectedView === 'workshop' && canModerate && showHiddenOnly ? true : undefined,
        trashed: selectedView === 'trash' ? true : undefined,
      });

      // Ignore a response if a newer search/filter request has started.
      if (requestId !== latestRequestId) return;

      if (append) {
        const knownIds = new Set(themes.map((theme) => theme.id));
        themes = [...themes, ...res.items.filter((theme) => !knownIds.has(theme.id))];
      } else {
        themes = res.items;
      }
      totalThemes = res.total;
      page = res.page;
      totalPages = res.totalPages;
      canModerate = res.canModerate;
    } catch (err) {
      if (requestId !== latestRequestId) return;
      console.warn('[Workshop] Failed to load community themes:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      if (requestId === latestRequestId) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  let searchDebounceTimeout: ReturnType<typeof setTimeout> | undefined;
  function handleSearchInput() {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      void loadWorkshopThemes();
    }, 300);
  }

  function handleTagClick(tag: string) {
    tagFilterOpen = false;
    tagSearch = '';
    if (selectedTag === tag && selectedView === 'workshop') return;
    selectedView = 'workshop';
    selectedTag = tag;
    void loadWorkshopThemes();
  }

  function handleViewChange(view: WorkshopView) {
    if (selectedView === view) return;
    selectedView = view;
    selectedTag = 'all';
    showHiddenOnly = false;
    void loadWorkshopThemes();
  }

  function clearWorkshopFilters() {
    searchQuery = '';
    selectedTag = 'all';
    selectedView = 'workshop';
    showHiddenOnly = false;
    void loadWorkshopThemes();
  }

  function handleHiddenFilter() {
    if (!canModerate || selectedView !== 'workshop') return;
    showHiddenOnly = !showHiddenOnly;
    void loadWorkshopThemes();
  }

  function handleLoadMore() {
    if (loading || loadingMore || page >= totalPages) return;
    void loadWorkshopThemes({ append: true });
  }

  function parseWorkshopSort(value: string): WorkshopSort {
    return value === 'relevance' || value === 'recent' || value === 'likes' || value === 'downloads'
      ? value
      : 'popular';
  }

  function handleSortChange(sort: WorkshopSort) {
    if (selectedSort === sort) return;
    selectedSort = sort;
    void loadWorkshopThemes();
  }

  async function handleLike(theme: CommunityTheme, event: MouseEvent) {
    event.stopPropagation();
    if (theme.deletedAt || likePending.has(theme.id)) return;
    if (!$currentUser) {
      sileo.error({
        title: 'Login required',
        description: 'Log in to EZPPFarm to like community themes.',
      });
      return;
    }

    const prevLiked = theme.isLiked;
    const prevCount = theme.likeCount;
    likePending.add(theme.id);

    // Optimistic update
    theme.isLiked = !prevLiked;
    theme.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

    try {
      const res = await toggleCommunityThemeLike(theme.id);
      theme.isLiked = res.liked;
      theme.likeCount = res.likeCount;
    } catch (err) {
      // Revert on error
      theme.isLiked = prevLiked;
      theme.likeCount = prevCount;
      sileo.error({
        title: 'Could not like theme',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      likePending.delete(theme.id);
    }
  }

  async function handleDownloadTheme(theme: CommunityTheme) {
    if (theme.deletedAt || activeThemeDownloads.has(theme.id)) return;

    activeThemeDownloads.add(theme.id);
    themeDownloadProgress.set(theme.id, 10);

    try {
      await downloadAndInstallCommunityTheme(theme, (_status, progress) => {
        themeDownloadProgress.set(theme.id, progress);
      });

      sileo.success({
        title: 'Theme downloaded',
        description: `"${theme.name}" has been added to your library.`,
      });
    } catch (err) {
      console.error(err);
      sileo.error({
        title: 'Download failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      activeThemeDownloads.delete(theme.id);
      themeDownloadProgress.delete(theme.id);
    }
  }

  async function handleApplyExisting(theme: CommunityTheme) {
    if (theme.deletedAt) return;
    const installed =
      localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      await handleDownloadTheme(theme);
      return;
    }

    if (!isThemeTrusted(installed)) {
      onRequestTrust(installed);
    } else {
      await onApplyTheme(installed);
    }
  }

  async function handleEditTheme(theme: CommunityTheme) {
    if (
      theme.deletedAt ||
      activeThemeDownloads.has(theme.id) ||
      forkingId ||
      deletingId ||
      moderatingId
    )
      return;

    let installed =
      localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase());

    if (!installed) {
      activeThemeDownloads.add(theme.id);
      themeDownloadProgress.set(theme.id, 10);
      try {
        await downloadAndInstallCommunityTheme(theme, (_status, progress) => {
          themeDownloadProgress.set(theme.id, progress);
        });
        installed = $custom_themes.find(
          (candidate) => candidate.folder_name.toLowerCase() === theme.id.toLowerCase()
        );
      } catch (err) {
        sileo.error({
          title: 'Could not open theme',
          description: err instanceof Error ? err.message : String(err),
        });
        return;
      } finally {
        activeThemeDownloads.delete(theme.id);
        themeDownloadProgress.delete(theme.id);
      }
    }

    if (installed) {
      await onEditTheme(installed);
    }
  }

  async function handleRefreshOwnedTheme(theme: CommunityTheme) {
    if (
      theme.deletedAt ||
      activeThemeDownloads.has(theme.id) ||
      forkingId ||
      deletingId ||
      moderatingId
    )
      return;

    const installed =
      localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      await handleEditTheme(theme);
      return;
    }
    if (installed.version === theme.version) {
      await onEditTheme(installed);
      return;
    }

    openPendingAction({ kind: 'refresh', theme });
  }

  async function performRefreshOwnedTheme(theme: CommunityTheme) {
    const installed =
      localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      throw new Error('The installed copy could not be found.');
    }

    activeThemeDownloads.add(theme.id);
    themeDownloadProgress.set(theme.id, 10);
    try {
      const res = await downloadAndInstallCommunityTheme(theme, (_status, progress) => {
        themeDownloadProgress.set(theme.id, progress);
      });
      const refreshed = $custom_themes.find(
        (candidate) => candidate.folder_name.toLowerCase() === res.folderName.toLowerCase()
      );
      if (!refreshed) {
        throw new Error('The refreshed theme could not be loaded.');
      }
      sileo.success({
        title: 'Local copy refreshed',
        description: `"${theme.name}" is now at v${theme.version}.`,
      });
      await onEditTheme(refreshed);
    } finally {
      activeThemeDownloads.delete(theme.id);
      themeDownloadProgress.delete(theme.id);
    }
  }

  function requestVisibilityChange(theme: CommunityTheme) {
    if (!canModerate || moderatingId || forkingId || deletingId) return;
    if (theme.isHidden) {
      openPendingAction({ kind: 'unhide', theme });
    } else {
      openPendingAction({ kind: 'hide', theme }, theme.hiddenReason ?? '');
    }
  }

  async function applyVisibilityChange(theme: CommunityTheme, reason?: string) {
    if (!canModerate || moderatingId || forkingId || deletingId) return;

    const hiding = !theme.isHidden;
    moderatingId = theme.id;
    try {
      const updated = await setCommunityThemeVisibility(
        theme.id,
        hiding,
        hiding ? reason?.trim().slice(0, 255) || undefined : undefined
      );
      if (showHiddenOnly && !updated.isHidden) {
        themes = themes.filter((item) => item.id !== updated.id);
        totalThemes = Math.max(0, totalThemes - 1);
      } else {
        themes = themes.map((item) => (item.id === updated.id ? updated : item));
      }
      sileo.success({
        title: hiding ? 'Theme hidden' : 'Theme restored',
        description: `"${theme.name}" is now ${hiding ? 'hidden from' : 'visible in'} the workshop.`,
      });
      void loadWorkshopTags();
      if (showModerationPanel) void loadModerationPanel();
    } finally {
      moderatingId = null;
    }
  }

  function openTagEditor(theme: CommunityTheme) {
    if (theme.deletedAt) return;
    tagEditorTarget = theme;
    tagEditorTags = normalizeThemeTags(theme.tags);
    tagEditorInput = '';
    tagEditorError = null;
  }

  function addTagEditorTag() {
    const value = tagEditorInput.trim().toLowerCase();
    if (!value) return;
    if (tagEditorTags.includes(value)) {
      tagEditorError = 'That tag is already added.';
      return;
    }
    if (tagEditorTags.length >= 10) {
      tagEditorError = 'A theme may have at most 10 tags.';
      return;
    }

    const tags = normalizeThemeTags([...tagEditorTags, value]);
    if (!tags.includes(value)) {
      tagEditorError =
        'Tags may contain lowercase letters, numbers, dashes and underscores (max 24 characters).';
      return;
    }

    tagEditorTags = tags;
    tagEditorInput = '';
    tagEditorError = null;
  }

  function removeTagEditorTag(tag: string) {
    tagEditorTags = tagEditorTags.filter((candidate) => candidate !== tag);
    tagEditorError = null;
  }

  function closeTagEditor() {
    if (tagSaving) return;
    tagEditorTarget = null;
    tagEditorTags = [];
    tagEditorInput = '';
    tagEditorError = null;
  }

  async function saveTagEditor() {
    const target = tagEditorTarget;
    if (!target || tagSaving) return;

    const pending = tagEditorInput.trim().toLowerCase();
    if (pending) {
      if (tagEditorTags.includes(pending)) {
        tagEditorError = 'That tag is already added.';
        return;
      }
      if (tagEditorTags.length >= 10) {
        tagEditorError = 'A theme may have at most 10 tags.';
        return;
      }
      const withPending = normalizeThemeTags([...tagEditorTags, pending]);
      if (!withPending.includes(pending)) {
        tagEditorError =
          'Tags may contain lowercase letters, numbers, dashes and underscores (max 24 characters).';
        return;
      }
      tagEditorTags = withPending;
      tagEditorInput = '';
    }

    const tags = normalizeThemeTags(tagEditorTags);
    tagSaving = true;
    tagEditorError = null;
    try {
      const updated = await setCommunityThemeTags(target.id, tags);
      themes = themes.map((item) => (item.id === updated.id ? updated : item));

      const installed =
        localThemeMap.get(target.id.toLowerCase()) || localThemeMap.get(target.name.toLowerCase());
      let localSyncError: string | null = null;
      if (installed) {
        try {
          await updateInstalledThemeTags(installed.folder_name, updated.tags);
          await reloadThemes();
        } catch (err) {
          localSyncError = err instanceof Error ? err.message : String(err);
        }
      }

      if (localSyncError) {
        sileo.warning({
          title: 'Workshop tags updated',
          description: `The installed theme.json could not be updated: ${localSyncError}`,
        });
      } else {
        const tagSummary =
          updated.tags.length > 0
            ? `Tags: ${updated.tags.map((tag) => `#${tag}`).join(', ')}`
            : 'All tags were removed.';
        sileo.success({
          title: 'Theme tags updated',
          description: installed
            ? `Workshop and installed theme.json tags updated. ${tagSummary}`
            : `Workshop tags updated. ${tagSummary} They will be written into theme.json when the theme is installed.`,
        });
      }

      tagEditorTarget = null;
      tagEditorTags = [];
      tagEditorInput = '';
      await loadWorkshopThemes({ page });
      void loadWorkshopTags();
    } catch (err) {
      tagEditorError = err instanceof Error ? err.message : String(err);
    } finally {
      tagSaving = false;
    }
  }

  async function handleForkTheme(theme: CommunityTheme) {
    if (
      theme.deletedAt ||
      theme.isHidden ||
      theme.allowForking === false ||
      forkingId ||
      deletingId ||
      moderatingId
    )
      return;
    if (!$currentUser) {
      sileo.error({
        title: 'Login required',
        description: 'Log in to EZPPFarm to fork community themes.',
      });
      return;
    }

    forkingId = theme.id;
    let fork: CommunityTheme;
    try {
      fork = await forkCommunityTheme(theme.id);
    } catch (err) {
      forkingId = null;
      sileo.error({
        title: 'Could not fork theme',
        description: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    forkingId = null;

    let installed: Theme | undefined;
    try {
      await loadWorkshopThemes();
      activeThemeDownloads.add(fork.id);
      themeDownloadProgress.set(fork.id, 10);
      const res = await downloadAndInstallCommunityTheme(fork, (_status, progress) => {
        themeDownloadProgress.set(fork.id, progress);
      });
      installed = $custom_themes.find(
        (candidate) => candidate.folder_name.toLowerCase() === res.folderName.toLowerCase()
      );
    } catch (err) {
      sileo.error({
        title: 'Fork created, but download failed',
        description: `${err instanceof Error ? err.message : String(err)} You can download it from the workshop.`,
      });
    } finally {
      activeThemeDownloads.delete(fork.id);
      themeDownloadProgress.delete(fork.id);
    }

    if (installed) {
      sileo.success({
        title: 'Theme forked',
        description: `"${fork.name}" is now yours. Edit and publish it when you're ready.`,
      });
      await onEditTheme(installed);
    }
  }

  function requestDeleteTheme(theme: CommunityTheme) {
    if (theme.deletedAt || deletingId || forkingId || moderatingId) return;
    openPendingAction({ kind: 'delete', theme });
  }

  async function applyDeleteTheme(theme: CommunityTheme) {
    deletingId = theme.id;
    try {
      await deleteCommunityTheme(theme.id);
      themes = themes.filter((item) => item.id !== theme.id);
      totalThemes = Math.max(0, totalThemes - 1);
      sileo.success({
        title: 'Moved to trash',
        description: `"${theme.name}" can be restored from the Trash view.`,
      });
      const nextPage = themes.length === 0 && page > 1 ? page - 1 : page;
      await loadWorkshopThemes({ page: nextPage });
      void loadWorkshopTags();
    } finally {
      deletingId = null;
    }
  }

  function openRestoreDialog(theme: CommunityTheme) {
    if (restoringId || purgingId || forkingId || deletingId || moderatingId) return;
    purgeTarget = null;
    trashActionError = null;
    restoreTarget = theme;
  }

  function openPermanentDeleteDialog(theme: CommunityTheme) {
    if (restoringId || purgingId || forkingId || deletingId || moderatingId) return;
    restoreTarget = null;
    trashActionError = null;
    purgeTarget = theme;
  }

  function closeRestoreDialog() {
    if (restoringId) return;
    restoreTarget = null;
    trashActionError = null;
  }

  function closePermanentDeleteDialog() {
    if (purgingId) return;
    purgeTarget = null;
    trashActionError = null;
  }

  async function handleRestoreTheme() {
    const theme = restoreTarget;
    if (!theme || restoringId || purgingId) return;

    restoringId = theme.id;
    trashActionError = null;
    try {
      await restoreCommunityTheme(theme.id);
      themes = themes.filter((item) => item.id !== theme.id);
      totalThemes = Math.max(0, totalThemes - 1);
      restoreTarget = null;
      sileo.success({
        title: 'Theme restored',
        description: `"${theme.name}" is back in the workshop.`,
      });
      await loadWorkshopThemes({ page: themes.length === 0 && page > 1 ? page - 1 : page });
      void loadWorkshopTags();
    } catch (err) {
      trashActionError = err instanceof Error ? err.message : String(err);
    } finally {
      restoringId = null;
    }
  }

  async function handlePermanentDeleteTheme() {
    const theme = purgeTarget;
    if (!theme || restoringId || purgingId) return;

    purgingId = theme.id;
    trashActionError = null;
    try {
      await permanentlyDeleteCommunityTheme(theme.id);
      themes = themes.filter((item) => item.id !== theme.id);
      totalThemes = Math.max(0, totalThemes - 1);
      purgeTarget = null;
      sileo.success({
        title: 'Theme permanently deleted',
        description: `"${theme.name}" and its server files were removed.`,
      });
      await loadWorkshopThemes({ page: themes.length === 0 && page > 1 ? page - 1 : page });
      void loadWorkshopTags();
    } catch (err) {
      trashActionError = err instanceof Error ? err.message : String(err);
    } finally {
      purgingId = null;
    }
  }

  function openReportDialog(theme: CommunityTheme) {
    if (theme.deletedAt || theme.isHidden) return;
    if (!$currentUser) {
      sileo.error({
        title: 'Login required',
        description: 'Log in to EZPPFarm to report a community theme.',
      });
      return;
    }

    reportTarget = theme;
    reportCategory = 'other';
    reportDetails = '';
    reportError = null;
  }

  function closeReportDialog() {
    if (!reportSubmitting) reportTarget = null;
  }

  async function submitReport() {
    const target = reportTarget;
    if (!target || reportSubmitting) return;
    const reason = reportDetails.trim();
    if (reason.length < 10) {
      reportError = 'Please describe the problem in at least 10 characters.';
      return;
    }

    reportSubmitting = true;
    reportError = null;
    try {
      await reportCommunityTheme(target.id, reason.slice(0, 500), reportCategory);
      sileo.success({
        title: 'Report submitted',
        description: 'Thank you. A moderator will review the theme.',
      });
      reportTarget = null;
      reportDetails = '';
      reportCategory = 'other';
    } catch (err) {
      reportError = err instanceof Error ? err.message : String(err);
    } finally {
      reportSubmitting = false;
    }
  }

  function currentReportFilters(): ThemeReportQuery {
    return {
      status: moderationStatus,
      q: moderationQuery.trim() || undefined,
      category: moderationCategory,
      author: moderationAuthor.trim() || undefined,
      from: moderationFrom || undefined,
      to: moderationTo || undefined,
    };
  }

  function currentEventFilters(): ModerationEventQuery {
    return {
      action: moderationEventAction,
      actor: moderationEventActor.trim() || undefined,
      from: moderationFrom || undefined,
      to: moderationTo || undefined,
    };
  }

  function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  async function loadModerationPanel(page = moderationPage) {
    if (!canModerate) return;
    const requestId = ++moderationRequestId;
    moderationLoading = true;
    moderationError = null;

    const [reportsResult, eventsResult, reviewResult] = await Promise.allSettled([
      fetchThemeReports({ ...currentReportFilters(), page, limit: 50 }),
      fetchModerationEvents({ ...currentEventFilters(), page: 1, limit: 50 }),
      fetchThemeReviewQueue('pending', 1, 50),
    ]);

    if (requestId !== moderationRequestId) return;

    const errors: string[] = [];
    if (reportsResult.status === 'fulfilled') {
      moderationReports = reportsResult.value.reports;
      moderationTotal = reportsResult.value.total;
      moderationPage = reportsResult.value.page;
      moderationTotalPages = reportsResult.value.totalPages;
      selectedReportIds = [];
    } else {
      errors.push(`Reports: ${errorMessage(reportsResult.reason)}`);
    }

    if (eventsResult.status === 'fulfilled') {
      moderationEvents = eventsResult.value.events;
      moderationEventsPage = eventsResult.value.page;
      moderationEventsTotalPages = eventsResult.value.totalPages;
    } else {
      errors.push(`Activity: ${errorMessage(eventsResult.reason)}`);
    }

    if (reviewResult.status === 'fulfilled') {
      reviewQueue = reviewResult.value.items;
      reviewTotal = reviewResult.value.total;
      reviewPage = reviewResult.value.page;
      reviewTotalPages = reviewResult.value.totalPages;
    } else {
      errors.push(`Review queue: ${errorMessage(reviewResult.reason)}`);
    }

    moderationError = errors.length > 0 ? errors.join(' · ') : null;
    if (requestId === moderationRequestId) moderationLoading = false;
  }

  function openModerationPanel() {
    showModerationPanel = true;
    void loadModerationPanel(1);
  }

  function handleModerationFilterChange() {
    moderationPage = 1;
    moderationEventsPage = 1;
    selectedReportIds = [];
    void loadModerationPanel(1);
  }

  function requestReviewTheme(theme: CommunityTheme, status: 'approved' | 'rejected') {
    if (reviewActionId) return;
    openPendingAction({ kind: status === 'approved' ? 'review-approve' : 'review-reject', theme });
  }

  async function performThemeReview(
    theme: CommunityTheme,
    status: 'approved' | 'rejected',
    note?: string
  ) {
    if (reviewActionId) return;
    reviewActionId = theme.id;
    try {
      await reviewCommunityTheme(theme.id, status, note?.trim() || undefined);
      sileo.success({
        title: status === 'approved' ? 'Theme approved' : 'Theme rejected',
        description:
          status === 'approved'
            ? `"${theme.name}" is now listed in the Community Workshop.`
            : `"${theme.name}" stays hidden until the creator republishes it.`,
      });
      await loadModerationPanel(moderationPage);
      void loadWorkshopThemes({ page });
    } finally {
      reviewActionId = null;
    }
  }

  function handleAuditFilterChange() {
    moderationEventsPage = 1;
    selectedReportIds = [];
    void loadModerationPanel(moderationPage);
  }

  function goToModerationPage(page: number) {
    if (page < 1 || page > moderationTotalPages || page === moderationPage) return;
    selectedReportIds = [];
    void loadModerationPanel(page);
  }

  async function loadOlderEvents() {
    if (eventsLoadingMore || moderationEventsPage >= moderationEventsTotalPages) return;
    const requestId = moderationRequestId;
    eventsLoadingMore = true;
    try {
      const result = await fetchModerationEvents({
        ...currentEventFilters(),
        page: moderationEventsPage + 1,
        limit: 50,
      });
      if (requestId !== moderationRequestId) return;
      const known = new Set(moderationEvents.map((event) => event.id));
      moderationEvents = [
        ...moderationEvents,
        ...result.events.filter((event) => !known.has(event.id)),
      ];
      moderationEventsPage = result.page;
      moderationEventsTotalPages = result.totalPages;
    } catch (err) {
      moderationError = errorMessage(err);
    } finally {
      eventsLoadingMore = false;
    }
  }

  async function loadMoreReviews() {
    if (reviewLoadingMore || reviewPage >= reviewTotalPages) return;
    const requestId = moderationRequestId;
    reviewLoadingMore = true;
    try {
      const result = await fetchThemeReviewQueue('pending', reviewPage + 1, 50);
      if (requestId !== moderationRequestId) return;
      const known = new Set(reviewQueue.map((theme) => theme.id));
      reviewQueue = [...reviewQueue, ...result.items.filter((theme) => !known.has(theme.id))];
      reviewTotal = result.total;
      reviewPage = result.page;
      reviewTotalPages = result.totalPages;
    } catch (err) {
      moderationError = errorMessage(err);
    } finally {
      reviewLoadingMore = false;
    }
  }

  async function handleExportEvents() {
    if (exportingEvents) return;
    exportingEvents = true;
    try {
      await downloadModerationEventsCsv(currentEventFilters());
      sileo.success({ title: 'Moderation history exported' });
    } catch (err) {
      sileo.error({
        title: 'Could not export moderation history',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      exportingEvents = false;
    }
  }

  function handleToggleQuarantine(theme: CommunityTheme) {
    if (!canModerate || quarantineId) return;
    quarantineTarget = theme;
    quarantineAction = theme.isQuarantined ? 'lift' : 'take_down';
    quarantineReason = '';
    quarantineError = null;
  }

  function closeQuarantineDialog() {
    if (quarantineId) return;
    quarantineTarget = null;
    quarantineReason = '';
    quarantineError = null;
  }

  async function confirmQuarantine() {
    const theme = quarantineTarget;
    if (!theme || quarantineId) return;

    const takingDown = quarantineAction === 'take_down';
    const reason = quarantineReason.trim();
    if (takingDown && reason.length < 3) {
      quarantineError = 'Please provide a reason of at least 3 characters.';
      return;
    }

    quarantineId = theme.id;
    quarantineError = null;
    try {
      await setCommunityThemeQuarantine(theme.id, takingDown, reason || undefined);
      sileo.success({
        title: takingDown ? 'Theme taken down' : 'Takedown lifted',
        description: `"${theme.name}" was updated.`,
      });
      quarantineTarget = null;
      quarantineReason = '';
      await loadWorkshopThemes({ page });
      if (themes.length === 0 && page > 1) {
        await loadWorkshopThemes({ page: page - 1 });
      }
      if (showModerationPanel) await loadModerationPanel(moderationPage);
    } catch (err) {
      quarantineError = err instanceof Error ? err.message : String(err);
    } finally {
      quarantineId = null;
    }
  }

  function openAnnouncementComposer() {
    // The moderation panel is a modal Dialog; close it before opening another overlay.
    showModerationPanel = false;
    announcementOpen = true;
    announcementTitle = '';
    announcementMessage = '';
    announcementAudience = 'all';
    announcementError = null;
  }

  function closeAnnouncementComposer() {
    if (!announcementSending) announcementOpen = false;
  }

  async function submitAnnouncement() {
    if (announcementSending) return;
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();
    if (title.length < 3) {
      announcementError = 'Title must be at least 3 characters.';
      return;
    }
    if (message.length < 10) {
      announcementError = 'Message must be at least 10 characters.';
      return;
    }

    announcementSending = true;
    announcementError = null;
    try {
      const result = await sendSystemAnnouncement({
        title: title.slice(0, 120),
        message: message.slice(0, 1000),
        audience: announcementAudience,
      });
      announcementOpen = false;
      sileo.success({
        title: 'Announcement sent',
        description: `${result.recipients} recipient(s) notified.`,
      });
    } catch (err) {
      announcementError = err instanceof Error ? err.message : String(err);
    } finally {
      announcementSending = false;
    }
  }

  function toggleReportSelection(reportId: number) {
    selectedReportIds = selectedReportIds.includes(reportId)
      ? selectedReportIds.filter((id) => id !== reportId)
      : [...selectedReportIds, reportId];
  }

  function toggleAllReports() {
    if (allSelectableReportsSelected) {
      selectedReportIds = [];
    } else {
      selectedReportIds = selectableReports.map((report) => report.id);
    }
  }

  function requestBulkReports(action: 'hide' | 'resolved' | 'dismissed') {
    if (selectedReportIds.length === 0 || bulkAction) return;
    openPendingAction({
      kind: 'bulk-reports',
      action,
      reportIds: [...selectedReportIds],
    });
  }

  async function applyBulkReportAction(
    action: 'hide' | 'resolved' | 'dismissed',
    note?: string,
    reportIds: number[] = selectedReportIds
  ) {
    if (reportIds.length === 0 || bulkAction) return;

    bulkAction = action;
    try {
      const result = await bulkResolveThemeReports(reportIds, action, note);
      sileo.success({
        title: 'Reports updated',
        description: `${result.updated} report(s) processed across ${result.themes} theme(s).`,
      });
      selectedReportIds = [];
      await loadModerationPanel(1);
      await loadWorkshopThemes({ page });
      if (themes.length === 0 && page > 1) {
        await loadWorkshopThemes({ page: page - 1 });
      }
    } finally {
      bulkAction = null;
    }
  }

  async function handleExportReports() {
    if (exportingReports) return;
    exportingReports = true;
    try {
      const truncated = await downloadThemeReportsCsv(currentReportFilters());
      sileo.success({
        title: 'Report export downloaded',
        description: truncated
          ? 'The export is capped at 5,000 rows. Narrow the date range for the rest.'
          : undefined,
      });
    } catch (err) {
      sileo.error({
        title: 'Could not export reports',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      exportingReports = false;
    }
  }

  function requestReportHide(report: ThemeReport) {
    if (reportActionId !== null) return;
    openPendingAction({ kind: 'report-hide', report }, report.reason.slice(0, 500));
  }

  async function applyReportHide(report: ThemeReport, note?: string) {
    if (reportActionId !== null) return;
    reportActionId = report.id;
    try {
      await setCommunityThemeVisibility(
        report.themeId,
        true,
        (note || report.reason).slice(0, 255)
      );
      sileo.success({
        title: 'Theme hidden',
        description: `"${report.themeName}" was hidden and the report was resolved.`,
      });
      await loadModerationPanel(moderationPage);
      await loadWorkshopThemes({ page });
      if (themes.length === 0 && page > 1) {
        await loadWorkshopThemes({ page: page - 1 });
      }
    } finally {
      reportActionId = null;
    }
  }

  function requestReportDismiss(report: ThemeReport) {
    if (reportActionId !== null) return;
    openPendingAction({ kind: 'report-dismiss', report });
  }

  async function applyReportDismiss(report: ThemeReport, note?: string) {
    if (reportActionId !== null) return;
    reportActionId = report.id;
    try {
      await resolveThemeReport(report.id, 'dismissed', note);
      sileo.success({ title: 'Report dismissed' });
      await loadModerationPanel(moderationPage);
    } finally {
      reportActionId = null;
    }
  }

  function closeHistoryDialog() {
    historyOpen = false;
    historyRequestId += 1;
    historyLoading = false;
    historyLoadingMore = false;
  }

  async function openThemeHistory(themeId: string, themeName: string) {
    // A custom modal cannot stack reliably over a portaled modal Dialog.
    showModerationPanel = false;
    historyOpen = true;
    historyTarget = { id: themeId, name: themeName };
    historyEvents = [];
    historyPage = 1;
    historyTotalPages = 1;
    historyError = null;
    historyLoading = true;
    historyLoadingMore = false;
    const requestId = ++historyRequestId;
    try {
      const result = await fetchModerationEvents({ themeId, page: 1, limit: 50 });
      if (requestId !== historyRequestId) return;
      historyEvents = result.events;
      historyPage = result.page;
      historyTotalPages = result.totalPages;
    } catch (err) {
      if (requestId === historyRequestId) historyError = errorMessage(err);
    } finally {
      if (requestId === historyRequestId) historyLoading = false;
    }
  }

  async function loadOlderHistory() {
    if (!historyOpen || !historyTarget || historyLoadingMore || historyPage >= historyTotalPages)
      return;

    const requestId = historyRequestId;
    historyLoadingMore = true;
    try {
      const result = await fetchModerationEvents({
        themeId: historyTarget.id,
        page: historyPage + 1,
        limit: 50,
      });
      if (requestId !== historyRequestId) return;
      const known = new Set(historyEvents.map((event) => event.id));
      historyEvents = [...historyEvents, ...result.events.filter((event) => !known.has(event.id))];
      historyPage = result.page;
      historyTotalPages = result.totalPages;
    } catch (err) {
      sileo.error({
        title: 'Could not load older history',
        description: errorMessage(err),
      });
    } finally {
      if (requestId === historyRequestId) historyLoadingMore = false;
    }
  }

  function closeSourceDialog() {
    sourceDialogOpen = false;
  }

  async function handleOpenForkSource(theme: CommunityTheme) {
    if (!theme.forkedFrom) return;
    sourceDialogOpen = true;
    sourceLoading = true;
    sourceError = null;
    sourceTheme = null;
    try {
      sourceTheme = await fetchCommunityThemeDetails(theme.forkedFrom.id);
    } catch {
      sourceError = 'The original theme is no longer available in the workshop.';
    } finally {
      sourceLoading = false;
    }
  }

  function moderationActionLabel(action: string): string {
    return MODERATION_ACTIONS[action] ?? action;
  }

  function reportCategoryLabel(category: ThemeReportCategory): string {
    return REPORT_CATEGORIES.find((item) => item.id === category)?.label ?? category;
  }

  function formatModerationDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function modalFocus(node: HTMLElement, onClose: () => void) {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      [...node.querySelectorAll<HTMLElement>(selector)].filter(
        (element) => element.getClientRects().length > 0
      );

    node.setAttribute('tabindex', '-1');
    const preferred = node.querySelector<HTMLElement>('[data-autofocus]');
    const initial = preferred ?? focusable()[0] ?? node;
    requestAnimationFrame(() => initial.focus());

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', handleKeydown);
    return {
      destroy() {
        node.removeEventListener('keydown', handleKeydown);
        if (previous?.isConnected) previous.focus();
      },
    };
  }

  onMount(() => {
    void loadWorkshopThemes();
    void loadWorkshopTags();
  });

  onDestroy(() => {
    clearTimeout(searchDebounceTimeout);
    moderationRequestId += 1;
    historyRequestId += 1;
  });
</script>

<Tooltip.Provider delayDuration={220}>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Workshop Filter & Search Toolbar -->
    <div class="flex flex-col gap-2.5 pb-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <!-- Tag Chips / Trash label -->
        <div class="flex min-w-0 flex-wrap items-center gap-1">
          {#if selectedView === 'trash'}
            <span
              class="flex items-center gap-1 rounded-full border border-red-900/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-medium text-red-300"
            >
              <Archive class="size-3" />
              Your trash
            </span>
          {:else}
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors {selectedTag ===
              'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-theme-900/60 text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
              onclick={() => handleTagClick('all')}
            >
              All Tags
            </button>

            <Popover.Root bind:open={tagFilterOpen}>
              <Popover.Trigger
                class="flex h-7 max-w-44 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors {selectedTag ===
                'all'
                  ? 'border-theme-800 bg-theme-900/60 text-muted-foreground hover:bg-theme-800/60 hover:text-white'
                  : 'border-primary/40 bg-primary/15 text-primary'}"
                aria-label="Filter workshop by tag"
              >
                <Tag class="size-3 shrink-0" />
                <span class="truncate">
                  {selectedTag === 'all' ? 'Filter by tag' : `#${selectedTag}`}
                </span>
                {#if tagOptions.length > 0}
                  <span
                    class="shrink-0 rounded bg-theme-800/80 px-1 text-[9px] tabular-nums text-muted-foreground"
                  >
                    {tagOptions.length}
                  </span>
                {/if}
                {#if tagsLoading}
                  <LoaderCircle class="size-3 shrink-0 animate-spin" />
                {:else}
                  <ChevronDown class="size-3 shrink-0 opacity-60" />
                {/if}
              </Popover.Trigger>

              <Popover.Content
                align="start"
                class="w-72 border-theme-800 bg-theme-950 p-0 text-theme-50 shadow-2xl"
              >
                <div class="border-b border-theme-800/70 p-2">
                  <div class="relative">
                    <Search
                      class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      bind:value={tagSearch}
                      class="h-8 border-theme-800 bg-theme-900/60 pr-8 pl-8 text-[11px]"
                      placeholder="Search used tags..."
                      autofocus
                    />
                    {#if tagSearch}
                      <button
                        type="button"
                        class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-white"
                        aria-label="Clear tag search"
                        onclick={() => (tagSearch = '')}
                      >
                        <X class="size-3.5" />
                      </button>
                    {/if}
                  </div>
                </div>

                <div class="max-h-64 overflow-y-auto p-1">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] transition-colors {selectedTag ===
                    'all'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
                    onclick={() => handleTagClick('all')}
                  >
                    <span class="flex items-center gap-2"><Tag class="size-3" /> All tags</span>
                    {#if selectedTag === 'all'}<Check class="size-3" />{/if}
                  </button>

                  {#if filteredTagOptions.length === 0}
                    <p class="px-2 py-4 text-center text-[10px] text-muted-foreground">
                      {tagOptions.length === 0
                        ? 'No tags are in use yet.'
                        : 'No tags match your search.'}
                    </p>
                  {:else}
                    {#each filteredTagOptions as option (option.tag)}
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-[11px] transition-colors {selectedTag ===
                        option.tag
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
                        onclick={() => handleTagClick(option.tag)}
                      >
                        <span class="truncate">#{option.tag}</span>
                        <span class="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                          {option.count}
                        </span>
                      </button>
                    {/each}
                  {/if}
                </div>
              </Popover.Content>
            </Popover.Root>

            {#if canModerate}
              <WorkshopTooltip content="Show only hidden themes">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors {showHiddenOnly
                      ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                      : 'bg-theme-900/60 text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
                    onclick={handleHiddenFilter}
                  >
                    <EyeOff class="size-3" />
                    Hidden
                  </button>
                {/snippet}
              </WorkshopTooltip>
            {/if}
          {/if}
        </div>

        <!-- Controls Right: Sort, Search, Moderation, Trash & Refresh -->
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Select.Root
            type="single"
            value={selectedSort}
            onValueChange={(value) => {
              if (!value) return;
              handleSortChange(parseWorkshopSort(value));
            }}
          >
            <Select.Trigger
              class="h-7.5 w-36 border-theme-800 bg-theme-950/80 px-2.5 text-[11px] text-muted-foreground transition-colors hover:text-white"
              aria-label="Sort themes"
            >
              {SORT_OPTIONS.find((option) => option.id === selectedSort)?.label ?? 'Best match'}
            </Select.Trigger>
            <Select.Content class="border-theme-800 bg-theme-950">
              {#each SORT_OPTIONS as option (option.id)}
                <Select.Item value={option.id} label={option.label} />
              {/each}
            </Select.Content>
          </Select.Root>

          <div class="relative w-48">
            <Search
              class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <WorkshopTooltip
              content="Typed search: tag:anime, author:name, name:night, id:my-theme"
            >
              {#snippet trigger(props)}
                <Input
                  {...props}
                  type="text"
                  class="h-7.5 border-theme-800 bg-theme-950/80 pl-8 text-[11px]"
                  placeholder={selectedView === 'trash'
                    ? 'Search trash...'
                    : 'Search themes, tags, authors...'}
                  bind:value={searchQuery}
                  oninput={handleSearchInput}
                />
              {/snippet}
            </WorkshopTooltip>
          </div>

          {#if canModerate}
            <WorkshopTooltip content="Moderation queue and audit history">
              {#snippet trigger(props)}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  class="size-7.5 text-muted-foreground hover:text-amber-300"
                  onclick={openModerationPanel}
                >
                  <Flag class="size-3.5" />
                </Button>
              {/snippet}
            </WorkshopTooltip>
          {/if}

          {#if $currentUser}
            <WorkshopTooltip content={selectedView === 'trash' ? 'Back to workshop' : 'Open trash'}>
              {#snippet trigger(props)}
                <Button
                  {...props}
                  variant={selectedView === 'trash' ? 'secondary' : 'ghost'}
                  size="icon"
                  class="size-7.5 text-muted-foreground hover:text-white"
                  onclick={() => handleViewChange(selectedView === 'trash' ? 'workshop' : 'trash')}
                >
                  <Archive class="size-3.5" />
                </Button>
              {/snippet}
            </WorkshopTooltip>
          {/if}

          <WorkshopTooltip content="Refresh Workshop">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7.5 text-muted-foreground hover:text-white"
                onclick={() => {
                  void loadWorkshopThemes();
                  void loadWorkshopTags();
                }}
                disabled={loading}
              >
                <RefreshCw class="size-3.5 {loading ? 'animate-spin' : ''}" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
      </div>
    </div>

    <!-- Content Grid / Status -->
    <div class="min-h-0 flex-1 pt-1">
      <ScrollContainer class="pr-2">
        {#if error && themes.length > 0}
          <div
            class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100"
          >
            <TriangleAlert class="size-3.5 shrink-0 text-amber-300" />
            <span class="min-w-0 flex-1">Showing the last loaded results. {error}</span>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-[10px] text-amber-100 hover:bg-amber-500/15 hover:text-white"
              onclick={() => void loadWorkshopThemes({ page })}
            >
              Retry
            </Button>
          </div>
        {/if}

        {#if loading && themes.length === 0}
          <div class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
            <LoaderCircle class="size-6 animate-spin text-primary" />
            <p class="text-xs">Connecting to EZPPFarm Community Workshop...</p>
          </div>
        {:else if error && themes.length === 0}
          <div class="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <div class="rounded-full bg-red-500/10 p-3 text-red-400">
              <Globe class="size-6" />
            </div>
            <div class="max-w-md">
              <p class="text-sm font-semibold text-white">Workshop unavailable</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Check your connection and try again. If this keeps happening, the workshop may be
                under maintenance.
              </p>
              <p class="mt-2 text-[10px] text-muted-foreground/70">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              class="mt-2 text-xs"
              onclick={() => void loadWorkshopThemes()}
            >
              <RefreshCw class="mr-1.5 size-3.5" />
              Try Again
            </Button>
          </div>
        {:else if themes.length === 0}
          <div
            class="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground"
          >
            <Globe class="size-8 opacity-40" />
            <p class="max-w-sm text-xs">
              {#if selectedView === 'trash'}
                Your trash is empty. Themes you delete will appear here.
              {:else if searchQuery.trim() || selectedTag !== 'all'}
                No themes match these filters.
              {:else}
                No community themes have been published yet.
              {/if}
            </p>
            {#if selectedView === 'workshop' && (searchQuery.trim() || selectedTag !== 'all')}
              <Button
                variant="secondary"
                size="sm"
                class="mt-1 text-xs"
                onclick={clearWorkshopFilters}
              >
                Clear filters
              </Button>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-3 gap-3 pb-4">
            {#each themes as theme (theme.id)}
              {@const localTheme =
                localThemeMap.get(theme.id.toLowerCase()) ||
                localThemeMap.get(theme.name.toLowerCase())}
              {@const isInstalled = Boolean(localTheme)}
              {@const isActive = Boolean(
                localTheme && $active_custom_theme?.folder_name === localTheme.folder_name
              )}
              {@const isDownloading = activeThemeDownloads.has(theme.id)}
              {@const downloadPercent = themeDownloadProgress.get(theme.id) ?? 0}
              {@const isDeleted = Boolean(theme.deletedAt)}
              {@const hasUpdate = Boolean(
                !isDeleted && localTheme && localTheme.version !== theme.version
              )}
              {@const owned = isOwnedByCurrentUser(theme)}
              {@const isLegacy =
                theme.apiVersion === '1.0' || Boolean(theme.tags?.includes('legacy'))}
              {@const canReport =
                Boolean($currentUser) && !owned && !theme.isHidden && !theme.isQuarantined}
              {@const canFork = canReport && !isLegacy && theme.allowForking !== false}
              {@const showOverflowMenu = !isDeleted && (owned || canModerate || canReport)}

              <div
                class="group flex flex-col overflow-hidden rounded-xl border bg-theme-900/30 {isActive
                  ? 'border-primary/60 ring-1 ring-primary/20'
                  : 'border-theme-800/60'} transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-theme-900/50 hover:shadow-xl hover:shadow-black/30"
              >
                <!-- 16:9 Thumbnail -->
                <div class="relative aspect-video w-full shrink-0 overflow-hidden bg-theme-950/70">
                  <img
                    src={theme.previewUrl}
                    alt={theme.name}
                    class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                    onerror={(e) => {
                      // Fallback to default theme preview if server preview not loaded
                      (e.currentTarget as HTMLImageElement).src = DefaultThemePreview;
                    }}
                  />
                  <div
                    class="pointer-events-none absolute inset-0 bg-gradient-to-t from-theme-950/90 via-transparent to-transparent"
                  ></div>

                  <!-- Top Left: Trust Badge -->
                  <div class="absolute top-2 right-14 left-2 flex flex-wrap items-center gap-1.5">
                    {#if theme.apiVersion === '1.0' || theme.tags?.includes('legacy')}
                      <WorkshopTooltip content="Legacy v1 theme: video/audio playback">
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-950/80 px-1.5 py-0.5 text-[9px] font-medium text-purple-300 backdrop-blur-sm"
                          >
                            <Sparkles class="size-3 text-purple-300" />
                            Legacy v1
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {:else if theme.hasExecutableCode}
                      <WorkshopTooltip content="Contains custom Svelte 5 executable logic">
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 backdrop-blur-sm"
                          >
                            <Code2 class="size-3" />
                            Svelte Code
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                    {#if theme.reviewStatus === 'pending'}
                      <WorkshopTooltip
                        content="Waiting for staff review before it is listed publicly"
                      >
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/85 px-1.5 py-0.5 text-[9px] font-medium text-amber-200 backdrop-blur-sm"
                          >
                            <LoaderCircle class="size-3" />
                            In review
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {:else if theme.reviewStatus === 'rejected'}
                      <WorkshopTooltip
                        content={`Not approved${theme.reviewNote ? `: ${theme.reviewNote}` : ''}`}
                      >
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/85 px-1.5 py-0.5 text-[9px] font-medium text-red-200 backdrop-blur-sm"
                          >
                            <X class="size-3" />
                            Rejected
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                    {#if theme.isHidden}
                      <WorkshopTooltip
                        content={`${theme.hiddenReason || 'Hidden by a moderator'}${
                          theme.hiddenByName ? ` · by ${theme.hiddenByName}` : ''
                        }${theme.hiddenAt ? ` · ${formatModerationDate(theme.hiddenAt)}` : ''}`}
                      >
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/85 px-1.5 py-0.5 text-[9px] font-medium text-red-300 backdrop-blur-sm"
                          >
                            <EyeOff class="size-3" />
                            Hidden
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                    {#if theme.isQuarantined}
                      <WorkshopTooltip
                        content={`${theme.quarantineReason || 'Taken down by staff'}${
                          theme.quarantinedByName ? ` · by ${theme.quarantinedByName}` : ''
                        }${theme.quarantinedAt ? ` · ${formatModerationDate(theme.quarantinedAt)}` : ''}`}
                      >
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-red-500/50 bg-red-950/90 px-1.5 py-0.5 text-[9px] font-medium text-red-200 backdrop-blur-sm"
                          >
                            <Ban class="size-3" />
                            Taken down
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                    {#if isDeleted}
                      <WorkshopTooltip content="This theme is in your trash">
                        {#snippet trigger(props)}
                          <span
                            {...props}
                            tabindex="-1"
                            class="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/85 px-1.5 py-0.5 text-[9px] font-medium text-red-300 backdrop-blur-sm"
                          >
                            <Trash2 class="size-3" />
                            Trash
                          </span>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                  </div>

                  <!-- Top Right: Version -->
                  <div class="absolute top-2 right-2">
                    <span
                      class="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm"
                    >
                      v{theme.version}
                    </span>
                  </div>

                  <!-- Bottom: Author Info -->
                  <div
                    class="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2"
                  >
                    <div class="flex min-w-0 items-center gap-1.5">
                      <img
                        src={theme.author.avatarUrl}
                        alt={theme.author.name}
                        class="size-5 rounded-full border border-white/20 bg-theme-900 object-cover"
                        onerror={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span class="truncate text-[11px] font-semibold text-white/95 drop-shadow-sm">
                        {theme.author.name}
                      </span>
                      {#if theme.author.role === 'owner'}
                        <WorkshopTooltip content="EZPPFarm owner">
                          {#snippet trigger(props)}
                            <span
                              {...props}
                              tabindex="-1"
                              class="flex items-center gap-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 px-1 py-0.5 text-[8px] font-bold text-rose-200"
                            >
                              <Crown class="size-2.5 fill-rose-300" />
                              Owner
                            </span>
                          {/snippet}
                        </WorkshopTooltip>
                      {:else if theme.author.role === 'moderator'}
                        <WorkshopTooltip content="Community Workshop moderator">
                          {#snippet trigger(props)}
                            <span
                              {...props}
                              tabindex="-1"
                              class="flex items-center gap-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/20 px-1 py-0.5 text-[8px] font-bold text-cyan-200"
                            >
                              <ShieldCheck class="size-2.5" />
                              Moderator
                            </span>
                          {/snippet}
                        </WorkshopTooltip>
                      {:else if theme.author.role === 'supporter' || (!theme.author.role && theme.author.donor)}
                        <WorkshopTooltip content="EZPPFarm Supporter">
                          {#snippet trigger(props)}
                            <span
                              {...props}
                              tabindex="-1"
                              class="flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold text-amber-300"
                            >
                              <Sparkles class="size-2.5 fill-amber-300" />
                              Supporter
                            </span>
                          {/snippet}
                        </WorkshopTooltip>
                      {/if}
                    </div>
                    <span class="text-[9px] text-muted-foreground/90 tabular-nums">
                      {formatBytes(theme.fileSize)}
                    </span>
                  </div>
                </div>

                <!-- Body -->
                <div class="flex flex-1 flex-col justify-between gap-2 p-3">
                  <div class="min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h3
                        class="truncate text-[13px] font-bold text-white group-hover:text-primary transition-colors"
                      >
                        {theme.name}
                      </h3>

                      <!-- Interactive Like Button -->
                      {#if isDeleted}
                        <span
                          class="flex items-center gap-1 rounded-full bg-red-950/40 px-2 py-0.5 text-[10px] text-red-300"
                        >
                          <Trash2 class="size-3" /> Deleted
                        </span>
                      {:else}
                        <WorkshopTooltip
                          content={!$currentUser
                            ? 'Log in to like themes'
                            : theme.isLiked
                              ? 'Unlike'
                              : 'Like'}
                        >
                          {#snippet trigger(props)}
                            <button
                              {...props}
                              type="button"
                              class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors disabled:cursor-wait disabled:opacity-60 {theme.isLiked
                                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                : 'bg-theme-800/40 text-muted-foreground hover:bg-theme-800/80 hover:text-white'}"
                              onclick={(e) => handleLike(theme, e)}
                              disabled={likePending.has(theme.id)}
                              aria-label={`${theme.isLiked ? 'Unlike' : 'Like'} ${theme.name}`}
                              aria-pressed={theme.isLiked}
                            >
                              <Heart
                                class="size-3 {theme.isLiked ? 'fill-rose-400 text-rose-400' : ''}"
                              />
                              <span class="tabular-nums text-[10px]">{theme.likeCount}</span>
                            </button>
                          {/snippet}
                        </WorkshopTooltip>
                      {/if}
                    </div>

                    {#if theme.description}
                      <p
                        class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground"
                      >
                        {theme.description}
                      </p>
                    {/if}

                    {#if theme.tags && theme.tags.length > 0}
                      <div class="mt-2 flex flex-wrap gap-1">
                        {#each theme.tags.slice(0, 3) as tag (tag)}
                          <button
                            type="button"
                            class="cursor-pointer rounded px-1.5 py-0.5 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 {selectedTag ===
                            tag
                              ? 'bg-primary/20 text-primary'
                              : 'bg-theme-800/50 text-muted-foreground hover:bg-theme-800 hover:text-white'}"
                            title={`Filter workshop by #${tag}`}
                            aria-label={`Filter workshop by #${tag}`}
                            aria-pressed={selectedTag === tag}
                            onclick={(event) => {
                              event.stopPropagation();
                              handleTagClick(tag);
                            }}
                          >
                            #{tag}
                          </button>
                        {/each}
                      </div>
                    {/if}

                    {#if owned && theme.reviewStatus !== 'approved'}
                      <div
                        class="mt-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-2 py-1.5 text-[9px] leading-relaxed"
                      >
                        {#if theme.reviewStatus === 'pending'}
                          <p class="text-amber-200/90">
                            <LoaderCircle class="mr-1 inline size-3 align-[-2px]" />
                            Awaiting staff review. Submitted
                            {formatModerationDate(theme.createdAt)}.
                          </p>
                        {:else}
                          <p class="text-red-200/90">
                            <X class="mr-1 inline size-3 align-[-2px]" />
                            Not approved{theme.reviewedAt
                              ? ` · ${formatModerationDate(theme.reviewedAt)}`
                              : ''}.
                          </p>
                          {#if theme.reviewNote}
                            <p class="mt-0.5 text-muted-foreground">{theme.reviewNote}</p>
                          {/if}
                        {/if}
                      </div>
                    {/if}

                    {#if theme.isHidden || theme.isQuarantined}
                      <div
                        class="mt-2 space-y-1 rounded-md border border-red-900/40 bg-red-950/15 px-2 py-1.5 text-[9px] leading-relaxed"
                      >
                        {#if theme.isHidden}
                          <p class="text-red-200/90">
                            <EyeOff class="mr-1 inline size-3 align-[-2px]" />
                            Hidden by {theme.hiddenByName ?? 'staff'}
                            {#if theme.hiddenAt}
                              · {formatModerationDate(theme.hiddenAt)}
                            {/if}
                          </p>
                          {#if theme.hiddenReason}
                            <p class="text-muted-foreground">{theme.hiddenReason}</p>
                          {/if}
                        {/if}
                        {#if theme.isQuarantined}
                          <p class="text-red-200/90">
                            <Ban class="mr-1 inline size-3 align-[-2px]" />
                            Taken down by {theme.quarantinedByName ?? 'staff'}
                            {#if theme.quarantinedAt}
                              · {formatModerationDate(theme.quarantinedAt)}
                            {/if}
                          </p>
                          {#if theme.quarantineReason}
                            <p class="text-muted-foreground">{theme.quarantineReason}</p>
                          {/if}
                        {/if}
                      </div>
                    {/if}

                    {#if theme.forkedFrom}
                      {@const forkedFrom = theme.forkedFrom}
                      <WorkshopTooltip
                        content={`Open ${forkedFrom.name} by ${forkedFrom.authorName}`}
                      >
                        {#snippet trigger(props)}
                          <button
                            {...props}
                            type="button"
                            class="mt-2 flex max-w-full min-w-0 items-center gap-1 text-left text-[9px] text-muted-foreground transition-colors hover:text-white"
                            onclick={() => handleOpenForkSource(theme)}
                          >
                            <GitFork class="size-3 shrink-0" />
                            <span class="truncate">
                              Forked from <span class="text-white/75">{forkedFrom.name}</span>
                              by {forkedFrom.authorName}
                            </span>
                            <ExternalLink class="size-2.5 shrink-0 opacity-60" />
                          </button>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                  </div>

                  <!-- Footer Action Row -->
                  <div
                    class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-theme-800/40 pt-2.5"
                  >
                    <div class="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                      <span class="inline-flex items-center gap-1">
                        <Download class="size-3" />
                        <span class="tabular-nums">{theme.downloadCount}</span>
                      </span>
                      {#if isInstalled && !isActive}
                        <span
                          class="rounded-full bg-theme-800/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                        >
                          Installed
                        </span>
                      {/if}
                    </div>

                    <div class="flex shrink-0 items-center gap-1">
                      {#if isDownloading}
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] text-primary tabular-nums"
                            >{downloadPercent}%</span
                          >
                          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-theme-800">
                            <div
                              class="h-full bg-primary transition-all duration-200"
                              style="width: {downloadPercent}%"
                            ></div>
                          </div>
                        </div>
                      {:else if deletingId === theme.id}
                        <span class="flex items-center gap-1 text-[10px] text-red-300">
                          <LoaderCircle class="size-3 animate-spin" /> Deleting
                        </span>
                      {:else if forkingId === theme.id}
                        <span class="flex items-center gap-1 text-[10px] text-cyan-300">
                          <LoaderCircle class="size-3 animate-spin" /> Forking
                        </span>
                      {:else if moderatingId === theme.id}
                        <span class="flex items-center gap-1 text-[10px] text-amber-300">
                          <LoaderCircle class="size-3 animate-spin" /> Updating
                        </span>
                      {:else if isDeleted}
                        {#if owned}
                          <Button
                            variant="secondary"
                            size="sm"
                            class="h-7 gap-1 text-xs"
                            onclick={() => openRestoreDialog(theme)}
                            disabled={restoringId === theme.id || purgingId === theme.id}
                          >
                            {#if restoringId === theme.id}
                              <LoaderCircle class="size-3 animate-spin" />
                              Restoring
                            {:else}
                              <RotateCcw class="size-3" />
                              Restore
                            {/if}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-7 gap-1 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                            onclick={() => openPermanentDeleteDialog(theme)}
                            disabled={restoringId === theme.id || purgingId === theme.id}
                          >
                            {#if purgingId === theme.id}
                              <LoaderCircle class="size-3 animate-spin" />
                              Deleting...
                            {:else}
                              <Trash2 class="size-3" />
                              Delete forever
                            {/if}
                          </Button>
                        {:else}
                          <Badge
                            variant="outline"
                            class="border-red-500/40 bg-red-950/20 text-red-300 text-[10px]"
                          >
                            <Trash2 class="mr-1 size-3" /> Deleted
                          </Badge>
                        {/if}
                      {:else}
                        {#if owned && !isLegacy && isInstalled}
                          <Button
                            size="sm"
                            class="h-7 gap-1 text-xs"
                            onclick={() => handleEditTheme(theme)}
                          >
                            <Pencil class="size-3" />
                            Edit
                          </Button>
                        {:else if isActive}
                          <Badge
                            variant="outline"
                            class="border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-[10px]"
                          >
                            <Check class="mr-1 size-3" /> In use
                          </Badge>
                        {:else if isInstalled && hasUpdate}
                          <Button
                            size="sm"
                            class="h-7 gap-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                            onclick={() => handleDownloadTheme(theme)}
                          >
                            <Download class="size-3" />
                            Update
                          </Button>
                        {:else if isInstalled}
                          <Button
                            variant="secondary"
                            size="sm"
                            class="h-7 text-xs"
                            onclick={() => handleApplyExisting(theme)}
                          >
                            Apply
                          </Button>
                        {:else}
                          <Button
                            size="sm"
                            class="h-7 gap-1 text-xs"
                            onclick={() => handleDownloadTheme(theme)}
                          >
                            <Download class="size-3" />
                            Download
                          </Button>
                        {/if}

                        {#if showOverflowMenu}
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger>
                              {#snippet child({ props })}
                                <Button
                                  {...props}
                                  variant="ghost"
                                  size="icon"
                                  class="size-7 text-muted-foreground hover:text-white"
                                  aria-label="More actions for {theme.name}"
                                >
                                  <Ellipsis class="size-4" />
                                </Button>
                              {/snippet}
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content
                              align="end"
                              class="w-52 border-theme-700 bg-theme-950 text-theme-50"
                            >
                              {#if owned}
                                <DropdownMenu.Item
                                  class="gap-2 text-[11px]"
                                  onclick={() => openTagEditor(theme)}
                                >
                                  <Tag class="size-3.5" />
                                  Edit tags
                                </DropdownMenu.Item>
                                {#if !isLegacy && isInstalled && hasUpdate}
                                  <DropdownMenu.Item
                                    class="gap-2 text-[11px]"
                                    onclick={() => handleRefreshOwnedTheme(theme)}
                                  >
                                    <RefreshCw class="size-3.5" />
                                    Refresh installed copy
                                  </DropdownMenu.Item>
                                {/if}
                              {:else if canReport || canFork}
                                {#if canReport}
                                  <DropdownMenu.Item
                                    class="gap-2 text-[11px]"
                                    onclick={() => openReportDialog(theme)}
                                  >
                                    <Flag class="size-3.5" />
                                    Report theme
                                  </DropdownMenu.Item>
                                {/if}
                                {#if canFork}
                                  <DropdownMenu.Item
                                    class="gap-2 text-[11px]"
                                    onclick={() => handleForkTheme(theme)}
                                  >
                                    <CopyPlus class="size-3.5" />
                                    Fork theme
                                  </DropdownMenu.Item>
                                {/if}
                              {/if}

                              {#if canModerate}
                                {#if owned || canReport}
                                  <DropdownMenu.Separator class="my-1 bg-theme-800" />
                                {/if}
                                {#if !isLegacy}
                                  <DropdownMenu.Item
                                    class="gap-2 text-[11px]"
                                    onclick={() => requestVisibilityChange(theme)}
                                  >
                                    {#if theme.isHidden}
                                      <Eye class="size-3.5" />
                                      Restore visibility
                                    {:else}
                                      <EyeOff class="size-3.5" />
                                      Hide from workshop
                                    {/if}
                                  </DropdownMenu.Item>
                                {/if}
                                <DropdownMenu.Item
                                  class="gap-2 text-[11px]"
                                  onclick={() => handleToggleQuarantine(theme)}
                                  disabled={quarantineId === theme.id}
                                >
                                  {#if quarantineId === theme.id}
                                    <LoaderCircle class="size-3.5 animate-spin" />
                                    Updating...
                                  {:else}
                                    <Ban class="size-3.5" />
                                    {theme.isQuarantined ? 'Lift takedown' : 'Take down theme'}
                                  {/if}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  class="gap-2 text-[11px]"
                                  onclick={() => void openThemeHistory(theme.id, theme.name)}
                                >
                                  <History class="size-3.5" />
                                  Moderation history
                                </DropdownMenu.Item>
                              {/if}

                              {#if owned}
                                <DropdownMenu.Separator class="my-1 bg-theme-800" />
                                <DropdownMenu.Item
                                  class="gap-2 text-[11px] text-red-300 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-200"
                                  onclick={() => requestDeleteTheme(theme)}
                                >
                                  <Trash2 class="size-3.5" />
                                  Move to trash
                                </DropdownMenu.Item>
                              {/if}
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>
                        {/if}
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          {#if page < totalPages}
            <div class="flex items-center justify-center pb-4">
              <Button
                variant="secondary"
                size="sm"
                class="h-8 gap-1.5 text-xs"
                onclick={handleLoadMore}
                disabled={loadingMore}
              >
                {#if loadingMore}
                  <LoaderCircle class="size-3.5 animate-spin" />
                  Loading...
                {:else}
                  <ChevronDown class="size-3.5" />
                  Load more ({themes.length} of {totalThemes})
                {/if}
              </Button>
            </div>
          {/if}
        {/if}
      </ScrollContainer>
    </div>
  </div>

  <Dialog.Root bind:open={showModerationPanel}>
    <Dialog.Content
      class="top-12 bottom-4 flex h-auto w-[calc(100%_-_2rem)] max-w-6xl translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border-theme-800 bg-theme-950 p-0 text-white shadow-2xl sm:rounded-xl"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <Dialog.Title class="flex items-center gap-2 text-sm font-semibold text-white">
            <Flag class="size-4 text-amber-300" />
            Moderation
          </Dialog.Title>
          <Dialog.Description class="mt-1 text-[11px] text-muted-foreground">
            Themes awaiting review, open reports and recent staff activity.
          </Dialog.Description>
        </div>
        <div class="flex items-center gap-1">
          <WorkshopTooltip content="Send a system announcement">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-cyan-300"
                onclick={openAnnouncementComposer}
                aria-label="Send a system announcement"
              >
                <Megaphone class="size-3.5" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
          <WorkshopTooltip content="Refresh moderation data">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={() => void loadModerationPanel()}
                disabled={moderationLoading}
                aria-label="Refresh moderation data"
              >
                <RefreshCw class="size-3.5 {moderationLoading ? 'animate-spin' : ''}" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
          <WorkshopTooltip content="Close">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={() => (showModerationPanel = false)}
                aria-label="Close moderation panel"
              >
                <X class="size-4" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
      </div>

      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {#if moderationError}
          <div class="rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-300">
            {moderationError}
          </div>
        {/if}

        <div class="rounded-lg border border-theme-800/60 bg-theme-900/20 p-2.5">
          <div class="grid gap-2 sm:grid-cols-2">
            <Select.Root
              type="single"
              value={moderationStatus}
              onValueChange={(value) => {
                if (!value) return;
                moderationStatus = value as ThemeReportStatus | 'all';
                handleModerationFilterChange();
              }}
            >
              <Select.Trigger
                class="h-8 border-theme-800 bg-theme-950/80 text-[11px] text-muted-foreground"
                aria-label="Report status filter"
              >
                {REPORT_STATUS_OPTIONS.find((option) => option.id === moderationStatus)?.label ??
                  'Open reports'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                {#each REPORT_STATUS_OPTIONS as option (option.id)}
                  <Select.Item value={option.id} label={option.label} />
                {/each}
              </Select.Content>
            </Select.Root>
            <Select.Root
              type="single"
              value={moderationCategory}
              onValueChange={(value) => {
                if (!value) return;
                moderationCategory = value as ThemeReportCategory | 'all';
                handleModerationFilterChange();
              }}
            >
              <Select.Trigger
                class="h-8 border-theme-800 bg-theme-950/80 text-[11px] text-muted-foreground"
                aria-label="Report category filter"
              >
                {REPORT_CATEGORIES.find((category) => category.id === moderationCategory)?.label ??
                  'All categories'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                <Select.Item value="all" label="All categories" />
                {#each REPORT_CATEGORIES as category (category.id)}
                  <Select.Item value={category.id} label={category.label} />
                {/each}
              </Select.Content>
            </Select.Root>
            <Input
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px]"
              placeholder="Filter by reason or theme..."
              bind:value={moderationQuery}
              onkeydown={(event) => {
                if (event.key === 'Enter') handleModerationFilterChange();
              }}
            />
            <Input
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px]"
              placeholder="Filter by theme author..."
              bind:value={moderationAuthor}
              onkeydown={(event) => {
                if (event.key === 'Enter') handleModerationFilterChange();
              }}
            />
            <DatePicker
              value={moderationFrom}
              placeholder="From date"
              ariaLabel="Reports from date"
              contentClass="border-theme-800 bg-theme-950"
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px] text-muted-foreground"
              onValueChange={(value) => {
                if (moderationFrom === value) return;
                moderationFrom = value;
                handleModerationFilterChange();
              }}
            />
            <DatePicker
              value={moderationTo}
              placeholder="To date"
              ariaLabel="Reports to date"
              contentClass="border-theme-800 bg-theme-950"
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px] text-muted-foreground"
              onValueChange={(value) => {
                if (moderationTo === value) return;
                moderationTo = value;
                handleModerationFilterChange();
              }}
            />
          </div>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 text-[11px] text-muted-foreground hover:text-white"
              onclick={handleModerationFilterChange}
            >
              <Search class="size-3" /> Apply filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 text-[11px] text-muted-foreground hover:text-white"
              onclick={() => void handleExportReports()}
              disabled={exportingReports}
            >
              {#if exportingReports}
                <LoaderCircle class="size-3 animate-spin" />
              {:else}
                <Download class="size-3" />
              {/if}
              Export CSV
            </Button>
          </div>
        </div>

        {#if selectedReportIds.length > 0}
          <div
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5"
          >
            <span class="text-[11px] font-medium text-amber-100">
              {selectedReportIds.length} report(s) selected
            </span>
            <div class="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-[11px] text-amber-100 hover:text-white"
                onclick={() => requestBulkReports('dismissed')}
                disabled={bulkAction !== null}
              >
                {#if bulkAction === 'dismissed'}
                  <LoaderCircle class="mr-1 size-3 animate-spin" />
                {/if}
                Dismiss selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                class="h-7 text-[11px]"
                onclick={() => requestBulkReports('hide')}
                disabled={bulkAction !== null}
              >
                {#if bulkAction === 'hide'}
                  <LoaderCircle class="mr-1 size-3 animate-spin" />
                {:else}
                  <EyeOff class="mr-1 size-3" />
                {/if}
                Hide themes
              </Button>
            </div>
          </div>
        {/if}

        {#if moderationLoading && moderationReports.length === 0 && moderationEvents.length === 0}
          <div class="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle class="size-4 animate-spin text-primary" /> Loading moderation data...
          </div>
        {:else}
          <section>
            <h3
              class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase"
            >
              <ShieldCheck class="size-3.5 text-cyan-300" />
              Review queue
              <Badge
                variant="secondary"
                class="bg-theme-800 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
              >
                {reviewTotal}
              </Badge>
            </h3>
            {#if reviewQueue.length === 0}
              <p
                class="mt-2 rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground"
              >
                No themes are waiting for review.
              </p>
            {:else}
              <div class="mt-2 space-y-2">
                {#each reviewQueue as theme (theme.id)}
                  <div
                    class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-theme-800/70 bg-theme-900/30 p-3"
                  >
                    <div class="flex min-w-0 flex-1 items-start gap-2.5">
                      <img
                        src={theme.previewUrl}
                        alt=""
                        class="h-14 w-24 shrink-0 rounded-md border border-theme-800 object-cover"
                        onerror={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DefaultThemePreview;
                        }}
                      />
                      <div class="min-w-0">
                        <p class="truncate text-xs font-semibold text-white">{theme.name}</p>
                        <p class="mt-0.5 text-[10px] text-muted-foreground">
                          by {theme.author.name} · v{theme.version} · {formatBytes(theme.fileSize)}
                        </p>
                        <p class="mt-0.5 text-[10px] text-muted-foreground">
                          Submitted {formatModerationDate(theme.createdAt)}
                        </p>
                        {#if theme.description}
                          <p
                            class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground"
                          >
                            {theme.description}
                          </p>
                        {/if}
                        {#if theme.tags.length > 0}
                          <div class="mt-1 flex flex-wrap gap-1">
                            {#each theme.tags.slice(0, 5) as tag (tag)}
                              <span
                                class="rounded bg-theme-800/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                              >
                                #{tag}
                              </span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        class="h-7 gap-1 text-xs"
                        onclick={() => requestReviewTheme(theme, 'approved')}
                        disabled={reviewActionId !== null}
                      >
                        {#if reviewActionId === theme.id}
                          <LoaderCircle class="size-3 animate-spin" />
                        {:else}
                          <Check class="size-3" />
                        {/if}
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 gap-1 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        onclick={() => requestReviewTheme(theme, 'rejected')}
                        disabled={reviewActionId !== null}
                      >
                        {#if reviewActionId === theme.id}
                          <LoaderCircle class="size-3 animate-spin" />
                        {:else}
                          <X class="size-3" />
                        {/if}
                        Reject
                      </Button>
                    </div>
                  </div>
                {/each}
              </div>
              {#if reviewPage < reviewTotalPages}
                <div class="mt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-[10px] text-muted-foreground hover:text-white"
                    onclick={() => void loadMoreReviews()}
                    disabled={reviewLoadingMore}
                  >
                    {#if reviewLoadingMore}
                      <LoaderCircle class="mr-1 size-3 animate-spin" /> Loading...
                    {:else}
                      Load more reviews ({reviewQueue.length} of {reviewTotal})
                    {/if}
                  </Button>
                </div>
              {/if}
            {/if}
          </section>

          <section>
            <h3
              class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase"
            >
              <Flag class="size-3.5 text-amber-300" />
              Reports
              <Badge
                variant="secondary"
                class="bg-theme-800 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
              >
                {moderationTotal}
              </Badge>
            </h3>
            {#if selectableReports.length > 0}
              <Label
                class="mt-2 flex w-fit cursor-pointer items-center gap-1.5 text-[10px] font-normal text-muted-foreground"
              >
                <Checkbox
                  checked={allSelectableReportsSelected}
                  onCheckedChange={() => toggleAllReports()}
                />
                Select all visible open reports
              </Label>
            {/if}
            {#if moderationReports.length === 0}
              <p
                class="mt-2 rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground"
              >
                No reports match these filters.
              </p>
            {:else}
              <div class="mt-2 space-y-2">
                {#each moderationReports as report (report.id)}
                  <div class="rounded-lg border border-theme-800/70 bg-theme-900/30 p-3">
                    <div class="flex items-start gap-2">
                      {#if report.status === 'open' && !report.themeDeleted}
                        <Checkbox
                          class="mt-0.5 shrink-0"
                          checked={selectedReportIds.includes(report.id)}
                          onCheckedChange={() => toggleReportSelection(report.id)}
                          aria-label={`Select report for ${report.themeName}`}
                        />
                      {/if}
                      <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-1.5">
                              <p class="truncate text-xs font-semibold text-white">
                                {report.themeName}
                              </p>
                              <Badge
                                variant="outline"
                                class="border-theme-700/70 bg-theme-800/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                              >
                                {reportCategoryLabel(report.category)}
                              </Badge>
                              {#if report.themeHidden}
                                <Badge variant="destructive" class="px-1.5 py-0 text-[9px]">
                                  Hidden
                                </Badge>
                              {/if}
                              {#if report.themeQuarantined}
                                <Badge variant="destructive" class="px-1.5 py-0 text-[9px]">
                                  Taken down
                                </Badge>
                              {/if}
                              {#if report.themeDeleted}
                                <Badge variant="destructive" class="px-1.5 py-0 text-[9px]">
                                  Trash
                                </Badge>
                              {/if}
                            </div>
                            <p class="mt-0.5 text-[10px] text-muted-foreground">
                              by {report.themeAuthorName} · reported by {report.reporterName}
                            </p>
                          </div>
                          <span class="shrink-0 text-[10px] text-muted-foreground">
                            {formatModerationDate(report.createdAt)}
                          </span>
                        </div>
                        <p class="mt-2 text-[11px] leading-relaxed text-white/80">
                          {report.reason}
                        </p>
                        {#if report.status !== 'open'}
                          <p class="mt-2 text-[10px] text-muted-foreground">
                            {report.status === 'resolved' ? 'Resolved' : 'Dismissed'} by
                            {report.resolvedByName ?? 'Unknown'}
                            {#if report.resolvedAt}
                              · {formatModerationDate(report.resolvedAt)}
                            {/if}
                          </p>
                          {#if report.resolutionNote}
                            <p
                              class="mt-1 rounded border border-theme-800/60 bg-theme-950/40 px-2 py-1 text-[10px] text-muted-foreground"
                            >
                              Note: {report.resolutionNote}
                            </p>
                          {/if}
                        {/if}
                        <div class="mt-2 flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-7 gap-1 text-xs text-muted-foreground hover:text-cyan-200"
                            onclick={() => void openThemeHistory(report.themeId, report.themeName)}
                          >
                            <History class="size-3" /> History
                          </Button>
                          {#if report.status === 'open'}
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-7 text-xs"
                              onclick={() => requestReportDismiss(report)}
                              disabled={reportActionId !== null}
                            >
                              Dismiss
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              class="h-7 gap-1 text-xs"
                              onclick={() => requestReportHide(report)}
                              disabled={reportActionId !== null || report.themeDeleted}
                            >
                              {#if reportActionId === report.id}
                                <LoaderCircle class="size-3 animate-spin" /> Working
                              {:else}
                                <EyeOff class="size-3" /> Hide theme
                              {/if}
                            </Button>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
              {#if moderationTotalPages > 1}
                <div class="mt-3 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-[11px]"
                    onclick={() => goToModerationPage(moderationPage - 1)}
                    disabled={moderationPage <= 1 || moderationLoading}
                  >
                    Previous
                  </Button>
                  <span class="text-[10px] text-muted-foreground">
                    Page {moderationPage} of {moderationTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-[11px]"
                    onclick={() => goToModerationPage(moderationPage + 1)}
                    disabled={moderationPage >= moderationTotalPages || moderationLoading}
                  >
                    Next
                  </Button>
                </div>
              {/if}
            {/if}
          </section>

          <section>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3
                class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase"
              >
                <History class="size-3.5 text-cyan-300" />
                Recent activity
              </h3>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1 text-[10px] text-muted-foreground hover:text-white"
                onclick={() => void handleExportEvents()}
                disabled={exportingEvents}
              >
                {#if exportingEvents}
                  <LoaderCircle class="size-3 animate-spin" />
                {:else}
                  <Download class="size-3" />
                {/if}
                Export
              </Button>
            </div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Select.Root
                type="single"
                value={moderationEventAction}
                onValueChange={(value) => {
                  if (!value) return;
                  moderationEventAction = value;
                  handleAuditFilterChange();
                }}
              >
                <Select.Trigger
                  class="h-7 w-auto min-w-36 border-theme-800 bg-theme-950/80 text-[10px] text-muted-foreground"
                  aria-label="Audit action filter"
                >
                  {AUDIT_ACTIONS.find((action) => action.id === moderationEventAction)?.label ??
                    'All actions'}
                </Select.Trigger>
                <Select.Content class="border-theme-800 bg-theme-950">
                  {#each AUDIT_ACTIONS as action (action.id)}
                    <Select.Item value={action.id} label={action.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
              <Input
                class="h-7 w-36 border-theme-800 bg-theme-950/80 text-[10px]"
                placeholder="Filter by staff..."
                bind:value={moderationEventActor}
                onkeydown={(event) => {
                  if (event.key === 'Enter') handleAuditFilterChange();
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-[10px] text-muted-foreground hover:text-white"
                onclick={handleAuditFilterChange}
              >
                Apply
              </Button>
            </div>
            {#if moderationEvents.length === 0}
              <p
                class="mt-2 rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground"
              >
                No moderation events yet.
              </p>
            {:else}
              <div class="mt-2 space-y-1.5">
                {#each moderationEvents as event (event.id)}
                  <div class="rounded-lg border border-theme-800/50 bg-theme-900/20 px-3 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-[11px] text-white/80">
                        <span class="font-semibold text-white">{event.actorName}</span>
                        ·
                        {moderationActionLabel(event.action)}
                        ·
                        <span class="text-white/60">{event.themeName}</span>
                      </p>
                      <span class="shrink-0 text-[9px] text-muted-foreground">
                        {formatModerationDate(event.createdAt)}
                      </span>
                    </div>
                    {#if event.reason}
                      <WorkshopTooltip content={event.reason}>
                        {#snippet trigger(props)}
                          <p
                            {...props}
                            tabindex="-1"
                            class="mt-1 truncate text-[10px] text-muted-foreground"
                          >
                            {event.reason}
                          </p>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                  </div>
                {/each}
              </div>
              {#if moderationEventsPage < moderationEventsTotalPages}
                <div class="mt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-[10px] text-muted-foreground hover:text-white"
                    onclick={() => void loadOlderEvents()}
                    disabled={moderationLoading || eventsLoadingMore}
                  >
                    {#if eventsLoadingMore}
                      <LoaderCircle class="mr-1 size-3 animate-spin" /> Loading...
                    {:else}
                      Load older activity
                    {/if}
                  </Button>
                </div>
              {/if}
            {/if}
          </section>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Root>

  {#if announcementOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close announcement composer"
        onclick={closeAnnouncementComposer}
      ></button>
      <div
        class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        use:modalFocus={closeAnnouncementComposer}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div>
            <h2
              id="announcement-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <Megaphone class="size-4 text-cyan-300" /> Send announcement
            </h2>
            <p class="mt-1 text-[11px] text-muted-foreground">
              This appears as a system notification in the recipient's hub.
            </p>
          </div>
          <WorkshopTooltip content="Close">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={closeAnnouncementComposer}
              >
                <X class="size-4" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
        <div class="space-y-3 p-4">
          <label class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >Title</span
            >
            <Input
              class="h-8 border-theme-800 bg-theme-900/60 text-[11px]"
              maxlength={120}
              placeholder="Workshop maintenance tonight"
              bind:value={announcementTitle}
              data-autofocus
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >Message</span
            >
            <textarea
              class="min-h-28 w-full resize-y rounded-md border border-theme-800 bg-theme-900/60 p-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
              rows="5"
              maxlength="1000"
              placeholder="Share an update with the community..."
              bind:value={announcementMessage}
            ></textarea>
            <span class="block text-right text-[9px] text-muted-foreground">
              {announcementMessage.trim().length}/1000 · minimum 10
            </span>
          </label>
          <div class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >Audience</span
            >
            <Select.Root
              type="single"
              value={announcementAudience}
              onValueChange={(value) => {
                if (!value) return;
                announcementAudience = value as 'all' | 'staff';
              }}
            >
              <Select.Trigger
                class="h-8 border-theme-800 bg-theme-900/60 text-[11px] text-white"
                aria-label="Announcement audience"
              >
                {announcementAudience === 'staff' ? 'Staff only' : 'Everyone'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                <Select.Item value="all" label="Everyone" />
                <Select.Item value="staff" label="Staff only" />
              </Select.Content>
            </Select.Root>
          </div>
          {#if announcementError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
            >
              {announcementError}
            </p>
          {/if}
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            onclick={closeAnnouncementComposer}
            disabled={announcementSending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            class="h-8 gap-1 text-xs"
            onclick={() => void submitAnnouncement()}
            disabled={announcementSending}
          >
            {#if announcementSending}
              <LoaderCircle class="size-3 animate-spin" /> Sending...
            {:else}
              <Megaphone class="size-3" /> Send announcement
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if sourceDialogOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close fork origin"
        onclick={closeSourceDialog}
      ></button>
      <div
        class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fork-source-title"
        use:modalFocus={closeSourceDialog}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div>
            <h2
              id="fork-source-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <GitFork class="size-4 text-cyan-300" /> Fork origin
            </h2>
            <p class="mt-1 text-[11px] text-muted-foreground">The immediate source of this fork.</p>
          </div>
          <WorkshopTooltip content="Close">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={closeSourceDialog}
              >
                <X class="size-4" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
        <div class="p-4">
          {#if sourceLoading}
            <div class="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin text-primary" /> Loading original...
            </div>
          {:else if sourceError}
            <p
              class="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-[11px] text-amber-200"
            >
              {sourceError}
            </p>
          {:else if sourceTheme}
            <img
              src={sourceTheme.previewUrl}
              alt={sourceTheme.name}
              class="aspect-video w-full rounded-lg border border-theme-800 object-cover"
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).src = DefaultThemePreview;
              }}
            />
            <div class="mt-3 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-white">{sourceTheme.name}</h3>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  by {sourceTheme.author.name} · v{sourceTheme.version}
                </p>
              </div>
              <Badge variant="outline" class="shrink-0 text-[10px]">
                {sourceTheme.apiVersion === '1.0' ? 'Legacy v1' : 'API 2.x'}
              </Badge>
            </div>
            {#if sourceTheme.description}
              <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {sourceTheme.description}
              </p>
            {/if}
            {#if sourceTheme.tags.length > 0}
              <div class="mt-3 flex flex-wrap gap-1">
                {#each sourceTheme.tags as tag (tag)}
                  <span
                    class="rounded bg-theme-800/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                  >
                    #{tag}
                  </span>
                {/each}
              </div>
            {/if}
            <p class="mt-4 border-t border-theme-800/60 pt-3 text-[10px] text-muted-foreground">
              This fork keeps a snapshot of the source at fork time. The original may have changed
              since.
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if tagEditorTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close tag editor"
        onclick={closeTagEditor}
      ></button>
      <div
        class="relative w-full max-w-md overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-tags-title"
        use:modalFocus={closeTagEditor}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div class="min-w-0">
            <h2
              id="theme-tags-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <Tag class="size-4 text-cyan-300" /> Edit theme tags
            </h2>
            <p class="mt-1 truncate text-[11px] text-muted-foreground">{tagEditorTarget.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 text-muted-foreground hover:text-white"
            onclick={closeTagEditor}
            disabled={tagSaving}
            aria-label="Close tag editor"
          >
            <X class="size-4" />
          </Button>
        </div>

        <div class="space-y-3 p-4">
          <p class="text-[11px] leading-relaxed text-muted-foreground">
            Tags are saved to the workshop and to the installed theme.json.
          </p>
          <div class="flex gap-2">
            <Input
              class="h-8 border-theme-800 bg-theme-900/60 text-[11px]"
              bind:value={tagEditorInput}
              placeholder="anime, dark, minimal"
              maxlength={24}
              disabled={tagSaving}
              data-autofocus
              oninput={() => (tagEditorError = null)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTagEditorTag();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              class="h-8 shrink-0 gap-1 text-xs"
              onclick={addTagEditorTag}
              disabled={tagSaving || !tagEditorInput.trim()}
            >
              <Plus class="size-3" /> Add
            </Button>
          </div>

          {#if tagEditorTags.length > 0}
            <div class="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {#each tagEditorTags as tag (tag)}
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-theme-700 bg-theme-900 px-2 py-1 text-[10px] text-theme-100"
                >
                  #{tag}
                  <button
                    type="button"
                    class="rounded-full text-muted-foreground transition-colors hover:text-white disabled:opacity-50"
                    aria-label={`Remove ${tag} tag`}
                    onclick={() => removeTagEditorTag(tag)}
                    disabled={tagSaving}
                  >
                    <X class="size-3" />
                  </button>
                </span>
              {/each}
            </div>
          {:else}
            <p
              class="rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground"
            >
              No tags yet. Add a few so people can find this theme.
            </p>
          {/if}

          <div class="flex items-center justify-between gap-3 text-[9px] text-muted-foreground">
            <span>Lowercase letters, numbers, dashes, underscores · max 24</span>
            <span class="shrink-0 tabular-nums">{tagEditorTags.length}/10</span>
          </div>

          {#if tagEditorError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
            >
              {tagEditorError}
            </p>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            onclick={closeTagEditor}
            disabled={tagSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            class="h-8 gap-1 text-xs"
            onclick={() => void saveTagEditor()}
            disabled={tagSaving}
          >
            {#if tagSaving}
              <LoaderCircle class="size-3 animate-spin" /> Saving...
            {:else}
              <Tag class="size-3" /> Save tags
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if quarantineTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close takedown dialog"
        onclick={closeQuarantineDialog}
      ></button>
      <div
        class="relative w-full max-w-md overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quarantine-theme-title"
        use:modalFocus={closeQuarantineDialog}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div>
            <h2
              id="quarantine-theme-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <Ban class="size-4 text-red-300" />
              {quarantineAction === 'take_down' ? 'Take down theme' : 'Lift takedown'}
            </h2>
            <p class="mt-1 pr-2 text-[11px] leading-relaxed text-muted-foreground">
              {#if quarantineAction === 'take_down'}
                "{quarantineTarget.name}" will disappear from public search, downloads, previews and
                updates until the takedown is lifted. The owner and open reporters are notified.
              {:else}
                "{quarantineTarget.name}" will become publicly visible again unless it is hidden or
                still awaiting review.
              {/if}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 shrink-0 text-muted-foreground hover:text-white"
            onclick={closeQuarantineDialog}
            disabled={Boolean(quarantineId)}
            aria-label="Close takedown dialog"
          >
            <X class="size-4" />
          </Button>
        </div>

        <div class="space-y-3 p-4">
          <label class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >{quarantineAction === 'take_down' ? 'Reason' : 'Note (optional)'}</span
            >
            <textarea
              class="min-h-24 w-full resize-y rounded-md border border-theme-800 bg-theme-900/60 p-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
              rows="4"
              maxlength="500"
              placeholder={quarantineAction === 'take_down'
                ? 'Explain why the theme is being taken down...'
                : 'Optional note for the audit log...'}
              bind:value={quarantineReason}
              disabled={Boolean(quarantineId)}
              oninput={() => (quarantineError = null)}
              data-autofocus
            ></textarea>
            <span class="block text-right text-[9px] text-muted-foreground">
              {quarantineReason.trim().length}/500
            </span>
          </label>
          {#if quarantineError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
            >
              {quarantineError}
            </p>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            onclick={closeQuarantineDialog}
            disabled={Boolean(quarantineId)}
          >
            Cancel
          </Button>
          <Button
            variant={quarantineAction === 'take_down' ? 'destructive' : 'default'}
            size="sm"
            class="h-8 gap-1 text-xs"
            onclick={() => void confirmQuarantine()}
            disabled={Boolean(quarantineId)}
          >
            {#if quarantineId}
              <LoaderCircle class="size-3 animate-spin" /> Updating...
            {:else}
              <Ban class="size-3" />
              {quarantineAction === 'take_down' ? 'Take down theme' : 'Lift takedown'}
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if reportTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close report form"
        onclick={closeReportDialog}
      ></button>
      <div
        class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-theme-title"
        use:modalFocus={closeReportDialog}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div>
            <h2
              id="report-theme-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <Flag class="size-4 text-amber-300" /> Report theme
            </h2>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Reporting <span class="text-white/80">{reportTarget.name}</span> by
              {reportTarget.author.name}. Reports are visible to moderators only.
            </p>
          </div>
          <WorkshopTooltip content="Close">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={closeReportDialog}
              >
                <X class="size-4" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
        <div class="space-y-3 p-4">
          <div class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >Category</span
            >
            <Select.Root
              type="single"
              value={reportCategory}
              onValueChange={(value) => {
                if (!value) return;
                reportCategory = value as ThemeReportCategory;
              }}
            >
              <Select.Trigger
                class="h-8 border-theme-800 bg-theme-900/60 text-[11px] text-white"
                aria-label="Report category"
              >
                {REPORT_CATEGORIES.find((category) => category.id === reportCategory)?.label ??
                  'Other'}
              </Select.Trigger>
              <Select.Content class="border-theme-800 bg-theme-950">
                {#each REPORT_CATEGORIES as category (category.id)}
                  <Select.Item value={category.id} label={category.label} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <label class="block space-y-1.5">
            <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase"
              >Details</span
            >
            <textarea
              class="min-h-28 w-full resize-y rounded-md border border-theme-800 bg-theme-900/60 p-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
              rows="5"
              maxlength="500"
              placeholder="Describe what is wrong (at least 10 characters)..."
              bind:value={reportDetails}
              data-autofocus
            ></textarea>
            <span class="block text-right text-[9px] text-muted-foreground">
              {reportDetails.trim().length}/500 · minimum 10
            </span>
          </label>
          {#if reportError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
            >
              {reportError}
            </p>
          {/if}
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            onclick={closeReportDialog}
            disabled={reportSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            class="h-8 gap-1 text-xs"
            onclick={() => void submitReport()}
            disabled={reportSubmitting}
          >
            {#if reportSubmitting}
              <LoaderCircle class="size-3 animate-spin" /> Sending...
            {:else}
              <Flag class="size-3" /> Submit report
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if historyOpen && historyTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Close moderation history"
        onclick={closeHistoryDialog}
      ></button>
      <div
        class="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-history-title"
        use:modalFocus={closeHistoryDialog}
      >
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div>
            <h2
              id="theme-history-title"
              class="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <History class="size-4 text-cyan-300" /> Moderation history
            </h2>
            <p class="mt-1 truncate text-[11px] text-muted-foreground">{historyTarget.name}</p>
          </div>
          <WorkshopTooltip content="Close">
            {#snippet trigger(props)}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground hover:text-white"
                onclick={closeHistoryDialog}
              >
                <X class="size-4" />
              </Button>
            {/snippet}
          </WorkshopTooltip>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          {#if historyLoading && historyEvents.length === 0}
            <div class="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin text-primary" /> Loading history...
            </div>
          {:else if historyError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-[11px] text-red-300"
            >
              {historyError}
            </p>
          {:else if historyEvents.length === 0}
            <p
              class="rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground"
            >
              No moderation events for this theme yet.
            </p>
          {:else}
            <div class="space-y-1.5">
              {#each historyEvents as event (event.id)}
                <div class="rounded-lg border border-theme-800/50 bg-theme-900/20 px-3 py-2">
                  <div class="flex items-center justify-between gap-2">
                    <p class="truncate text-[11px] text-white/80">
                      <span class="font-semibold text-white">{event.actorName}</span>
                      ·
                      {moderationActionLabel(event.action)}
                    </p>
                    <span class="shrink-0 text-[9px] text-muted-foreground">
                      {formatModerationDate(event.createdAt)}
                    </span>
                  </div>
                  {#if event.reason}
                    <p class="mt-1 text-[10px] text-muted-foreground">{event.reason}</p>
                  {/if}
                </div>
              {/each}
            </div>
            {#if historyPage < historyTotalPages}
              <div class="mt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 text-[10px] text-muted-foreground hover:text-white"
                  onclick={() => void loadOlderHistory()}
                  disabled={historyLoadingMore}
                >
                  {#if historyLoadingMore}
                    <LoaderCircle class="mr-1 size-3 animate-spin" /> Loading...
                  {:else}
                    Load older history
                  {/if}
                </Button>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}
  <Dialog.Root
    open={pendingAction !== null}
    onOpenChange={(open) => {
      if (!open) closePendingAction();
    }}
  >
    <Dialog.Content
      bind:ref={actionDialogContent}
      class="flex w-[calc(100%_-_2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-xl border-theme-800 bg-theme-950 p-0 text-white shadow-2xl sm:rounded-xl"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        requestAnimationFrame(() =>
          actionDialogContent?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
        );
      }}
      onInteractOutside={(event) => {
        if (actionBusy) event.preventDefault();
      }}
      onEscapeKeydown={(event) => {
        if (actionBusy) event.preventDefault();
      }}
    >
      {#if actionDialog}
        <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
          <div class="min-w-0">
            <Dialog.Title class="text-sm font-semibold text-white">
              {actionDialog.title}
            </Dialog.Title>
            <Dialog.Description class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {actionDialog.description}
            </Dialog.Description>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 shrink-0 text-muted-foreground hover:text-white"
            onclick={closePendingAction}
            disabled={actionBusy}
            aria-label="Close confirmation"
          >
            <X class="size-4" />
          </Button>
        </div>

        <div class="space-y-3 p-4">
          {#if actionDialog.note}
            <label class="block space-y-1.5">
              <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">
                {actionDialog.note.label}
              </span>
              <textarea
                class="min-h-24 w-full resize-y rounded-md border border-theme-800 bg-theme-900/60 p-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:opacity-60"
                rows="4"
                maxlength={actionDialog.note.maxLength}
                placeholder={actionDialog.note.placeholder}
                bind:value={actionNote}
                disabled={actionBusy}
                data-autofocus
              ></textarea>
              <span class="block text-right text-[9px] text-muted-foreground">
                {actionNote.length}/{actionDialog.note.maxLength}
              </span>
            </label>
          {/if}

          {#if actionError}
            <p
              class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300"
            >
              {actionError}
            </p>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            onclick={closePendingAction}
            disabled={actionBusy}
            data-autofocus
          >
            Cancel
          </Button>
          <Button
            variant={actionDialog.destructive ? 'destructive' : 'default'}
            size="sm"
            class="h-8 gap-1 text-xs"
            onclick={() => void confirmPendingAction()}
            disabled={actionBusy}
          >
            {#if actionBusy}
              <LoaderCircle class="size-3 animate-spin" /> Working...
            {:else}
              {actionDialog.confirmLabel}
            {/if}
          </Button>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Root>

  <AlertDialog.Root
    open={restoreTarget !== null}
    onOpenChange={(open) => {
      if (!open) closeRestoreDialog();
    }}
  >
    <AlertDialog.Content class="max-w-md border-theme-800 bg-theme-950 text-white">
      <AlertDialog.Header>
        <AlertDialog.Title class="flex items-center gap-2 text-base">
          <RotateCcw class="size-4 text-cyan-300" /> Restore theme?
        </AlertDialog.Title>
        <AlertDialog.Description class="text-[11px] leading-relaxed text-muted-foreground">
          Restore <span class="font-medium text-theme-100">{restoreTarget?.name}</span> to the workshop?
          It will return with its existing visibility and moderation state.
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if trashActionError}
        <p class="rounded-md border border-red-900/50 bg-red-950/30 p-2 text-[11px] text-red-300">
          {trashActionError}
        </p>
      {/if}
      <AlertDialog.Footer class="gap-2">
        <Button
          variant="ghost"
          size="sm"
          onclick={closeRestoreDialog}
          disabled={restoringId !== null}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          class="gap-1.5"
          onclick={() => void handleRestoreTheme()}
          disabled={restoringId !== null}
        >
          {#if restoringId}
            <LoaderCircle class="size-3.5 animate-spin" />
            Restoring...
          {:else}
            <RotateCcw class="size-3.5" />
            Restore theme
          {/if}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <AlertDialog.Root
    open={purgeTarget !== null}
    onOpenChange={(open) => {
      if (!open) closePermanentDeleteDialog();
    }}
  >
    <AlertDialog.Content class="max-w-md border-theme-800 bg-theme-950 text-white">
      <AlertDialog.Header>
        <AlertDialog.Title class="flex items-center gap-2 text-base">
          <Trash2 class="size-4 text-red-400" /> Permanently delete theme?
        </AlertDialog.Title>
        <AlertDialog.Description class="text-[11px] leading-relaxed text-muted-foreground">
          Permanently delete <span class="font-medium text-theme-100">{purgeTarget?.name}</span>?
          This removes the theme package, preview, likes, downloads and reports from the server.
          This cannot be undone. Installed copies on computers are not affected.
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if trashActionError}
        <p class="rounded-md border border-red-900/50 bg-red-950/30 p-2 text-[11px] text-red-300">
          {trashActionError}
        </p>
      {/if}
      <AlertDialog.Footer class="gap-2">
        <Button
          variant="ghost"
          size="sm"
          onclick={closePermanentDeleteDialog}
          disabled={purgingId !== null}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          class="gap-1.5"
          onclick={() => void handlePermanentDeleteTheme()}
          disabled={purgingId !== null}
        >
          {#if purgingId}
            <LoaderCircle class="size-3.5 animate-spin" />
            Deleting...
          {:else}
            <Trash2 class="size-3.5" />
            Delete permanently
          {/if}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</Tooltip.Provider>
