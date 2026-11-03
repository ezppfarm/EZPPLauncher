<script lang="ts">
  import { onMount } from 'svelte';
  import {
    fetchCommunityThemes,
    fetchCommunityThemeDetails,
    toggleCommunityThemeLike,
    downloadAndInstallCommunityTheme,
    forkCommunityTheme,
    deleteCommunityTheme,
    restoreCommunityTheme,
    setCommunityThemeVisibility,
    setCommunityThemeQuarantine,
    setCommunityThemeTags,
    reportCommunityTheme,
    fetchThemeReports,
    resolveThemeReport,
    bulkResolveThemeReports,
    downloadThemeReportsCsv,
    downloadModerationEventsCsv,
    fetchModerationEvents,
    type CommunityTheme,
    type ModerationEvent,
    type ModerationEventQuery,
    type ThemeReport,
    type ThemeReportCategory,
    type ThemeReportQuery,
    type ThemeReportStatus,
  } from '$lib/communityThemes';
  import { active_custom_theme, custom_themes } from '$lib/global';
  import { reduceAnimations } from '$lib/userSettings';
  import { currentUser } from '$lib/userAuthentication';
  import { isThemeTrusted } from '$lib/themeTrust';
  import type { Theme } from '$lib/themes';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Input } from '$lib/components/ui/input';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import ScrollContainer from '$lib/components/ui/scroll-container/ScrollContainer.svelte';
  import { sileo } from 'sileo';
  import { sendSystemAnnouncement } from '$lib/notifications';
  import * as Tooltip from '$lib/components/ui/tooltip';
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
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    Sparkles,
    Tag,
    Trash2,
    X,
  } from '@lucide/svelte';
  import DefaultThemePreview from '$assets/default_preview.png';

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

  let searchQuery = $state('');
  let selectedTag = $state('all');
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

  let downloadingId = $state<string | null>(null);
  let downloadProgress = $state(0);
  let downloadStatus = $state('');
  let forkingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let moderatingId = $state<string | null>(null);
  let restoringId = $state<string | null>(null);
  let canModerate = $state(false);

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
  let selectedReportIds = $state<number[]>([]);
  let reportActionId = $state<number | null>(null);
  let bulkAction = $state<'hide' | 'resolved' | 'dismissed' | null>(null);
  let exportingReports = $state(false);
  let exportingEvents = $state(false);
  let quarantineId = $state<string | null>(null);
  let tagEditingId = $state<string | null>(null);

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
  let historyError = $state<string | null>(null);

  let sourceDialogOpen = $state(false);
  let sourceTheme = $state<CommunityTheme | null>(null);
  let sourceLoading = $state(false);
  let sourceError = $state<string | null>(null);

  const TAGS = ['all', 'legacy', 'anime', 'minimal', 'video', 'audio', 'game', 'dark', 'clean'];
  const REPORT_CATEGORIES: Array<{ id: ThemeReportCategory; label: string }> = [
    { id: 'spam', label: 'Spam / advertising' },
    { id: 'harassment', label: 'Harassment / hate' },
    { id: 'malware', label: 'Malware / unsafe code' },
    { id: 'copyright', label: 'Copyright / stolen content' },
    { id: 'broken', label: 'Broken / unusable' },
    { id: 'other', label: 'Other' },
  ];
  const MODERATION_ACTIONS: Record<string, string> = {
    hide: 'Hidden from the workshop',
    restore: 'Visibility restored',
    delete: 'Moved to trash',
    restore_deleted: 'Restored from trash',
    report: 'Reported',
    report_resolved: 'Report resolved',
    report_dismissed: 'Report dismissed',
    quarantine: 'Taken down',
    quarantine_restore: 'Takedown lifted',
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
    { id: 'delete', label: 'Trashed' },
    { id: 'restore_deleted', label: 'Restored from trash' },
  ];

  const localThemeMap = $derived.by(() => {
    const map = new Map<string, Theme>();
    for (const t of $custom_themes) {
      map.set(t.folder_name.toLowerCase(), t);
      map.set(t.name.toLowerCase(), t);
    }
    return map;
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

  async function loadWorkshopThemes(options: { append?: boolean } = {}) {
    const append = options.append === true;
    const targetPage = append ? page + 1 : 1;
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
    return value === 'relevance' ||
      value === 'recent' ||
      value === 'likes' ||
      value === 'downloads'
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
    if (theme.deletedAt) return;
    const prevLiked = theme.isLiked;
    const prevCount = theme.likeCount;

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
    }
  }

  async function handleDownloadAndApply(theme: CommunityTheme) {
    if (downloadingId || theme.deletedAt) return;

    downloadingId = theme.id;
    downloadProgress = 10;
    downloadStatus = 'Downloading theme package...';

    try {
      const res = await downloadAndInstallCommunityTheme(theme, (msg, progress) => {
        downloadStatus = msg;
        downloadProgress = progress;
      });

      sileo.success({
        title: 'Theme Installed',
        description: `"${theme.name}" has been installed to your library.`,
      });

      // Find locally installed theme object
      const installed = $custom_themes.find(
        (t) => t.folder_name.toLowerCase() === res.folderName.toLowerCase()
      );

      if (installed) {
        if (!isThemeTrusted(installed)) {
          onRequestTrust(installed);
        } else {
          await onApplyTheme(installed);
        }
      }
    } catch (err) {
      console.error(err);
      sileo.error({
        title: 'Download failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      downloadingId = null;
      downloadProgress = 0;
      downloadStatus = '';
    }
  }

  async function handleApplyExisting(theme: CommunityTheme) {
    if (theme.deletedAt) return;
    const installed =
      localThemeMap.get(theme.id.toLowerCase()) ||
      localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      await handleDownloadAndApply(theme);
      return;
    }

    if (!isThemeTrusted(installed)) {
      onRequestTrust(installed);
    } else {
      await onApplyTheme(installed);
    }
  }

  async function handleEditTheme(theme: CommunityTheme) {
    if (theme.deletedAt || downloadingId || forkingId || deletingId || moderatingId) return;

    let installed =
      localThemeMap.get(theme.id.toLowerCase()) ||
      localThemeMap.get(theme.name.toLowerCase());

    if (!installed) {
      downloadingId = theme.id;
      downloadProgress = 10;
      downloadStatus = 'Downloading theme package...';
      try {
        await downloadAndInstallCommunityTheme(theme, (msg, progress) => {
          downloadStatus = msg;
          downloadProgress = progress;
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
        downloadingId = null;
        downloadProgress = 0;
        downloadStatus = '';
      }
    }

    if (installed) {
      await onEditTheme(installed);
    }
  }

  async function handleRefreshOwnedTheme(theme: CommunityTheme) {
    if (theme.deletedAt || downloadingId || forkingId || deletingId || moderatingId) return;

    const installed =
      localThemeMap.get(theme.id.toLowerCase()) ||
      localThemeMap.get(theme.name.toLowerCase());
    if (!installed) {
      await handleEditTheme(theme);
      return;
    }
    if (installed.version === theme.version) {
      await onEditTheme(installed);
      return;
    }

    const confirmed = window.confirm(
      `Refresh "${theme.name}" from the workshop?\n\nLocal version: ${installed.version}\nWorkshop version: ${theme.version}\n\nYour local edits will be replaced by the workshop package.`
    );
    if (!confirmed) return;

    downloadingId = theme.id;
    downloadProgress = 10;
    downloadStatus = 'Refreshing local theme...';
    try {
      const res = await downloadAndInstallCommunityTheme(theme, (msg, progress) => {
        downloadStatus = msg;
        downloadProgress = progress;
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
    } catch (err) {
      sileo.error({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      downloadingId = null;
      downloadProgress = 0;
      downloadStatus = '';
    }
  }

  async function handleToggleVisibility(theme: CommunityTheme) {
    if (!canModerate || moderatingId || downloadingId || forkingId || deletingId) return;

    const hiding = !theme.isHidden;
    let reason: string | undefined;
    if (hiding) {
      const answer = window.prompt(
        `Hide "${theme.name}" from the Community Workshop?\n\nOptional reason (visible to moderators):`,
        theme.hiddenReason ?? ''
      );
      if (answer === null) return;
      reason = answer.trim().slice(0, 255) || undefined;
    } else if (!window.confirm(`Restore "${theme.name}" to the Community Workshop?`)) {
      return;
    }

    moderatingId = theme.id;
    try {
      const updated = await setCommunityThemeVisibility(theme.id, hiding, reason);
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
      if (showModerationPanel) void loadModerationPanel();
    } catch (err) {
      sileo.error({
        title: 'Could not update visibility',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      moderatingId = null;
    }
  }

  async function handleEditTags(theme: CommunityTheme) {
    if (tagEditingId || theme.deletedAt) return;
    const raw = window.prompt(
      `Tags for "${theme.name}" (comma-separated, up to 10):`,
      theme.tags.join(', ')
    );
    if (raw === null) return;

    const tags = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    tagEditingId = theme.id;
    try {
      const updated = await setCommunityThemeTags(theme.id, tags);
      themes = themes.map((item) => (item.id === updated.id ? updated : item));
      sileo.success({
        title: 'Theme tags updated',
        description: updated.tags.length > 0
          ? `Tags: ${updated.tags.map((tag) => `#${tag}`).join(', ')}`
          : 'All tags were removed.',
      });
      await loadWorkshopThemes();
    } catch (err) {
      sileo.error({
        title: 'Could not update tags',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      tagEditingId = null;
    }
  }

  async function handleForkTheme(theme: CommunityTheme) {
    if (theme.deletedAt || theme.isHidden || downloadingId || forkingId || deletingId || moderatingId) return;
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
      downloadingId = fork.id;
      downloadProgress = 10;
      downloadStatus = 'Downloading your fork...';
      const res = await downloadAndInstallCommunityTheme(fork, (msg, progress) => {
        downloadStatus = msg;
        downloadProgress = progress;
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
      downloadingId = null;
      downloadProgress = 0;
      downloadStatus = '';
    }

    if (installed) {
      sileo.success({
        title: 'Theme forked',
        description: `"${fork.name}" is now yours. Edit and publish it when you're ready.`,
      });
      await onEditTheme(installed);
    }
  }

  async function handleDeleteTheme(theme: CommunityTheme) {
    if (theme.deletedAt || deletingId || downloadingId || forkingId || moderatingId) return;
    const confirmed = window.confirm(
      `Move "${theme.name}" to the trash?\n\nYou can restore it from the Trash view later. Installed copies stay on your computer.`
    );
    if (!confirmed) return;

    deletingId = theme.id;
    try {
      await deleteCommunityTheme(theme.id);
      themes = themes.filter((item) => item.id !== theme.id);
      totalThemes = Math.max(0, totalThemes - 1);
      sileo.success({
        title: 'Moved to trash',
        description: `"${theme.name}" can be restored from the Trash view.`,
      });
    } catch (err) {
      sileo.error({
        title: 'Could not delete theme',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      deletingId = null;
    }
  }

  async function handleRestoreTheme(theme: CommunityTheme) {
    if (restoringId || downloadingId || forkingId || deletingId || moderatingId) return;
    if (!window.confirm(`Restore "${theme.name}" to the workshop?`)) return;

    restoringId = theme.id;
    try {
      await restoreCommunityTheme(theme.id);
      themes = themes.filter((item) => item.id !== theme.id);
      totalThemes = Math.max(0, totalThemes - 1);
      sileo.success({
        title: 'Theme restored',
        description: `"${theme.name}" is back in the workshop.`,
      });
      void loadWorkshopThemes();
    } catch (err) {
      sileo.error({
        title: 'Could not restore theme',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      restoringId = null;
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

  async function loadModerationPanel(page = moderationPage) {
    if (!canModerate) return;
    moderationLoading = true;
    moderationError = null;
    try {
      const [reportsResult, eventsResult] = await Promise.all([
        fetchThemeReports({ ...currentReportFilters(), page, limit: 50 }),
        fetchModerationEvents({ ...currentEventFilters(), page: 1, limit: 50 }),
      ]);
      moderationReports = reportsResult.reports;
      moderationTotal = reportsResult.total;
      moderationPage = reportsResult.page;
      moderationTotalPages = reportsResult.totalPages;
      moderationEvents = eventsResult.events;
      moderationEventsPage = eventsResult.page;
      moderationEventsTotalPages = eventsResult.totalPages;
      selectedReportIds = [];
    } catch (err) {
      moderationError = err instanceof Error ? err.message : String(err);
    } finally {
      moderationLoading = false;
    }
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
    if (moderationEventsPage >= moderationEventsTotalPages) return;
    try {
      const result = await fetchModerationEvents({
        ...currentEventFilters(),
        page: moderationEventsPage + 1,
        limit: 50,
      });
      const known = new Set(moderationEvents.map((event) => event.id));
      moderationEvents = [
        ...moderationEvents,
        ...result.events.filter((event) => !known.has(event.id)),
      ];
      moderationEventsPage = result.page;
      moderationEventsTotalPages = result.totalPages;
    } catch (err) {
      moderationError = err instanceof Error ? err.message : String(err);
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

  async function handleToggleQuarantine(theme: CommunityTheme) {
    if (!canModerate || quarantineId) return;
    const takingDown = !theme.isQuarantined;
    const reason = takingDown
      ? window.prompt(
          `Take down "${theme.name}"?\n\nReason shown to the owner and stored in the audit log:`,
          theme.quarantineReason || ''
        )
      : window.prompt(
          `Lift the takedown on "${theme.name}"?\n\nOptional note for the audit log:`,
          ''
        );
    if (reason === null) return;
    if (takingDown && reason.trim().length < 3) {
      sileo.error({ title: 'A takedown reason is required' });
      return;
    }

    quarantineId = theme.id;
    try {
      await setCommunityThemeQuarantine(theme.id, takingDown, reason.trim() || undefined);
      sileo.success({
        title: takingDown ? 'Theme taken down' : 'Takedown lifted',
        description: `"${theme.name}" was updated.`,
      });
      await loadWorkshopThemes();
      if (showModerationPanel) await loadModerationPanel(moderationPage);
    } catch (err) {
      sileo.error({
        title: 'Could not update takedown',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      quarantineId = null;
    }
  }

  function openAnnouncementComposer() {
    announcementOpen = true;
    announcementTitle = '';
    announcementMessage = '';
    announcementAudience = 'all';
    announcementError = null;
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

  async function handleBulkReports(action: 'hide' | 'resolved' | 'dismissed') {
    if (selectedReportIds.length === 0 || bulkAction) return;
    const note = window.prompt(
      action === 'hide'
        ? 'Optional note for the theme owners and reporters:'
        : 'Optional note for the reporters:',
      ''
    );
    if (note === null) return;

    bulkAction = action;
    try {
      const result = await bulkResolveThemeReports(
        selectedReportIds,
        action,
        note.trim() || undefined
      );
      sileo.success({
        title: 'Reports updated',
        description: `${result.updated} report(s) processed across ${result.themes} theme(s).`,
      });
      selectedReportIds = [];
      await loadModerationPanel(1);
      await loadWorkshopThemes();
    } catch (err) {
      sileo.error({
        title: 'Could not update reports',
        description: err instanceof Error ? err.message : String(err),
      });
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
        description: truncated ? 'The export is capped at 5,000 rows. Narrow the date range for the rest.' : undefined,
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

  async function handleReportHide(report: ThemeReport) {
    if (reportActionId !== null) return;
    const note = window.prompt(
      `Hide "${report.themeName}"?\n\nOptional note for the reporter and audit log:`,
      report.reason.slice(0, 255)
    );
    if (note === null) return;

    reportActionId = report.id;
    try {
      await setCommunityThemeVisibility(report.themeId, true, note.trim() || report.reason);
      sileo.success({
        title: 'Theme hidden',
        description: `"${report.themeName}" was hidden and the report was resolved.`,
      });
      await loadModerationPanel();
      await loadWorkshopThemes();
    } catch (err) {
      sileo.error({
        title: 'Could not hide theme',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      reportActionId = null;
    }
  }

  async function handleDismissReport(report: ThemeReport) {
    if (reportActionId !== null) return;
    const note = window.prompt(
      `Dismiss the report on "${report.themeName}"?\n\nOptional note for the reporter:`,
      ''
    );
    if (note === null) return;

    reportActionId = report.id;
    try {
      await resolveThemeReport(report.id, 'dismissed', note.trim() || undefined);
      sileo.success({ title: 'Report dismissed' });
      await loadModerationPanel(1);
    } catch (err) {
      sileo.error({
        title: 'Could not dismiss report',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      reportActionId = null;
    }
  }

  async function openThemeHistory(themeId: string, themeName: string) {
    historyOpen = true;
    historyTarget = { id: themeId, name: themeName };
    historyEvents = [];
    historyPage = 1;
    historyTotalPages = 1;
    historyError = null;
    historyLoading = true;
    try {
      const result = await fetchModerationEvents({ themeId, page: 1, limit: 50 });
      historyEvents = result.events;
      historyPage = result.page;
      historyTotalPages = result.totalPages;
    } catch (err) {
      historyError = err instanceof Error ? err.message : String(err);
    } finally {
      historyLoading = false;
    }
  }

  async function loadOlderHistory() {
    if (!historyTarget || historyPage >= historyTotalPages) return;
    historyLoading = true;
    try {
      const result = await fetchModerationEvents({
        themeId: historyTarget.id,
        page: historyPage + 1,
        limit: 50,
      });
      const known = new Set(historyEvents.map((event) => event.id));
      historyEvents = [
        ...historyEvents,
        ...result.events.filter((event) => !known.has(event.id)),
      ];
      historyPage = result.page;
      historyTotalPages = result.totalPages;
    } catch (err) {
      historyError = err instanceof Error ? err.message : String(err);
    } finally {
      historyLoading = false;
    }
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

  function searchMatchLabel(field: 'id' | 'name' | 'tag' | 'author' | 'description'): string {
    return field === 'id' ? 'ID' : field === 'name' ? 'Name' : field === 'tag' ? 'Tag' : field === 'author' ? 'Author' : 'Description';
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

  onMount(() => {
    loadWorkshopThemes();
  });
</script>

<Tooltip.Provider delayDuration={220}>
<div class="flex h-full flex-col overflow-hidden">
  <!-- Workshop Filter & Search Toolbar -->
  <div class="flex flex-col gap-2.5 pb-3">
    <div class="flex items-center justify-between gap-3">
      <!-- Tag Chips / Trash label -->
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        {#if selectedView === 'trash'}
          <span class="flex items-center gap-1 rounded-full border border-red-900/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-medium text-red-300">
            <Archive class="size-3" />
            Your trash
          </span>
        {:else}
          {#each TAGS as tag}
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors {selectedTag === tag
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-theme-900/60 text-muted-foreground hover:bg-theme-800/60 hover:text-white'}"
              onclick={() => handleTagClick(tag)}
            >
              {tag === 'all' ? 'All Tags' : `#${tag}`}
            </button>
          {/each}
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
      <div class="flex shrink-0 items-center gap-2">
        <select
          class="h-7.5 rounded-lg border border-theme-800 bg-theme-950/80 px-2.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-white focus:border-primary/50"
          value={selectedSort}
          onchange={(e) => handleSortChange(parseWorkshopSort(e.currentTarget.value))}
        >
          <option value="relevance">Best match</option>
          <option value="popular">Most Popular</option>
          <option value="recent">Most Recent</option>
          <option value="likes">Most Liked</option>
          <option value="downloads">Most Downloaded</option>
        </select>

        <div class="relative w-48">
          <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <WorkshopTooltip content="Typed search: tag:anime, author:name, name:night, id:my-theme">
            {#snippet trigger(props)}
              <Input
                {...props}
                type="text"
                class="h-7.5 border-theme-800 bg-theme-950/80 pl-8 text-[11px]"
                placeholder={selectedView === 'trash' ? 'Search trash...' : 'Search themes, tags, authors...'}
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
              onclick={() => void loadWorkshopThemes()}
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
            <p class="text-sm font-semibold text-white">Workshop Offline or Unreachable</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {error}. Ensure the themes microservice container is running.
            </p>
          </div>
          <Button variant="secondary" size="sm" class="mt-2 text-xs" onclick={() => void loadWorkshopThemes()}>
            <RefreshCw class="mr-1.5 size-3.5" />
            Try Again
          </Button>
        </div>
      {:else if themes.length === 0}
        <div class="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Globe class="size-8 opacity-40" />
          <p class="text-xs">No community themes found matching your search.</p>
        </div>
      {:else}
        <div class="grid grid-cols-3 gap-3 pb-4">
          {#each themes as theme (theme.id)}
            {@const localTheme = localThemeMap.get(theme.id.toLowerCase()) || localThemeMap.get(theme.name.toLowerCase())}
            {@const isInstalled = Boolean(localTheme)}
            {@const isActive = Boolean(localTheme && $active_custom_theme?.folder_name === localTheme.folder_name)}
            {@const isDownloading = downloadingId === theme.id}
            {@const isDeleted = Boolean(theme.deletedAt)}
            {@const hasUpdate = Boolean(!isDeleted && localTheme && localTheme.version !== theme.version)}
            {@const owned = isOwnedByCurrentUser(theme)}
            {@const isLegacy =
              theme.apiVersion === '1.0' || Boolean(theme.tags?.includes('legacy'))}
            {@const showOverflowMenu =
              !isDeleted &&
              (owned ||
                canModerate ||
                Boolean($currentUser && !isLegacy && !theme.isHidden && !theme.isQuarantined))}

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
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-theme-950/90 via-transparent to-transparent"></div>

                <!-- Top Left: Trust Badge -->
                <div class="absolute top-2 left-2 flex items-center gap-1.5">
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
                  <span class="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
                    v{theme.version}
                  </span>
                </div>

                <!-- Bottom: Author Info -->
                <div class="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2">
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
                    <h3 class="truncate text-[13px] font-bold text-white group-hover:text-primary transition-colors">
                      {theme.name}
                    </h3>

                    <!-- Interactive Like Button -->
                    {#if isDeleted}
                      <span class="flex items-center gap-1 rounded-full bg-red-950/40 px-2 py-0.5 text-[10px] text-red-300">
                        <Trash2 class="size-3" /> Deleted
                      </span>
                    {:else}
                      <WorkshopTooltip content={theme.isLiked ? 'Unlike' : 'Like'}>
                        {#snippet trigger(props)}
                          <button
                            {...props}
                            type="button"
                            class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors {theme.isLiked
                              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                              : 'bg-theme-800/40 text-muted-foreground hover:bg-theme-800/80 hover:text-white'}"
                            onclick={(e) => handleLike(theme, e)}
                          >
                            <Heart class="size-3 {theme.isLiked ? 'fill-rose-400 text-rose-400' : ''}" />
                            <span class="tabular-nums text-[10px]">{theme.likeCount}</span>
                          </button>
                        {/snippet}
                      </WorkshopTooltip>
                    {/if}
                  </div>

                  {#if theme.description}
                    <p class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {theme.description}
                    </p>
                  {/if}

                  {#if theme.tags && theme.tags.length > 0}
                    <div class="mt-2 flex flex-wrap gap-1">
                      {#each theme.tags.slice(0, 3) as tag}
                        <span class="rounded bg-theme-800/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          #{tag}
                        </span>
                      {/each}
                    </div>
                  {/if}

                  {#if theme.searchMatch}
                    {@const searchMatch = theme.searchMatch}
                    <WorkshopTooltip
                      content={`Matched ${searchMatchLabel(searchMatch.field)}: ${searchMatch.value}`}
                    >
                      {#snippet trigger(props)}
                        <div
                          {...props}
                          tabindex="-1"
                          class="mt-2 flex max-w-full items-center gap-1 rounded border border-cyan-900/40 bg-cyan-950/20 px-1.5 py-1 text-[9px] text-cyan-200/80"
                        >
                          <Search class="size-3 shrink-0" />
                          <span class="truncate">
                            Matched {searchMatchLabel(searchMatch.field).toLowerCase()}:
                            {searchMatch.value}
                          </span>
                        </div>
                      {/snippet}
                    </WorkshopTooltip>
                  {/if}

                  {#if theme.isHidden || theme.isQuarantined}
                    <div class="mt-2 space-y-1 rounded-md border border-red-900/40 bg-red-950/15 px-2 py-1.5 text-[9px] leading-relaxed">
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
                    <WorkshopTooltip content={`Open ${forkedFrom.name} by ${forkedFrom.authorName}`}>
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
                          >{downloadProgress}%</span
                        >
                        <div class="h-1.5 w-16 overflow-hidden rounded-full bg-theme-800">
                          <div
                            class="h-full bg-primary transition-all duration-200"
                            style="width: {downloadProgress}%"
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
                          onclick={() => handleRestoreTheme(theme)}
                          disabled={restoringId === theme.id}
                        >
                          {#if restoringId === theme.id}
                            <LoaderCircle class="size-3 animate-spin" />
                            Restoring
                          {:else}
                            <RotateCcw class="size-3" />
                            Restore
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
                          onclick={() => handleDownloadAndApply(theme)}
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
                          onclick={() => handleDownloadAndApply(theme)}
                        >
                          <Download class="size-3" />
                          Download & Apply
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
                                onclick={() => void handleEditTags(theme)}
                                disabled={tagEditingId === theme.id}
                              >
                                {#if tagEditingId === theme.id}
                                  <LoaderCircle class="size-3.5 animate-spin" />
                                  Saving tags...
                                {:else}
                                  <Tag class="size-3.5" />
                                  Edit tags
                                {/if}
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
                            {:else if $currentUser && !isLegacy && !theme.isHidden && !theme.isQuarantined}
                              <DropdownMenu.Item
                                class="gap-2 text-[11px]"
                                onclick={() => openReportDialog(theme)}
                              >
                                <Flag class="size-3.5" />
                                Report theme
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                class="gap-2 text-[11px]"
                                onclick={() => handleForkTheme(theme)}
                              >
                                <CopyPlus class="size-3.5" />
                                Fork theme
                              </DropdownMenu.Item>
                            {/if}

                            {#if canModerate}
                              {#if owned || ($currentUser && !isLegacy && !theme.isHidden && !theme.isQuarantined)}
                                <DropdownMenu.Separator class="my-1 bg-theme-800" />
                              {/if}
                              {#if !isLegacy}
                                <DropdownMenu.Item
                                  class="gap-2 text-[11px]"
                                  onclick={() => handleToggleVisibility(theme)}
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
                                onclick={() => handleDeleteTheme(theme)}
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

{#if showModerationPanel}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      aria-label="Close moderation panel"
      onclick={() => (showModerationPanel = false)}
    ></button>
    <div
      class="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <h2 id="moderation-title" class="flex items-center gap-2 text-sm font-semibold text-white">
            <Flag class="size-4 text-amber-300" />
            Moderation
          </h2>
          <p class="mt-1 text-[11px] text-muted-foreground">Open reports and recent staff activity.</p>
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
            <select
              class="h-8 rounded-md border border-theme-800 bg-theme-950/80 px-2 text-[11px] text-muted-foreground outline-none focus:border-primary/50"
              bind:value={moderationStatus}
              onchange={handleModerationFilterChange}
              aria-label="Report status filter"
            >
              <option value="open">Open reports</option>
              <option value="resolved">Resolved reports</option>
              <option value="dismissed">Dismissed reports</option>
              <option value="all">All reports</option>
            </select>
            <select
              class="h-8 rounded-md border border-theme-800 bg-theme-950/80 px-2 text-[11px] text-muted-foreground outline-none focus:border-primary/50"
              bind:value={moderationCategory}
              onchange={handleModerationFilterChange}
              aria-label="Report category filter"
            >
              <option value="all">All categories</option>
              {#each REPORT_CATEGORIES as category}
                <option value={category.id}>{category.label}</option>
              {/each}
            </select>
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
            <Input
              type="date"
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px]"
              bind:value={moderationFrom}
              onchange={handleModerationFilterChange}
              aria-label="Reports from date"
            />
            <Input
              type="date"
              class="h-8 border-theme-800 bg-theme-950/80 text-[11px]"
              bind:value={moderationTo}
              onchange={handleModerationFilterChange}
              aria-label="Reports to date"
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
                onclick={() => void handleBulkReports('dismissed')}
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
                onclick={() => void handleBulkReports('hide')}
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
            <h3 class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase">
              <Flag class="size-3.5 text-amber-300" />
              Reports
              <span class="rounded-full bg-theme-800 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {moderationTotal}
              </span>
            </h3>
            {#if selectableReports.length > 0}
              <label
                class="mt-2 flex w-fit cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <input
                  type="checkbox"
                  class="size-3 accent-primary"
                  checked={allSelectableReportsSelected}
                  onchange={toggleAllReports}
                />
                Select all visible open reports
              </label>
            {/if}
            {#if moderationReports.length === 0}
              <p class="mt-2 rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground">
                No reports match these filters.
              </p>
            {:else}
              <div class="mt-2 space-y-2">
                {#each moderationReports as report (report.id)}
                  <div class="rounded-lg border border-theme-800/70 bg-theme-900/30 p-3">
                    <div class="flex items-start gap-2">
                      {#if report.status === 'open' && !report.themeDeleted}
                        <input
                          type="checkbox"
                          class="mt-0.5 size-3.5 shrink-0 accent-primary"
                          checked={selectedReportIds.includes(report.id)}
                          onchange={() => toggleReportSelection(report.id)}
                          aria-label={`Select report for ${report.themeName}`}
                        />
                      {/if}
                      <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-1.5">
                              <p class="truncate text-xs font-semibold text-white">{report.themeName}</p>
                              <span
                                class="rounded-full border border-theme-700/70 bg-theme-800/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                              >
                                {reportCategoryLabel(report.category)}
                              </span>
                              {#if report.themeHidden}
                                <span class="text-[9px] text-red-300">Hidden</span>
                              {/if}
                              {#if report.themeQuarantined}
                                <span class="text-[9px] text-red-300">Taken down</span>
                              {/if}
                              {#if report.themeDeleted}
                                <span class="text-[9px] text-red-300">Trash</span>
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
                        <p class="mt-2 text-[11px] leading-relaxed text-white/80">{report.reason}</p>
                        {#if report.status !== 'open'}
                          <p class="mt-2 text-[10px] text-muted-foreground">
                            {report.status === 'resolved' ? 'Resolved' : 'Dismissed'} by
                            {report.resolvedByName ?? 'Unknown'}
                            {#if report.resolvedAt}
                              · {formatModerationDate(report.resolvedAt)}
                            {/if}
                          </p>
                          {#if report.resolutionNote}
                            <p class="mt-1 rounded border border-theme-800/60 bg-theme-950/40 px-2 py-1 text-[10px] text-muted-foreground">
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
                              onclick={() => handleDismissReport(report)}
                              disabled={reportActionId !== null}
                            >
                              Dismiss
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              class="h-7 gap-1 text-xs"
                              onclick={() => handleReportHide(report)}
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
              <h3 class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase">
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
              <select
                class="h-7 rounded-md border border-theme-800 bg-theme-950/80 px-2 text-[10px] text-muted-foreground outline-none focus:border-primary/50"
                bind:value={moderationEventAction}
                onchange={handleAuditFilterChange}
                aria-label="Audit action filter"
              >
                {#each AUDIT_ACTIONS as action}
                  <option value={action.id}>{action.label}</option>
                {/each}
              </select>
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
              <p class="mt-2 rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground">
                No moderation events yet.
              </p>
            {:else}
              <div class="mt-2 space-y-1.5">
                {#each moderationEvents as event (event.id)}
                  <div class="rounded-lg border border-theme-800/50 bg-theme-900/20 px-3 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-[11px] text-white/80">
                        <span class="font-semibold text-white">{event.actorName}</span>
                        {' · '}
                        {moderationActionLabel(event.action)}
                        {' · '}
                        <span class="text-white/60">{event.themeName}</span>
                      </p>
                      <span class="shrink-0 text-[9px] text-muted-foreground">
                        {formatModerationDate(event.createdAt)}
                      </span>
                    </div>
                    {#if event.reason}
                      <WorkshopTooltip content={event.reason}>
                        {#snippet trigger(props)}
                          <p {...props} tabindex="-1" class="mt-1 truncate text-[10px] text-muted-foreground">
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
                    disabled={moderationLoading}
                  >
                    Load older activity
                  </Button>
                </div>
              {/if}
            {/if}
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if announcementOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      aria-label="Close announcement composer"
      onclick={() => {
        if (!announcementSending) announcementOpen = false;
      }}
    ></button>
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <h2 id="announcement-title" class="flex items-center gap-2 text-sm font-semibold text-white">
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
              onclick={() => {
                if (!announcementSending) announcementOpen = false;
              }}
            >
              <X class="size-4" />
            </Button>
          {/snippet}
        </WorkshopTooltip>
      </div>
      <div class="space-y-3 p-4">
        <label class="block space-y-1.5">
          <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">Title</span>
          <Input
            class="h-8 border-theme-800 bg-theme-900/60 text-[11px]"
            maxlength={120}
            placeholder="Workshop maintenance tonight"
            bind:value={announcementTitle}
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">Message</span>
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
        <label class="block space-y-1.5">
          <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">Audience</span>
          <select
            class="h-8 w-full rounded-md border border-theme-800 bg-theme-900/60 px-2 text-[11px] text-white outline-none focus:border-primary/50"
            bind:value={announcementAudience}
          >
            <option value="all">Everyone</option>
            <option value="staff">Staff only</option>
          </select>
        </label>
        {#if announcementError}
          <p class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300">
            {announcementError}
          </p>
        {/if}
      </div>
      <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 text-xs"
          onclick={() => (announcementOpen = false)}
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
      onclick={() => (sourceDialogOpen = false)}
    ></button>
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fork-source-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <h2 id="fork-source-title" class="flex items-center gap-2 text-sm font-semibold text-white">
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
              onclick={() => (sourceDialogOpen = false)}
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
          <p class="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-[11px] text-amber-200">
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
              {#each sourceTheme.tags as tag}
                <span class="rounded bg-theme-800/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  #{tag}
                </span>
              {/each}
            </div>
          {/if}
          <p class="mt-4 border-t border-theme-800/60 pt-3 text-[10px] text-muted-foreground">
            This fork keeps a snapshot of the source at fork time. The original may have changed since.
          </p>
        {/if}
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
      onclick={() => {
        if (!reportSubmitting) reportTarget = null;
      }}
    ></button>
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-theme-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <h2 id="report-theme-title" class="flex items-center gap-2 text-sm font-semibold text-white">
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
              onclick={() => {
                if (!reportSubmitting) reportTarget = null;
              }}
            >
              <X class="size-4" />
            </Button>
          {/snippet}
        </WorkshopTooltip>
      </div>
      <div class="space-y-3 p-4">
        <label class="block space-y-1.5">
          <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">Category</span>
          <select
            class="h-8 w-full rounded-md border border-theme-800 bg-theme-900/60 px-2 text-[11px] text-white outline-none focus:border-primary/50"
            bind:value={reportCategory}
          >
            {#each REPORT_CATEGORIES as category}
              <option value={category.id}>{category.label}</option>
            {/each}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-[10px] font-semibold tracking-wide text-white/70 uppercase">Details</span>
          <textarea
            class="min-h-28 w-full resize-y rounded-md border border-theme-800 bg-theme-900/60 p-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
            rows="5"
            maxlength="500"
            placeholder="Describe what is wrong (at least 10 characters)..."
            bind:value={reportDetails}
          ></textarea>
          <span class="block text-right text-[9px] text-muted-foreground">
            {reportDetails.trim().length}/500 · minimum 10
          </span>
        </label>
        {#if reportError}
          <p class="rounded-lg border border-red-900/40 bg-red-950/20 p-2.5 text-[11px] text-red-300">
            {reportError}
          </p>
        {/if}
      </div>
      <div class="flex items-center justify-end gap-2 border-t border-theme-800/70 p-3">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 text-xs"
          onclick={() => (reportTarget = null)}
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
      onclick={() => (historyOpen = false)}
    ></button>
    <div
      class="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-theme-800 bg-theme-950 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-history-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-theme-800/70 p-4">
        <div>
          <h2 id="theme-history-title" class="flex items-center gap-2 text-sm font-semibold text-white">
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
              onclick={() => (historyOpen = false)}
            >
              <X class="size-4" />
            </Button>
          {/snippet}
        </WorkshopTooltip>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        {#if historyLoading}
          <div class="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle class="size-4 animate-spin text-primary" /> Loading history...
          </div>
        {:else if historyError}
          <p class="rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-[11px] text-red-300">
            {historyError}
          </p>
        {:else if historyEvents.length === 0}
          <p class="rounded-lg border border-theme-800/60 bg-theme-900/20 p-3 text-[11px] text-muted-foreground">
            No moderation events for this theme yet.
          </p>
        {:else}
          <div class="space-y-1.5">
            {#each historyEvents as event (event.id)}
              <div class="rounded-lg border border-theme-800/50 bg-theme-900/20 px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-[11px] text-white/80">
                    <span class="font-semibold text-white">{event.actorName}</span>
                    {' · '}
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
                disabled={historyLoading}
              >
                Load older history
              </Button>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
</Tooltip.Provider>
