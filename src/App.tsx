import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { DataView, AddDropdownButton } from '@/components/DataView/DataView';
import { TimelineView } from '@/components/TimelineView/TimelineView';
import type { TimelineViewHandle } from '@/components/TimelineView/TimelineView';
import { StylePane } from '@/components/StylePane/StylePane';
import { ProjectManagerModal } from '@/components/common/ProjectManagerModal';
import { SettingsModal } from '@/components/common/SettingsModal';
import { ConflictResolutionDialog } from '@/components/common/ConflictResolutionDialog';
import { ConnectionPointButton } from '@/components/common/ConnectionPointButton';
import { ToolbarButton, ToolbarIconButton, ToolbarSplitButton } from '@/components/common/ToolbarPrimitives';
import { toolbarContentStyle } from '@/components/common/toolbarContentStyle';
import { PopoverSurface, MenuRow } from '@/components/common/PopoverPrimitives';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
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
import type { ActiveView } from '@/types';

type ExportTestApi = {
  exportPNG: () => Promise<void>;
  exportPPTX: () => Promise<void>;
};

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
  const lastModified = useProjectStore((s) => s.lastModified);
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
  const [showProjectManager, setShowProjectManager] = useState(false);
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
      store.rowArrangement,
      store.densityMode,
      store.swimlaneSpacing,
    );
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const exposeTestApi = import.meta.env.DEV || searchParams.has('__regression__');
    if (!exposeTestApi) return;
    const testWindow = window as Window & {
      __PROJECT_STORE__?: typeof useProjectStore;
      __EXPORT_TEST_API__?: ExportTestApi;
    };
    testWindow.__PROJECT_STORE__ = useProjectStore;
    testWindow.__EXPORT_TEST_API__ = {
      exportPNG,
      exportPPTX,
    };
    return () => {
      delete testWindow.__PROJECT_STORE__;
      delete testWindow.__EXPORT_TEST_API__;
    };
  }, [exportPNG, exportPPTX]);

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
            {(saveFlash || isDirty || lastModified) && (
              <span className="text-xs font-normal text-white/60">
                {saveFlash ? '- Saved!' : isDirty ? '- Unsaved changes' : '- Saved'}
              </span>
            )}
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
              <ToolbarButton
                onClick={handleAddTask}
                className="flex items-center rounded-lg border transition-all"
                style={toolbarContentStyle()}
                icon={<Plus size={14} />}
              >
                Task
              </ToolbarButton>
              <ToolbarButton
                onClick={handleAddMilestone}
                className="flex items-center rounded-lg border transition-all"
                style={toolbarContentStyle()}
                icon={<Plus size={14} />}
              >
                Milestone
              </ToolbarButton>
              <ToolbarButton
                onClick={handleAddSwimlane}
                className="flex items-center rounded-lg border transition-all"
                style={toolbarContentStyle()}
                icon={<Plus size={14} />}
              >
                Swimlane
              </ToolbarButton>
              {/* Dep link actions — always visible, disabled when no dep selected */}
              {(() => {
                const selectedDep = selectedDepKey ? dependencies.find((d) => `${d.fromId}-${d.toId}` === selectedDepKey) : null;
                const isHidden = selectedDep?.visible === false;
                return (
                  <>
                    <div className="w-px h-6 bg-[var(--color-border)] mx-1" />
                    <ToolbarButton
                      disabled={!selectedDepKey}
                      onClick={() => {
                        if (selectedDep) {
                          updateDependency(selectedDep.fromId, selectedDep.toId, { visible: isHidden ? true : false });
                        }
                      }}
                      className="flex items-center rounded-lg border transition-all"
                      style={toolbarContentStyle()}
                      icon={isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    >
                      {isHidden ? 'Show' : 'Hide'}
                    </ToolbarButton>
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
                    <ToolbarButton
                      disabled={!selectedDepKey}
                      onClick={() => {
                        if (selectedDep) {
                          removeDependency(selectedDep.fromId, selectedDep.toId);
                          setSelectedDepKey(null);
                        }
                      }}
                      className="flex items-center rounded-lg border transition-all"
                      style={toolbarContentStyle()}
                      icon={<Trash2 size={14} />}
                      destructive={Boolean(selectedDepKey)}
                    >
                      Delete
                    </ToolbarButton>
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
          <ToolbarButton
            onClick={() => setShowProjectManager(true)}
            className="flex items-center rounded-lg border transition-all"
            style={toolbarContentStyle()}
            icon={<FolderOpen size={14} />}
            tone="secondary"
          >
            Projects
          </ToolbarButton>
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
          <ToolbarIconButton
            onClick={() => setShowSettingsModal(true)}
          >
            <Settings size={16} />
          </ToolbarIconButton>
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
      <ToolbarSplitButton
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        icon={<Download size={14} />}
        chevron={<ChevronDown size={12} />}
      >
        Export
      </ToolbarSplitButton>
      {open && (
        <PopoverSurface className="absolute right-0 top-full mt-1 py-1.5 z-30 min-w-[180px]">
          <button
            onClick={() => { onExportPNG(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-[#f7fafc] transition-colors flex items-center gap-2"
          >
            <Image size={14} />
            Export as PNG
          </button>
          <button
            onClick={() => { onExportPPTX(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-[#f7fafc] transition-colors flex items-center gap-2"
          >
            <Presentation size={14} />
            Export as PowerPoint
          </button>
        </PopoverSurface>
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
      <ToolbarSplitButton
        onClick={() => setOpen(!open)}
        icon={<Link2 size={14} />}
        chevron={<ChevronDown size={12} />}
        >
        Dependencies
      </ToolbarSplitButton>
      {open && (
        <PopoverSurface className="absolute right-0 top-full mt-1 py-1 z-30 min-w-[280px]">
          {/* Critical Path toggle */}
          <MenuRow className="w-full text-left px-3 py-2 text-sm text-slate-400 cursor-not-allowed flex items-center justify-between" disabled>
            <span>Critical path</span>
            <ToggleSwitch checked={showCriticalPath} disabled />
          </MenuRow>

          {/* Separator */}
          <div className="h-px bg-slate-100 mx-2 my-1" />

          {/* Dependencies toggle */}
          <button
            onClick={() => { onToggleDependencies(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-[#f7fafc] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 font-medium">Dependencies</span>
              <ToggleSwitch checked={showDependencies} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enable or disable the dependency functionality for this timeline.
            </p>
          </button>
        </PopoverSurface>
      )}
    </div>
  );
}

export default App;
