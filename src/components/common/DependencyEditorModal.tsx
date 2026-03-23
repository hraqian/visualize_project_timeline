import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Trash2, Search } from 'lucide-react';
import type { Dependency, DependencyType, LagUnit, ProjectItem } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  item: ProjectItem;
  allItems: ProjectItem[];
  dependencies: Dependency[];
  rowNumberMap: Map<string, number>;
  onApply: (itemId: string, deps: Dependency[]) => void;
  onClose: () => void;
}

interface EditableDep {
  fromId: string;
  type: DependencyType;
  lag: number;
  lagUnit: LagUnit;
  visible: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEP_TYPE_OPTIONS: { value: DependencyType; label: string }[] = [
  { value: 'finish-to-start', label: 'FS' },
  { value: 'start-to-start', label: 'SS' },
  { value: 'finish-to-finish', label: 'FF' },
  { value: 'start-to-finish', label: 'SF' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DependencyEditorModal({ item, allItems, dependencies, rowNumberMap, onApply, onClose }: Props) {
  // Initialize editable deps from existing dependencies targeting this item
  const initialDeps: EditableDep[] = useMemo(() =>
    dependencies
      .filter((d) => d.toId === item.id)
      .map((d) => ({
        fromId: d.fromId,
        type: d.type,
        lag: d.lag,
        lagUnit: d.lagUnit,
        visible: d.visible,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // only on mount
  );

  const [deps, setDeps] = useState<EditableDep[]>(initialDeps);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rowNum = rowNumberMap.get(item.id) ?? 0;
  const typeLabel = item.type === 'milestone' ? 'Milestone' : 'Task';

  // Items available to add as predecessors (not already in deps, not self)
  const existingFromIds = new Set(deps.map((d) => d.fromId));
  const availableItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allItems
      .filter((i) => i.id !== item.id && !existingFromIds.has(i.id))
      .filter((i) => {
        if (!q) return true;
        const rn = rowNumberMap.get(i.id);
        return i.name.toLowerCase().includes(q) || (rn != null && String(rn).includes(q));
      });
  }, [allItems, item.id, existingFromIds, searchQuery, rowNumberMap]);

  const updateDep = (fromId: string, updates: Partial<EditableDep>) => {
    setDeps((prev) => prev.map((d) => d.fromId === fromId ? { ...d, ...updates } : d));
  };

  const removeDep = (fromId: string) => {
    setDeps((prev) => prev.filter((d) => d.fromId !== fromId));
  };

  const addDep = (fromId: string) => {
    setDeps((prev) => [
      ...prev,
      { fromId, type: 'finish-to-start', lag: 0, lagUnit: 'd', visible: true },
    ]);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleApply = () => {
    const newDeps: Dependency[] = deps.map((d) => ({
      fromId: d.fromId,
      toId: item.id,
      type: d.type,
      lag: d.lag,
      lagUnit: d.lagUnit,
      visible: d.visible,
    }));
    onApply(item.id, newDeps);
    onClose();
  };

  const formatLag = (lag: number, unit: LagUnit): string => {
    const sign = lag > 0 ? '+' : lag < 0 ? '' : '';
    return `${sign}${lag}${unit}`;
  };

  const parseLagInput = (input: string): { lag: number; lagUnit: LagUnit } | null => {
    const match = input.trim().match(/^([+-]?\d+)\s*([dwm])?$/i);
    if (!match) return null;
    return {
      lag: parseInt(match[1], 10),
      lagUnit: ((match[2] || 'd').toLowerCase()) as LagUnit,
    };
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{typeLabel}</span>
            <h2 className="text-sm font-semibold text-slate-700 mt-0.5">
              {rowNum}. {item.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-3">Depends on:</p>

          {/* Dependency rows */}
          {deps.length === 0 && (
            <p className="text-xs text-slate-400 italic mb-3">No dependencies yet. Search below to add one.</p>
          )}

          <div className="space-y-2 mb-4">
            {deps.map((dep) => {
              const predItem = allItems.find((i) => i.id === dep.fromId);
              const predRowNum = rowNumberMap.get(dep.fromId) ?? 0;

              return (
                <div
                  key={dep.fromId}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    dep.visible
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-100 bg-slate-50 opacity-50'
                  }`}
                >
                  {/* Predecessor name (readonly) */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-600 truncate block">
                      {predRowNum}. {predItem?.name ?? 'Unknown'}
                    </span>
                  </div>

                  {/* Dependency type dropdown */}
                  <select
                    className="text-xs px-1.5 py-1 border border-slate-200 rounded bg-white text-slate-600 font-mono cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    value={dep.type}
                    onChange={(e) => updateDep(dep.fromId, { type: e.target.value as DependencyType })}
                  >
                    {DEP_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* Lag input */}
                  <LagInput
                    value={formatLag(dep.lag, dep.lagUnit)}
                    onChange={(val) => {
                      const parsed = parseLagInput(val);
                      if (parsed) updateDep(dep.fromId, parsed);
                    }}
                  />

                  {/* Visibility toggle */}
                  <button
                    className={`p-1 rounded transition-all ${
                      dep.visible
                        ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                        : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                    }`}
                    onClick={() => updateDep(dep.fromId, { visible: !dep.visible })}
                    title={dep.visible ? 'Hide dependency line' : 'Show dependency line'}
                  >
                    {dep.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>

                  {/* Delete */}
                  <button
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    onClick={() => removeDep(dep.fromId)}
                    title="Remove dependency"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Search to add new predecessor */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                className="flex-1 text-xs bg-transparent outline-none text-slate-600 placeholder:text-slate-400"
                placeholder="Search by name or row number to add..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
              />
            </div>

            {/* Search results dropdown */}
            {showSearchResults && (searchQuery || availableItems.length > 0) && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10"
              >
                {availableItems.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No matching items</div>
                ) : (
                  availableItems.map((ai) => {
                    const rn = rowNumberMap.get(ai.id) ?? 0;
                    return (
                      <button
                        key={ai.id}
                        className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center gap-2"
                        onClick={() => addDep(ai.id)}
                      >
                        <span className="text-slate-400 font-mono w-5 text-right shrink-0">{rn}.</span>
                        <span className="truncate">{ai.name}</span>
                        <span className="text-slate-300 text-[10px] ml-auto shrink-0">{ai.type}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-all"
            style={{ backgroundColor: '#334155' }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Lag Input (inline editable) ─────────────────────────────────────────────

function LagInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const commit = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        className="w-14 text-xs px-1.5 py-1 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-slate-400 text-slate-600 font-mono text-center"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setLocalValue(value); setEditing(false); }
        }}
        autoFocus
      />
    );
  }

  return (
    <button
      className="w-14 text-xs px-1.5 py-1 border border-slate-200 rounded bg-white text-slate-500 font-mono text-center hover:border-slate-300 transition-colors"
      onClick={() => { setLocalValue(value); setEditing(true); }}
    >
      {value}
    </button>
  );
}
