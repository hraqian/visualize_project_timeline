import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { addDays, parseISO, differenceInDays, format } from 'date-fns';
import { v4 as uuid } from 'uuid';
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  X,
  Calendar,
  UserPlus,
  Copy,
  EyeOff,
  Paintbrush,
  Check,
  MoreHorizontal,
  CopyPlus,
  Eye,
  ListPlus,
} from 'lucide-react';
import { TypePickerCell } from './TypePicker';
import type { ItemType, StatusLabel, TaskStyle, MilestoneStyle, OptionalColumn, ProjectItem } from '@/types';
import { PRESET_COLORS } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeDuration(startDate: string, endDate: string): number {
  return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
}

function endFromDuration(startDate: string, days: number): string {
  return addDays(parseISO(startDate), Math.max(days - 1, 0)).toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MM/dd/yyyy');
}

// ─── Column definitions ──────────────────────────────────────────────────────

const OPTIONAL_COLUMN_LABELS: Record<OptionalColumn, string> = {
  percentComplete: '% Complete',
  assignedTo: 'Assigned To',
  status: 'Status',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ label, children, align = 'center' }: { label: string; children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  const positionClass =
    align === 'left' ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2';
  const arrowClass =
    align === 'left' ? 'left-3' :
    align === 'right' ? 'right-3' :
    'left-1/2 -translate-x-1/2';

  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className={`absolute top-full ${positionClass} mt-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50`}>
        {label}
        <div className={`absolute bottom-full ${arrowClass} -mb-px border-4 border-transparent border-b-slate-800`} />
      </div>
    </div>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
        checked || indeterminate
          ? 'bg-slate-700 border-slate-700 text-white'
          : 'border-slate-300 hover:border-slate-400 bg-white'
      } ${className ?? ''}`}
    >
      {checked && <Check size={12} strokeWidth={3} />}
      {indeterminate && !checked && (
        <div className="w-2 h-0.5 bg-white rounded-full" />
      )}
    </button>
  );
}

// ─── DataView ────────────────────────────────────────────────────────────────

export function DataView() {
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const statusLabels = useProjectStore((s) => s.statusLabels);
  const columnVisibility = useProjectStore((s) => s.columnVisibility);
  const checkedItemIds = useProjectStore((s) => s.checkedItemIds);
  const updateItem = useProjectStore((s) => s.updateItem);
  const deleteItem = useProjectStore((s) => s.deleteItem);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const addItem = useProjectStore((s) => s.addItem);
  const addItemRelative = useProjectStore((s) => s.addItemRelative);
  const duplicateItem = useProjectStore((s) => s.duplicateItem);
  const toggleVisibility = useProjectStore((s) => s.toggleVisibility);
  const addSwimlane = useProjectStore((s) => s.addSwimlane);
  const addSwimlaneRelative = useProjectStore((s) => s.addSwimlaneRelative);
  const duplicateSwimlane = useProjectStore((s) => s.duplicateSwimlane);
  const deleteSwimlane = useProjectStore((s) => s.deleteSwimlane);
  const hideSwimlaneItems = useProjectStore((s) => s.hideSwimlaneItems);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const addStatusLabel = useProjectStore((s) => s.addStatusLabel);
  const toggleColumn = useProjectStore((s) => s.toggleColumn);
  const toggleCheckedItem = useProjectStore((s) => s.toggleCheckedItem);
  const checkAllItems = useProjectStore((s) => s.checkAllItems);
  const uncheckAllItems = useProjectStore((s) => s.uncheckAllItems);
  const duplicateCheckedItems = useProjectStore((s) => s.duplicateCheckedItems);
  const hideCheckedItems = useProjectStore((s) => s.hideCheckedItems);
  const deleteCheckedItems = useProjectStore((s) => s.deleteCheckedItems);
  const setColorForCheckedItems = useProjectStore((s) => s.setColorForCheckedItems);
  const reorderSwimlane = useProjectStore((s) => s.reorderSwimlane);
  const moveItemToGroup = useProjectStore((s) => s.moveItemToGroup);

  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const [dragSwimId, setDragSwimId] = useState<string | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  // Global item drag state (lifted from per-group to support cross-group dragging)
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ swimlaneId: string | null; index: number } | null>(null);

  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);
  const swimlaneIds = new Set(swimlanes.map((s) => s.id));
  const independentItems = items
    .filter((i) => i.swimlaneId === null || !swimlaneIds.has(i.swimlaneId))
    .sort((a, b) => a.row - b.row);

  const hasChecked = checkedItemIds.length > 0;
  const allChecked = items.length > 0 && checkedItemIds.length === items.length;
  const someChecked = hasChecked && !allChecked;

  // Dynamic column count: always-on columns (checkbox/grip, title, type, duration, start, end) = 6
  // + optional columns + actions column + column-config column = +2
  const visibleOptionalCount = (columnVisibility.percentComplete ? 1 : 0)
    + (columnVisibility.assignedTo ? 1 : 0)
    + (columnVisibility.status ? 1 : 0);
  const totalColumns = 6 + visibleOptionalCount + 2; // 6 fixed + optionals + actions + config

  const toggleCollapse = (id: string) => {
    setCollapsedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDateChange = (id: string, field: 'startDate' | 'endDate', value: string) => {
    if (!value) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.type === 'milestone') {
      if (field === 'startDate') {
        // Move the milestone to the new date (keep start=end)
        updateItem(id, { startDate: value, endDate: value });
      } else {
        // End date changed on a milestone
        if (value === item.startDate) return; // no change
        if (parseISO(value) < parseISO(item.startDate)) {
          // End before start: move the milestone to this date
          updateItem(id, { startDate: value, endDate: value });
        } else {
          // End after start: convert to task
          updateItem(id, { type: 'task', endDate: value });
        }
      }
      return;
    }
    if (field === 'startDate') {
      // Preserve duration: shift end date by the same amount
      const currentDuration = differenceInDays(parseISO(item.endDate), parseISO(item.startDate));
      const newEnd = addDays(parseISO(value), currentDuration).toISOString().split('T')[0];
      updateItem(id, { startDate: value, endDate: newEnd });
    } else {
      // End date changed: preserve duration by shifting start date if needed
      if (parseISO(value) < parseISO(item.startDate)) {
        const currentDuration = differenceInDays(parseISO(item.endDate), parseISO(item.startDate));
        const dur = currentDuration > 0 ? currentDuration : 0;
        const newStart = addDays(parseISO(value), -dur).toISOString().split('T')[0];
        updateItem(id, { startDate: newStart, endDate: value });
      } else {
        updateItem(id, { endDate: value });
      }
    }
  };

  const handleDurationChange = (id: string, days: number) => {
    if (days < 0) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.type === 'milestone') {
      if (days === 0) return; // already a 0-duration milestone
      // Convert milestone to task when duration > 0
      const newEnd = endFromDuration(item.startDate, days);
      updateItem(id, { type: 'task', endDate: newEnd });
      return;
    }
    if (days < 1) return; // tasks must have at least 1-day duration
    const newEnd = endFromDuration(item.startDate, days);
    updateItem(id, { endDate: newEnd });
  };

  const handleAddItemToSwimlane = (swimlaneId: string, type: ItemType) => {
    const today = new Date().toISOString().split('T')[0];
    addItem({
      name: type === 'task' ? 'New Task' : 'New Milestone',
      type,
      swimlaneId,
      startDate: today,
    });
  };

  const handleAddIndependentItem = (type: ItemType) => {
    const today = new Date().toISOString().split('T')[0];
    addItem({
      name: type === 'task' ? 'New Task' : 'New Milestone',
      type,
      startDate: today,
    });
  };

  const handleAddSwimlane = () => {
    addSwimlane('New Swimlane');
  };

  const handleHeaderCheckbox = () => {
    if (allChecked || someChecked) {
      uncheckAllItems();
    } else {
      checkAllItems();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white relative">
      {/* Selection Toolbar — shown when items are checked */}
      {hasChecked && (
        <SelectionToolbar
          count={checkedItemIds.length}
          onDuplicate={duplicateCheckedItems}
          onHide={hideCheckedItems}
          onDelete={deleteCheckedItems}
          onSetColor={setColorForCheckedItems}
          onClose={uncheckAllItems}
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-10 px-1 py-2.5">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={handleHeaderCheckbox}
                />
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 tracking-wide min-w-[220px]">Title</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-24">Type</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-24">Duration</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-32">Start</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-32">End</th>
              {columnVisibility.percentComplete && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-16">%</th>
              )}
              {columnVisibility.assignedTo && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-36">Assigned To</th>
              )}
              {columnVisibility.status && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 tracking-wide w-36">Status</th>
              )}
              <th className="w-10 px-2 py-2.5" />
              <th className="w-10 px-1 py-2.5">
                <ColumnConfigButton
                  columnVisibility={columnVisibility}
                  onToggle={toggleColumn}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Independent items (no swimlane) */}
            <IndependentItemsGroup
              items={independentItems}
              statusLabels={statusLabels}
              columnVisibility={columnVisibility}
              totalColumns={totalColumns}
              checkedItemIds={checkedItemIds}
              onToggleChecked={toggleCheckedItem}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onSelectItem={setSelectedItem}
              selectedItemId={selectedItemId}
              onDateChange={handleDateChange}
              onDurationChange={handleDurationChange}
              onUpdateTaskStyle={updateTaskStyle}
              onUpdateMilestoneStyle={updateMilestoneStyle}
              onAddItem={handleAddIndependentItem}
              onAddStatusLabel={addStatusLabel}
              onAddItemRelative={addItemRelative}
              onDuplicateItem={duplicateItem}
              onToggleVisibility={toggleVisibility}
              dragItemId={dragItemId}
              dropTarget={dropTarget}
              onItemDragStart={(id) => setDragItemId(id)}
              onItemDragEnd={() => { setDragItemId(null); setDropTarget(null); }}
              onItemDragOver={(swimlaneId, index) => { if (dragItemId) setDropTarget({ swimlaneId, index }); }}
              onItemDrop={(swimlaneId, index) => {
                if (dragItemId) moveItemToGroup(dragItemId, swimlaneId, index);
                setDragItemId(null);
                setDropTarget(null);
              }}
            />

            {sortedSwimlanes.map((swimlane, idx) => {
              const swimItems = items
                .filter((i) => i.swimlaneId === swimlane.id)
                .sort((a, b) => a.row - b.row);
              const isCollapsed = collapsedSwimlanes.has(swimlane.id);

              return (
                <SwimlaneGroup
                  key={swimlane.id}
                  swimlane={swimlane}
                  swimlaneIndex={idx}
                  items={swimItems}
                  statusLabels={statusLabels}
                  columnVisibility={columnVisibility}
                  totalColumns={totalColumns}
                  isCollapsed={isCollapsed}
                  checkedItemIds={checkedItemIds}
                  onToggleChecked={toggleCheckedItem}
                  onToggleCollapse={() => toggleCollapse(swimlane.id)}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                  onSelectItem={setSelectedItem}
                  selectedItemId={selectedItemId}
                  onDateChange={handleDateChange}
                  onDurationChange={handleDurationChange}
                  onUpdateSwimlane={updateSwimlane}
                  onUpdateTaskStyle={updateTaskStyle}
                  onUpdateMilestoneStyle={updateMilestoneStyle}
                  onAddItem={(type) => handleAddItemToSwimlane(swimlane.id, type)}
                  onAddStatusLabel={addStatusLabel}
                  onAddItemRelative={addItemRelative}
                  onDuplicateItem={duplicateItem}
                  onToggleVisibility={toggleVisibility}
                  onAddSwimlaneRelative={(pos) => addSwimlaneRelative(swimlane.id, pos)}
                  onDuplicateSwimlane={() => duplicateSwimlane(swimlane.id)}
                  onDeleteSwimlane={() => {
                    const swimItemCount = items.filter((i) => i.swimlaneId === swimlane.id).length;
                    if (swimItemCount > 0) {
                      if (!window.confirm(`Delete "${swimlane.name}" and its ${swimItemCount} item${swimItemCount === 1 ? '' : 's'}? This cannot be undone.`)) return;
                    }
                    deleteSwimlane(swimlane.id);
                  }}
                   onHideSwimlaneItems={() => hideSwimlaneItems(swimlane.id)}
                   dragItemId={dragItemId}
                   dropTarget={dropTarget}
                   onItemDragStart={(id) => setDragItemId(id)}
                   onItemDragEnd={() => { setDragItemId(null); setDropTarget(null); }}
                   onItemDragOver={(swimlaneId, index) => { if (dragItemId) setDropTarget({ swimlaneId, index }); }}
                   onItemDrop={(swimlaneId, index) => {
                     if (dragItemId) moveItemToGroup(dragItemId, swimlaneId, index);
                     setDragItemId(null);
                     setDropTarget(null);
                   }}
                   isDragging={dragSwimId === swimlane.id}
                  isDropTarget={dropTargetIdx === idx}
                  onDragStart={() => setDragSwimId(swimlane.id)}
                  onDragEnd={() => { setDragSwimId(null); setDropTargetIdx(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSwimId && dragSwimId !== swimlane.id) setDropTargetIdx(idx); }}
                  onDrop={() => {
                    if (dragSwimId && dragSwimId !== swimlane.id) {
                      reorderSwimlane(dragSwimId, idx);
                    }
                    setDragSwimId(null);
                    setDropTargetIdx(null);
                  }}
                />
              );
            })}

            <tr>
              <td colSpan={totalColumns} className="pt-5 pb-4 px-4">
                <button
                  onClick={handleAddSwimlane}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 border border-slate-300 rounded-md px-3 py-1.5 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                >
                  <Plus size={14} />
                  Add Swimlane
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Selection Toolbar ──────────────────────────────────────────────────────

function SelectionToolbar({
  count,
  onDuplicate,
  onHide,
  onDelete,
  onSetColor,
  onClose,
}: {
  count: number;
  onDuplicate: () => void;
  onHide: () => void;
  onDelete: () => void;
  onSetColor: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="px-5 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1 shrink-0">
      {/* Action icons */}
      <div className="flex items-center gap-0.5">
        <Tooltip label="Duplicate selected" align="left">
          <button
            onClick={onDuplicate}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <Copy size={18} />
          </button>
        </Tooltip>

        <Tooltip label="Hide selected">
          <button
            onClick={onHide}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <EyeOff size={18} />
          </button>
        </Tooltip>

        <Tooltip label="Delete selected">
          <button
            onClick={onDelete}
            className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Color picker */}
      <div className="mx-1.5 w-px h-6 bg-slate-200" />
      <ColorPickerButton onSetColor={onSetColor} />

      {/* Spacer + count + close */}
      <div className="flex-1" />
      <span className="text-sm font-medium text-slate-600 mr-2">
        {count} selected
      </span>
      <Tooltip label="Clear selection">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={16} />
        </button>
      </Tooltip>
    </div>
  );
}

// ─── Color Picker Button ────────────────────────────────────────────────────

function ColorPickerButton({ onSetColor }: { onSetColor: (color: string) => void }) {
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
      <Tooltip label="Set color">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors text-xs font-medium"
        >
          <Paintbrush size={15} />
          Color
          <ChevronDown size={12} />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-40">
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onSetColor(color);
                  setOpen(false);
                }}
                className="w-7 h-7 rounded-md border border-slate-100 hover:scale-110 hover:shadow-md transition-all"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Column Config Button (+ with dropdown) ─────────────────────────────────

function ColumnConfigButton({
  columnVisibility,
  onToggle,
}: {
  columnVisibility: { percentComplete: boolean; assignedTo: boolean; status: boolean };
  onToggle: (column: OptionalColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const columns: OptionalColumn[] = ['percentComplete', 'assignedTo', 'status'];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 p-1 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
      >
        <Plus size={12} />
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-30 min-w-[180px]">
          <div className="px-3 pb-1.5 text-xs font-semibold text-slate-700">Columns</div>
          {columns.map((col) => (
            <button
              key={col}
              onClick={() => onToggle(col)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span>{OPTIONAL_COLUMN_LABELS[col]}</span>
              <ToggleSwitch on={columnVisibility[col]} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div
      className={`relative w-8 h-[18px] rounded-full transition-colors ${
        on ? 'bg-green-500' : 'bg-slate-200'
      }`}
    >
      <div
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-[14px]' : 'translate-x-0.5'
        }`}
      />
    </div>
  );
}

// ─── Add Dropdown Button ─────────────────────────────────────────────────────

export function AddDropdownButton({ onAdd }: { onAdd: (type: ItemType | 'swimlane') => void }) {
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

  return (
    <div className="relative" ref={ref}>
      <div className="flex">
        <button
          onClick={() => onAdd(defaultAction)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-md text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-200"
        >
          <Plus size={14} />
          {labels[defaultAction]}
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="px-1.5 py-1.5 rounded-r-md text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-l-0 border-indigo-200"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[160px]">
          {(['swimlane', 'task', 'milestone'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setDefaultAction(type);
                onAdd(type);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${
                defaultAction === type ? 'text-indigo-600 font-medium' : 'text-slate-500'
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

// ─── Independent Items Group ─────────────────────────────────────────────────

interface IndependentItemsGroupProps {
  items: ReturnType<typeof useProjectStore.getState>['items'];
  statusLabels: StatusLabel[];
  columnVisibility: { percentComplete: boolean; assignedTo: boolean; status: boolean };
  totalColumns: number;
  checkedItemIds: string[];
  onToggleChecked: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<ProjectItem>) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  onDateChange: (id: string, field: 'startDate' | 'endDate', value: string) => void;
  onDurationChange: (id: string, days: number) => void;
  onUpdateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  onUpdateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  onAddItem: (type: ItemType) => void;
  onAddStatusLabel: (name: string) => void;
  onAddItemRelative: (referenceId: string, position: 'above' | 'below') => void;
  onDuplicateItem: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  // Global drag state
  dragItemId: string | null;
  dropTarget: { swimlaneId: string | null; index: number } | null;
  onItemDragStart: (id: string) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (swimlaneId: string | null, index: number, e: React.DragEvent) => void;
  onItemDrop: (swimlaneId: string | null, index: number) => void;
}

function IndependentItemsGroup({
  items: indItems,
  statusLabels,
  columnVisibility,
  totalColumns,
  checkedItemIds,
  onToggleChecked,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  selectedItemId,
  onDateChange,
  onDurationChange,
  onUpdateTaskStyle,
  onUpdateMilestoneStyle,
  onAddItem,
  onAddStatusLabel,
  onAddItemRelative,
  onDuplicateItem,
  onToggleVisibility,
  dragItemId,
  dropTarget,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
}: IndependentItemsGroupProps) {
  return (
    <>
      {/* Drop zone when section is empty but an item is being dragged */}
      {indItems.length === 0 && dragItemId && (
        <tr
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onItemDragOver(null, 0, e); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onItemDrop(null, 0); }}
        >
          <td colSpan={totalColumns} className="py-2">
            <div className={`mx-4 rounded-lg border-2 border-dashed py-3 text-center text-xs transition-colors ${
              dropTarget?.swimlaneId === null ? 'border-indigo-400 bg-indigo-50 text-indigo-500' : 'border-slate-300 text-slate-400'
            }`}>
              Drop here to remove from swimlane
            </div>
          </td>
        </tr>
      )}

      {indItems.map((item, idx) => (
        <ItemRow
          key={item.id}
          item={item}
          statusLabels={statusLabels}
          columnVisibility={columnVisibility}
          isSelected={selectedItemId === item.id}
          isChecked={checkedItemIds.includes(item.id)}
          hasAnyChecked={checkedItemIds.length > 0}
          onToggleChecked={() => onToggleChecked(item.id)}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onSelectItem={onSelectItem}
          onDateChange={onDateChange}
          onDurationChange={onDurationChange}
          onUpdateTaskStyle={onUpdateTaskStyle}
          onUpdateMilestoneStyle={onUpdateMilestoneStyle}
          onAddStatusLabel={onAddStatusLabel}
          onAddItemRelative={onAddItemRelative}
          onDuplicateItem={onDuplicateItem}
          onToggleVisibility={onToggleVisibility}
          isItemDragging={dragItemId === item.id}
          isItemDropTarget={dropTarget?.swimlaneId === null && dropTarget?.index === idx}
          onItemDragStart={() => onItemDragStart(item.id)}
          onItemDragEnd={onItemDragEnd}
          onItemDragOver={(e) => { e.preventDefault(); if (dragItemId && dragItemId !== item.id) onItemDragOver(null, idx, e); }}
          onItemDrop={() => {
            if (dragItemId && dragItemId !== item.id) {
              onItemDrop(null, idx);
            }
          }}
        />
      ))}

      {/* Add row for independent items */}
      <tr>
        <td colSpan={totalColumns} className="pl-6 pr-4 py-1.5">
          <InlineAddRow onAdd={(type) => onAddItem(type)} />
        </td>
      </tr>

      {/* Separator before swimlanes */}
      {(indItems.length > 0 || dragItemId) && (
        <tr>
          <td colSpan={totalColumns} className="py-1">
            <div className="h-px bg-slate-200" />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Swimlane Group ──────────────────────────────────────────────────────────

interface SwimlaneGroupProps {
  swimlane: { id: string; name: string; color: string; order: number };
  items: ReturnType<typeof useProjectStore.getState>['items'];
  statusLabels: StatusLabel[];
  columnVisibility: { percentComplete: boolean; assignedTo: boolean; status: boolean };
  totalColumns: number;
  isCollapsed: boolean;
  checkedItemIds: string[];
  onToggleChecked: (id: string) => void;
  onToggleCollapse: () => void;
  onUpdateItem: (id: string, updates: Record<string, unknown>) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (id: string | null) => void;
  selectedItemId: string | null;
  onDateChange: (id: string, field: 'startDate' | 'endDate', value: string) => void;
  onDurationChange: (id: string, days: number) => void;
  onUpdateSwimlane: (id: string, updates: Record<string, unknown>) => void;
  onUpdateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  onUpdateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  onAddItem: (type: ItemType) => void;
  onAddStatusLabel: (label: StatusLabel) => void;
  onAddItemRelative: (referenceId: string, position: 'above' | 'below') => void;
  onDuplicateItem: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onAddSwimlaneRelative: (position: 'above' | 'below') => void;
  onDuplicateSwimlane: () => void;
  onDeleteSwimlane: () => void;
  onHideSwimlaneItems: () => void;
  // Global item drag state
  dragItemId: string | null;
  dropTarget: { swimlaneId: string | null; index: number } | null;
  onItemDragStart: (id: string) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (swimlaneId: string | null, index: number, e: React.DragEvent) => void;
  onItemDrop: (swimlaneId: string | null, index: number) => void;
  swimlaneIndex: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function SwimlaneGroup({
  swimlane,
  items: swimItems,
  statusLabels,
  columnVisibility,
  totalColumns,
  isCollapsed,
  checkedItemIds,
  onToggleChecked,
  onToggleCollapse,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  selectedItemId,
  onDateChange,
  onDurationChange,
  onUpdateSwimlane,
  onUpdateTaskStyle,
  onUpdateMilestoneStyle,
  onAddItem,
  onAddStatusLabel,
  onAddItemRelative,
  onDuplicateItem,
  onToggleVisibility,
  onAddSwimlaneRelative,
  onDuplicateSwimlane,
  onDeleteSwimlane,
  onHideSwimlaneItems,
  dragItemId,
  dropTarget,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
  swimlaneIndex,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: SwimlaneGroupProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(swimlane.name);

  return (
    <>
      {/* Drop indicator line */}
      {isDropTarget && (
        <tr>
          <td colSpan={totalColumns} className="p-0">
            <div className="h-0.5 bg-indigo-500 rounded-full" />
          </td>
        </tr>
      )}

      {/* Swimlane Header Row */}
      <tr
        className={`group/swimlane cursor-pointer hover:bg-slate-50 transition-colors ${isDragging ? 'opacity-50' : ''} ${dragItemId && !isDragging ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
        onClick={onToggleCollapse}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          // Item drag takes priority over swimlane drag
          if (dragItemId) {
            onItemDragOver(swimlane.id, 0, e);
          } else {
            onDragOver(e);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragItemId) {
            onItemDrop(swimlane.id, 0);
          } else {
            onDrop();
          }
        }}
      >
        <td className="py-2.5" colSpan={totalColumns}>
          <div className="flex items-center gap-2 px-4" style={{ borderLeft: `3px solid ${swimlane.color}` }}>
            <GripVertical
              size={14}
              className="text-slate-300 opacity-0 group-hover/swimlane:opacity-100 transition-opacity cursor-grab shrink-0"
            />
            <div>
              {isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </div>
            {editingName ? (
              <input
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[13px] font-semibold text-slate-800 outline-none focus:border-indigo-500"
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
                className="font-semibold text-[13px] text-slate-700"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
              >
                {swimlane.name}
              </span>
            )}

            {/* More menu — visible on hover */}
            <div className="opacity-0 group-hover/swimlane:opacity-100 transition-opacity ml-1">
              <SwimlaneMoreMenu
                onAddAbove={() => onAddSwimlaneRelative('above')}
                onAddBelow={() => onAddSwimlaneRelative('below')}
                onDuplicate={onDuplicateSwimlane}
                onHideFromTimeline={onHideSwimlaneItems}
                onDelete={onDeleteSwimlane}
              />
            </div>

            <span className="text-[11px] text-slate-400 ml-auto">({swimItems.length})</span>
          </div>
        </td>
      </tr>

      {/* Item Rows */}
      {!isCollapsed &&
        swimItems.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            statusLabels={statusLabels}
            columnVisibility={columnVisibility}
            isSelected={selectedItemId === item.id}
            isChecked={checkedItemIds.includes(item.id)}
            hasAnyChecked={checkedItemIds.length > 0}
            onToggleChecked={() => onToggleChecked(item.id)}
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
            onSelectItem={onSelectItem}
            onDateChange={onDateChange}
            onDurationChange={onDurationChange}
            onUpdateTaskStyle={onUpdateTaskStyle}
            onUpdateMilestoneStyle={onUpdateMilestoneStyle}
            onAddStatusLabel={onAddStatusLabel}
            onAddItemRelative={onAddItemRelative}
            onDuplicateItem={onDuplicateItem}
            onToggleVisibility={onToggleVisibility}
            isItemDragging={dragItemId === item.id}
            isItemDropTarget={dropTarget?.swimlaneId === swimlane.id && dropTarget?.index === idx}
            onItemDragStart={() => onItemDragStart(item.id)}
            onItemDragEnd={onItemDragEnd}
            onItemDragOver={(e) => { e.preventDefault(); if (dragItemId && dragItemId !== item.id) onItemDragOver(swimlane.id, idx, e); }}
            onItemDrop={() => {
              if (dragItemId && dragItemId !== item.id) {
                onItemDrop(swimlane.id, idx);
              }
            }}
          />
        ))}

      {/* Add row */}
      {!isCollapsed && (
        <tr>
          <td colSpan={totalColumns} className="pl-14 pr-4 py-1.5">
            <InlineAddRow onAdd={(type) => onAddItem(type)} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Item Row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ReturnType<typeof useProjectStore.getState>['items'][0];
  statusLabels: StatusLabel[];
  columnVisibility: { percentComplete: boolean; assignedTo: boolean; status: boolean };
  isSelected: boolean;
  isChecked: boolean;
  hasAnyChecked: boolean;
  onToggleChecked: () => void;
  onUpdateItem: (id: string, updates: Record<string, unknown>) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (id: string | null) => void;
  onDateChange: (id: string, field: 'startDate' | 'endDate', value: string) => void;
  onDurationChange: (id: string, days: number) => void;
  onUpdateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  onUpdateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
  onAddStatusLabel: (label: StatusLabel) => void;
  onAddItemRelative: (referenceId: string, position: 'above' | 'below') => void;
  onDuplicateItem: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  isItemDragging: boolean;
  isItemDropTarget: boolean;
  onItemDragStart: () => void;
  onItemDragEnd: () => void;
  onItemDragOver: (e: React.DragEvent) => void;
  onItemDrop: () => void;
}

function ItemRow({
  item,
  statusLabels,
  columnVisibility,
  isSelected,
  isChecked,
  hasAnyChecked,
  onToggleChecked,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  onDateChange,
  onDurationChange,
  onUpdateTaskStyle,
  onUpdateMilestoneStyle,
  onAddStatusLabel,
  onAddItemRelative,
  onDuplicateItem,
  onToggleVisibility,
  isItemDragging,
  isItemDropTarget,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
}: ItemRowProps) {
  const duration = item.type === 'milestone' ? 0 : computeDuration(item.startDate, item.endDate);

  const [editingDuration, setEditingDuration] = useState(false);
  const [durationValue, setDurationValue] = useState(String(duration));
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(String(item.percentComplete));
  const [editingAssigned, setEditingAssigned] = useState(false);
  const [assignedValue, setAssignedValue] = useState(item.assignedTo);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {isItemDropTarget && (
        <tr>
          <td colSpan={100} className="p-0">
            <div className="h-0.5 bg-indigo-500 rounded-full" />
          </td>
        </tr>
      )}
      <tr
        className={`group/row transition-colors cursor-pointer border-b border-slate-100 ${
          isChecked ? 'bg-indigo-50/60' : isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
        } ${isItemDragging ? 'opacity-50' : ''}`}
        onClick={() => onSelectItem(item.id)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.stopPropagation();
          onItemDragStart();
        }}
        onDragEnd={onItemDragEnd}
        onDragOver={(e) => { e.stopPropagation(); onItemDragOver(e); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onItemDrop(); }}
      >
      {/* Checkbox / Grip Handle */}
      <td className="px-1 py-2 text-center">
        {hasAnyChecked || isChecked ? (
          <Checkbox checked={isChecked} onChange={onToggleChecked} />
        ) : (
          <div className="relative w-[18px] h-[18px] mx-auto">
            {/* Show grip by default on hover, checkbox on hover of the grip area */}
            <GripVertical
              size={14}
              className="text-slate-300 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab absolute inset-0 m-auto group-hover/checkbox:opacity-0"
            />
            <div className="opacity-0 group-hover/row:opacity-0 hover:!opacity-100 absolute inset-0">
              <Checkbox checked={false} onChange={onToggleChecked} />
            </div>
          </div>
        )}
      </td>

      {/* Title */}
      <td className="px-4 py-2">
        <input
          className="w-full bg-transparent border-none outline-none text-xs text-slate-700 placeholder-slate-300 focus:bg-white focus:ring-1 focus:ring-indigo-300 focus:px-2 focus:py-0.5 focus:rounded transition-all"
          value={item.name}
          onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      {/* Type */}
      <td className="px-3 py-2">
        <TypePickerCell
          item={item}
          onUpdateItem={onUpdateItem}
          onUpdateTaskStyle={onUpdateTaskStyle}
          onUpdateMilestoneStyle={onUpdateMilestoneStyle}
        />
      </td>

      {/* Duration */}
      <td className="px-3 py-2">
        {editingDuration ? (
          <input
            type="number"
            className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-indigo-500"
            value={durationValue}
            min={0}
            autoFocus
            onChange={(e) => setDurationValue(e.target.value)}
            onBlur={() => {
              const v = parseInt(durationValue);
              if (!isNaN(v) && v >= 0) onDurationChange(item.id, v);
              setEditingDuration(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseInt(durationValue);
                if (!isNaN(v) && v >= 0) onDurationChange(item.id, v);
                setEditingDuration(false);
              }
              if (e.key === 'Escape') setEditingDuration(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-[11px] text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setDurationValue(String(duration));
              setEditingDuration(true);
            }}
          >
            {duration} days
          </span>
        )}
      </td>

      {/* Start Date */}
      <td className="px-3 py-2">
        <div className="relative flex items-center gap-1.5">
          <span
            className="text-[11px] text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              startDateRef.current?.showPicker();
            }}
          >
            {formatDate(item.startDate)}
          </span>
          <Calendar
            size={12}
            className="text-slate-300 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              startDateRef.current?.showPicker();
            }}
          />
          <input
            ref={startDateRef}
            type="date"
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            value={item.startDate}
            onChange={(e) => onDateChange(item.id, 'startDate', e.target.value)}
            tabIndex={-1}
          />
        </div>
      </td>

      {/* End Date */}
      <td className="px-3 py-2">
        <div className="relative flex items-center gap-1.5">
          <span
            className="text-[11px] text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              endDateRef.current?.showPicker();
            }}
          >
            {formatDate(item.endDate)}
          </span>
          <Calendar
            size={12}
            className="text-slate-300 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              endDateRef.current?.showPicker();
            }}
          />
          <input
            ref={endDateRef}
            type="date"
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            value={item.endDate}
            onChange={(e) => onDateChange(item.id, 'endDate', e.target.value)}
            tabIndex={-1}
          />
        </div>
      </td>

      {/* Progress */}
      {columnVisibility.percentComplete && (
        <td className="px-3 py-2">
          {editingProgress ? (
            <input
              type="number"
              className="w-14 bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-indigo-500"
              value={progressValue}
              min={0}
              max={100}
              autoFocus
              onChange={(e) => setProgressValue(e.target.value)}
              onBlur={() => {
                const v = Math.min(100, Math.max(0, parseInt(progressValue) || 0));
                onUpdateItem(item.id, { percentComplete: v });
                setEditingProgress(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Math.min(100, Math.max(0, parseInt(progressValue) || 0));
                  onUpdateItem(item.id, { percentComplete: v });
                  setEditingProgress(false);
                }
                if (e.key === 'Escape') setEditingProgress(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
            className="text-[11px] text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setProgressValue(String(item.percentComplete));
              setEditingProgress(true);
              }}
            >
              {item.percentComplete}%
            </span>
          )}
        </td>
      )}

      {/* Assigned To */}
      {columnVisibility.assignedTo && (
        <td className="px-3 py-2">
          {editingAssigned ? (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-indigo-500"
              value={assignedValue}
              placeholder="Type a name..."
              autoFocus
              onChange={(e) => setAssignedValue(e.target.value)}
              onBlur={() => {
                onUpdateItem(item.id, { assignedTo: assignedValue.trim() });
                setEditingAssigned(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateItem(item.id, { assignedTo: assignedValue.trim() });
                  setEditingAssigned(false);
                }
                if (e.key === 'Escape') {
                  setAssignedValue(item.assignedTo);
                  setEditingAssigned(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : item.assignedTo ? (
            <span
            className="text-[11px] text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setAssignedValue(item.assignedTo);
              setEditingAssigned(true);
              }}
            >
              {item.assignedTo}
            </span>
          ) : (
            <button
              className="flex items-center justify-center w-full h-6 border border-dashed border-slate-200 rounded text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setAssignedValue('');
                setEditingAssigned(true);
              }}
            >
              <UserPlus size={12} className="opacity-0 group-hover/row:opacity-100 transition-opacity" />
            </button>
          )}
        </td>
      )}

      {/* Status */}
      {columnVisibility.status && (
         <td className="px-3 py-2">
          <StatusCell
            statusId={item.statusId}
            statusLabels={statusLabels}
            onChange={(statusId) => onUpdateItem(item.id, { statusId })}
            onAddStatusLabel={onAddStatusLabel}
          />
        </td>
      )}

      {/* Actions — hover only: trash + more menu */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 size={14} />
          </button>
          <RowMoreMenu
            itemId={item.id}
            isVisible={item.visible}
            onAddAbove={() => onAddItemRelative(item.id, 'above')}
            onAddBelow={() => onAddItemRelative(item.id, 'below')}
            onDuplicate={() => onDuplicateItem(item.id)}
            onToggleVisibility={() => onToggleVisibility(item.id)}
            onDelete={() => onDeleteItem(item.id)}
          />
        </div>
      </td>

      {/* Column config spacer */}
      <td className="w-10" />
    </tr>
    </>
  );
}

// ─── Row More Menu ───────────────────────────────────────────────────────────

function RowMoreMenu({
  itemId,
  isVisible,
  onAddAbove,
  onAddBelow,
  onDuplicate,
  onToggleVisibility,
  onDelete,
}: {
  itemId: string;
  isVisible: boolean;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menuItems = [
    { icon: <ListPlus size={15} className="rotate-180" />, label: 'Add row above', action: onAddAbove },
    { icon: <ListPlus size={15} />, label: 'Add row below', action: onAddBelow },
    { icon: <CopyPlus size={15} />, label: 'Duplicate', action: onDuplicate },
    { icon: isVisible ? <EyeOff size={15} /> : <Eye size={15} />, label: isVisible ? 'Hide from timeline' : 'Show in timeline', action: onToggleVisibility },
    { icon: <Trash2 size={15} />, label: 'Delete row', action: onDelete, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <Tooltip label="More" align="right">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          <MoreHorizontal size={14} />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40 min-w-[200px]">
          {menuItems.map((mi, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                mi.action();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors ${
                mi.danger
                  ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-slate-400 shrink-0">{mi.icon}</span>
              {mi.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Swimlane More Menu ──────────────────────────────────────────────────────

function SwimlaneMoreMenu({
  onAddAbove,
  onAddBelow,
  onDuplicate,
  onHideFromTimeline,
  onDelete,
}: {
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDuplicate: () => void;
  onHideFromTimeline: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 220; // approximate height of 5 menu items
      setFlipUp(rect.bottom + menuHeight > window.innerHeight);
    }
    setOpen(!open);
  };

  const menuItems = [
    { icon: <ListPlus size={15} className="rotate-180" />, label: 'Add Swimlane above', action: onAddAbove },
    { icon: <ListPlus size={15} />, label: 'Add Swimlane below', action: onAddBelow },
    { icon: <CopyPlus size={15} />, label: 'Duplicate Swimlane', action: onDuplicate },
    { icon: <EyeOff size={15} />, label: 'Hide from timeline', action: onHideFromTimeline },
    { icon: <Trash2 size={15} />, label: 'Delete Swimlane', action: onDelete, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className={`absolute left-0 ${flipUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40 min-w-[220px]`}>
          {menuItems.map((mi, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                mi.action();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors ${
                mi.danger
                  ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-slate-400 shrink-0">{mi.icon}</span>
              {mi.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status Cell ─────────────────────────────────────────────────────────────

function StatusCell({
  statusId,
  statusLabels,
  onChange,
  onAddStatusLabel,
}: {
  statusId: string | null;
  statusLabels: StatusLabel[];
  onChange: (statusId: string | null) => void;
  onAddStatusLabel: (label: StatusLabel) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLabel = statusLabels.find((s) => s.id === statusId) ?? null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = () => {
    const color = PRESET_COLORS[statusLabels.length % PRESET_COLORS.length];
    const newLabel: StatusLabel = { id: uuid(), label: 'New Status', color };
    onAddStatusLabel(newLabel);
    onChange(newLabel.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      {currentLabel ? (
        <button
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all hover:opacity-80"
          style={{
            backgroundColor: `${currentLabel.color}15`,
            color: currentLabel.color,
            border: `1px solid ${currentLabel.color}30`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: currentLabel.color }}
          />
          {currentLabel.label}
        </button>
      ) : (
        <button
          className="flex items-center justify-center w-full h-6 border border-dashed border-slate-200 rounded text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Plus size={12} className="opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 min-w-[180px] overflow-hidden">
          {/* Status list */}
          <div className="py-1 max-h-[200px] overflow-y-auto">
            {currentLabel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 transition-colors"
              >
                Clear status
              </button>
            )}

            {statusLabels.map((s) => (
              <button
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2.5"
              >
                <span
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className={`text-slate-700 ${s.id === statusId ? 'font-semibold' : ''}`}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>

          {/* Create new status */}
          <div className="border-t border-slate-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreate();
              }}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Plus size={13} className="text-slate-400" />
              Create new status
            </button>
          </div>
        </div>
      )}
    </div>
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
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors py-0.5"
      >
        <Plus size={13} />
        Add task or milestone
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
          <button
            onClick={() => { onAdd('task'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Add Task
          </button>
          <button
            onClick={() => { onAdd('milestone'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Add Milestone
          </button>
        </div>
      )}
    </div>
  );
}
