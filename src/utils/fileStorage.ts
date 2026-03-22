/**
 * File-based project storage via the dev server API.
 *
 * Projects are saved as .json files in data/projects/ on the server.
 * All operations use fetch() — works in every browser.
 */

import type { ProjectState } from '@/types';

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

function extractSaveableState(state: ProjectState): Partial<ProjectState> {
  const result: Record<string, unknown> = {};
  for (const key of SAVEABLE_KEYS) {
    result[key] = state[key];
  }
  return result as Partial<ProjectState>;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface FileProjectEntry {
  id: string;
  name: string;
  fileName: string;
  lastModified: string;
}

// ─── API calls ────────────────────────────────────────────────────────────

/**
 * List all projects from the server.
 */
export async function listProjects(): Promise<FileProjectEntry[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  return res.json();
}

/**
 * Save a project to the server. Returns the ISO timestamp of save.
 */
export async function saveProjectToFile(state: ProjectState): Promise<string> {
  const data = extractSaveableState(state);
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save project');
  }
  const result = await res.json();
  return result.lastModified;
}

/**
 * Load a project by its ID from the server.
 */
export async function loadProjectFromFile(id: string): Promise<Partial<ProjectState> | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Delete a project by its ID from the server.
 */
export async function deleteProjectFile(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' });
}
