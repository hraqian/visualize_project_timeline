import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { addDays, parseISO } from 'date-fns';
import type {
  ProjectState,
  ProjectItem,
  Swimlane,
  Dependency,
  DependencySettings,
  ActiveView,
  ItemType,
  TaskStyle,
  MilestoneStyle,
  TimescaleConfig,
  TimescaleTierConfig,
  StatusLabel,
  OptionalColumn,
  StylePaneSection,
  StylePaneMainTab,
  StylePaneItemSubTab,
  TaskLayout,
  DependencyConflictMode,
  DependencyLagAdjustment,
  RescheduledItemChange,
  CriticalPathStyle,
 } from '@/types';
import { DEFAULT_TASK_STYLE, DEFAULT_MILESTONE_STYLE, DEFAULT_SWIMLANE_STYLE, DEFAULT_STATUS_LABELS, DEFAULT_COLUMN_VISIBILITY, DEFAULT_DEPENDENCY_SETTINGS, DEFAULT_CRITICAL_PATH_STYLE } from '@/types';
import { getDefaultTimescale, computeCriticalPath, scheduleDependents } from '@/utils';
import { getGlobalSettings } from '@/utils/storage';
import { saveProjectToFile, loadProjectFromFile } from '@/utils/fileStorage';

/** Apply lag adjustments (from allow-exception mode) to a dependencies array. */
function applyLagAdjustments(deps: Dependency[], adjustments: DependencyLagAdjustment[]): Dependency[] {
  if (adjustments.length === 0) return deps;
  const adjMap = new Map(adjustments.map((a) => [`${a.fromId}:${a.toId}`, a]));
  return deps.map((d) => {
    const adj = adjMap.get(`${d.fromId}:${d.toId}`);
    if (adj) return { ...d, lag: adj.newLag, lagUnit: adj.newLagUnit };
    return d;
  });
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ProjectActions {
  // View
  setActiveView: (view: ActiveView) => void;
  setSelectedItem: (id: string | null) => void;
  setSelectedSwimlane: (id: string | null) => void;
  setSelectedDepKey: (key: string | null) => void;
  setStylePaneMainTab: (tab: StylePaneMainTab) => void;
  setStylePaneItemSubTab: (tab: StylePaneItemSubTab | null) => void;
  setStylePaneSection: (section: StylePaneSection | null) => void;
  setTaskLayout: (layout: TaskLayout) => void;
  setSwimlaneSpacing: (spacing: number) => void;
  setSelectedTierIndex: (index: number | null) => void;

  // Project persistence
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  newProject: () => void;

  // Project
  setProjectName: (name: string) => void;
  setTimelineTitle: (title: string) => void;

  // Items
  addItem: (item: Partial<ProjectItem> & { name: string; type: ItemType; swimlaneId?: string | null }) => string;
  addItemRelative: (referenceId: string, position: 'above' | 'below') => void;
  duplicateItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ProjectItem>) => void;
  deleteItem: (id: string) => void;
  toggleVisibility: (id: string) => void;
  toggleItemType: (id: string) => void;
  moveItem: (id: string, daysDelta: number) => void;
  resizeItem: (id: string, newEndDate: string) => void;
  setItemRow: (id: string, row: number) => void;
  reorderItem: (id: string, newIndex: number) => void;
  moveItemToSwimlane: (id: string, swimlaneId: string | null) => void;
  moveItemToGroup: (id: string, targetSwimlaneId: string | null, targetIndex: number) => void;

  // Swimlanes
  addSwimlane: (name: string) => string;
  addSwimlaneRelative: (referenceId: string, position: 'above' | 'below') => void;
  duplicateSwimlane: (id: string) => void;
  hideSwimlaneItems: (id: string) => void;
  updateSwimlane: (id: string, updates: Partial<Swimlane>) => void;
  applySwimlaneStyleToAll: (id: string, keys: (keyof Swimlane)[]) => void;
  deleteSwimlane: (id: string) => void;
  reorderSwimlane: (id: string, newOrder: number) => void;

  // Dependencies
  addDependency: (fromId: string, toId: string, options?: Partial<Pick<Dependency, 'type' | 'lag' | 'lagUnit' | 'visible' | 'fromPoint' | 'toPoint' | 'color' | 'transparency' | 'lineDash' | 'lineWidth' | 'arrowType' | 'arrowSize'>> & { forceSchedule?: boolean }) => void;
  removeDependency: (fromId: string, toId: string) => void;
  updateDependency: (fromId: string, toId: string, updates: Partial<Pick<Dependency, 'type' | 'lag' | 'lagUnit' | 'visible' | 'fromPoint' | 'toPoint' | 'color' | 'transparency' | 'lineDash' | 'lineWidth' | 'arrowType' | 'arrowSize'>> & { forceSchedule?: boolean }) => void;
  applyDependencyStyleToAll: (fromId: string, toId: string, keys: (keyof Pick<Dependency, 'visible' | 'fromPoint' | 'toPoint' | 'color' | 'transparency' | 'lineDash' | 'lineWidth' | 'arrowType' | 'arrowSize'>)[]) => void;
  toggleDependencyVisibility: (fromId: string, toId: string) => void;
  setItemDependencies: (itemId: string, deps: Dependency[]) => void;

  // Styles
  updateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  updateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  applyStyleToAll: (id: string) => void;
  applyPartialStyleToAll: (id: string, keys: string[], excludeSwimlanes?: boolean, onlyInSwimlane?: boolean) => void;

  applyTaskBarStyleToAll: (
    id: string,
    properties: { color?: boolean; barShape?: boolean; thickness?: boolean; spacing?: boolean },
    excludeSwimlanes: boolean,
  ) => void;

  // Status Labels
  addStatusLabel: (label: StatusLabel) => void;
  updateStatusLabel: (id: string, updates: Partial<StatusLabel>) => void;
  removeStatusLabel: (id: string) => void;

  // Timescale
  updateTimescale: (updates: Partial<TimescaleConfig>) => void;
  updateTier: (index: number, updates: Partial<TimescaleTierConfig>) => void;
  addTier: (tier: TimescaleTierConfig) => void;
  removeTier: (index: number) => void;

  // Critical Path
  toggleCriticalPath: () => void;
  recalcCriticalPath: () => void;
  updateCriticalPathStyle: (updates: Partial<CriticalPathStyle>) => void;

  // Column Visibility
  toggleColumn: (column: OptionalColumn) => void;

  // Dependencies toggle
  setShowDependencies: (show: boolean) => void;
  setDependencySettings: (settings: Partial<DependencySettings>) => RescheduledItemChange[];

  // Conflict resolution
  resolveConflicts: (resolutions: { itemId: string; action: 'reschedule' | 'keep' }[]) => void;
  dismissConflicts: () => void;

  // Multi-select (checkboxes)
  toggleCheckedItem: (id: string) => void;
  checkAllItems: () => void;
  uncheckAllItems: () => void;
  setCheckedItems: (ids: string[]) => void;

  // Bulk actions
  duplicateCheckedItems: () => void;
  hideCheckedItems: () => void;
  deleteCheckedItems: () => void;
  setColorForCheckedItems: (color: string) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
}

type ProjectStore = ProjectState & ProjectActions;
type UndoableKey = 'projectName' | 'timelineTitle' | 'items' | 'swimlanes' | 'dependencies' | 'statusLabels';
type Snapshot = Partial<Pick<ProjectStore, UndoableKey>>;
type DependencyStyleKey = keyof Pick<Dependency, 'visible' | 'fromPoint' | 'toPoint' | 'color' | 'transparency' | 'lineDash' | 'lineWidth' | 'arrowType' | 'arrowSize'>;

// Keys that represent saveable project data (changes to these mark the project dirty)
// Keys that mark the project dirty (all saveable project data + settings)
const SAVEABLE_KEYS: Set<string> = new Set([
  'projectName', 'timelineTitle', 'items', 'swimlanes', 'dependencies',
  'statusLabels', 'columnVisibility', 'timescale', 'swimlaneSpacing', 'showCriticalPath', 'criticalPathStyle', 'taskLayout',
  'showDependencies', 'dependencySettings',
]);

// Keys captured by undo/redo (only data edits, not view/display settings)
const UNDOABLE_KEYS: Set<UndoableKey> = new Set([
  'projectName', 'timelineTitle', 'items', 'swimlanes', 'dependencies', 'statusLabels',
]);

// ─── Undo / Redo stacks (kept outside store to avoid triggering re-renders) ──
const MAX_UNDO = 50;
let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];
let isUndoRedoing = false;          // guard to prevent snapshotting during undo/redo

function assignSnapshotValue<K extends UndoableKey>(snap: Snapshot, state: ProjectStore, key: K) {
  snap[key] = structuredClone(state[key]);
}

function takeSnapshot(state: ProjectStore): Snapshot {
  const snap: Snapshot = {};
  for (const key of UNDOABLE_KEYS) {
    assignSnapshotValue(snap, state, key);
  }
  return snap;
}

function applySnapshot(snap: Snapshot): Partial<ProjectStore> {
  return { ...snap, isDirty: true } as Partial<ProjectStore>;
}

export const useProjectStore = create<ProjectStore>((_set, get) => {
  // Wrap set to auto-mark dirty when saveable data changes + push undo snapshots
  const set: typeof _set = (partial, replace) => {
    const computeNext = (prev: ProjectStore): ProjectStore => {
      const next = typeof partial === 'function' ? partial(prev) : partial;
      const keys = Object.keys(next as object);
      const nextRecord = next as unknown as Record<string, unknown>;
      const prevRecord = prev as unknown as Record<string, unknown>;
      const changedKeys = keys.filter((k) => !Object.is(
        nextRecord[k],
        prevRecord[k],
      ));
      // Check if any saveable key actually changed
      const touchesSaveable = changedKeys.some((k) => SAVEABLE_KEYS.has(k));
      if (touchesSaveable && !Object.prototype.hasOwnProperty.call(next as Record<string, unknown>, 'isDirty')) {
        // Push undo snapshot only when undoable keys are touched
        const touchesUndoable = changedKeys.some((k) => UNDOABLE_KEYS.has(k as UndoableKey));
        if (!isUndoRedoing && touchesUndoable) {
          undoStack.push(takeSnapshot(prev as unknown as ProjectStore));
          if (undoStack.length > MAX_UNDO) undoStack.shift();
          redoStack = [];
        }
        return { ...next, isDirty: true, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 } as ProjectStore;
      }
      return next as ProjectStore;
    };

    if (replace === true) {
      _set(computeNext, true);
      return;
    }

    _set(computeNext);
  };

  return {
  // ─── Initial State (empty — user picks or creates a project via modal) ───
  projectId: uuid(),
  lastModified: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  projectName: 'New Project',
  timelineTitle: 'New Project',
  items: [],
  swimlanes: [],
  dependencies: [],
  statusLabels: [...DEFAULT_STATUS_LABELS],
  columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
  checkedItemIds: [],
  timescale: getDefaultTimescale(),
  activeView: 'data',
  selectedItemId: null,
  selectedSwimlaneId: null,
  selectedDepKey: null,
  stylePaneMainTab: 'items',
  stylePaneItemSubTab: null,
  stylePaneSection: null,
  showCriticalPath: false,
  criticalPathStyle: { ...DEFAULT_CRITICAL_PATH_STYLE },
  showDependencies: false,
  dependencySettings: { ...DEFAULT_DEPENDENCY_SETTINGS },
  taskLayout: 'single-row',
  swimlaneSpacing: 5,
  selectedTierIndex: null,
  pendingConflicts: [],
  preConflictSnapshot: null,

  // ─── View ────────────────────────────────────────────────────────────
  setActiveView: (view) => set({ activeView: view }),
  setSelectedItem: (id) => set((state) => ({
    selectedItemId: id,
    selectedSwimlaneId: null,
    selectedDepKey: null,
    selectedTierIndex: null,
    stylePaneMainTab: 'items',
    stylePaneItemSubTab: id
      ? (state.items.find((item) => item.id === id)?.type === 'milestone' ? 'milestone' : 'task')
      : state.stylePaneItemSubTab,
  })),
  setSelectedSwimlane: (id) => set({
    selectedSwimlaneId: id,
    selectedItemId: null,
    selectedDepKey: null,
    selectedTierIndex: null,
    stylePaneMainTab: 'items',
    stylePaneItemSubTab: id ? 'swimlane' : null,
    stylePaneSection: id ? 'swimlaneTitle' : null,
  }),
  setSelectedDepKey: (key) => set({
    selectedDepKey: key,
    selectedItemId: null,
    selectedSwimlaneId: null,
    selectedTierIndex: null,
    stylePaneMainTab: 'items',
    stylePaneItemSubTab: key ? 'dependency' : null,
    stylePaneSection: null,
  }),
  setStylePaneMainTab: (tab) => set({
    stylePaneMainTab: tab,
    stylePaneItemSubTab: tab === 'items' ? get().stylePaneItemSubTab : null,
  }),
  setStylePaneItemSubTab: (tab) => set({
    stylePaneMainTab: 'items',
    stylePaneItemSubTab: tab,
  }),
  setStylePaneSection: (section) => set({ stylePaneSection: section }),
  setTaskLayout: (layout) => set({ taskLayout: layout }),
  setSwimlaneSpacing: (spacing) => set({ swimlaneSpacing: Math.max(0, Math.min(40, spacing)) }),
  setSelectedTierIndex: (index) => set({
    selectedTierIndex: index,
    stylePaneMainTab: index !== null ? 'timescale' : get().stylePaneMainTab,
  }),

  // ─── Project Persistence ─────────────────────────────────────────────
  saveProject: async () => {
    const state = get();
    try {
      const now = await saveProjectToFile(state as ProjectState);
      set({ lastModified: now, isDirty: false });
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  },
  loadProject: async (id) => {
    const data = await loadProjectFromFile(id);
    if (!data) return;
    undoStack = [];
    redoStack = [];
    // Migrate: upgrade legacy default timescale tier from 'month' to 'auto'
    if (data.timescale?.tiers?.length === 1 && data.timescale.tiers[0].unit === 'month' && data.timescale.tiers[0].format === 'MMM') {
      data.timescale.tiers[0].unit = 'auto';
    }
    data.criticalPathStyle = {
      ...DEFAULT_CRITICAL_PATH_STYLE,
      ...(data.criticalPathStyle ?? {}),
      itemBackground: {
        ...DEFAULT_CRITICAL_PATH_STYLE.itemBackground,
        ...(data.criticalPathStyle?.itemBackground ?? {}),
      },
      itemOutline: {
        ...DEFAULT_CRITICAL_PATH_STYLE.itemOutline,
        ...(data.criticalPathStyle?.itemOutline ?? {}),
      },
      titleColor: {
        ...DEFAULT_CRITICAL_PATH_STYLE.titleColor,
        ...(data.criticalPathStyle?.titleColor ?? {}),
      },
      dependencyColor: {
        ...DEFAULT_CRITICAL_PATH_STYLE.dependencyColor,
        ...(data.criticalPathStyle?.dependencyColor ?? {}),
      },
      dependencyDash: {
        ...DEFAULT_CRITICAL_PATH_STYLE.dependencyDash,
        ...(data.criticalPathStyle?.dependencyDash ?? {}),
      },
    };
    set({
      ...data,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      // Reset transient UI state
      activeView: 'data',
      selectedItemId: null,
      selectedSwimlaneId: null,
      selectedDepKey: null,
      stylePaneMainTab: 'items',
      stylePaneItemSubTab: null,
      stylePaneSection: null,
      checkedItemIds: [],
      selectedTierIndex: null,
      pendingConflicts: [],
      preConflictSnapshot: null,
    });
  },
  newProject: () => {
    undoStack = [];
    redoStack = [];
    const globalSettings = getGlobalSettings();
    const depDefaults = globalSettings.defaultDependencySettings;
    set({
      projectId: uuid(),
      lastModified: null,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      projectName: 'New Project',
      timelineTitle: 'New Project',
      items: [],
      swimlanes: [],
      dependencies: [],
      statusLabels: [...DEFAULT_STATUS_LABELS],
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY, predecessors: depDefaults.enabled },
      checkedItemIds: [],
      timescale: getDefaultTimescale(),
      activeView: 'data',
      selectedItemId: null,
      selectedSwimlaneId: null,
      selectedDepKey: null,
      stylePaneMainTab: 'items',
      stylePaneItemSubTab: null,
      stylePaneSection: null,
      showCriticalPath: false,
      criticalPathStyle: { ...DEFAULT_CRITICAL_PATH_STYLE },
      showDependencies: depDefaults.enabled,
      dependencySettings: { ...depDefaults },
      taskLayout: 'single-row',
      swimlaneSpacing: 5,
      selectedTierIndex: null,
      pendingConflicts: [],
      preConflictSnapshot: null,
    });
  },

  // ─── Undo / Redo ─────────────────────────────────────────────────────
  undo: () => {
    if (undoStack.length === 0) return;
    const current = takeSnapshot(get() as unknown as ProjectStore);
    redoStack.push(current);
    const prev = undoStack.pop()!;
    isUndoRedoing = true;
    set({ ...applySnapshot(prev), canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
    isUndoRedoing = false;
  },
  redo: () => {
    if (redoStack.length === 0) return;
    const current = takeSnapshot(get() as unknown as ProjectStore);
    undoStack.push(current);
    const next = redoStack.pop()!;
    isUndoRedoing = true;
    set({ ...applySnapshot(next), canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
    isUndoRedoing = false;
  },

  // ─── Project ─────────────────────────────────────────────────────────
  setProjectName: (name) => set({ projectName: name }),
  setTimelineTitle: (title) => set({ timelineTitle: title }),

  // ─── Items ───────────────────────────────────────────────────────────
  addItem: (partial) => {
    const today = new Date().toISOString().split('T')[0];
    const newItem: ProjectItem = {
      id: uuid(),
      name: partial.name,
      type: partial.type,
      startDate: partial.startDate || today,
      endDate: partial.endDate || (partial.type === 'milestone' ? (partial.startDate || today) : addDays(parseISO(partial.startDate || today), 7).toISOString().split('T')[0]),
      percentComplete: partial.percentComplete ?? 0,
      statusId: partial.statusId ?? null,
      assignedTo: partial.assignedTo ?? '',
      visible: partial.visible ?? true,
      swimlaneId: partial.swimlaneId ?? null,
      row: partial.row ?? 0,
      taskStyle: partial.taskStyle ? { ...DEFAULT_TASK_STYLE, ...partial.taskStyle } : { ...DEFAULT_TASK_STYLE },
      milestoneStyle: partial.milestoneStyle ? { ...DEFAULT_MILESTONE_STYLE, ...partial.milestoneStyle } : { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: partial.dependsOn || [],
      isCriticalPath: false,
    };
    set((state) => ({ items: [...state.items, newItem] }));
    return newItem.id;
  },

  addItemRelative: (referenceId, position) => {
    const state = get();
    const ref = state.items.find((i) => i.id === referenceId);
    if (!ref) return;
    const today = new Date().toISOString().split('T')[0];
    const newRow = position === 'above' ? ref.row : ref.row + 1;
    // Shift rows of items in the same swimlane that are at or after the new row
    const shifted = state.items.map((i) => {
      if (i.swimlaneId === ref.swimlaneId && i.row >= newRow && i.id !== referenceId) {
        return { ...i, row: i.row + 1 };
      }
      // For 'below', also shift the reference item's siblings that share a higher row
      return i;
    });
    const newItem: ProjectItem = {
      id: uuid(),
      name: 'New Task',
      type: 'task',
      startDate: today,
      endDate: addDays(parseISO(today), 7).toISOString().split('T')[0],
      percentComplete: 0,
      statusId: null,
      assignedTo: '',
      visible: true,
      swimlaneId: ref.swimlaneId,
      row: newRow,
      taskStyle: { ...DEFAULT_TASK_STYLE },
      milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: [],
      isCriticalPath: false,
    };
    set({ items: [...shifted, newItem] });
  },

  duplicateItem: (id) => {
    const state = get();
    const source = state.items.find((i) => i.id === id);
    if (!source) return;
    const newItem: ProjectItem = {
      ...source,
      id: uuid(),
      name: `${source.name} (copy)`,
      dependsOn: [],
      isCriticalPath: false,
      row: source.row + 1,
    };
    // Shift rows of items below in the same swimlane
    const shifted = state.items.map((i) => {
      if (i.swimlaneId === source.swimlaneId && i.row > source.row) {
        return { ...i, row: i.row + 1 };
      }
      return i;
    });
    set({ items: [...shifted, newItem] });
  },

  updateItem: (id, updates) => {
    const state = get();
    let newItems = state.items.map((i) => (i.id === id ? { ...i, ...updates } : i));
    let newDeps = state.dependencies;

    // If dates changed and we're in automatic scheduling mode, cascade to dependents
    const datesChanged = updates.startDate !== undefined || updates.endDate !== undefined;
    if (datesChanged && state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = isStrict
        ? 'dont-allow'
        : state.dependencySettings.conflictMode;
      const result = scheduleDependents([id], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ items: newItems, dependencies: newDeps, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }

    set({ items: newItems, dependencies: newDeps });
  },

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      dependencies: state.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
      stylePaneItemSubTab: state.selectedItemId === id ? null : state.stylePaneItemSubTab,
    })),

  toggleVisibility: (id) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)),
    })),

  toggleItemType: (id) =>
    set((state) => ({
      items: state.items.map((i) => {
        if (i.id !== id) return i;
        const newType = i.type === 'task' ? 'milestone' : 'task';
        return {
          ...i,
          type: newType,
          endDate: newType === 'milestone' ? i.startDate : i.endDate,
        };
      }),
    })),

  moveItem: (id, daysDelta) => {
    const state = get();
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    const newStart = addDays(parseISO(item.startDate), daysDelta).toISOString().split('T')[0];
    const newEnd = addDays(parseISO(item.endDate), daysDelta).toISOString().split('T')[0];

    let newItems = state.items.map((i) =>
      i.id === id ? { ...i, startDate: newStart, endDate: newEnd } : i
    );
    let newDeps = state.dependencies;

    // Auto-schedule dependents (only in automatic modes)
    if (state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = isStrict
        ? 'dont-allow'
        : state.dependencySettings.conflictMode;
      const result = scheduleDependents([id], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ items: newItems, dependencies: newDeps, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }

    set({ items: newItems, dependencies: newDeps });
  },

  resizeItem: (id, newEndDate) => {
    const state = get();
    let newItems = state.items.map((i) =>
      i.id === id ? { ...i, endDate: newEndDate } : i
    );
    let newDeps = state.dependencies;

    // Auto-schedule dependents (only in automatic modes)
    if (state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = isStrict
        ? 'dont-allow'
        : state.dependencySettings.conflictMode;
      const result = scheduleDependents([id], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ items: newItems, dependencies: newDeps, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }

    set({ items: newItems, dependencies: newDeps });
  },

  setItemRow: (id, row) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, row } : i)),
    })),

  reorderItem: (id, newIndex) =>
    set((state) => {
      const target = state.items.find((i) => i.id === id);
      if (!target) return state;
      const siblings = state.items
        .filter((i) => i.swimlaneId === target.swimlaneId)
        .sort((a, b) => a.row - b.row);
      const without = siblings.filter((i) => i.id !== id);
      without.splice(newIndex, 0, target);
      const rowMap = new Map(without.map((i, idx) => [i.id, idx]));
      return {
        items: state.items.map((i) =>
          rowMap.has(i.id) ? { ...i, row: rowMap.get(i.id)! } : i
        ),
      };
    }),

  moveItemToSwimlane: (id, swimlaneId) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, swimlaneId, row: 0 } : i)),
    })),

  moveItemToGroup: (id, targetSwimlaneId, targetIndex) =>
    set((state) => {
      // Move item to target swimlane
      const moved = state.items.map((i) =>
        i.id === id ? { ...i, swimlaneId: targetSwimlaneId } : i
      );
      // Reorder within the new group
      const target = moved.find((i) => i.id === id);
      if (!target) return state;
      const siblings = moved
        .filter((i) => i.swimlaneId === targetSwimlaneId)
        .sort((a, b) => a.row - b.row);
      const without = siblings.filter((i) => i.id !== id);
      without.splice(targetIndex, 0, target);
      const rowMap = new Map(without.map((i, idx) => [i.id, idx]));
      return {
        items: moved.map((i) =>
          rowMap.has(i.id) ? { ...i, row: rowMap.get(i.id)! } : i
        ),
      };
    }),

  // ─── Swimlanes ──────────────────────────────────────────────────────
  addSwimlane: (name) => {
    const state = get();
    const maxOrder = Math.max(...state.swimlanes.map((s) => s.order), -1);
    const colors = ['#334155', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
    const chosenColor = colors[state.swimlanes.length % colors.length];
    const newId = uuid();
    set((st) => ({
      swimlanes: [
        ...st.swimlanes,
        {
          id: newId,
          name,
          color: chosenColor,
          order: maxOrder + 1,
          collapsed: false,
          ...DEFAULT_SWIMLANE_STYLE,
          headerColor: chosenColor,
        },
      ],
    }));
    return newId;
  },

  addSwimlaneRelative: (referenceId, position) => {
    const state = get();
    const sorted = [...state.swimlanes].sort((a, b) => a.order - b.order);
    const refIndex = sorted.findIndex((s) => s.id === referenceId);
    if (refIndex === -1) return;
    const colors = ['#334155', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
    const chosenColor = colors[state.swimlanes.length % colors.length];
    const newSwimlane: Swimlane = {
      id: uuid(),
      name: 'New Swimlane',
      color: chosenColor,
      order: 0,
      collapsed: false,
      ...DEFAULT_SWIMLANE_STYLE,
      headerColor: chosenColor,
    };
    const insertIndex = position === 'above' ? refIndex : refIndex + 1;
    sorted.splice(insertIndex, 0, newSwimlane);
    set({
      swimlanes: sorted.map((s, i) => ({ ...s, order: i })),
    });
  },

  duplicateSwimlane: (id) => {
    const state = get();
    const source = state.swimlanes.find((s) => s.id === id);
    if (!source) return;
    const sorted = [...state.swimlanes].sort((a, b) => a.order - b.order);
    const sourceIndex = sorted.findIndex((s) => s.id === id);
    const newSwimlaneId = uuid();
    const newSwimlane: Swimlane = {
      ...source,
      id: newSwimlaneId,
      name: `${source.name} (copy)`,
      order: 0,
      collapsed: false,
    };
    sorted.splice(sourceIndex + 1, 0, newSwimlane);
    const sourceItems = state.items.filter((i) => i.swimlaneId === id);
    const newItems = sourceItems.map((item) => ({
      ...item,
      id: uuid(),
      swimlaneId: newSwimlaneId,
    }));
    set({
      swimlanes: sorted.map((s, i) => ({ ...s, order: i })),
      items: [...state.items, ...newItems],
    });
  },

  hideSwimlaneItems: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.swimlaneId === id ? { ...i, visible: false } : i
      ),
    })),

  updateSwimlane: (id, updates) =>
    set((state) => ({
      swimlanes: state.swimlanes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  applySwimlaneStyleToAll: (id, keys) => {
    const state = get();
    const source = state.swimlanes.find((s) => s.id === id);
    if (!source) return;
    const partial: Record<string, unknown> = {};
    for (const k of keys) {
      partial[k] = source[k];
    }
    set((st) => ({
      swimlanes: st.swimlanes.map((s) =>
        s.id === id ? s : { ...s, ...partial }
      ),
    }));
  },

  deleteSwimlane: (id) =>
    set((state) => ({
      swimlanes: state.swimlanes.filter((s) => s.id !== id),
      items: state.items.filter((i) => i.swimlaneId !== id),
      selectedSwimlaneId: state.selectedSwimlaneId === id ? null : state.selectedSwimlaneId,
      stylePaneItemSubTab: state.selectedSwimlaneId === id ? null : state.stylePaneItemSubTab,
      stylePaneSection: state.selectedSwimlaneId === id ? null : state.stylePaneSection,
    })),

  reorderSwimlane: (id, newOrder) =>
    set((state) => {
      const sorted = [...state.swimlanes].sort((a, b) => a.order - b.order);
      const target = sorted.find((s) => s.id === id);
      if (!target) return state;
      const without = sorted.filter((s) => s.id !== id);
      without.splice(newOrder, 0, target);
      return {
        swimlanes: without.map((s, i) => ({ ...s, order: i })),
      };
    }),

  // ─── Dependencies ──────────────────────────────────────────────────
  addDependency: (fromId, toId, options) => {
    const state = get();
    let newDeps: Dependency[] = [...state.dependencies, {
      fromId, toId,
      type: options?.type ?? 'finish-to-start',
      lag: options?.lag ?? 0,
      lagUnit: options?.lagUnit ?? 'd',
      visible: options?.visible ?? true,
      fromPoint: options?.fromPoint,
      toPoint: options?.toPoint,
      color: options?.color ?? '#475569',
      transparency: options?.transparency ?? 0,
      lineDash: options?.lineDash ?? 'solid',
      lineWidth: options?.lineWidth ?? 1.5,
      arrowType: options?.arrowType ?? 'standard',
      arrowSize: options?.arrowSize ?? 4,
    }];
    let newItems = state.items;
    if (options?.forceSchedule || state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = options?.forceSchedule && state.dependencySettings.schedulingMode === 'manual'
        ? 'dont-allow'
        : isStrict
          ? 'dont-allow'
          : state.dependencySettings.conflictMode;
      const result = scheduleDependents([toId], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ dependencies: newDeps, items: newItems, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }
    set({ dependencies: newDeps, items: newItems });
  },

  removeDependency: (fromId, toId) =>
    set((state) => ({
      dependencies: state.dependencies.filter((d) => !(d.fromId === fromId && d.toId === toId)),
    })),

  updateDependency: (fromId, toId, updates) => {
    const state = get();
    let newDeps = state.dependencies.map((d) =>
      d.fromId === fromId && d.toId === toId ? { ...d, ...updates } : d
    );
    let newItems = state.items;
    if (updates?.forceSchedule || state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = updates?.forceSchedule && state.dependencySettings.schedulingMode === 'manual'
        ? 'dont-allow'
        : isStrict
          ? 'dont-allow'
          : state.dependencySettings.conflictMode;
      const result = scheduleDependents([toId], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ dependencies: newDeps, items: newItems, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }
    set({ dependencies: newDeps, items: newItems });
  },

  applyDependencyStyleToAll: (fromId, toId, keys) => {
    const state = get();
    const source = state.dependencies.find((d) => d.fromId === fromId && d.toId === toId);
    if (!source || keys.length === 0) return;

    const partial: Partial<Pick<Dependency, DependencyStyleKey>> = {};
    const assignDependencyStyleValue = <K extends DependencyStyleKey>(key: K) => {
      partial[key] = source[key];
    };
    for (const key of keys) {
      assignDependencyStyleValue(key);
    }

    set((st) => ({
      dependencies: st.dependencies.map((dep) =>
        dep.fromId === fromId && dep.toId === toId ? dep : { ...dep, ...partial }
      ),
    }));
  },

  toggleDependencyVisibility: (fromId, toId) =>
    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.fromId === fromId && d.toId === toId ? { ...d, visible: !d.visible } : d
      ),
    })),

  setItemDependencies: (itemId, deps) => {
    const state = get();
    let newDeps: Dependency[] = [
      ...state.dependencies.filter((d) => d.toId !== itemId),
      ...deps,
    ];
    let newItems = state.items;
    if (state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const effectiveMode: DependencyConflictMode = isStrict
        ? 'dont-allow'
        : state.dependencySettings.conflictMode;
      const result = scheduleDependents([itemId], newItems, newDeps, effectiveMode, isStrict);
      newItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
      if (result.conflicts.length > 0 && effectiveMode === 'ask') {
        set({ dependencies: newDeps, items: newItems, pendingConflicts: result.conflicts, preConflictSnapshot: { items: state.items, dependencies: state.dependencies } });
        return;
      }
    }
    set({ dependencies: newDeps, items: newItems });
  },

  // ─── Styles ────────────────────────────────────────────────────────
  updateTaskStyle: (id, style) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, taskStyle: { ...i.taskStyle, ...style } } : i
      ),
    })),

  updateMilestoneStyle: (id, style) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, milestoneStyle: { ...i.milestoneStyle, ...style } } : i
      ),
    })),

  applyStyleToAll: (id) => {
    const state = get();
    const source = state.items.find((i) => i.id === id);
    if (!source) return;

    set((st) => ({
      items: st.items.map((i) => {
        if (i.id === id) return i;
        if (i.type === source.type) {
          if (source.type === 'task') {
            return { ...i, taskStyle: { ...source.taskStyle } };
          } else {
            return { ...i, milestoneStyle: { ...source.milestoneStyle } };
          }
        }
        return i;
      }),
    }));
  },

  applyPartialStyleToAll: (id, keys, excludeSwimlanes, onlyInSwimlane) => {
    const state = get();
    const source = state.items.find((i) => i.id === id);
    if (!source) return;

    set((st) => ({
      items: st.items.map((i) => {
        if (i.id === id) return i;
        if (i.type === source.type) {
          if (excludeSwimlanes && i.swimlaneId !== null) return i;
          if (onlyInSwimlane && i.swimlaneId !== source.swimlaneId) return i;
          if (source.type === 'task') {
            const partial: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in source.taskStyle) {
                partial[k] = (source.taskStyle as unknown as Record<string, unknown>)[k];
              }
            }
            return { ...i, taskStyle: { ...i.taskStyle, ...partial } };
          } else {
            const partial: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in source.milestoneStyle) {
                partial[k] = (source.milestoneStyle as unknown as Record<string, unknown>)[k];
              }
            }
            return { ...i, milestoneStyle: { ...i.milestoneStyle, ...partial } };
          }
        }
        return i;
      }),
    }));
  },

  applyTaskBarStyleToAll: (id, properties, excludeSwimlanes) => {
    const state = get();
    const source = state.items.find((i) => i.id === id);
    if (!source || source.type !== 'task') return;

    const keys: (keyof typeof properties)[] = [];
    if (properties.color) keys.push('color');
    if (properties.barShape) keys.push('barShape');
    if (properties.thickness) keys.push('thickness');
    if (properties.spacing) keys.push('spacing');
    if (keys.length === 0) return;

    const partial: Record<string, unknown> = {};
    for (const k of keys) {
      partial[k] = (source.taskStyle as unknown as Record<string, unknown>)[k];
    }

    set((st) => ({
      items: st.items.map((i) => {
        if (i.id === id || i.type !== 'task') return i;
        if (excludeSwimlanes && i.swimlaneId !== null) return i;
        return { ...i, taskStyle: { ...i.taskStyle, ...partial } };
      }),
    }));
  },

  // ─── Status Labels ──────────────────────────────────────────────────
  addStatusLabel: (label) =>
    set((state) => ({ statusLabels: [...state.statusLabels, label] })),

  updateStatusLabel: (id, updates) =>
    set((state) => ({
      statusLabels: state.statusLabels.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  removeStatusLabel: (id) =>
    set((state) => ({
      statusLabels: state.statusLabels.filter((s) => s.id !== id),
      // Clear statusId from items that reference the deleted label
      items: state.items.map((i) => (i.statusId === id ? { ...i, statusId: null } : i)),
    })),

  // ─── Timescale ──────────────────────────────────────────────────────
  updateTimescale: (updates) =>
    set((state) => ({ timescale: { ...state.timescale, ...updates } })),

  updateTier: (index, updates) =>
    set((state) => ({
      timescale: {
        ...state.timescale,
        tiers: state.timescale.tiers.map((t, i) => (i === index ? { ...t, ...updates } : t)),
      },
    })),

  addTier: (tier) =>
    set((state) => ({
      timescale: { ...state.timescale, tiers: [...state.timescale.tiers, tier] },
    })),

  removeTier: (index) =>
    set((state) => ({
      timescale: {
        ...state.timescale,
        tiers: state.timescale.tiers.filter((_, i) => i !== index),
      },
    })),

  // ─── Critical Path ─────────────────────────────────────────────────
  toggleCriticalPath: () => {
    const state = get();
    const newShow = !state.showCriticalPath;
    if (newShow) {
      const critical = computeCriticalPath(state.items, state.dependencies);
      set({
        showCriticalPath: true,
        items: state.items.map((i) => ({ ...i, isCriticalPath: critical.has(i.id) })),
      });
    } else {
      set({
        showCriticalPath: false,
        items: state.items.map((i) => ({ ...i, isCriticalPath: false })),
      });
    }
  },

  recalcCriticalPath: () => {
    const state = get();
    if (!state.showCriticalPath) return;
    const critical = computeCriticalPath(state.items, state.dependencies);
    set({
      items: state.items.map((i) => ({ ...i, isCriticalPath: critical.has(i.id) })),
    });
  },

  updateCriticalPathStyle: (updates) =>
    set((state) => ({
      criticalPathStyle: {
        ...state.criticalPathStyle,
        ...updates,
      },
    })),

  // ─── Column Visibility ──────────────────────────────────────────────
  toggleColumn: (column) =>
    set((state) => {
      const newVis = {
        ...state.columnVisibility,
        [column]: !state.columnVisibility[column],
      };
      // Sync showDependencies with predecessors column
      if (column === 'predecessors') {
        return { columnVisibility: newVis, showDependencies: newVis.predecessors };
      }
      return { columnVisibility: newVis };
    }),

  // ─── Dependencies ──────────────────────────────────────────────────
  setShowDependencies: (show: boolean) =>
    set((state) => ({
      showDependencies: show,
      columnVisibility: { ...state.columnVisibility, predecessors: show },
    })),

  setDependencySettings: (settings: Partial<DependencySettings>) => {
    const state = get();
    const newSettings = { ...state.dependencySettings, ...settings };
    const switchingToStrict =
      settings.schedulingMode === 'automatic-strict' &&
      state.dependencySettings.schedulingMode !== 'automatic-strict';

    if (switchingToStrict && state.dependencies.length > 0) {
      // Re-evaluate all items that are predecessors to snap successors to exact constraints
      const predecessorIds = [...new Set(state.dependencies.map((d) => d.fromId))];
      const result = scheduleDependents(predecessorIds, state.items, state.dependencies, 'dont-allow', true);
      set({ dependencySettings: newSettings, items: result.items, dependencies: applyLagAdjustments(state.dependencies, result.lagAdjustments) });

      // Compute changes for the summary
      const changes: RescheduledItemChange[] = [];
      const oldMap = new Map(state.items.map((i) => [i.id, i]));
      for (const item of result.items) {
        const old = oldMap.get(item.id);
        if (old && (old.startDate !== item.startDate || old.endDate !== item.endDate)) {
          changes.push({
            itemName: item.name,
            oldStart: old.startDate,
            oldEnd: old.endDate,
            newStart: item.startDate,
            newEnd: item.endDate,
          });
        }
      }
      return changes;
    } else {
      set({ dependencySettings: newSettings });
      return [];
    }
  },

  // ─── Conflict Resolution ───────────────────────────────────────────
  resolveConflicts: (resolutions) => {
    const state = get();
    const newItems = state.items.map((item) => {
      const resolution = resolutions.find((r) => r.itemId === item.id);
      if (!resolution) return item;
      if (resolution.action === 'reschedule') {
        const conflict = state.pendingConflicts.find((c) => c.itemId === item.id);
        if (conflict) {
          return { ...item, startDate: conflict.requiredStart, endDate: conflict.requiredEnd };
        }
      }
      // 'keep' — leave as-is (lag will be adjusted below)
      return item;
    });

    // For items kept as-is, adjust dependency lag to reflect actual position
    const keptIds = new Set(
      resolutions.filter((r) => r.action === 'keep').map((r) => r.itemId)
    );
    let newDeps = state.dependencies;
    if (keptIds.size > 0) {
      // Run scheduleDependents in allow-exception mode just for the kept items
      // to compute the lag adjustments needed (flexible context — no strict snap)
      const keptResult = scheduleDependents(
        [...keptIds], newItems, newDeps, 'allow-exception', false
      );
      newDeps = applyLagAdjustments(newDeps, keptResult.lagAdjustments);
    }

    // After resolving, cascade any rescheduled items
    const rescheduledIds = resolutions
      .filter((r) => r.action === 'reschedule')
      .map((r) => r.itemId);

    let finalItems = newItems;
    if (rescheduledIds.length > 0 && state.dependencySettings.schedulingMode !== 'manual') {
      const isStrict = state.dependencySettings.schedulingMode === 'automatic-strict';
      const result = scheduleDependents(rescheduledIds, newItems, newDeps, 'dont-allow', isStrict);
      finalItems = result.items;
      newDeps = applyLagAdjustments(newDeps, result.lagAdjustments);
    }

    set({ items: finalItems, dependencies: newDeps, pendingConflicts: [], preConflictSnapshot: null });
  },

  dismissConflicts: () => {
    const state = get();
    if (state.preConflictSnapshot) {
      // Revert to the state before the conflict-triggering mutation
      set({ items: state.preConflictSnapshot.items, dependencies: state.preConflictSnapshot.dependencies, pendingConflicts: [], preConflictSnapshot: null });
    } else {
      set({ pendingConflicts: [], preConflictSnapshot: null });
    }
  },

  // ─── Multi-select (checkboxes) ─────────────────────────────────────
  toggleCheckedItem: (id) =>
    set((state) => {
      const exists = state.checkedItemIds.includes(id);
      return {
        checkedItemIds: exists
          ? state.checkedItemIds.filter((i) => i !== id)
          : [...state.checkedItemIds, id],
      };
    }),

  checkAllItems: () =>
    set((state) => ({
      checkedItemIds: state.items.map((i) => i.id),
    })),

  uncheckAllItems: () => set({ checkedItemIds: [] }),

  setCheckedItems: (ids) => set({ checkedItemIds: ids }),

  // ─── Bulk Actions ──────────────────────────────────────────────────
  duplicateCheckedItems: () => {
    const state = get();
    const toDuplicate = state.items.filter((i) => state.checkedItemIds.includes(i.id));
    const newItems = toDuplicate.map((item) => ({
      ...item,
      id: uuid(),
      name: `${item.name} (copy)`,
      dependsOn: [],
      isCriticalPath: false,
    }));
    set((s) => ({
      items: [...s.items, ...newItems],
      checkedItemIds: newItems.map((i) => i.id), // select the duplicates
    }));
  },

  hideCheckedItems: () =>
    set((state) => ({
      items: state.items.map((i) =>
        state.checkedItemIds.includes(i.id) ? { ...i, visible: false } : i
      ),
      checkedItemIds: [],
    })),

  deleteCheckedItems: () =>
    set((state) => {
      const idsToDelete = new Set(state.checkedItemIds);
      return {
        items: state.items.filter((i) => !idsToDelete.has(i.id)),
        dependencies: state.dependencies.filter(
          (d) => !idsToDelete.has(d.fromId) && !idsToDelete.has(d.toId)
        ),
        checkedItemIds: [],
        selectedItemId: idsToDelete.has(state.selectedItemId ?? '') ? null : state.selectedItemId,
        stylePaneItemSubTab: idsToDelete.has(state.selectedItemId ?? '') ? null : state.stylePaneItemSubTab,
      };
    }),

  setColorForCheckedItems: (color) =>
    set((state) => ({
      items: state.items.map((i) => {
        if (!state.checkedItemIds.includes(i.id)) return i;
        return {
          ...i,
          taskStyle: { ...i.taskStyle, color },
          milestoneStyle: { ...i.milestoneStyle, color },
        };
      }),
    })),

  };
});
