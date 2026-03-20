// ─── Core Types ───────────────────────────────────────────────────────────────

export type ItemType = 'task' | 'milestone';

// ─── Status Labels ────────────────────────────────────────────────────────────

export interface StatusLabel {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_STATUS_LABELS: StatusLabel[] = [
  { id: 'on-track', label: 'On Track', color: '#22c55e' },
  { id: 'potential-risk', label: 'Potential Risk', color: '#f59e0b' },
  { id: 'at-risk', label: 'At Risk', color: '#ef4444' },
];

export type BarShape =
  | 'rounded'
  | 'square'
  | 'flat'
  | 'capsule'
  | 'chevron'
  | 'double-chevron'
  | 'arrow-right'
  | 'pointed'
  | 'notched'
  | 'tab'
  | 'arrow-both'
  | 'trapezoid';
export type LabelPosition = 'inside' | 'above' | 'right' | 'left';
export type MilestoneIcon =
  | 'diamond'
  | 'diamond-filled'
  | 'triangle'
  | 'triangle-filled'
  | 'flag'
  | 'flag-filled'
  | 'star'
  | 'star-filled'
  | 'circle'
  | 'circle-filled'
  | 'square-ms'
  | 'square-ms-filled'
  | 'check'
  | 'arrow-up'
  | 'arrow-right'
  | 'hexagon';

export interface TaskStyle {
  barShape: BarShape;
  color: string;
  thickness: number; // px height of bar
  labelPosition: LabelPosition;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  fontWeight: number;
}

export interface MilestoneStyle {
  icon: MilestoneIcon;
  size: number;
  color: string;
  fontSize: number;
  fontColor: string;
  labelPosition: LabelPosition;
  fontFamily: string;
  fontWeight: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  type: ItemType;
  startDate: string; // ISO date string
  endDate: string; // ISO date string (same as startDate for milestones)
  percentComplete: number; // 0-100
  statusId: string | null; // references StatusLabel.id
  visible: boolean;
  swimlaneId: string;
  row: number; // row within swimlane for stacking
  taskStyle: TaskStyle;
  milestoneStyle: MilestoneStyle;
  // Dependencies
  dependsOn: string[]; // IDs of items this depends on
  // Critical path
  isCriticalPath: boolean;
}

export interface Swimlane {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed: boolean;
}

export interface Dependency {
  fromId: string;
  toId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
}

// ─── Timescale Types ─────────────────────────────────────────────────────────

export type TimescaleTier = 'year' | 'quarter' | 'month' | 'week' | 'day';

export interface TimescaleTierConfig {
  unit: TimescaleTier;
  visible: boolean;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
}

export interface TimescaleConfig {
  tiers: TimescaleTierConfig[];
  fiscalYearStartMonth: number; // 1-12
  showToday: boolean;
  todayColor: string;
}

// ─── App State ───────────────────────────────────────────────────────────────

export type ActiveView = 'data' | 'timeline';

export interface ProjectState {
  projectName: string;
  items: ProjectItem[];
  swimlanes: Swimlane[];
  dependencies: Dependency[];
  statusLabels: StatusLabel[];
  timescale: TimescaleConfig;
  activeView: ActiveView;
  selectedItemId: string | null;
  showCriticalPath: boolean;
  zoom: number; // pixels per day
}

// ─── Default Styles ──────────────────────────────────────────────────────────

export const FONT_FAMILIES = [
  'Inter',
  'system-ui',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
] as const;

export const FONT_WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
] as const;

export const DEFAULT_TASK_STYLE: TaskStyle = {
  barShape: 'rounded',
  color: '#6366f1',
  thickness: 32,
  labelPosition: 'right',
  fontSize: 13,
  fontColor: '#334155',
  fontFamily: 'Inter',
  fontWeight: 500,
};

export const DEFAULT_MILESTONE_STYLE: MilestoneStyle = {
  icon: 'diamond-filled',
  size: 20,
  color: '#f59e0b',
  fontSize: 13,
  fontColor: '#334155',
  labelPosition: 'right',
  fontFamily: 'Inter',
  fontWeight: 500,
};

export const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f59e0b', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#64748b', // slate
  '#1e293b', // dark
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#e11d48', // rose
  '#84cc16', // lime
  '#0ea5e9', // sky
];
