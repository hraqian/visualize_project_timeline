import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { addDays, parseISO } from 'date-fns';
import type {
  ProjectState,
  ProjectItem,
  Swimlane,
  Dependency,
  ActiveView,
  ItemType,
  TaskStyle,
  MilestoneStyle,
  TimescaleConfig,
  TimescaleTierConfig,
  StatusLabel,
  OptionalColumn,
  StylePaneSection,
} from '@/types';
import { DEFAULT_TASK_STYLE, DEFAULT_MILESTONE_STYLE, DEFAULT_SWIMLANE_STYLE, DEFAULT_STATUS_LABELS, DEFAULT_COLUMN_VISIBILITY } from '@/types';
import { getDefaultTimescale, computeCriticalPath, shiftDependents } from '@/utils';
import { saveProject as saveProjectToStorage, loadProject as loadProjectFromStorage } from '@/utils/storage';

// ─── Sample Data ─────────────────────────────────────────────────────────────

function createSampleData(): Pick<ProjectState, 'items' | 'swimlanes' | 'dependencies'> {
  const swimlanes: Swimlane[] = [
    { id: 's1', name: 'Planning', color: '#6366f1', order: 0, collapsed: false, ...DEFAULT_SWIMLANE_STYLE, headerColor: '#6366f1' },
    { id: 's2', name: 'Design', color: '#8b5cf6', order: 1, collapsed: false, ...DEFAULT_SWIMLANE_STYLE, headerColor: '#8b5cf6' },
    { id: 's3', name: 'Development', color: '#3b82f6', order: 2, collapsed: false, ...DEFAULT_SWIMLANE_STYLE, headerColor: '#3b82f6' },
    { id: 's4', name: 'Testing & Launch', color: '#22c55e', order: 3, collapsed: false, ...DEFAULT_SWIMLANE_STYLE, headerColor: '#22c55e' },
  ];

  const items: ProjectItem[] = [
    {
      id: 'i1', name: 'Project Kickoff', type: 'milestone',
      startDate: '2026-04-01', endDate: '2026-04-01',
      percentComplete: 100, statusId: 'on-track', assignedTo: 'Alex Chen', visible: true, swimlaneId: 's1', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'star-filled', color: '#f59e0b' },
      dependsOn: [], isCriticalPath: false,
    },
    {
      id: 'i2', name: 'Requirements Gathering', type: 'task',
      startDate: '2026-04-02', endDate: '2026-04-18',
      percentComplete: 80, statusId: 'on-track', assignedTo: 'Sarah Kim', visible: true, swimlaneId: 's1', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#6366f1' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i1'], isCriticalPath: false,
    },
    {
      id: 'i3', name: 'Stakeholder Review', type: 'milestone',
      startDate: '2026-04-21', endDate: '2026-04-21',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's1', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'flag-filled', color: '#ec4899' },
      dependsOn: ['i2'], isCriticalPath: false,
    },
    {
      id: 'i4', name: 'UI/UX Wireframes', type: 'task',
      startDate: '2026-04-22', endDate: '2026-05-09',
      percentComplete: 45, statusId: 'potential-risk', assignedTo: 'James Lee', visible: true, swimlaneId: 's2', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#8b5cf6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i3'], isCriticalPath: false,
    },
    {
      id: 'i5', name: 'Visual Design System', type: 'task',
      startDate: '2026-05-01', endDate: '2026-05-20',
      percentComplete: 20, statusId: 'at-risk', assignedTo: 'Emily Park', visible: true, swimlaneId: 's2', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#a855f7' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: [], isCriticalPath: false,
    },
    {
      id: 'i6', name: 'Design Approval', type: 'milestone',
      startDate: '2026-05-22', endDate: '2026-05-22',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's2', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'check', color: '#22c55e' },
      dependsOn: ['i4', 'i5'], isCriticalPath: false,
    },
    {
      id: 'i7', name: 'Frontend Development', type: 'task',
      startDate: '2026-05-25', endDate: '2026-07-03',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's3', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#3b82f6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i8', name: 'Backend API', type: 'task',
      startDate: '2026-05-25', endDate: '2026-06-26',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's3', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#06b6d4' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i9', name: 'Database Setup', type: 'task',
      startDate: '2026-05-25', endDate: '2026-06-06',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's3', row: 2,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#14b8a6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i10', name: 'Integration Testing', type: 'task',
      startDate: '2026-07-06', endDate: '2026-07-17',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's4', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#22c55e' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i7', 'i8'], isCriticalPath: false,
    },
    {
      id: 'i11', name: 'UAT & Bug Fixes', type: 'task',
      startDate: '2026-07-20', endDate: '2026-07-31',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's4', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#f97316' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i10'], isCriticalPath: false,
    },
    {
      id: 'i12', name: 'Go Live!', type: 'milestone',
      startDate: '2026-08-03', endDate: '2026-08-03',
      percentComplete: 0, statusId: null, assignedTo: '', visible: true, swimlaneId: 's4', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'flag-filled', color: '#ef4444', size: 24 },
      dependsOn: ['i11'], isCriticalPath: false,
    },
  ];

  const dependencies: Dependency[] = [
    { fromId: 'i1', toId: 'i2', type: 'finish-to-start' },
    { fromId: 'i2', toId: 'i3', type: 'finish-to-start' },
    { fromId: 'i3', toId: 'i4', type: 'finish-to-start' },
    { fromId: 'i4', toId: 'i6', type: 'finish-to-start' },
    { fromId: 'i5', toId: 'i6', type: 'finish-to-start' },
    { fromId: 'i6', toId: 'i7', type: 'finish-to-start' },
    { fromId: 'i6', toId: 'i8', type: 'finish-to-start' },
    { fromId: 'i6', toId: 'i9', type: 'finish-to-start' },
    { fromId: 'i7', toId: 'i10', type: 'finish-to-start' },
    { fromId: 'i8', toId: 'i10', type: 'finish-to-start' },
    { fromId: 'i10', toId: 'i11', type: 'finish-to-start' },
    { fromId: 'i11', toId: 'i12', type: 'finish-to-start' },
  ];

  return { items, swimlanes, dependencies };
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ProjectActions {
  // View
  setActiveView: (view: ActiveView) => void;
  setSelectedItem: (id: string | null) => void;
  setSelectedSwimlane: (id: string | null) => void;
  setStylePaneSection: (section: StylePaneSection | null) => void;
  setZoom: (zoom: number) => void;
  setSwimlaneSpacing: (spacing: number) => void;
  setSelectedTierIndex: (index: number | null) => void;

  // Project persistence
  saveProject: () => void;
  loadProject: (id: string) => void;
  newProject: () => void;

  // Project
  setProjectName: (name: string) => void;
  setTimelineTitle: (title: string) => void;

  // Items
  addItem: (item: Partial<ProjectItem> & { name: string; type: ItemType; swimlaneId?: string | null }) => void;
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
  addSwimlane: (name: string) => void;
  addSwimlaneRelative: (referenceId: string, position: 'above' | 'below') => void;
  duplicateSwimlane: (id: string) => void;
  hideSwimlaneItems: (id: string) => void;
  updateSwimlane: (id: string, updates: Partial<Swimlane>) => void;
  applySwimlaneStyleToAll: (id: string, keys: (keyof Swimlane)[]) => void;
  deleteSwimlane: (id: string) => void;
  reorderSwimlane: (id: string, newOrder: number) => void;

  // Dependencies
  addDependency: (fromId: string, toId: string) => void;
  removeDependency: (fromId: string, toId: string) => void;

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

  // Column Visibility
  toggleColumn: (column: OptionalColumn) => void;

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
}

type ProjectStore = ProjectState & ProjectActions;

const sample = createSampleData();

// Keys that represent saveable project data (changes to these mark the project dirty)
const DIRTY_KEYS: Set<string> = new Set([
  'projectName', 'timelineTitle', 'items', 'swimlanes', 'dependencies',
  'statusLabels', 'columnVisibility', 'timescale', 'zoom', 'swimlaneSpacing', 'showCriticalPath',
]);

export const useProjectStore = create<ProjectStore>((_set, get) => {
  // Wrap set to auto-mark dirty when saveable data changes
  const set: typeof _set = (partial, replace) => {
    _set((prev) => {
      const next = typeof partial === 'function' ? partial(prev) : partial;
      // Check if any saveable key is being changed
      const touchesSaveable = Object.keys(next as object).some((k) => DIRTY_KEYS.has(k));
      if (touchesSaveable && !(next as Record<string, unknown>).hasOwnProperty('isDirty')) {
        return { ...next, isDirty: true } as ProjectStore;
      }
      return next as ProjectStore;
    }, replace);
  };

  return {
  // ─── Initial State ───────────────────────────────────────────────────
  projectId: uuid(),
  lastModified: null,
  isDirty: false,
  projectName: 'Project Timeline',
  timelineTitle: 'Project Timeline',
  items: sample.items,
  swimlanes: sample.swimlanes,
  dependencies: sample.dependencies,
  statusLabels: [...DEFAULT_STATUS_LABELS],
  columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
  checkedItemIds: [],
  timescale: getDefaultTimescale(),
  activeView: 'data',
  selectedItemId: null,
  selectedSwimlaneId: null,
  stylePaneSection: null,
  showCriticalPath: false,
  zoom: 8,
  swimlaneSpacing: 5,
  selectedTierIndex: null,

  // ─── View ────────────────────────────────────────────────────────────
  setActiveView: (view) => set({ activeView: view }),
  setSelectedItem: (id) => set({ selectedItemId: id, selectedSwimlaneId: null }),
  setSelectedSwimlane: (id) => set({ selectedSwimlaneId: id, selectedItemId: null, stylePaneSection: 'swimlaneTitle' }),
  setStylePaneSection: (section) => set({ stylePaneSection: section }),
  setZoom: (zoom) => set({ zoom: Math.max(2, Math.min(30, zoom)) }),
  setSwimlaneSpacing: (spacing) => set({ swimlaneSpacing: Math.max(0, Math.min(40, spacing)) }),
  setSelectedTierIndex: (index) => set({ selectedTierIndex: index }),

  // ─── Project Persistence ─────────────────────────────────────────────
  saveProject: () => {
    const state = get();
    const now = saveProjectToStorage(state as ProjectState);
    set({ lastModified: now, isDirty: false });
  },
  loadProject: (id) => {
    const data = loadProjectFromStorage(id);
    if (!data) return;
    set({
      ...data,
      isDirty: false,
      // Reset transient UI state
      activeView: 'data',
      selectedItemId: null,
      selectedSwimlaneId: null,
      stylePaneSection: null,
      checkedItemIds: [],
      selectedTierIndex: null,
    });
  },
  newProject: () => {
    set({
      projectId: uuid(),
      lastModified: null,
      isDirty: false,
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
      stylePaneSection: null,
      showCriticalPath: false,
      zoom: 8,
      swimlaneSpacing: 5,
      selectedTierIndex: null,
    });
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

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      dependencies: state.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
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

    // Auto-shift dependents
    newItems = shiftDependents(id, daysDelta, newItems, state.dependencies);

    set({ items: newItems });
  },

  resizeItem: (id, newEndDate) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, endDate: newEndDate } : i)),
    })),

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
    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
    const chosenColor = colors[state.swimlanes.length % colors.length];
    set((st) => ({
      swimlanes: [
        ...st.swimlanes,
        {
          id: uuid(),
          name,
          color: chosenColor,
          order: maxOrder + 1,
          collapsed: false,
          ...DEFAULT_SWIMLANE_STYLE,
          headerColor: chosenColor,
        },
      ],
    }));
  },

  addSwimlaneRelative: (referenceId, position) => {
    const state = get();
    const sorted = [...state.swimlanes].sort((a, b) => a.order - b.order);
    const refIndex = sorted.findIndex((s) => s.id === referenceId);
    if (refIndex === -1) return;
    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
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
  addDependency: (fromId, toId) =>
    set((state) => ({
      dependencies: [...state.dependencies, { fromId, toId, type: 'finish-to-start' }],
    })),

  removeDependency: (fromId, toId) =>
    set((state) => ({
      dependencies: state.dependencies.filter((d) => !(d.fromId === fromId && d.toId === toId)),
    })),

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
                partial[k] = (source.taskStyle as Record<string, unknown>)[k];
              }
            }
            return { ...i, taskStyle: { ...i.taskStyle, ...partial } };
          } else {
            const partial: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in source.milestoneStyle) {
                partial[k] = (source.milestoneStyle as Record<string, unknown>)[k];
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
      partial[k] = (source.taskStyle as Record<string, unknown>)[k];
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

  // ─── Column Visibility ──────────────────────────────────────────────
  toggleColumn: (column) =>
    set((state) => ({
      columnVisibility: {
        ...state.columnVisibility,
        [column]: !state.columnVisibility[column],
      },
    })),

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
