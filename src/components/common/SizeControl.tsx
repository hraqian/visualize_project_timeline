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
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset?.label === preset.label
                ? 'text-slate-800'
                : 'text-[var(--color-text-secondary)] hover:bg-[#f7fafc] hover:text-[var(--color-text)]'
            } ${preset !== presets[0] ? 'border-l' : ''}`}
            style={{
              borderColor: preset !== presets[0] ? '#d7e0ea' : undefined,
              background: activePreset?.label === preset.label ? 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' : 'transparent',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Numeric stepper */}
      <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
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
        <div className="flex flex-col border-l" style={{ borderColor: '#d7e0ea' }}>
          <button
            onClick={() => onChange(Math.min(max, value + step))}
            className="px-1 py-0 hover:bg-[#f7fafc] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ChevronUp size={10} />
          </button>
          <button
            onClick={() => onChange(Math.max(min, value - step))}
            className="px-1 py-0 hover:bg-[#f7fafc] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors border-t"
            style={{ borderColor: '#d7e0ea' }}
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>

      <span className="text-[10px] text-[var(--color-text-muted)]">px</span>
    </div>
  );
}
