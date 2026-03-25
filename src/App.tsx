import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { DataView, AddDropdownButton } from '@/components/DataView/DataView';
import { TimelineView } from '@/components/TimelineView/TimelineView';
import type { TimelineViewHandle } from '@/components/TimelineView/TimelineView';
import { StylePane } from '@/components/StylePane/StylePane';
import { ProjectManagerModal } from '@/components/common/ProjectManagerModal';
import { SettingsModal } from '@/components/common/SettingsModal';
import { ConflictResolutionDialog } from '@/components/common/ConflictResolutionDialog';
import { toPng } from 'html-to-image';
import { exportNativePptx } from '@/utils/exportPptx';
import {
  Pencil,
  Plus,
  Download,
  Settings,
  List,
  GanttChart,
  Save,
  FolderOpen,
  Image,
  Presentation,
  ChevronDown,
  Undo2,
  Redo2,
  Link2,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import type { ActiveView, ConnectionPoint } from '@/types';

function App() {
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const addItem = useProjectStore((s) => s.addItem);
  const addSwimlane = useProjectStore((s) => s.addSwimlane);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);
  const isDirty = useProjectStore((s) => s.isDirty);
  const saveProject = useProjectStore((s) => s.saveProject);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const showDependencies = useProjectStore((s) => s.showDependencies);
  const setShowDependencies = useProjectStore((s) => s.setShowDependencies);
  const showCriticalPath = useProjectStore((s) => s.showCriticalPath);
  const pendingConflicts = useProjectStore((s) => s.pendingConflicts);
  const selectedDepKey = useProjectStore((s) => s.selectedDepKey);
  const setSelectedDepKey = useProjectStore((s) => s.setSelectedDepKey);
  const dependencies = useProjectStore((s) => s.dependencies);
  const removeDependency = useProjectStore((s) => s.removeDependency);
  const updateDependency = useProjectStore((s) => s.updateDependency);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const [showProjectManager, setShowProjectManager] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const timelineRef = useRef<TimelineViewHandle>(null);

  const handleSave = useCallback(async () => {
    await saveProject();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  }, [saveProject]);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed) setProjectName(trimmed);
    else setNameValue(projectName);
    setEditingName(false);
  }, [nameValue, projectName, setProjectName]);

  // Keyboard shortcuts: Cmd+Z undo, Cmd+Shift+Z redo, Cmd+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, handleSave]);

  const handleAddTask = useCallback(() => {
    const targetSwimlane = swimlanes.length > 0
      ? [...swimlanes].sort((a, b) => a.order - b.order)[0]
      : null;
    addItem({ name: 'New Task', type: 'task', swimlaneId: targetSwimlane?.id ?? null });
  }, [swimlanes, addItem]);

  const handleAddMilestone = useCallback(() => {
    const targetSwimlane = swimlanes.length > 0
      ? [...swimlanes].sort((a, b) => a.order - b.order)[0]
      : null;
    addItem({ name: 'New Milestone', type: 'milestone', swimlaneId: targetSwimlane?.id ?? null });
  }, [swimlanes, addItem]);

  const handleAddSwimlane = useCallback(() => {
    addSwimlane('New Swimlane');
  }, [addSwimlane]);

  const captureTimeline = useCallback(async (): Promise<string | null> => {
    const el = timelineRef.current?.getExportElement();
    if (!el) return null;
    try {
      return await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: true,
      });
    } catch (err) {
      console.error('Export failed:', err);
      return null;
    }
  }, []);

  const exportPNG = useCallback(async () => {
    // If on Data view, switch to Timeline so the canvas is rendered
    const wasOnData = activeView !== 'timeline';
    if (wasOnData) {
      setActiveView('timeline');
      // Wait a frame for TimelineView to mount and render
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const dataUrl = await captureTimeline();
    if (wasOnData) setActiveView('data');
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  }, [captureTimeline, projectName, activeView, setActiveView]);

  const exportPPTX = useCallback(async () => {
    const store = useProjectStore.getState();
    await exportNativePptx(
      store.projectName,
      store.items,
      store.swimlanes,
      store.dependencies,
      store.timescale,
      store.zoom,
      store.taskLayout,
      store.swimlaneSpacing,
    );
  }, []);

  const viewTabs: { id: ActiveView; label: string; icon: typeof List }[] = [
    { id: 'data', label: 'Data', icon: List },
    { id: 'timeline', label: 'Timeline', icon: GanttChart },
  ];

  const isTimeline = activeView === 'timeline';

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* ─── Row 1: Project title banner ─── */}
      <div className="flex items-center h-11 bg-[#1e293b] shrink-0 px-3">
        {/* Left: Save + Undo/Redo */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={handleSave}
            className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/15 transition-all"
            title="Save"
          >
            <Save size={16} />
          </button>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-all ${canUndo ? 'text-white/70 hover:text-white hover:bg-white/15' : 'text-white/25 cursor-not-allowed'}`}
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-all ${canRedo ? 'text-white/70 hover:text-white hover:bg-white/15' : 'text-white/25 cursor-not-allowed'}`}
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Center: Project name + save status */}
        <div className="flex items-center justify-center">
        {editingName ? (
          <input
            className="text-sm font-semibold text-white bg-white/20 border border-white/30 rounded-md px-3 py-1 outline-none focus:border-white/60 min-w-[200px] text-center placeholder:text-white/50"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setNameValue(projectName);
                setEditingName(false);
              }
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setNameValue(projectName);
              setEditingName(true);
            }}
            className="group flex items-center gap-2 text-sm font-semibold text-white hover:text-white/90 transition-colors"
          >
            <span>{projectName}</span>
            <span className="text-xs font-normal text-white/60">
              {saveFlash ? '- Saved!' : isDirty ? '- Unsaved changes' : '- Saved'}
            </span>
            <Pencil
              size={12}
              className="opacity-0 group-hover:opacity-60 transition-opacity text-white"
            />
          </button>
        )}
        </div>

        {/* Right: balance spacer */}
        <div className="flex-1" />
      </div>

      {/* ─── Row 2: Toolbar ─── */}
      <div className="flex items-center h-12 px-4 mt-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
        {/* Left: Add buttons */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isTimeline ? (
            <>
              <button
                onClick={handleAddTask}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                <Plus size={14} />
                Task
              </button>
              <button
                onClick={handleAddMilestone}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                <Plus size={14} />
                Milestone
              </button>
              <button
                onClick={handleAddSwimlane}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                <Plus size={14} />
                Swimlane
              </button>
              {/* Dep link actions — always visible, disabled when no dep selected */}
              {(() => {
                const selectedDep = selectedDepKey ? dependencies.find((d) => `${d.fromId}-${d.toId}` === selectedDepKey) : null;
                const isHidden = selectedDep?.visible === false;
                return (
                  <>
                    <div className="w-px h-6 bg-[var(--color-border)] mx-1" />
                    <button
                      disabled={!selectedDepKey}
                      onClick={() => {
                        if (selectedDep) {
                          updateDependency(selectedDep.fromId, selectedDep.toId, { visible: isHidden ? true : false });
                        }
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium border border-[var(--color-border)] transition-all ${
                        selectedDepKey
                          ? 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer'
                          : 'text-[var(--color-text-muted)] cursor-default'
                      }`}
                    >
                      {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                    <ConnectionPointButton
                      fromPoint={selectedDep?.fromPoint ?? 'auto'}
                      toPoint={selectedDep?.toPoint ?? 'auto'}
                      disabled={!selectedDepKey}
                      onChange={(fp, tp) => {
                        if (selectedDep) {
                          updateDependency(selectedDep.fromId, selectedDep.toId, { fromPoint: fp, toPoint: tp });
                        }
                      }}
                    />
                    <button
                      disabled={!selectedDepKey}
                      onClick={() => {
                        if (selectedDep) {
                          removeDependency(selectedDep.fromId, selectedDep.toId);
                          setSelectedDepKey(null);
                        }
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium border border-[var(--color-border)] transition-all ${
                        selectedDepKey
                          ? 'text-[var(--color-danger)] hover:bg-red-50 cursor-pointer'
                          : 'text-[var(--color-text-muted)] cursor-default'
                      }`}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </>
                );
              })()}
            </>
          ) : (
            <AddDropdownButton onAdd={(type) => {
              if (type === 'swimlane') {
                handleAddSwimlane();
              } else {
                addItem({ name: type === 'task' ? 'New Task' : 'New Milestone', type });
              }
            }} />
          )}
        </div>

        {/* Center: View tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {viewTabs.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => {
                  setActiveView(v.id);
                  setSelectedItem(null);
                  setStylePaneSection(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-[#1e293b] shadow-sm border border-[var(--color-border)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[#1e293b]' : ''} />
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Right: Projects + Dependencies + Export + Settings */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <FolderOpen size={14} />
            Projects
          </button>
          {isTimeline && (
            <DependenciesDropdown
              showDependencies={showDependencies}
              onToggleDependencies={() => setShowDependencies(!showDependencies)}
              showCriticalPath={showCriticalPath}
            />
          )}
          <ExportButton
            disabled={false}
            onExportPNG={exportPNG}
            onExportPPTX={exportPPTX}
          />
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {activeView === 'data' ? <DataView /> : <TimelineView ref={timelineRef} onOpenSettings={() => setShowSettingsModal(true)} />}
        </div>
        {isTimeline && (
          <div className="w-[280px] border-l border-[var(--color-border)] overflow-y-auto scrollbar-thin shrink-0">
            <StylePane />
          </div>
        )}
      </div>

      {showProjectManager && (
        <ProjectManagerModal onClose={() => setShowProjectManager(false)} />
      )}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
      {pendingConflicts.length > 0 && <ConflictResolutionDialog />}
    </div>
  );
}

// ─── Export Dropdown Button ──────────────────────────────────────────────────

function ExportButton({
  disabled,
  onExportPNG,
  onExportPPTX,
}: {
  disabled: boolean;
  onExportPNG: () => void;
  onExportPPTX: () => void;
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
          disabled
            ? 'text-[var(--color-text-secondary)]/40 border-[var(--color-border)]/40 cursor-not-allowed'
            : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
        }`}
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[180px]">
          <button
            onClick={() => { onExportPNG(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Image size={14} />
            Export as PNG
          </button>
          <button
            onClick={() => { onExportPPTX(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Presentation size={14} />
            Export as PowerPoint
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dependencies Dropdown Button ────────────────────────────────────────────

function DependenciesDropdown({
  showDependencies,
  onToggleDependencies,
  showCriticalPath,
}: {
  showDependencies: boolean;
  onToggleDependencies: () => void;
  showCriticalPath: boolean;
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
          showDependencies
            ? 'text-[#1e293b] border-[#1e293b]/30 bg-slate-50 hover:bg-slate-100'
            : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
        }`}
      >
        <Link2 size={14} />
        Dependencies
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[280px]">
          {/* Critical Path toggle */}
          <button
            className="w-full text-left px-3 py-2 text-sm text-slate-400 cursor-not-allowed flex items-center justify-between"
          >
            <span>Critical path</span>
            <DepToggleSwitch on={showCriticalPath} disabled />
          </button>

          {/* Separator */}
          <div className="h-px bg-slate-100 mx-2 my-1" />

          {/* Dependencies toggle */}
          <button
            onClick={() => { onToggleDependencies(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 font-medium">Dependencies</span>
              <DepToggleSwitch on={showDependencies} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enable or disable the dependency functionality for this timeline.
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Toggle Switch (for Dependencies dropdown) ──────────────────────────────

function DepToggleSwitch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <div
      className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
        disabled ? 'opacity-40' : ''
      } ${on ? 'bg-green-500' : 'bg-slate-200'}`}
    >
      <div
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-[14px]' : 'translate-x-0.5'
        }`}
      />
    </div>
  );
}

// ─── Connection Point Illustration ───────────────────────────────────────────
// Small SVG showing two mini bars with a dep link connecting at the specified points.

function ConnectionPointIllustration({ fromPoint, toPoint }: { fromPoint: ConnectionPoint; toPoint: ConnectionPoint }) {
  const W = 250;
  const H = 80;
  const barH = 14;
  const barW = 52;
  const bar1X = 20;
  const bar1Y = 14;
  const bar2X = W - 20 - barW;
  const bar2Y = H - 14 - barH;

  // Compute from anchor
  let fx: number, fy: number;
  const fp = fromPoint === 'auto' ? 'side' : fromPoint;
  if (fp === 'top') {
    fx = bar1X + barW / 2;
    fy = bar1Y;
  } else if (fp === 'bottom') {
    fx = bar1X + barW / 2;
    fy = bar1Y + barH;
  } else {
    fx = bar1X + barW;
    fy = bar1Y + barH / 2;
  }

  // Compute to anchor
  let tx: number, ty: number;
  const tp = toPoint === 'auto' ? 'side' : toPoint;
  if (tp === 'top') {
    tx = bar2X + barW / 2;
    ty = bar2Y;
  } else if (tp === 'bottom') {
    tx = bar2X + barW / 2;
    ty = bar2Y + barH;
  } else {
    tx = bar2X;
    ty = bar2Y + barH / 2;
  }

  // Build orthogonal path — always right angles, never diagonal
  // Strategy: exit in the direction of the anchor, then route orthogonally to the target
  const segments: [number, number][] = [[fx, fy]];
  const midX = (fx + tx) / 2;

  if (fp === 'side' && tp === 'side') {
    // Side->Side: horizontal, vertical, horizontal
    segments.push([midX, fy], [midX, ty], [tx, ty]);
  } else if (fp === 'side' && tp === 'top') {
    // Side->Top: go right to midX, then up to ty-8, right to tx, then down to ty
    const gapY = ty - 8;
    segments.push([midX, fy], [midX, gapY], [tx, gapY], [tx, ty]);
  } else if (fp === 'side' && tp === 'bottom') {
    // Side->Bottom: go right to midX, then down to ty+8, right to tx, then up to ty
    const gapY = ty + 8;
    segments.push([midX, fy], [midX, gapY], [tx, gapY], [tx, ty]);
  } else if (fp === 'top' && tp === 'side') {
    // Top->Side: go up to fy-8, then right to midX, down to ty, right to tx
    const gapY = fy - 8;
    segments.push([fx, gapY], [midX, gapY], [midX, ty], [tx, ty]);
  } else if (fp === 'bottom' && tp === 'side') {
    // Bottom->Side: go down to fy+8, then right to midX, down/up to ty, right to tx
    const gapY = fy + 8;
    segments.push([fx, gapY], [midX, gapY], [midX, ty], [tx, ty]);
  } else if (fp === 'top' && tp === 'top') {
    // Top->Top: both exit upward; go to min of both - 8, then across
    const gapY = Math.min(fy, ty) - 8;
    segments.push([fx, gapY], [tx, gapY], [tx, ty]);
  } else if (fp === 'bottom' && tp === 'bottom') {
    // Bottom->Bottom: both exit downward; go to max of both + 8, then across
    const gapY = Math.max(fy, ty) + 8;
    segments.push([fx, gapY], [tx, gapY], [tx, ty]);
  } else if (fp === 'top' && tp === 'bottom') {
    // Top->Bottom: up from source, across to tx, down to target
    const gapY = fy - 8;
    segments.push([fx, gapY], [tx, gapY], [tx, ty]);
  } else if (fp === 'bottom' && tp === 'top') {
    // Bottom->Top: down from source to midY, across to tx, up to target
    const midY = (fy + ty) / 2;
    segments.push([fx, midY], [tx, midY], [tx, ty]);
  }

  const path = segments.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect x={bar1X} y={bar1Y} width={barW} height={barH} rx={3} fill="#cbd5e1" />
      <rect x={bar2X} y={bar2Y} width={barW} height={barH} rx={3} fill="#cbd5e1" />
      <defs>
        <marker id="cp-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#3b82f6" />
        </marker>
      </defs>
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#cp-arrow)" />
    </svg>
  );
}

// ─── Connection Point Button (single popup with From + To + Auto) ────────────

const CP_OPTIONS: { value: ConnectionPoint; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

function getPointLabel(p: ConnectionPoint): string {
  if (p === 'auto') return 'Auto';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function ConnectionPointButton({
  fromPoint,
  toPoint,
  disabled,
  onChange,
}: {
  fromPoint: ConnectionPoint;
  toPoint: ConnectionPoint;
  disabled: boolean;
  onChange: (fp: ConnectionPoint, tp: ConnectionPoint) => void;
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

  const isAuto = fromPoint === 'auto' && toPoint === 'auto';
  const buttonLabel = isAuto ? 'Auto' : `${getPointLabel(fromPoint)}-${getPointLabel(toPoint)}`;

  // When Auto is checked, both are 'auto'. When unchecked, default to 'side'/'side'.
  const handleAutoToggle = () => {
    if (isAuto) {
      onChange('side', 'side');
    } else {
      onChange('auto', 'auto');
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <rect x={1} y={1} width={5} height={4} rx={1} fill={disabled ? '#94a3b8' : '#475569'} />
          <rect x={8} y={9} width={5} height={4} rx={1} fill={disabled ? '#94a3b8' : '#475569'} />
          <path d="M 6 3 L 8 3 L 8 11 L 8 11" fill="none" stroke={disabled ? '#94a3b8' : '#475569'} strokeWidth={1} />
        </svg>
        {buttonLabel}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 4,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '10px 10px',
            zIndex: 30,
            width: 280,
          }}
        >
          {/* Top row: From select + To select + Auto checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {/* From */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>From</span>
              <select
                value={isAuto ? 'side' : fromPoint}
                disabled={isAuto}
                onChange={(e) => onChange(e.target.value as ConnectionPoint, toPoint)}
                style={{
                  fontSize: 11,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: isAuto ? '#f1f5f9' : 'white',
                  color: isAuto ? '#94a3b8' : '#334155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>To</span>
              <select
                value={isAuto ? 'side' : toPoint}
                disabled={isAuto}
                onChange={(e) => onChange(fromPoint, e.target.value as ConnectionPoint)}
                style={{
                  fontSize: 11,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: isAuto ? '#f1f5f9' : 'white',
                  color: isAuto ? '#94a3b8' : '#334155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* Auto checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={isAuto}
                onChange={handleAutoToggle}
                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#334155' }}
              />
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Auto</span>
            </label>
          </div>
          {/* Illustration */}
          <div style={{ borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <ConnectionPointIllustration fromPoint={fromPoint} toPoint={toPoint} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
