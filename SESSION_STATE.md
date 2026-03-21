# Project Timeline — Session State Document

> **Last updated**: March 20, 2026 (session 8)
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
├── App.tsx                              # Root layout: banner + toolbar + main content (202 lines)
├── index.css                            # CSS variables (light-only), Tailwind directives
├── main.tsx                             # Entry point
├── types/
│   └── index.ts                         # All TypeScript types, interfaces, constants (~335 lines)
├── store/
│   └── useProjectStore.ts               # Zustand store — all state + actions (757 lines)
├── utils/
│   └── index.ts                         # Utility functions (timescale, critical path, project range)
├── components/
│   ├── DataView/
│   │   ├── DataView.tsx                 # Spreadsheet editor with swimlane groups (1509 lines)
│   │   └── TypePicker.tsx               # Type column cell + popover (shape/color picker)
│   ├── TimelineView/
│   │   └── TimelineView.tsx             # Gantt canvas with drag-and-drop, dependency lines, vertical connectors (~898 lines)
│   ├── StylePane/
│   │   └── StylePane.tsx                # Per-item style editor — heavily extended (~2200+ lines)
│   └── common/
│       ├── MilestoneIconComponent.tsx   # Renders milestone icons using Lucide
│       ├── AdvancedColorPicker.tsx      # Full Office-style color picker with theme/standard/recent colors
│       ├── ShapeDropdown.tsx            # Clean trigger + 6-col icon grid; exports ShapePreview
│       ├── SizeControl.tsx              # S/M/L toggles + numeric stepper
│       ├── SpacingControl.tsx           # Tight/Normal/Wide toggle with SVG icons
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
  | 'swimlaneTitle' | 'swimlaneBackground' | 'swimlaneSpacing';

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
  activeView: ActiveView;
  selectedItemId: string | null;
  selectedSwimlaneId: string | null;  // mutual exclusion with selectedItemId
  stylePaneSection: StylePaneSection | null; // which section expanded in StylePane
  showCriticalPath: boolean; zoom: number;
}
```

### Store Actions (`src/store/useProjectStore.ts`)
- **Global**: `setActiveView`, `setSelectedItem`, `setSelectedSwimlane`, `setStylePaneSection`, `setZoom`, `setProjectName`, `setTimelineTitle`
- **Items**: `addItem`, `addItemRelative`, `duplicateItem`, `updateItem`, `deleteItem`, `toggleVisibility`, `toggleItemType`, `moveItem`, `resizeItem`, `setItemRow`, `reorderItem`, `moveItemToSwimlane`, `moveItemToGroup`
- **Swimlanes**: `addSwimlane`, `addSwimlaneRelative`, `duplicateSwimlane`, `hideSwimlaneItems`, `updateSwimlane`, `applySwimlaneStyleToAll`, `deleteSwimlane`, `reorderSwimlane`
- **Dependencies**: `addDependency`, `removeDependency`
- **Styles**: `updateTaskStyle`, `updateMilestoneStyle`, `applyStyleToAll`, `applyPartialStyleToAll`, `applyTaskBarStyleToAll`
- **Status**: `addStatusLabel`, `updateStatusLabel`, `removeStatusLabel`
- **Timescale**: `updateTimescale`, `updateTier`, `addTier`, `removeTier`
- **Critical path**: `toggleCriticalPath`, `recalcCriticalPath` (UI toggle removed, logic kept dormant)
- **Columns**: `toggleColumn`
- **Multi-select**: `toggleCheckedItem`, `checkAllItems`, `uncheckAllItems`, `setCheckedItems`
- **Bulk ops**: `duplicateCheckedItems`, `hideCheckedItems`, `deleteCheckedItems`, `setColorForCheckedItems`

### Sample Data
- **4 swimlanes**: Planning, Development, Testing, Deployment
- **12 items** (i1-i12): mix of tasks and milestones with various status IDs
- **12 dependencies**: forming a realistic project dependency chain
- Default zoom: 8, default timescale: months + quarters

---

## App Layout

### Row 1 (top banner)
- Colored bar: `#4f46e5` (indigo-600)
- Project name centered with " - Saved" suffix, white text

### Row 2 (toolbar)
- Left: view-specific add buttons
- Center: `Data` / `Timeline` tabs
- Right: `Download` + gear icon

### Main content
- Data View or Timeline View fills remaining space
- StylePane always visible in Timeline view (340px right panel)
- Empty state: "Select tasks to style them" when no item selected

### StylePane Structure
- **Tabs**: `Items` and `Timescale`
- Items tab has **3 sub-icons** (task, milestone, swimlane) at top
- Task sub-tab has **6 collapsible sections** (accordion-style, one at a time, driven by `stylePaneSection` in Zustand):

| # | Section | Collapse Arrow | Toggle | Default | Status |
|---|---------|---------------|--------|---------|--------|
| 1 | Task bar | Yes | No | — | COMPLETED |
| 2 | Task title | Yes | Yes (green) | ON | COMPLETED |
| 3 | Task date | Yes | Yes | OFF | COMPLETED |
| 4 | Task duration | Yes | Yes | OFF | COMPLETED |
| 5 | Task % complete | Yes | Yes | OFF | COMPLETED |
| 6 | Vertical connector | Yes | Yes | OFF | COMPLETED |

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

---

## Known Pre-existing Build Errors

`npx tsc --noEmit` passes clean as of session 6. No known type errors.

---

## What's Next (TODO)

### Swimlane Sections (remaining)
1. Swimlane spacing section content (placeholder exists)

### Milestone Sections (remaining)
1. Milestone connector section content (placeholder exists, parked/backlog)

### Other Backlog
1. Empty state illustrations (just text for now)

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
- `applyPartialStyleToAll` works generically — copies any named keys from source item's taskStyle to all other tasks
- `applyTaskBarStyleToAll` accepts specific bar properties (shape, color, thickness, spacing) with excludeSwimlanes option
- Duration is computed from startDate/endDate, not stored — there is no `duration` field on ProjectItem
- `checkedItemIds: string[]` stored in Zustand for multi-select
- `stylePaneSection` in Zustand controls which accordion section is expanded (only one at a time)
- Show/hide toggles are in TaskStyle (persisted per item), toggled via CollapsibleRow's toggle prop
