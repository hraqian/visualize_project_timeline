import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { DataView } from '@/components/DataView/DataView';
import { TimelineView } from '@/components/TimelineView/TimelineView';
import { StylePane } from '@/components/StylePane/StylePane';
import { Pencil } from 'lucide-react';
import type { ActiveView } from '@/types';

function App() {
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed) setProjectName(trimmed);
    else setNameValue(projectName);
    setEditingName(false);
  };

  const viewTabs: { id: ActiveView; label: string }[] = [
    { id: 'data', label: 'Data' },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* ─── Top header: project name (centered) ─── */}
      <div className="flex items-center justify-center py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        {editingName ? (
          <input
            className="text-lg font-semibold text-[var(--color-text)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-1 outline-none focus:border-indigo-500 min-w-[240px] text-center"
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
            className="group flex items-center gap-2 text-lg font-semibold text-[var(--color-text)] hover:text-indigo-600 transition-colors"
          >
            {projectName}
            <Pencil
              size={14}
              className="opacity-0 group-hover:opacity-50 transition-opacity"
            />
          </button>
        )}
      </div>

      {/* ─── View tabs ─── */}
      <div className="flex items-center justify-center py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <div className="flex bg-[var(--color-bg)] rounded-lg p-0.5 gap-0.5">
          {viewTabs.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeView === v.id
                  ? 'bg-indigo-500/15 text-indigo-600 shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {activeView === 'data' ? <DataView /> : <TimelineView />}
        </div>
        {selectedItemId && (
          <div className="w-[340px] border-l border-[var(--color-border)] overflow-y-auto scrollbar-thin">
            <StylePane />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
