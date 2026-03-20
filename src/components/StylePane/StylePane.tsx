import { useProjectStore } from '@/store/useProjectStore';
import {
  Paintbrush,
  ChevronRight,
  ChevronDown,
  Trash2,
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
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type BarShape,
  type LabelPosition,
  type MilestoneIcon,
  type ConnectorThickness,
} from '@/types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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

  const [mainTab, setMainTab] = useState<MainTab>('items');

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
  return (
    <>
      <div className="mb-4">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
          Swimlane Style
        </div>
        <div className="font-medium text-sm text-[var(--color-text)]">{swimlane.name}</div>
      </div>

      <Section title="Swimlane Color">
        <AdvancedColorPicker
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
  applied,
  label = 'Apply to all tasks',
}: {
  children: React.ReactNode;
  onApply: () => void;
  excludeSwimlanes: boolean;
  setExcludeSwimlanes: (v: boolean) => void;
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
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer whitespace-nowrap">
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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

// ─── Connector Apply to All ──────────────────────────────────────────────────

function ConnectorApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
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
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.taskStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied}>
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
  const [applyProps, setApplyProps] = useState({
    color: true,
    icon: true,
    size: true,
    position: true,
  });

  const handleApply = () => {
    const keys = Object.entries(applyProps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied} label="Apply to all milestones">
      <PropertyCard label="Color" checked={applyProps.color} onChange={(v) => setApplyProps((p) => ({ ...p, color: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.color }} />
      </PropertyCard>
      <PropertyCard label="Shape" checked={applyProps.icon} onChange={(v) => setApplyProps((p) => ({ ...p, icon: v }))}>
        <MilestoneIconComponent icon={style.icon} size={16} color={style.color} />
      </PropertyCard>
      <PropertyCard label="Size" checked={applyProps.size} onChange={(v) => setApplyProps((p) => ({ ...p, size: v }))}>
        <SizeIcon />
      </PropertyCard>
      <PropertyCard label="Position" checked={applyProps.position} onChange={(v) => setApplyProps((p) => ({ ...p, position: v }))}>
        <PositionIcon5Dot />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Milestone Title Apply to All ─────────────────────────────────────────────

function MilestoneTitleApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    showTitle: true,
    fontColor: true,
    text: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showTitle) keys.push('showTitle');
    if (applyProps.fontColor) keys.push('fontColor');
    if (applyProps.text) keys.push('fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied} label="Apply to all milestones">
      <PropertyCard label="Show" checked={applyProps.showTitle} onChange={(v) => setApplyProps((p) => ({ ...p, showTitle: v }))}>
        <ShowIcon />
      </PropertyCard>
      <PropertyCard label="Color" checked={applyProps.fontColor} onChange={(v) => setApplyProps((p) => ({ ...p, fontColor: v }))}>
        <div className="w-5 h-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: style.fontColor }} />
      </PropertyCard>
      <PropertyCard label="Text" checked={applyProps.text} onChange={(v) => setApplyProps((p) => ({ ...p, text: v }))}>
        <TextIcon />
      </PropertyCard>
    </ApplyToAllBox>
  );
}

// ─── Milestone Date Apply to All ──────────────────────────────────────────────

function MilestoneDateApplyToAll({ item }: { item: ItemType }) {
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const [applied, setApplied] = useState(false);
  const [excludeSwimlanes, setExcludeSwimlanes] = useState(false);
  const [applyProps, setApplyProps] = useState({
    showDate: true,
    dateFontColor: true,
    text: true,
    dateFormat: true,
  });

  const handleApply = () => {
    const keys: string[] = [];
    if (applyProps.showDate) keys.push('showDate');
    if (applyProps.dateFontColor) keys.push('dateFontColor');
    if (applyProps.text) keys.push('dateFontFamily', 'dateFontSize', 'dateFontWeight', 'dateFontStyle', 'dateTextDecoration');
    if (applyProps.dateFormat) keys.push('dateFormat');
    if (keys.length === 0) return;
    applyPartialStyleToAll(item.id, keys, excludeSwimlanes);
    setApplied(true);
    setTimeout(() => setApplied(false), 1200);
  };

  const style = item.milestoneStyle;

  return (
    <ApplyToAllBox onApply={handleApply} excludeSwimlanes={excludeSwimlanes} setExcludeSwimlanes={setExcludeSwimlanes} applied={applied} label="Apply to all milestones">
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
    </ApplyToAllBox>
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


