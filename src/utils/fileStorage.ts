import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProjectState } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function shouldUseHostedStorage() {
  return getSupabaseClient() !== null;
}

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
  'taskLayout',
  'swimlaneSpacing',
  'showCriticalPath',
  'criticalPathStyle',
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

export interface FileProjectEntry {
  id: string;
  name: string;
  fileName: string;
  lastModified: string;
}

type HostedProjectRow = {
  id: string;
  name: string;
  last_modified: string;
  data: Partial<ProjectState>;
};

async function listProjectsFromApi(): Promise<FileProjectEntry[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  return res.json();
}

async function saveProjectToApi(state: ProjectState): Promise<string> {
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

async function loadProjectFromApi(id: string): Promise<Partial<ProjectState> | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) return null;
  return res.json();
}

async function deleteProjectFromApi(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' });
}

function mapHostedProject(row: HostedProjectRow): FileProjectEntry {
  return {
    id: row.id,
    name: row.name,
    fileName: `${row.name} (${row.id.slice(0, 8)}).json`,
    lastModified: row.last_modified,
  };
}

async function listProjectsFromSupabase(): Promise<FileProjectEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('id,name,last_modified,data')
    .order('last_modified', { ascending: false });

  if (error) {
    console.error('Failed to list hosted projects:', error);
    return [];
  }

  return (data as HostedProjectRow[]).map(mapHostedProject);
}

async function saveProjectToSupabase(state: ProjectState): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const data = extractSaveableState(state);
  const now = new Date().toISOString();
  const row = {
    id: state.projectId,
    name: state.projectName,
    last_modified: now,
    data,
  };

  const { error } = await supabase.from('projects').upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message || 'Failed to save project');
  }

  return now;
}

async function loadProjectFromSupabase(id: string): Promise<Partial<ProjectState> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('Failed to load hosted project:', error);
    return null;
  }

  return (data as { data: Partial<ProjectState> }).data;
}

async function deleteProjectFromSupabase(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete project');
  }
}

export async function listProjects(): Promise<FileProjectEntry[]> {
  return shouldUseHostedStorage() ? listProjectsFromSupabase() : listProjectsFromApi();
}

export async function saveProjectToFile(state: ProjectState): Promise<string> {
  return shouldUseHostedStorage() ? saveProjectToSupabase(state) : saveProjectToApi(state);
}

export async function loadProjectFromFile(id: string): Promise<Partial<ProjectState> | null> {
  return shouldUseHostedStorage() ? loadProjectFromSupabase(id) : loadProjectFromApi(id);
}

export async function deleteProjectFile(id: string): Promise<void> {
  return shouldUseHostedStorage() ? deleteProjectFromSupabase(id) : deleteProjectFromApi(id);
}
