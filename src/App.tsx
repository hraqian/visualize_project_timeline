import { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { DataView, AddDropdownButton } from '@/components/DataView/DataView';
import { TimelineView } from '@/components/TimelineView/TimelineView';
import { StylePane } from '@/components/StylePane/StylePane';
import { ProjectManagerModal } from '@/components/common/ProjectManagerModal';
import {
  Pencil,
  Plus,
  Download,
  Settings,
  List,
  GanttChart,
  Save,
  FolderOpen,
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

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const [showProjectManager, setShowProjectManager] = useState(false);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed) setProjectName(trimmed);
    else setNameValue(projectName);
    setEditingName(false);
  }, [nameValue, projectName, setProjectName]);

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

  const viewTabs: { id: ActiveView; label: string; icon: typeof List }[] = [
    { id: 'data', label: 'Data', icon: List },
    { id: 'timeline', label: 'Timeline', icon: GanttChart },
  ];

  const isTimeline = activeView === 'timeline';

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* ─── Row 1: Project title banner ─── */}
      <div className="flex items-center justify-center h-10 bg-[#4f46e5] shrink-0 relative">
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

        {/* Right: Save + Projects + Download + Settings */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={saveProject}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
              isDirty
                ? 'text-white bg-[#4f46e5] border-[#4f46e5] hover:bg-[#4338ca]'
                : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <FolderOpen size={14} />
            Projects
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <Download size={14} />
            Download
          </button>
          <button
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {activeView === 'data' ? <DataView /> : <TimelineView />}
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
    </div>
  );
}

export default App;
