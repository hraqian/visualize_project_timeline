import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { listProjects, deleteProjectFile } from '@/utils/fileStorage';
import type { FileProjectEntry } from '@/utils/fileStorage';
import { DialogButton, ModalCloseButton, ModalSurface } from './ModalPrimitives';
import { activeGradient, uiColor } from './uiTokens';

interface Props {
  onClose: () => void;
}

export function ProjectManagerModal({ onClose }: Props) {
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const isDirty = useProjectStore((s) => s.isDirty);
  const currentProjectId = useProjectStore((s) => s.projectId);

  const [projects, setProjects] = useState<FileProjectEntry[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      const entries = await listProjects();
      if (cancelled) return;
      setProjects(entries);
      setLoading(false);
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = () => {
    if (isDirty) {
      const discard = window.confirm('You have unsaved changes. Discard them and create a new project?');
      if (!discard) return;
    }
    newProject();
    onClose();
  };

  const handleLoad = async (id: string) => {
    if (id === currentProjectId) {
      onClose();
      return;
    }
    if (isDirty) {
      const discard = window.confirm('You have unsaved changes. Discard them and load this project?');
      if (!discard) return;
    }
    await loadProject(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteProjectFile(id);
      setConfirmDeleteId(null);
      setLoading(true);
      const entries = await listProjects();
      setProjects(entries);
      setLoading(false);
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
      <ModalSurface
        className="relative w-[520px] max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Projects</h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Actions bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <DialogButton tone="primary" onClick={handleNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium">
            <Plus size={14} />
            New Project
          </DialogButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
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
                      className="flex items-center gap-3 px-5 py-3 transition-colors"
                      style={isCurrent ? { background: activeGradient() } : undefined}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = uiColor.hoverSoft;
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FolderOpen size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text)] truncate">
                          {p.name}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-normal text-[#31549a] px-1.5 py-0.5 rounded" style={{ background: 'rgba(75, 131, 230, 0.12)', border: '1px solid rgba(75, 131, 230, 0.18)' }}>
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
                            className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                            style={{ color: uiColor.text }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
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
          Projects are saved as .json files in the data/projects folder.
        </div>
      </ModalSurface>
    </div>,
    document.body
  );
}
