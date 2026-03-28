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
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
        {presets.map((preset, idx) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              value === preset.value
                ? 'text-slate-800'
                : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc] hover:text-[var(--color-text)]'
            } ${idx !== 0 ? 'border-l' : ''}`}
            style={{
              borderColor: idx !== 0 ? '#d7e0ea' : undefined,
              background: value === preset.value ? 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' : 'transparent',
            }}
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
