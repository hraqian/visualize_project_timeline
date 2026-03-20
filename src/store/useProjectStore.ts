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
} from '@/types';
import { DEFAULT_TASK_STYLE, DEFAULT_MILESTONE_STYLE, DEFAULT_STATUS_LABELS } from '@/types';
import { getDefaultTimescale, computeCriticalPath, shiftDependents } from '@/utils';

// ─── Sample Data ─────────────────────────────────────────────────────────────

function createSampleData(): Pick<ProjectState, 'items' | 'swimlanes' | 'dependencies'> {
  const swimlanes: Swimlane[] = [
    { id: 's1', name: 'Planning', color: '#6366f1', order: 0, collapsed: false },
    { id: 's2', name: 'Design', color: '#8b5cf6', order: 1, collapsed: false },
    { id: 's3', name: 'Development', color: '#3b82f6', order: 2, collapsed: false },
    { id: 's4', name: 'Testing & Launch', color: '#22c55e', order: 3, collapsed: false },
  ];

  const items: ProjectItem[] = [
    {
      id: 'i1', name: 'Project Kickoff', type: 'milestone',
      startDate: '2026-04-01', endDate: '2026-04-01',
      percentComplete: 100, statusId: 'on-track', visible: true, swimlaneId: 's1', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'star-filled', color: '#f59e0b' },
      dependsOn: [], isCriticalPath: false,
    },
    {
      id: 'i2', name: 'Requirements Gathering', type: 'task',
      startDate: '2026-04-02', endDate: '2026-04-18',
      percentComplete: 80, statusId: 'on-track', visible: true, swimlaneId: 's1', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#6366f1' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i1'], isCriticalPath: false,
    },
    {
      id: 'i3', name: 'Stakeholder Review', type: 'milestone',
      startDate: '2026-04-21', endDate: '2026-04-21',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's1', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'flag-filled', color: '#ec4899' },
      dependsOn: ['i2'], isCriticalPath: false,
    },
    {
      id: 'i4', name: 'UI/UX Wireframes', type: 'task',
      startDate: '2026-04-22', endDate: '2026-05-09',
      percentComplete: 45, statusId: 'potential-risk', visible: true, swimlaneId: 's2', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#8b5cf6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i3'], isCriticalPath: false,
    },
    {
      id: 'i5', name: 'Visual Design System', type: 'task',
      startDate: '2026-05-01', endDate: '2026-05-20',
      percentComplete: 20, statusId: 'at-risk', visible: true, swimlaneId: 's2', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#a855f7' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: [], isCriticalPath: false,
    },
    {
      id: 'i6', name: 'Design Approval', type: 'milestone',
      startDate: '2026-05-22', endDate: '2026-05-22',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's2', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE, icon: 'check', color: '#22c55e' },
      dependsOn: ['i4', 'i5'], isCriticalPath: false,
    },
    {
      id: 'i7', name: 'Frontend Development', type: 'task',
      startDate: '2026-05-25', endDate: '2026-07-03',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's3', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#3b82f6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i8', name: 'Backend API', type: 'task',
      startDate: '2026-05-25', endDate: '2026-06-26',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's3', row: 1,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#06b6d4' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i9', name: 'Database Setup', type: 'task',
      startDate: '2026-05-25', endDate: '2026-06-06',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's3', row: 2,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#14b8a6' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i6'], isCriticalPath: false,
    },
    {
      id: 'i10', name: 'Integration Testing', type: 'task',
      startDate: '2026-07-06', endDate: '2026-07-17',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's4', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#22c55e' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i7', 'i8'], isCriticalPath: false,
    },
    {
      id: 'i11', name: 'UAT & Bug Fixes', type: 'task',
      startDate: '2026-07-20', endDate: '2026-07-31',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's4', row: 0,
      taskStyle: { ...DEFAULT_TASK_STYLE, color: '#f97316' }, milestoneStyle: { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: ['i10'], isCriticalPath: false,
    },
    {
      id: 'i12', name: 'Go Live!', type: 'milestone',
      startDate: '2026-08-03', endDate: '2026-08-03',
      percentComplete: 0, statusId: null, visible: true, swimlaneId: 's4', row: 1,
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
  setZoom: (zoom: number) => void;

  // Project
  setProjectName: (name: string) => void;

  // Items
  addItem: (item: Partial<ProjectItem> & { name: string; type: ItemType; swimlaneId: string }) => void;
  updateItem: (id: string, updates: Partial<ProjectItem>) => void;
  deleteItem: (id: string) => void;
  toggleVisibility: (id: string) => void;
  toggleItemType: (id: string) => void;
  moveItem: (id: string, daysDelta: number) => void;
  resizeItem: (id: string, newEndDate: string) => void;
  setItemRow: (id: string, row: number) => void;
  moveItemToSwimlane: (id: string, swimlaneId: string) => void;

  // Swimlanes
  addSwimlane: (name: string) => void;
  updateSwimlane: (id: string, updates: Partial<Swimlane>) => void;
  deleteSwimlane: (id: string) => void;
  reorderSwimlane: (id: string, newOrder: number) => void;

  // Dependencies
  addDependency: (fromId: string, toId: string) => void;
  removeDependency: (fromId: string, toId: string) => void;

  // Styles
  updateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  updateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  applyStyleToAll: (id: string) => void;
  applyPartialStyleToAll: (id: string, keys: string[]) => void;

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

}

type ProjectStore = ProjectState & ProjectActions;

const sample = createSampleData();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────────
  projectName: 'Project Timeline',
  items: sample.items,
  swimlanes: sample.swimlanes,
  dependencies: sample.dependencies,
  statusLabels: [...DEFAULT_STATUS_LABELS],
  timescale: getDefaultTimescale(),
  activeView: 'timeline',
  selectedItemId: null,
  showCriticalPath: false,
  zoom: 8,

  // ─── View ────────────────────────────────────────────────────────────
  setActiveView: (view) => set({ activeView: view }),
  setSelectedItem: (id) => set({ selectedItemId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(2, Math.min(30, zoom)) }),

  // ─── Project ─────────────────────────────────────────────────────────
  setProjectName: (name) => set({ projectName: name }),

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
      visible: partial.visible ?? true,
      swimlaneId: partial.swimlaneId,
      row: partial.row ?? 0,
      taskStyle: partial.taskStyle ? { ...DEFAULT_TASK_STYLE, ...partial.taskStyle } : { ...DEFAULT_TASK_STYLE },
      milestoneStyle: partial.milestoneStyle ? { ...DEFAULT_MILESTONE_STYLE, ...partial.milestoneStyle } : { ...DEFAULT_MILESTONE_STYLE },
      dependsOn: partial.dependsOn || [],
      isCriticalPath: false,
    };
    set((state) => ({ items: [...state.items, newItem] }));
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

  moveItemToSwimlane: (id, swimlaneId) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, swimlaneId, row: 0 } : i)),
    })),

  // ─── Swimlanes ──────────────────────────────────────────────────────
  addSwimlane: (name) => {
    const state = get();
    const maxOrder = Math.max(...state.swimlanes.map((s) => s.order), -1);
    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
    set((st) => ({
      swimlanes: [
        ...st.swimlanes,
        {
          id: uuid(),
          name,
          color: colors[st.swimlanes.length % colors.length],
          order: maxOrder + 1,
          collapsed: false,
        },
      ],
    }));
  },

  updateSwimlane: (id, updates) =>
    set((state) => ({
      swimlanes: state.swimlanes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  deleteSwimlane: (id) =>
    set((state) => ({
      swimlanes: state.swimlanes.filter((s) => s.id !== id),
      items: state.items.filter((i) => i.swimlaneId !== id),
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

  applyPartialStyleToAll: (id, keys) => {
    const state = get();
    const source = state.items.find((i) => i.id === id);
    if (!source) return;

    set((st) => ({
      items: st.items.map((i) => {
        if (i.id === id) return i;
        if (i.type === source.type) {
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

}));
