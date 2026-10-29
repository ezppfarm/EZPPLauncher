/**
 * Theme media playback helper.
 *
 * On macOS, WKWebView's media pipeline asks Tauri's custom `asset:` protocol
 * for thousands of one-byte ranges when it plays a WebM file. That request
 * storm starves the audio decoder, which makes the audio stutter or drop out.
 * Fetching the file once and handing the media element a `blob:` URL avoids
 * the custom protocol entirely and lets WebKit decode from a local buffer.
 */

type MediaCleanup = () => void;

const assetPattern = /^(?:asset:|https?:\/\/asset\.localhost(?:\/|$))/i;

// The request-storm problem is specific to WKWebView. Keep the native
// streaming path everywhere else, where the asset protocol behaves correctly
// (and where blob-backed media can fail to decode in WebKitGTK).
const useBlobMedia =
  typeof navigator !== 'undefined' && /Macintosh|Mac OS X/i.test(navigator.userAgent);

const blobUrlPromises = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();
const mediaTokens = new WeakMap<HTMLMediaElement, number>();
const mediaCleanups = new WeakMap<HTMLMediaElement, MediaCleanup>();
let tokenCounter = 0;
let cacheGeneration = 0;

export const isThemeAssetUrl = (url: string | undefined | null): url is string =>
  !!url && assetPattern.test(url);

/** Resolve a theme asset to a blob URL, falling back to the original URL. */
export const themeMediaUrl = async (source: string): Promise<string> => {
  if (!useBlobMedia || !isThemeAssetUrl(source)) return source;

  const cached = blobUrlPromises.get(source);
  if (cached) return cached;

  const generation = cacheGeneration;
  const promise = (async () => {
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Theme media request failed (${response.status})`);

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
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
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

  void themeMediaUrl(source).then((url) => {
    if (mediaTokens.get(node) !== token || !node.isConnected) return;
    if (node.src === url) return;

    const wasPlaying = !node.paused;
    const previousTime = Number.isFinite(node.currentTime) ? node.currentTime : 0;

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

      if (wasPlaying || node.autoplay) {
        void node.play().catch(() => {
          // Autoplay can be rejected until the user interacts with the window.
        });
      }
    };

    const onError = () => {
      cleanup();
      mediaCleanups.delete(node);

      // Keep the theme usable if this WebView cannot decode the blob.
      if (isThemeAssetUrl(source) && node.src !== source) {
        node.src = source;
        node.load();
        if (wasPlaying || node.autoplay) void node.play().catch(() => {});
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
    if (!isThemeAssetUrl(source)) return;
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
