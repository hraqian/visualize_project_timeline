import type { ProjectState } from '@/types';

const PROJECTS_INDEX_KEY = 'pt_projects_index';
const PROJECT_DATA_PREFIX = 'pt_project_';

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
