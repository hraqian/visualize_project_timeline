import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { DataView, AddDropdownButton } from '@/components/DataView/DataView';
import { TimelineView } from '@/components/TimelineView/TimelineView';
import type { TimelineViewHandle } from '@/components/TimelineView/TimelineView';
import { StylePane } from '@/components/StylePane/StylePane';
import { ProjectManagerModal } from '@/components/common/ProjectManagerModal';
import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';
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
  const [showProjectManager, setShowProjectManager] = useState(true);

  const timelineRef = useRef<TimelineViewHandle>(null);

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

  const captureTimeline = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const el = timelineRef.current?.getExportElement();
    if (!el) return null;
    return html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
  }, []);

  const exportPNG = useCallback(async () => {
    const canvas = await captureTimeline();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [captureTimeline, projectName]);

  const exportPPTX = useCallback(async () => {
    const canvas = await captureTimeline();
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    const pptx = new PptxGenJS();
    // Use widescreen 16:9 layout
    pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
    pptx.layout = 'WIDE';
    const slide = pptx.addSlide();
    // Fit image to slide with padding
    const imgAspect = canvas.width / canvas.height;
    const slideW = 12.5; // leave 0.4" margin each side
    const slideH = 6.8; // leave some margin top/bottom
    let w = slideW;
    let h = w / imgAspect;
    if (h > slideH) {
      h = slideH;
      w = h * imgAspect;
    }
    const x = (13.333 - w) / 2;
    const y = (7.5 - h) / 2;
    slide.addImage({ data: imgData, x, y, w, h });
    await pptx.writeFile({ fileName: `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx` });
  }, [captureTimeline, projectName]);

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
          <ExportButton
            disabled={!isTimeline}
            onExportPNG={exportPNG}
            onExportPPTX={exportPPTX}
          />
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

export default App;
