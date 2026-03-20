import { useProjectStore } from '@/store/useProjectStore';
import {
  X,
  Paintbrush,
  Copy,
  ChevronDown,
  ChevronRight,
  Trash2,
  Calendar,
  Check,
} from 'lucide-react';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import {
  PRESET_COLORS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type BarShape,
  type LabelPosition,
  type MilestoneIcon,
} from '@/types';
import { useState } from 'react';

const MILESTONE_ICONS: MilestoneIcon[] = [
  'diamond', 'diamond-filled', 'triangle', 'triangle-filled',
  'flag', 'flag-filled', 'star', 'star-filled',
  'circle', 'circle-filled', 'square-ms', 'square-ms-filled',
  'check', 'arrow-up', 'arrow-right', 'hexagon',
];

const BAR_SHAPES: { id: BarShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'double-chevron', label: 'Double Chevron' },
  { id: 'arrow-right', label: 'Arrow Right' },
  { id: 'pointed', label: 'Pointed' },
  { id: 'notched', label: 'Notched' },
  { id: 'tab', label: 'Tab' },
  { id: 'arrow-both', label: 'Arrow Both' },
  { id: 'trapezoid', label: 'Trapezoid' },
  { id: 'flat', label: 'Flat' },
];

const LABEL_POSITIONS: { id: LabelPosition; label: string }[] = [
  { id: 'right', label: 'Right' },
  { id: 'above', label: 'Above' },
  { id: 'inside', label: 'Inside' },
  { id: 'left', label: 'Left' },
];

export function StylePane() {
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const items = useProjectStore((s) => s.items);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const updateTaskStyle = useProjectStore((s) => s.updateTaskStyle);
  const updateMilestoneStyle = useProjectStore((s) => s.updateMilestoneStyle);
  const applyStyleToAll = useProjectStore((s) => s.applyStyleToAll);
  const applyPartialStyleToAll = useProjectStore((s) => s.applyPartialStyleToAll);
  const deleteItem = useProjectStore((s) => s.deleteItem);
  const timescale = useProjectStore((s) => s.timescale);
  const updateTimescale = useProjectStore((s) => s.updateTimescale);
  const updateTier = useProjectStore((s) => s.updateTier);

  const [showTimescale, setShowTimescale] = useState(false);

  const item = items.find((i) => i.id === selectedItemId);

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Paintbrush size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Style Pane — Designer
          </span>
        </div>
        <button
          onClick={() => setSelectedItem(null)}
          className="p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {item ? (
          <>
            {/* Item Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
                  {item.type === 'task' ? 'Task Style' : 'Milestone Style'}
                </div>
                <div className="font-medium text-sm">{item.name}</div>
              </div>
              <button
                onClick={() => {
                  deleteItem(item.id);
                }}
                className="p-1.5 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Task Styling */}
            {item.type === 'task' && (
              <>
                {/* Color */}
                <Section title="Color">
                  <ColorPicker
                    value={item.taskStyle.color}
                    onChange={(color) => updateTaskStyle(item.id, { color })}
                  />
                </Section>

                {/* Bar Shape */}
                <Section title="Bar Shape">
                  <div className="grid grid-cols-4 gap-1.5">
                    {BAR_SHAPES.map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => updateTaskStyle(item.id, { barShape: shape.id })}
                        className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                          item.taskStyle.barShape === shape.id
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                        title={shape.label}
                      >
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Thickness */}
                <Section title="Bar Thickness">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={16}
                      max={48}
                      value={item.taskStyle.thickness}
                      onChange={(e) => updateTaskStyle(item.id, { thickness: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{item.taskStyle.thickness}px</span>
                  </div>
                </Section>

                {/* Label Position */}
                <Section title="Label Position">
                  <div className="flex gap-1.5 flex-wrap">
                    {LABEL_POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => updateTaskStyle(item.id, { labelPosition: pos.id })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          item.taskStyle.labelPosition === pos.id
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Font Size */}
                <Section title="Font Size">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={18}
                      value={item.taskStyle.fontSize}
                      onChange={(e) => updateTaskStyle(item.id, { fontSize: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{item.taskStyle.fontSize}px</span>
                  </div>
                </Section>

                {/* Font Family */}
                <Section title="Font Family">
                  <select
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
                    value={item.taskStyle.fontFamily}
                    onChange={(e) => updateTaskStyle(item.id, { fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </Section>

                {/* Font Weight */}
                <Section title="Font Weight">
                  <div className="flex gap-1.5 flex-wrap">
                    {FONT_WEIGHTS.map((w) => (
                      <button
                        key={w.value}
                        onClick={() => updateTaskStyle(item.id, { fontWeight: w.value })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          item.taskStyle.fontWeight === w.value
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Font Color */}
                <Section title="Font Color">
                  <ColorPicker
                    value={item.taskStyle.fontColor}
                    onChange={(fontColor) => updateTaskStyle(item.id, { fontColor })}
                  />
                </Section>
              </>
            )}

            {/* Milestone Styling */}
            {item.type === 'milestone' && (
              <>
                {/* Color */}
                <Section title="Color">
                  <ColorPicker
                    value={item.milestoneStyle.color}
                    onChange={(color) => updateMilestoneStyle(item.id, { color })}
                  />
                </Section>

                {/* Icon */}
                <Section title="Icon">
                  <div className="grid grid-cols-8 gap-1.5">
                    {MILESTONE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => updateMilestoneStyle(item.id, { icon })}
                        className={`p-2 rounded-md flex items-center justify-center transition-all ${
                          item.milestoneStyle.icon === icon
                            ? 'bg-indigo-500/20 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                        title={icon}
                      >
                        <MilestoneIconComponent icon={icon} size={16} color={item.milestoneStyle.color} />
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Size */}
                <Section title="Icon Size">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={12}
                      max={36}
                      value={item.milestoneStyle.size}
                      onChange={(e) => updateMilestoneStyle(item.id, { size: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{item.milestoneStyle.size}px</span>
                  </div>
                </Section>

                {/* Label Position */}
                <Section title="Label Position">
                  <div className="flex gap-1.5 flex-wrap">
                    {LABEL_POSITIONS.filter((p) => p.id !== 'inside').map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => updateMilestoneStyle(item.id, { labelPosition: pos.id })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          item.milestoneStyle.labelPosition === pos.id
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Font Size */}
                <Section title="Font Size">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={18}
                      value={item.milestoneStyle.fontSize}
                      onChange={(e) => updateMilestoneStyle(item.id, { fontSize: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{item.milestoneStyle.fontSize}px</span>
                  </div>
                </Section>

                {/* Font Family */}
                <Section title="Font Family">
                  <select
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
                    value={item.milestoneStyle.fontFamily}
                    onChange={(e) => updateMilestoneStyle(item.id, { fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </Section>

                {/* Font Weight */}
                <Section title="Font Weight">
                  <div className="flex gap-1.5 flex-wrap">
                    {FONT_WEIGHTS.map((w) => (
                      <button
                        key={w.value}
                        onClick={() => updateMilestoneStyle(item.id, { fontWeight: w.value })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          item.milestoneStyle.fontWeight === w.value
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Font Color */}
                <Section title="Font Color">
                  <ColorPicker
                    value={item.milestoneStyle.fontColor}
                    onChange={(fontColor) => updateMilestoneStyle(item.id, { fontColor })}
                  />
                </Section>
              </>
            )}

            {/* Apply to All */}
            <ApplyToAllSection item={item} applyStyleToAll={applyStyleToAll} applyPartialStyleToAll={applyPartialStyleToAll} />
          </>
        ) : (
          <div className="text-center text-[var(--color-text-muted)] text-sm py-8">
            Select an item to style it
          </div>
        )}

        {/* Timescale Section */}
        <div className="border-t border-[var(--color-border)] pt-4 mt-4">
          <button
            onClick={() => setShowTimescale(!showTimescale)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            {showTimescale ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Calendar size={14} />
            Timescale Settings
          </button>

          {showTimescale && (
            <div className="mt-3 space-y-4">
              {/* Fiscal Year */}
              <Section title="Fiscal Year Start">
                <select
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-indigo-500 transition-colors"
                  value={timescale.fiscalYearStartMonth}
                  onChange={(e) =>
                    updateTimescale({ fiscalYearStartMonth: parseInt(e.target.value) })
                  }
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December',
                  ].map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </Section>

              {/* Today Line */}
              <Section title="Today Line">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={timescale.showToday}
                      onChange={(e) => updateTimescale({ showToday: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    Show Today Marker
                  </label>
                  <input
                    type="color"
                    value={timescale.todayColor}
                    onChange={(e) => updateTimescale({ todayColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                  />
                </div>
              </Section>

              {/* Tier Configs */}
              {timescale.tiers.map((tier, idx) => (
                <Section key={idx} title={`Tier ${idx + 1}: ${tier.unit.charAt(0).toUpperCase() + tier.unit.slice(1)}`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={tier.visible}
                          onChange={(e) => updateTier(idx, { visible: e.target.checked })}
                          className="accent-indigo-500"
                        />
                        Visible
                      </label>
                      <select
                        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none"
                        value={tier.unit}
                        onChange={(e) => updateTier(idx, { unit: e.target.value as any })}
                      >
                        <option value="year">Year</option>
                        <option value="quarter">Quarter</option>
                        <option value="month">Month</option>
                        <option value="week">Week</option>
                        <option value="day">Day</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Background</label>
                        <input
                          type="color"
                          value={tier.backgroundColor}
                          onChange={(e) => updateTier(idx, { backgroundColor: e.target.value })}
                          className="w-full h-7 rounded cursor-pointer border border-[var(--color-border)]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Font Color</label>
                        <input
                          type="color"
                          value={tier.fontColor}
                          onChange={(e) => updateTier(idx, { fontColor: e.target.value })}
                          className="w-full h-7 rounded cursor-pointer border border-[var(--color-border)]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Font Size</label>
                        <input
                          type="number"
                          min={9}
                          max={18}
                          value={tier.fontSize}
                          onChange={(e) => updateTier(idx, { fontSize: parseInt(e.target.value) })}
                          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </Section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Apply to All Section ────────────────────────────────────────────────────

const TASK_STYLE_GROUPS = [
  { label: 'Color', keys: ['color'] },
  { label: 'Bar Shape', keys: ['barShape'] },
  { label: 'Bar Thickness', keys: ['thickness'] },
  { label: 'Label Position', keys: ['labelPosition'] },
  { label: 'Font', keys: ['fontSize', 'fontFamily', 'fontWeight', 'fontColor'] },
] as const;

const MILESTONE_STYLE_GROUPS = [
  { label: 'Color', keys: ['color'] },
  { label: 'Icon', keys: ['icon'] },
  { label: 'Icon Size', keys: ['size'] },
  { label: 'Label Position', keys: ['labelPosition'] },
  { label: 'Font', keys: ['fontSize', 'fontFamily', 'fontWeight', 'fontColor'] },
] as const;

function ApplyToAllSection({
  item,
  applyStyleToAll,
  applyPartialStyleToAll,
}: {
  item: { id: string; type: string };
  applyStyleToAll: (id: string) => void;
  applyPartialStyleToAll: (id: string, keys: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  const isTask = item.type === 'task';
  const groups = isTask ? TASK_STYLE_GROUPS : MILESTONE_STYLE_GROUPS;
  const typeLabel = isTask ? 'Tasks' : 'Milestones';

  const handleApplyGroup = (keys: readonly string[], label: string) => {
    applyPartialStyleToAll(item.id, [...keys]);
    setAppliedKey(label);
    setTimeout(() => setAppliedKey(null), 1200);
  };

  const handleApplyAll = () => {
    applyStyleToAll(item.id);
    setAppliedKey('__all__');
    setTimeout(() => setAppliedKey(null), 1200);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleApplyAll}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all text-sm font-medium"
      >
        {appliedKey === '__all__' ? <Check size={14} /> : <Copy size={14} />}
        {appliedKey === '__all__' ? 'Applied!' : `Apply All Styles to ${typeLabel}`}
      </button>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors py-1"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Apply individual properties
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-1.5">
          {groups.map((g) => (
            <button
              key={g.label}
              onClick={() => handleApplyGroup(g.keys, g.label)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all border ${
                appliedKey === g.label
                  ? 'bg-green-500/15 text-green-300 border-green-500/30'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]'
              }`}
            >
              {appliedKey === g.label ? <Check size={11} /> : <Copy size={11} />}
              {appliedKey === g.label ? 'Done' : g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium block mb-2">
        {title}
      </label>
      {children}
    </div>
  );
}

// ─── Color Picker ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 ${
              value === color ? 'border-white shadow-lg scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] font-mono outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
