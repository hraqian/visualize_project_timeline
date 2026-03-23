import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { BarShape } from '@/types';

// ─── Shape data ──────────────────────────────────────────────────────────────

export const BAR_SHAPE_OPTIONS: { id: BarShape; label: string }[] = [
  { id: 'square', label: 'Rectangle' },
  { id: 'rounded', label: 'Round rectangle' },
  { id: 'capsule', label: 'Ellipse' },
  { id: 'chevron', label: 'Pentagon' },
  { id: 'double-chevron', label: 'Chevron' },
  { id: 'arrow-right', label: 'Right arrow' },
  { id: 'pointed', label: 'Double arrow' },
  { id: 'arrow-both', label: 'Modern' },
  { id: 'notched', label: 'Leaf' },
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) updatePos();
    setIsOpen(!isOpen);
  };

  const currentLabel = BAR_SHAPE_OPTIONS.find((s) => s.id === value)?.label ?? value;

  return (
    <div className="relative">
      {/* Trigger — small icon + name + chevron */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)] transition-colors text-[var(--color-text)] w-full"
        style={{ height: 28, fontSize: 14 }}
      >
        <ShapePreview shape={value} color={ICON_COLOR} width={14} height={8} />
        <span className="flex-1 text-left font-medium">{currentLabel}</span>
        <ChevronDown size={10} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {/* Dropdown — portal to body so it escapes overflow clipping */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: 8,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {BAR_SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.id}
                onClick={() => {
                  onChange(shape.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 29,
                  height: 29,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: value === shape.id ? '#e2e8f0' : 'transparent',
                }}
                title={shape.label}
                onMouseEnter={(e) => { if (value !== shape.id) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { if (value !== shape.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <ShapePreview shape={shape.id} color={value === shape.id ? '#1e293b' : ICON_COLOR} width={19} height={10} />
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
