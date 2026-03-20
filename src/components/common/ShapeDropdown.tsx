import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BarShape } from '@/types';

// ─── Shape data ──────────────────────────────────────────────────────────────

export const BAR_SHAPE_OPTIONS: { id: BarShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'double-chevron', label: 'Dbl Chevron' },
  { id: 'arrow-right', label: 'Arrow R' },
  { id: 'pointed', label: 'Pointed' },
  { id: 'notched', label: 'Notched' },
  { id: 'tab', label: 'Tab' },
  { id: 'arrow-both', label: 'Arrow Both' },
  { id: 'trapezoid', label: 'Trapezoid' },
  { id: 'flat', label: 'Flat' },
];

// ─── Shape preview rendering ─────────────────────────────────────────────────

function getShapeStyle(shape: BarShape, width: number, height: number): React.CSSProperties {
  const insetPx = height * 0.4;
  const insetPct = (insetPx / width) * 100;

  switch (shape) {
    case 'rounded':
      return { borderRadius: height / 2 };
    case 'square':
      return { borderRadius: 3 };
    case 'capsule':
      return { borderRadius: height };
    case 'flat':
      return { borderRadius: 0 };
    case 'chevron':
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)` };
    case 'double-chevron':
      return { clipPath: `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)` };
    case 'arrow-right':
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)` };
    case 'pointed':
      return { clipPath: `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)` };
    case 'notched':
      return { clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${insetPct}% 50%)` };
    case 'tab':
      return { clipPath: `polygon(0% 0%, 100% 0%, ${100 - insetPct}% 100%, ${insetPct}% 100%)` };
    case 'arrow-both':
      return { clipPath: `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)` };
    case 'trapezoid':
      return { clipPath: `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 100%, 0% 100%)` };
    default:
      return {};
  }
}

export function ShapePreview({
  shape,
  color,
  width = 40,
  height = 14,
}: {
  shape: BarShape;
  color: string;
  width?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: color,
        ...getShapeStyle(shape, width, height),
      }}
    />
  );
}

// ─── ShapeDropdown ───────────────────────────────────────────────────────────

interface ShapeDropdownProps {
  value: BarShape;
  color: string;
  onChange: (shape: BarShape) => void;
}

const ICON_COLOR = '#475569'; // slate-600 — neutral dark for shape icons

export function ShapeDropdown({ value, color, onChange }: ShapeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const currentLabel = BAR_SHAPE_OPTIONS.find((s) => s.id === value)?.label ?? value;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger — small icon + name + chevron */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-border-light)] transition-colors text-sm text-[var(--color-text)] w-full"
      >
        <ShapePreview shape={value} color={ICON_COLOR} width={18} height={10} />
        <span className="flex-1 text-left">{currentLabel}</span>
        <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {/* Dropdown — flat grid of shape icons, no labels */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[252px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-3">
          <div className="grid grid-cols-6 gap-2">
            {BAR_SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.id}
                onClick={() => {
                  onChange(shape.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-center h-8 rounded transition-colors ${
                  value === shape.id
                    ? 'bg-slate-200'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
                title={shape.label}
              >
                <ShapePreview shape={shape.id} color={ICON_COLOR} width={24} height={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
