import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useProjectStore } from '@/store/useProjectStore';

type Action = 'reschedule' | 'keep';

export function ConflictResolutionDialog() {
  const pendingConflicts = useProjectStore((s) => s.pendingConflicts);
  const resolveConflicts = useProjectStore((s) => s.resolveConflicts);
  const dismissConflicts = useProjectStore((s) => s.dismissConflicts);

  const [actions, setActions] = useState<Record<string, Action>>(() => {
    const initial: Record<string, Action> = {};
    for (const c of pendingConflicts) {
      initial[c.itemId] = 'reschedule';
    }
    return initial;
  });

  if (pendingConflicts.length === 0) return null;

  const setAction = (itemId: string, action: Action) => {
    setActions((prev) => ({ ...prev, [itemId]: action }));
  };

  const setAllActions = (action: Action) => {
    setActions((prev) => {
      const next = { ...prev };
      for (const c of pendingConflicts) {
        next[c.itemId] = action;
      }
      return next;
    });
  };

  const handleApply = () => {
    const resolutions = pendingConflicts.map((c) => ({
      itemId: c.itemId,
      action: actions[c.itemId] ?? 'reschedule',
    }));
    resolveConflicts(resolutions);
  };

  const fmtDate = (iso: string) => format(parseISO(iso), 'MM/dd/yyyy');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={dismissConflicts} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="text-base font-semibold text-slate-800">
                Scheduling Conflict{pendingConflicts.length > 1 ? 's' : ''}
              </h2>
            </div>
            <button
              onClick={dismissConflicts}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {pendingConflicts.length === 1
              ? 'A dependency conflict was detected. Choose how to resolve it.'
              : `${pendingConflicts.length} dependency conflicts were detected. Choose how to resolve each one.`}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-3">
            {pendingConflicts.map((conflict) => {
              const action = actions[conflict.itemId] ?? 'reschedule';
              return (
                <div
                  key={conflict.itemId}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="text-sm font-semibold text-slate-800 mb-2">
                    {conflict.itemName}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                    <div className="text-slate-500">
                      Current: {fmtDate(conflict.currentStart)} &ndash; {fmtDate(conflict.currentEnd)}
                    </div>
                    <div className="text-amber-600 font-medium">
                      Required: {fmtDate(conflict.requiredStart)} &ndash; {fmtDate(conflict.requiredEnd)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAction(conflict.itemId, 'reschedule')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        action === 'reschedule'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => setAction(conflict.itemId, 'keep')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        action === 'keep'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Keep as-is
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            {/* Bulk actions */}
            {pendingConflicts.length > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setAllActions('reschedule')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  Reschedule All
                </button>
                <button
                  onClick={() => setAllActions('keep')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  Keep All
                </button>
              </div>
            )}
            {pendingConflicts.length <= 1 && <div />}

            {/* Apply / Cancel */}
            <div className="flex gap-2">
              <button
                onClick={dismissConflicts}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
