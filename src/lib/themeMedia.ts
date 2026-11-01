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
 *
 * WebKit also decodes VP9/AV1 video in software on macOS. Large installed
 * theme videos and videos picked in the editor (served as /preview/ URLs) are
 * transcoded to a cached H.264 copy by the Rust backend before playback.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writable } from 'svelte/store';

type MediaCleanup = () => void;

const assetPattern = /^(?:asset:|https?:\/\/asset\.localhost(?:\/|$))/i;
const loopbackThemePattern = /^http:\/\/127\.0\.0\.1:\d+\/(?:themes|preview)\//i;
const MAX_BLOB_BYTES = 24 * 1024 * 1024;
const OPTIMIZE_AFTER_BYTES = 2 * 1024 * 1024;
const FADE_OUT_MS = 260;
const FADE_IN_MS = 420;
const FADE_STEP_MS = 16;

// The request-storm problem is specific to WKWebView. Keep the native
// streaming path everywhere else, where the asset protocol behaves correctly
// (and where blob-backed media can fail to decode in WebKitGTK).
const isMac = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/i.test(navigator.userAgent);
const useBlobMedia = isMac;

/** True while a large theme video is being prepared for hardware playback. */
export const themeMediaPreparing = writable(false);
/** Human-readable detail for the preparation overlay. */
export const themeMediaStatus = writable('');
/** True while the launcher's theme media should stay paused, e.g. in the editor. */
export const themeMediaSuspended = writable(false);

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

/**
 * WebKit's VP9/AV1 decoders are software-only on macOS, and even a short 1080p
 * theme video can starve the audio decoder. Ask the launcher for a cached 720p
 * H.264/AAC version, which the macOS media engine decodes in hardware.
 * `video` avoids transcoding audio-only media and lets editor /preview/ URLs
 * participate even though their token has no file extension.
 */
const optimizedThemeMediaUrl = async (source: string, video: boolean): Promise<string> => {
  if (!isMac || !video || !loopbackThemePattern.test(source)) return source;

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
export const themeMediaUrl = async (source: string, video = false): Promise<string> => {
  const optimized = await optimizedThemeMediaUrl(source, video);
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

export const playThemeMedia = (node: HTMLMediaElement) => {
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
  const needsPreparation =
    node instanceof HTMLVideoElement && isMac && loopbackThemePattern.test(source);

  // Keep the last frame visible while the first H.264 encode runs instead of
  // letting WebKit struggle through the software VP9 track.
  if (needsPreparation) node.pause();

  void themeMediaUrl(source, node instanceof HTMLVideoElement).then((url) => {
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

const easeInOut = (progress: number) => 0.5 - Math.cos(Math.PI * progress) / 2;

/**
 * Ramp a media element's volume to `target`. Returns a stop function that
 * leaves the current volume untouched, so a caller can continue from where the
 * ramp ended (for example when the editor is reopened mid fade-in).
 */
const fadeMediaVolume = (
  media: HTMLMediaElement,
  target: number,
  duration: number,
  done: () => void
): (() => void) => {
  const from = media.volume;
  const to = Math.min(1, Math.max(0, target));
  let frame: ReturnType<typeof setInterval> | undefined;
  let guard: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const stopTimers = () => {
    if (frame) clearInterval(frame);
    if (guard) clearTimeout(guard);
    frame = undefined;
    guard = undefined;
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    stopTimers();
    media.volume = to;
    done();
  };

  if (duration <= 0 || Math.abs(from - to) < 0.005) {
    finish();
    return () => {};
  }

  const startedAt = performance.now();
  frame = setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / duration);
    media.volume = Math.min(1, Math.max(0, from + (to - from) * easeInOut(progress)));
    if (progress >= 1) finish();
  }, FADE_STEP_MS);

  // The editor takes focus while its window opens, which can throttle timers in
  // the launcher. Never leave a track stuck at a partial volume because the
  // ramp stalled.
  guard = setTimeout(finish, duration + 150);

  return () => {
    if (finished) return;
    finished = true;
    stopTimers();
  };
};

/**
 * Pause theme media while the advanced editor window is open. The editor has
 * its own preview with audio and video, so leaving the launcher's background
 * track playing would make both overlap. The launcher fades its volume down
 * before pausing and back up on return, and only media that was actually
 * playing when the editor opened is resumed when it closes.
 */
export function themeMediaSuspension(node: HTMLElement) {
  /** Paused media, with the volume to restore on resume. */
  const pausedBySuspension = new Map<HTMLMediaElement, number>();
  /** In-flight volume ramps, so a quick open/close can reverse cleanly. */
  const ramps = new Map<HTMLMediaElement, () => void>();
  let suspended = false;

  const mediaIn = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLMediaElement>('audio, video'));

  const clamp = (volume: number) => Math.min(1, Math.max(0, volume));

  const cancelRamp = (media: HTMLMediaElement) => {
    ramps.get(media)?.();
    ramps.delete(media);
  };

  /** Fade a playing track down, then pause it and restore its volume. */
  const suspendMedia = (media: HTMLMediaElement, fade: boolean) => {
    if (media.paused || media.ended) return;

    // Keep the original listening level, even if a previous fade-in is still
    // running when the editor is reopened.
    const restore = pausedBySuspension.get(media) ?? media.volume;
    cancelRamp(media);
    pausedBySuspension.set(media, restore);

    if (!fade || media.muted || media.volume === 0) {
      media.pause();
      return;
    }

    ramps.set(
      media,
      fadeMediaVolume(media, 0, FADE_OUT_MS, () => {
        ramps.delete(media);
        media.pause();
        // Keep the element's own volume intact while it is paused; resuming
        // restores the listening level explicitly.
        media.volume = restore;
      })
    );
  };

  /** Start playback and fade the volume up to `volume`. */
  const fadeIn = (media: HTMLMediaElement, volume: number) => {
    const target = clamp(volume);
    cancelRamp(media);

    if (!media.isConnected) {
      pausedBySuspension.delete(media);
      return;
    }

    if (media.muted || target === 0) {
      media.volume = target;
      pausedBySuspension.delete(media);
      void media.play().catch(() => {});
      return;
    }

    media.volume = 0;
    void media
      .play()
      .then(() => {
        // The editor was reopened before the first frame of the fade-in.
        if (suspended) {
          suspendMedia(media, true);
          return;
        }
        ramps.set(
          media,
          fadeMediaVolume(media, target, FADE_IN_MS, () => {
            ramps.delete(media);
            pausedBySuspension.delete(media);
          })
        );
      })
      .catch(() => {
        media.volume = target;
        pausedBySuspension.delete(media);
      });
  };

  const suspendAll = (root: ParentNode = node) => {
    for (const media of mediaIn(root)) suspendMedia(media, true);
  };

  const resumeAll = () => {
    for (const [media, volume] of pausedBySuspension) {
      if (!media.isConnected) {
        pausedBySuspension.delete(media);
        continue;
      }
      if (!media.paused) {
        // A very quick open/close reversed the fade-out before it paused:
        // bring the level back up on the track that never stopped.
        cancelRamp(media);
        media.volume = clamp(volume);
        pausedBySuspension.delete(media);
        continue;
      }
      fadeIn(media, volume);
    }
  };

  // A theme can remount its media (for example after the active theme is
  // reloaded) while the editor is open. Catch those autoplaying elements too.
  const onPlay = (event: Event) => {
    if (suspended && event.target instanceof HTMLMediaElement) suspendMedia(event.target, false);
  };

  const observer = new MutationObserver((mutations) => {
    if (!suspended) return;
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added instanceof HTMLMediaElement) suspendMedia(added, false);
        else if (added instanceof HTMLElement) suspendAll(added);
      }
    }
  });

  node.addEventListener('play', onPlay, true);

  const unsubscribe = themeMediaSuspended.subscribe((value) => {
    if (value === suspended) return;
    suspended = value;
    if (suspended) {
      observer.observe(node, { childList: true, subtree: true });
      suspendAll();
    } else {
      observer.disconnect();
      resumeAll();
    }
  });

  return {
    destroy() {
      unsubscribe();
      observer.disconnect();
      node.removeEventListener('play', onPlay, true);
      for (const cancel of ramps.values()) cancel();
      ramps.clear();
      for (const [media, volume] of pausedBySuspension) media.volume = volume;
      pausedBySuspension.clear();
    },
  };
}

/**
 * Manage background video playback across document visibility changes.
 * Videos continue playing when the launcher window loses focus. Muted background
 * videos pause only when the document is hidden/minimized to save GPU decoding
 * cycles without interrupting theme music or audio.
 */
export function themeVideoLifecycle(node: HTMLVideoElement) {
  let pausedByLifecycle = false;

  const pause = () => {
    if (node.paused) return;
    pausedByLifecycle = true;
    node.pause();
  };

  const resume = () => {
    if (!pausedByLifecycle && !node.autoplay && !node.loop) return;
    pausedByLifecycle = false;
    playThemeMedia(node);
  };

  const sync = () => {
    if (!node.isConnected) {
      document.removeEventListener('visibilitychange', sync);
      return;
    }
    if (document.visibilityState === 'visible') {
      resume();
    } else if (node.muted || node.volume === 0) {
      pause();
    }
  };

  document.addEventListener('visibilitychange', sync);
  sync();

  return {
    destroy() {
      document.removeEventListener('visibilitychange', sync);
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
  const videoLifecycles = new WeakMap<HTMLVideoElement, () => void>();

  const prepare = (media: HTMLMediaElement) => {
    if (media instanceof HTMLVideoElement && !videoLifecycles.has(media)) {
      const lifecycle = themeVideoLifecycle(media);
      videoLifecycles.set(media, () => lifecycle.destroy());
    }

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

      for (const removed of mutation.removedNodes) {
        if (removed instanceof HTMLVideoElement) {
          videoLifecycles.get(removed)?.();
          videoLifecycles.delete(removed);
        } else if (removed instanceof HTMLElement) {
          removed.querySelectorAll?.<HTMLVideoElement>('video').forEach((video) => {
            videoLifecycles.get(video)?.();
            videoLifecycles.delete(video);
          });
        }
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
