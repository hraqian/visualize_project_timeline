import type { DependencySettings } from '@/types';
import { DEFAULT_DEPENDENCY_SETTINGS } from '@/types';

const GLOBAL_SETTINGS_KEY = 'pt_global_settings';

// ─── Global Settings (apply to new timelines) ────────────────────────────

export interface GlobalSettings {
  defaultDependencySettings: DependencySettings;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultDependencySettings: { ...DEFAULT_DEPENDENCY_SETTINGS },
};

export function getGlobalSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GLOBAL_SETTINGS };
    return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

export function saveGlobalSettings(settings: GlobalSettings): void {
  localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
}
