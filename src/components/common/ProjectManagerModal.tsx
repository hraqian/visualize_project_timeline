import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FolderOpen } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { getProjectIndex, deleteProject as deleteProjectFromStorage } from '@/utils/storage';
import type { ProjectIndexEntry } from '@/utils/storage';

interface Props {
  onClose: () => void;
}

export function ProjectManagerModal({ onClose }: Props) {
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const isDirty = useProjectStore((s) => s.isDirty);
  const currentProjectId = useProjectStore((s) => s.projectId);

  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(getProjectIndex());
  }, []);

  const refreshIndex = () => {
    setProjects(getProjectIndex());
  };

  const handleNew = () => {
    if (isDirty) {
      const discard = window.confirm('You have unsaved changes. Discard them and create a new project?');
      if (!discard) return;
    }
    newProject();
    onClose();
  };

  const handleLoad = (id: string) => {
    if (id === currentProjectId) {
      onClose();
      return;
    }
    if (isDirty) {
      const discard = window.confirm('You have unsaved changes. Discard them and load this project?');
      if (!discard) return;
    }
    loadProject(id);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteProjectFromStorage(id);
      setConfirmDeleteId(null);
      refreshIndex();
      // If we deleted the current project, create a new one
      if (id === currentProjectId) {
        newProject();
        onClose();
      }
    } else {
      setConfirmDeleteId(id);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl w-[520px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Projects</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              No saved projects yet. Save your current project or create a new one.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {projects
                .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
                .map((p) => {
                  const isCurrent = p.id === currentProjectId;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-hover)] transition-colors ${
                        isCurrent ? 'bg-[var(--color-bg-secondary)]' : ''
                      }`}
                    >
                      <FolderOpen size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text)] truncate">
                          {p.name}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-normal text-[#4f46e5] bg-[#4f46e5]/10 px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Last saved: {formatDate(p.lastModified)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isCurrent && (
                          <button
                            onClick={() => handleLoad(p.id)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-[#4f46e5] hover:bg-[#4f46e5]/10 transition-colors"
                          >
                            Open
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p.id)}
                          className={`p-1.5 rounded transition-colors ${
                            confirmDeleteId === p.id
                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                              : 'text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={confirmDeleteId === p.id ? 'Click again to confirm delete' : 'Delete project'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          Projects are stored in your browser's local storage.
        </div>
      </div>
    </div>,
    document.body
  );
}
