import { useProjectStore } from '@/store/useProjectStore';
import {
  Paintbrush,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  ListChecks,
  Diamond,
  Layers,
  Info,
  Settings,
  X,
} from 'lucide-react';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import { AdvancedColorPicker } from '@/components/common/AdvancedColorPicker';
import { ShapeDropdown, ShapePreview } from '@/components/common/ShapeDropdown';
import { SizeControl } from '@/components/common/SizeControl';
import { SpacingControl } from '@/components/common/SpacingControl';
import { FontFamilyDropdown, FontSizeDropdown } from '@/components/common/FontDropdowns';
import { DateFormatDropdown } from '@/components/common/DateFormatDropdown';
import { DurationFormatDropdown } from '@/components/common/DurationFormatDropdown';
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type BarShape,
  type LabelPosition,
  type MilestoneIcon,
  type ConnectorThickness,
  type OutlineThickness,
  type Swimlane,
  type TimescaleTierConfig,
  type TimescaleBarShape,
  type TierFormat,
  type TodayMarkerPosition,
  type ElapsedTimeThickness,
  type EndCapConfig,
} from '@/types';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { parseISO, differenceInDays, differenceInCalendarMonths, addMonths, addDays, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { generateTierLabels, buildVisibleTierCells, getProjectRange, getFormatOptionsForUnit, getDefaultFormatForUnit, resolveAutoUnit } from '@/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const MILESTONE_ICONS: { id: MilestoneIcon; label: string }[] = [
  { id: 'flag', label: 'Flag' },
  { id: 'triangle-down', label: 'Triangle down' },
  { id: 'diamond-filled', label: 'Diamond' },
  { id: 'star', label: 'Star 5 point' },
  { id: 'star-6pt', label: 'Star 6 point' },
  { id: 'arrow-up', label: 'Arrow up' },
  { id: 'arrow-down', label: 'Arrow down' },
  { id: 'square-ms', label: 'Square outline' },
  { id: 'square-ms-filled', label: 'Square filled' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'chevron-right', label: 'Chevron right' },
  { id: 'triangle', label: 'Triangle up' },
  { id: 'plus', label: 'Plus' },
  { id: 'circle', label: 'Circle outline' },
  { id: 'circle-filled', label: 'Circle filled' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'diamond', label: 'Diamond outline' },
  { id: 'heart', label: 'Heart' },
];

const BAR_SHAPES: { id: BarShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'double-chevron', label: 'Dbl Chevron' },
  { id: 'arrow-right', label: 'Arrow R' },
  { id: 'pointed', label: 'Pointed' },
  { id: 'notched', label: 'Notched' },
  { id: 'tab', label: 'Tab' },
  { id: 'arrow-both', label: 'Arrow Both' },
  { id: 'trapezoid', label: 'Trapezoid' },
  { id: 'flat', label: 'Flat' },
];

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

type MainTab = 'items' | 'timescale';
type ItemSubTab = 'task' | 'milestone' | 'swimlane';

// ─── StylePane ───────────────────────────────────────────────────────────────

export function StylePane() {
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const selectedSwimlaneId = useProjectStore((s) => s.selectedSwimlaneId);
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const deleteItem = useProjectStore((s) => s.deleteItem);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);
  const updateTier = useProjectStore((s) => s.updateTier);
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);

  const [mainTab, setMainTab] = useState<MainTab>('items');

  // Auto-switch tab when a section is activated (e.g. clicking tier row or task bar)
  const timescaleSections = ['scale', 'todayMarker', 'elapsedTime', 'leftEndCap', 'rightEndCap'];
  useEffect(() => {
    if (stylePaneSection) {
      if (timescaleSections.includes(stylePaneSection)) {
        setMainTab('timescale');
      } else {
        setMainTab('items');
      }
    }
  }, [stylePaneSection]);

  const item = items.find((i) => i.id === selectedItemId);

  // Determine which sub-tab to show based on selection
  const autoSubTab: ItemSubTab = selectedSwimlaneId
    ? 'swimlane'
    : item?.type === 'milestone'
      ? 'milestone'
      : 'task';
  const [forcedSubTab, setForcedSubTab] = useState<ItemSubTab | null>(null);
  const activeSubTab = forcedSubTab ?? autoSubTab;

  // When selection changes, reset forced sub-tab
  useEffect(() => {
    setForcedSubTab(null);
  }, [selectedItemId, selectedSwimlaneId]);

  const handleSubTabClick = (tab: ItemSubTab) => {
    setForcedSubTab(tab === autoSubTab ? null : tab);
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
          <Paintbrush size={14} className="text-indigo-500 mr-2 shrink-0" />
          <div className="flex items-center gap-0.5 flex-1">
            <button
              onClick={() => setMainTab('items')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mainTab === 'items'
                  ? 'bg-indigo-500/15 text-indigo-600'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setMainTab('timescale')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mainTab === 'timescale'
                  ? 'bg-indigo-500/15 text-indigo-600'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Timescale
            </button>
          </div>
        </div>

        {/* Sub-icons for Items tab */}
        {mainTab === 'items' && (
          <div className="flex items-center gap-1 px-3 pb-2">
            <button
              onClick={() => handleSubTabClick('task')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeSubTab === 'task'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Task styling"
            >
              <ListChecks size={13} />
              Task
            </button>
            <button
              onClick={() => handleSubTabClick('milestone')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeSubTab === 'milestone'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Milestone styling"
            >
              <Diamond size={13} />
              Milestone
            </button>
            <button
              onClick={() => handleSubTabClick('swimlane')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeSubTab === 'swimlane'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              title="Swimlane styling"
            >
              <Layers size={13} />
              Swimlane
            </button>
          </div>
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {mainTab === 'items' ? (
          <ItemsTabContent
            item={item}
            activeSubTab={activeSubTab}
            selectedSwimlane={selectedSwimlane}
            updateTaskStyle={updateTaskStyle}
            updateMilestoneStyle={updateMilestoneStyle}
            deleteItem={deleteItem}
            updateSwimlane={updateSwimlane}
          />
        ) : (
          <TimescaleTabContent
            timescale={timescale}
            updateTimescale={updateTimescale}
            updateTier={updateTier}
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
  deleteItem,
  updateSwimlane,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number] | undefined;
  activeSubTab: ItemSubTab;
  selectedSwimlane: ReturnType<typeof useProjectStore.getState>['swimlanes'][number] | undefined;
  updateTaskStyle: ReturnType<typeof useProjectStore.getState>['updateTaskStyle'];
  updateMilestoneStyle: ReturnType<typeof useProjectStore.getState>['updateMilestoneStyle'];
  deleteItem: ReturnType<typeof useProjectStore.getState>['deleteItem'];
  updateSwimlane: ReturnType<typeof useProjectStore.getState>['updateSwimlane'];
}) {
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

// ─── Item Header ─────────────────────────────────────────────────────────────

function ItemHeader({ item, onDelete }: { item: { name: string; type: string }; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
          {item.type === 'task' ? 'Task Style' : 'Milestone Style'}
        </div>
        <div className="font-medium text-sm text-[var(--color-text)]">{item.name}</div>
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-500 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
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
          <Toggle checked={toggle.checked} onChange={toggle.onChange} />
        )}
      </div>
      {expanded && children && (
        <div
          className="px-4 pb-4 pt-1"
          style={toggle && !toggle.checked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
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

  const handleToggleExpand = (key: string) => {
    setStylePaneSection(stylePaneSection === key ? null : key as any);
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.color}
                onChange={(color) => updateTaskStyle(item.id, { color })}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Shape
              </label>
              <ShapeDropdown
                value={style.barShape}
                color={style.color}
                onChange={(barShape) => updateTaskStyle(item.id, { barShape })}
              />
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.fontColor}
                onChange={(fontColor) => updateTaskStyle(item.id, { fontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.dateFontColor}
                onChange={(dateFontColor) => updateTaskStyle(item.id, { dateFontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.durationFontColor}
                onChange={(durationFontColor) => updateTaskStyle(item.id, { durationFontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.pctFontColor}
                onChange={(pctFontColor) => updateTaskStyle(item.id, { pctFontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.connectorColor}
                onChange={(connectorColor) => updateTaskStyle(item.id, { connectorColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Thickness
              </label>
              <ConnectorThicknessDropdown
                value={style.connectorThickness}
                onChange={(connectorThickness) => updateTaskStyle(item.id, { connectorThickness })}
              />
            </div>
          </div>

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
      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all flex-1 ${
        checked
          ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
      }`}
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectedIcon = MILESTONE_ICONS.find((i) => i.id === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors"
      >
        <MilestoneIconComponent icon={value} size={16} color={color} />
        <span className="flex-1 text-left font-medium">{selectedIcon?.label ?? value}</span>
        <ChevronDown size={12} className={`text-[var(--color-text-muted)]`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[252px] bg-white border border-[var(--color-border)] rounded-lg shadow-xl p-3">
          <div className="grid grid-cols-6 gap-2">
            {MILESTONE_ICONS.map((ic) => (
              <button
                key={ic.id}
                onClick={() => { onChange(ic.id); setOpen(false); }}
                className={`flex items-center justify-center h-8 rounded-md transition-colors ${
                  value === ic.id
                    ? 'bg-slate-200'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
                title={ic.label}
              >
                <MilestoneIconComponent icon={ic.id} size={18} color={color} />
              </button>
            ))}
          </div>
        </div>
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

  const handleToggleExpand = (key: string) => {
    setStylePaneSection(stylePaneSection === key ? null : key as any);
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.color}
                onChange={(color) => updateMilestoneStyle(item.id, { color })}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Shape
              </label>
              <MilestoneShapeDropdown
                value={style.icon}
                color={style.color}
                onChange={(icon) => updateMilestoneStyle(item.id, { icon })}
              />
            </div>
          </div>

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
                      ? 'bg-[var(--color-bg-secondary)] border-[var(--color-text-muted)] text-[var(--color-text)]'
                      : 'bg-white border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center border border-[var(--color-border)] rounded-lg overflow-hidden ml-1">
                <input
                  type="number"
                  min={8}
                  max={48}
                  value={style.size}
                  onChange={(e) => updateMilestoneStyle(item.id, { size: Math.max(8, Math.min(48, parseInt(e.target.value) || 8)) })}
                  className="w-12 h-9 text-center text-sm text-[var(--color-text)] bg-white outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex flex-col border-l border-[var(--color-border)]">
                  <button
                    onClick={() => updateMilestoneStyle(item.id, { size: Math.min(48, style.size + 1) })}
                    className="px-1.5 h-[18px] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center"
                  >
                    <ChevronRight size={10} className="-rotate-90" />
                  </button>
                  <button
                    onClick={() => updateMilestoneStyle(item.id, { size: Math.max(8, style.size - 1) })}
                    className="px-1.5 h-[18px] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center border-t border-[var(--color-border)]"
                  >
                    <ChevronRight size={10} className="rotate-90" />
                  </button>
                </div>
              </div>
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
                        ? 'bg-[var(--color-bg-secondary)] border-[var(--color-text-muted)]'
                        : 'bg-white border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                    }`}
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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.fontColor}
                onChange={(fontColor) => updateMilestoneStyle(item.id, { fontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={style.dateFontColor}
                onChange={(dateFontColor) => updateMilestoneStyle(item.id, { dateFontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
              value={style.dateFormat}
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

  const handleToggleExpand = (key: string) => {
    setStylePaneSection(stylePaneSection === key ? null : key as any);
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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker
                value={swimlane.titleFontColor}
                onChange={(titleFontColor) => updateSwimlane(swimlane.id, { titleFontColor })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Text
              </label>
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
            </div>
          </div>

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
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                  Color
                </label>
                <AdvancedColorPicker
                  value={swimlane.headerColor}
                  onChange={(headerColor) => updateSwimlane(swimlane.id, { headerColor })}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                  Transparency
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={swimlane.headerTransparency}
                    onChange={(e) => updateSwimlane(swimlane.id, { headerTransparency: Number(e.target.value) })}
                    className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-[var(--color-text-secondary)] w-8 text-right tabular-nums">{swimlane.headerTransparency}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body sub-group ── */}
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-2">Body</div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                  Color
                </label>
                <AdvancedColorPicker
                  value={swimlane.bodyColor}
                  onChange={(bodyColor) => updateSwimlane(swimlane.id, { bodyColor })}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                  Transparency
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={swimlane.bodyTransparency}
                    onChange={(e) => updateSwimlane(swimlane.id, { bodyTransparency: Number(e.target.value) })}
                    className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-[var(--color-text-secondary)] w-8 text-right tabular-nums">{swimlane.bodyTransparency}%</span>
                </div>
              </div>
            </div>
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
  updateTier,
}: {
  timescale: ReturnType<typeof useProjectStore.getState>['timescale'];
  updateTimescale: ReturnType<typeof useProjectStore.getState>['updateTimescale'];
  updateTier: ReturnType<typeof useProjectStore.getState>['updateTier'];
}) {
  const stylePaneSection = useProjectStore((s) => s.stylePaneSection);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);
  const [tierSettingsOpen, setTierSettingsOpen] = useState(false);

  const handleToggleExpand = (key: string) => {
    setStylePaneSection(stylePaneSection === key ? null : key as any);
  };

  return (
    <div className="space-y-4">
      {/* Tier settings button */}
      <div className="px-4">
        <button
          onClick={() => setTierSettingsOpen(true)}
          className="flex items-center justify-center gap-2 w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
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
              <rect x="2" y="2" width="12" height="3" rx="0.5" fill={position === 'below' ? '#6366f1' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="5" x2="8" y2="14" stroke={position === 'below' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 11.5L8 14L10.5 11.5" stroke={position === 'below' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              <rect x="2" y="11" width="12" height="3" rx="0.5" fill={position === 'above' ? '#6366f1' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="11" x2="8" y2="2" stroke={position === 'above' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 4.5L8 2L10.5 4.5" stroke={position === 'above' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Color
          </label>
          <AdvancedColorPicker
            value={color}
            onChange={(elapsedTimeColor) => updateTimescale({ elapsedTimeColor })}
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Thickness
          </label>
          <div className="relative">
            <select
              value={thickness}
              onChange={(e) => updateTimescale({ elapsedTimeThickness: e.target.value as ElapsedTimeThickness })}
              className="w-full h-9 pl-3 pr-8 rounded border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] appearance-none cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {ELAPSED_THICKNESS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

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
              <rect x="2" y="2" width="12" height="3" rx="0.5" fill={position === 'below' ? '#6366f1' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="5" x2="8" y2="14" stroke={position === 'below' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 11.5L8 14L10.5 11.5" stroke={position === 'below' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              <rect x="2" y="11" width="12" height="3" rx="0.5" fill={position === 'above' ? '#6366f1' : '#94a3b8'} opacity="0.5" />
              <line x1="8" y1="11" x2="8" y2="2" stroke={position === 'above' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" />
              <path d="M5.5 4.5L8 2L10.5 4.5" stroke={position === 'above' ? '#6366f1' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

const TIMESCALE_BAR_SHAPES: { id: TimescaleBarShape; label: string }[] = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded', label: 'Rounded rectangle' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'modern', label: 'Modern' },
];

function TimescaleBarShapeIcon({ shape, size = 24, color = '#475569' }: { shape: TimescaleBarShape; size?: number; color?: string }) {
  const w = size;
  const h = size * 0.6;
  switch (shape) {
    case 'rectangle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={1} y={2} width={w - 2} height={h - 4} rx={0} fill={color} />
        </svg>
      );
    case 'rounded':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={1} y={2} width={w - 2} height={h - 4} rx={3} fill={color} />
        </svg>
      );
    case 'leaf':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={1} y={2} width={w - 2} height={h - 4} rx={0} fill={color} style={{ borderRadius: `0 ${h * 0.35}px ${h * 0.35}px 0` }} />
          <path d={`M1,2 h${w - 2 - h * 0.35} q${h * 0.35},0 ${h * 0.35},${(h - 4) / 2} q0,${(h - 4) / 2} -${h * 0.35},${(h - 4) / 2} H1 V2 Z`} fill={color} />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={1} y={2} width={w - 2} height={h - 4} rx={(h - 4) / 2} fill={color} />
        </svg>
      );
    case 'modern':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <path d={`M${3},${2} h${w - 8} l${2},${(h - 4) / 2} l-${2},${(h - 4) / 2} H${3} l${2},-${(h - 4) / 2} l-${2},-${(h - 4) / 2} Z`} fill={color} />
        </svg>
      );
  }
}

function TimescaleBarShapeDropdown({ value, onChange }: { value: TimescaleBarShape; onChange: (v: TimescaleBarShape) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TIMESCALE_BAR_SHAPES.find((s) => s.id === value) ?? TIMESCALE_BAR_SHAPES[1];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none hover:border-[var(--color-text-muted)] transition-colors"
      >
        <TimescaleBarShapeIcon shape={value} size={20} />
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 p-2 flex gap-1">
          {TIMESCALE_BAR_SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={`p-1.5 rounded transition-colors ${
                value === s.id ? 'bg-[var(--color-bg-tertiary)]' : 'hover:bg-[var(--color-surface-hover)]'
              }`}
              title={s.label}
            >
              <TimescaleBarShapeIcon shape={s.id} size={28} />
            </button>
          ))}
        </div>
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
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-secondary)]">
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
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
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
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
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
          className="accent-indigo-500 w-4 h-4"
        />
        <span className="font-medium">Separators</span>
      </label>

      {/* Color + Text (font family + font size) */}
      <div className="flex gap-3">
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Color
          </label>
          <AdvancedColorPicker value={tier.fontColor} onChange={(c) => updateTier(activeTierStoreIndex, { fontColor: c })} />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
            Text
          </label>
          <div className="flex gap-1.5">
            <FontFamilyDropdown value={tier.fontFamily} onChange={(f) => updateTier(activeTierStoreIndex, { fontFamily: f })} fonts={FONT_FAMILIES} />
            <FontSizeDropdown value={tier.fontSize} onChange={(s) => updateTier(activeTierStoreIndex, { fontSize: s })} />
          </div>
        </div>
      </div>

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
          <div className="flex gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Color
              </label>
              <AdvancedColorPicker value={tier.backgroundColor} onChange={(c) => updateTier(activeTierStoreIndex, { backgroundColor: c })} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-1.5">
                Shape
              </label>
              <TimescaleBarShapeDropdown
                value={timescale.barShape}
                onChange={(s) => updateTimescale({ barShape: s })}
              />
            </div>
          </div>
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
  { unit: 'month', format: 'MMM', visible: true, backgroundColor: '#6b7f5c', fontColor: '#f8fafc', fontSize: 12, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
  { unit: 'week', format: 'w_num', visible: false, backgroundColor: '#94a3b8', fontColor: '#f8fafc', fontSize: 11, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
  { unit: 'day', format: 'd_num', visible: false, backgroundColor: '#94a3b8', fontColor: '#f8fafc', fontSize: 11, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
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

  // Project range — same padding as main TimelineView
  const { origin, totalDays, rangeEndDate, startYear, endYear } = useMemo(() => {
    const range = getProjectRange(items);
    const padStart = startOfMonth(subDays(parseISO(range.start), 14));
    // End at the end of the month containing the last item
    const endMonth = startOfMonth(parseISO(range.end));
    const numMonths = differenceInCalendarMonths(endMonth, padStart) + 1;
    const padEnd = addMonths(padStart, numMonths);
    const days = differenceInDays(padEnd, padStart);
    const sy = padStart.getFullYear();
    const lastVisibleMonth = subDays(padEnd, 1);
    const ey = lastVisibleMonth.getFullYear() + (lastVisibleMonth.getMonth() > 0 || lastVisibleMonth.getDate() > 1 ? 1 : 0);
    return { origin: padStart.toISOString().split('T')[0], totalDays: days, rangeEndDate: lastVisibleMonth, startYear: sy, endYear: ey };
  }, [items]);

  // Today position as fraction (0-1)
  const todayFraction = useMemo(() => {
    const today = new Date();
    const frac = differenceInDays(today, parseISO(origin)) / totalDays;
    return Math.max(0, Math.min(1, frac));
  }, [origin, totalDays]);

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1100px] mt-12 mx-4 flex flex-col max-h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Tier settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Timescale preview — same algorithm as main TimelineView */}
          {visibleCount > 0 && (
            <div className="flex items-center gap-3">
              {/* Left end cap */}
              <span className="text-xl font-bold text-[var(--color-text)] shrink-0 tabular-nums">
                {startYear}
              </span>

              {/* Bar */}
              <div className="flex-1 rounded-lg overflow-hidden border border-[var(--color-border)] relative">
                {previewTierLabels.map(({ tier, cells }, tierIdx) => (
                  <div
                    key={tierIdx}
                    className="relative"
                    style={{ backgroundColor: tier.backgroundColor, height: 28 }}
                  >
                    {cells.map((cell, ci) => (
                      <div
                        key={ci}
                        className={`absolute top-0 h-full flex items-center overflow-hidden ${tier.separators && ci > 0 ? 'border-l border-white/20' : ''}`}
                        style={{
                          left: `${cell.fraction * 100}%`,
                          width: `${cell.widthFrac * 100}%`,
                          color: tier.fontColor,
                          fontSize: Math.min(tier.fontSize, 12),
                          fontFamily: tier.fontFamily,
                          fontWeight: tier.fontWeight,
                          fontStyle: tier.fontStyle,
                          textDecoration: tier.textDecoration,
                           justifyContent: 'flex-start',
                        }}
                      >
                        <span className="truncate px-1">{cell.label}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Today marker */}
                {todayFraction > 0 && todayFraction < 1 && (
                  <div
                    className="absolute top-0 z-10 pointer-events-none"
                    style={{ left: `${todayFraction * 100}%`, height: visibleCount * 28 }}
                  >
                    <div className="w-0.5 h-full" style={{ backgroundColor: timescale.todayColor }} />
                    <div
                      className="absolute top-full mt-0.5 -translate-x-1/2 text-[10px] font-medium"
                      style={{ color: timescale.todayColor }}
                    >
                      Today
                    </div>
                  </div>
                )}
              </div>

              {/* Right end cap */}
              <span className="text-xl font-bold text-[var(--color-text)] shrink-0 tabular-nums">
                {endYear}
              </span>
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
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
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
          <Toggle checked={tier.visible} onChange={(v) => updateTier({ visible: v })} />
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
              className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)] outline-none"
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
              className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)] outline-none"
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
              <FontSizeDropdown value={tier.fontSize} onChange={(fontSize) => updateTier({ fontSize })} />
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
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        ref={triggerRef}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
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
          className="fixed z-[9999] bg-white border border-[var(--color-border)] rounded-lg shadow-lg p-3 space-y-3"
          style={{
            right: popoverPos.right,
            bottom: window.innerHeight - popoverPos.top,
            minWidth: 'max-content',
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
                  className="accent-indigo-500"
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
                  className="accent-indigo-500"
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
                  : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              }`}
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
      className="w-full h-9 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors cursor-pointer"
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
      className="w-full h-9 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors cursor-pointer"
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
  const color = active ? '#6366f1' : 'currentColor';
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
      <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
        {SWIMLANE_SPACING_PRESETS.map((preset, idx) => (
          <button
            key={preset.value}
            onClick={() => setSwimlaneSpacing(preset.value)}
            className={`flex items-center justify-center w-10 h-9 transition-colors ${
              swimlaneSpacing === preset.value
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border border-[var(--color-border)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
            } ${idx !== 0 ? 'border-l border-[var(--color-border)]' : ''}`}
            title={preset.label}
          >
            <SwimlaneSpacingIcon gap={preset.gap} active={swimlaneSpacing === preset.value} />
          </button>
        ))}
      </div>
      <div className="flex items-center border border-[var(--color-border)] rounded-md overflow-hidden">
        <input
          type="text"
          value={swimlaneSpacing}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= 0 && n <= 40) setSwimlaneSpacing(n);
          }}
          className="w-10 h-9 text-center text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text)] outline-none"
        />
        <div className="flex flex-col border-l border-[var(--color-border)]">
          <button
            onClick={() => setSwimlaneSpacing(Math.min(40, swimlaneSpacing + 1))}
            className="px-1.5 h-[18px] flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)]"
          >
            <ChevronUp size={10} />
          </button>
          <button
            onClick={() => setSwimlaneSpacing(Math.max(0, swimlaneSpacing - 1))}
            className="px-1.5 h-[18px] flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors border-t border-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>
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


