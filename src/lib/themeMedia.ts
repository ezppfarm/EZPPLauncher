/**
 * Theme media playback helper.
 *
 * Linux and macOS mainly use the loopback theme server, which supports byte
 * ranges and streams large videos without loading them into memory. This file
 * still provides a blob fallback for macOS when an asset URL must be used
 * directly. WKWebView asks Tauri's custom `asset:` protocol for thousands of
 * one-byte ranges, which can starve the audio decoder. A blob avoids that, but
 * WebKit's blob-backed media path starts stuttering past roughly 30 MB, so
 * large files are left on the direct URL instead.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writable } from 'svelte/store';

type MediaCleanup = () => void;

const assetPattern = /^(?:asset:|https?:\/\/asset\.localhost(?:\/|$))/i;
const loopbackThemePattern = /^http:\/\/127\.0\.0\.1:\d+\/themes\//i;
const videoFilePattern = /\.(?:webm|mp4|m4v|mov|ogv|mkv)(?:[?#]|$)/i;
const MAX_BLOB_BYTES = 24 * 1024 * 1024;
const OPTIMIZE_AFTER_BYTES = 20 * 1024 * 1024;

// The request-storm problem is specific to WKWebView. Keep the native
// streaming path everywhere else, where the asset protocol behaves correctly
// (and where blob-backed media can fail to decode in WebKitGTK).
const isMac = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/i.test(navigator.userAgent);
const useBlobMedia = isMac;

/** True while a large theme video is being prepared for hardware playback. */
export const themeMediaPreparing = writable(false);
/** Human-readable detail for the preparation overlay. */
export const themeMediaStatus = writable('');

type ThemeMediaProgress = {
  stage: 'download' | 'extract' | 'optimize';
  progress: number;
};

let preparingCount = 0;
let statusListenerStarted = false;

const setPreparing = (delta: number) => {
  preparingCount = Math.max(0, preparingCount + delta);
  themeMediaPreparing.set(preparingCount > 0);
  if (preparingCount === 0) themeMediaStatus.set('');
};

const ensureStatusListener = async () => {
  if (statusListenerStarted || typeof window === 'undefined') return;
  statusListenerStarted = true;

  try {
    await listen<ThemeMediaProgress>('theme-media-progress', (event) => {
      const { stage, progress } = event.payload;
      if (stage === 'download') {
        themeMediaStatus.set(`Downloading video engine… ${Math.round(progress * 100)}%`);
      } else if (stage === 'extract') {
        themeMediaStatus.set('Installing video engine…');
      } else if (stage === 'optimize') {
        themeMediaStatus.set('Converting theme video for hardware playback…');
      }
    });
  } catch (error) {
    console.warn('Could not listen for theme video preparation progress', error);
  }
};

const blobUrlPromises = new Map<string, Promise<string>>();
const optimizedUrlPromises = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();
const mediaTokens = new WeakMap<HTMLMediaElement, number>();
const mediaCleanups = new WeakMap<HTMLMediaElement, MediaCleanup>();
const autoplayArmed = new WeakSet<HTMLMediaElement>();
let tokenCounter = 0;
let cacheGeneration = 0;

export const isThemeAssetUrl = (url: string | undefined | null): url is string =>
  !!url && assetPattern.test(url);

const isLoopbackThemeVideo = (source: string) =>
  isMac && loopbackThemePattern.test(source) && videoFilePattern.test(source);

/**
 * WebKit's VP9 decoder is software-only on macOS, and a large 1080p theme
 * video can starve the audio decoder. Ask the launcher for a cached 720p
 * H.264/AAC version, which the macOS media engine decodes in hardware.
 */
const optimizedThemeMediaUrl = async (source: string): Promise<string> => {
  if (!isLoopbackThemeVideo(source)) return source;

  const cached = optimizedUrlPromises.get(source);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const head = await fetch(source, { method: 'HEAD', cache: 'no-store' });
      const declaredLength = Number(head.headers.get('content-length'));
      if (!head.ok || !Number.isFinite(declaredLength) || declaredLength < OPTIMIZE_AFTER_BYTES) {
        return source;
      }

      setPreparing(1);
      themeMediaStatus.set('Preparing theme video for smooth playback…');
      await ensureStatusListener();
      try {
        const optimized = await invoke<string>('optimize_theme_media', {
          sourceUrl: source,
        });
        return optimized || source;
      } finally {
        setPreparing(-1);
      }
    } catch (error) {
      console.warn('Could not optimize theme video for hardware playback', error);
      return source;
    }
  })();

  optimizedUrlPromises.set(source, promise);
  return promise;
};

/** Resolve a theme asset to a blob URL, falling back to the original URL. */
export const themeMediaUrl = async (source: string): Promise<string> => {
  const optimized = await optimizedThemeMediaUrl(source);
  if (optimized !== source) return optimized;

  if (!useBlobMedia || !isThemeAssetUrl(source)) return source;

  const cached = blobUrlPromises.get(source);
  if (cached) return cached;

  const generation = cacheGeneration;
  const promise = (async () => {
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Theme media request failed (${response.status})`);

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BLOB_BYTES) {
        void response.body?.cancel();
        return source;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // The theme was switched while the file was loading; don't keep a URL
      // that nothing can use anymore.
      if (generation !== cacheGeneration) {
        URL.revokeObjectURL(objectUrl);
        return source;
      }

      objectUrls.add(objectUrl);
      return objectUrl;
    } catch (error) {
      console.warn('Could not prepare theme media for smooth playback', error);
      return source;
    }
  })();

  blobUrlPromises.set(source, promise);
  return promise;
};

/** Revoke URLs from the previous theme. */
export const clearThemeMediaCache = () => {
  cacheGeneration += 1;
  blobUrlPromises.clear();
  optimizedUrlPromises.clear();
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
};

/** Retry playback on the first click or key press after an autoplay rejection. */
const armAutoplayRetry = (node: HTMLMediaElement) => {
  if (autoplayArmed.has(node)) return;
  autoplayArmed.add(node);

  const retry = () => {
    document.removeEventListener('pointerdown', retry, true);
    document.removeEventListener('keydown', retry, true);
    autoplayArmed.delete(node);
    if (node.isConnected) void node.play().catch(() => {});
  };

  document.addEventListener('pointerdown', retry, true);
  document.addEventListener('keydown', retry, true);
};

const playThemeMedia = (node: HTMLMediaElement) => {
  void node
    .play()
    .then(() => {
      console.debug('Theme media playing', {
        element: node.tagName,
        muted: node.muted,
        volume: node.volume,
        source: node.currentSrc,
      });
    })
    .catch((error) => {
      console.warn('Theme media autoplay was blocked', error);
      armAutoplayRetry(node);
    });
};

/**
 * Swap a media element over to a blob URL while keeping its playback position
 * and state. `source` must be the original asset URL, not the blob URL.
 */
const loadMediaSource = (node: HTMLMediaElement, source: string) => {
  const token = ++tokenCounter;
  mediaTokens.set(node, token);
  mediaCleanups.get(node)?.();
  mediaCleanups.delete(node);

  const previousTime = Number.isFinite(node.currentTime) ? node.currentTime : 0;
  const wasPlaying = !node.paused;
  const needsPreparation = node instanceof HTMLVideoElement && isLoopbackThemeVideo(source);

  // Keep the last frame visible while the first H.264 encode runs instead of
  // letting WebKit struggle through the software VP9 track.
  if (needsPreparation) node.pause();

  void themeMediaUrl(source).then((url) => {
    if (mediaTokens.get(node) !== token || !node.isConnected) return;

    if (node.src === url) {
      if (wasPlaying || node.autoplay) playThemeMedia(node);
      return;
    }

    const cleanup = () => {
      node.removeEventListener('loadedmetadata', onLoaded);
      node.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      cleanup();
      mediaCleanups.delete(node);

      if (previousTime > 0.05) {
        try {
          node.currentTime = previousTime;
        } catch {
          // Some media formats cannot seek until more data is buffered.
        }
      }

      if (wasPlaying || node.autoplay) playThemeMedia(node);
    };

    const onError = () => {
      cleanup();
      mediaCleanups.delete(node);

      // Keep the theme usable if this WebView cannot decode the blob or the
      // optimized file.
      if (node.src !== source) {
        node.src = source;
        node.load();
        if (wasPlaying || node.autoplay) playThemeMedia(node);
      }
    };

    node.addEventListener('loadedmetadata', onLoaded);
    node.addEventListener('error', onError);
    mediaCleanups.set(node, cleanup);

    node.src = url;
    node.load();
  });
};

/**
 * Pause background videos while the launcher is hidden or unfocused, then
 * resume only the videos this helper paused itself. This keeps muted theme
 * videos from decoding in the background and prevents surprise audio when the
 * window comes back.
 */
export function themeVideoLifecycle(node: HTMLVideoElement) {
  let pausedByLifecycle = false;

  const pause = () => {
    if (node.paused) return;
    pausedByLifecycle = true;
    node.pause();
  };

  const resume = () => {
    if (!pausedByLifecycle) return;
    pausedByLifecycle = false;
    playThemeMedia(node);
  };

  const sync = () => {
    if (document.visibilityState === 'visible' && document.hasFocus()) resume();
    else pause();
  };

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('blur', sync);
  sync();

  return {
    destroy() {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
    },
  };
}

/**
 * Svelte action for v2 theme videos/audio. Use this instead of `src=...`.
 */
export function themeMediaSource(node: HTMLMediaElement, source: string) {
  let currentSource = source;
  loadMediaSource(node, currentSource);

  return {
    update(nextSource: string) {
      if (nextSource === currentSource) return;
      currentSource = nextSource;
      loadMediaSource(node, currentSource);
    },
    destroy() {
      mediaTokens.delete(node);
      mediaCleanups.get(node)?.();
      mediaCleanups.delete(node);
    },
  };
}

/**
 * Svelte action for the v1 theme container. Themes mount their own markup, so
 * watch for media elements (and src changes) and route them through blobs too.
 */
export function smoothThemeMedia(node: HTMLElement) {
  const lastSource = new WeakMap<HTMLMediaElement, string>();

  const prepare = (media: HTMLMediaElement) => {
    const source =
      media.getAttribute('src') ??
      media.querySelector<HTMLSourceElement>('source[src]')?.getAttribute('src') ??
      undefined;
    if (!source) return;
    if (!isThemeAssetUrl(source) && !loopbackThemePattern.test(source)) return;
    if (lastSource.get(media) === source) return;

    lastSource.set(media, source);
    loadMediaSource(media, source);
  };

  const scan = (root: ParentNode) => {
    if (root instanceof HTMLMediaElement) prepare(root);
    root.querySelectorAll?.<HTMLMediaElement>('video, audio').forEach(prepare);
  };

  scan(node);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLMediaElement) {
        prepare(mutation.target);
        continue;
      }

      for (const added of mutation.addedNodes) {
        if (added instanceof HTMLElement) scan(added);
      }
    }
  });

  observer.observe(node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
