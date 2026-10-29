import { invoke } from '@tauri-apps/api/core';

/**
 * Forward webview console output and uncaught errors to the launcher log file.
 *
 * Tauri's log plugin only captures Rust logs, so the frontend mirrors console
 * calls through a small command. The original console methods are preserved so
 * devtools output and HMR are unaffected.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const MAX_MESSAGE_LENGTH = 16_000;
const INITIALIZED_KEY = '__ezppLauncherLoggingInitialized';

const originalConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }

  if (typeof value === 'object' && value !== null) {
    try {
      const seen = new WeakSet<object>();
      return JSON.stringify(value, (_key, candidate: unknown) => {
        if (typeof candidate === 'bigint') return candidate.toString();
        if (typeof candidate === 'object' && candidate !== null) {
          if (seen.has(candidate)) return '[Circular]';
          seen.add(candidate);
        }
        return candidate;
      });
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function send(level: LogLevel, values: unknown[]) {
  const message = values.map(stringify).join(' ').slice(0, MAX_MESSAGE_LENGTH);

  // Never let a failed IPC call produce another console error and loop back.
  invoke('log_frontend', { level, message }).catch((error) => {
    originalConsole.error('Could not forward a log message:', error);
  });
}

export function initLogging() {
  if (typeof window === 'undefined') return;
  const marker = window as unknown as Record<string, boolean>;
  if (marker[INITIALIZED_KEY]) return;
  marker[INITIALIZED_KEY] = true;

  console.debug = (...values: unknown[]) => {
    originalConsole.debug(...values);
    send('debug', values);
  };
  console.info = (...values: unknown[]) => {
    originalConsole.info(...values);
    send('info', values);
  };
  console.log = (...values: unknown[]) => {
    originalConsole.log(...values);
    send('info', values);
  };
  console.warn = (...values: unknown[]) => {
    originalConsole.warn(...values);
    send('warn', values);
  };
  console.error = (...values: unknown[]) => {
    originalConsole.error(...values);
    send('error', values);
  };

  window.addEventListener('error', (event) => {
    send('error', [
      `[uncaught] ${event.message}`,
      event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '',
      event.error instanceof Error ? event.error.stack : '',
    ]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    send('error', ['[unhandled rejection]', event.reason]);
  });

  send('info', [`Webview started: ${window.location.href}`]);
}
