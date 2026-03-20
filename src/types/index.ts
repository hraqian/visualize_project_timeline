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
export type LabelPosition = 'far-left' | 'left' | 'center' | 'right' | 'above' | 'below';
export type DateFormat =
  | 'MMM d'          // Jul 1
  | "MMM d ''yy"     // Jul 1 '20
  | 'MMM d, yyyy'    // Jul 1, 2020
  | 'MMM yyyy'       // Jul 2020
  | 'MMMM d, yyyy'   // July 1, 2020
  | 'MMMM dd, yyyy'  // July 01, 2020
  | 'MM/dd/yyyy'     // 07/01/2020
  | 'EEE M/d'        // Wed 7/1
  | "EEE M/d/yy"     // Wed 7/1/20
  | 'EEE MMM d'      // Wed Jul 1
  | "EEE MMM d, ''yy"; // Wed Jul 1, '20
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
  | 'hexagon'
  | 'arrow-down'
  | 'star-6pt'
  | 'plus'
  | 'circle-half'
  | 'pentagon'
  | 'heart'
  | 'chevron-right'
  | 'triangle-down';

export type TextAlign = 'left' | 'center' | 'right';
export type DurationUnit = 'days' | 'weeks' | 'months' | 'quarters' | 'years';
export type DurationFormat =
  | 'd' | 'days'                       // Days
  | 'w' | 'wks' | 'weeks'             // Weeks
  | 'mons' | 'months'                  // Months
  | 'q' | 'qrts' | 'quarters'         // Quarters
  | 'y' | 'yrs' | 'years';            // Years

export type ConnectorThickness = 'thin' | 'medium' | 'thick';

export interface TaskStyle {
  barShape: BarShape;
  color: string;
  thickness: number; // px height of bar
  spacing: number; // px vertical gap between task bars
  // Show/hide toggles
  showTitle: boolean;
  showDate: boolean;
  showDuration: boolean;
  showPercentComplete: boolean;
  showVerticalConnector: boolean;
  // Title label styling
  labelPosition: LabelPosition;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: TextAlign;
  // Date label styling
  dateFormat: DateFormat;
  dateLabelPosition: LabelPosition;
  dateFontSize: number;
  dateFontColor: string;
  dateFontFamily: string;
  dateFontWeight: number;
  dateFontStyle: 'normal' | 'italic';
  dateTextDecoration: 'none' | 'underline';
  dateTextAlign: TextAlign;
  // Duration label styling
  durationFormat: DurationFormat;
  durationLabelPosition: LabelPosition;
  durationFontSize: number;
  durationFontColor: string;
  durationFontFamily: string;
  durationFontWeight: number;
  durationFontStyle: 'normal' | 'italic';
  durationTextDecoration: 'none' | 'underline';
  durationTextAlign: TextAlign;
  // Percent complete label styling
  pctLabelPosition: LabelPosition;
  pctFontSize: number;
  pctFontColor: string;
  pctFontFamily: string;
  pctFontWeight: number;
  pctFontStyle: 'normal' | 'italic';
  pctTextDecoration: 'none' | 'underline';
  pctHighlightColor: string;
  // Vertical connector styling
  connectorColor: string;
  connectorThickness: ConnectorThickness;
}

export interface MilestoneStyle {
  icon: MilestoneIcon;
  size: number;
  color: string;
  position: 'above' | 'below';
  // Title
  showTitle: boolean;
  fontSize: number;
  fontColor: string;
  labelPosition: LabelPosition;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  // Date
  showDate: boolean;
  dateFontSize: number;
  dateFontColor: string;
  dateFontFamily: string;
  dateFontWeight: number;
  dateFontStyle: 'normal' | 'italic';
  dateTextDecoration: 'none' | 'underline';
  dateLabelPosition: LabelPosition;
  dateTextAlign: 'left' | 'center' | 'right';
  dateFormat: string;
  // Connector
  showConnector: boolean;
  connectorColor: string;
  connectorThickness: ConnectorThickness;
}

export interface ProjectItem {
  id: string;
  name: string;
  type: ItemType;
  startDate: string; // ISO date string
  endDate: string; // ISO date string (same as startDate for milestones)
  percentComplete: number; // 0-100
  statusId: string | null; // references StatusLabel.id
  assignedTo: string; // person name, empty string if unassigned
  visible: boolean;
  swimlaneId: string | null;
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

export type StylePaneSection = 'bar' | 'title' | 'date' | 'duration' | 'percentComplete' | 'verticalConnector' | 'milestoneShape' | 'milestoneTitle' | 'milestoneDate' | 'milestoneConnector';

export type OptionalColumn = 'percentComplete' | 'assignedTo' | 'status';

export interface ColumnVisibility {
  percentComplete: boolean;
  assignedTo: boolean;
  status: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  percentComplete: true,
  assignedTo: true,
  status: true,
};

export interface ProjectState {
  projectName: string;
  timelineTitle: string; // separate title shown inside TimelineView (for exports)
  items: ProjectItem[];
  swimlanes: Swimlane[];
  dependencies: Dependency[];
  statusLabels: StatusLabel[];
  columnVisibility: ColumnVisibility;
  checkedItemIds: string[]; // multi-select checkbox state
  timescale: TimescaleConfig;
  activeView: ActiveView;
  selectedItemId: string | null;
  stylePaneSection: StylePaneSection | null; // which collapsible section is expanded in StylePane
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
  spacing: 8,
  // Show/hide toggles
  showTitle: true,
  showDate: false,
  showDuration: false,
  showPercentComplete: false,
  showVerticalConnector: false,
  // Title label
  labelPosition: 'right',
  fontSize: 13,
  fontColor: '#334155',
  fontFamily: 'Inter',
  fontWeight: 500,
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  // Date label defaults
  dateFormat: 'MMM d',
  dateLabelPosition: 'left',
  dateFontSize: 9,
  dateFontColor: '#334155',
  dateFontFamily: 'Arial',
  dateFontWeight: 400,
  dateFontStyle: 'normal',
  dateTextDecoration: 'none',
  dateTextAlign: 'left',
  // Duration label defaults
  durationFormat: 'days',
  durationLabelPosition: 'left',
  durationFontSize: 9,
  durationFontColor: '#334155',
  durationFontFamily: 'Arial',
  durationFontWeight: 400,
  durationFontStyle: 'normal',
  durationTextDecoration: 'none',
  durationTextAlign: 'left',
  // Percent complete label defaults
  pctLabelPosition: 'center',
  pctFontSize: 9,
  pctFontColor: '#3b82f6',
  pctFontFamily: 'Arial',
  pctFontWeight: 400,
  pctFontStyle: 'normal',
  pctTextDecoration: 'none',
  pctHighlightColor: '#fde047',
  // Vertical connector defaults
  connectorColor: '#9ca3af',
  connectorThickness: 'thin',
};

export const DEFAULT_MILESTONE_STYLE: MilestoneStyle = {
  icon: 'diamond-filled',
  size: 20,
  color: '#f59e0b',
  position: 'above',
  // Title
  showTitle: true,
  fontSize: 13,
  fontColor: '#334155',
  labelPosition: 'right',
  fontFamily: 'Inter',
  fontWeight: 500,
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  // Date
  showDate: true,
  dateFontSize: 11,
  dateFontColor: '#64748b',
  dateFontFamily: 'Inter',
  dateFontWeight: 400,
  dateFontStyle: 'normal',
  dateTextDecoration: 'none',
  dateLabelPosition: 'right',
  dateTextAlign: 'left',
  dateFormat: 'MM/dd/yyyy',
  // Connector
  showConnector: false,
  connectorColor: '#9ca3af',
  connectorThickness: 'thin',
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
