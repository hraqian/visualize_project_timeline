import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { addDays, parseISO, differenceInDays, format } from 'date-fns';
import { v4 as uuid } from 'uuid';
import {
  Trash2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
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
  ListChecks,
  Pencil,
} from 'lucide-react';
import { TypePickerCell } from './TypePicker';
import type { ItemType, StatusLabel, TaskStyle, MilestoneStyle, OptionalColumn, ProjectItem, ColumnVisibility, Dependency } from '@/types';
import { PRESET_COLORS } from '@/types';
import { buildRowNumberMap, formatItemDependencies, parseDependencyShorthand, shorthandToDependencies, validateDependencyShorthand } from '@/utils';
import { DependencyEditorModal } from '@/components/common/DependencyEditorModal';

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
  predecessors: 'Predecessors',
};

// ─── Navigable column IDs (in visual order) ─────────────────────────────────

type CellColumn = 'title' | 'type' | 'duration' | 'startDate' | 'endDate' | 'percentComplete' | 'assignedTo' | 'status' | 'predecessors';

const FIXED_COLUMNS: CellColumn[] = ['title', 'type', 'duration', 'startDate', 'endDate'];
const OPTIONAL_COLUMNS_ORDER: CellColumn[] = ['percentComplete', 'assignedTo', 'status', 'predecessors'];

function getNavigableColumns(columnVisibility: ColumnVisibility): CellColumn[] {
  const cols = [...FIXED_COLUMNS];
  for (const col of OPTIONAL_COLUMNS_ORDER) {
    if (col in columnVisibility && columnVisibility[col as keyof ColumnVisibility]) {
      cols.push(col);
    }
  }
  return cols;
}

interface FocusedCell {
  itemId: string;
  column: CellColumn;
}

interface FlatItem {
  itemId: string;
  swimlaneId: string | null;
}

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
      className={`w-[18px] h-[18px] border-2 flex items-center justify-center transition-colors shrink-0 ${
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
  const dependencies = useProjectStore((s) => s.dependencies);
  const setItemDependencies = useProjectStore((s) => s.setItemDependencies);

  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const [dragSwimId, setDragSwimId] = useState<string | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  // Auto-focus the name input of a newly added item
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  // Auto-focus the name of a newly added swimlane
  const [focusSwimlaneId, setFocusSwimlaneId] = useState<string | null>(null);

  // Global item drag state (lifted from per-group to support cross-group dragging)
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ swimlaneId: string | null; index: number } | null>(null);

  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);
  const swimlaneIds = new Set(swimlanes.map((s) => s.id));
  const independentItems = items
    .filter((i) => i.swimlaneId === null || !swimlaneIds.has(i.swimlaneId))
    .sort((a, b) => a.row - b.row);

  // ─── Cell navigation system ──────────────────────────────────────────
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [editingCell, setEditingCell] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const navigableColumns = useMemo(() => getNavigableColumns(columnVisibility), [columnVisibility]);

  // Flat ordered list of all visible items (independent first, then swimlanes in order)
  const flatItemOrder = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = [];
    for (const item of independentItems) {
      result.push({ itemId: item.id, swimlaneId: null });
    }
    for (const sw of sortedSwimlanes) {
      if (collapsedSwimlanes.has(sw.id)) continue;
      const swimItems = items.filter((i) => i.swimlaneId === sw.id).sort((a, b) => a.row - b.row);
      for (const item of swimItems) {
        result.push({ itemId: item.id, swimlaneId: sw.id });
      }
    }
    return result;
  }, [independentItems, sortedSwimlanes, items, collapsedSwimlanes]);

  // Find which swimlane an item belongs to in the flat order
  const getSwimlaneForItem = useCallback((itemId: string): string | null => {
    const entry = flatItemOrder.find((f) => f.itemId === itemId);
    return entry?.swimlaneId ?? null;
  }, [flatItemOrder]);

  // Check if an item is the last in its swimlane/group
  const isLastInGroup = useCallback((itemId: string): boolean => {
    const entry = flatItemOrder.find((f) => f.itemId === itemId);
    if (!entry) return false;
    const swimlaneId = entry.swimlaneId;
    const groupItems = flatItemOrder.filter((f) => f.swimlaneId === swimlaneId);
    return groupItems[groupItems.length - 1]?.itemId === itemId;
  }, [flatItemOrder]);

  const navigateCell = useCallback((direction: 'next' | 'prev' | 'down' | 'up', currentCell: FocusedCell): FocusedCell | 'create-task' | null => {
    const colIdx = navigableColumns.indexOf(currentCell.column);
    const rowIdx = flatItemOrder.findIndex((f) => f.itemId === currentCell.itemId);
    if (colIdx === -1 || rowIdx === -1) return null;

    if (direction === 'next') {
      if (colIdx < navigableColumns.length - 1) {
        return { itemId: currentCell.itemId, column: navigableColumns[colIdx + 1] };
      }
      // Last column — check if this is the last item in its group
      if (isLastInGroup(currentCell.itemId)) {
        return 'create-task';
      }
      // Move to first column of next row
      if (rowIdx < flatItemOrder.length - 1) {
        return { itemId: flatItemOrder[rowIdx + 1].itemId, column: navigableColumns[0] };
      }
      return 'create-task';
    }

    if (direction === 'prev') {
      if (colIdx > 0) {
        return { itemId: currentCell.itemId, column: navigableColumns[colIdx - 1] };
      }
      // First column — move to last column of previous row
      if (rowIdx > 0) {
        return { itemId: flatItemOrder[rowIdx - 1].itemId, column: navigableColumns[navigableColumns.length - 1] };
      }
      // Already at very top-left — do nothing
      return null;
    }

    if (direction === 'down') {
      if (rowIdx < flatItemOrder.length - 1) {
        // Check if next item is in same group or different group
        const currentSwimlane = flatItemOrder[rowIdx].swimlaneId;
        const nextSwimlane = flatItemOrder[rowIdx + 1].swimlaneId;
        if (currentSwimlane === nextSwimlane) {
          return { itemId: flatItemOrder[rowIdx + 1].itemId, column: currentCell.column };
        }
        // We crossed a swimlane boundary — this means current item is last in its group
        return 'create-task';
      }
      // Last item overall — create task
      return 'create-task';
    }

    if (direction === 'up') {
      if (rowIdx > 0) {
        return { itemId: flatItemOrder[rowIdx - 1].itemId, column: currentCell.column };
      }
      return null;
    }

    return null;
  }, [navigableColumns, flatItemOrder]);

  // Create a new task in the appropriate group and focus its title (or specific column)
  const createTaskInGroup = useCallback((swimlaneId: string | null, focusColumn?: CellColumn): void => {
    const today = new Date().toISOString().split('T')[0];
    const id = addItem({
      name: 'New Task',
      type: 'task' as const,
      swimlaneId: swimlaneId ?? undefined,
      startDate: today,
    });
    // Use requestAnimationFrame to wait for the new item to render
    const targetCol = focusColumn ?? 'title';
    requestAnimationFrame(() => {
      setFocusedCell({ itemId: id, column: targetCol });
      if (targetCol === 'title') {
        setEditingCell(true);
        setFocusItemId(id); // This triggers the auto-focus/select behavior in ItemRow
      }
    });
  }, [addItem]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, cell: FocusedCell, isEditing: boolean) => {
    const { key, shiftKey } = e;

    if (key === 'Tab') {
      e.preventDefault();
      const result = navigateCell(shiftKey ? 'prev' : 'next', cell);
      if (result === 'create-task') {
        const swimlaneId = getSwimlaneForItem(cell.itemId);
        createTaskInGroup(swimlaneId, navigableColumns[0]);
      } else if (result) {
        setFocusedCell(result);
        setEditingCell(false);
      }
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      // Commit current cell and move down
      const result = navigateCell('down', cell);
      if (result === 'create-task') {
        const swimlaneId = getSwimlaneForItem(cell.itemId);
        createTaskInGroup(swimlaneId, cell.column);
      } else if (result) {
        setFocusedCell(result);
        setEditingCell(false);
      }
      return;
    }

    if (key === 'Escape') {
      setEditingCell(false);
      return;
    }

    // Left/Right only navigate when NOT editing
    if (!isEditing) {
      if (key === 'ArrowRight') {
        e.preventDefault();
        const result = navigateCell('next', cell);
        if (result === 'create-task') {
          const swimlaneId = getSwimlaneForItem(cell.itemId);
          createTaskInGroup(swimlaneId, navigableColumns[0]);
        } else if (result) {
          setFocusedCell(result);
          setEditingCell(false);
        }
        return;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        const result = navigateCell('prev', cell);
        if (result && result !== 'create-task') {
          setFocusedCell(result);
          setEditingCell(false);
        }
        return;
      }
    }
  }, [navigateCell, getSwimlaneForItem, createTaskInGroup, navigableColumns]);

  // Click-outside: clear focus when clicking outside the table
  useEffect(() => {
    if (!focusedCell) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(e.target as Node)) {
        setFocusedCell(null);
        setEditingCell(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [focusedCell]);

  // Row number map: item ID -> 1-based display index (for dependency shorthand)
  const rowNumberMap = useMemo(
    () => buildRowNumberMap(items, swimlanes),
    [items, swimlanes]
  );

  // Dependency editor modal state
  const [depEditorItemId, setDepEditorItemId] = useState<string | null>(null);

  const handleDependencyChange = useCallback((itemId: string, shorthand: string) => {
    const parsed = parseDependencyShorthand(shorthand);
    const newDeps = shorthandToDependencies(parsed, itemId, rowNumberMap, dependencies);
    setItemDependencies(itemId, newDeps);
  }, [rowNumberMap, dependencies, setItemDependencies]);

  const hasChecked = checkedItemIds.length > 0;
  const allChecked = items.length > 0 && checkedItemIds.length === items.length;
  const someChecked = hasChecked && !allChecked;

  // Dynamic column count: always-on columns (checkbox/grip, title, type, duration, start, end) = 6
  // + optional columns + actions column + column-config column = +2
  const visibleOptionalCount = (columnVisibility.percentComplete ? 1 : 0)
    + (columnVisibility.assignedTo ? 1 : 0)
    + (columnVisibility.status ? 1 : 0)
    + (columnVisibility.predecessors ? 1 : 0);
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
    const id = addItem({
      name: type === 'task' ? 'New Task' : 'New Milestone',
      type,
      swimlaneId,
      startDate: today,
    });
    setFocusItemId(id);
    requestAnimationFrame(() => {
      setFocusedCell({ itemId: id, column: 'title' });
      setEditingCell(true);
    });
  };

  const handleAddIndependentItem = (type: ItemType) => {
    const today = new Date().toISOString().split('T')[0];
    const id = addItem({
      name: type === 'task' ? 'New Task' : 'New Milestone',
      type,
      startDate: today,
    });
    setFocusItemId(id);
    requestAnimationFrame(() => {
      setFocusedCell({ itemId: id, column: 'title' });
      setEditingCell(true);
    });
  };

  const handleAddSwimlane = () => {
    const id = addSwimlane('New Swimlane');
    setFocusSwimlaneId(id);
  };

  const handleHeaderCheckbox = () => {
    if (allChecked || someChecked) {
      uncheckAllItems();
    } else {
      checkAllItems();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white relative p-4 pt-3">
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
      <div ref={tableContainerRef} className="flex-1 overflow-auto scrollbar-thin border border-slate-200 rounded-lg">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <th className="pl-5 pr-0 py-2.5" style={{ width: '38px' }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={handleHeaderCheckbox}
                />
              </th>
              <th className="text-left pl-3 pr-4 py-2.5 text-xs font-medium text-slate-600 min-w-[220px]">Title</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-24">Type</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-24">Duration</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-32">Start</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-32">End</th>
              {columnVisibility.percentComplete && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-28 whitespace-nowrap">% Complete</th>
              )}
              {columnVisibility.assignedTo && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-36">Assigned To</th>
              )}
              {columnVisibility.status && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-36">Status</th>
              )}
              {columnVisibility.predecessors && (
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 w-36">Predecessors</th>
              )}
              <th className="w-10 px-2 py-2.5" />
              <th className="px-3 py-2.5">
                <ColumnConfigButton
                  columnVisibility={columnVisibility}
                  onToggle={toggleColumn}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Spacer below header */}
            <tr><td colSpan={totalColumns} className="h-1.5 p-0" /></tr>
            {/* Independent items (no swimlane) */}
            <IndependentItemsGroup
              items={independentItems}
              allItems={items}
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
              focusItemId={focusItemId}
              onClearFocusItemId={() => setFocusItemId(null)}
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
              dependencies={dependencies}
              rowNumberMap={rowNumberMap}
              onDependencyChange={handleDependencyChange}
              onOpenDependencyEditor={(id) => setDepEditorItemId(id)}
              focusedCell={focusedCell}
              editingCell={editingCell}
              onCellFocus={(itemId, col) => { setFocusedCell({ itemId, column: col }); setEditingCell(false); }}
              onCellEditStart={() => setEditingCell(true)}
              onCellEditEnd={() => setEditingCell(false)}
              onCellKeyDown={handleCellKeyDown}
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
                  allItems={items}
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
                   focusItemId={focusItemId}
                   onClearFocusItemId={() => setFocusItemId(null)}
                   shouldFocusName={focusSwimlaneId === swimlane.id}
                   onClearFocusSwimlane={() => setFocusSwimlaneId(null)}
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
                  dependencies={dependencies}
                  rowNumberMap={rowNumberMap}
                  onDependencyChange={handleDependencyChange}
                   onOpenDependencyEditor={(id) => setDepEditorItemId(id)}
                   focusedCell={focusedCell}
                   editingCell={editingCell}
                   onCellFocus={(itemId, col) => { setFocusedCell({ itemId, column: col }); setEditingCell(false); }}
                   onCellEditStart={() => setEditingCell(true)}
                   onCellEditEnd={() => setEditingCell(false)}
                   onCellKeyDown={handleCellKeyDown}
                />
              );
            })}

            <tr>
              <td colSpan={totalColumns} className="p-0">
                <div className="h-px bg-slate-200" />
              </td>
            </tr>
            <tr>
              <td colSpan={totalColumns} className="pt-7 pb-4 pl-6 pr-4">
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

      {/* Dependency Editor Modal */}
      {depEditorItemId && (() => {
        const depItem = items.find((i) => i.id === depEditorItemId);
        if (!depItem) return null;
        return (
          <DependencyEditorModal
            item={depItem}
            allItems={items}
            dependencies={dependencies}
            rowNumberMap={rowNumberMap}
            onApply={(itemId, newDeps) => setItemDependencies(itemId, newDeps)}
            onClose={() => setDepEditorItemId(null)}
          />
        );
      })()}
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
  columnVisibility: ColumnVisibility;
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

  const columns: OptionalColumn[] = ['percentComplete', 'assignedTo', 'status', 'predecessors'];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors whitespace-nowrap"
      >
        <Plus size={12} />
        Add column
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
  allItems: ProjectItem[];
  statusLabels: StatusLabel[];
  columnVisibility: ColumnVisibility;
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
  focusItemId: string | null;
  onClearFocusItemId: () => void;
  // Global drag state
  dragItemId: string | null;
  dropTarget: { swimlaneId: string | null; index: number } | null;
  onItemDragStart: (id: string) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (swimlaneId: string | null, index: number, e: React.DragEvent) => void;
  onItemDrop: (swimlaneId: string | null, index: number) => void;
  // Dependencies
  dependencies: Dependency[];
  rowNumberMap: Map<string, number>;
  onDependencyChange: (itemId: string, shorthand: string) => void;
  onOpenDependencyEditor: (itemId: string) => void;
  // Cell navigation
  focusedCell: FocusedCell | null;
  editingCell: boolean;
  onCellFocus: (itemId: string, column: CellColumn) => void;
  onCellEditStart: () => void;
  onCellEditEnd: () => void;
  onCellKeyDown: (e: React.KeyboardEvent, cell: FocusedCell, isEditing: boolean) => void;
}

function IndependentItemsGroup({
  items: indItems,
  allItems,
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
  focusItemId,
  onClearFocusItemId,
  dragItemId,
  dropTarget,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
  dependencies,
  rowNumberMap,
  onDependencyChange,
  onOpenDependencyEditor,
  focusedCell,
  editingCell,
  onCellFocus,
  onCellEditStart,
  onCellEditEnd,
  onCellKeyDown,
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
          allItems={allItems}
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
          shouldFocus={focusItemId === item.id}
          onClearFocus={onClearFocusItemId}
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
          dependencies={dependencies}
          rowNumberMap={rowNumberMap}
          onDependencyChange={onDependencyChange}
          onOpenDependencyEditor={onOpenDependencyEditor}
          focusedColumn={focusedCell?.itemId === item.id ? focusedCell.column : null}
          editingCell={focusedCell?.itemId === item.id ? editingCell : false}
          onCellFocus={(col) => onCellFocus(item.id, col)}
          onCellEditStart={onCellEditStart}
          onCellEditEnd={onCellEditEnd}
          onCellKeyDown={(e, col, isEditing) => onCellKeyDown(e, { itemId: item.id, column: col }, isEditing)}
        />
      ))}

      {/* Add row for independent items */}
      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onAddItem('task')}>
        <td className="pl-5 pr-0 py-2" />
        <td colSpan={totalColumns - 1} className="pl-3 pr-4 py-2">
          <InlineAddRow />
        </td>
      </tr>

      {/* Bottom border for independent items section */}
      <tr>
        <td colSpan={totalColumns} className="p-0">
          <div className="h-px bg-slate-200" />
        </td>
      </tr>
    </>
  );
}

// ─── Swimlane Group ──────────────────────────────────────────────────────────

interface SwimlaneGroupProps {
  swimlane: { id: string; name: string; color: string; order: number };
  items: ReturnType<typeof useProjectStore.getState>['items'];
  allItems: ProjectItem[];
  statusLabels: StatusLabel[];
  columnVisibility: ColumnVisibility;
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
  focusItemId: string | null;
  onClearFocusItemId: () => void;
  shouldFocusName: boolean;
  onClearFocusSwimlane: () => void;
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
  // Dependencies
  dependencies: Dependency[];
  rowNumberMap: Map<string, number>;
  onDependencyChange: (itemId: string, shorthand: string) => void;
  onOpenDependencyEditor: (itemId: string) => void;
  // Cell navigation
  focusedCell: FocusedCell | null;
  editingCell: boolean;
  onCellFocus: (itemId: string, column: CellColumn) => void;
  onCellEditStart: () => void;
  onCellEditEnd: () => void;
  onCellKeyDown: (e: React.KeyboardEvent, cell: FocusedCell, isEditing: boolean) => void;
}

function SwimlaneGroup({
  swimlane,
  items: swimItems,
  allItems,
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
  focusItemId,
  onClearFocusItemId,
  shouldFocusName,
  onClearFocusSwimlane,
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
  dependencies,
  rowNumberMap,
  onDependencyChange,
  onOpenDependencyEditor,
  focusedCell,
  editingCell,
  onCellFocus,
  onCellEditStart,
  onCellEditEnd,
  onCellKeyDown,
}: SwimlaneGroupProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(swimlane.name);

  useEffect(() => {
    if (shouldFocusName) {
      setEditingName(true);
      setNameValue(swimlane.name);
      onClearFocusSwimlane();
    }
  }, [shouldFocusName, swimlane.name, onClearFocusSwimlane]);

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
        <td className="pt-8 pb-2.5" colSpan={totalColumns}>
          <div className="relative flex items-center gap-2.5 pl-5 pr-4">
            {/* Grip handle — hover only, positioned absolutely so it doesn't shift layout */}
            <GripVertical
              size={14}
              className="absolute left-1 text-slate-300 opacity-0 group-hover/swimlane:opacity-100 transition-opacity cursor-grab"
            />
            {/* Pencil for color editing — hover only */}
            <SwimlaneColorPicker
              currentColor={swimlane.color}
              onChange={(color) => onUpdateSwimlane(swimlane.id, { color })}
            />
            {editingName ? (
              <input
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[14px] font-semibold text-slate-800 outline-none focus:border-indigo-500"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onFocus={(e) => e.target.select()}
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
                className="font-semibold text-[14px] text-slate-800 cursor-text rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:ring-1 hover:ring-slate-300 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
              >
                {swimlane.name}
              </span>
            )}
            {/* Collapse/Expand toggle — always visible */}
            <Tooltip label={isCollapsed ? 'Expand' : 'Collapse'}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                className="text-slate-300 hover:text-slate-500 transition-colors ml-1"
              >
                {isCollapsed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}
              </button>
            </Tooltip>

            {/* More menu — visible on hover */}
            <div className="opacity-0 group-hover/swimlane:opacity-100 transition-opacity flex items-center gap-1">
              <div className="w-px h-4 bg-slate-200" />
              <SwimlaneMoreMenu
                onAddAbove={() => onAddSwimlaneRelative('above')}
                onAddBelow={() => onAddSwimlaneRelative('below')}
                onDuplicate={onDuplicateSwimlane}
                onHideFromTimeline={onHideSwimlaneItems}
                onDelete={onDeleteSwimlane}
              />
            </div>
          </div>
        </td>
      </tr>

      {/* Item Rows */}
      {!isCollapsed &&
        swimItems.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            allItems={allItems}
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
            shouldFocus={focusItemId === item.id}
            onClearFocus={onClearFocusItemId}
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
            dependencies={dependencies}
            rowNumberMap={rowNumberMap}
            onDependencyChange={onDependencyChange}
            onOpenDependencyEditor={onOpenDependencyEditor}
            focusedColumn={focusedCell?.itemId === item.id ? focusedCell.column : null}
            editingCell={focusedCell?.itemId === item.id ? editingCell : false}
            onCellFocus={(col) => onCellFocus(item.id, col)}
            onCellEditStart={onCellEditStart}
            onCellEditEnd={onCellEditEnd}
            onCellKeyDown={(e, col, isEditing) => onCellKeyDown(e, { itemId: item.id, column: col }, isEditing)}
          />
        ))}

      {/* Add row */}
      {!isCollapsed && (
        <tr className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onAddItem('task')}>
          <td className="pl-5 pr-0 py-2" />
          <td colSpan={totalColumns - 1} className="pl-3 pr-4 py-2">
            <InlineAddRow />
          </td>
        </tr>
      )}

      {/* Bottom border for swimlane section */}
      <tr>
        <td colSpan={totalColumns} className="p-0">
          <div className="h-px bg-slate-200" />
        </td>
      </tr>
    </>
  );
}

// ─── Item Row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ReturnType<typeof useProjectStore.getState>['items'][0];
  allItems: ProjectItem[];
  statusLabels: StatusLabel[];
  columnVisibility: ColumnVisibility;
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
  shouldFocus: boolean;
  onClearFocus: () => void;
  isItemDragging: boolean;
  isItemDropTarget: boolean;
  onItemDragStart: () => void;
  onItemDragEnd: () => void;
  onItemDragOver: (e: React.DragEvent) => void;
  onItemDrop: () => void;
  // Dependencies
  dependencies: Dependency[];
  rowNumberMap: Map<string, number>;
  onDependencyChange: (itemId: string, shorthand: string) => void;
  onOpenDependencyEditor: (itemId: string) => void;
  // Cell navigation
  focusedColumn: CellColumn | null;
  editingCell: boolean;
  onCellFocus: (column: CellColumn) => void;
  onCellEditStart: () => void;
  onCellEditEnd: () => void;
  onCellKeyDown: (e: React.KeyboardEvent, column: CellColumn, isEditing: boolean) => void;
}

function ItemRow({
  item,
  allItems,
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
  shouldFocus,
  onClearFocus,
  isItemDragging,
  isItemDropTarget,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
  dependencies,
  rowNumberMap,
  onDependencyChange,
  onOpenDependencyEditor,
  focusedColumn,
  editingCell: editingCellProp,
  onCellFocus,
  onCellEditStart,
  onCellEditEnd,
  onCellKeyDown,
}: ItemRowProps) {
  const duration = item.type === 'milestone' ? 0 : computeDuration(item.startDate, item.endDate);

  const [editingDuration, setEditingDuration] = useState(false);
  const [durationValue, setDurationValue] = useState(String(duration));
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(String(item.percentComplete));
  const [editingAssigned, setEditingAssigned] = useState(false);
  const [assignedValue, setAssignedValue] = useState(item.assignedTo);
  const [editingPredecessors, setEditingPredecessors] = useState(false);
  const [predecessorsValue, setPredecessorsValue] = useState('');

  // Refs for focusable cells
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Compute the shorthand string for this item's dependencies
  const predecessorsShorthand = useMemo(
    () => formatItemDependencies(item.id, dependencies, rowNumberMap),
    [item.id, dependencies, rowNumberMap]
  );

  // Live validation warnings while editing
  const predecessorsWarnings = useMemo(
    () => editingPredecessors ? validateDependencyShorthand(predecessorsValue, item.id, rowNumberMap) : [],
    [editingPredecessors, predecessorsValue, item.id, rowNumberMap]
  );

  const isEditingLocal = focusedColumn !== null && (
    (focusedColumn === 'title') || // title is always an input
    (focusedColumn === 'duration' && editingDuration) ||
    (focusedColumn === 'percentComplete' && editingProgress) ||
    (focusedColumn === 'assignedTo' && editingAssigned) ||
    (focusedColumn === 'predecessors' && editingPredecessors)
  );

  // When focusedColumn changes, focus the corresponding td (unless editing)
  useEffect(() => {
    if (focusedColumn && cellRefs.current[focusedColumn]) {
      // For title column, focus the input directly
      if (focusedColumn === 'title' && nameRef.current) {
        nameRef.current.focus();
        return;
      }
      const td = cellRefs.current[focusedColumn];
      if (td && document.activeElement !== td && !td.contains(document.activeElement)) {
        td.focus();
      }
    }
  }, [focusedColumn]);

  // When focusedColumn changes and editingCellProp is true, enter edit mode for click-to-edit cells
  useEffect(() => {
    if (focusedColumn && editingCellProp) {
      if (focusedColumn === 'duration') {
        setDurationValue(String(duration));
        setEditingDuration(true);
      } else if (focusedColumn === 'percentComplete') {
        setProgressValue(String(item.percentComplete));
        setEditingProgress(true);
      } else if (focusedColumn === 'assignedTo') {
        setAssignedValue(item.assignedTo);
        setEditingAssigned(true);
      } else if (focusedColumn === 'predecessors') {
        setPredecessorsValue(predecessorsShorthand);
        setEditingPredecessors(true);
      }
    }
  }, [focusedColumn, editingCellProp]);

  // Helper for cell keydown handling
  const handleCellKeyDown = (e: React.KeyboardEvent, column: CellColumn, isEditing: boolean) => {
    onCellKeyDown(e, column, isEditing);
  };

  useEffect(() => {
    if (shouldFocus && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
      onClearFocus();
    }
  }, [shouldFocus, onClearFocus]);

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
        className={`group/row transition-colors cursor-pointer [&>td]:border-b [&>td]:border-slate-100 ${
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
      {/* Checkbox / Grip Handle / Row Number */}
      <td className="pl-5 pr-0 py-3 text-center">
        {hasAnyChecked || isChecked ? (
          <Checkbox checked={isChecked} onChange={onToggleChecked} />
        ) : (
          <div className="relative w-[18px] h-[18px] mx-auto">
            {/* Row number (visible by default, hidden on row hover) */}
            <span className="text-[10px] text-slate-400 font-mono leading-[18px] absolute inset-0 flex items-center justify-center group-hover/row:opacity-0 transition-opacity select-none">
              {rowNumberMap.get(item.id) ?? ''}
            </span>
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
      <td
        ref={(el) => { cellRefs.current['title'] = el; }}
        className={`pl-3 pr-4 py-3 ${focusedColumn === 'title' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
      >
        <input
          ref={nameRef}
          className="w-full bg-transparent border-none outline-none text-[13px] text-slate-700 placeholder-slate-300 focus:bg-white focus:ring-1 focus:ring-indigo-300 focus:px-2 focus:py-0.5 focus:rounded transition-all"
          value={item.name}
          onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
          onKeyDown={(e) => {
            handleCellKeyDown(e, 'title', true);
          }}
          onFocus={() => onCellFocus('title')}
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      {/* Type */}
      <td
        ref={(el) => { cellRefs.current['type'] = el; }}
        className={`px-3 py-3 ${focusedColumn === 'type' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
        tabIndex={focusedColumn === 'type' ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            // Open the type picker by clicking its button
            const btn = cellRefs.current['type']?.querySelector('button');
            if (btn) btn.click();
            return;
          }
          handleCellKeyDown(e, 'type', false);
        }}
        onFocus={() => onCellFocus('type')}
      >
        <TypePickerCell
          item={item}
          onUpdateItem={onUpdateItem}
          onUpdateTaskStyle={onUpdateTaskStyle}
          onUpdateMilestoneStyle={onUpdateMilestoneStyle}
        />
      </td>

      {/* Duration */}
      <td
        ref={(el) => { cellRefs.current['duration'] = el; }}
        className={`px-3 py-3 ${focusedColumn === 'duration' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
        tabIndex={focusedColumn === 'duration' ? 0 : -1}
        onKeyDown={(e) => {
          if (!editingDuration) {
            if (e.key === 'Enter') {
              e.preventDefault();
              setDurationValue(String(duration));
              setEditingDuration(true);
              onCellEditStart();
              return;
            }
            handleCellKeyDown(e, 'duration', false);
          }
        }}
        onFocus={() => onCellFocus('duration')}
      >
        {editingDuration ? (
          <input
            type="number"
            className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-indigo-500"
            value={durationValue}
            min={0}
            autoFocus
            onChange={(e) => setDurationValue(e.target.value)}
            onBlur={() => {
              const v = parseInt(durationValue);
              if (!isNaN(v) && v >= 0) onDurationChange(item.id, v);
              setEditingDuration(false);
              onCellEditEnd();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseInt(durationValue);
                if (!isNaN(v) && v >= 0) onDurationChange(item.id, v);
                setEditingDuration(false);
                onCellEditEnd();
                handleCellKeyDown(e, 'duration', true);
              } else if (e.key === 'Escape') {
                setEditingDuration(false);
                onCellEditEnd();
              } else if (e.key === 'Tab') {
                e.preventDefault();
                const v = parseInt(durationValue);
                if (!isNaN(v) && v >= 0) onDurationChange(item.id, v);
                setEditingDuration(false);
                onCellEditEnd();
                handleCellKeyDown(e, 'duration', true);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-[12px] text-slate-700 tabular-nums cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setDurationValue(String(duration));
              setEditingDuration(true);
              onCellFocus('duration');
              onCellEditStart();
            }}
          >
            {duration} days
          </span>
        )}
      </td>

      {/* Start Date */}
      <td
        ref={(el) => { cellRefs.current['startDate'] = el; }}
        className={`px-3 py-3 ${focusedColumn === 'startDate' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
        tabIndex={focusedColumn === 'startDate' ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            startDateRef.current?.showPicker();
            return;
          }
          handleCellKeyDown(e, 'startDate', false);
        }}
        onFocus={() => onCellFocus('startDate')}
      >
        <div className="relative flex items-center gap-1.5">
          <span
            className="text-[12px] text-slate-700 tabular-nums cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onCellFocus('startDate');
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
              onCellFocus('startDate');
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
      <td
        ref={(el) => { cellRefs.current['endDate'] = el; }}
        className={`px-3 py-3 ${focusedColumn === 'endDate' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
        tabIndex={focusedColumn === 'endDate' ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            endDateRef.current?.showPicker();
            return;
          }
          handleCellKeyDown(e, 'endDate', false);
        }}
        onFocus={() => onCellFocus('endDate')}
      >
         <div className="relative flex items-center gap-1.5">
          <span
            className="text-[12px] text-slate-700 tabular-nums cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onCellFocus('endDate');
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
              onCellFocus('endDate');
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
        <td
          ref={(el) => { cellRefs.current['percentComplete'] = el; }}
          className={`px-3 py-3 ${focusedColumn === 'percentComplete' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
          tabIndex={focusedColumn === 'percentComplete' ? 0 : -1}
          onKeyDown={(e) => {
            if (!editingProgress) {
              if (e.key === 'Enter') {
                e.preventDefault();
                setProgressValue(String(item.percentComplete));
                setEditingProgress(true);
                onCellEditStart();
                return;
              }
              handleCellKeyDown(e, 'percentComplete', false);
            }
          }}
          onFocus={() => onCellFocus('percentComplete')}
        >
          {editingProgress ? (
            <input
              type="number"
              className="w-14 bg-white border border-slate-300 rounded px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-indigo-500"
              value={progressValue}
              min={0}
              max={100}
              autoFocus
              onChange={(e) => setProgressValue(e.target.value)}
              onBlur={() => {
                const v = Math.min(100, Math.max(0, parseInt(progressValue) || 0));
                onUpdateItem(item.id, { percentComplete: v });
                setEditingProgress(false);
                onCellEditEnd();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Math.min(100, Math.max(0, parseInt(progressValue) || 0));
                  onUpdateItem(item.id, { percentComplete: v });
                  setEditingProgress(false);
                  onCellEditEnd();
                  handleCellKeyDown(e, 'percentComplete', true);
                } else if (e.key === 'Escape') {
                  setEditingProgress(false);
                  onCellEditEnd();
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  const v = Math.min(100, Math.max(0, parseInt(progressValue) || 0));
                  onUpdateItem(item.id, { percentComplete: v });
                  setEditingProgress(false);
                  onCellEditEnd();
                  handleCellKeyDown(e, 'percentComplete', true);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="flex items-center gap-1.5 cursor-pointer group/pct"
              onClick={(e) => {
                e.stopPropagation();
                setProgressValue(String(item.percentComplete));
                setEditingProgress(true);
                onCellFocus('percentComplete');
                onCellEditStart();
              }}
            >
              <div className="w-10 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${item.percentComplete}%`,
                    backgroundColor: item.percentComplete > 0 ? '#22c55e' : 'transparent',
                  }}
                />
              </div>
              <span className="text-[12px] text-slate-700 tabular-nums group-hover/pct:text-indigo-600 transition-colors">
                {item.percentComplete}%
              </span>
            </div>
          )}
        </td>
      )}

      {/* Assigned To */}
      {columnVisibility.assignedTo && (
        <td
          ref={(el) => { cellRefs.current['assignedTo'] = el; }}
          className={`px-3 py-3 ${focusedColumn === 'assignedTo' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
          tabIndex={focusedColumn === 'assignedTo' ? 0 : -1}
          onKeyDown={(e) => {
            if (!editingAssigned) {
              if (e.key === 'Enter') {
                e.preventDefault();
                setAssignedValue(item.assignedTo);
                setEditingAssigned(true);
                onCellEditStart();
                return;
              }
              handleCellKeyDown(e, 'assignedTo', false);
            }
          }}
          onFocus={() => onCellFocus('assignedTo')}
        >
          {editingAssigned ? (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-indigo-500"
              value={assignedValue}
              placeholder="Type a name..."
              autoFocus
              onChange={(e) => setAssignedValue(e.target.value)}
              onBlur={() => {
                onUpdateItem(item.id, { assignedTo: assignedValue.trim() });
                setEditingAssigned(false);
                onCellEditEnd();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateItem(item.id, { assignedTo: assignedValue.trim() });
                  setEditingAssigned(false);
                  onCellEditEnd();
                  handleCellKeyDown(e, 'assignedTo', true);
                } else if (e.key === 'Escape') {
                  setAssignedValue(item.assignedTo);
                  setEditingAssigned(false);
                  onCellEditEnd();
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  onUpdateItem(item.id, { assignedTo: assignedValue.trim() });
                  setEditingAssigned(false);
                  onCellEditEnd();
                  handleCellKeyDown(e, 'assignedTo', true);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : item.assignedTo ? (
            <span
            className="text-[12px] text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setAssignedValue(item.assignedTo);
              setEditingAssigned(true);
              onCellFocus('assignedTo');
              onCellEditStart();
              }}
            >
              {item.assignedTo}
            </span>
          ) : (
            <button
              className="flex items-center justify-center w-full h-6 border border-dashed border-transparent group-hover/row:border-slate-200 rounded text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setAssignedValue('');
                setEditingAssigned(true);
                onCellFocus('assignedTo');
                onCellEditStart();
              }}
            >
              <UserPlus size={12} className="opacity-0 group-hover/row:opacity-100 transition-opacity" />
            </button>
          )}
        </td>
      )}

      {/* Status */}
      {/* Status */}
      {columnVisibility.status && (
         <td
          ref={(el) => { cellRefs.current['status'] = el; }}
          className={`px-3 py-3 ${focusedColumn === 'status' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
           tabIndex={focusedColumn === 'status' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const btn = cellRefs.current['status']?.querySelector('button');
              if (btn) btn.click();
              return;
            }
            handleCellKeyDown(e, 'status', false);
          }}
          onFocus={() => onCellFocus('status')}
        >
          <StatusCell
            statusId={item.statusId}
            statusLabels={statusLabels}
            onChange={(statusId) => onUpdateItem(item.id, { statusId })}
            onAddStatusLabel={onAddStatusLabel}
          />
        </td>
      )}

      {/* Predecessors */}
      {columnVisibility.predecessors && (
        <td
          ref={(el) => { cellRefs.current['predecessors'] = el; }}
          className={`px-3 py-3 ${focusedColumn === 'predecessors' ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
          tabIndex={focusedColumn === 'predecessors' ? 0 : -1}
          onKeyDown={(e) => {
            if (!editingPredecessors) {
              if (e.key === 'Enter') {
                e.preventDefault();
                setPredecessorsValue(predecessorsShorthand);
                setEditingPredecessors(true);
                onCellEditStart();
                return;
              }
              handleCellKeyDown(e, 'predecessors', false);
            }
          }}
          onFocus={() => onCellFocus('predecessors')}
        >
          <div className="flex items-center gap-1 max-w-[160px]">
            {editingPredecessors ? (
              <div className="flex-1 relative">
                <input
                  type="text"
                  className={`w-full text-xs px-1.5 py-0.5 border rounded bg-white outline-none focus:ring-1 text-slate-700 font-mono ${
                    predecessorsWarnings.length > 0
                      ? 'border-amber-400 focus:ring-amber-300'
                      : 'border-indigo-300 focus:ring-indigo-400'
                  }`}
                  value={predecessorsValue}
                  onChange={(e) => setPredecessorsValue(e.target.value)}
                  onBlur={() => {
                    if (predecessorsWarnings.length > 0) {
                      setEditingPredecessors(false);
                      setPredecessorsValue(predecessorsShorthand);
                      onCellEditEnd();
                      return;
                    }
                    setEditingPredecessors(false);
                    if (predecessorsValue !== predecessorsShorthand) {
                      onDependencyChange(item.id, predecessorsValue);
                    }
                    onCellEditEnd();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (predecessorsWarnings.length > 0) return;
                      setEditingPredecessors(false);
                      if (predecessorsValue !== predecessorsShorthand) {
                        onDependencyChange(item.id, predecessorsValue);
                      }
                      onCellEditEnd();
                      handleCellKeyDown(e, 'predecessors', true);
                    } else if (e.key === 'Escape') {
                      setEditingPredecessors(false);
                      setPredecessorsValue(predecessorsShorthand);
                      onCellEditEnd();
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      if (predecessorsWarnings.length === 0) {
                        setEditingPredecessors(false);
                        if (predecessorsValue !== predecessorsShorthand) {
                          onDependencyChange(item.id, predecessorsValue);
                        }
                        onCellEditEnd();
                        handleCellKeyDown(e, 'predecessors', true);
                      }
                    }
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {predecessorsWarnings.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-20 bg-amber-50 border border-amber-200 rounded px-2 py-1 shadow-md max-w-[220px]">
                    {predecessorsWarnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-700 leading-tight">
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <span
                  className="text-xs text-slate-500 truncate flex-1 cursor-text font-mono"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPredecessorsValue(predecessorsShorthand);
                    setEditingPredecessors(true);
                    onCellFocus('predecessors');
                    onCellEditStart();
                  }}
                >
                  {predecessorsShorthand || '\u2014'}
                </span>
                <button
                  className="p-0.5 rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all shrink-0 opacity-0 group-hover/row:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDependencyEditor(item.id);
                  }}
                  title="Edit dependencies"
                >
                  <ListChecks size={13} />
                </button>
              </>
            )}
          </div>
        </td>
      )}

      {/* Actions — hover only: trash + more menu */}
      <td className="px-2 py-3">
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

// ─── Swimlane Color Picker ───────────────────────────────────────────────────

function SwimlaneColorPicker({
  currentColor,
  onChange,
}: {
  currentColor: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 180;
      setFlipUp(rect.bottom + menuHeight > window.innerHeight);
    }
    setOpen(!open);
  };

  return (
    <div className="relative shrink-0" ref={ref} style={{ width: '12px' }}>
      {/* Default: solid color square. On swimlane hover: pencil + thin color bar */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className="cursor-pointer flex flex-col items-center"
        style={{ width: '12px' }}
      >
        {/* Default color square — hidden on swimlane hover */}
        <div
          className="group-hover/swimlane:hidden"
          style={{ width: '12px', height: '18px', backgroundColor: currentColor }}
        />
        {/* Hover state: pencil icon + thin color bar — shown on swimlane hover */}
        <div className="hidden group-hover/swimlane:flex flex-col items-center gap-0.5 rounded hover:bg-slate-100 transition-colors py-0.5">
          <Pencil size={12} className="text-slate-400" />
          <div style={{ width: '12px', height: '3px', backgroundColor: currentColor, borderRadius: '1px' }} />
        </div>
      </div>

      {open && (
        <div
          className={`absolute left-0 ${flipUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-slate-200 rounded-lg shadow-lg z-40 p-3 w-[196px]`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[12px] font-medium text-slate-500 mb-2">Choose color</div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(color);
                }}
                className="w-9 h-9 rounded-md flex items-center justify-center hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              >
                {color === currentColor && (
                  <Check size={14} className="text-white" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="mt-2.5 w-full text-center text-[12px] font-medium text-slate-500 hover:text-slate-700 py-1 rounded hover:bg-slate-50 transition-colors"
          >
            Done
          </button>
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
          className="flex items-center justify-center w-full h-6 border border-dashed border-transparent group-hover/row:border-slate-200 rounded text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-colors"
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

function InlineAddRow() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-indigo-500 transition-colors py-0.5 pointer-events-none select-none">
      <Plus size={13} />
      Add task or milestone
    </span>
  );
}
