import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getGlobalSettings, saveGlobalSettings } from '@/utils/storage';
import type { DependencySchedulingMode, DependencyConflictMode } from '@/types';

interface Props {
  onClose: () => void;
}

type Section = 'general' | 'dependencies';

export function SettingsModal({ onClose }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('general');

  // Load global settings into local state for editing
  const globalSettings = getGlobalSettings();
  const [depEnabled, setDepEnabled] = useState(globalSettings.defaultDependencySettings.enabled);
  const [schedulingMode, setSchedulingMode] = useState<DependencySchedulingMode>(globalSettings.defaultDependencySettings.schedulingMode);
  const [conflictMode, setConflictMode] = useState<DependencyConflictMode>(globalSettings.defaultDependencySettings.conflictMode);

  const handleSave = () => {
    saveGlobalSettings({
      defaultDependencySettings: {
        enabled: depEnabled,
        schedulingMode,
        conflictMode,
      },
    });
    onClose();
  };

  const sections: { id: Section; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'dependencies', label: 'Dependencies' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: two-panel layout */}
        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left sidebar */}
          <div className="w-[160px] bg-slate-50 border-r border-slate-200 py-3 px-2 shrink-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSection === s.id
                    ? 'bg-white text-[#4f46e5] shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === 'general' && <GeneralSection />}
            {activeSection === 'dependencies' && (
              <DependenciesSection
                depEnabled={depEnabled}
                setDepEnabled={setDepEnabled}
                schedulingMode={schedulingMode}
                setSchedulingMode={setSchedulingMode}
                conflictMode={conflictMode}
                setConflictMode={setConflictMode}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── General Section ─────────────────────────────────────────────────────────

function GeneralSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-4">General</h3>

        {/* Date Format */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-500 block mb-2">Date format</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateFormat"
                value="us"
                defaultChecked
                className="w-3.5 h-3.5 text-[#4f46e5] accent-[#4f46e5]"
              />
              <span className="text-sm text-slate-700">US (MM/dd/yyyy)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateFormat"
                value="international"
                className="w-3.5 h-3.5 text-[#4f46e5] accent-[#4f46e5]"
              />
              <span className="text-sm text-slate-700">International (dd/MM/yyyy)</span>
            </label>
          </div>
        </div>

        {/* Working Days */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-2">Working days</label>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const).map((day) => {
              const isWeekday = !['Saturday', 'Sunday'].includes(day);
              return (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={isWeekday}
                    className="w-3.5 h-3.5 rounded accent-[#4f46e5]"
                  />
                  <span className="text-sm text-slate-700">{day}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dependencies Section ────────────────────────────────────────────────────

function DependenciesSection({
  depEnabled,
  setDepEnabled,
  schedulingMode,
  setSchedulingMode,
  conflictMode,
  setConflictMode,
}: {
  depEnabled: boolean;
  setDepEnabled: (v: boolean) => void;
  schedulingMode: DependencySchedulingMode;
  setSchedulingMode: (v: DependencySchedulingMode) => void;
  conflictMode: DependencyConflictMode;
  setConflictMode: (v: DependencyConflictMode) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Scheduling Settings</h3>
        <p className="text-xs text-slate-400 mb-5">These settings apply as defaults for new timelines.</p>

        {/* Dependencies toggle */}
        <div className="mb-6">
          <button
            onClick={() => setDepEnabled(!depEnabled)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 font-medium">Dependencies</span>
              <SettingsToggle on={depEnabled} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enable or disable the dependency functionality for this timeline.
            </p>
          </button>
        </div>

        {/* Scheduling Mode — greyed out when deps disabled */}
        <div
          className={`transition-opacity ${depEnabled ? '' : 'opacity-40 pointer-events-none'}`}
        >
          <label className="text-xs font-medium text-slate-500 block mb-3">Scheduling mode</label>

          {/* Automatic - Flexible */}
          <div className="mb-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="schedulingMode"
                checked={schedulingMode === 'automatic-flexible'}
                onChange={() => setSchedulingMode('automatic-flexible')}
                className="w-3.5 h-3.5 mt-0.5 accent-[#4f46e5]"
              />
              <div>
                <span className="text-sm text-slate-700 font-medium">Automatic - Flexible</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allow slack between dependent tasks. Choose how to handle scheduling conflicts.
                </p>
              </div>
            </label>

            {/* Conflict sub-options */}
            {schedulingMode === 'automatic-flexible' && (
              <div className="ml-6 mt-2 space-y-1.5 pl-2 border-l-2 border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictMode"
                    checked={conflictMode === 'dont-allow'}
                    onChange={() => setConflictMode('dont-allow')}
                    className="w-3 h-3 accent-[#4f46e5]"
                  />
                  <span className="text-xs text-slate-600">Don't allow conflicts (reschedule to comply)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictMode"
                    checked={conflictMode === 'allow-exception'}
                    onChange={() => setConflictMode('allow-exception')}
                    className="w-3 h-3 accent-[#4f46e5]"
                  />
                  <span className="text-xs text-slate-600">Allow conflicts as an exception</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictMode"
                    checked={conflictMode === 'ask'}
                    onChange={() => setConflictMode('ask')}
                    className="w-3 h-3 accent-[#4f46e5]"
                  />
                  <span className="text-xs text-slate-600">Ask me what to do every time</span>
                </label>
              </div>
            )}
          </div>

          {/* Automatic - Strict */}
          <div className="mb-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="schedulingMode"
                checked={schedulingMode === 'automatic-strict'}
                onChange={() => setSchedulingMode('automatic-strict')}
                className="w-3.5 h-3.5 mt-0.5 accent-[#4f46e5]"
              />
              <div>
                <span className="text-sm text-slate-700 font-medium">Automatic - Strict</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  No slack or conflicts allowed between dependent tasks.
                </p>
              </div>
            </label>
          </div>

          {/* Manual */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="schedulingMode"
                checked={schedulingMode === 'manual'}
                onChange={() => setSchedulingMode('manual')}
                className="w-3.5 h-3.5 mt-0.5 accent-[#4f46e5]"
              />
              <div>
                <span className="text-sm text-slate-700 font-medium">Manual</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dependency links are visual only and don't impact scheduling.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Toggle Switch ──────────────────────────────────────────────────

function SettingsToggle({ on }: { on: boolean }) {
  return (
    <div
      className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
        on ? 'bg-green-500' : 'bg-slate-200'
      }`}
    >
      <div
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-[14px]' : 'translate-x-0.5'
        }`}
      />
    </div>
  );
}
