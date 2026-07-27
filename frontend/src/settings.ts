import { apiFetch } from './api';

export type UploadMode = 'auto' | 'manual';
export type ThemeMode = 'light' | 'dark';

export interface UserSettings {
  uploadMode: UploadMode;
  notificationsEnabled: boolean;
  showSharedFiles: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  uploadMode: 'auto',
  notificationsEnabled: true,
  showSharedFiles: false,
};

const THEME_KEY = 'bind-theme';
const DEDUP_KEY = 'bind-dedup-mode';

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function setTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore quota errors
  }
  document.documentElement.dataset.theme = theme;
}

export function applyStoredTheme(): ThemeMode {
  const theme = getTheme();
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function getDedupMode(): 'auto' | 'manual' {
  try {
    const v = localStorage.getItem(DEDUP_KEY);
    return v === 'manual' ? 'manual' : 'auto';
  } catch {
    return 'auto';
  }
}

export function setDedupMode(mode: 'auto' | 'manual'): void {
  try {
    localStorage.setItem(DEDUP_KEY, mode);
  } catch {
    // ignore
  }
}

/** Clear BIND localStorage keys and reset theme to light. */
export function clearLocalAppData(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('bind-') || key.startsWith('bind_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.push(THEME_KEY, DEDUP_KEY);
    for (const key of new Set(keysToRemove)) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  setTheme('light');
}

function normalizeSettings(data: Record<string, unknown>): UserSettings {
  return {
    uploadMode: data.uploadMode === 'manual' ? 'manual' : 'auto',
    notificationsEnabled: data.notificationsEnabled !== false,
    showSharedFiles: data.showSharedFiles === true,
  };
}

export async function fetchSettings(): Promise<UserSettings> {
  try {
    const res = await apiFetch('/api/settings');
    if (!res.ok) return { ...DEFAULT_SETTINGS };
    const body = await res.json();
    return normalizeSettings(body.data ?? body);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function patchSettings(
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const res = await apiFetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || 'Failed to save settings');
  }
  const body = await res.json();
  return normalizeSettings(body.data ?? body);
}
