# Project Timeline — Session State Document

> **Last updated**: March 21, 2026 (session 18 — TierSettingsModal preview end cap fix)
> **Purpose**: Recovery document so a fresh AI session can pick up exactly where we left off.

---

## Project Overview

**Project**: A **Project Visualization App** with three "command centers":
1. **Data View** — Spreadsheet-style editor for project items
2. **Timeline View** — Drag-and-drop Gantt canvas
3. **Style Pane** — Designer side panel (opens when an item is selected in Timeline view)

**Location**: `/Users/aleqian/Documents/MyProjects/project-timeline`

### Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS v4 (CSS-first config, no tailwind.config.js)
- Zustand for state management
- date-fns for date manipulation
- lucide-react for icons
- uuid for ID generation
- html-to-image for PNG export
- pptxgenjs for native PowerPoint export

### Path Aliases
- `@/` → `./src/`

### Design Principles
- **Light theme only** (dark theme was removed)
- Default font color: `#334155` (dark slate)
- Clean, professional, spacious design — no clutter
- No emojis in code or UI
- No "Add note" feature
- **Date format**: `MM/dd/yyyy`
- User is particular about minimal changes — do exactly what's asked

### Git
- Repo initialized on `main` branch
- Git identity: `aleqian` / `aleqian@users.noreply.github.com`

---

## Architecture

### File Structure
```
src/
├── App.tsx                              # Root layout: banner (Save+Undo/Redo left, project name center) + toolbar (Projects/Export/Settings) + main content, ExportButton component with PNG/PPTX dropdown, Cmd+Z/Cmd+Shift+Z/Cmd+S keyboard shortcuts
├── index.css                            # CSS variables (light-only), Tailwind directives
├── main.tsx                             # Entry point
├── types/
│   └── index.ts                         # All TypeScript types, interfaces, constants (projectId, lastModified, isDirty, canUndo, canRedo on ProjectState)
├── store/
│   └── useProjectStore.ts               # Zustand store — all state + actions, wrapped set() for auto-dirty tracking, save/load/new project actions, addItem/addSwimlane return string, undo/redo stacks (module-level), takeSnapshot/applySnapshot, isUndoRedoing guard
├── utils/
│   ├── index.ts                         # Utility functions: timescale generation, buildVisibleTierCells, resolveAutoUnit, critical path, project range
│   ├── storage.ts                       # localStorage save/load/delete/list utilities, ProjectIndexEntry type
│   └── exportPptx.ts                    # Native PPTX export utility — computeLayout, drawTimescale, drawGridLines, drawSwimlanes, drawTaskBar, drawMilestone, drawDependencies, exportNativePptx
├── components/
│   ├── DataView/
│   │   ├── DataView.tsx                 # Spreadsheet editor with swimlane groups, focusItemId + focusSwimlaneId auto-focus
│   │   └── TypePicker.tsx               # Type column cell + popover (shape/color picker)
│   ├── TimelineView/
│   │   └── TimelineView.tsx             # Gantt canvas with drag-and-drop (useRef + window events), dependency lines, timescale header, card container, auto-fit zoom, forwardRef + useImperativeHandle for export, drag guide (ghost bar + dashed outline + vertical guidelines + date tooltip, all inline styles)
│   ├── StylePane/
│   │   └── StylePane.tsx                # Per-item style editor + TierSettingsModal, 3 tabs (Items/Timescale/Design)
│   └── common/
│       ├── ProjectManagerModal.tsx       # Modal listing saved projects with New/Open/Delete
│       ├── MilestoneIconComponent.tsx   # Renders milestone icons using Lucide
│       ├── AdvancedColorPicker.tsx      # Full Office-style color picker: theme colors (10 columns x 6 shades), standard colors, recent colors (module-level persistence)
│       ├── ShapeDropdown.tsx            # Trigger showing current shape + 6-col icon grid dropdown; exports ShapePreview
│       ├── SizeControl.tsx              # S/M/L toggle buttons + numeric stepper with +/- 
│       ├── SpacingControl.tsx           # Tight/Normal/Wide toggle with inline SVG line-spacing icons
│       ├── FontDropdowns.tsx            # FontFamilyDropdown + FontSizeDropdown (reusable)
│       ├── DateFormatDropdown.tsx       # 11 date-fns formats with sample date preview
│       └── DurationFormatDropdown.tsx   # Cascading dropdown with 5 categories + hover submenus
```

### Key Types (`src/types/index.ts`)

```typescript
type ItemType = 'task' | 'milestone';
type ActiveView = 'data' | 'timeline';
type StylePaneSection = 'bar' | 'title' | 'date' | 'duration' | 'percentComplete' | 'verticalConnector'
  | 'milestoneShape' | 'milestoneTitle' | 'milestoneDate' | 'milestoneConnector'
  | 'swimlaneTitle' | 'swimlaneBackground' | 'swimlaneSpacing'
  | 'scale' | 'todayMarker' | 'elapsedTime' | 'leftEndCap' | 'rightEndCap';

type BarShape = 'rounded' | 'square' | 'flat' | 'capsule' | 'chevron' | 'double-chevron'
  | 'arrow-right' | 'pointed' | 'notched' | 'tab' | 'arrow-both' | 'trapezoid'; // 12 variants

type MilestoneIcon = 'diamond' | 'diamond-filled' | 'triangle' | 'triangle-filled'
  | 'flag' | 'flag-filled' | 'star' | 'star-filled' | 'circle' | 'circle-filled'
  | 'square-ms' | 'square-ms-filled' | 'check' | 'arrow-up' | 'arrow-right' | 'hexagon'
  | 'arrow-down' | 'star-6pt' | 'plus' | 'circle-half' | 'pentagon' | 'heart'
  | 'chevron-right' | 'triangle-down'; // 24 variants

type LabelPosition = 'far-left' | 'left' | 'center' | 'right' | 'above' | 'below';
type TextAlign = 'left' | 'center' | 'right';

type DateFormat = 'MMM d' | "MMM d ''yy" | 'MMM d, yyyy' | 'MMM yyyy' | 'MMMM d, yyyy'
  | 'MMMM dd, yyyy' | 'MM/dd/yyyy' | 'EEE M/d' | "EEE M/d/yy" | 'EEE MMM d' | "EEE MMM d, ''yy"; // 11 formats

type DurationFormat = 'd' | 'days' | 'w' | 'wks' | 'weeks' | 'mons' | 'months'
  | 'q' | 'qrts' | 'quarters' | 'y' | 'yrs' | 'years'; // 13 formats in 5 categories

type ConnectorThickness = 'thin' | 'medium' | 'thick'; // maps to 1px, 2px, 3px
type OutlineThickness = 'none' | 'thin' | 'medium' | 'thick'; // maps to 0, 1, 2, 3px

interface Swimlane {
  id: string; name: string; color: string; order: number; collapsed: boolean;
  // Title styling
  titleFontSize: number; titleFontColor: string; titleFontFamily: string;
  titleFontWeight: number; titleFontStyle: 'normal' | 'italic';
  titleTextDecoration: 'none' | 'underline';
  // Background: Header
  headerColor: string; headerTransparency: number; // 0-100
  // Background: Body
  bodyColor: string; bodyTransparency: number; // 0-100
  // Background: Outline
  outlineThickness: OutlineThickness; outlineColor: string;
}

interface TaskStyle {
  // Bar properties
  barShape: BarShape; color: string; thickness: number; spacing: number;
  // Show/hide toggles (persisted per-item, not local state)
  showTitle: boolean;       // default true
  showDate: boolean;        // default false
  showDuration: boolean;    // default false
  showPercentComplete: boolean; // default false
  showVerticalConnector: boolean; // default false
  // Title label styling
  labelPosition: LabelPosition; fontSize: number; fontColor: string;
  fontFamily: string; fontWeight: number;
  fontStyle: 'normal' | 'italic'; textDecoration: 'none' | 'underline';
  textAlign: TextAlign;
  // Date label styling
  dateFormat: DateFormat; dateLabelPosition: LabelPosition;
  dateFontSize: number; dateFontColor: string; dateFontFamily: string;
  dateFontWeight: number; dateFontStyle: 'normal' | 'italic';
  dateTextDecoration: 'none' | 'underline'; dateTextAlign: TextAlign;
  // Duration label styling
  durationFormat: DurationFormat; durationLabelPosition: LabelPosition;
  durationFontSize: number; durationFontColor: string; durationFontFamily: string;
  durationFontWeight: number; durationFontStyle: 'normal' | 'italic';
  durationTextDecoration: 'none' | 'underline'; durationTextAlign: TextAlign;
  // Percent complete label styling
  pctLabelPosition: LabelPosition; pctFontSize: number; pctFontColor: string;
  pctFontFamily: string; pctFontWeight: number;
  pctFontStyle: 'normal' | 'italic'; pctTextDecoration: 'none' | 'underline';
  pctHighlightColor: string;    // highlight fill color when position=center
  // Vertical connector styling
  connectorColor: string;       // default '#9ca3af'
  connectorThickness: ConnectorThickness; // 'thin' | 'medium' | 'thick'
}

interface MilestoneStyle {
  icon: MilestoneIcon; size: number; color: string;
  position: 'above' | 'below';  // milestone shape position (only for independent items)
  fontSize: number; fontColor: string; labelPosition: LabelPosition;
  fontFamily: string; fontWeight: number;
  fontStyle: 'normal' | 'italic'; textDecoration: 'none' | 'underline';
  // Date label styling
  showDate: boolean; dateFormat: DateFormat; dateLabelPosition: LabelPosition;
  dateFontSize: number; dateFontColor: string; dateFontFamily: string;
  dateFontWeight: number; dateFontStyle: 'normal' | 'italic';
  dateTextDecoration: 'none' | 'underline';
  // Title
  showTitle: boolean;
  // Connector
  showConnector: boolean; connectorColor: string;
  connectorThickness: ConnectorThickness;
}

interface ProjectItem {
  id: string; name: string; type: ItemType;
  startDate: string; endDate: string;           // ISO date strings
  percentComplete: number; statusId: string | null;
  assignedTo: string;                            // person name, '' if unassigned
  visible: boolean; swimlaneId: string | null;   // null = independent (no swimlane)
  row: number;
  taskStyle: TaskStyle; milestoneStyle: MilestoneStyle;
  dependsOn: string[]; isCriticalPath: boolean;
}

interface StatusLabel { id: string; label: string; color: string; }
interface ColumnVisibility { percentComplete: boolean; assignedTo: boolean; status: boolean; }

interface ProjectState {
  projectName: string; timelineTitle: string;
  items: ProjectItem[]; swimlanes: Swimlane[];
  dependencies: Dependency[]; statusLabels: StatusLabel[];
  columnVisibility: ColumnVisibility;
  checkedItemIds: string[];   // multi-select tracking
  timescale: TimescaleConfig;
  swimlaneSpacing: number;    // global, 0-40, default 5
  activeView: ActiveView;
  selectedItemId: string | null;
  selectedSwimlaneId: string | null;  // mutual exclusion with selectedItemId
  stylePaneSection: StylePaneSection | null; // which section expanded in StylePane
  showCriticalPath: boolean; zoom: number;
}

// ─── Timescale Types ───────────────────────────────────────────────────────
type TimescaleTier = 'auto' | 'year' | 'quarter' | 'month' | 'week' | 'day';

type YearFormat = 'yyyy' | 'yy';                                           // 2020 | 20
type QuarterFormat = 'Qq yyyy' | 'Qq';                                     // Q1 2020 | Q1
type MonthFormat = 'MMM' | 'MMMM' | 'M_letter' | 'MM' | 'M_num';         // Jul | July | J | 07 | 7
type WeekFormat = 'w_num' | 'Ww';                                          // 1 | Week 1
type DayFormat = 'd_num' | 'EEE' | 'EEEE' | 'dd' | 'MM/dd';              // 1 | Mon | Monday | 01 | 03/20
type TierFormat = YearFormat | QuarterFormat | MonthFormat | WeekFormat | DayFormat;

interface TimescaleTierConfig {
  unit: TimescaleTier;
  format: TierFormat;
  visible: boolean;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;                   // 400 | 700
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  separators: boolean;
}

interface TimescaleConfig {
  tiers: TimescaleTierConfig[];
  fiscalYearStartMonth: number; // 1-12
  showToday: boolean;
  todayColor: string;
}
```

### Store Actions (`src/store/useProjectStore.ts`)
- **Global**: `setActiveView`, `setSelectedItem`, `setSelectedSwimlane`, `setStylePaneSection`, `setZoom`, `setProjectName`, `setTimelineTitle`
- **Items**: `addItem` (returns string ID), `addItemRelative`, `duplicateItem`, `updateItem`, `deleteItem`, `toggleVisibility`, `toggleItemType`, `moveItem`, `resizeItem`, `setItemRow`, `reorderItem`, `moveItemToSwimlane`, `moveItemToGroup`
- **Swimlanes**: `addSwimlane` (returns string ID), `addSwimlaneRelative`, `duplicateSwimlane`, `hideSwimlaneItems`, `updateSwimlane`, `applySwimlaneStyleToAll`, `deleteSwimlane`, `reorderSwimlane`, `setSwimlaneSpacing`
- **Dependencies**: `addDependency`, `removeDependency`
- **Styles**: `updateTaskStyle`, `updateMilestoneStyle`, `applyStyleToAll`, `applyPartialStyleToAll`, `applyTaskBarStyleToAll`
- **Status**: `addStatusLabel`, `updateStatusLabel`, `removeStatusLabel`
- **Timescale**: `updateTimescale`, `updateTier`, `addTier`, `removeTier`
- **Critical path**: `toggleCriticalPath`, `recalcCriticalPath` (UI toggle removed, logic kept dormant)
- **Columns**: `toggleColumn`
- **Multi-select**: `toggleCheckedItem`, `checkAllItems`, `uncheckAllItems`, `setCheckedItems`
- **Bulk ops**: `duplicateCheckedItems`, `hideCheckedItems`, `deleteCheckedItems`, `setColorForCheckedItems`
- **Project management**: `saveProject`, `loadProject`, `newProject`

### Initial State
- **App starts empty** — no sample data loaded
- `createSampleData()` exists in store but is unused (dead code, kept for reference)
- **Project Manager modal** shown on initial load (`showProjectManager: true`)
- **Default view**: Data (not Timeline)
- Default zoom: 8, default timescale: single tier month (#334155) via `getDefaultTimescale()`

---

## App Layout

### Row 1 (top banner)
- Colored bar: `#4f46e5` (indigo-600)
- Left: Save icon (floppy disk) + divider + Undo/Redo icons (grey out when stack empty)
- Center: Project name + status ("Unsaved changes" / "Saved")
- Right: empty spacer

### Row 2 (toolbar)
- Left: view-specific add buttons (+ Task, + Milestone always enabled)
- Center: `Data` / `Timeline` tabs
- Right: `Projects` button (FolderOpen icon) + `Export` dropdown (PNG/PPTX, disabled when not on Timeline) + gear icon

### Main content
- Data View or Timeline View fills remaining space
- StylePane always visible in Timeline view (340px right panel)
- Empty state: "Select tasks to style them" when no item selected

### StylePane Structure
- **Tabs**: `Items`, `Timescale`, and `Design`
- Items tab has **3 sub-icons** (task, milestone, swimlane) at top
- **Design tab** (`DesignTabContent`): Task Layout radio options (single-row, compact, one-per-row)
- **Auto-switch**: `useEffect` watches `stylePaneSection` — switches to timescale tab for timescale sections, items tab for item sections. Clicking items on timeline switches to Items tab, clicking tier rows switches to Timescale tab.
- Task sub-tab has **6 collapsible sections** (accordion-style, one at a time, driven by `stylePaneSection` in Zustand):

| # | Section | Collapse Arrow | Toggle | Default | Status |
|---|---------|---------------|--------|---------|--------|
| 1 | Task bar | Yes | No | — | COMPLETED |
| 2 | Task title | Yes | Yes (green) | ON | COMPLETED |
| 3 | Task date | Yes | Yes | OFF | COMPLETED |
| 4 | Task duration | Yes | Yes | OFF | COMPLETED |
| 5 | Task % complete | Yes | Yes | OFF | COMPLETED |
| 6 | Vertical connector | Yes | Yes | OFF | COMPLETED |

- Timescale tab (`TimescaleTabContent`) has:

| # | Section | Type | Toggle | Status |
|---|---------|------|--------|--------|
| — | Tier settings button | Button → opens TierSettingsModal | — | COMPLETED (modal + preview) |
| 1 | Scale | CollapsibleRow | No | COMPLETED (wired to store) |
| 2 | Today marker | CollapsibleRow | Yes (`showToday`) | COMPLETED (color, position, auto-adjust) |
| 3 | Elapsed time | CollapsibleRow | Yes (`showElapsedTime`) | COMPLETED (color, thickness, position synced) |
| 4 | Left end cap | CollapsibleRow | Yes (`leftEndCap.show`) | COMPLETED (color, font, B/I/U) |
| 5 | Right end cap | CollapsibleRow | Yes (`rightEndCap.show`) | COMPLETED (color, font, B/I/U) |

---

## Section Details

### Task Bar (COMPLETED)
- Row 1: Color (AdvancedColorPicker) + Shape (ShapeDropdown)
- Row 2: Size (S/M/L toggle + numeric stepper via SizeControl)
- Row 3: Spacing (Tight/Normal/Wide toggle via SpacingControl)
- Row 4: Apply to all tasks (boxed: `border border-[var(--color-border)] rounded-lg p-3`)

### Task Title (COMPLETED)
- Row 1: Color (fontColor AdvancedColorPicker) + Text (FontFamilyDropdown + FontSizeDropdown)
- Row 2: B / I / U toggles + separator + alignment buttons (left/center/right SVG icons)
  - **Alignment buttons only shown when position is center, above, or below**
- Row 3: Position — 6 position icons (far-left, left, center, right, above, below) using PositionIcon component
- Row 4: Apply to all tasks (boxed, with Alignment property card)

### Task Date (COMPLETED)
- Row 1: Color (dateFontColor) + Text (date-specific FontFamily + FontSize)
- Row 2: B / I / U + separator + alignment buttons (conditional on position = center/above/below)
- Row 3: Format — DateFormatDropdown with 11 formats + sample preview
- Row 4: Position — 6 position icons (uses LABEL_POSITIONS)
- Row 5: Apply to all tasks (boxed)

### Task Duration (COMPLETED)
- Row 1: Color (durationFontColor) + Text (duration-specific FontFamily + FontSize)
- Row 2: B / I / U + separator + alignment buttons (conditional on position = center/above/below)
- Row 3: Format — DurationFormatDropdown (cascading submenu with 5 categories)
- Row 4: Position — **5 icons only (no Far Left)**, uses `SECONDARY_LABEL_POSITIONS`
- Row 5: Apply to all tasks (boxed, TaskDurationApplyToAll component)

### DurationFormatDropdown Categories
| Category | Formats |
|----------|---------|
| Days | `d`, `days` |
| Weeks | `w`, `wks`, `weeks` |
| Months | `mons`, `months` |
| Quarters | `q`, `qrts`, `quarters` |
| Years | `y`, `yrs`, `years` |

### Task % Complete (COMPLETED)
- Row 1: Color (pctFontColor AdvancedColorPicker) + Text (pct-specific FontFamily + FontSize)
- Row 2: B / I / U toggles (no alignment buttons — % complete has no alignment)
- Row 3: Position — **5 icons only (no Far Left)**, uses `SECONDARY_LABEL_POSITIONS`
- Row 4: Highlight color (pctHighlightColor AdvancedColorPicker) — highlight fill when position=center
- Row 5: Apply to all tasks (boxed, PctCompleteApplyToAll component)
- **Center position**: label placed at `left: {pct}%` with `transform: translate(-50%, -50%)` (at the actual percent point along bar)
- **Highlight fill**: when showPercentComplete is ON and position is center, progress fill uses pctHighlightColor instead of bar's main color

### Vertical Connector (COMPLETED)
- Row 1: Color (connectorColor AdvancedColorPicker) + Thickness (ConnectorThicknessDropdown: Thin/Medium/Thick select)
- Row 2: Apply to all tasks (boxed, ConnectorApplyToAll component)
- **TimelineView rendering**: Two dashed vertical lines per task — one at left edge (start date), one at right edge (end date)
- Lines extend from top of canvas (y=0, bottom of sticky timescale header) down to the top of the task bar
- No circles at endpoints — plain dashed lines (`strokeDasharray="4 3"`)
- Thickness mapping: thin=1px, medium=2px, thick=3px
- Only rendered when `showVerticalConnector` is true
- Rendered as SVG `<line>` elements in the dependency SVG layer, behind dependency paths

---

## Position vs Alignment (Justification)

**Position** controls *where* the label appears relative to the bar:
- `far-left`, `left`, `right` — side positions (label outside bar)
- `center` — label inside the bar
- `above`, `below` — label above/below bar

**Alignment** (textAlign) controls *how text is justified* within the label container:
- Only applies to `center`, `above`, and `below` positions
- Side positions (far-left, left, right) don't show alignment buttons — text flows naturally
- Alignment buttons conditionally hidden/shown based on current position setting

---

## TimelineView Label Rendering

Four label types rendered for tasks, each conditional on its show toggle:

1. **Title label** (`style.showTitle`) — displays `item.name` + optional % badge
2. **Date label** (`style.showDate`) — displays `"start - end"` formatted per `dateFormat`
3. **Duration label** (`style.showDuration`) — displays computed duration via `formatDuration()` helper
4. **% Complete label** (`style.showPercentComplete`) — displays `"X%"` at the configured position

### Duration Computation
- Duration is **inclusive** (same day = 1 day): `differenceInDays(end, start) + 1`
- Weeks = days/7, Months = days/30.44, Quarters = days/91.31, Years = days/365.25
- Fractional values shown with 1 decimal, trailing `.0` stripped
- Duration is computed (not stored) — derived from `startDate` and `endDate`

### Label Positioning Logic
For `center` position: `left: 0, right: 0, maxWidth: 'none', paddingLeft: 4, paddingRight: 4` + user's `textAlign`
For `above`/`below`: `left: 0` with stacking margins to avoid overlapping other labels in the same position
For side positions: positioned outside the bar with appropriate margins

### Label Stacking (above/below)
When multiple labels share the same vertical position (above or below), they stack with 16px offsets:
- Date checks if title is also above/below
- Duration checks if both title and date are above/below
- % Complete checks if title, date, and duration are above/below

---

## Shared Components (`src/components/common/`)

| Component | File | Description |
|-----------|------|-------------|
| AdvancedColorPicker | AdvancedColorPicker.tsx | Full Office-style picker: theme colors (10 columns x 6 shades), standard colors, recent colors (module-level persistence) |
| ShapeDropdown | ShapeDropdown.tsx | Trigger showing current shape + 6-col icon grid dropdown; exports `ShapePreview` |
| SizeControl | SizeControl.tsx | S/M/L toggle buttons + numeric stepper with +/- |
| SpacingControl | SpacingControl.tsx | Tight/Normal/Wide toggle with inline SVG line-spacing icons |
| FontDropdowns | FontDropdowns.tsx | `FontFamilyDropdown` (shows font name in its own font) + `FontSizeDropdown` (numeric) |
| DateFormatDropdown | DateFormatDropdown.tsx | 11 date-fns format options with live sample date preview |
| DurationFormatDropdown | DurationFormatDropdown.tsx | Cascading dropdown: 5 category rows with hover submenus |
| MilestoneIconComponent | MilestoneIconComponent.tsx | Renders 16 milestone icon variants using Lucide icons |

---

## PositionIcon SVGs (redesigned)
- 28x20 viewBox, `shapeRendering="crispEdges"`, serif "T" at 9-11px, sharp lines
- All 6 positions: far-left (arrow+dashes+separator+bar), left (T+separator+bar), center (lines above/below bar), right (bar+separator+T), above (T above line+bar), below (bar+line+T below)

---

## "Apply to All Tasks" Pattern
All sections use a **boxed style**: `border border-[var(--color-border)] rounded-lg p-3` (NOT a horizontal `border-t` divider).
Contains:
- Collapsible header with Paintbrush icon + "Apply to all tasks" text + chevron
- Property cards grid (2 columns) with checkboxes per property
- "Exclude swimlanes" checkbox option
- Apply button with success state (green check + "Applied!" for 1.2s)

`applyPartialStyleToAll` works generically — copies any named keys from source item's `taskStyle` to all other tasks.

---

## What Has Been Completed

### Phase 1 — Core Build (session 1)
- Full project scaffold with all types, Zustand store, sample data
- Data View, Timeline View, Style Pane, Toolbar — all functional
- Dependencies & critical path computation
- Fiscal year config, zoom controls

### Phase 2 — Cleanup + Data View Redesign (session 1)
- Dark theme removal
- Auto-fit text removal
- StatusLabel type, statusId on ProjectItem
- DataView complete rewrite (all columns, inline editing, smart date/duration editing)
- Toolbar removed, functionality moved to App.tsx sub-headers
- TypePicker with shape/color popover

### Phase 3 — Data View Visual Cleanup (session 2)
- Full DataView visual polish (14 requirements)
- AssignedTo field added
- Row separators, compact rows, hover-only actions

### Phase 4 — Multi-select, Row Actions, Polish (session 3)
- Multi-select checkboxes + bulk actions (copy, hide, delete, color)
- Selection toolbar replacing header when items checked
- Row more-menu (add above/below, duplicate, hide, delete)
- Smart date/duration editing
- Dynamic column visibility

### Phase 5 — App Layout + StylePane Rewrite (session 4)
- App.tsx rewrite: banner (#4f46e5) + toolbar + content
- StylePane rewrite: Items/Timescale tabs, 3 sub-icons (task/milestone/swimlane)
- 6 CollapsibleRow sections with Toggle switches
- Swimlane + item drag-and-drop in DataView
- TimelineView: centered graph title, swimlane bands

### Phase 6 — Shared Components + StylePane Sections (sessions 4-5)
- AdvancedColorPicker (Office-style with theme/standard/recent)
- ShapeDropdown (clean trigger + 6-col icon grid)
- SizeControl, SpacingControl, FontDropdowns (all reusable)
- Task bar section fully wired (Color+Shape, Size, Spacing, Apply to all)
- Task title section fully wired (Color+Text, B/I/U+alignment, Position, Apply to all)
- fontStyle + textDecoration added to TaskStyle and MilestoneStyle
- PositionIcon SVGs redesigned (28x20, crispEdges, serif T)
- TimelineView label positioning: all 6 LabelPosition values for TaskBar and MilestoneItem
- fontStyle + textDecoration applied in TimelineView label rendering

### Phase 7 — Date + Duration Sections (session 5)
- DateFormatDropdown created (11 date-fns formats with sample preview)
- Task date section fully wired (Color+Text, B/I/U+alignment, Format, Position, Apply to all)
- Show/hide toggles moved from local state to TaskStyle (showTitle, showDate, showDuration, showPercentComplete, showVerticalConnector)
- TextAlign type added; alignment buttons in all 3 completed sections
- dateTextAlign, textAlign (title) added to TaskStyle
- TimelineView title label conditional on showTitle
- TimelineView date label renders when showDate is true
- "Apply to all tasks" changed to boxed style (border rounded-lg p-3) across all sections
- DurationFormat type + all duration fields added to TaskStyle
- DurationFormatDropdown created (cascading with 5 categories + hover submenus)
- SECONDARY_LABEL_POSITIONS constant (5 positions, no Far Left)
- Task duration section fully wired (all 5 rows)
- TaskDurationApplyToAll component added
- formatDuration helper in TimelineView (inclusive day count, unit conversion)
- Duration label div added to TaskBar JSX in TimelineView
- **Alignment/justification fix**: center position no longer forces textAlign: 'center'; uses user's textAlign setting instead
- **Alignment buttons conditionally shown**: only for center/above/below positions (not side positions)
- textAlign added to TaskStyle type + defaults + TaskTitleApplyToAll property cards

### Phase 8 — % Complete + Vertical Connector (session 6)
- Percent complete fields added to TaskStyle: pctLabelPosition, pctFontSize, pctFontColor, pctFontFamily, pctFontWeight, pctFontStyle, pctTextDecoration, pctHighlightColor
- Task % Complete StylePane section: Color+Text, B/I/U (no alignment), Position (5 icons), Highlight color, Apply to all
- % Complete label rendering in TimelineView with center position at actual percent point
- % Complete highlight fill: progress bar uses pctHighlightColor when position=center
- Vertical connector fields added to TaskStyle: connectorColor, connectorThickness (ConnectorThickness type)
- Vertical Connector StylePane section: Color+Thickness, Apply to all
- ConnectorThicknessDropdown component (simple select: Thin/Medium/Thick)
- Vertical connector rendering in TimelineView: two dashed SVG lines per task (start edge + end edge), extending from canvas top to bar top
- Clicking labels on timeline opens correct StylePane section via `onClickSection` callback
- CollapsibleRow disabled state: toggled-off sections show content at opacity 0.4 with pointer-events none

### Phase 9 — Milestone Sections + Independent Items + Cross-Group Drag (session 7)
- **Apply to All popover**: Portal-based `ApplyToAllBox` wrapper (escapes sidebar overflow clipping via `createPortal`)
- **PropertyCard**: Vertical card layout (label top, icon center, checkbox bottom, `flex-1` sizing)
- **Context-dependent empty state**: "Select {tasks|milestones|swimlanes} to style them"
- **Sub-tab auto-switch**: `useEffect` resets `forcedSubTab` to `null` on `selectedItemId` change
- **Milestone collapsible sections**: 4 sections with hooks (milestoneShape, milestoneTitle, milestoneDate, milestoneConnector)
- **Milestone Shape section** (fully implemented):
  - Color (AdvancedColorPicker), Shape (MilestoneShapeDropdown — absolute positioning, w-[252px], 24 icons in 6-col grid)
  - Size (S=14, M=20, L=28 presets via MILESTONE_SIZE_PRESETS)
  - Position (above/below — only available when milestone is independent, i.e. swimlaneId === null)
  - Apply to all milestones (ApplyToAllBox with label="Apply to all milestones", cards: Color, Shape, Size, Position)
- **MilestoneIcon expanded**: 8 new icons (arrow-down, star-6pt, plus, circle-half, pentagon, heart, chevron-right, triangle-down)
- **Custom SVG components**: Star6pt, CircleHalf, TriangleDown added to MilestoneIconComponent.tsx
- **MilestoneStyle expanded**: position ('above'|'below'), showTitle, showDate, showConnector, date/connector styling fields
- **Milestone click auto-expand**: clicking milestone icon on timeline opens milestoneShape section, label click opens milestoneTitle
- **Independent items**: Tasks/milestones can exist without swimlane (swimlaneId === null)
  - `addItem` accepts optional `swimlaneId` (defaults to null)
  - IndependentItemsGroup renders above swimlane groups in DataView
  - Toolbar "Add Task"/"Add Milestone" creates independent items
  - Swimlane deletion shows `window.confirm` with item count warning
- **Cross-group item drag-and-drop**: Global drag state lifted from per-group to DataView level
  - `moveItemToGroup` store action: changes swimlaneId + reorders atomically
  - Items can be dragged between swimlanes and the independent section
  - Swimlane headers act as drop zones (drop onto header = insert at position 0)
  - Empty independent section shows "Drop here to remove from swimlane" zone during drag

### Phase 10 — Milestone Title/Date + Swimlane Sections (sessions 7-8)
- **Milestone Title section** (fully implemented):
  - Color (fontColor AdvancedColorPicker) + Text (FontFamilyDropdown + FontSizeDropdown)
  - B / I / U toggles
  - Position (4-option picker: above/below/left/right using MilestonePositionIcon) — only for swimlaned milestones
  - Apply to all milestones (Color, Text cards)
- **Milestone Date section** (fully implemented):
  - Color (dateFontColor) + Text (date-specific FontFamily + FontSize)
  - B / I / U toggles
  - Format (DateFormatDropdown)
  - Position (4-option picker: above/below/left/right) — only for swimlaned milestones
  - Apply to all milestones (Show, Color, Text, Format cards)
- **Independent milestone vertical stack layout**: title/date/shape stack based on position above/below
- **Swimlaned milestone same-side stacking**: title+date stack in container when on same side relative to shape
- **Default dateFontColor**: changed to `#334155`
- **Position controls**: only shown when `item.swimlaneId !== null` (swimlaned milestones)
- **Swimlane selection**: `selectedSwimlaneId` in store, mutual exclusion with `selectedItemId`
  - `setSelectedSwimlane` clears `selectedItemId`, sets `stylePaneSection: 'swimlaneTitle'`
  - Click swimlane badge in TimelineView to select
  - Auto-switch to swimlane sub-tab
- **Swimlane section layout**: 3 collapsible rows (title, background, spacing)
- **Swimlane Title section** (fully implemented):
  - Color (titleFontColor AdvancedColorPicker) + Text (FontFamilyDropdown + FontSizeDropdown)
  - B / I / U toggles
  - Apply to all swimlanes (Color, Text cards)
  - Title styles wired to badge rendering in TimelineView
- **Swimlane Background section** (fully implemented):
  - Swimlane type extended: `headerColor`, `headerTransparency`, `bodyColor`, `bodyTransparency`, `outlineThickness` (OutlineThickness type), `outlineColor`
  - DEFAULT_SWIMLANE_STYLE updated with background defaults
  - Header sub-group: Color picker + Transparency slider (0-100%)
  - Body sub-group: Color picker + Transparency slider (0-100%)
  - Outline sub-group: Thickness dropdown (None/Thin/Medium/Thick) + conditional Color picker (hidden when "None")
  - Apply to all swimlanes (Header, Body, Outline cards)
  - TimelineView wired: badge uses headerColor+headerTransparency (separate bg layer so text stays crisp), body band uses bodyColor+bodyTransparency, outline border wraps entire band
  - `addSwimlane`/`addSwimlaneRelative` set `headerColor` from chosen color
  - `duplicateSwimlane` copies all style properties from source
- **OutlineThicknessDropdown**: select with None/Thin/Medium/Thick options
- **OUTLINE_THICKNESS_MAP**: `{ none: 0, thin: 1, medium: 2, thick: 3 }`

### Phase 11 — Timescale Tab + Tier Settings Modal (session 9)
- **Timescale tab layout** (`TimescaleTabContent`):
  - Tier settings button → opens `TierSettingsModal`
  - Scale section (CollapsibleRow, placeholder — local state only)
  - Today marker (CollapsibleRow with toggle wired to `timescale.showToday`)
  - Elapsed time, Left end cap, Right end cap (CollapsibleRow placeholders)
- **Tier Settings Modal** (fully implemented):
  - Full-screen overlay portal, max-width 1100px
  - **Preview bar** at top with left/right end cap years, visible tier rows, today marker
  - **3 columns** (Top/Middle/Bottom tier), each with: Show toggle, Units (type + format dropdowns), Separators checkbox, Color + Text (font family/size), B/I/U + alignment, Bar color
  - Local draft state (3-tier array padded from store), Save writes to store, Cancel discards
  - `DEFAULT_3_TIERS` fallbacks for missing tiers
- **Timescale types extended**:
  - `TimescaleTier` now includes `'auto'`
  - `TierFormat` union type with per-unit format variants (YearFormat, QuarterFormat, MonthFormat, WeekFormat, DayFormat)
  - `TimescaleTierConfig` has full styling: unit, format, visible, backgroundColor, fontColor, fontSize, fontFamily, fontWeight, fontStyle, textDecoration, textAlign, separators
- **Shared `buildVisibleTierCells()` utility** (`src/utils/index.ts`):
  - Used by both TimelineView and TierSettingsModal preview
  - Takes raw labels, unit type, origin date, total days, bar width in pixels
  - Computes skip factor from full interior cell (index 1) with min widths per unit
  - Returns `TierCell[]` with `{ label, fraction, widthFrac }` in fractional coordinates
  - Prefixes first visible label with "Week " or "Day " for sequential units
- **`resolveAutoUnit(totalDays)`**: <30d → day, 30-180 → week, 180-730 → month, 730-1825 → quarter, 1825+ → year
- **`generateTierLabels()`**: accepts optional 5th `fmt?: TierFormat` parameter; uses `formatTierLabel()` helper
- **`getFormatOptionsForUnit()`** and **`getDefaultFormatForUnit()`**: helpers for dropdown population
- **`getDefaultTimescale()`**: returns 1 tier (month #334155)
- **Padded date range** (shared by TimelineView and modal):
  - Start: `startOfMonth(subDays(projectStart, 14))`
  - End: `addMonths(padStart, numMonths)` where numMonths = `differenceInCalendarMonths(endMonth, padStart) + 1`
  - `rangeEndDate`: `subDays(padEnd, 1)` — prevents generating labels for month after
  - `totalDays`: `differenceInDays(padEnd, padStart)`
- **TimelineView timescale header**: uses `buildVisibleTierCells()`, renders tier rows with full styling (backgroundColor, fontColor, fontSize, fontFamily, fontWeight, fontStyle, textDecoration, separators as `border-l border-white/20`)
- **Today marker** in TimelineView: vertical line + "Today" badge, controlled by `timescale.showToday` and `timescale.todayColor`
- **All tier labels left-aligned** (separators mark beginning of period)
- **Auto unit option** in tier dropdowns (Auto, Days, Weeks, Months, Quarters, Years)

### Phase 12 — Scale Section + Today Marker + Elapsed Time + End Caps (sessions 10-11)
- **Scale section wired to store** (`selectedTierIndex` in Zustand):
  - Single-tier: Units, Format, Separators, Color+Text, B/I/U, alignment, Bar color + Bar Shape
  - Multi-tier: Same controls but Bar Shape hidden; info banner "Click a tier on the timeline to switch"
- **Tab auto-switch bug fix** (`6a117df`): `useEffect` in StylePane watches `stylePaneSection` and auto-switches `mainTab` to `'timescale'` when it's a timescale section
- **Today marker section** (fully implemented):
  - Color (AdvancedColorPicker wired to `timescale.todayColor`)
  - Position (above/below timescale icons + Auto-adjust button)
  - Auto-adjust snaps view to today, shows "Auto-adjusted" when clicked
  - Today label is bordered white box with colored triangle pointing toward timescale bar
  - Vertical red line through canvas **removed** (user requested)
- **Elapsed time section** (fully implemented):
  - Color (AdvancedColorPicker wired to `timescale.elapsedTimeColor`)
  - Thickness dropdown (Thin 3px / Thick 6px)
  - Position synced with today marker via shared `todayPosition` field
  - Renders as colored strip on timescale header edge, from left to todayX
- **End cap sections** — Left and Right (fully implemented):
  - Shared `EndCapSection` component with `side` prop
  - `EndCapConfig` type: show, fontColor, fontFamily, fontSize, fontWeight, fontStyle, textDecoration
  - Controls: Color picker, Font family + Font size, B/I/U toggles
  - Rendering: Year labels flanking the timescale bar (left = start year, right = end year)
  - TimelineView header restructured to flex row: `[left cap] [bar flex-1] [right cap]`
  - Defaults: show false, fontColor '#1e293b', fontFamily 'Arial', fontSize 16, fontWeight 700
- **Types added**: `TodayMarkerPosition`, `ElapsedTimeThickness`, `EndCapConfig`
- **`TimescaleConfig` expanded**: `todayPosition`, `todayAutoAdjusted`, `showElapsedTime`, `elapsedTimeColor`, `elapsedTimeThickness`, `leftEndCap`, `rightEndCap`
- **`getDefaultTimescale()`** updated with defaults for all new fields

### Phase 13 — Save/Load + UX Improvements (session 12)
- **Timeline canvas card container** (`554577d`): Wrapped timeline content in bordered card (white interior, light grey exterior, rounded corners, small margin)
- **Reduced StylePane width** (`52e4e76`): 320px to 280px for more canvas space
- **Save/load multiple projects** (`f70f23f`):
  - Full localStorage persistence with manual save
  - `storage.ts` utility: `saveProjectToStorage()`, `loadProjectFromStorage()`, `deleteProjectFromStorage()`, `listProjects()`
  - localStorage keys: `pt_projects_index` for project list, `pt_project_{id}` for each project's data
  - Store: `projectId`, `lastModified`, `isDirty` added to `ProjectState`; wrapped `set()` auto-marks `isDirty: true` via `DIRTY_KEYS` set
  - Saveable keys: `projectName`, `timelineTitle`, `items`, `swimlanes`, `dependencies`, `statusLabels`, `columnVisibility`, `timescale`, `zoom`, `swimlaneSpacing`, `showCriticalPath`
  - Transient UI state (NOT saved): `activeView`, `selectedItemId`, `selectedSwimlaneId`, `stylePaneSection`, `checkedItemIds`, `selectedTierIndex`, `isDirty`, `lastModified`
  - Save button and "Projects" button (FolderOpen icon) in toolbar
  - Banner shows "Unsaved changes" when dirty, "Saved" after save
- **ProjectManagerModal** (`1a93403`): Modal dialog with New/Open/Delete, shown on initial load
- **Default view to Data** (`5d132a0`): Initial load, new project, and load project all default to Data view; +Task/+Milestone always enabled (no swimlane required)
- **Empty initial state** (`f46441b`): App starts with blank project, no sample data loaded
- **Inline add simplified** (`31dec23`): "Add task or milestone" link in DataView directly adds a task on click (no dropdown)
- **Auto-focus name input** (`628231d`): After adding a new item (inline add, +Task, +Milestone), name input auto-focuses with text selected
  - `addItem` returns the new item's ID
  - `focusItemId` state in DataView, threaded through IndependentItemsGroup/SwimlaneGroup to ItemRow
  - ItemRow uses `nameRef` + `useEffect` to focus and select text, then clears `focusItemId`

### Phase 14 — UX Fixes + Apply to All Swimlane-Aware (session 13)
- **Auto-focus swimlane name** (`75f7fe9`): `focusSwimlaneId` state in DataView, `shouldFocusName` prop on SwimlaneGroup triggers `editingName` state + `onFocus` selects text. `addSwimlane` now returns the new ID.
- **Default timescale to single tier months** (`751a921`): `getDefaultTimescale()` changed from 2 tiers (year+month) to 1 tier (month only).
- **Removed timeline title row** (`afc6b33`): Removed the "New Project" heading + Pencil edit from TimelineView. Cleaned up unused imports.
- **Auto-fit zoom on mount** (`d4b3eaa` + `e8b2d36`): `useEffect` in TimelineView measures container width and sets `zoom = Math.floor(containerWidth / totalDays)` clamped 2-30. Fixed missing `useEffect` import. Runs only on mount (`[]` deps).
- **Apply to All: swimlane-aware for tasks** (`5320649`): All 6 task Apply components (TaskBarApplyToAll, TaskTitleApplyToAll, TaskDateApplyToAll, TaskDurationApplyToAll, TaskPctApplyToAll, ConnectorApplyToAll) now show "Only this swimlane" checkbox when the item is in a swimlane, and "Exclude swimlanes" when the item is independent. Matches existing milestone Apply to All pattern.

### Phase 15 — Design Tab + Timeline Content Centering + Auto-fit Zoom Fix (session 14)
- **Design tab in StylePane**: Third tab added after Items and Timescale. Contains `DesignTabContent` with Task Layout radio options:
  - **Single row**: Tasks stay on their assigned row (`item.row`)
  - **Compact (packed)**: Tasks packed to minimize vertical space (no overlapping bars)
  - **One per row**: Each task gets its own row
- **`taskLayout`** state added to store (`TaskLayout` type: `'single-row' | 'packed' | 'one-per-row'`)
- **`getRow` function** in TimelineView: `useMemo` that returns a function `(item: ProjectItem) => number`. For `single-row`, returns `item.row`. For `packed`/`one-per-row`, builds `rowMap` per group (independent + each swimlane). Swimlane band heights dynamically grow based on `maxRow`.
- **Timeline content centering** (`margin: '0 auto'` on content div): Timeline content centered horizontally within the white canvas card.
- **Content div uses `width: totalWidth`** (not `minWidth`): Prevents background from extending past last timescale cell.
- **Auto-fit zoom fix**: Changed `Math.round` to `Math.floor` to prevent overflow. Also accounts for end cap widths: estimates `fontSize * 3 + 12` per visible end cap and subtracts from container width before computing zoom.
- **StylePane auto-switch Items/Timescale tabs**: `useEffect` watches `stylePaneSection` and auto-switches `mainTab`. Clicking items switches to Items tab, clicking tier rows switches to Timescale tab.

### Phase 16 — Export Functionality + Click-to-Deselect (session 15)
- **Clear selections on canvas background click** (`cbb970a`): Added `onClick` handler on scrollable container div in TimelineView that clears `selectedItemId`, `selectedSwimlaneId`, `selectedTierIndex`, and `stylePaneSection` when clicking empty space. Fixed tier row click handler to include `e.stopPropagation()` (was the only clickable element missing it).
- **Export dropdown button** (`950c793`, `cf909af`): Replaced placeholder "Download" button with "Export" dropdown (chevron menu) with "Export as PNG" and "Export as PowerPoint" options. Export button disabled when not on Timeline view. Uses `html-to-image` for PNG capture.
- **Fixed html-to-image issues** (`39478d9`): Switched from `html2canvas` (can't parse `oklab()` colors from Tailwind v4) to `html-to-image`. Added `skipFonts: true` to avoid cross-origin Google Fonts stylesheet errors.
- **TimelineView forwardRef** (`39478d9`): TimelineView uses `forwardRef` + `useImperativeHandle` to expose `getExportElement()` method returning the inner content div ref for PNG capture.
- **Native PowerPoint export** (`517e184`): Created `src/utils/exportPptx.ts` — comprehensive utility recreating entire timeline as editable PPTX shapes:
  - Timescale tier rows with cell labels, separators, end caps, today marker, elapsed time bar
  - Task bars with progress fill + title/date/duration/% complete labels (position-aware)
  - Milestones (diamond shapes) with title and date labels
  - Swimlane bands with body background opacity, colored badges, title text
  - Grid lines matching finest tier
  - Dependency lines with arrowheads (`endArrowType: 'triangle'`)
  - Vertical connector dashed lines
  - Auto-scales to fit 16:9 widescreen slide (13.333" x 7.5") with 0.4" margins and centering
  - Milestone shapes always `'diamond'` regardless of `milestoneStyle.icon` (simplification — 23 lucide variants can't map to PPTX shapes)
  - Dependency lines drawn as straight lines (pptxgenjs doesn't support Bezier curves natively)

### Phase 17 — Undo/Redo + Drag UX Improvements (sessions 16-17)
- **Fixed false dirty flag on view switch** (`a1abe58`): Auto-fit zoom `useEffect` was calling `setZoom()` unconditionally on mount, touching `zoom` (a dirty key). Fixed by only calling `setZoom` when computed value differs from current.
- **Moved Save to banner + added Undo/Redo** (`601e647`):
  - Banner (row 1) now has: Left = Save icon (floppy disk) + divider + Undo/Redo icons; Center = project name + status; Right = empty spacer
  - Save button removed from toolbar (row 2), which now has: Projects, Export, Settings
  - Undo/Redo system: snapshots saveable state (`DIRTY_KEYS`) before each dirty mutation, max 50 levels, stacks reset on load/new project
  - `canUndo`/`canRedo` booleans added to `ProjectState` type and store
  - Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+S (save)
  - Undo/Redo buttons grey out (`text-white/25`) when stack is empty
  - Stacks kept outside Zustand store (plain arrays) to avoid triggering re-renders
  - `isUndoRedoing` guard prevents snapshotting during undo/redo
- **Fixed timeline drag-and-drop** (`e0b4d45`): Complete rewrite of drag handling:
  - Uses `useRef` for drag start tracking (not `useState` which caused stale closures)
  - Attaches `mousemove`/`mouseup` to `window` via `useEffect` (not React event handlers on container div)
  - Removed `draggable` and `onDragStart` attributes from TaskBar/MilestoneItem
- **Added drag guide** (`57b3f4e`, `5409ef4`, `463605b`, `6090ce2`): Visual feedback during item drag:
  - Dashed outline at snapped grid position (uses task's own color, `2px dashed`)
  - Date tooltip below outline showing new start-end dates (dark `#334155` background, white text)
  - Milestone variant with diamond outline + single date
  - All rendering uses pure inline `style` objects (Tailwind v4 classes don't work for dynamic overlay elements)
- **Added ghost bar + vertical guidelines** (`d4b2816`): Two additional drag guide elements:
  - **Ghost bar/diamond at original position**: Faded copy (opacity 0.2-0.25) of task bar or milestone diamond at original location, showing where the item was before dragging
  - **Vertical guidelines**: Dashed vertical lines (`1px dashed #94a3b8`) extending full canvas height at snap position. Tasks get two lines (start + end), milestones get one line (center). Helps align with timescale dates.
  - All elements use inline styles only (no Tailwind classes)

### Phase 18 — TierSettingsModal Preview End Cap Fix (session 18)
- **Fixed TierSettingsModal preview end caps** (`c2f319b`): End caps in the tier settings modal preview were flex siblings consuming bar width. Changed to absolute positioning (`right: 100%` / `left: 100%`) matching the fix applied to TimelineView in session 17. Added `mx-16` to the relative container to prevent clipping by parent overflow.

---

## Known Pre-existing Build Errors

`npx tsc --noEmit` passes clean as of session 18.

---

## What's Next (TODO)

### Export
- **PNG export needs testing** — `html-to-image` export set up but not yet confirmed working by user
- **PPTX export needs testing** — native PPTX export implemented but may need visual tweaks after user review

### Timescale Tab
All sections COMPLETED:
- ~~Tier settings button + modal~~ DONE
- ~~Scale section wired to store~~ DONE
- ~~Today marker section~~ DONE
- ~~Elapsed time section~~ DONE
- ~~Left/right end cap sections~~ DONE

### Design Tab
- Currently has Task Layout only; could expand with more design options

### Swimlane Sections (remaining)
1. Swimlane spacing section content (placeholder exists)

### Milestone Sections (remaining)
1. Milestone connector section content (placeholder exists, parked/backlog)

### Other Backlog
1. Empty state illustrations (just text for now)
2. **Shape library unification** — consolidate task bar shapes (`BarShape`) and timescale bar shapes (`TimescaleBarShape`) into a shared shape library to prevent duplicate/inconsistent shapes across modules

---

## CSS Variables (from `src/index.css`)
```css
--color-bg: #ffffff
--color-bg-secondary: #f8fafc
--color-bg-tertiary: #e2e8f0
--color-surface: #ffffff
--color-surface-hover: #f1f5f9
--color-border: #e2e8f0
--color-text: #334155
--color-text-secondary: #64748b
--color-text-muted: #94a3b8
```

---

## Important Implementation Notes

- Recent colors in AdvancedColorPicker are stored at module level (persist across mounts but not page refreshes)
- `applyPartialStyleToAll` works generically — copies any named keys from source item's taskStyle to all other tasks. Supports 4th parameter `onlyInSwimlane?: boolean` to filter to same swimlane.
- `applyTaskBarStyleToAll` accepts specific bar properties (shape, color, thickness, spacing) with excludeSwimlanes option
- Duration is computed from startDate/endDate, not stored — there is no `duration` field on ProjectItem
- `checkedItemIds: string[]` stored in Zustand for multi-select
- `stylePaneSection` in Zustand controls which accordion section is expanded (only one at a time)
- Show/hide toggles are in TaskStyle (persisted per item), toggled via CollapsibleRow's toggle prop
- `swimlaneSpacing` is a **global** property on `ProjectState` (not per-swimlane), clamped 0-40, default 5
- `ApplyToAllBox` supports optional `excludeSwimlanes`/`setExcludeSwimlanes` AND `onlyInSwimlane`/`setOnlyInSwimlane` props (mutually exclusive modes)
- **Dirty tracking**: Store's `set()` is wrapped — any mutation of a key in `DIRTY_KEYS` automatically sets `isDirty: true`. No manual `isDirty: true` needed in actions.
- **Save is manual only**: User clicks "Save" button; no auto-save. Banner shows unsaved/saved status.
- **`addItem` returns `string`** (the new item's ID) — supports auto-focus after add
- **`addSwimlane` returns `string`** (the new swimlane's ID) — supports auto-focus after add
- **Apply to All swimlane-aware pattern**: Task Apply components check `isInSwimlane = item.swimlaneId !== null` and conditionally spread `{ onlyInSwimlane, setOnlyInSwimlane }` or `{ excludeSwimlanes, setExcludeSwimlanes }` to `ApplyToAllBox`. Same pattern used by milestone Apply components.
- **CRITICAL**: `buildVisibleTierCells()` is the single source of truth for timescale cell layout — used by both TimelineView and TierSettingsModal preview. Changes to one must be reflected in the other.
- **CRITICAL**: The padded date range must be computed identically in TimelineView and TierSettingsModal. Both use: `startOfMonth(subDays(projectStart, 14))` for start, `addMonths` for end.
- `ScaleSection` in StylePane is **wired to the store** via `selectedTierIndex` — reads/writes selected tier's config
- The `Toggle` component is defined locally inside StylePane.tsx (~line 350)
- `CollapsibleRow` supports optional `toggle` prop for show/hide switch
- TierSettingsModal `DEFAULT_3_TIERS`: tier 0 = month/green (#6b7f5c), tier 1 = week/slate (hidden), tier 2 = day/slate (hidden)
- **html-to-image requires `skipFonts: true`** — cross-origin Google Fonts stylesheets cause `CSSStyleSheet.cssRules` access errors. The `skipFonts` option bypasses web font embedding (fonts still render since they're loaded in browser).
- **html2canvas does NOT work with Tailwind CSS v4** — it cannot parse `oklab()` color functions. Use `html-to-image` instead.
- **Vite dep cache** (`node_modules/.vite/`) can get stale when swapping npm packages. Fix: `rm -rf node_modules/.vite` and restart dev server.
- **TimelineView uses `forwardRef`** with `useImperativeHandle` to expose `getExportElement()` that returns the inner content div ref for PNG capture.
- **PPTX export coordinate system**: Mirrors TimelineView's layout computation (origin, totalDays, zoom, swimlane layout, row assignment) then scales px to inches using `scale = Math.min(CONTENT_W / totalWidth, CONTENT_H / totalContentHeight)`. Content centered on 13.333" x 7.5" widescreen slide with 0.4" margins.
- **pptxgenjs `addShape('line', ...)`** supports `endArrowType: 'triangle'` for dependency arrows. Bezier curves not natively supported — dependency lines drawn as straight lines.
- **Milestone shapes in PPTX**: Always `'diamond'` regardless of `milestoneStyle.icon` (23 lucide-react icon variants can't all map to PPTX shapes).
- **Task layout row system**: Every `ProjectItem` has `row: number`. Vertical position = `sectionBaseY + row * ROW_HEIGHT` (ROW_HEIGHT=44). `getRow` in TimelineView is a `useMemo` returning `(item: ProjectItem) => number`. `single-row` returns `item.row`, `packed`/`one-per-row` build `rowMap` per group.
- **Timescale cell widths** are proportional to calendar days. `buildVisibleTierCells()` computes fractional positions. The `+1` on `endFrac` converts inclusive end dates to exclusive boundaries.
- **Auto-fit zoom reserves space for end caps**: estimates `fontSize * 3 + 12` per visible end cap, subtracts from container width before computing zoom. Uses `Math.floor` (not `Math.round`) to prevent overflow.
- **`taskLayout`** added to `DIRTY_KEYS` — persisted to localStorage along with other saveable keys.
- **Undo/Redo system**: Stacks (`undoStack`, `redoStack`) kept as module-level plain arrays outside Zustand store to avoid triggering re-renders. `takeSnapshot()` captures all `DIRTY_KEYS` values before mutations. `applySnapshot()` restores them. `isUndoRedoing` flag prevents snapshotting during undo/redo operations. Max 50 undo levels. Stacks cleared on `loadProject`/`newProject`. `canUndo`/`canRedo` booleans on store updated after each push/pop for UI binding.
- **Keyboard shortcuts** (in App.tsx `useEffect`): Cmd+Z = undo, Cmd+Shift+Z = redo, Cmd+S = save. All use `e.preventDefault()` to block browser defaults.
- **Drag guide rendering**: All drag feedback elements use pure inline `style` objects. Tailwind v4 classes are unreliable for dynamically rendered overlay elements. The IIFE `{dragGuide && (() => { ... })()}` pattern renders fragments containing: ghost bar (opacity 0.2), vertical guidelines (1px dashed #94a3b8 full canvas height), dashed outline (2px dashed in item color), and date tooltip (#334155 bg, white text).
- **Timeline drag uses `useRef` + window events**: `dragRef.current` stores `{ id, startX }`. `mousemove`/`mouseup` attached to `window` via `useEffect` cleanup pattern. Avoids stale closure bugs from `useState` + `useCallback`.
