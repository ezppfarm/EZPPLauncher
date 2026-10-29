<script lang="ts">
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { launcherStream } from '$lib/global';
  import { getReleaseStream, getVersion, isOsuCorrupted } from '$lib/osuUtil';
  import { osuInstallationPath, patch } from '$lib/userSettings';
  import { formatBytes } from '$lib/utils';
  import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCopy,
    Info,
    LoaderCircle,
    RefreshCw,
    Wrench,
    XCircle,
  } from '@lucide/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { sileo } from 'sileo';
  import { onMount } from 'svelte';

  type InstallationDiagnostics = {
    platform: string;
    osVersion?: string;
    osArch: string;
    launcherVersion: string;
    osuFolder: string;
    resolvedFolder?: string;
    osuWritable?: boolean;
    patcherPath?: string;
    patcherInstalled: boolean;
    patcherFileCount: number;
    patcherTotalSize: number;
    hostNet8: boolean;
    osuwinello: boolean;
    wmctrl: boolean;
    winePrefix?: string;
    wineBinary?: string;
    wineAppBundle?: string;
    wineVersion?: string;
    winePrefixArch?: string;
    wineNet8?: boolean;
    wineError?: string;
    ffmpegStatus?: string;
    logsDirectory: string;
  };

  type Check = {
    label: string;
    detail: string;
    status: 'ok' | 'warning' | 'error' | 'info';
  };

  let { onRepair }: { onRepair?: () => void } = $props();

  let checking = $state(true);
  let checks = $state<Check[]>([]);
  let lastChecked = $state<Date | undefined>(undefined);
  let platformName = $state('');
  let launcherVersionName = $state('');
  let osVersion = $state('');
  let osArch = $state('');
  let logsDirectory = $state('');

  const icons = {
    ok: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
  };

  const platformLabel = (platform: string) => {
    switch (platform) {
      case 'macos':
        return 'macOS';
      case 'windows':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return platform || 'unknown';
    }
  };

  async function runChecks() {
    checking = true;
    checks = [];

    try {
      const folder = $osuInstallationPath;
      const diagnostics = await invoke<InstallationDiagnostics>('installation_diagnostics', {
        folder,
      });
      platformName = diagnostics.platform;
      launcherVersionName = diagnostics.launcherVersion;
      osVersion = diagnostics.osVersion ?? '';
      osArch = diagnostics.osArch;
      logsDirectory = diagnostics.logsDirectory;
      const resolved = diagnostics.resolvedFolder;
      // Only the experimental patcher build targets .NET 8.
      const needsNet8 = $patch && $launcherStream === 'experimental';
      const result: Check[] = [];

      result.push({
        label: 'Launcher',
        detail: `${diagnostics.launcherVersion || 'unknown version'} · ${
          diagnostics.osVersion || platformLabel(diagnostics.platform)
        }${diagnostics.osArch ? ` (${diagnostics.osArch})` : ''}`,
        status: 'ok',
      });

      if (!folder.trim()) {
        result.push({
          label: 'osu! installation',
          detail: 'No installation path is configured. Run the setup wizard to pick osu!.',
          status: 'error',
        });
      } else if (!resolved) {
        result.push({
          label: 'osu! installation',
          detail: `The configured path could not be resolved: ${folder}`,
          status: 'error',
        });
      } else {
        result.push({
          label: 'osu! installation',
          detail: resolved,
          status: 'ok',
        });

        try {
          const [version, stream] = await Promise.all([
            getVersion(resolved),
            getReleaseStream(resolved),
          ]);
          result.push({
            label: 'osu! version',
            detail: `${stream ?? 'unknown stream'} · ${version || 'version unavailable'}`,
            status: version ? 'ok' : 'warning',
          });
        } catch (error) {
          result.push({
            label: 'osu! version',
            detail: error instanceof Error ? error.message : String(error),
            status: 'warning',
          });
        }

        try {
          const corrupted = await isOsuCorrupted(resolved);
          result.push({
            label: 'Game files',
            detail: corrupted
              ? 'osu!.exe or a required file looks corrupted. Re-run the updater or setup.'
              : 'The osu! executable passed the integrity check.',
            status: corrupted ? 'error' : 'ok',
          });
        } catch (error) {
          result.push({
            label: 'Game files',
            detail: error instanceof Error ? error.message : String(error),
            status: 'warning',
          });
        }
      }

      if (typeof diagnostics.osuWritable === 'boolean') {
        result.push({
          label: 'osu! folder access',
          detail: diagnostics.osuWritable
            ? 'The launcher can write to this folder, so updates and patcher downloads can be installed.'
            : 'The launcher cannot write to this folder. Updates and patcher downloads will fail; check folder permissions.',
          status: diagnostics.osuWritable ? 'ok' : 'error',
        });
      }

      const selectedStream = $launcherStream;
      const effectiveStream = diagnostics.platform === 'windows' ? selectedStream : 'stable';
      result.push({
        label: 'Patcher stream',
        detail:
          diagnostics.platform === 'windows'
            ? `${selectedStream} selected`
            : `${effectiveStream} (selected: ${selectedStream}; macOS/Linux always use stable)`,
        status: 'ok',
      });

      result.push({
        label: 'Patcher',
        detail: diagnostics.patcherInstalled
          ? `${diagnostics.patcherFileCount} file${
              diagnostics.patcherFileCount === 1 ? '' : 's'
            }, ${formatBytes(diagnostics.patcherTotalSize)} · ${diagnostics.patcherPath}`
          : 'Patcher files are not installed yet. They will be downloaded automatically the next time you launch osu!.',
        status: diagnostics.patcherInstalled ? 'ok' : $patch ? 'warning' : 'info',
      });

      result.push({
        label: 'Logs',
        detail: diagnostics.logsDirectory || 'The logs folder is unavailable.',
        status: diagnostics.logsDirectory ? 'ok' : 'warning',
      });

      if (diagnostics.platform === 'macos') {
        if (diagnostics.wineError) {
          result.push({
            label: 'Wine wrapper',
            detail: diagnostics.wineError,
            status: 'error',
          });
        } else {
          result.push({
            label: 'Wine prefix',
            detail: diagnostics.winePrefix || 'Wine prefix not detected.',
            status: diagnostics.winePrefix ? 'ok' : 'error',
          });
          result.push({
            label: 'Wine runtime',
            detail: diagnostics.wineBinary || 'No Wine loader found inside the wrapper.',
            status: diagnostics.wineBinary ? 'ok' : 'error',
          });
          result.push({
            label: 'Wine version',
            detail: diagnostics.wineVersion || 'Could not determine the Wine version.',
            status: diagnostics.wineVersion ? 'ok' : 'warning',
          });
          if (diagnostics.winePrefixArch) {
            result.push({
              label: 'Wine prefix architecture',
              detail:
                diagnostics.winePrefixArch === 'win64'
                  ? '64-bit (win64)'
                  : diagnostics.winePrefixArch === 'win32'
                    ? '32-bit (win32)'
                    : diagnostics.winePrefixArch,
              status: 'ok',
            });
          }
          if (diagnostics.wineAppBundle) {
            result.push({
              label: 'App wrapper',
              detail: diagnostics.wineAppBundle,
              status: 'ok',
            });
          }
          result.push({
            label: '.NET 8 in prefix (experimental)',
            detail:
              diagnostics.wineNet8 === true
                ? 'The Microsoft.WindowsDesktop.App 8 runtime was found.'
                : 'The Windows .NET 8 Desktop Runtime was not found in this prefix. Only the experimental patcher stream needs it.',
            status: diagnostics.wineNet8 === true ? 'ok' : needsNet8 ? 'error' : 'warning',
          });
          result.push({
            label: 'FFmpeg (theme video)',
            detail: diagnostics.ffmpegStatus
              ? diagnostics.ffmpegStatus
              : 'FFmpeg was not found. Large theme videos will stay on WebKit’s software decoder and may stutter.',
            status: diagnostics.ffmpegStatus ? 'ok' : 'warning',
          });
        }
      } else if (diagnostics.platform === 'linux') {
        result.push({
          label: 'osu-winello',
          detail: diagnostics.osuwinello
            ? 'osu-winello was found.'
            : 'osu-winello was not found in PATH. Launching osu! may fail.',
          status: diagnostics.osuwinello ? 'ok' : 'error',
        });
        result.push({
          label: 'wmctrl',
          detail: diagnostics.wmctrl
            ? 'wmctrl is available for window detection.'
            : 'wmctrl is missing. The patcher may not detect the osu! window.',
          status: diagnostics.wmctrl ? 'ok' : $patch ? 'warning' : 'info',
        });
      } else {
        result.push({
          label: '.NET 8 Desktop Runtime (experimental)',
          detail: diagnostics.hostNet8
            ? 'Microsoft.WindowsDesktop.App 8 was found.'
            : 'The .NET 8 Desktop Runtime was not found. Only the experimental patcher stream needs it.',
          status: diagnostics.hostNet8 ? 'ok' : needsNet8 ? 'error' : 'warning',
        });
      }

      checks = result;
      lastChecked = new Date();
    } catch (error) {
      checks = [
        {
          label: 'Diagnostics',
          detail: error instanceof Error ? error.message : String(error),
          status: 'error',
        },
      ];
    } finally {
      checking = false;
    }
  }

  async function copyReport() {
    const body = checks
      .map((check) => `[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`)
      .join('\n');
    const report = [
      'EZPPLauncher diagnostics',
      `Generated: ${new Date().toISOString()}`,
      `Launcher: ${launcherVersionName || 'unknown'}`,
      `Platform: ${osVersion || platformLabel(platformName)}${osArch ? ` (${osArch})` : ''}`,
      `Logs: ${logsDirectory || 'unknown'}`,
      '',
      body,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      sileo.success({
        title: 'Diagnostics copied',
        description: 'Paste it into your support report.',
      });
    } catch {
      sileo.error({ title: 'Could not copy diagnostics' });
    }
  }

  onMount(runChecks);
</script>

<div class="divide-y divide-theme-800/50 border-t border-theme-800/50">
  <div class="flex flex-wrap items-center justify-between gap-3 py-3">
    <div class="min-w-0">
      <p class="text-sm font-medium">System checks</p>
      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Inspect the selected osu! install, folder permissions, Wine wrapper, patcher, FFmpeg and
        runtime dependencies.
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
      {#if lastChecked}
        <span class="mr-1 text-[10px] text-muted-foreground">
          {lastChecked.toLocaleTimeString()}
        </span>
      {/if}
      <Button
        variant="outline"
        size="sm"
        class="border-theme-800 bg-theme-950"
        onclick={copyReport}
      >
        <ClipboardCopy class="size-4" />
        Copy report
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="border-theme-800 bg-theme-950"
        onclick={runChecks}
        disabled={checking}
      >
        <RefreshCw class={checking ? 'size-4 animate-spin' : 'size-4'} />
        Refresh
      </Button>
      {#if onRepair}
        <Button variant="secondary" size="sm" onclick={onRepair}>
          <Wrench class="size-4" />
          Repair setup
        </Button>
      {/if}
    </div>
  </div>

  <div class="space-y-2 py-3">
    {#if checking}
      <div class="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <LoaderCircle class="size-4 animate-spin" />
        Checking your installation…
      </div>
    {:else}
      {#each checks as check (check.label)}
        {@const Icon = icons[check.status]}
        <div
          class="flex items-start gap-2.5 rounded-lg border border-theme-800/70 bg-theme-950/60 px-3 py-2"
        >
          <Icon
            class="mt-0.5 size-4 shrink-0 {check.status === 'ok'
              ? 'text-emerald-400'
              : check.status === 'warning'
                ? 'text-amber-300'
                : check.status === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'}"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-xs font-medium text-theme-100">{check.label}</p>
              <Badge
                variant={check.status === 'error'
                  ? 'destructive'
                  : check.status === 'warning'
                    ? 'secondary'
                    : 'outline'}
                class="px-1.5 py-0 text-[9px] capitalize"
              >
                {check.status}
              </Badge>
            </div>
            <p class="mt-0.5 break-words text-[10px] leading-relaxed text-muted-foreground">
              {check.detail}
            </p>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
