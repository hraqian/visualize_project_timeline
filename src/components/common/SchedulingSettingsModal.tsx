import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useProjectStore } from '@/store/useProjectStore';
import { getGlobalSettings, saveGlobalSettings } from '@/utils/storage';
import type { DependencySchedulingMode, DependencyConflictMode, RescheduledItemChange } from '@/types';
import { DialogButton, ModalCloseButton, ModalSurface } from './ModalPrimitives';

interface Props {
  onClose: () => void;
}

export function SchedulingSettingsModal({ onClose }: Props) {
  const dependencySettings = useProjectStore((s) => s.dependencySettings);
  const setDependencySettings = useProjectStore((s) => s.setDependencySettings);
  const dependencies = useProjectStore((s) => s.dependencies);

  // Local state for editing (initialized from current project)
  const [schedulingMode, setSchedulingMode] = useState<DependencySchedulingMode>(
    dependencySettings.schedulingMode
  );
  const [conflictMode, setConflictMode] = useState<DependencyConflictMode>(
    dependencySettings.conflictMode
  );
  const [rememberForFuture, setRememberForFuture] = useState(false);
  const [showStrictWarning, setShowStrictWarning] = useState(false);
  const [summaryChanges, setSummaryChanges] = useState<RescheduledItemChange[] | null>(null);

  const isAutomatic =
    schedulingMode === 'automatic-flexible' || schedulingMode === 'automatic-strict';

  const isSwitchingToStrict =
    schedulingMode === 'automatic-strict' &&
    dependencySettings.schedulingMode !== 'automatic-strict' &&
    dependencies.length > 0;

  const fmt = (iso: string) => format(parseISO(iso), 'MM/dd/yyyy');

  const doSave = () => {
    // Update current project's dependency settings
    const changes = setDependencySettings({ schedulingMode, conflictMode });

    // Optionally save to global defaults for future timelines
    if (rememberForFuture) {
      const globalSettings = getGlobalSettings();
      saveGlobalSettings({
        ...globalSettings,
        defaultDependencySettings: {
          ...globalSettings.defaultDependencySettings,
          schedulingMode,
          conflictMode,
        },
      });
    }

    // If strict mode caused rescheduling, show summary instead of closing
    if (changes.length > 0) {
      setSummaryChanges(changes);
      setShowStrictWarning(false);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (isSwitchingToStrict) {
      setShowStrictWarning(true);
      return;
    }
    doSave();
  };

  // ─── Summary view ────────────────────────────────────────────────────
  if (summaryChanges !== null) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <ModalSurface className="relative w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <h2 className="text-base font-semibold text-slate-800">Rescheduling Complete</h2>
              </div>
              <ModalCloseButton onClick={onClose} size={16} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {summaryChanges.length === 0
                ? 'No items were changed. All items already match their dependency constraints.'
                : `${summaryChanges.length} item${summaryChanges.length === 1 ? ' was' : 's were'} rescheduled to match strict dependency constraints.`}
            </p>
          </div>

          {/* Body — change list */}
          {summaryChanges.length > 0 && (
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Previous dates</th>
                    <th className="pb-2 font-medium">New dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryChanges.map((change, i) => {
                    const oldSame = change.oldStart === change.oldEnd;
                    const newSame = change.newStart === change.newEnd;
                    return (
                      <tr key={i}>
                        <td className="py-2.5 pr-3 text-slate-700 font-medium">{change.itemName}</td>
                        <td className="py-2.5 pr-3 text-slate-500">
                          {oldSame ? fmt(change.oldStart) : `${fmt(change.oldStart)} - ${fmt(change.oldEnd)}`}
                        </td>
                        <td className="py-2.5 text-slate-700">
                          {newSame ? fmt(change.newStart) : `${fmt(change.newStart)} - ${fmt(change.newEnd)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex justify-end">
            <DialogButton tone="primary" onClick={onClose}>Done</DialogButton>
          </div>
        </ModalSurface>
      </div>,
      document.body
    );
  }

  // ─── Settings view ───────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <ModalSurface className="relative w-[480px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Scheduling Settings</h2>
            <ModalCloseButton onClick={onClose} size={16} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Will apply only to your current timeline.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* Automatic */}
          <div className="mb-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="ssm-topMode"
                checked={isAutomatic}
                onChange={() => {
                  if (!isAutomatic) setSchedulingMode('automatic-flexible');
                }}
                className="w-4 h-4 mt-0.5 accent-[#1e293b]"
              />
              <div>
                <span className="text-sm text-slate-800 font-semibold">Automatic</span>
                <p className="text-sm text-slate-500 mt-0.5">
                  Items are automatically scheduled based on their dependency relationships.
                </p>
              </div>
            </label>

            {/* Flexible / Strict sub-options */}
            {isAutomatic && (
              <div className="ml-7 mt-3 space-y-3">
                {/* Flexible */}
                <div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="ssm-autoSubMode"
                      checked={schedulingMode === 'automatic-flexible'}
                      onChange={() => setSchedulingMode('automatic-flexible')}
                      className="w-4 h-4 mt-0.5 accent-[#1e293b]"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-semibold">Flexible</span>
                      <span className="text-slate-500"> (allow slack)</span>
                    </span>
                  </label>

                  {/* Conflict sub-options */}
                  {schedulingMode === 'automatic-flexible' && (
                    <div className="ml-7 mt-2">
                      <p className="text-sm text-slate-500 mb-2">
                        Whenever an item's date conflicts with dependency rules:
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="ssm-conflictMode"
                            checked={conflictMode === 'dont-allow'}
                            onChange={() => setConflictMode('dont-allow')}
                            className="w-4 h-4 mt-0.5 accent-[#1e293b]"
                          />
                          <span className="text-sm text-slate-600">
                            Don't allow conflicts{' '}
                            <span className="text-slate-400">
                              (Reschedule that item to comply with the dependency rules)
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="ssm-conflictMode"
                            checked={conflictMode === 'allow-exception'}
                            onChange={() => setConflictMode('allow-exception')}
                            className="w-4 h-4 mt-0.5 accent-[#1e293b]"
                          />
                          <span className="text-sm text-slate-600">
                            Allow conflicts as an exception{' '}
                            <span className="text-slate-400">
                              (Keep that item in its conflicting position)
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="ssm-conflictMode"
                            checked={conflictMode === 'ask'}
                            onChange={() => setConflictMode('ask')}
                            className="w-4 h-4 mt-0.5 accent-[#1e293b]"
                          />
                          <span className="text-sm text-slate-600">
                            Ask me what to do every time
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Strict */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ssm-autoSubMode"
                    checked={schedulingMode === 'automatic-strict'}
                    onChange={() => setSchedulingMode('automatic-strict')}
                    className="w-4 h-4 mt-0.5 accent-[#1e293b]"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="font-semibold">Strict</span>
                    <span className="text-slate-400">
                      {' '}
                      (Don't allow slack or dependency conflicts)
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Manual */}
          <div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="ssm-topMode"
                checked={schedulingMode === 'manual'}
                onChange={() => setSchedulingMode('manual')}
                className="w-4 h-4 mt-0.5 accent-[#1e293b]"
              />
              <div>
                <span className="text-sm text-slate-800 font-semibold">Manual</span>
                <p className="text-sm text-slate-500 mt-0.5">
                  Dependency links are strictly visual and don't impact scheduling.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          {/* Strict mode warning */}
          {showStrictWarning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-slate-700 font-medium">
                  Switching to strict mode may change your schedule
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Items with slack (positioned after their dependency constraint) will be
                  snapped to their exact required dates.
                </p>
                <div className="flex gap-2 mt-3">
                  <DialogButton onClick={() => setShowStrictWarning(false)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'linear-gradient(180deg, #fffdf7 0%, #fef3c7 100%)', border: '1px solid #fde68a', color: '#92400e', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>Go Back</DialogButton>
                  <DialogButton tone="primary" onClick={doSave} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' }}>Continue</DialogButton>
                </div>
              </div>
            </div>
          )}

          {/* Remember checkbox */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberForFuture}
              onChange={(e) => setRememberForFuture(e.target.checked)}
              className="w-4 h-4 accent-[#1e293b] rounded"
            />
            <span className="text-sm text-slate-600">
              Remember these settings for future timelines too
            </span>
          </label>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <DialogButton onClick={onClose}>Cancel</DialogButton>
            <DialogButton tone="primary" onClick={handleSave}>Save</DialogButton>
          </div>
        </div>
      </ModalSurface>
    </div>,
    document.body
  );
}
