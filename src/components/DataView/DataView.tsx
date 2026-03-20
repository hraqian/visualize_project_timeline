import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { addDays, parseISO, differenceInDays } from 'date-fns';
import { v4 as uuid } from 'uuid';
import {
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { TypePickerCell } from './TypePicker';
import type { ItemType, StatusLabel, TaskStyle, MilestoneStyle } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute duration in days (inclusive: 1 day = same start & end). */
function computeDuration(startDate: string, endDate: string): number {
  return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
}

/** Given start + duration → end. */
function endFromDuration(startDate: string, days: number): string {
  return addDays(parseISO(startDate), Math.max(days - 1, 0)).toISOString().split('T')[0];
}

/** Given end + duration → start. */
function startFromDuration(endDate: string, days: number): string {
  return addDays(parseISO(endDate), -(Math.max(days - 1, 0))).toISOString().split('T')[0];
}

// ─── Column count for colSpan ────────────────────────────────────────────────
const TOTAL_COLUMNS = 10; // grip, vis, type, name, start, end, duration, progress, status, actions

// ─── DataView ────────────────────────────────────────────────────────────────

export function DataView() {
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const statusLabels = useProjectStore((s) => s.statusLabels);
  const updateItem = useProjectStore((s) => s.updateItem);
  const deleteItem = useProjectStore((s) => s.deleteItem);
  const toggleVisibility = useProjectStore((s) => s.toggleVisibility);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const addItem = useProjectStore((s) => s.addItem);
  const addSwimlane = useProjectStore((s) => s.addSwimlane);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const addStatusLabel = useProjectStore((s) => s.addStatusLabel);
  const updateStatusLabel = useProjectStore((s) => s.updateStatusLabel);
  const removeStatusLabel = useProjectStore((s) => s.removeStatusLabel);

  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const [showStatusConfig, setShowStatusConfig] = useState(false);

  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);

  const toggleCollapse = (id: string) => {
    setCollapsedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Date / Duration auto-calc ──────────────────────────────────────

  const handleDateChange = (id: string, field: 'startDate' | 'endDate', value: string) => {
    if (!value) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (item.type === 'milestone') {
      updateItem(id, { startDate: value, endDate: value });
      return;
    }

    if (field === 'startDate') {
      // If end exists, keep end fixed (duration recalculates automatically in display)
      updateItem(id, { startDate: value });
    } else {
      updateItem(id, { endDate: value });
    }
  };

  const handleDurationChange = (id: string, days: number) => {
    if (days < 1) return;
    const item = items.find((i) => i.id === id);
    if (!item || item.type === 'milestone') return;

    // Keep start fixed, compute new end
    const newEnd = endFromDuration(item.startDate, days);
    updateItem(id, { endDate: newEnd });
  };

  // ─── Add items ──────────────────────────────────────────────────────

  const handleAddItemToSwimlane = (swimlaneId: string, type: ItemType) => {
    const today = new Date().toISOString().split('T')[0];
    addItem({
      name: type === 'task' ? 'New Task' : 'New Milestone',
      type,
      swimlaneId,
      startDate: today,
    });
  };

  const handleAddSwimlane = () => {
    addSwimlane('New Swimlane');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg)] relative">
      {/* Header with add button */}
      <div className="px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-end shrink-0">
        {/* Add dropdown */}
        <AddDropdownButton onAdd={(type) => {
          if (type === 'swimlane') {
            handleAddSwimlane();
          } else {
            const targetSwimlane = sortedSwimlanes[0]?.id;
            if (targetSwimlane) handleAddItemToSwimlane(targetSwimlane, type);
          }
        }} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-8"></th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-8">Vis</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-24">Type</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider min-w-[180px]">Name</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-32">Start</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-32">End</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-20">Duration</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-28">Progress</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-36">
                <div className="flex items-center gap-1">
                  Status
                  <button
                    onClick={() => setShowStatusConfig(!showStatusConfig)}
                    className="p-0.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    title="Configure status labels"
                  >
                    <Settings size={11} />
                  </button>
                </div>
              </th>
              <th className="text-left px-2 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sortedSwimlanes.map((swimlane) => {
              const swimItems = items
                .filter((i) => i.swimlaneId === swimlane.id)
                .sort((a, b) => a.row - b.row);
              const isCollapsed = collapsedSwimlanes.has(swimlane.id);

              return (
                <SwimlaneGroup
                  key={swimlane.id}
                  swimlane={swimlane}
                  items={swimItems}
                  statusLabels={statusLabels}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleCollapse(swimlane.id)}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                  onToggleVisibility={toggleVisibility}
                  onSelectItem={setSelectedItem}
                  selectedItemId={selectedItemId}
                  onDateChange={handleDateChange}
                  onDurationChange={handleDurationChange}
                  onUpdateSwimlane={updateSwimlane}
                  onUpdateTaskStyle={updateTaskStyle}
                  onUpdateMilestoneStyle={updateMilestoneStyle}
                  onAddItem={(type) => handleAddItemToSwimlane(swimlane.id, type)}
                />
              );
            })}

            {/* Bottom "Add Swimlane" row */}
            <tr>
              <td colSpan={TOTAL_COLUMNS} className="px-3 py-2">
                <button
                  onClick={handleAddSwimlane}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-indigo-600 transition-colors py-1"
                >
                  <Plus size={14} />
                  Add Swimlane
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Status Label Config Modal */}
      {showStatusConfig && (
        <StatusConfigPanel
          statusLabels={statusLabels}
          onAdd={addStatusLabel}
          onUpdate={updateStatusLabel}
          onRemove={removeStatusLabel}
          onClose={() => setShowStatusConfig(false)}
        />
      )}
    </div>
  );
}

// ─── Add Dropdown Button ─────────────────────────────────────────────────────

function AddDropdownButton({ onAdd }: { onAdd: (type: ItemType | 'swimlane') => void }) {
  const [open, setOpen] = useState(false);
  const [defaultAction, setDefaultAction] = useState<ItemType | 'swimlane'>('swimlane');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const labels: Record<string, string> = {
    swimlane: 'Add Swimlane',
    task: 'Add Task',
    milestone: 'Add Milestone',
  };

  const handlePrimary = () => {
    onAdd(defaultAction);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex">
        <button
          onClick={handlePrimary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-md text-xs font-medium bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
        >
          <Plus size={14} />
          {labels[defaultAction]}
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="px-1.5 py-1.5 rounded-r-md text-xs bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 transition-all border border-l-0 border-indigo-500/20"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-30 min-w-[160px]">
          {(['swimlane', 'task', 'milestone'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setDefaultAction(type);
                onAdd(type);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-surface-hover)] transition-colors ${
                defaultAction === type ? 'text-indigo-600 font-medium' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {labels[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Swimlane Group ──────────────────────────────────────────────────────────

interface SwimlaneGroupProps {
  swimlane: { id: string; name: string; color: string; order: number };
  items: ReturnType<typeof useProjectStore.getState>['items'];
  statusLabels: StatusLabel[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateItem: (id: string, updates: Record<string, unknown>) => void;
  onDeleteItem: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onSelectItem: (id: string | null) => void;
  selectedItemId: string | null;
  onDateChange: (id: string, field: 'startDate' | 'endDate', value: string) => void;
  onDurationChange: (id: string, days: number) => void;
  onUpdateSwimlane: (id: string, updates: Record<string, unknown>) => void;
  onUpdateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  onUpdateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  onAddItem: (type: ItemType) => void;
}

function SwimlaneGroup({
  swimlane,
  items: swimItems,
  statusLabels,
  isCollapsed,
  onToggleCollapse,
  onUpdateItem,
  onDeleteItem,
  onToggleVisibility,
  onSelectItem,
  selectedItemId,
  onDateChange,
  onDurationChange,
  onUpdateSwimlane,
  onUpdateTaskStyle,
  onUpdateMilestoneStyle,
  onAddItem,
}: SwimlaneGroupProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(swimlane.name);

  return (
    <>
      {/* Swimlane Header Row */}
      <tr
        className="bg-[var(--color-bg-tertiary)]/50 cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors"
        onClick={onToggleCollapse}
      >
        <td className="px-3 py-2" colSpan={TOTAL_COLUMNS}>
          <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: swimlane.color }} />
            {editingName ? (
              <input
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-0.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => {
                  onUpdateSwimlane(swimlane.id, { name: nameValue });
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateSwimlane(swimlane.id, { name: nameValue });
                    setEditingName(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                className="font-medium text-sm"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
              >
                {swimlane.name}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)] ml-1">({swimItems.length})</span>
          </div>
        </td>
      </tr>

      {/* Item Rows */}
      {!isCollapsed &&
        swimItems.map((item) => {
          const duration =
            item.type === 'milestone'
              ? null
              : computeDuration(item.startDate, item.endDate);

          const isSelected = selectedItemId === item.id;
          const statusLabel = statusLabels.find((s) => s.id === item.statusId) ?? null;

          return (
            <tr
              key={item.id}
              className={`group/row border-b border-[var(--color-border)]/30 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                  : 'hover:bg-[var(--color-surface-hover)]/50'
              } ${!item.visible ? 'opacity-40' : ''} ${item.isCriticalPath ? 'bg-red-50' : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              {/* Drag Handle */}
              <td className="px-2 py-1.5 text-[var(--color-text-muted)]">
                <GripVertical size={14} className="opacity-30 group-hover/row:opacity-60 transition-opacity cursor-grab" />
              </td>

              {/* Visibility */}
              <td className="px-2 py-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </td>

              {/* Type (picker) */}
              <td className="px-2 py-1.5">
                <TypePickerCell
                  item={item}
                  onUpdateItem={onUpdateItem}
                  onUpdateTaskStyle={onUpdateTaskStyle}
                  onUpdateMilestoneStyle={onUpdateMilestoneStyle}
                />
              </td>

              {/* Name */}
              <td className="px-3 py-1.5">
                <input
                  className="w-full bg-transparent border-none outline-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:bg-[var(--color-bg)] focus:px-2 focus:py-0.5 focus:rounded focus:border focus:border-[var(--color-border)] transition-all"
                  value={item.name}
                  onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>

              {/* Start Date */}
              <td className="px-2 py-1.5">
                <input
                  type="date"
                  className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 text-xs text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors [color-scheme:light] w-full"
                  value={item.startDate}
                  onChange={(e) => onDateChange(item.id, 'startDate', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>

              {/* End Date */}
              <td className="px-2 py-1.5">
                {item.type === 'milestone' ? (
                  <span className="text-xs text-[var(--color-text-muted)] px-1.5">&mdash;</span>
                ) : (
                  <input
                    type="date"
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 text-xs text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors [color-scheme:light] w-full"
                    value={item.endDate}
                    onChange={(e) => onDateChange(item.id, 'endDate', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </td>

              {/* Duration (editable for tasks) */}
              <td className="px-2 py-1.5">
                {item.type === 'milestone' ? (
                  <span className="text-xs text-[var(--color-text-muted)] px-1.5">&mdash;</span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      className="w-12 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 text-xs text-center text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
                      value={duration ?? ''}
                      min={1}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v >= 1) onDurationChange(item.id, v);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[10px] text-[var(--color-text-muted)]">d</span>
                  </div>
                )}
              </td>

              {/* Progress */}
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentComplete}%`,
                        backgroundColor: item.percentComplete === 100 ? '#22c55e' : item.taskStyle.color,
                      }}
                    />
                  </div>
                  <input
                    type="number"
                    className="w-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[11px] text-center text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
                    value={item.percentComplete}
                    min={0}
                    max={100}
                    onChange={(e) => onUpdateItem(item.id, { percentComplete: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">%</span>
                </div>
              </td>

              {/* Status */}
              <td className="px-2 py-1.5">
                <StatusDropdown
                  value={item.statusId}
                  statusLabels={statusLabels}
                  onChange={(statusId) => onUpdateItem(item.id, { statusId })}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>

              {/* Actions (hover only) */}
              <td className="px-2 py-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover/row:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          );
        })}

      {/* Add row (last row within each swimlane) */}
      {!isCollapsed && (
        <tr className="border-b border-[var(--color-border)]/20">
          <td colSpan={TOTAL_COLUMNS} className="px-3 py-1.5">
            <InlineAddRow onAdd={(type) => onAddItem(type)} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Inline Add Row ──────────────────────────────────────────────────────────

function InlineAddRow({ onAdd }: { onAdd: (type: ItemType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-indigo-600 transition-colors py-0.5"
      >
        <Plus size={13} />
        Add task or milestone
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
          <button
            onClick={() => { onAdd('task'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Add Task
          </button>
          <button
            onClick={() => { onAdd('milestone'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Add Milestone
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status Dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({
  value,
  statusLabels,
  onChange,
  onClick,
}: {
  value: string | null;
  statusLabels: StatusLabel[];
  onChange: (statusId: string | null) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const current = statusLabels.find((s) => s.id === value);

  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : v);
      }}
      onClick={onClick}
      className="w-full border rounded px-1.5 py-1 text-xs outline-none focus:border-indigo-500 transition-colors cursor-pointer"
      style={{
        backgroundColor: current ? `${current.color}15` : 'var(--color-bg)',
        borderColor: current ? `${current.color}40` : 'var(--color-border)',
        color: current ? current.color : 'var(--color-text-muted)',
        fontWeight: current ? 500 : 400,
      }}
    >
      <option value="">—</option>
      {statusLabels.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

// ─── Status Config Panel ─────────────────────────────────────────────────────

function StatusConfigPanel({
  statusLabels,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
}: {
  statusLabels: StatusLabel[];
  onAdd: (label: StatusLabel) => void;
  onUpdate: (id: string, updates: Partial<StatusLabel>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-0 right-0 top-0 w-[320px] bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-sm font-semibold text-[var(--color-text)]">Configure Status Labels</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {statusLabels.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              type="color"
              value={s.color}
              onChange={(e) => onUpdate(s.id, { color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border border-[var(--color-border)] shrink-0"
            />
            <input
              className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500"
              value={s.label}
              onChange={(e) => onUpdate(s.id, { label: e.target.value })}
            />
            <button
              onClick={() => onRemove(s.id)}
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onAdd({ id: uuid(), label: 'New Status', color: '#64748b' })}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-indigo-600 transition-colors py-1.5"
        >
          <Plus size={14} />
          Add Status Label
        </button>
      </div>
    </div>
  );
}
