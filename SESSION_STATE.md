# Project Timeline — Session State Document

> **Last updated**: March 19, 2026
> **Purpose**: Recovery document so a fresh AI session can pick up exactly where we left off.

---

## Project Overview

**Project**: A **Project Visualization App** with three "command centers":
1. **Data View** — Spreadsheet-style editor for project items
2. **Timeline View** — Drag-and-drop Gantt canvas
3. **Style Pane** — Designer side panel (opens when an item is selected)

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
- Clean, professional visuals — nice colors, no clutter
- No emojis in code or UI

---

## Architecture

### File Structure
```
src/
├── App.tsx                              # Root layout: project name (top center), view tabs, view content + StylePane
├── index.css                            # CSS variables (light-only), Tailwind directives
├── main.tsx                             # Entry point
├── types/
│   └── index.ts                         # All TypeScript types, interfaces, constants
├── store/
│   └── useProjectStore.ts               # Zustand store — all state + actions
├── utils/
│   └── index.ts                         # Utility functions (timescale, critical path, project range)
├── components/
│   ├── DataView/
│   │   ├── DataView.tsx                 # Spreadsheet editor with swimlane groups
│   │   └── TypePicker.tsx               # Type column cell + popover (shape/color picker)
│   ├── TimelineView/
│   │   └── TimelineView.tsx             # Gantt canvas with drag-and-drop, dependency lines
│   ├── StylePane/
│   │   └── StylePane.tsx                # Per-item style editor (colors, shapes, fonts, etc.)
│   └── common/
│       └── MilestoneIconComponent.tsx   # Renders milestone icons using Lucide
```

### Key Types (`src/types/index.ts`)

```typescript
type ItemType = 'task' | 'milestone';
type ActiveView = 'data' | 'timeline';

type BarShape = 'rounded' | 'square' | 'flat' | 'capsule' | 'chevron' | 'double-chevron'
  | 'arrow-right' | 'pointed' | 'notched' | 'tab' | 'arrow-both' | 'trapezoid';

type MilestoneIcon = 'diamond' | 'diamond-filled' | 'triangle' | 'triangle-filled'
  | 'flag' | 'flag-filled' | 'star' | 'star-filled' | 'circle' | 'circle-filled'
  | 'square-ms' | 'square-ms-filled' | 'check' | 'arrow-up' | 'arrow-right' | 'hexagon';

interface TaskStyle {
  barShape: BarShape; color: string; thickness: number;
  labelPosition: LabelPosition; fontSize: number; fontColor: string;
  fontFamily: string; fontWeight: number;
}

interface MilestoneStyle {
  icon: MilestoneIcon; size: number; color: string;
  fontSize: number; fontColor: string; labelPosition: LabelPosition;
  fontFamily: string; fontWeight: number;
}

interface ProjectItem {
  id: string; name: string; type: ItemType;
  startDate: string; endDate: string;           // ISO date strings
  percentComplete: number; statusId: string | null;
  visible: boolean; swimlaneId: string; row: number;
  taskStyle: TaskStyle; milestoneStyle: MilestoneStyle;
  dependsOn: string[]; isCriticalPath: boolean;
}

interface StatusLabel { id: string; label: string; color: string; }

interface ProjectState {
  projectName: string; items: ProjectItem[]; swimlanes: Swimlane[];
  dependencies: Dependency[]; statusLabels: StatusLabel[];
  selectedItemId: string | null; activeView: ActiveView;
  showCriticalPath: boolean; zoom: number; timescale: TimescaleConfig;
  // ... plus all actions
}
```

### Store Actions (`src/store/useProjectStore.ts`)
- CRUD: `addItem`, `updateItem`, `deleteItem`, `toggleVisibility`, `toggleItemType`
- Swimlanes: `addSwimlane`, `updateSwimlane`, `deleteSwimlane`
- Dependencies: `addDependency`, `removeDependency`
- Styles: `updateTaskStyle`, `updateMilestoneStyle`, `applyStyleToAll`, `applyPartialStyleToAll`
- Status: `addStatusLabel`, `updateStatusLabel`, `removeStatusLabel`
- Global: `setProjectName`, `setActiveView`, `setSelectedItem`, `setZoom`
- Critical path: `toggleCriticalPath`, `recalcCriticalPath` (currently dormant — UI toggle removed)
- Movement: `moveItem` (shift by days), `moveItemToSwimlane`
- Timescale: `updateTimescale`, `updateTier`

### Sample Data
- **4 swimlanes**: Planning, Development, Testing, Deployment
- **12 items** (i1-i12): mix of tasks and milestones with various status IDs
- **12 dependencies**: forming a realistic project dependency chain
- Default zoom: 8, default timescale: months + quarters

---

## App Layout (current state)

```
┌─────────────────────────────────────────────────────────┐
│              [Project Name - click to edit]              │  ← App.tsx (centered, editable)
├─────────────────────────────────────────────────────────┤
│                  [Data] [Timeline]                       │  ← App.tsx (view toggle tabs)
├──────────────────────────────────────────┬──────────────┤
│                                          │              │
│  Data View or Timeline View              │  Style Pane  │  ← Shows when item selected
│  (fills remaining space)                 │  (340px)     │
│                                          │              │
└──────────────────────────────────────────┴──────────────┘
```

### Data View Layout
- **Sub-header**: Add dropdown button (right-aligned) — can add Swimlane/Task/Milestone
- **Table**: columns = grip | vis | type | name | start | end | duration | progress | status | actions
  - Type column: custom TypePickerCell with shape/color popover
  - Duration: auto-calculated (inclusive: same day = 1 day), editable
  - Status: dropdown with configurable labels (gear icon in header opens config panel)
  - Actions: trash icon, only visible on row hover
- **Swimlane groups**: collapsible, with inline "Add task or milestone" at bottom of each
- **Bottom**: "+ Add Swimlane" button below last swimlane
- **StatusConfigPanel**: absolutely-positioned overlay (right side, z-40)

### Timeline View Layout
- **Sub-header**: Zoom controls (right-aligned) — zoom in/out buttons with level display
- **Canvas**: Swimlane labels (left sticky column) + timescale tiers + task bars/milestones + dependency arrows + today line
- Task bars render with CSS clip-path for non-rectangular shapes (chevron, arrow, etc.)
- Milestones render with Lucide icons via MilestoneIconComponent

---

## What Has Been Completed

### Phase 1 — Core Build (prior sessions)
- Full project scaffold with all types, Zustand store, sample data
- Data View, Timeline View, Style Pane, Toolbar — all functional
- Dependencies & critical path computation
- Fiscal year config, zoom controls
- Configurable text properties (fontFamily, fontWeight, fontSize, fontColor)
- Granular "Apply to All" with per-property-group buttons

### Phase 2 — Cleanup (this session)
1. ✅ Dark theme removal (index.css, types, store, App, Toolbar, DataView)
2. ✅ Auto-fit text removal (types, StylePane, TimelineView)

### Phase 3 — Data View Redesign (this session)
3. ✅ Added StatusLabel type, statusId on ProjectItem, projectName + statusLabels on ProjectState
4. ✅ Store: projectName, statusLabels, status CRUD actions, updated sample data
5. ✅ Toolbar simplified → then deleted entirely (functionality moved to App.tsx and sub-headers)
6. ✅ DataView: complete rewrite with all 7 requirements:
   - a. Top-left Add dropdown (swimlane/task/milestone)
   - b. Inline "Add task or milestone" at bottom of each swimlane
   - c. Actions column: hover-only visibility
   - d. Swimlane column removed
   - e. Bottom "Add Swimlane" button
   - f. Type column: now a dropdown (was toggle)
   - g. Duration column: editable, auto-calc with start/end
   - h. Status column: dropdown + config panel (gear icon)
   - i. Tab renamed to "Data"
   - j. Editable project name (now moved to App.tsx top-center)

### Phase 4 — Layout Optimization (this session)
7. ✅ Project name moved to top-center of App.tsx (shared across views)
8. ✅ View tabs (Data/Timeline) below project name in App.tsx
9. ✅ "Project Timeline" logo removed
10. ✅ Critical path toggle removed from UI (logic kept dormant)
11. ✅ Zoom controls moved into TimelineView sub-header
12. ✅ Toolbar.tsx deleted

### Phase 5 — Type Column Redesign (this session)
13. ✅ BarShape expanded from 3 to 12 variants
14. ✅ TypePicker.tsx: compact cell (shape icon + color + type letter + arrow)
15. ✅ TypePickerPopover: Task shapes (3×4 grid) | Milestone shapes (4×4 grid) + Color swatches + Done
16. ✅ TaskShapePreview: inline SVG component for shape grid
17. ✅ TimelineView TaskBar: updated to render new shapes via CSS clip-path
18. ✅ StylePane: bar shape options expanded to 12, rendered in 4-column grid

---

## Known Issues / Future Work
- StatusConfigPanel positioning: uses `absolute` within `relative` DataView wrapper — works but may need visual QA
- Critical path toggle was removed from UI; `showCriticalPath` defaults to `false` in store. Logic is intact and can be re-enabled.
- Some unused assets remain: `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`
- No tests exist yet
- Drag-and-drop reordering within swimlanes (grip handle) has visual affordance but may not be fully wired
- The "arrow-right" bar shape and the "arrow-right" milestone icon share a name conceptually but are different types (`BarShape` vs `MilestoneIcon`)

---

## Build Status
- `npx tsc --noEmit` → ✅ passes
- `npx vite build` → ✅ passes (2065 modules, ~285KB JS, ~27KB CSS)
