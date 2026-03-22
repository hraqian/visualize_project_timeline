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
import { restoreDirectoryHandle } from '@/utils/fileStorage';
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
} from 'lucide-react';
import type { ActiveView } from '@/types';

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

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const [showProjectManager, setShowProjectManager] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const timelineRef = useRef<TimelineViewHandle>(null);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed) setProjectName(trimmed);
    else setNameValue(projectName);
    setEditingName(false);
  }, [nameValue, projectName, setProjectName]);

  // On mount, restore the file system directory handle from IndexedDB
  useEffect(() => {
    restoreDirectoryHandle();
  }, []);

  // Keyboard shortcuts: Cmd+Z undo, Cmd+Shift+Z redo, Cmd+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (e.key === 's') { e.preventDefault(); saveProject(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, saveProject]);

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
      <div className="flex items-center h-10 bg-[#4f46e5] shrink-0 px-3">
        {/* Left: Save + Undo/Redo */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => saveProject()}
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
              {isDirty ? '- Unsaved changes' : '- Saved'}
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
      <div className="flex items-center h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
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
                    ? 'bg-white text-[#4f46e5] shadow-sm border border-[var(--color-border)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[#4f46e5]' : ''} />
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
          {activeView === 'data' ? <DataView /> : <TimelineView ref={timelineRef} />}
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
            ? 'text-[#4f46e5] border-[#4f46e5]/30 bg-indigo-50 hover:bg-indigo-100'
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

export default App;
