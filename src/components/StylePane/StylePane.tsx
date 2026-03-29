import { useProjectStore } from '@/store/useProjectStore';
import {
  Paintbrush,
  ChevronRight,
  ChevronDown,
  Info,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import { AdvancedColorPicker } from '@/components/common/AdvancedColorPicker';
import { ShapeDropdown, ShapePreview } from '@/components/common/ShapeDropdown';
import { SizeControl } from '@/components/common/SizeControl';
import { SpacingControl } from '@/components/common/SpacingControl';
import { NumericStepper } from '@/components/common/NumericStepper';
import { FontFamilyDropdown, FontSizeDropdown } from '@/components/common/FontDropdowns';
import { DateFormatDropdown } from '@/components/common/DateFormatDropdown';
import { DurationFormatDropdown } from '@/components/common/DurationFormatDropdown';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { PopoverSurface } from '@/components/common/PopoverPrimitives';
import { OptionGridPicker } from '@/components/common/OptionGridPicker';
import { MILESTONE_ICON_OPTIONS } from '@/components/common/pickerOptions';
import {
  FONT_FAMILIES,
  type LabelPosition,
  type MilestoneIcon,
  type ConnectorThickness,
  type OutlineThickness,
  type Swimlane,
  type TimescaleTierConfig,
  type TimescaleBarShape,
  type TierFormat,
  type ElapsedTimeThickness,
  type EndCapConfig,
  type TaskLayout,
  type StylePaneSection,
  type DateFormat,
} from '@/types';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { parseISO, differenceInDays, format } from 'date-fns';
import { generateTierLabels, buildVisibleTierCells, computeAutoFontSize, getProjectRangePadded, getFormatOptionsForUnit, getDefaultFormatForUnit, resolveAutoUnit } from '@/utils';
import { SchedulingSettingsModal } from '@/components/common/SchedulingSettingsModal';
import { ConnectionPointButton } from '@/components/common/ConnectionPointButton';
import { DialogButton, ModalCloseButton, ModalSurface } from '@/components/common/ModalPrimitives';
import { getDependencyArrowPreviewProps } from '@/components/common/dependencyArrowGeometry';
import { ColorTransparencyControl } from '@/components/common/ColorTransparencyControl';
import { PropertyControlRow } from '@/components/common/PropertyControlRow';
import { LabeledFieldPair } from '@/components/common/LabeledFieldPair';

// ─── Constants ───────────────────────────────────────────────────────────────

// Custom sub-tab icons matching the design mockup
function TaskIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {/* Top bar: longer, right-aligned arrow shape */}
      <polygon points="0,3 12,3 15,5 12,7 0,7" fill="currentColor" />
      {/* Bottom bar: shorter, right-aligned arrow shape */}
      <polygon points="3,9 12,9 15,11 12,13 3,13" fill="currentColor" />
    </svg>
  );
}

function MilestoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="8" y="1.34" width="9" height="9" rx="1" transform="rotate(45 8 1.34)" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function SwimlaneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 19 16" fill="none">
      <rect x="1" y="4" width="3.5" height="8" rx="1" stroke="currentColor" strokeWidth="0.7" />
      <rect x="6.5" y="4" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function DependencyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="10" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <path d="M6 4.5H8V11.5H10" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function getTimescaleBarShapeStyle(shape: TimescaleBarShape): React.CSSProperties {
  // Maps to same geometry as task bar shapes, but uses CSS-only (no pixel dimensions available)
  switch (shape) {
    case 'rectangle': return { borderRadius: 0 };
    case 'rounded': return { borderRadius: 6 };
    case 'ellipse': return { borderRadius: '9999px' };
    // modern & leaf are parallelograms — approximate with skewX transform on the container
    case 'modern': return { borderRadius: 6, transform: 'skewX(-5deg)' };
    case 'leaf': return { borderRadius: '6px 2px 6px 2px', transform: 'skewX(-5deg)' };
    case 'slant': return { clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' };
    default: return {};
  }
}

const LABEL_POSITIONS: { id: LabelPosition; label: string }[] = [
  { id: 'far-left', label: 'Far Left' },
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
  { id: 'above', label: 'Above' },
  { id: 'below', label: 'Below' },
];

// Duration/% complete positions (no Far Left)
const SECONDARY_LABEL_POSITIONS: { id: LabelPosition; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
  { id: 'above', label: 'Above' },
  { id: 'below', label: 'Below' },
];

// Milestone date positions: above/below/left/right relative to shape
const MILESTONE_DATE_POSITIONS: { id: LabelPosition; label: string }[] = [
  { id: 'above', label: 'Above' },
  { id: 'below', label: 'Below' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

const DEP_LINE_DASH_OPTIONS = [
  { id: 'solid', label: 'Solid', dasharray: undefined },
  { id: 'dashed', label: 'Dashed', dasharray: '6 4' },
  { id: 'dotted', label: 'Dotted', dasharray: '2 4' },
  { id: 'long-dashed', label: 'Long dashed', dasharray: '10 6' },
  { id: 'dash-dot', label: 'Dash dot', dasharray: '8 4 2 4' },
  { id: 'long-dot', label: 'Long dot', dasharray: '10 4 2 4' },
] as const;

type DependencyDashOptionId = (typeof DEP_LINE_DASH_OPTIONS)[number]['id'];

const DEP_ARROW_SIZE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const DEP_ARROW_TYPE_OPTIONS = [
  { id: 'standard', label: 'End Arrow' },
  { id: 'open', label: 'Open Arrow' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'circle', label: 'Circle' },
  { id: 'none', label: 'No Arrow' },
] as const;

type MainTab = 'items' | 'timescale' | 'design';
type ItemSubTab = 'task' | 'milestone' | 'swimlane' | 'dependency';

// ─── StylePane ───────────────────────────────────────────────────────────────

export function StylePane() {
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const selectedSwimlaneId = useProjectStore((s) => s.selectedSwimlaneId);
  const selectedDepKey = useProjectStore((s) => s.selectedDepKey);
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const taskLayout = useProjectStore((s) => s.taskLayout);
  const setTaskLayout = useProjectStore((s) => s.setTaskLayout);

  const [mainTab, setMainTab] = useState<MainTab>('items');
  const [forcedMainTab, setForcedMainTab] = useState<MainTab | null>(null);

  const timescaleSections = ['scale', 'todayMarker', 'elapsedTime', 'leftEndCap', 'rightEndCap'];
  const item = items.find((i) => i.id === selectedItemId);
  const selectionKey = selectedDepKey
    ? `dep:${selectedDepKey}`
    : selectedSwimlaneId
      ? `swimlane:${selectedSwimlaneId}`
      : item
        ? `item:${item.id}`
        : null;
  const hasItemSelection = Boolean(selectionKey);
  const autoMainTab: MainTab = hasItemSelection
    ? 'items'
    : stylePaneSection
      ? (timescaleSections as string[]).includes(stylePaneSection) ? 'timescale' : 'items'
      : mainTab;
  const activeMainTab = forcedMainTab ?? autoMainTab;

  useEffect(() => {
    if (selectionKey) {
      setForcedMainTab(null);
      setMainTab('items');
    }
  }, [selectionKey]);

  // Determine which sub-tab to show based on selection
  const autoSubTab: ItemSubTab = selectedDepKey
    ? 'dependency'
    : selectedSwimlaneId
      ? 'swimlane'
      : item?.type === 'milestone'
        ? 'milestone'
        : 'task';
  const [forcedSubTab, setForcedSubTab] = useState<ItemSubTab | null>(null);
  const activeSubTab = forcedSubTab ?? autoSubTab;

  const handleSubTabClick = (tab: ItemSubTab) => {
    setForcedSubTab(tab === autoSubTab ? null : tab);
  };

  const handleMainTabClick = (tab: MainTab) => {
    setMainTab(tab);
    setForcedMainTab(tab === autoMainTab ? null : tab);
  };

  // Swimlane: prefer direct selection, fall back to selected item's swimlane
  const selectedSwimlane = selectedSwimlaneId
    ? swimlanes.find((s) => s.id === selectedSwimlaneId)
    : item
      ? swimlanes.find((s) => s.id === item.swimlaneId)
      : undefined;

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* ─── Header with main tabs ─── */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <div className="flex items-center h-10 px-3">
          <Paintbrush size={14} className="text-slate-700 mr-2 shrink-0" />
          <div className="flex items-center gap-0.5 flex-1">
            <button
              onClick={() => handleMainTabClick('items')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMainTab === 'items'
                  ? 'bg-slate-700/15 text-slate-800'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Items
            </button>
            <button
              onClick={() => handleMainTabClick('timescale')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMainTab === 'timescale'
                  ? 'bg-slate-700/15 text-slate-800'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Timescale
            </button>
            <button
              onClick={() => handleMainTabClick('design')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMainTab === 'design'
                  ? 'bg-slate-700/15 text-slate-800'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Design
            </button>
          </div>
        </div>

        {/* Sub-icons for Items tab */}
        {activeMainTab === 'items' && (
          <div className="flex items-center gap-4 px-3 pb-2">
            <button
              onClick={() => handleSubTabClick('task')}
              className={`transition-all ${
                activeSubTab === 'task'
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              title="Task"
            >
              <TaskIcon size={26} />
            </button>
            <button
              onClick={() => handleSubTabClick('milestone')}
              className={`transition-all ${
                activeSubTab === 'milestone'
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              title="Milestone"
            >
              <MilestoneIcon size={26} />
            </button>
            <button
              onClick={() => handleSubTabClick('swimlane')}
              className={`transition-all ${
                activeSubTab === 'swimlane'
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              title="Swimlane"
            >
              <SwimlaneIcon size={26} />
            </button>
            <button
              onClick={() => handleSubTabClick('dependency')}
              className={`transition-all ${
                activeSubTab === 'dependency'
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              title="Dependency Link"
            >
              <DependencyIcon size={26} />
            </button>
          </div>
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {activeMainTab === 'items' ? (
          <ItemsTabContent
            item={item}
            activeSubTab={activeSubTab}
            selectedSwimlane={selectedSwimlane}
            updateTaskStyle={updateTaskStyle}
            updateMilestoneStyle={updateMilestoneStyle}
            updateSwimlane={updateSwimlane}
          />
        ) : activeMainTab === 'timescale' ? (
          <TimescaleTabContent
            timescale={timescale}
            updateTimescale={updateTimescale}
          />
        ) : (
          <DesignTabContent
            taskLayout={taskLayout}
            setTaskLayout={setTaskLayout}
          />
        )}
      </div>
    </div>
  );
}

// ─── Items Tab Content ───────────────────────────────────────────────────────

function ItemsTabContent({
  item,
  activeSubTab,
  selectedSwimlane,
  updateTaskStyle,
  updateMilestoneStyle,
  updateSwimlane,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number] | undefined;
  activeSubTab: ItemSubTab;
  selectedSwimlane: ReturnType<typeof useProjectStore.getState>['swimlanes'][number] | undefined;
  updateTaskStyle: ReturnType<typeof useProjectStore.getState>['updateTaskStyle'];
  updateMilestoneStyle: ReturnType<typeof useProjectStore.getState>['updateMilestoneStyle'];
  updateSwimlane: ReturnType<typeof useProjectStore.getState>['updateSwimlane'];
}) {
  // Dependency tab always shows, regardless of item selection
  if (activeSubTab === 'dependency') {
    return <DependencyLinkControls />;
  }

  if (!item) {
    // Even without an item selected, show swimlane controls if a swimlane is directly selected
    if (activeSubTab === 'swimlane' && selectedSwimlane) {
      return (
        <SwimlaneStyleControls
          swimlane={selectedSwimlane}
          updateSwimlane={updateSwimlane}
        />
      );
    }
    if (activeSubTab === 'swimlane') {
      return (
        <div className="text-center py-12 px-6">
          <div className="text-sm font-semibold text-[var(--color-text)] mb-1">Select a swimlane to style it</div>
          <div className="text-xs text-[var(--color-text-muted)]">Styling options will show up here once you select a swimlane.</div>
        </div>
      );
    }
    const label = activeSubTab === 'milestone' ? 'a milestone' : 'a task';
    return (
      <div className="text-center py-12 px-6">
        <div className="text-sm font-semibold text-[var(--color-text)] mb-1">Select {label} to style it</div>
        <div className="text-xs text-[var(--color-text-muted)]">Styling options will show up here once you select {label}.</div>
      </div>
    );
  }

  if (activeSubTab === 'task' && item.type === 'task') {
    return (
      <TaskStyleControls item={item} updateTaskStyle={updateTaskStyle} />
    );
  }

  if (activeSubTab === 'milestone' && item.type === 'milestone') {
    return (
      <MilestoneStyleControls item={item} updateMilestoneStyle={updateMilestoneStyle} />
    );
  }

  if (activeSubTab === 'swimlane' && selectedSwimlane) {
    return (
      <SwimlaneStyleControls
        swimlane={selectedSwimlane}
        updateSwimlane={updateSwimlane}
      />
    );
  }

  // Mismatch: e.g. user selected a task but clicked milestone sub-tab
  if (activeSubTab === 'swimlane') {
    return (
      <div className="text-center py-12 px-6">
        <div className="text-sm font-semibold text-[var(--color-text)] mb-1">Select a swimlane to style it</div>
        <div className="text-xs text-[var(--color-text-muted)]">Styling options will show up here once you select a swimlane.</div>
      </div>
    );
  }
  const label = activeSubTab === 'milestone' ? 'a milestone' : 'a task';
  return (
    <div className="text-center py-12 px-6">
      <div className="text-sm font-semibold text-[var(--color-text)] mb-1">Select {label} to style it</div>
      <div className="text-xs text-[var(--color-text-muted)]">Styling options will show up here once you select {label}.</div>
    </div>
  );
}

// ─── Dependency Link Controls ────────────────────────────────────────────────

type DepSubTab = 'link' | 'critical-path';

function DependencyLinkControls() {
  const selectedDepKey = useProjectStore((s) => s.selectedDepKey);
  const dependencies = useProjectStore((s) => s.dependencies);
  const updateDependency = useProjectStore((s) => s.updateDependency);
  const applyDependencyStyleToAll = useProjectStore((s) => s.applyDependencyStyleToAll);
  const dependencySettings = useProjectStore((s) => s.dependencySettings);
  const showCriticalPath = useProjectStore((s) => s.showCriticalPath);
  const toggleCriticalPath = useProjectStore((s) => s.toggleCriticalPath);
  const criticalPathStyle = useProjectStore((s) => s.criticalPathStyle);
  const updateCriticalPathStyle = useProjectStore((s) => s.updateCriticalPathStyle);

  const [depSubTab, setDepSubTab] = useState<DepSubTab>('link');
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);

  const selectedDep = selectedDepKey
    ? dependencies.find((dep) => `${dep.fromId}-${dep.toId}` === selectedDepKey)
    : null;
  const isVisible = selectedDep?.visible !== false;
  const depColor = selectedDep?.color ?? '#475569';
  const depTransparency = selectedDep?.transparency ?? 0;
  const depLineDash = selectedDep?.lineDash ?? 'solid';
  const depArrowType = selectedDep?.arrowType ?? 'standard';
  const depArrowSize = selectedDep?.arrowSize ?? 4;
  const [applied, setApplied] = useState(false);
  const [applyProps, setApplyProps] = useState({
    visible: true,
    color: true,
    transparency: true,
    lineDash: true,
    lineWidth: true,
    arrowType: true,
    arrowSize: true,
    connectionPoints: true,
  });

  const handleApplyToAll = () => {
    if (!selectedDep) return;
    const keys: (keyof Pick<typeof selectedDep, 'visible' | 'fromPoint' | 'toPoint' | 'color' | 'transparency' | 'lineDash' | 'lineWidth' | 'arrowType' | 'arrowSize'>)[] = [];
    if (applyProps.visible) keys.push('visible');
    if (applyProps.color) keys.push('color');
    if (applyProps.transparency) keys.push('transparency');
    if (applyProps.lineDash) keys.push('lineDash');
    if (applyProps.lineWidth) keys.push('lineWidth');
    if (applyProps.arrowType) keys.push('arrowType');
    if (applyProps.arrowSize) keys.push('arrowSize');
    if (applyProps.connectionPoints) keys.push('fromPoint', 'toPoint');
    if (keys.length === 0) return;
    applyDependencyStyleToAll(selectedDep.fromId, selectedDep.toId, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Dependency Link / Critical Path */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          onClick={() => setDepSubTab('link')}
          className={`px-3 py-1.5 text-xs font-medium transition-all border-b-2 ${
            depSubTab === 'link'
              ? 'border-slate-700 text-slate-800'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          Dependency Link
        </button>
        <button
          onClick={() => setDepSubTab('critical-path')}
          className={`px-3 py-1.5 text-xs font-medium transition-all border-b-2 ${
            depSubTab === 'critical-path'
              ? 'border-slate-700 text-slate-800'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          Critical Path
        </button>
      </div>

      {depSubTab === 'link' ? (
        <div className="space-y-4">
          {/* Visible toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text)]">Visible</span>
            <button
              disabled={!selectedDep}
              onClick={() => {
                if (!selectedDep) return;
                updateDependency(selectedDep.fromId, selectedDep.toId, { visible: !isVisible });
              }}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              {isVisible ? 'On' : 'Off'}
            </button>
          </div>

          {/* Scaffolded styling controls (non-functional placeholders) */}
          <div
            className={`space-y-3 transition-opacity ${isVisible ? '' : 'opacity-40 pointer-events-none'}`}
          >
            <ColorTransparencyControl
              color={depColor}
              transparency={depTransparency}
              onColorChange={(color) => {
                if (!selectedDep) return;
                updateDependency(selectedDep.fromId, selectedDep.toId, { color });
              }}
              onTransparencyChange={(transparency) => {
                if (!selectedDep) return;
                updateDependency(selectedDep.fromId, selectedDep.toId, { transparency });
              }}
            />

            {/* Line dash */}
            <PropertyControlRow label="Line Dash">
              <DependencyLineDashDropdown
                value={depLineDash}
                onChange={(lineDash) => {
                  if (!selectedDep) return;
                  updateDependency(selectedDep.fromId, selectedDep.toId, { lineDash });
                }}
              />
            </PropertyControlRow>

            {/* Line width */}
            <PropertyControlRow label="Line Width">
              <DependencyLineWidthControl
                value={selectedDep?.lineWidth ?? 1.5}
                onChange={(lineWidth) => {
                  if (!selectedDep) return;
                  updateDependency(selectedDep.fromId, selectedDep.toId, { lineWidth });
                }}
              />
            </PropertyControlRow>

            {/* Arrow type */}
            <PropertyControlRow label="Arrow Type">
              <DependencyArrowTypeDropdown
                value={depArrowType}
                onChange={(arrowType) => {
                  if (!selectedDep) return;
                  updateDependency(selectedDep.fromId, selectedDep.toId, { arrowType });
                }}
              />
            </PropertyControlRow>

            {/* Arrow size */}
            <PropertyControlRow label="Arrow Size">
              <DependencyArrowSizeDropdown
                value={depArrowSize}
                onChange={(arrowSize) => {
                  if (!selectedDep) return;
                  updateDependency(selectedDep.fromId, selectedDep.toId, { arrowSize });
                }}
              />
            </PropertyControlRow>

            {/* Connection points */}
            <PropertyControlRow label="Connection Points">
              <ConnectionPointButton
                fromPoint={selectedDep?.fromPoint ?? 'auto'}
                toPoint={selectedDep?.toPoint ?? 'auto'}
                disabled={!selectedDep}
                onChange={(fromPoint, toPoint) => {
                  if (!selectedDep) return;
                  updateDependency(selectedDep.fromId, selectedDep.toId, { fromPoint, toPoint });
                }}
              />
            </PropertyControlRow>
          </div>

          {selectedDep && (
            <ApplyToAllBox onApply={handleApplyToAll} applied={applied} label="Apply to all dependencies">
              <PropertyCard label="Visible" checked={applyProps.visible} onChange={(v) => setApplyProps((p) => ({ ...p, visible: v }))}>
                <ShowIcon />
              </PropertyCard>
              <PropertyCard label="Color" checked={applyProps.color} onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}>
                <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: depColor }} />
              </PropertyCard>
              <PropertyCard label="Transparency" checked={applyProps.transparency} onChange={(v) => setApplyProps((p) => ({ ...p, transparency: v }))}>
                <span className="text-[11px] text-[var(--color-text-secondary)] tabular-nums">{depTransparency}%</span>
              </PropertyCard>
              <PropertyCard label="Line Dash" checked={applyProps.lineDash} onChange={(v) => setApplyProps((p) => ({ ...p, lineDash: v }))}>
                <DependencyDashPreview dasharray={DEP_LINE_DASH_OPTIONS.find((option) => option.id === depLineDash)?.dasharray} />
              </PropertyCard>
              <PropertyCard label="Line Width" checked={applyProps.lineWidth} onChange={(v) => setApplyProps((p) => ({ ...p, lineWidth: v }))}>
                <ThicknessIcon />
              </PropertyCard>
              <PropertyCard label="Arrow Type" checked={applyProps.arrowType} onChange={(v) => setApplyProps((p) => ({ ...p, arrowType: v }))}>
                <DependencyArrowTypePreview type={depArrowType} />
              </PropertyCard>
              <PropertyCard label="Arrow Size" checked={applyProps.arrowSize} onChange={(v) => setApplyProps((p) => ({ ...p, arrowSize: v }))}>
                <DependencyArrowPreview size={depArrowSize} />
              </PropertyCard>
              <PropertyCard label="Connection" checked={applyProps.connectionPoints} onChange={(v) => setApplyProps((p) => ({ ...p, connectionPoints: v }))}>
                <PositionIcon5Dot />
              </PropertyCard>
            </ApplyToAllBox>
          )}

          {/* Scheduling Settings button */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={() => setShowSchedulingModal(true)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] transition-colors border"
              style={{ borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}
            >
              <Settings size={14} />
              Scheduling Settings
            </button>
          </div>

          {/* Current scheduling mode indicator */}
          <div className="text-[10px] text-[var(--color-text-muted)] px-1">
            Current mode: <span className="font-medium text-[var(--color-text-secondary)]">
              {dependencySettings.schedulingMode === 'manual'
                ? 'Manual'
                : dependencySettings.schedulingMode === 'automatic-flexible'
                  ? 'Automatic (Flexible)'
                  : 'Automatic (Strict)'}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text)]">Visible</span>
            <button
              onClick={toggleCriticalPath}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              {showCriticalPath ? <Eye size={14} /> : <EyeOff size={14} />}
              {showCriticalPath ? 'On' : 'Off'}
            </button>
          </div>

          <div className={`space-y-4 rounded-xl border border-[var(--color-border)] p-4 transition-opacity ${showCriticalPath ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="space-y-2.5">
              <div className="text-[13px] font-semibold text-[var(--color-text)]">Tasks & Milestones</div>

              <InlineOverrideRow
                label="Background Color"
                enabled={criticalPathStyle.itemBackground.enabled}
                onToggle={(enabled) => updateCriticalPathStyle({ itemBackground: { ...criticalPathStyle.itemBackground, enabled } })}
                trailing={(
                  <AdvancedColorPicker
                    value={criticalPathStyle.itemBackground.color}
                    triggerSize="small"
                    onChange={(color) => updateCriticalPathStyle({ itemBackground: { ...criticalPathStyle.itemBackground, color } })}
                  />
                )}
              />

              <InlineOverrideRow
                label="Outline"
                enabled={criticalPathStyle.itemOutline.enabled}
                onToggle={(enabled) => updateCriticalPathStyle({ itemOutline: { ...criticalPathStyle.itemOutline, enabled } })}
                inlineControl={(
                  <OutlineThicknessDropdown
                    value={criticalPathStyle.itemOutline.thickness}
                    onChange={(thickness) => updateCriticalPathStyle({ itemOutline: { ...criticalPathStyle.itemOutline, thickness } })}
                  />
                )}
                trailing={(
                  <AdvancedColorPicker
                    value={criticalPathStyle.itemOutline.color}
                    triggerSize="small"
                    onChange={(color) => updateCriticalPathStyle({ itemOutline: { ...criticalPathStyle.itemOutline, color } })}
                  />
                )}
              />

              <InlineOverrideRow
                label="Title Color"
                enabled={criticalPathStyle.titleColor.enabled}
                onToggle={(enabled) => updateCriticalPathStyle({ titleColor: { ...criticalPathStyle.titleColor, enabled } })}
                trailing={(
                  <AdvancedColorPicker
                    value={criticalPathStyle.titleColor.color}
                    triggerSize="small"
                    onChange={(color) => updateCriticalPathStyle({ titleColor: { ...criticalPathStyle.titleColor, color } })}
                  />
                )}
              />
            </div>

            <div className="space-y-2.5 border-t border-[var(--color-border)] pt-4">
              <div className="text-[13px] font-semibold text-[var(--color-text)]">Dependency Links</div>

              <InlineOverrideRow
                label="Color"
                enabled={criticalPathStyle.dependencyColor.enabled}
                onToggle={(enabled) => updateCriticalPathStyle({ dependencyColor: { ...criticalPathStyle.dependencyColor, enabled } })}
                trailing={(
                  <AdvancedColorPicker
                    value={criticalPathStyle.dependencyColor.color}
                    triggerSize="small"
                    onChange={(color) => updateCriticalPathStyle({ dependencyColor: { ...criticalPathStyle.dependencyColor, color } })}
                  />
                )}
              />

              <InlineOverrideRow
                label="Dash Type"
                enabled={criticalPathStyle.dependencyDash.enabled}
                onToggle={(enabled) => updateCriticalPathStyle({ dependencyDash: { ...criticalPathStyle.dependencyDash, enabled } })}
                inlineControl={(
                  <DependencyDashPreview dasharray={DEP_LINE_DASH_OPTIONS.find((option) => option.id === criticalPathStyle.dependencyDash.dash)?.dasharray} />
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scheduling Settings Modal */}
      {showSchedulingModal && (
        <SchedulingSettingsModal onClose={() => setShowSchedulingModal(false)} />
      )}
    </div>
  );
}

function DependencyLineDashDropdown({
  value,
  onChange,
}: {
  value: DependencyDashOptionId;
  onChange: (value: DependencyDashOptionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = DEP_LINE_DASH_OPTIONS.find((option) => option.id === value) ?? DEP_LINE_DASH_OPTIONS[0];

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 180;
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    setPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleViewport = () => updatePos();
    window.addEventListener('resize', handleViewport);
    window.addEventListener('scroll', handleViewport, true);
    return () => {
      window.removeEventListener('resize', handleViewport);
      window.removeEventListener('scroll', handleViewport, true);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePos();
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all min-w-[124px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <DependencyDashPreview dasharray={selected.dasharray} />
        <ChevronDown size={12} className="text-[#607086] shrink-0 ml-auto" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-[180px] rounded-xl py-1.5"
          style={{ top: pos.top, left: pos.left, background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}
        >
          {DEP_LINE_DASH_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                option.id === value
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc]'
              }`}
              style={option.id === value ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
              title={option.label}
            >
              <DependencyDashPreview dasharray={option.dasharray} />
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function DependencyDashPreview({ dasharray }: { dasharray?: string }) {
  return (
    <svg width="88" height="12" viewBox="0 0 88 12" fill="none" className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="86"
        y2="6"
        stroke="#334155"
        strokeWidth="2"
        strokeDasharray={dasharray}
        strokeLinecap="round"
      />
    </svg>
  );
}

function DependencyLineWidthControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const clamped = Math.max(0.5, Math.min(8, value));
  const step = 0.25;
  const formatValue = (num: number) => {
    const rounded = Math.round(num * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded.toFixed(0)} px` : `${rounded.toFixed(2).replace(/0$/, '')} px`;
  };

  return (
    <NumericStepper
      axis="horizontal"
      valueDisplay={<div className="px-3 min-w-[82px] h-9 flex items-center justify-center text-xs text-[var(--color-text)] tabular-nums">{formatValue(clamped)}</div>}
      onIncrement={() => onChange(Math.min(8, Math.round((clamped + step) * 100) / 100))}
      onDecrement={() => onChange(Math.max(0.5, Math.round((clamped - step) * 100) / 100))}
      incrementTitle="Increase line width"
      decrementTitle="Decrease line width"
    />
  );
}

function DependencyArrowSizeDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 180;
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    setPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleViewport = () => updatePos();
    window.addEventListener('resize', handleViewport);
    window.addEventListener('scroll', handleViewport, true);
    return () => {
      window.removeEventListener('resize', handleViewport);
      window.removeEventListener('scroll', handleViewport, true);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePos();
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all min-w-[124px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <span className="text-xs text-[var(--color-text)] tabular-nums">Size {value}</span>
        <DependencyArrowPreview size={value} />
        <ChevronDown size={12} className="text-[#607086] shrink-0 ml-auto" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-[180px] rounded-xl py-1.5 max-h-[320px] overflow-y-auto"
          style={{ top: pos.top, left: pos.left, background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}
        >
          {DEP_ARROW_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => {
                onChange(size);
                setOpen(false);
              }}
              className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                size === value
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc]'
              }`}
              style={size === value ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
            >
              <span className="w-12 text-left text-xs">Size {size}</span>
              <DependencyArrowPreview size={size} />
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function DependencyArrowTypeDropdown({
  value,
  onChange,
}: {
  value: (typeof DEP_ARROW_TYPE_OPTIONS)[number]['id'];
  onChange: (value: (typeof DEP_ARROW_TYPE_OPTIONS)[number]['id']) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = DEP_ARROW_TYPE_OPTIONS.find((option) => option.id === value) ?? DEP_ARROW_TYPE_OPTIONS[0];

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 160;
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    setPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleViewport = () => updatePos();
    window.addEventListener('resize', handleViewport);
    window.addEventListener('scroll', handleViewport, true);
    return () => {
      window.removeEventListener('resize', handleViewport);
      window.removeEventListener('scroll', handleViewport, true);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePos();
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all min-w-[124px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <DependencyArrowTypePreview type={selected.id} />
        <span className="text-xs text-[var(--color-text)]">{selected.label}</span>
        <ChevronDown size={12} className="text-[#607086] shrink-0 ml-auto" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-[160px] rounded-xl py-1.5"
          style={{ top: pos.top, left: pos.left, background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}
        >
          {DEP_ARROW_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                option.id === value
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc]'
              }`}
              style={option.id === value ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
            >
              <DependencyArrowTypePreview type={option.id} />
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function DependencyArrowTypePreview({ type }: { type: (typeof DEP_ARROW_TYPE_OPTIONS)[number]['id'] }) {
  const preview = getDependencyArrowPreviewProps(type, 4);

  return (
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none" className="shrink-0">
      <line
        x1={preview.shaftStart}
        y1={preview.centerY}
        x2={preview.shaftEnd}
        y2={preview.centerY}
        stroke="#111827"
        strokeWidth={preview.strokeWidth}
        strokeLinecap="round"
      />
      {type === 'standard' && (
        <polygon
          points={`${preview.tipX},${preview.centerY} ${preview.tipX - preview.depth},${preview.centerY - preview.half} ${preview.tipX - preview.depth},${preview.centerY + preview.half}`}
          fill="#111827"
        />
      )}
      {type === 'open' && (
        <path
          d={`M ${preview.tipX - preview.depth} ${preview.centerY - preview.half} L ${preview.tipX} ${preview.centerY} L ${preview.tipX - preview.depth} ${preview.centerY + preview.half}`}
          stroke="#111827"
          strokeWidth={preview.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {type === 'diamond' && (
        <polygon
          points={`${preview.tipX},${preview.centerY} ${preview.tipX - preview.depth * 0.5},${preview.centerY - preview.half} ${preview.tipX - preview.depth},${preview.centerY} ${preview.tipX - preview.depth * 0.5},${preview.centerY + preview.half}`}
          fill="none"
          stroke="#111827"
          strokeWidth={preview.strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {type === 'circle' && (
        <circle
          cx={preview.tipX - preview.circleRadius}
          cy={preview.centerY}
          r={preview.circleRadius}
          fill="none"
          stroke="#111827"
          strokeWidth={preview.strokeWidth}
        />
      )}
    </svg>
  );
}

function DependencyArrowPreview({ size }: { size: number }) {
  const preview = getDependencyArrowPreviewProps('standard', size);

  return (
    <svg width="58" height="14" viewBox="0 0 58 14" fill="none" className="shrink-0">
      <line
        x1="6"
        y1={preview.centerY + 1}
        x2={6 + (preview.shaftEnd - preview.shaftStart) + size * 2.4}
        y2={preview.centerY + 1}
        stroke="#111827"
        strokeWidth={preview.strokeWidth}
        strokeLinecap="round"
      />
      <polygon
        points={`${24 + size * 2.4},${preview.centerY + 1} ${24 + size * 2.4 - preview.depth},${preview.centerY + 1 - preview.half} ${24 + size * 2.4 - preview.depth},${preview.centerY + 1 + preview.half}`}
        fill="#111827"
      />
    </svg>
  );
}

// ─── Collapsible Section Row ─────────────────────────────────────────────────

function CollapsibleRow({
  label,
  expanded,
  onToggleExpand,
  toggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggleExpand: () => void;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="flex items-center h-11 px-4">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 flex-1 min-w-0 text-sm font-medium text-[var(--color-text)]"
        >
          <ChevronRight
            size={14}
            className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          {label}
        </button>
        {toggle && (
          <ToggleSwitch checked={toggle.checked} onChange={toggle.onChange} />
        )}
      </div>
      {expanded && children && (
        <div
          className={`px-4 pb-4 pt-1${toggle && !toggle.checked ? ' style-pane-disabled' : ''}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Task Style Controls ─────────────────────────────────────────────────────

function TaskStyleControls({
  item,
  updateTaskStyle,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number];
  updateTaskStyle: ReturnType<typeof useProjectStore.getState>['updateTaskStyle'];
}) {
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);

  const handleToggleExpand = (key: StylePaneSection) => {
    setStylePaneSection(stylePaneSection === key ? null : key);
  };

  const style = item.taskStyle;

  return (
    <div className="-mx-4 -mt-1">
      <CollapsibleRow
        label="Task bar"
        expanded={stylePaneSection === 'bar'}
        onToggleExpand={() => handleToggleExpand('bar')}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Shape */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.color}
                onChange={(color) => updateTaskStyle(item.id, { color })}
              />
            )}
            rightLabel="Shape"
            right={(
              <ShapeDropdown
                value={style.barShape}
                onChange={(barShape) => updateTaskStyle(item.id, { barShape })}
              />
            )}
          />

          {/* Row 2: Size */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Size
            </label>
            <SizeControl
              value={style.thickness}
              onChange={(thickness) => updateTaskStyle(item.id, { thickness })}
            />
          </div>

          {/* Row 3: Spacing */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Spacing
            </label>
            <SpacingControl
              value={style.spacing}
              onChange={(spacing) => updateTaskStyle(item.id, { spacing })}
            />
          </div>

          {/* Row 4: Apply to all tasks */}
          <TaskBarApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Task title"
        expanded={stylePaneSection === 'title'}
        onToggleExpand={() => handleToggleExpand('title')}
        toggle={{ checked: style.showTitle, onChange: (v) => updateTaskStyle(item.id, { showTitle: v }) }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.fontColor}
                onChange={(fontColor) => updateTaskStyle(item.id, { fontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.fontFamily}
                  onChange={(fontFamily) => updateTaskStyle(item.id, { fontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.fontSize}
                  onChange={(fontSize) => updateTaskStyle(item.id, { fontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U toggles + alignment */}
          <div className="flex gap-1">
            <button
              onClick={() => updateTaskStyle(item.id, { fontWeight: style.fontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.fontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.fontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.textDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
            {/* Alignment buttons — only shown for center/above/below positions */}
            {(style.labelPosition === 'center' || style.labelPosition === 'above' || style.labelPosition === 'below') && (
              <>
                {/* Separator */}
                <div className="w-px h-6 bg-[var(--color-border)] mx-1 self-center" />
                {/* Text align buttons */}
                <button
                  onClick={() => updateTaskStyle(item.id, { textAlign: 'left' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.textAlign === 'left'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align left"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={2} y1={6} x2={9} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={2} y1={12} x2={9} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { textAlign: 'center' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.textAlign === 'center'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align center"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={3.5} y1={6} x2={10.5} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={3.5} y1={12} x2={10.5} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { textAlign: 'right' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.textAlign === 'right'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align right"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={5} y1={6} x2={12} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={5} y1={12} x2={12} y2={12} />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Row 3: Position */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Position
            </label>
            <div className="flex gap-1">
              {LABEL_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateTaskStyle(item.id, { labelPosition: pos.id })}
                  className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                    style.labelPosition === pos.id
                      ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  title={pos.label}
                >
                  <PositionIcon position={pos.id} />
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Apply to all tasks */}
          <TaskTitleApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Task date"
        expanded={stylePaneSection === 'date'}
        onToggleExpand={() => handleToggleExpand('date')}
        toggle={{ checked: style.showDate, onChange: (v) => updateTaskStyle(item.id, { showDate: v }) }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.dateFontColor}
                onChange={(dateFontColor) => updateTaskStyle(item.id, { dateFontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.dateFontFamily}
                  onChange={(dateFontFamily) => updateTaskStyle(item.id, { dateFontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.dateFontSize}
                  onChange={(dateFontSize) => updateTaskStyle(item.id, { dateFontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => updateTaskStyle(item.id, { dateFontWeight: style.dateFontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.dateFontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { dateFontStyle: style.dateFontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.dateFontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { dateTextDecoration: style.dateTextDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.dateTextDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
            {/* Alignment buttons — only shown for center/above/below positions */}
            {(style.dateLabelPosition === 'center' || style.dateLabelPosition === 'above' || style.dateLabelPosition === 'below') && (
              <>
                {/* Separator */}
                <div className="w-px h-6 bg-[var(--color-border)] mx-1 self-center" />
                {/* Text align buttons */}
                <button
                  onClick={() => updateTaskStyle(item.id, { dateTextAlign: 'left' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.dateTextAlign === 'left'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align left"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={2} y1={6} x2={9} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={2} y1={12} x2={9} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { dateTextAlign: 'center' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.dateTextAlign === 'center'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align center"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={3.5} y1={6} x2={10.5} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={3.5} y1={12} x2={10.5} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { dateTextAlign: 'right' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.dateTextAlign === 'right'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align right"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={5} y1={6} x2={12} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={5} y1={12} x2={12} y2={12} />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Row 3: Format */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Format
            </label>
            <DateFormatDropdown
              value={style.dateFormat}
              onChange={(dateFormat) => updateTaskStyle(item.id, { dateFormat })}
            />
          </div>

          {/* Row 4: Position */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Position
            </label>
            <div className="flex gap-1">
              {LABEL_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateTaskStyle(item.id, { dateLabelPosition: pos.id })}
                  className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                    style.dateLabelPosition === pos.id
                      ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  title={pos.label}
                >
                  <PositionIcon position={pos.id} />
                </button>
              ))}
            </div>
          </div>

          {/* Row 5: Apply to all tasks */}
          <TaskDateApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Task duration"
        expanded={stylePaneSection === 'duration'}
        onToggleExpand={() => handleToggleExpand('duration')}
        toggle={{ checked: style.showDuration, onChange: (v) => updateTaskStyle(item.id, { showDuration: v }) }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.durationFontColor}
                onChange={(durationFontColor) => updateTaskStyle(item.id, { durationFontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.durationFontFamily}
                  onChange={(durationFontFamily) => updateTaskStyle(item.id, { durationFontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.durationFontSize}
                  onChange={(durationFontSize) => updateTaskStyle(item.id, { durationFontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U + Alignment */}
          <div className="flex gap-1">
            <button
              onClick={() => updateTaskStyle(item.id, { durationFontWeight: style.durationFontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.durationFontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { durationFontStyle: style.durationFontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.durationFontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { durationTextDecoration: style.durationTextDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.durationTextDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
            {/* Alignment buttons — only shown for center/above/below positions */}
            {(style.durationLabelPosition === 'center' || style.durationLabelPosition === 'above' || style.durationLabelPosition === 'below') && (
              <>
                {/* Separator */}
                <div className="w-px h-6 bg-[var(--color-border)] mx-1 self-center" />
                {/* Text align buttons */}
                <button
                  onClick={() => updateTaskStyle(item.id, { durationTextAlign: 'left' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.durationTextAlign === 'left'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align left"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={2} y1={6} x2={9} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={2} y1={12} x2={9} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { durationTextAlign: 'center' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.durationTextAlign === 'center'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align center"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={3.5} y1={6} x2={10.5} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={3.5} y1={12} x2={10.5} y2={12} />
                  </svg>
                </button>
                <button
                  onClick={() => updateTaskStyle(item.id, { durationTextAlign: 'right' })}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    style.durationTextAlign === 'right'
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                  title="Align right"
                >
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <line x1={2} y1={3} x2={12} y2={3} />
                    <line x1={5} y1={6} x2={12} y2={6} />
                    <line x1={2} y1={9} x2={12} y2={9} />
                    <line x1={5} y1={12} x2={12} y2={12} />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Row 3: Format */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Format
            </label>
            <DurationFormatDropdown
              value={style.durationFormat}
              onChange={(durationFormat) => updateTaskStyle(item.id, { durationFormat })}
            />
          </div>

          {/* Row 4: Position (5 icons, no Far Left) */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Position
            </label>
            <div className="flex gap-1">
              {SECONDARY_LABEL_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateTaskStyle(item.id, { durationLabelPosition: pos.id })}
                  className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                    style.durationLabelPosition === pos.id
                      ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  title={pos.label}
                >
                  <PositionIcon position={pos.id} />
                </button>
              ))}
            </div>
          </div>

          {/* Row 5: Apply to all tasks */}
          <TaskDurationApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Task % complete"
        expanded={stylePaneSection === 'percentComplete'}
        onToggleExpand={() => handleToggleExpand('percentComplete')}
        toggle={{ checked: style.showPercentComplete, onChange: (v) => updateTaskStyle(item.id, { showPercentComplete: v }) }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.pctFontColor}
                onChange={(pctFontColor) => updateTaskStyle(item.id, { pctFontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.pctFontFamily}
                  onChange={(pctFontFamily) => updateTaskStyle(item.id, { pctFontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.pctFontSize}
                  onChange={(pctFontSize) => updateTaskStyle(item.id, { pctFontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U */}
          <div className="flex gap-1">
            <button
              onClick={() => updateTaskStyle(item.id, { pctFontWeight: style.pctFontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.pctFontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { pctFontStyle: style.pctFontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.pctFontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateTaskStyle(item.id, { pctTextDecoration: style.pctTextDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.pctTextDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
          </div>

          {/* Row 3: Position (5 icons, no Far Left) */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Position
            </label>
            <div className="flex gap-1">
              {SECONDARY_LABEL_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateTaskStyle(item.id, { pctLabelPosition: pos.id })}
                  className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                    style.pctLabelPosition === pos.id
                      ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  title={pos.label}
                >
                  <PositionIcon position={pos.id} />
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Highlight color */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Highlight color
            </label>
            <AdvancedColorPicker
              value={style.pctHighlightColor}
              onChange={(pctHighlightColor) => updateTaskStyle(item.id, { pctHighlightColor })}
            />
          </div>

          {/* Row 5: Apply to all tasks */}
          <TaskPctApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Vertical connector"
        expanded={stylePaneSection === 'verticalConnector'}
        onToggleExpand={() => handleToggleExpand('verticalConnector')}
        toggle={{ checked: style.showVerticalConnector, onChange: (v) => updateTaskStyle(item.id, { showVerticalConnector: v }) }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Thickness */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.connectorColor}
                onChange={(connectorColor) => updateTaskStyle(item.id, { connectorColor })}
              />
            )}
            rightLabel="Thickness"
            right={(
              <ConnectorThicknessDropdown
                value={style.connectorThickness}
                onChange={(connectorThickness) => updateTaskStyle(item.id, { connectorThickness })}
              />
            )}
          />

          {/* Row 2: Apply to all tasks */}
          <ConnectorApplyToAll item={item} />
        </div>
      </CollapsibleRow>
    </div>
  );
}

// ─── Property Card (for Apply to All) ────────────────────────────────────────

function PropertyCard({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all flex-1"
      style={checked
        ? {
            borderColor: '#c7d8f8',
            background: 'linear-gradient(180deg, #eff5ff 0%, #e8f0ff 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.82)',
          }
        : {
            borderColor: '#d9e3ef',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
          }}
      onClick={() => onChange(!checked)}
    >
      <span className="text-[11px] font-medium text-[var(--color-text)]">{label}</span>
      <div className="flex items-center justify-center h-6">{children}</div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.checked); }}
        className="accent-[var(--color-text)] w-4 h-4 cursor-pointer"
      />
    </div>
  );
}

function InlineOverrideRow({
  label,
  enabled,
  onToggle,
  inlineControl,
  trailing,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  inlineControl?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 min-h-9">
      <span className="flex items-center gap-2 min-w-0 shrink-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="accent-[var(--color-text)] w-4 h-4 cursor-pointer shrink-0"
        />
        <span className="text-sm font-medium text-[var(--color-text)] whitespace-nowrap">{label}</span>
      </span>
      {inlineControl && (
        <div className="min-w-0 flex-1 flex justify-start">
          {inlineControl}
        </div>
      )}
      {trailing && (
        <div className="shrink-0 ml-auto">
          {trailing}
        </div>
      )}
    </label>
  );
}

// ─── Milestone Shape Dropdown ─────────────────────────────────────────────────

function MilestoneShapeDropdown({
  value,
  color,
  onChange,
}: {
  value: MilestoneIcon;
  color: string;
  onChange: (icon: MilestoneIcon) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right });
  };

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectedIcon = MILESTONE_ICON_OPTIONS.find((i) => i.id === value);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => { if (!open) updatePos(); setOpen(!open); }}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] transition-all border"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <MilestoneIconComponent icon={value} size={16} color={color} />
        <span className="flex-1 text-left font-medium">{selectedIcon?.label ?? value}</span>
        <ChevronDown size={12} className="text-[#607086]" />
      </button>

      {open && createPortal(
        <PopoverSurface
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-100%)',
            zIndex: 9999,
            padding: 10,
          }}
        >
          <OptionGridPicker
            options={MILESTONE_ICON_OPTIONS}
            value={value}
            onSelect={(next) => { onChange(next); setOpen(false); }}
            columns={6}
            tileSize={36}
            renderOption={(ic, selected) => (
              <MilestoneIconComponent icon={ic.id} size={18} color={selected ? '#1e293b' : '#475569'} />
            )}
          />
        </PopoverSurface>,
        document.body,
      )}
    </div>
  );
}

// ─── Milestone Size Presets ──────────────────────────────────────────────────

const MILESTONE_SIZE_PRESETS: { label: string; value: number }[] = [
  { label: 'S', value: 14 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
];

// ─── Milestone Style Controls ────────────────────────────────────────────────

function MilestoneStyleControls({
  item,
  updateMilestoneStyle,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number];
  updateMilestoneStyle: ReturnType<typeof useProjectStore.getState>['updateMilestoneStyle'];
}) {
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);

  const handleToggleExpand = (key: StylePaneSection) => {
    setStylePaneSection(stylePaneSection === key ? null : key);
  };

  const style = item.milestoneStyle;

  return (
    <div className="-mx-4 -mt-1">
      <CollapsibleRow
        label="Milestone shape"
        expanded={stylePaneSection === 'milestoneShape'}
        onToggleExpand={() => handleToggleExpand('milestoneShape')}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Shape */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.color}
                onChange={(color) => updateMilestoneStyle(item.id, { color })}
              />
            )}
            rightLabel="Shape"
            right={(
              <MilestoneShapeDropdown
                value={style.icon}
                color={style.color}
                onChange={(icon) => updateMilestoneStyle(item.id, { icon })}
              />
            )}
          />

          {/* Row 2: Size */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Size
            </label>
            <div className="flex items-center gap-1.5">
              {MILESTONE_SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => updateMilestoneStyle(item.id, { size: p.value })}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-all border ${
                    style.size === p.value
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
                   }`}
                   style={style.size === p.value
                     ? { borderColor: '#c7d8f8', background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }
                     : { borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}
                 >
                   {p.label}
                 </button>
               ))}
               <NumericStepper
                 axis="horizontal"
                 style={{ marginLeft: 4 }}
                 input={(
                   <input
                     type="number"
                     min={8}
                     max={48}
                     value={style.size}
                     onChange={(e) => updateMilestoneStyle(item.id, { size: Math.max(8, Math.min(48, parseInt(e.target.value) || 8)) })}
                     className="w-12 h-9 text-center text-sm text-[var(--color-text)] bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                   />
                 )}
                 valueDisplay={null}
                 onIncrement={() => updateMilestoneStyle(item.id, { size: Math.min(48, style.size + 1) })}
                 onDecrement={() => updateMilestoneStyle(item.id, { size: Math.max(8, style.size - 1) })}
               />
            </div>
          </div>

          {/* Row 3: Position (only if not in a swimlane) */}
          {item.swimlaneId === null && (
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Position
              </label>
              <div className="flex gap-1.5">
                {(['above', 'below'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => updateMilestoneStyle(item.id, { position: pos })}
                    className={`p-2 rounded-lg border transition-all ${
                      style.position === pos
                        ? ''
                        : ''
                    }`}
                    style={style.position === pos
                      ? { borderColor: '#c7d8f8', background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }
                      : { borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}
                    title={pos === 'above' ? 'Above timeline' : 'Below timeline'}
                  >
                    <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
                      {/* Timeline bar */}
                      <rect x={0} y={10} width={28} height={4} rx={1} fill="#d1d5db" />
                      {/* Diamond icon above or below */}
                      <path
                        d={pos === 'above'
                          ? 'M14 1 L18 5 L14 9 L10 5 Z'
                          : 'M14 15 L18 19 L14 23 L10 19 Z'
                        }
                        fill={style.color}
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apply to all milestones */}
          <MilestoneShapeApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Milestone title"
        expanded={stylePaneSection === 'milestoneTitle'}
        onToggleExpand={() => handleToggleExpand('milestoneTitle')}
        toggle={{
          checked: style.showTitle,
          onChange: (v) => updateMilestoneStyle(item.id, { showTitle: v }),
        }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.fontColor}
                onChange={(fontColor) => updateMilestoneStyle(item.id, { fontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.fontFamily}
                  onChange={(fontFamily) => updateMilestoneStyle(item.id, { fontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.fontSize}
                  onChange={(fontSize) => updateMilestoneStyle(item.id, { fontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => updateMilestoneStyle(item.id, { fontWeight: style.fontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.fontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateMilestoneStyle(item.id, { fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.fontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateMilestoneStyle(item.id, { textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.textDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
          </div>

          {/* Row 3: Position (only for swimlaned milestones) */}
          {item.swimlaneId !== null && (
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Position
              </label>
              <div className="flex gap-1">
                {MILESTONE_DATE_POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => updateMilestoneStyle(item.id, { labelPosition: pos.id })}
                    className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                      style.labelPosition === pos.id
                        ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title={pos.label}
                  >
                    <MilestonePositionIcon position={pos.id} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apply to all milestones */}
          <MilestoneTitleApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Milestone date"
        expanded={stylePaneSection === 'milestoneDate'}
        onToggleExpand={() => handleToggleExpand('milestoneDate')}
        toggle={{
          checked: style.showDate,
          onChange: (v) => updateMilestoneStyle(item.id, { showDate: v }),
        }}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={style.dateFontColor}
                onChange={(dateFontColor) => updateMilestoneStyle(item.id, { dateFontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={style.dateFontFamily}
                  onChange={(dateFontFamily) => updateMilestoneStyle(item.id, { dateFontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={style.dateFontSize}
                  onChange={(dateFontSize) => updateMilestoneStyle(item.id, { dateFontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => updateMilestoneStyle(item.id, { dateFontWeight: style.dateFontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                style.dateFontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateMilestoneStyle(item.id, { dateFontStyle: style.dateFontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                style.dateFontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateMilestoneStyle(item.id, { dateTextDecoration: style.dateTextDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                style.dateTextDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
          </div>

          {/* Row 3: Format */}
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Format
            </label>
            <DateFormatDropdown
              value={style.dateFormat as DateFormat}
              onChange={(dateFormat) => updateMilestoneStyle(item.id, { dateFormat })}
            />
          </div>

          {/* Row 4: Position (only for swimlaned milestones) */}
          {item.swimlaneId !== null && (
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Position
              </label>
              <div className="flex gap-1">
                {MILESTONE_DATE_POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => updateMilestoneStyle(item.id, { dateLabelPosition: pos.id })}
                    className={`flex items-center justify-center w-10 h-9 rounded border transition-colors ${
                      style.dateLabelPosition === pos.id
                        ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title={pos.label}
                  >
                    <MilestonePositionIcon position={pos.id} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apply to all milestones */}
          <MilestoneDateApplyToAll item={item} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Milestone connector"
        expanded={stylePaneSection === 'milestoneConnector'}
        onToggleExpand={() => handleToggleExpand('milestoneConnector')}
        toggle={{
          checked: style.showConnector,
          onChange: (v) => updateMilestoneStyle(item.id, { showConnector: v }),
        }}
      >
        <div className="text-xs text-[var(--color-text-muted)]">Connector controls coming soon</div>
      </CollapsibleRow>
    </div>
  );
}

// ─── Swimlane Style Controls ─────────────────────────────────────────────────

function SwimlaneStyleControls({
  swimlane,
  updateSwimlane,
}: {
  swimlane: ReturnType<typeof useProjectStore.getState>['swimlanes'][number];
  updateSwimlane: ReturnType<typeof useProjectStore.getState>['updateSwimlane'];
}) {
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);

  const handleToggleExpand = (key: StylePaneSection) => {
    setStylePaneSection(stylePaneSection === key ? null : key);
  };

  return (
    <div className="-mx-4 -mt-1">
      <CollapsibleRow
        label="Swimlane title"
        expanded={stylePaneSection === 'swimlaneTitle'}
        onToggleExpand={() => handleToggleExpand('swimlaneTitle')}
      >
        <div className="space-y-4">
          {/* Row 1: Color + Text */}
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker
                value={swimlane.titleFontColor}
                onChange={(titleFontColor) => updateSwimlane(swimlane.id, { titleFontColor })}
              />
            )}
            rightLabel="Text"
            right={(
              <div className="flex gap-1.5">
                <FontFamilyDropdown
                  value={swimlane.titleFontFamily}
                  onChange={(titleFontFamily) => updateSwimlane(swimlane.id, { titleFontFamily })}
                  fonts={FONT_FAMILIES}
                />
                <FontSizeDropdown
                  value={swimlane.titleFontSize}
                  onChange={(titleFontSize) => updateSwimlane(swimlane.id, { titleFontSize })}
                />
              </div>
            )}
          />

          {/* Row 2: B / I / U toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => updateSwimlane(swimlane.id, { titleFontWeight: swimlane.titleFontWeight >= 700 ? 400 : 700 })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                swimlane.titleFontWeight >= 700
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => updateSwimlane(swimlane.id, { titleFontStyle: swimlane.titleFontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
                swimlane.titleFontStyle === 'italic'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => updateSwimlane(swimlane.id, { titleTextDecoration: swimlane.titleTextDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
                swimlane.titleTextDecoration === 'underline'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Underline"
            >
              U
            </button>
          </div>

          {/* Apply to all swimlanes */}
          <SwimlaneTitleApplyToAll swimlane={swimlane} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Swimlane background"
        expanded={stylePaneSection === 'swimlaneBackground'}
        onToggleExpand={() => handleToggleExpand('swimlaneBackground')}
      >
        <div className="space-y-5">
          {/* ── Header sub-group ── */}
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-2">Header</div>
              <ColorTransparencyControl
                color={swimlane.headerColor}
                transparency={swimlane.headerTransparency}
                onColorChange={(headerColor) => updateSwimlane(swimlane.id, { headerColor })}
                onTransparencyChange={(headerTransparency) => updateSwimlane(swimlane.id, { headerTransparency })}
              />
            </div>

          {/* ── Body sub-group ── */}
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-2">Body</div>
              <ColorTransparencyControl
                color={swimlane.bodyColor}
                transparency={swimlane.bodyTransparency}
                onColorChange={(bodyColor) => updateSwimlane(swimlane.id, { bodyColor })}
                onTransparencyChange={(bodyTransparency) => updateSwimlane(swimlane.id, { bodyTransparency })}
              />
            </div>

          {/* ── Outline sub-group ── */}
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-2">Outline</div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                  Thickness
                </label>
                <OutlineThicknessDropdown
                  value={swimlane.outlineThickness}
                  onChange={(outlineThickness) => updateSwimlane(swimlane.id, { outlineThickness })}
                />
              </div>
              {swimlane.outlineThickness !== 'none' && (
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                    Color
                  </label>
                  <AdvancedColorPicker
                    value={swimlane.outlineColor}
                    onChange={(outlineColor) => updateSwimlane(swimlane.id, { outlineColor })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Apply to all swimlanes */}
          <SwimlaneBackgroundApplyToAll swimlane={swimlane} />
        </div>
      </CollapsibleRow>

      <CollapsibleRow
        label="Swimlane spacing"
        expanded={stylePaneSection === 'swimlaneSpacing'}
        onToggleExpand={() => handleToggleExpand('swimlaneSpacing')}
      >
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-2">
            Spacing
          </label>
          <SwimlaneSpacingSection />
        </div>
      </CollapsibleRow>
    </div>
  );
}

// ─── Timescale Tab Content ───────────────────────────────────────────────────

function TimescaleTabContent({
  timescale,
  updateTimescale,
}: {
  timescale: ReturnType<typeof useProjectStore.getState>['timescale'];
  updateTimescale: ReturnType<typeof useProjectStore.getState>['updateTimescale'];
}) {
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);
  const [tierSettingsOpen, setTierSettingsOpen] = useState(false);

  const handleToggleExpand = (key: StylePaneSection) => {
    setStylePaneSection(stylePaneSection === key ? null : key);
  };

  return (
    <div className="space-y-4">
      {/* Tier settings button */}
      <div className="px-4">
        <button
          onClick={() => setTierSettingsOpen(true)}
          className="flex items-center justify-center gap-2 w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors"
          style={{ borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          <Settings size={14} className="text-[var(--color-text-muted)]" />
          Tier settings
        </button>
      </div>

      {tierSettingsOpen && (
        <TierSettingsModal onClose={() => setTierSettingsOpen(false)} />
      )}

      {/* Collapsible rows */}
      <div className="-mx-4">
        {/* Scale */}
        <CollapsibleRow
          label="Scale"
          expanded={stylePaneSection === 'scale'}
          onToggleExpand={() => handleToggleExpand('scale')}
        >
          <ScaleSection />
        </CollapsibleRow>

        {/* Today marker */}
        <CollapsibleRow
          label="Today marker"
          expanded={stylePaneSection === 'todayMarker'}
          onToggleExpand={() => handleToggleExpand('todayMarker')}
          toggle={{ checked: timescale.showToday, onChange: (v) => updateTimescale({ showToday: v }) }}
        >
          <TodayMarkerSection />
        </CollapsibleRow>

        {/* Elapsed time */}
        <CollapsibleRow
          label="Elapsed time"
          expanded={stylePaneSection === 'elapsedTime'}
          onToggleExpand={() => handleToggleExpand('elapsedTime')}
          toggle={{ checked: timescale.showElapsedTime ?? false, onChange: (v) => updateTimescale({ showElapsedTime: v }) }}
        >
          <ElapsedTimeSection />
        </CollapsibleRow>

        {/* Left end cap */}
        <CollapsibleRow
          label="Left end cap"
          expanded={stylePaneSection === 'leftEndCap'}
          onToggleExpand={() => handleToggleExpand('leftEndCap')}
          toggle={{ checked: timescale.leftEndCap?.show ?? false, onChange: (v) => updateTimescale({ leftEndCap: { ...timescale.leftEndCap, show: v } }) }}
        >
          <EndCapSection side="left" />
        </CollapsibleRow>

        {/* Right end cap */}
        <CollapsibleRow
          label="Right end cap"
          expanded={stylePaneSection === 'rightEndCap'}
          onToggleExpand={() => handleToggleExpand('rightEndCap')}
          toggle={{ checked: timescale.rightEndCap?.show ?? false, onChange: (v) => updateTimescale({ rightEndCap: { ...timescale.rightEndCap, show: v } }) }}
        >
          <EndCapSection side="right" />
        </CollapsibleRow>
      </div>
    </div>
  );
}

// ─── Today Marker Section ───────────────────────────────────────────────────

function TodayMarkerSection() {
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);

  const position = timescale.todayPosition ?? 'below';
  const autoAdjusted = timescale.todayAutoAdjusted ?? false;

  return (
    <div className="space-y-4">
      {/* Color */}
      <div>
        <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
          Color
        </label>
        <AdvancedColorPicker
          value={timescale.todayColor}
          onChange={(todayColor) => updateTimescale({ todayColor })}
        />
      </div>

      {/* Position */}
      <div>
        <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
          Position
        </label>
        <div className="flex items-center gap-1">
          {/* Below timescale */}
          <button
            onClick={() => updateTimescale({ todayPosition: 'below' })}
            className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
              position === 'below'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Below timescale"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="12" height="3" rx="0.5" fill={position === 'below' ? '#334155' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="5" x2="8" y2="14" stroke={position === 'below' ? '#334155' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 11.5L8 14L10.5 11.5" stroke={position === 'below' ? '#334155' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Above timescale */}
          <button
            onClick={() => updateTimescale({ todayPosition: 'above' })}
            className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
              position === 'above'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Above timescale"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="11" width="12" height="3" rx="0.5" fill={position === 'above' ? '#334155' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="11" x2="8" y2="2" stroke={position === 'above' ? '#334155' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 4.5L8 2L10.5 4.5" stroke={position === 'above' ? '#334155' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Auto-adjust button */}
          <button
            onClick={() => updateTimescale({ todayAutoAdjusted: true })}
            disabled={autoAdjusted}
            className={`ml-1 px-3 h-9 rounded border text-xs font-medium transition-colors ${
              autoAdjusted
                ? 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)]'
                : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {autoAdjusted ? 'Auto-adjusted' : 'Auto-adjust'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Elapsed Time Section ───────────────────────────────────────────────────

const ELAPSED_THICKNESS_OPTIONS: { id: ElapsedTimeThickness; label: string }[] = [
  { id: 'thin', label: 'Thin' },
  { id: 'thick', label: 'Thick' },
];

function ElapsedTimeSection() {
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);

  const color = timescale.elapsedTimeColor ?? '#ef4444';
  const thickness = timescale.elapsedTimeThickness ?? 'thin';
  const position = timescale.todayPosition ?? 'below';
  const autoAdjusted = timescale.todayAutoAdjusted ?? false;

  const handlePositionChange = (pos: 'above' | 'below') => {
    // Sync position with today marker
    updateTimescale({ todayPosition: pos });
  };

  return (
    <div className="space-y-4">
      {/* Row: Color + Thickness */}
      <LabeledFieldPair
        leftLabel="Color"
        left={(
          <AdvancedColorPicker
            value={color}
            onChange={(elapsedTimeColor) => updateTimescale({ elapsedTimeColor })}
          />
        )}
        rightLabel="Thickness"
        right={(
          <div className="relative">
            <select
              value={thickness}
              onChange={(e) => updateTimescale({ elapsedTimeThickness: e.target.value as ElapsedTimeThickness })}
              className="w-full h-9 pl-3 pr-8 rounded-lg border text-sm text-[var(--color-text)] appearance-none cursor-pointer transition-colors"
              style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              {ELAPSED_THICKNESS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        )}
      />

      {/* Position */}
      <div>
        <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
          Position
        </label>
        <div className="flex items-center gap-1">
          {/* Below timescale */}
          <button
            onClick={() => handlePositionChange('below')}
            className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
              position === 'below'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Below timescale"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="12" height="3" rx="0.5" fill={position === 'below' ? '#334155' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="5" x2="8" y2="14" stroke={position === 'below' ? '#334155' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 11.5L8 14L10.5 11.5" stroke={position === 'below' ? '#334155' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Above timescale */}
          <button
            onClick={() => handlePositionChange('above')}
            className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
              position === 'above'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Above timescale"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="11" width="12" height="3" rx="0.5" fill={position === 'above' ? '#334155' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="11" x2="8" y2="2" stroke={position === 'above' ? '#334155' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 4.5L8 2L10.5 4.5" stroke={position === 'above' ? '#334155' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Auto-adjust button */}
          <button
            onClick={() => updateTimescale({ todayAutoAdjusted: true })}
            disabled={autoAdjusted}
            className={`ml-1 px-3 h-9 rounded border text-xs font-medium transition-colors ${
              autoAdjusted
                ? 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)]'
                : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {autoAdjusted ? 'Auto-adjusted' : 'Auto-adjust'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── End Cap Section (shared for left/right) ────────────────────────────────

function EndCapSection({ side }: { side: 'left' | 'right' }) {
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);

  const cap = side === 'left' ? timescale.leftEndCap : timescale.rightEndCap;
  const updateCap = (updates: Partial<EndCapConfig>) => {
    if (side === 'left') {
      updateTimescale({ leftEndCap: { ...timescale.leftEndCap, ...updates } });
    } else {
      updateTimescale({ rightEndCap: { ...timescale.rightEndCap, ...updates } });
    }
  };

  return (
    <div className="space-y-3">
      {/* Row: Color + Font family + Font size */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Color
          </label>
          <AdvancedColorPicker
            value={cap.fontColor}
            onChange={(fontColor) => updateCap({ fontColor })}
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Text
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <FontFamilyDropdown
                value={cap.fontFamily}
                onChange={(fontFamily) => updateCap({ fontFamily })}
                fonts={FONT_FAMILIES}
              />
            </div>
            <div className="w-16">
              <FontSizeDropdown
                value={cap.fontSize}
                onChange={(fontSize) => updateCap({ fontSize })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* B / I / U toggles */}
      <div className="flex gap-1">
        <button
          onClick={() => updateCap({ fontWeight: cap.fontWeight >= 700 ? 400 : 700 })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
            cap.fontWeight >= 700
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => updateCap({ fontStyle: cap.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
            cap.fontStyle === 'italic'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Italic"
        >
          I
        </button>
        <button
          onClick={() => updateCap({ textDecoration: cap.textDecoration === 'underline' ? 'none' : 'underline' })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
            cap.textDecoration === 'underline'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Underline"
        >
          U
        </button>
      </div>
    </div>
  );
}

// ─── Timescale Bar Shape Dropdown ────────────────────────────────────────────

// Map timescale bar shapes to task bar shape IDs for icon rendering
const TIMESCALE_TO_BAR_SHAPE: Record<TimescaleBarShape, import('@/types').BarShape> = {
  rectangle: 'square',
  rounded: 'rounded',
  leaf: 'notched',
  ellipse: 'capsule',
  modern: 'arrow-both',
  slant: 'square', // backward compat fallback
};

const TIMESCALE_BAR_SHAPES: { id: TimescaleBarShape; label: string }[] = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded', label: 'Rounded rectangle' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'modern', label: 'Modern' },
];

const TIMESCALE_ICON_COLOR = '#475569';

function TimescaleBarShapeDropdown({ value, onChange }: { value: TimescaleBarShape; onChange: (v: TimescaleBarShape) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const selected = TIMESCALE_BAR_SHAPES.find((s) => s.id === value) ?? TIMESCALE_BAR_SHAPES[0];

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open) updatePos();
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 rounded-lg border transition-all text-[var(--color-text)] w-full"
        style={{ height: 32, fontSize: 13, borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <ShapePreview shape={TIMESCALE_TO_BAR_SHAPE[value]} color={TIMESCALE_ICON_COLOR} width={14} height={8} />
        <span className="flex-1 text-left font-medium">{selected.label}</span>
        <ChevronDown size={11} className="text-[#607086] shrink-0" />
      </button>
      {open && createPortal(
        <PopoverSurface
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            padding: 10,
          }}
        >
          <OptionGridPicker
            options={TIMESCALE_BAR_SHAPES}
            value={value}
            onSelect={(next) => { onChange(next); setOpen(false); }}
            columns={5}
            renderOption={(s, selected) => (
              <ShapePreview shape={TIMESCALE_TO_BAR_SHAPE[s.id]} color={selected ? '#1e293b' : TIMESCALE_ICON_COLOR} width={19} height={10} />
            )}
          />
        </PopoverSurface>,
        document.body,
      )}
    </div>
  );
}

// ─── Scale Section ───────────────────────────────────────────────────────────

function ScaleSection() {
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);
  const updateTier = useProjectStore((s) => s.updateTier);
  const selectedTierIndex = useProjectStore((s) => s.selectedTierIndex);

  const visibleTiers = timescale.tiers.filter((t) => t.visible);
  const visibleCount = visibleTiers.length;

  // Determine which tier to edit: use selectedTierIndex if valid & visible, else first visible tier's store index
  const activeTierStoreIndex = (() => {
    if (selectedTierIndex !== null && selectedTierIndex < timescale.tiers.length && timescale.tiers[selectedTierIndex].visible) {
      return selectedTierIndex;
    }
    // Fall back to first visible tier
    return timescale.tiers.findIndex((t) => t.visible);
  })();

  const tier = activeTierStoreIndex >= 0 ? timescale.tiers[activeTierStoreIndex] : null;

  // Tier label for multi-tier indicator
  const TIER_NAMES = ['Top tier', 'Middle tier', 'Bottom tier'];
  const activeTierName = activeTierStoreIndex >= 0 && activeTierStoreIndex < TIER_NAMES.length ? TIER_NAMES[activeTierStoreIndex] : '';

  const formatOptions = tier ? getFormatOptionsForUnit(tier.unit) : [];

  if (!tier) {
    return (
      <div className="text-xs text-[var(--color-text-muted)] py-2">
        No visible tiers. Open Tier settings to enable tiers.
      </div>
    );
  }

  const handleUnitChange = (newUnit: string) => {
    updateTier(activeTierStoreIndex, {
      unit: newUnit as TimescaleTierConfig['unit'],
      format: getDefaultFormatForUnit(newUnit as TimescaleTierConfig['unit']),
    });
  };

  return (
    <div className="space-y-4">
      {/* Multi-tier indicator */}
      {visibleCount > 1 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] border" style={{ borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}>
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Editing <span className="font-semibold text-[var(--color-text)]">{activeTierName}</span> — click a tier row on the timeline to switch
          </span>
        </div>
      )}

      {/* Units */}
      <div>
        <label className="text-xs font-semibold text-[var(--color-text)] block mb-2">Units</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Unit type
            </label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-slate-700 transition-colors"
              style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
              value={tier.unit}
              onChange={(e) => handleUnitChange(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="day">Days</option>
              <option value="week">Weeks</option>
              <option value="month">Months</option>
              <option value="quarter">Quarters</option>
              <option value="year">Years</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Format
            </label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-slate-700 transition-colors"
              style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
              value={tier.format}
              onChange={(e) => updateTier(activeTierStoreIndex, { format: e.target.value as TierFormat })}
            >
              {formatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Separators checkbox */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
        <input
          type="checkbox"
          checked={tier.separators}
          onChange={(e) => updateTier(activeTierStoreIndex, { separators: e.target.checked })}
          className="accent-slate-700 w-4 h-4"
        />
        <span className="font-medium">Separators</span>
      </label>

      {/* Color + Text (font family + font size) */}
      <LabeledFieldPair
        leftLabel="Color"
        left={(
          <AdvancedColorPicker value={tier.fontColor} onChange={(c) => updateTier(activeTierStoreIndex, { fontColor: c })} />
        )}
        rightLabel="Text"
        right={(
          <div className="flex gap-1.5">
            <FontFamilyDropdown value={tier.fontFamily} onChange={(f) => updateTier(activeTierStoreIndex, { fontFamily: f })} fonts={FONT_FAMILIES} />
            <FontSizeDropdown value={tier.fontSize} onChange={(s) => updateTier(activeTierStoreIndex, { fontSize: s, fontSizeAuto: false })} />
          </div>
        )}
      />

      {/* B / I / U + Alignment */}
      <div className="flex gap-1">
        <button
          onClick={() => updateTier(activeTierStoreIndex, { fontWeight: tier.fontWeight >= 700 ? 400 : 700 })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
            tier.fontWeight >= 700
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => updateTier(activeTierStoreIndex, { fontStyle: tier.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm italic transition-colors ${
            tier.fontStyle === 'italic'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Italic"
        >
          I
        </button>
        <button
          onClick={() => updateTier(activeTierStoreIndex, { textDecoration: tier.textDecoration === 'underline' ? 'none' : 'underline' })}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors ${
            tier.textDecoration === 'underline'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Underline"
        >
          U
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-[var(--color-border)] mx-1 self-center" />

        {/* Text align buttons */}
        <button
          onClick={() => updateTier(activeTierStoreIndex, { textAlign: 'left' })}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            tier.textAlign === 'left'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Align left"
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line x1={2} y1={3} x2={12} y2={3} />
            <line x1={2} y1={6} x2={9} y2={6} />
            <line x1={2} y1={9} x2={12} y2={9} />
            <line x1={2} y1={12} x2={9} y2={12} />
          </svg>
        </button>
        <button
          onClick={() => updateTier(activeTierStoreIndex, { textAlign: 'center' })}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            tier.textAlign === 'center'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Align center"
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line x1={2} y1={3} x2={12} y2={3} />
            <line x1={3.5} y1={6} x2={10.5} y2={6} />
            <line x1={2} y1={9} x2={12} y2={9} />
            <line x1={3.5} y1={12} x2={10.5} y2={12} />
          </svg>
        </button>
        <button
          onClick={() => updateTier(activeTierStoreIndex, { textAlign: 'right' })}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            tier.textAlign === 'right'
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
          title="Align right"
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line x1={2} y1={3} x2={12} y2={3} />
            <line x1={5} y1={6} x2={12} y2={6} />
            <line x1={2} y1={9} x2={12} y2={9} />
            <line x1={5} y1={12} x2={12} y2={12} />
          </svg>
        </button>
      </div>

      {/* Bar style — only shown when single tier */}
      {visibleCount === 1 && (
        <div>
          <label className="text-xs font-semibold text-[var(--color-text)] block mb-2">Bar style</label>
          <LabeledFieldPair
            leftLabel="Color"
            left={(
              <AdvancedColorPicker value={tier.backgroundColor} onChange={(c) => updateTier(activeTierStoreIndex, { backgroundColor: c })} />
            )}
            rightLabel="Shape"
            right={(
              <TimescaleBarShapeDropdown
                value={timescale.barShape}
                onChange={(s) => updateTimescale({ barShape: s })}
              />
            )}
          />
        </div>
      )}

      {/* Bar color — shown when multi-tier (shape hidden, but color still useful) */}
      {visibleCount > 1 && (
        <div>
          <label className="text-xs font-semibold text-[var(--color-text)] block mb-2">Bar color</label>
          <AdvancedColorPicker value={tier.backgroundColor} onChange={(c) => updateTier(activeTierStoreIndex, { backgroundColor: c })} />
        </div>
      )}
    </div>
  );
}

// ─── Tier Settings Modal ─────────────────────────────────────────────────────

const DEFAULT_3_TIERS: TimescaleTierConfig[] = [
  { unit: 'month', format: 'MMM', visible: true, backgroundColor: '#6b7f5c', fontColor: '#f8fafc', fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
  { unit: 'week', format: 'w_num', visible: false, backgroundColor: '#94a3b8', fontColor: '#f8fafc', fontSize: 11, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
  { unit: 'day', format: 'd_num', visible: false, backgroundColor: '#94a3b8', fontColor: '#f8fafc', fontSize: 11, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
];

const TIER_LABELS = ['Top tier', 'Middle tier', 'Bottom tier'];

function TierSettingsModal({ onClose }: { onClose: () => void }) {
  const items = useProjectStore((s) => s.items);
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);

  // Local draft state — initialize from store tiers, padded to 3
  const [tiers, setTiers] = useState<TimescaleTierConfig[]>(() => {
    const stored = timescale.tiers;
    return [
      stored[0] ?? DEFAULT_3_TIERS[0],
      stored[1] ?? DEFAULT_3_TIERS[1],
      stored[2] ?? DEFAULT_3_TIERS[2],
    ];
  });

  const updateTierDraft = (idx: number, updates: Partial<TimescaleTierConfig>) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };

  // Project range — same padded computation as main TimelineView
  const { origin, totalDays, rangeEndDate } = useMemo(
    () => getProjectRangePadded(items, timescale),
    [items, timescale],
  );

  // Today position as fraction (0-1)
  const todayFraction = useMemo(() => {
    const today = new Date();
    const frac = differenceInDays(today, parseISO(origin)) / totalDays;
    return Math.max(0, Math.min(1, frac));
  }, [origin, totalDays]);
  const todayPos = timescale.todayPosition ?? 'below';

  const visibleTiers = useMemo(() => tiers.filter((t) => t.visible), [tiers]);
  const visibleCount = visibleTiers.length;

  // Generate labels using shared buildVisibleTierCells utility
  const previewTierLabels = useMemo(() => {
    const originDate = parseISO(origin);
    const BAR_WIDTH_PX = 920;

    return visibleTiers.map((tier) => {
      const resolvedUnit = tier.unit === 'auto' ? resolveAutoUnit(totalDays) : tier.unit;
      const resolvedFormat = tier.unit === 'auto' ? undefined : tier.format;
      const labels = generateTierLabels(resolvedUnit, originDate, rangeEndDate, timescale.fiscalYearStartMonth, resolvedFormat);
      const cells = buildVisibleTierCells(labels, resolvedUnit, originDate, totalDays, BAR_WIDTH_PX);
      return { tier: { ...tier, unit: resolvedUnit }, cells };
    });
  }, [visibleTiers, origin, totalDays, rangeEndDate, timescale.fiscalYearStartMonth]);

  const handleSave = () => {
    updateTimescale({ tiers: tiers });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40">
      <ModalSurface className="w-full max-w-[1100px] mt-12 mx-4 flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Tier settings</h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Timescale preview — mirrors main TimelineView rendering */}
          {visibleCount > 0 && (
            <div className="relative mx-16" style={timescale.showToday ? (todayPos === 'below' ? { marginBottom: 22 } : { marginTop: 22 }) : undefined}>
              {/* Left end cap — conditional on config, uses config styling */}
              {timescale.leftEndCap?.show && (
                <div
                  className="absolute whitespace-nowrap"
                  style={{
                    right: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    paddingRight: 8,
                    color: timescale.leftEndCap.fontColor,
                    fontFamily: timescale.leftEndCap.fontFamily,
                    fontSize: Math.min(timescale.leftEndCap.fontSize, 16),
                    fontWeight: timescale.leftEndCap.fontWeight,
                    fontStyle: timescale.leftEndCap.fontStyle,
                    textDecoration: timescale.leftEndCap.textDecoration,
                  }}
                >
                  {format(parseISO(origin), 'yyyy')}
                </div>
              )}

              {/* Bar — uses timescale.barShape */}
              <div className="relative">
                <div className="border-b border-[var(--color-border)] overflow-hidden relative" style={getTimescaleBarShapeStyle(timescale.barShape)}>
                  {previewTierLabels.map(({ tier, cells }, tierIdx) => {
                    // Compute cell width for auto font sizing (preview uses percentage-based layout)
                    const previewBarWidth = 920; // matches BAR_WIDTH_PX used in previewTierLabels
                    let repFrac = 0;
                    for (const cell of cells) { if (cell.widthFrac > repFrac) repFrac = cell.widthFrac; }
                    const cellWidthPx = repFrac * previewBarWidth;
                    const effectiveFontSize = (tier.fontSizeAuto ?? true)
                      ? Math.min(computeAutoFontSize(cells, tier.fontFamily, tier.fontWeight, tier.fontStyle, cellWidthPx, 12), 12)
                      : Math.min(tier.fontSize, 12);

                    return (
                    <div
                      key={tierIdx}
                      className="relative"
                      style={{ backgroundColor: tier.backgroundColor, height: 28 }}
                    >
                      {cells.map((cell, ci) => (
                        <div
                          key={ci}
                          className={`absolute top-0 h-full flex items-center ${tier.separators && ci > 0 ? 'border-l border-white/20' : ''}`}
                          style={{
                            left: `${cell.fraction * 100}%`,
                            width: `${cell.widthFrac * 100}%`,
                            color: tier.fontColor,
                            fontSize: effectiveFontSize,
                            fontFamily: tier.fontFamily,
                            fontWeight: tier.fontWeight,
                            fontStyle: tier.fontStyle,
                            textDecoration: tier.textDecoration,
                            justifyContent: 'flex-start',
                            paddingLeft: ci === 0 ? 8 : 4,
                            paddingRight: ci === cells.length - 1 ? 8 : 4,
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap' }}>{cell.label}</span>
                        </div>
                      ))}
                    </div>
                    );
                  })}

                  {/* Elapsed time bar — colored strip from left to today */}
                  {(timescale.showElapsedTime ?? false) && todayFraction > 0 && (
                    <div
                      className="absolute left-0 pointer-events-none z-10"
                      style={{
                        width: `${Math.min(todayFraction, 1) * 100}%`,
                        height: (timescale.elapsedTimeThickness ?? 'thin') === 'thick' ? 6 : 3,
                        backgroundColor: timescale.elapsedTimeColor ?? '#ef4444',
                        ...(todayPos === 'above' ? { top: 0 } : { bottom: 0 }),
                      }}
                    />
                  )}
                </div>

                {/* Today label — gated on showToday, respects todayPosition */}
                {timescale.showToday && todayFraction > 0 && todayFraction < 1 && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{
                      left: `${todayFraction * 100}%`,
                      transform: 'translateX(-50%)',
                      ...(todayPos === 'above'
                        ? { bottom: '100%' }
                        : { top: '100%' }
                      ),
                    }}
                  >
                    <div className="flex flex-col items-center">
                      {todayPos === 'below' && (
                        <svg width="10" height="6" viewBox="0 0 10 6">
                          <path d="M5 0L0 6h10L5 0z" fill={timescale.todayColor} />
                        </svg>
                      )}
                      <div className="border border-[var(--color-border)] bg-white rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text)] whitespace-nowrap leading-tight">
                        Today
                      </div>
                      {todayPos === 'above' && (
                        <svg width="10" height="6" viewBox="0 0 10 6">
                          <path d="M5 6L0 0h10L5 6z" fill={timescale.todayColor} />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right end cap — conditional on config, uses config styling */}
              {timescale.rightEndCap?.show && (
                <div
                  className="absolute whitespace-nowrap"
                  style={{
                    left: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    paddingLeft: 8,
                    color: timescale.rightEndCap.fontColor,
                    fontFamily: timescale.rightEndCap.fontFamily,
                    fontSize: Math.min(timescale.rightEndCap.fontSize, 16),
                    fontWeight: timescale.rightEndCap.fontWeight,
                    fontStyle: timescale.rightEndCap.fontStyle,
                    textDecoration: timescale.rightEndCap.textDecoration,
                  }}
                >
                  {format(rangeEndDate, 'yyyy')}
                </div>
              )}
            </div>
          )}

          {/* 3 tier columns */}
          <div className="grid grid-cols-3 gap-6">
            {tiers.map((tier, idx) => (
              <TierColumn
                key={idx}
                label={TIER_LABELS[idx]}
                tier={tier}
                updateTier={(updates) => updateTierDraft(idx, updates)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-[var(--color-border)]">
          <DialogButton onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-medium">
            Cancel
          </DialogButton>
          <DialogButton
            tone="primary"
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }}
          >
            Save
          </DialogButton>
        </div>
      </ModalSurface>
    </div>,
    document.body
  );
}

// ─── Tier Column ─────────────────────────────────────────────────────────────

function TierColumn({
  label,
  tier,
  updateTier,
}: {
  label: string;
  tier: TimescaleTierConfig;
  updateTier: (updates: Partial<TimescaleTierConfig>) => void;
}) {
  const formatOptions = getFormatOptionsForUnit(tier.unit);

  return (
    <div
      className={`space-y-4 rounded-lg border border-[var(--color-border)] p-4 ${
        !tier.visible ? 'bg-[var(--color-bg-secondary)]' : ''
      }`}
    >
      {/* Header: label + Show toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">Show</span>
          <ToggleSwitch checked={tier.visible} onChange={(v) => updateTier({ visible: v })} />
        </div>
      </div>

      {/* Controls — greyed out when toggle is off */}
      <div
        className="space-y-4"
        style={!tier.visible ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
      >
        {/* Units */}
        <div>
          <label className="text-xs font-medium text-[var(--color-text)] block mb-1.5">Units</label>
          <div className="flex gap-1.5">
            <select
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text)] outline-none"
              style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
              value={tier.unit}
              onChange={(e) => {
                const newUnit = e.target.value as TimescaleTierConfig['unit'];
                updateTier({ unit: newUnit, format: getDefaultFormatForUnit(newUnit) });
              }}
            >
              <option value="auto">Auto</option>
              <option value="day">Days</option>
              <option value="week">Weeks</option>
              <option value="month">Months</option>
              <option value="quarter">Quarters</option>
              <option value="year">Years</option>
            </select>
            <select
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text)] outline-none"
              style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
              value={tier.format}
              onChange={(e) => updateTier({ format: e.target.value as TierFormat })}
            >
              {formatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Separators */}
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={tier.separators}
            onChange={(e) => updateTier({ separators: e.target.checked })}
            className="accent-blue-500 w-4 h-4"
          />
          <span className="font-medium">Separators</span>
        </label>

        {/* Color + Text */}
        <div className="flex gap-2">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Color
            </label>
            <AdvancedColorPicker value={tier.fontColor} onChange={(fontColor) => updateTier({ fontColor })} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
              Text
            </label>
            <div className="flex gap-1">
              <FontFamilyDropdown value={tier.fontFamily} onChange={(fontFamily) => updateTier({ fontFamily })} fonts={FONT_FAMILIES} />
              <FontSizeDropdown value={tier.fontSize} onChange={(fontSize) => updateTier({ fontSize, fontSizeAuto: false })} />
            </div>
          </div>
        </div>

        {/* B / I / U + Alignment */}
        <div className="flex gap-1">
          <button
            onClick={() => updateTier({ fontWeight: tier.fontWeight >= 700 ? 400 : 700 })}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${
              tier.fontWeight >= 700
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => updateTier({ fontStyle: tier.fontStyle === 'italic' ? 'normal' : 'italic' })}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs italic transition-colors ${
              tier.fontStyle === 'italic'
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => updateTier({ textDecoration: tier.textDecoration === 'underline' ? 'none' : 'underline' })}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs underline transition-colors ${
              tier.textDecoration === 'underline'
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Underline"
          >
            U
          </button>
          <div className="w-px h-5 bg-[var(--color-border)] mx-0.5 self-center" />
          <button
            onClick={() => updateTier({ textAlign: 'left' })}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              tier.textAlign === 'left'
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Align left"
          >
            <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <line x1={2} y1={3} x2={12} y2={3} />
              <line x1={2} y1={6} x2={9} y2={6} />
              <line x1={2} y1={9} x2={12} y2={9} />
              <line x1={2} y1={12} x2={9} y2={12} />
            </svg>
          </button>
          <button
            onClick={() => updateTier({ textAlign: 'center' })}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              tier.textAlign === 'center'
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Align center"
          >
            <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <line x1={2} y1={3} x2={12} y2={3} />
              <line x1={3.5} y1={6} x2={10.5} y2={6} />
              <line x1={2} y1={9} x2={12} y2={9} />
              <line x1={3.5} y1={12} x2={10.5} y2={12} />
            </svg>
          </button>
          <button
            onClick={() => updateTier({ textAlign: 'right' })}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              tier.textAlign === 'right'
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title="Align right"
          >
            <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <line x1={2} y1={3} x2={12} y2={3} />
              <line x1={5} y1={6} x2={12} y2={6} />
              <line x1={2} y1={9} x2={12} y2={9} />
              <line x1={5} y1={12} x2={12} y2={12} />
            </svg>
          </button>
        </div>

        {/* Bar color */}
        <div>
          <label className="text-xs font-medium text-[var(--color-text)] block mb-1.5">Bar color</label>
          <AdvancedColorPicker
            value={tier.backgroundColor}
            onChange={(backgroundColor) => updateTier({ backgroundColor })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Position Icon (SVG icons for label position) ───────────────────────────

function PositionIcon({ position }: { position: LabelPosition }) {
  const bar = '#9ca3af';  // gray-400
  const tk = '#334155';   // slate-800
  // All icons: 28x20 viewBox, shapeRendering crispEdges for sharp lines
  switch (position) {
    case 'far-left':
      // Arrow pointing left + dashed line, then vertical separator, then bar
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          {/* Left arrow with dashes */}
          <path d="M5 10 L9 7 L9 13 Z" fill={tk} shapeRendering="geometricPrecision" />
          <line x1={9} y1={10} x2={12} y2={10} stroke={tk} strokeWidth={1} strokeDasharray="2 1" />
          {/* Vertical separator */}
          <line x1={14} y1={4} x2={14} y2={16} stroke={tk} strokeWidth={1} />
          {/* Bar */}
          <rect x={16} y={6} width={10} height={8} rx={1} fill={bar} shapeRendering="geometricPrecision" />
        </svg>
      );
    case 'left':
      // "T" text, then vertical separator, then bar
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <text x={6} y={14.5} fontSize={11} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
          <line x1={13} y1={4} x2={13} y2={16} stroke={tk} strokeWidth={1} />
          <rect x={15} y={6} width={11} height={8} rx={1} fill={bar} shapeRendering="geometricPrecision" />
        </svg>
      );
    case 'center':
      // Horizontal lines above and below bar (like centered text indicator)
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <line x1={4} y1={4} x2={24} y2={4} stroke={tk} strokeWidth={1} />
          <rect x={5} y={7} width={18} height={6} rx={1} fill={bar} shapeRendering="geometricPrecision" />
          <line x1={4} y1={16} x2={24} y2={16} stroke={tk} strokeWidth={1} />
        </svg>
      );
    case 'right':
      // Bar, then vertical separator, then "T" text
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <rect x={2} y={6} width={11} height={8} rx={1} fill={bar} shapeRendering="geometricPrecision" />
          <line x1={15} y1={4} x2={15} y2={16} stroke={tk} strokeWidth={1} />
          <text x={22} y={14.5} fontSize={11} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
        </svg>
      );
    case 'above':
      // "T" text above a horizontal line, bar below
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <text x={14} y={8} fontSize={9} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
          <line x1={6} y1={10} x2={22} y2={10} stroke={tk} strokeWidth={1} />
          <rect x={6} y={12} width={16} height={6} rx={1} fill={bar} shapeRendering="geometricPrecision" />
        </svg>
      );
    case 'below':
      // Bar on top, horizontal line, then "T" text below
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <rect x={6} y={2} width={16} height={6} rx={1} fill={bar} shapeRendering="geometricPrecision" />
          <line x1={6} y1={10} x2={22} y2={10} stroke={tk} strokeWidth={1} />
          <text x={14} y={18.5} fontSize={9} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
        </svg>
      );
  }
}

// Milestone date position icons: "T" + diamond shape in 4 arrangements
function MilestonePositionIcon({ position }: { position: LabelPosition }) {
  const dia = '#9ca3af';  // gray-400 (diamond shape)
  const tk = '#334155';   // slate-800 (text "T")
  // Diamond path centered at (cx, cy) with radius r
  const diamond = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`;

  switch (position) {
    case 'above':
      // "T" on top, line, diamond below
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <text x={14} y={7} fontSize={9} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
          <line x1={7} y1={9} x2={21} y2={9} stroke={tk} strokeWidth={1} />
          <path d={diamond(14, 14.5, 4)} fill={dia} shapeRendering="geometricPrecision" />
        </svg>
      );
    case 'below':
      // Diamond on top, line, "T" below
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <path d={diamond(14, 5.5, 4)} fill={dia} shapeRendering="geometricPrecision" />
          <line x1={7} y1={11} x2={21} y2={11} stroke={tk} strokeWidth={1} />
          <text x={14} y={18.5} fontSize={9} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
        </svg>
      );
    case 'left':
      // "T" left, separator, diamond right
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <text x={7} y={14.5} fontSize={11} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
          <line x1={14} y1={4} x2={14} y2={16} stroke={tk} strokeWidth={1} />
          <path d={diamond(21, 10, 4.5)} fill={dia} shapeRendering="geometricPrecision" />
        </svg>
      );
    case 'right':
      // Diamond left, separator, "T" right
      return (
        <svg width={28} height={20} viewBox="0 0 28 20" fill="none" shapeRendering="crispEdges">
          <path d={diamond(7, 10, 4.5)} fill={dia} shapeRendering="geometricPrecision" />
          <line x1={14} y1={4} x2={14} y2={16} stroke={tk} strokeWidth={1} />
          <text x={21} y={14.5} fontSize={11} fontFamily="serif" fontWeight={600} fill={tk} textAnchor="middle" shapeRendering="geometricPrecision">T</text>
        </svg>
      );
    default:
      return null;
  }
}

// ─── Apply to All — Shared icon previews ─────────────────────────────────────

function ShowIcon() {
  return (
    <svg width={22} height={16} viewBox="0 0 22 16" fill="none">
      <ellipse cx={11} cy={8} rx={9} ry={6} stroke="currentColor" strokeWidth={1.5} fill="none" />
      <circle cx={11} cy={8} r={3} stroke="currentColor" strokeWidth={1.5} fill="none" />
      <circle cx={11} cy={8} r={1} fill="currentColor" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <path d="M4 4h10M9 4v10M6.5 14h5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function PositionIcon5Dot() {
  // 5-dot position icon (like the mockup shows)
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <circle cx={5} cy={5} r={1.5} fill="currentColor" />
      <circle cx={13} cy={5} r={1.5} fill="currentColor" />
      <circle cx={5} cy={13} r={1.5} fill="currentColor" />
      <circle cx={13} cy={13} r={1.5} fill="currentColor" />
      <circle cx={9} cy={9} r={1.5} fill="currentColor" />
    </svg>
  );
}

function FormatIcon() {
  return (
    <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">-/-</span>
  );
}

function SizeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <path d="M4 4L1 7M4 4L7 7M4 4V14M14 14L11 11M14 14L17 11M14 14V4" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpacingIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <path d="M4 2v14M14 2v14" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
      <line x1={6} y1={6} x2={12} y2={6} stroke="currentColor" strokeWidth={1.5} />
      <line x1={6} y1={9} x2={12} y2={9} stroke="currentColor" strokeWidth={1.5} />
      <line x1={6} y1={12} x2={12} y2={12} stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function ThicknessIcon() {
  return (
    <svg width={18} height={14} viewBox="0 0 18 14" fill="none">
      <line x1={2} y1={3} x2={16} y2={3} stroke="currentColor" strokeWidth={1.5} />
      <line x1={2} y1={7} x2={16} y2={7} stroke="currentColor" strokeWidth={2.5} />
      <line x1={2} y1={11} x2={16} y2={11} stroke="currentColor" strokeWidth={3.5} />
    </svg>
  );
}

// ─── Apply to All — Shared wrapper ───────────────────────────────────────────

type ItemType = ReturnType<typeof useProjectStore.getState>['items'][number];

function ApplyToAllBox({
  children,
  onApply,
  excludeSwimlanes,
  setExcludeSwimlanes,
  onlyInSwimlane,
  setOnlyInSwimlane,
  applied,
  label = 'Apply to all tasks',
}: {
  children: React.ReactNode;
  onApply: () => void;
  excludeSwimlanes?: boolean;
  setExcludeSwimlanes?: (v: boolean) => void;
  onlyInSwimlane?: boolean;
  setOnlyInSwimlane?: (v: boolean) => void;
  applied: boolean;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  useEffect(() => {
    if (expanded && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.top - 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [expanded]);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      <button
        ref={triggerRef}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-slate-800 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">{label}</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] rounded-xl p-3 space-y-3"
          style={{
            right: popoverPos.right,
            bottom: window.innerHeight - popoverPos.top,
            minWidth: 'max-content',
            background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)',
            border: '1px solid #d9e3ef',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div className="flex gap-2">
            {children}
          </div>

          <div className="flex items-center justify-between gap-4">
            {setExcludeSwimlanes != null ? (
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={excludeSwimlanes ?? false}
                  onChange={(e) => setExcludeSwimlanes(e.target.checked)}
                  className="accent-slate-700"
                />
                <span>Exclude swimlanes</span>
                <span title="Exclude items placed inside swimlanes">
                  <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
                </span>
              </label>
            ) : setOnlyInSwimlane != null ? (
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyInSwimlane ?? false}
                  onChange={(e) => setOnlyInSwimlane(e.target.checked)}
                  className="accent-slate-700"
                />
                <span>Only in this swimlane</span>
                <span title="Only apply to items in the same swimlane">
                  <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
                </span>
              </label>
            ) : (
              <div />
            )}

            <button
              onClick={onApply}
              className={`px-6 py-1.5 rounded-lg text-sm font-medium transition-all border whitespace-nowrap ${
                applied
                  ? 'bg-green-500/10 text-green-600 border-green-500/30'
                  : 'text-[var(--color-text)] hover:border-[var(--color-text-muted)]'
              }`}
              style={applied ? undefined : { background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderColor: '#c8d3df', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              {applied ? 'Applied!' : 'Apply'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Task Bar Apply to All ───────────────────────────────────────────────────

function TaskBarApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    color: true,
    barShape: true,
    thickness: true,
    spacing: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Color" checked={applyProps.color} onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.color }} />
      </PropertyCard>
      <PropertyCard label="Shape" checked={applyProps.barShape} onChange={(v) => setApplyProps((p) => ({ ...p, barShape: v }))}>
        <ShapePreview shape={style.barShape} color={style.color} width={28} height={10} />
      </PropertyCard>
      <PropertyCard label="Size" checked={applyProps.thickness} onChange={(v) => setApplyProps((p) => ({ ...p, thickness: v }))}>
        <SizeIcon />
      </PropertyCard>
      <PropertyCard label="Spacing" checked={applyProps.spacing} onChange={(v) => setApplyProps((p) => ({ ...p, spacing: v }))}>
        <SpacingIcon />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Task Title Apply to All ─────────────────────────────────────────────────

function TaskTitleApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    showTitle: true,
    fontColor: true,
    text: true,
    labelPosition: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showTitle) keys.push('showTitle');
    if (applyProps.fontColor) keys.push('fontColor');
    if (applyProps.text) keys.push('fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration');
    if (applyProps.labelPosition) keys.push('labelPosition', 'textAlign');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Show" checked={applyProps.showTitle} onChange={(v) => setApplyProps((p) => ({ ...p, showTitle: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.fontColor} onChange={(v) => setApplyProps((p) => ({ ...p, fontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.fontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      <PropertyCard label="Position" checked={applyProps.labelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, labelPosition: v }))}>
        <PositionIcon5Dot />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Task Date Apply to All ──────────────────────────────────────────────────

function TaskDateApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    showDate: true,
    dateFontColor: true,
    text: true,
    dateFormat: true,
    dateLabelPosition: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showDate) keys.push('showDate');
    if (applyProps.dateFontColor) keys.push('dateFontColor');
    if (applyProps.text) keys.push('dateFontFamily', 'dateFontSize', 'dateFontWeight', 'dateFontStyle', 'dateTextDecoration');
    if (applyProps.dateFormat) keys.push('dateFormat');
    if (applyProps.dateLabelPosition) keys.push('dateLabelPosition', 'dateTextAlign');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Show" checked={applyProps.showDate} onChange={(v) => setApplyProps((p) => ({ ...p, showDate: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.dateFontColor} onChange={(v) => setApplyProps((p) => ({ ...p, dateFontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.dateFontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      <PropertyCard label="Format" checked={applyProps.dateFormat} onChange={(v) => setApplyProps((p) => ({ ...p, dateFormat: v }))}>
        <FormatIcon />
      </PropertyCard>
      <PropertyCard label="Position" checked={applyProps.dateLabelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, dateLabelPosition: v }))}>
        <PositionIcon5Dot />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Task Duration Apply to All ──────────────────────────────────────────────

function TaskDurationApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    showDuration: true,
    durationFontColor: true,
    text: true,
    durationFormat: true,
    durationLabelPosition: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showDuration) keys.push('showDuration');
    if (applyProps.durationFontColor) keys.push('durationFontColor');
    if (applyProps.text) keys.push('durationFontFamily', 'durationFontSize', 'durationFontWeight', 'durationFontStyle', 'durationTextDecoration');
    if (applyProps.durationFormat) keys.push('durationFormat');
    if (applyProps.durationLabelPosition) keys.push('durationLabelPosition', 'durationTextAlign');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Show" checked={applyProps.showDuration} onChange={(v) => setApplyProps((p) => ({ ...p, showDuration: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.durationFontColor} onChange={(v) => setApplyProps((p) => ({ ...p, durationFontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.durationFontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      <PropertyCard label="Format" checked={applyProps.durationFormat} onChange={(v) => setApplyProps((p) => ({ ...p, durationFormat: v }))}>
        <FormatIcon />
      </PropertyCard>
      <PropertyCard label="Position" checked={applyProps.durationLabelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, durationLabelPosition: v }))}>
        <PositionIcon5Dot />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Task % Complete Apply to All ─────────────────────────────────────────────

function TaskPctApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    showPercentComplete: true,
    pctFontColor: true,
    text: true,
    pctLabelPosition: true,
    pctHighlightColor: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showPercentComplete) keys.push('showPercentComplete');
    if (applyProps.pctFontColor) keys.push('pctFontColor');
    if (applyProps.text) keys.push('pctFontFamily', 'pctFontSize', 'pctFontWeight', 'pctFontStyle', 'pctTextDecoration');
    if (applyProps.pctLabelPosition) keys.push('pctLabelPosition');
    if (applyProps.pctHighlightColor) keys.push('pctHighlightColor');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Show" checked={applyProps.showPercentComplete} onChange={(v) => setApplyProps((p) => ({ ...p, showPercentComplete: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.pctFontColor} onChange={(v) => setApplyProps((p) => ({ ...p, pctFontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.pctFontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      <PropertyCard label="Position" checked={applyProps.pctLabelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, pctLabelPosition: v }))}>
        <PositionIcon5Dot />
      </PropertyCard>
      <PropertyCard label="Highlight" checked={applyProps.pctHighlightColor} onChange={(v) => setApplyProps((p) => ({ ...p, pctHighlightColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.pctHighlightColor }} />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Connector Thickness Dropdown ─────────────────────────────────────────────

const CONNECTOR_THICKNESSES: { id: ConnectorThickness; label: string }[] = [
  { id: 'thin', label: 'Thin' },
  { id: 'medium', label: 'Medium' },
  { id: 'thick', label: 'Thick' },
];

function ConnectorThicknessDropdown({
  value,
  onChange,
}: {
  value: ConnectorThickness;
  onChange: (v: ConnectorThickness) => void;
}) {
  return (
    <select
      className="w-full h-9 border rounded-lg px-3 text-sm text-[var(--color-text)] outline-none focus:border-slate-700 transition-colors cursor-pointer"
      style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      value={value}
      onChange={(e) => onChange(e.target.value as ConnectorThickness)}
    >
      {CONNECTOR_THICKNESSES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

// ─── Outline Thickness Dropdown ──────────────────────────────────────────────

const OUTLINE_THICKNESSES: { id: OutlineThickness; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'thin', label: 'Thin' },
  { id: 'medium', label: 'Medium' },
  { id: 'thick', label: 'Thick' },
];

function OutlineThicknessDropdown({
  value,
  onChange,
}: {
  value: OutlineThickness;
  onChange: (v: OutlineThickness) => void;
}) {
  return (
    <select
      className="w-full h-9 border rounded-lg px-3 text-sm text-[var(--color-text)] outline-none focus:border-slate-700 transition-colors cursor-pointer"
      style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      value={value}
      onChange={(e) => onChange(e.target.value as OutlineThickness)}
    >
      {OUTLINE_THICKNESSES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

// ─── Connector Apply to All ──────────────────────────────────────────────────

function ConnectorApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;
  const [applyProps, setApplyProps] = useState({
    showVerticalConnector: true,
    connectorColor: true,
    connectorThickness: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} {...(isInSwimlane ? { onlyInSwimlane, setOnlyInSwimlane } : { excludeSwimlanes, setExcludeSwimlanes })}>
      <PropertyCard label="Show" checked={applyProps.showVerticalConnector} onChange={(v) => setApplyProps((p) => ({ ...p, showVerticalConnector: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.connectorColor} onChange={(v) => setApplyProps((p) => ({ ...p, connectorColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.connectorColor }} />
      </PropertyCard>
      <PropertyCard label="Thickness" checked={applyProps.connectorThickness} onChange={(v) => setApplyProps((p) => ({ ...p, connectorThickness: v }))}>
        <ThicknessIcon />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Milestone Shape Apply to All ─────────────────────────────────────────────

function MilestoneShapeApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;

  const [applyProps, setApplyProps] = useState({
    color: true,
    icon: true,
    size: true,
    position: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([k, v]) => {
        if (!v) return false;
        // Position card only exists for independent milestones
        if (k === 'position' && isInSwimlane) return false;
        return true;
      })
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox
      onApply={handleApply}
      applied={applied}
      label="Apply to all milestones"
      {...(isInSwimlane
        ? { onlyInSwimlane, setOnlyInSwimlane }
        : { excludeSwimlanes, setExcludeSwimlanes })}
    >
      <PropertyCard label="Color" checked={applyProps.color} onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.color }} />
      </PropertyCard>
      <PropertyCard label="Shape" checked={applyProps.icon} onChange={(v) => setApplyProps((p) => ({ ...p, icon: v }))}>
        <MilestoneIconComponent icon={style.icon} size={16} color={style.color} />
      </PropertyCard>
      <PropertyCard label="Size" checked={applyProps.size} onChange={(v) => setApplyProps((p) => ({ ...p, size: v }))}>
        <SizeIcon />
      </PropertyCard>
      {!isInSwimlane && (
        <PropertyCard label="Position" checked={applyProps.position} onChange={(v) => setApplyProps((p) => ({ ...p, position: v }))}>
          <PositionIcon5Dot />
        </PropertyCard>
      )}
    </ApplyToAllBox>
  );
}

// ─── Milestone Title Apply to All ─────────────────────────────────────────────

function MilestoneTitleApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;

  const [applyProps, setApplyProps] = useState({
    showTitle: true,
    fontColor: true,
    text: true,
    labelPosition: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showTitle) keys.push('showTitle');
    if (applyProps.fontColor) keys.push('fontColor');
    if (applyProps.text) keys.push('fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration');
    // Position card only exists for swimlaned milestones
    if (applyProps.labelPosition && isInSwimlane) keys.push('labelPosition', 'textAlign');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox
      onApply={handleApply}
      applied={applied}
      label="Apply to all milestones"
      {...(isInSwimlane
        ? { onlyInSwimlane, setOnlyInSwimlane }
        : { excludeSwimlanes, setExcludeSwimlanes })}
    >
      <PropertyCard label="Show" checked={applyProps.showTitle} onChange={(v) => setApplyProps((p) => ({ ...p, showTitle: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.fontColor} onChange={(v) => setApplyProps((p) => ({ ...p, fontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.fontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      {isInSwimlane && (
        <PropertyCard label="Position" checked={applyProps.labelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, labelPosition: v }))}>
          <PositionIcon5Dot />
        </PropertyCard>
      )}
    </ApplyToAllBox>
  );
}

// ─── Milestone Date Apply to All ──────────────────────────────────────────────

function MilestoneDateApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [onlyInSwimlane, setOnlyInSwimlane] = useState(false);
  const isInSwimlane = item.swimlaneId !== null;

  const [applyProps, setApplyProps] = useState({
    showDate: true,
    dateFontColor: true,
    text: true,
    dateFormat: true,
    dateLabelPosition: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showDate) keys.push('showDate');
    if (applyProps.dateFontColor) keys.push('dateFontColor');
    if (applyProps.text) keys.push('dateFontFamily', 'dateFontSize', 'dateFontWeight', 'dateFontStyle', 'dateTextDecoration');
    if (applyProps.dateFormat) keys.push('dateFormat');
    // Position card only exists for swimlaned milestones
    if (applyProps.dateLabelPosition && isInSwimlane) keys.push('dateLabelPosition', 'dateTextAlign');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes, onlyInSwimlane);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox
      onApply={handleApply}
      applied={applied}
      label="Apply to all milestones"
      {...(isInSwimlane
        ? { onlyInSwimlane, setOnlyInSwimlane }
        : { excludeSwimlanes, setExcludeSwimlanes })}
    >
      <PropertyCard label="Show" checked={applyProps.showDate} onChange={(v) => setApplyProps((p) => ({ ...p, showDate: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.dateFontColor} onChange={(v) => setApplyProps((p) => ({ ...p, dateFontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.dateFontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
      <PropertyCard label="Format" checked={applyProps.dateFormat} onChange={(v) => setApplyProps((p) => ({ ...p, dateFormat: v }))}>
        <FormatIcon />
      </PropertyCard>
      {isInSwimlane && (
        <PropertyCard label="Position" checked={applyProps.dateLabelPosition} onChange={(v) => setApplyProps((p) => ({ ...p, dateLabelPosition: v }))}>
          <PositionIcon5Dot />
        </PropertyCard>
      )}
    </ApplyToAllBox>
  );
}

// ─── Swimlane Title Apply to All ──────────────────────────────────────────────

function SwimlaneTitleApplyToAll({ swimlane }: { swimlane: Swimlane }) {
  const applySwimlaneStyleToAll = useProjectStore((s) => s.applySwimlaneStyleToAll);
  const [applied, setApplied] = useState(false);
  const [applyProps, setApplyProps] = useState({
    color: true,
    text: true,
  });

  const handleApply = () => {
    const keys: (keyof Swimlane)[] = [];
    if (applyProps.color) keys.push('titleFontColor');
    if (applyProps.text) keys.push('titleFontFamily', 'titleFontSize', 'titleFontWeight', 'titleFontStyle', 'titleTextDecoration');
    if (keys.length === 0) return;
    applySwimlaneStyleToAll(swimlane.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} label="Apply to all swimlanes">
      <PropertyCard label="Color" checked={applyProps.color} onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: swimlane.titleFontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Swimlane Background Apply to All ─────────────────────────────────────────

function SwimlaneBackgroundApplyToAll({ swimlane }: { swimlane: Swimlane }) {
  const applySwimlaneStyleToAll = useProjectStore((s) => s.applySwimlaneStyleToAll);
  const [applied, setApplied] = useState(false);
  const [applyProps, setApplyProps] = useState({
    header: true,
    body: true,
    outline: true,
  });

  const handleApply = () => {
    const keys: (keyof Swimlane)[] = [];
    if (applyProps.header) keys.push('headerColor', 'headerTransparency');
    if (applyProps.body) keys.push('bodyColor', 'bodyTransparency');
    if (applyProps.outline) keys.push('outlineThickness', 'outlineColor');
    if (keys.length === 0) return;
    applySwimlaneStyleToAll(swimlane.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <ApplyToAllBox onApply={handleApply} applied={applied} label="Apply to all swimlanes">
      <PropertyCard label="Header" checked={applyProps.header} onChange={(v) => setApplyProps((p) => ({ ...p, header: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: swimlane.headerColor }} />
      </PropertyCard>
      <PropertyCard label="Body" checked={applyProps.body} onChange={(v) => setApplyProps((p) => ({ ...p, body: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: swimlane.bodyColor }} />
      </PropertyCard>
      <PropertyCard label="Outline" checked={applyProps.outline} onChange={(v) => setApplyProps((p) => ({ ...p, outline: v }))}>
        <div className="w-5 h-5 rounded border-2 border-[var(--color-text-muted)]" style={{ borderColor: swimlane.outlineThickness !== 'none' ? swimlane.outlineColor : undefined }} />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Swimlane Spacing Control ─────────────────────────────────────────────────

const SWIMLANE_SPACING_PRESETS = [
  { value: 2, gap: 1.5, label: 'Narrow' },
  { value: 5, gap: 3, label: 'Medium' },
  { value: 10, gap: 5, label: 'Wide' },
];

function SwimlaneSpacingIcon({ gap, active }: { gap: number; active: boolean }) {
  const color = active ? '#334155' : 'currentColor';
  const cy = 4; // vertical center
  return (
    <svg width={20} height={20} viewBox="-2 -2 12 12" fill="none">
      <rect x={0} y={cy - gap} width={8} height={0.8} rx={0.3} fill={color} />
      <rect x={0} y={cy - 0.4} width={8} height={0.8} rx={0.3} fill={color} />
      <rect x={0} y={cy + gap} width={8} height={0.8} rx={0.3} fill={color} />
    </svg>
  );
}

function SwimlaneSpacingSection() {
  const swimlaneSpacing = useProjectStore((s) => s.swimlaneSpacing);
  const setSwimlaneSpacing = useProjectStore((s) => s.setSwimlaneSpacing);

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
        {SWIMLANE_SPACING_PRESETS.map((preset, idx) => (
          <button
            key={preset.value}
            onClick={() => setSwimlaneSpacing(preset.value)}
            className={`flex items-center justify-center w-10 h-9 transition-colors ${
              swimlaneSpacing === preset.value
                ? 'text-[var(--color-text)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc] hover:text-[var(--color-text)]'
            } ${idx !== 0 ? 'border-l' : ''}`}
            style={{
              borderColor: idx !== 0 ? '#d7e0ea' : undefined,
              background: swimlaneSpacing === preset.value ? 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' : 'transparent',
            }}
            title={preset.label}
          >
            <SwimlaneSpacingIcon gap={preset.gap} active={swimlaneSpacing === preset.value} />
          </button>
        ))}
      </div>
      <NumericStepper
        input={(
          <input
            type="text"
            value={swimlaneSpacing}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n >= 0 && n <= 40) setSwimlaneSpacing(n);
            }}
            className="w-10 h-9 text-center text-sm bg-transparent text-[var(--color-text)] outline-none"
          />
        )}
        valueDisplay={null}
        onIncrement={() => setSwimlaneSpacing(Math.min(40, swimlaneSpacing + 1))}
        onDecrement={() => setSwimlaneSpacing(Math.max(0, swimlaneSpacing - 1))}
      />
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-2">
        {title}
      </label>
      {children}
    </div>
  );
}

// ─── Design Tab Content ──────────────────────────────────────────────────────

const TASK_LAYOUT_OPTIONS: { value: TaskLayout; label: string; description: string }[] = [
  { value: 'single-row', label: 'Single row', description: 'All tasks on the same row' },
  { value: 'packed', label: 'Compact', description: 'Tasks stack to avoid overlaps' },
  { value: 'one-per-row', label: 'One per row', description: 'Each task on its own row' },
];

function DesignTabContent({
  taskLayout,
  setTaskLayout,
}: {
  taskLayout: TaskLayout;
  setTaskLayout: (layout: TaskLayout) => void;
}) {
  return (
    <div>
      <Section title="Task Layout">
        <div className="space-y-1.5">
          {TASK_LAYOUT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                taskLayout === opt.value
                  ? 'border-slate-400 bg-slate-700/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <input
                type="radio"
                name="taskLayout"
                value={opt.value}
                checked={taskLayout === opt.value}
                onChange={() => setTaskLayout(opt.value)}
                className="mt-0.5 accent-slate-700"
              />
              <div>
                <div className="text-xs font-medium text-[var(--color-text)]">{opt.label}</div>
                <div className="text-[11px] text-[var(--color-text-muted)] leading-tight mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
