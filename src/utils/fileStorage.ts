/**
 * File-based project storage using the File System Access API.
 *
 * Projects are saved as .json files inside a user-chosen directory.
 * The directory handle is persisted in IndexedDB so it survives page reloads
 * (the browser will re-prompt for permission if needed).
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

// ─── IndexedDB for directory handle persistence ───────────────────────────

const IDB_NAME = 'pt_file_storage';
const IDB_STORE = 'handles';
const IDB_KEY = 'projectsDir';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// ─── Directory handle management ──────────────────────────────────────────

let _dirHandle: FileSystemDirectoryHandle | null = null;

/** Check if File System Access API is supported. */
export function isFileSystemSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Get the current directory handle, or null if not set. */
export function getDirectoryHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle;
}

/**
 * Try to restore a previously stored directory handle from IndexedDB.
 * The browser may re-prompt the user for permission.
 * Returns true if a handle was restored and permission granted.
 */
export async function restoreDirectoryHandle(): Promise<boolean> {
  const handle = await getStoredHandle();
  if (!handle) return false;

  // Verify we still have permission
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    _dirHandle = handle;
    return true;
  }

  // Try to request permission (requires user gesture — may fail silently)
  try {
    const req = await handle.requestPermission({ mode: 'readwrite' });
    if (req === 'granted') {
      _dirHandle = handle;
      return true;
    }
  } catch {
    // Permission denied or not in user gesture context
  }

  return false;
}

/**
 * Prompt the user to pick a directory for storing project files.
 * Returns true if a directory was selected.
 */
export async function pickDirectory(): Promise<boolean> {
  try {
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ mode: 'readwrite' });
    _dirHandle = handle;
    await storeHandle(handle);
    return true;
  } catch {
    // User cancelled the picker
    return false;
  }
}

// ─── Project index (derived from .json files in the directory) ────────────

export interface FileProjectEntry {
  id: string;
  name: string;
  fileName: string;
  lastModified: string;
}

/**
 * Scan the directory for .json project files and return an index.
 */
export async function listProjects(): Promise<FileProjectEntry[]> {
  if (!_dirHandle) return [];

  const entries: FileProjectEntry[] = [];

  for await (const [name, handle] of _dirHandle.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ProjectState>;
      if (data.projectId && data.projectName) {
        entries.push({
          id: data.projectId,
          name: data.projectName,
          fileName: name,
          lastModified: new Date(file.lastModified).toISOString(),
        });
      }
    } catch {
      // Skip unparseable files
    }
  }

  return entries;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

/**
 * Generate a safe filename from the project name.
 */
function toFileName(name: string, id: string): string {
  // Use project name, sanitized for filesystem. Append short ID to avoid collisions.
  const safe = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const shortId = id.slice(0, 8);
  return `${safe || 'Untitled'} (${shortId}).json`;
}

/**
 * Save a project to the directory. Returns the ISO timestamp of save.
 * If the project was previously saved under a different name, removes the old file.
 */
export async function saveProjectToFile(state: ProjectState): Promise<string> {
  if (!_dirHandle) throw new Error('No directory selected');

  const data = extractSaveableState(state);
  const json = JSON.stringify(data, null, 2);
  const newFileName = toFileName(state.projectName, state.projectId);

  // Check if there's an existing file for this project ID with a different name
  for await (const [name, handle] of _dirHandle.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json') || name === newFileName) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const existing = JSON.parse(text) as Partial<ProjectState>;
      if (existing.projectId === state.projectId) {
        // Remove old file (project was renamed)
        await _dirHandle.removeEntry(name);
        break;
      }
    } catch {
      // Skip
    }
  }

  // Write the file
  const fileHandle = await _dirHandle.getFileHandle(newFileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(json);
  await writable.close();

  return new Date().toISOString();
}

/**
 * Load a project by its ID (scans directory for matching file).
 */
export async function loadProjectFromFile(id: string): Promise<Partial<ProjectState> | null> {
  if (!_dirHandle) return null;

  for await (const [name, handle] of _dirHandle.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ProjectState>;
      if (data.projectId === id) return data;
    } catch {
      // Skip
    }
  }

  return null;
}

/**
 * Delete a project file by its ID.
 */
export async function deleteProjectFile(id: string): Promise<void> {
  if (!_dirHandle) return;

  for await (const [name, handle] of _dirHandle.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ProjectState>;
      if (data.projectId === id) {
        await _dirHandle.removeEntry(name);
        return;
      }
    } catch {
      // Skip
    }
  }
}
