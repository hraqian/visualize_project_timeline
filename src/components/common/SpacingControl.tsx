// ─── SpacingControl ──────────────────────────────────────────────────────────

interface SpacingControlProps {
  value: number;
  onChange: (value: number) => void;
  presets?: { label: string; value: number; gap: number }[];
}

const DEFAULT_SPACING_PRESETS = [
  { label: 'Tight', value: 4, gap: 2 },
  { label: 'Normal', value: 8, gap: 4 },
  { label: 'Wide', value: 16, gap: 6 },
];

export function SpacingControl({
  value,
  onChange,
  presets = DEFAULT_SPACING_PRESETS,
}: SpacingControlProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
        {presets.map((preset, idx) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              value === preset.value
                ? 'bg-slate-700/15 text-slate-800'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
            } ${idx !== 0 ? 'border-l border-[var(--color-border)]' : ''}`}
            title={`${preset.label} (${preset.value}px)`}
          >
            <SpacingIcon gap={preset.gap} active={value === preset.value} />
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Spacing Icon (horizontal lines with variable gap) ──────────────────────

function SpacingIcon({ gap, active }: { gap: number; active: boolean }) {
  const color = active ? '#334155' : 'currentColor';
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <rect x={1} y={6 - gap / 2 - 1.5} width={10} height={1.5} rx={0.5} fill={color} />
      <rect x={1} y={6 + gap / 2} width={10} height={1.5} rx={0.5} fill={color} />
    </svg>
  );
}
