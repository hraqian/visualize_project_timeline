import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FolderOpen, HardDrive, FolderSearch } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import {
  listProjects,
  deleteProjectFile,
  getDirectoryHandle,
  pickDirectory,
  restoreDirectoryHandle,
  isFileSystemSupported,
} from '@/utils/fileStorage';
import type { FileProjectEntry } from '@/utils/fileStorage';

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
  const [hasDirectory, setHasDirectory] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    if (!getDirectoryHandle()) {
      setProjects([]);
      setHasDirectory(false);
      setLoading(false);
      return;
    }
    setHasDirectory(true);
    setLoading(true);
    const entries = await listProjects();
    setProjects(entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Try to restore a previously chosen directory, then list projects
    (async () => {
      if (!getDirectoryHandle()) {
        await restoreDirectoryHandle();
      }
      await refreshProjects();
    })();
  }, [refreshProjects]);

  const handlePickDirectory = async () => {
    const picked = await pickDirectory();
    if (picked) {
      await refreshProjects();
    }
  };

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
      await refreshProjects();
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

  const supported = isFileSystemSupported();

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
          {supported && (
            <button
              onClick={handlePickDirectory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <FolderSearch size={14} />
              {hasDirectory ? 'Change Folder' : 'Choose Folder'}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!supported ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              <HardDrive size={24} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
              <p>File system access is not supported in this browser.</p>
              <p className="mt-1 text-xs">Please use Chrome or Edge for file-based project storage.</p>
            </div>
          ) : !hasDirectory ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              <FolderOpen size={24} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
              <p>Choose a folder to store your project files.</p>
              <p className="mt-1 text-xs">Projects are saved as .json files in the folder you select.</p>
              <button
                onClick={handlePickDirectory}
                className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors"
              >
                Choose Folder
              </button>
            </div>
          ) : loading ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              No saved projects in this folder. Save your current project or create a new one.
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
          {hasDirectory
            ? 'Projects are saved as .json files in your chosen folder.'
            : 'Choose a folder to enable file-based project storage.'}
        </div>
      </div>
    </div>,
    document.body
  );
}
