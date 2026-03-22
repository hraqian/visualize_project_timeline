import type { ProjectState, DependencySettings } from '@/types';
import { DEFAULT_DEPENDENCY_SETTINGS } from '@/types';

const PROJECTS_INDEX_KEY = 'pt_projects_index';
const PROJECT_DATA_PREFIX = 'pt_project_';
const GLOBAL_SETTINGS_KEY = 'pt_global_settings';

export interface ProjectIndexEntry {
  id: string;
  name: string;
  lastModified: string;
}

// ─── Saveable state keys (exclude transient UI state) ─────────────────────

const SAVEABLE_KEYS: (keyof ProjectState)[] = [
  'projectId',
  'projectName',
  'timelineTitle',
  'items',
  'swimlanes',
  'dependencies',
  'statusLabels',
  'columnVisibility',
  'timescale',
  'zoom',
  'taskLayout',
  'swimlaneSpacing',
  'showCriticalPath',
  'showDependencies',
  'dependencySettings',
];

/**
 * Extract only the saveable portion of project state (excludes transient UI state
 * like selectedItemId, activeView, isDirty, etc.)
 */
function extractSaveableState(state: ProjectState): Partial<ProjectState> {
  const result: Record<string, unknown> = {};
  for (const key of SAVEABLE_KEYS) {
    result[key] = state[key];
  }
  return result as Partial<ProjectState>;
}

// ─── Index operations ─────────────────────────────────────────────────────

export function getProjectIndex(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectIndexEntry[];
  } catch {
    return [];
  }
}

function setProjectIndex(index: ProjectIndexEntry[]): void {
  localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export function saveProject(state: ProjectState): string {
  const now = new Date().toISOString();
  const id = state.projectId;
  const data = extractSaveableState(state);

  // Write project data
  localStorage.setItem(PROJECT_DATA_PREFIX + id, JSON.stringify(data));

  // Update index
  const index = getProjectIndex();
  const existing = index.findIndex((e) => e.id === id);
  const entry: ProjectIndexEntry = { id, name: state.projectName, lastModified: now };
  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
  setProjectIndex(index);

  return now;
}

export function loadProject(id: string): Partial<ProjectState> | null {
  try {
    const raw = localStorage.getItem(PROJECT_DATA_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ProjectState>;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_DATA_PREFIX + id);
  const index = getProjectIndex().filter((e) => e.id !== id);
  setProjectIndex(index);
}

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
