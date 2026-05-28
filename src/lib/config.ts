import { invoke } from '@tauri-apps/api/core';

interface ConfigValue<T> {
  set(value: T, opts?: { encrypt?: boolean }): Promise<void>;
  get(fallback: T): Promise<T>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}

export const config = {
  value<T = unknown>(key: string): ConfigValue<T> {
    return {
      set(value: T, opts?: { encrypt?: boolean }): Promise<void> {
        return invoke('config_set', { key, value, encrypt: opts?.encrypt ?? false });
      },

      async get(fallback: T): Promise<T> {
        const result = await invoke<T | null>('config_get', { key });
        return result ?? fallback;
      },

      exists(): Promise<boolean> {
        return invoke<boolean>('config_exists', { key });
      },

      delete(): Promise<void> {
        return invoke('config_delete', { key });
      },
    };
  },

  all(): Promise<[string, unknown][]> {
    return invoke<[string, unknown][]>('config_all');
  },

  clear(): Promise<void> {
    return invoke('config_clear');
  },
};
