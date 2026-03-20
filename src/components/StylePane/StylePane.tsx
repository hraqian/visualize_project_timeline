import { useProjectStore } from '@/store/useProjectStore';
import {
  Paintbrush,
  Copy,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  ListChecks,
  Diamond,
  Layers,
  Info,
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
  PRESET_COLORS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type BarShape,
  type LabelPosition,
  type MilestoneIcon,
  type ConnectorThickness,
} from '@/types';
import { useState } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const MILESTONE_ICONS: MilestoneIcon[] = [
  'diamond', 'diamond-filled', 'triangle', 'triangle-filled',
  'flag', 'flag-filled', 'star', 'star-filled',
  'circle', 'circle-filled', 'square-ms', 'square-ms-filled',
  'check', 'arrow-up', 'arrow-right', 'hexagon',
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

type MainTab = 'items' | 'timescale';
type ItemSubTab = 'task' | 'milestone' | 'swimlane';

// ─── StylePane ───────────────────────────────────────────────────────────────

export function StylePane() {
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const applyStyleToAll = useProjectStore((s) => s.applyStyleToAll);
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const deleteItem = useProjectStore((s) => s.deleteItem);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);
  const updateTier = useProjectStore((s) => s.updateTier);

  const [mainTab, setMainTab] = useState<MainTab>('items');

  const item = items.find((i) => i.id === selectedItemId);

  // Determine which sub-tab to show based on selection
  const autoSubTab: ItemSubTab = item?.type === 'milestone' ? 'milestone' : 'task';
  const [forcedSubTab, setForcedSubTab] = useState<ItemSubTab | null>(null);
  const activeSubTab = forcedSubTab ?? autoSubTab;

  // When selection changes, reset forced sub-tab
  const handleSubTabClick = (tab: ItemSubTab) => {
    setForcedSubTab(tab === autoSubTab ? null : tab);
  };

  // Swimlane for the selected item
  const selectedSwimlane = item ? swimlanes.find((s) => s.id === item.swimlaneId) : null;

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
            applyStyleToAll={applyStyleToAll}
            applyPartialStyleToAll={applyPartialStyleToAll}
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
  applyStyleToAll,
  applyPartialStyleToAll,
  deleteItem,
  updateSwimlane,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number] | undefined;
  activeSubTab: ItemSubTab;
  selectedSwimlane: ReturnType<typeof useProjectStore.getState>['swimlanes'][number] | undefined;
  updateTaskStyle: ReturnType<typeof useProjectStore.getState>['updateTaskStyle'];
  updateMilestoneStyle: ReturnType<typeof useProjectStore.getState>['updateMilestoneStyle'];
  applyStyleToAll: ReturnType<typeof useProjectStore.getState>['applyStyleToAll'];
  applyPartialStyleToAll: ReturnType<typeof useProjectStore.getState>['applyPartialStyleToAll'];
  deleteItem: ReturnType<typeof useProjectStore.getState>['deleteItem'];
  updateSwimlane: ReturnType<typeof useProjectStore.getState>['updateSwimlane'];
}) {
  if (!item) {
    return (
      <div className="text-center text-[var(--color-text-muted)] text-sm py-12">
        Select tasks to style them
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
      <>
        <ItemHeader item={item} onDelete={() => deleteItem(item.id)} />
        <MilestoneStyleControls item={item} updateMilestoneStyle={updateMilestoneStyle} />
        <ApplyToAllSection item={item} applyStyleToAll={applyStyleToAll} applyPartialStyleToAll={applyPartialStyleToAll} />
      </>
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
  return (
    <div className="text-center text-[var(--color-text-muted)] text-sm py-12">
      {activeSubTab === 'swimlane'
        ? 'Select an item in a swimlane to style its swimlane'
        : `Selected item is a ${item.type}, not a ${activeSubTab}`}
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
  const applyTaskBarStyleToAll = useProjectStore((s) => s.applyTaskBarStyleToAll);

  // Apply to all tasks state
  const [applyExpanded, setApplyExpanded] = useState(false);
  const [applyProps, setApplyProps] = useState({
    color: true,
    barShape: true,
    thickness: true,
    spacing: true,
  });
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleToggleExpand = (key: string) => {
    setStylePaneSection(stylePaneSection === key ? null : key as any);
  };

  const style = item.taskStyle;

  const handleApply = () => {
    applyTaskBarStyleToAll(item.id, applyProps, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

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
          <div className="border border-[var(--color-border)] rounded-lg p-3">
            <button
              onClick={() => setApplyExpanded(!applyExpanded)}
              className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
            >
              <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
              <span className="flex-1">Apply to all tasks</span>
              <ChevronRight
                size={12}
                className={`text-[var(--color-text-muted)] transition-transform ${applyExpanded ? 'rotate-90' : ''}`}
              />
            </button>

            {applyExpanded && (
              <div className="mt-3 space-y-3">
                {/* Property cards */}
                <div className="grid grid-cols-2 gap-2">
                  <PropertyCard
                    label="Color"
                    checked={applyProps.color}
                    onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}
                  >
                    <div
                      className="w-5 h-5 rounded border border-[var(--color-border)]"
                      style={{ backgroundColor: style.color }}
                    />
                  </PropertyCard>
                  <PropertyCard
                    label="Shape"
                    checked={applyProps.barShape}
                    onChange={(v) => setApplyProps((p) => ({ ...p, barShape: v }))}
                  >
                    <ShapePreview shape={style.barShape} color={style.color} width={28} height={10} />
                  </PropertyCard>
                  <PropertyCard
                    label="Size"
                    checked={applyProps.thickness}
                    onChange={(v) => setApplyProps((p) => ({ ...p, thickness: v }))}
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                      {style.thickness}px
                    </span>
                  </PropertyCard>
                  <PropertyCard
                    label="Spacing"
                    checked={applyProps.spacing}
                    onChange={(v) => setApplyProps((p) => ({ ...p, spacing: v }))}
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                      {style.spacing}px
                    </span>
                  </PropertyCard>
                </div>

                {/* Exclude swimlanes */}
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={excludeSwimlanes}
                    onChange={(e) => setExcludeSwimlanes(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span>Exclude swimlanes</span>
                  <span
                    className="relative"
                    title="Exclude items placed inside swimlanes"
                  >
                    <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
                  </span>
                </label>

                {/* Apply button */}
                <button
                  onClick={handleApply}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    applied
                      ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                      : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
                  }`}
                >
                  {applied ? <Check size={14} /> : <Copy size={14} />}
                  {applied ? 'Applied!' : 'Apply'}
                </button>
              </div>
            )}
          </div>
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
    <label
      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${
        checked
          ? 'border-indigo-500/30 bg-indigo-500/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-500 shrink-0"
      />
      {children}
      <span className="text-[10px] text-[var(--color-text-secondary)] flex-1 text-right">{label}</span>
    </label>
  );
}

// ─── Milestone Style Controls ────────────────────────────────────────────────

function MilestoneStyleControls({
  item,
  updateMilestoneStyle,
}: {
  item: ReturnType<typeof useProjectStore.getState>['items'][number];
  updateMilestoneStyle: ReturnType<typeof useProjectStore.getState>['updateMilestoneStyle'];
}) {
  const style = item.milestoneStyle;

  return (
    <>
      <Section title="Color">
        <ColorPicker value={style.color} onChange={(color) => updateMilestoneStyle(item.id, { color })} />
      </Section>

      <Section title="Icon">
        <div className="grid grid-cols-8 gap-1.5">
          {MILESTONE_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => updateMilestoneStyle(item.id, { icon })}
              className={`p-2 rounded-md flex items-center justify-center transition-all ${
                style.icon === icon
                  ? 'bg-indigo-500/15 border border-indigo-500/40'
                  : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
              }`}
              title={icon}
            >
              <MilestoneIconComponent icon={icon} size={16} color={style.color} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Icon Size">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={12}
            max={36}
            value={style.size}
            onChange={(e) => updateMilestoneStyle(item.id, { size: parseInt(e.target.value) })}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{style.size}px</span>
        </div>
      </Section>

      <Section title="Label Position">
        <div className="flex gap-1.5 flex-wrap">
          {LABEL_POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => updateMilestoneStyle(item.id, { labelPosition: pos.id })}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                style.labelPosition === pos.id
                  ? 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/40'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Font Size">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={18}
            value={style.fontSize}
            onChange={(e) => updateMilestoneStyle(item.id, { fontSize: parseInt(e.target.value) })}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{style.fontSize}px</span>
        </div>
      </Section>

      <Section title="Font Family">
        <select
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
          value={style.fontFamily}
          onChange={(e) => updateMilestoneStyle(item.id, { fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Font Weight">
        <div className="flex gap-1.5 flex-wrap">
          {FONT_WEIGHTS.map((w) => (
            <button
              key={w.value}
              onClick={() => updateMilestoneStyle(item.id, { fontWeight: w.value })}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                style.fontWeight === w.value
                  ? 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/40'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Font Color">
        <ColorPicker value={style.fontColor} onChange={(fontColor) => updateMilestoneStyle(item.id, { fontColor })} />
      </Section>
    </>
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
  return (
    <>
      <div className="mb-4">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
          Swimlane Style
        </div>
        <div className="font-medium text-sm text-[var(--color-text)]">{swimlane.name}</div>
      </div>

      <Section title="Swimlane Color">
        <ColorPicker
          value={swimlane.color}
          onChange={(color) => updateSwimlane(swimlane.id, { color })}
        />
      </Section>
    </>
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
  return (
    <>
      <Section title="Fiscal Year Start">
        <select
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
          value={timescale.fiscalYearStartMonth}
          onChange={(e) => updateTimescale({ fiscalYearStartMonth: parseInt(e.target.value) })}
        >
          {[
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ].map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Today Line">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={timescale.showToday}
              onChange={(e) => updateTimescale({ showToday: e.target.checked })}
              className="accent-indigo-500"
            />
            Show Today Marker
          </label>
          <input
            type="color"
            value={timescale.todayColor}
            onChange={(e) => updateTimescale({ todayColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
          />
        </div>
      </Section>

      {timescale.tiers.map((tier, idx) => (
        <Section key={idx} title={`Tier ${idx + 1}: ${tier.unit.charAt(0).toUpperCase() + tier.unit.slice(1)}`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={tier.visible}
                  onChange={(e) => updateTier(idx, { visible: e.target.checked })}
                  className="accent-indigo-500"
                />
                Visible
              </label>
              <select
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none"
                value={tier.unit}
                onChange={(e) => updateTier(idx, { unit: e.target.value as any })}
              >
                <option value="year">Year</option>
                <option value="quarter">Quarter</option>
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="day">Day</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Background</label>
                <input
                  type="color"
                  value={tier.backgroundColor}
                  onChange={(e) => updateTier(idx, { backgroundColor: e.target.value })}
                  className="w-full h-7 rounded cursor-pointer border border-[var(--color-border)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Font Color</label>
                <input
                  type="color"
                  value={tier.fontColor}
                  onChange={(e) => updateTier(idx, { fontColor: e.target.value })}
                  className="w-full h-7 rounded cursor-pointer border border-[var(--color-border)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Font Size</label>
                <input
                  type="number"
                  min={9}
                  max={18}
                  value={tier.fontSize}
                  onChange={(e) => updateTier(idx, { fontSize: parseInt(e.target.value) })}
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none"
                />
              </div>
            </div>
          </div>
        </Section>
      ))}
    </>
  );
}

// ─── Apply to All Section ────────────────────────────────────────────────────

const TASK_STYLE_GROUPS = [
  { label: 'Color', keys: ['color'] },
  { label: 'Bar Shape', keys: ['barShape'] },
  { label: 'Bar Thickness', keys: ['thickness'] },
  { label: 'Label Position', keys: ['labelPosition'] },
  { label: 'Font', keys: ['fontSize', 'fontFamily', 'fontWeight', 'fontColor'] },
] as const;

const MILESTONE_STYLE_GROUPS = [
  { label: 'Color', keys: ['color'] },
  { label: 'Icon', keys: ['icon'] },
  { label: 'Icon Size', keys: ['size'] },
  { label: 'Label Position', keys: ['labelPosition'] },
  { label: 'Font', keys: ['fontSize', 'fontFamily', 'fontWeight', 'fontColor'] },
] as const;

function ApplyToAllSection({
  item,
  applyStyleToAll,
  applyPartialStyleToAll,
}: {
  item: { id: string; type: string };
  applyStyleToAll: (id: string) => void;
  applyPartialStyleToAll: (id: string, keys: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  const isTask = item.type === 'task';
  const groups = isTask ? TASK_STYLE_GROUPS : MILESTONE_STYLE_GROUPS;
  const typeLabel = isTask ? 'Tasks' : 'Milestones';

  const handleApplyGroup = (keys: readonly string[], label: string) => {
    applyPartialStyleToAll(item.id, [...keys]);
    setAppliedKey(label);
    setTimeout(() => setAppliedKey(null), 1200);
  };

  const handleApplyAll = () => {
    applyStyleToAll(item.id);
    setAppliedKey('__all__');
    setTimeout(() => setAppliedKey(null), 1200);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleApplyAll}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20 transition-all text-sm font-medium"
      >
        {appliedKey === '__all__' ? <Check size={14} /> : <Copy size={14} />}
        {appliedKey === '__all__' ? 'Applied!' : `Apply All Styles to ${typeLabel}`}
      </button>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors py-1"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Apply individual properties
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-1.5">
          {groups.map((g) => (
            <button
              key={g.label}
              onClick={() => handleApplyGroup(g.keys, g.label)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all border ${
                appliedKey === g.label
                  ? 'bg-green-500/10 text-green-600 border-green-500/30'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]'
              }`}
            >
              {appliedKey === g.label ? <Check size={11} /> : <Copy size={11} />}
              {appliedKey === g.label ? 'Done' : g.label}
            </button>
          ))}
        </div>
      )}
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

// ─── Task Title Apply to All ─────────────────────────────────────────────────

function TaskTitleApplyToAll({ item }: { item: ReturnType<typeof useProjectStore.getState>['items'][number] }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    fontColor: true,
    fontFamily: true,
    fontSize: true,
    fontWeight: true,
    fontStyle: true,
    textDecoration: true,
    textAlign: true,
    labelPosition: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    // Use applyPartialStyleToAll which handles per-type
    applyPartialStyleToAll(item.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">Apply to all tasks</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyCard
              label="Color"
              checked={applyProps.fontColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, fontColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.fontColor }}
              />
            </PropertyCard>
            <PropertyCard
              label="Font"
              checked={applyProps.fontFamily}
              onChange={(v) => setApplyProps((p) => ({ ...p, fontFamily: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate" style={{ fontFamily: item.taskStyle.fontFamily }}>
                {item.taskStyle.fontFamily}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Size"
              checked={applyProps.fontSize}
              onChange={(v) => setApplyProps((p) => ({ ...p, fontSize: v }))}
            >
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                {item.taskStyle.fontSize}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Position"
              checked={applyProps.labelPosition}
              onChange={(v) => setApplyProps((p) => ({ ...p, labelPosition: v }))}
            >
              <PositionIcon position={item.taskStyle.labelPosition} />
            </PropertyCard>
            <PropertyCard
              label="Alignment"
              checked={applyProps.textAlign}
              onChange={(v) => setApplyProps((p) => ({ ...p, textAlign: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] capitalize">
                {item.taskStyle.textAlign}
              </span>
            </PropertyCard>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSwimlanes}
              onChange={(e) => setExcludeSwimlanes(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Exclude swimlanes</span>
            <span title="Exclude items placed inside swimlanes">
              <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            </span>
          </label>

          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              applied
                ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
            }`}
          >
            {applied ? <Check size={14} /> : <Copy size={14} />}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task Date Apply to All ──────────────────────────────────────────────────

function TaskDateApplyToAll({ item }: { item: ReturnType<typeof useProjectStore.getState>['items'][number] }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    dateFontColor: true,
    dateFontFamily: true,
    dateFontSize: true,
    dateFontWeight: true,
    dateFontStyle: true,
    dateTextDecoration: true,
    dateFormat: true,
    dateLabelPosition: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">Apply to all tasks</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyCard
              label="Color"
              checked={applyProps.dateFontColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, dateFontColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.dateFontColor }}
              />
            </PropertyCard>
            <PropertyCard
              label="Font"
              checked={applyProps.dateFontFamily}
              onChange={(v) => setApplyProps((p) => ({ ...p, dateFontFamily: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate" style={{ fontFamily: item.taskStyle.dateFontFamily }}>
                {item.taskStyle.dateFontFamily}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Size"
              checked={applyProps.dateFontSize}
              onChange={(v) => setApplyProps((p) => ({ ...p, dateFontSize: v }))}
            >
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                {item.taskStyle.dateFontSize}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Format"
              checked={applyProps.dateFormat}
              onChange={(v) => setApplyProps((p) => ({ ...p, dateFormat: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate">
                {item.taskStyle.dateFormat}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Position"
              checked={applyProps.dateLabelPosition}
              onChange={(v) => setApplyProps((p) => ({ ...p, dateLabelPosition: v }))}
            >
              <PositionIcon position={item.taskStyle.dateLabelPosition} />
            </PropertyCard>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSwimlanes}
              onChange={(e) => setExcludeSwimlanes(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Exclude swimlanes</span>
            <span title="Exclude items placed inside swimlanes">
              <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            </span>
          </label>

          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              applied
                ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
            }`}
          >
            {applied ? <Check size={14} /> : <Copy size={14} />}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task Duration Apply to All ──────────────────────────────────────────────

function TaskDurationApplyToAll({ item }: { item: ReturnType<typeof useProjectStore.getState>['items'][number] }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    durationFontColor: true,
    durationFontFamily: true,
    durationFontSize: true,
    durationFontWeight: true,
    durationFontStyle: true,
    durationTextDecoration: true,
    durationTextAlign: true,
    durationFormat: true,
    durationLabelPosition: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">Apply to all tasks</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyCard
              label="Color"
              checked={applyProps.durationFontColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, durationFontColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.durationFontColor }}
              />
            </PropertyCard>
            <PropertyCard
              label="Font"
              checked={applyProps.durationFontFamily}
              onChange={(v) => setApplyProps((p) => ({ ...p, durationFontFamily: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate" style={{ fontFamily: item.taskStyle.durationFontFamily }}>
                {item.taskStyle.durationFontFamily}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Size"
              checked={applyProps.durationFontSize}
              onChange={(v) => setApplyProps((p) => ({ ...p, durationFontSize: v }))}
            >
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                {item.taskStyle.durationFontSize}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Format"
              checked={applyProps.durationFormat}
              onChange={(v) => setApplyProps((p) => ({ ...p, durationFormat: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate">
                {item.taskStyle.durationFormat}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Position"
              checked={applyProps.durationLabelPosition}
              onChange={(v) => setApplyProps((p) => ({ ...p, durationLabelPosition: v }))}
            >
              <PositionIcon position={item.taskStyle.durationLabelPosition} />
            </PropertyCard>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSwimlanes}
              onChange={(e) => setExcludeSwimlanes(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Exclude swimlanes</span>
            <span title="Exclude items placed inside swimlanes">
              <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            </span>
          </label>

          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              applied
                ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
            }`}
          >
            {applied ? <Check size={14} /> : <Copy size={14} />}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task % Complete Apply to All ─────────────────────────────────────────────

function TaskPctApplyToAll({ item }: { item: ReturnType<typeof useProjectStore.getState>['items'][number] }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    pctFontColor: true,
    pctFontFamily: true,
    pctFontSize: true,
    pctFontWeight: true,
    pctFontStyle: true,
    pctTextDecoration: true,
    pctLabelPosition: true,
    pctHighlightColor: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">Apply to all tasks</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyCard
              label="Color"
              checked={applyProps.pctFontColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, pctFontColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.pctFontColor }}
              />
            </PropertyCard>
            <PropertyCard
              label="Font"
              checked={applyProps.pctFontFamily}
              onChange={(v) => setApplyProps((p) => ({ ...p, pctFontFamily: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate" style={{ fontFamily: item.taskStyle.pctFontFamily }}>
                {item.taskStyle.pctFontFamily}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Size"
              checked={applyProps.pctFontSize}
              onChange={(v) => setApplyProps((p) => ({ ...p, pctFontSize: v }))}
            >
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                {item.taskStyle.pctFontSize}
              </span>
            </PropertyCard>
            <PropertyCard
              label="Position"
              checked={applyProps.pctLabelPosition}
              onChange={(v) => setApplyProps((p) => ({ ...p, pctLabelPosition: v }))}
            >
              <PositionIcon position={item.taskStyle.pctLabelPosition} />
            </PropertyCard>
            <PropertyCard
              label="Highlight"
              checked={applyProps.pctHighlightColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, pctHighlightColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.pctHighlightColor }}
              />
            </PropertyCard>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSwimlanes}
              onChange={(e) => setExcludeSwimlanes(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Exclude swimlanes</span>
            <span title="Exclude items placed inside swimlanes">
              <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            </span>
          </label>

          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              applied
                ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
            }`}
          >
            {applied ? <Check size={14} /> : <Copy size={14} />}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      )}
    </div>
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

// ─── Connector Apply to All ──────────────────────────────────────────────────

function ConnectorApplyToAll({ item }: { item: ReturnType<typeof useProjectStore.getState>['items'][number] }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    connectorColor: true,
    connectorThickness: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-[var(--color-text)] hover:text-indigo-600 transition-colors"
      >
        <Paintbrush size={13} className="text-[var(--color-text-muted)]" />
        <span className="flex-1">Apply to all tasks</span>
        <ChevronRight
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyCard
              label="Color"
              checked={applyProps.connectorColor}
              onChange={(v) => setApplyProps((p) => ({ ...p, connectorColor: v }))}
            >
              <div
                className="w-5 h-5 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: item.taskStyle.connectorColor }}
              />
            </PropertyCard>
            <PropertyCard
              label="Thickness"
              checked={applyProps.connectorThickness}
              onChange={(v) => setApplyProps((p) => ({ ...p, connectorThickness: v }))}
            >
              <span className="text-[10px] text-[var(--color-text-secondary)] capitalize">
                {item.taskStyle.connectorThickness}
              </span>
            </PropertyCard>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSwimlanes}
              onChange={(e) => setExcludeSwimlanes(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Exclude swimlanes</span>
            <span title="Exclude items placed inside swimlanes">
              <Info size={12} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            </span>
          </label>

          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              applied
                ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 hover:bg-indigo-500/20'
            }`}
          >
            {applied ? <Check size={14} /> : <Copy size={14} />}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      )}
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

// ─── Color Picker ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 ${
              value === color ? 'border-[var(--color-text)] shadow-lg scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] font-mono outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
