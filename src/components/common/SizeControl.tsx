import { ChevronUp, ChevronDown } from 'lucide-react';

// ─── SizeControl ─────────────────────────────────────────────────────────────

interface SizeControlProps {
  value: number;
  onChange: (value: number) => void;
  presets?: { label: string; value: number }[];
  min?: number;
  max?: number;
  step?: number;
}

const DEFAULT_SIZE_PRESETS = [
  { label: 'S', value: 16 },
  { label: 'M', value: 24 },
  { label: 'L', value: 32 },
];

export function SizeControl({
  value,
  onChange,
  presets = DEFAULT_SIZE_PRESETS,
  min = 8,
  max = 64,
  step = 1,
}: SizeControlProps) {
  const activePreset = presets.find((p) => p.value === value);

  return (
    <div className="flex items-center gap-2">
      {/* Preset buttons */}
      <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset?.label === preset.label
                ? 'bg-slate-700/15 text-slate-800'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
            } ${preset !== presets[0] ? 'border-l border-[var(--color-border)]' : ''}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Numeric stepper */}
      <div className="flex items-center border border-[var(--color-border)] rounded-md overflow-hidden bg-[var(--color-bg-secondary)]">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-10 px-1.5 py-1 text-xs text-center text-[var(--color-text)] bg-transparent outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="flex flex-col border-l border-[var(--color-border)]">
          <button
            onClick={() => onChange(Math.min(max, value + step))}
            className="px-1 py-0 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ChevronUp size={10} />
          </button>
          <button
            onClick={() => onChange(Math.max(min, value - step))}
            className="px-1 py-0 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors border-t border-[var(--color-border)]"
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>

      <span className="text-[10px] text-[var(--color-text-muted)]">px</span>
    </div>
  );
}
