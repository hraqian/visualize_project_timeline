import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { BarShape } from '@/types';
import { PopoverSurface } from './PopoverPrimitives';
import { OptionGridPicker } from './OptionGridPicker';
import { BAR_SHAPE_OPTIONS } from './pickerOptions';

// ─── Shape preview rendering ─────────────────────────────────────────────────

export function getShapeStyle(shape: BarShape, width: number, height: number): React.CSSProperties {
  const insetPx = height * 0.4;
  const insetPct = (insetPx / width) * 100;
  const smallInset = insetPct * 0.5;

  switch (shape) {
    case 'square':
      return { borderRadius: 3 };
    case 'rounded':
      return { borderRadius: height * 0.3 };
    case 'capsule':
      return { borderRadius: height };
    case 'flat':
      return { borderRadius: 0 };
    case 'chevron':
      // Pentagon: flat left, pointed right
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)` };
    case 'double-chevron':
      // Chevron: shallow V-notch left folding right, pointed right
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%, ${smallInset}% 50%)` };
    case 'arrow-right':
      // Right arrow: flat left, narrow pointed right
      return { clipPath: `polygon(0% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, 0% 85%)` };
    case 'pointed':
      // Double arrow: banner arrow on both sides (mirror of arrow-right)
      return { clipPath: `polygon(${insetPct}% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, ${insetPct}% 85%, ${insetPct}% 100%, 0% 50%, ${insetPct}% 0%)` };
    case 'arrow-both':
      // Modern: parallelogram slanting right, all corners rounded
      //   TL=(s,0)  TR=(w,0)  BR=(w-s,h)  BL=(0,h)
      //   Angle between left/bottom and right/top edges ≈ 75°
      { const s = height / Math.tan((75 * Math.PI) / 180); // ~h * 0.268
        const r = Math.min(height * 0.3, s * 0.8);        // acute corners (TL, BR)
        const rBig = r * 2.5;                              // obtuse corners (TR, BL) — rounder
        const w = width, h = height;
        const len = Math.sqrt(s * s + h * h);
        const dx = (s / len) * r, dy = (h / len) * r;
        const dxB = (s / len) * rBig, dyB = (h / len) * rBig;
        return { clipPath: `path('`
          + `M ${s + r} 0 `                                    // start after TL round
          + `L ${w - rBig} 0 `                                 // top edge to before TR
          + `Q ${w} 0 ${w - dxB} ${dyB} `                     // TR corner (rounder)
          + `L ${w - s + dx} ${h - dy} `                        // right edge to before BR
          + `Q ${w - s} ${h} ${w - s - r} ${h} `               // BR corner
          + `L ${rBig} ${h} `                                   // bottom edge to before BL
          + `Q 0 ${h} ${dxB} ${h - dyB} `                      // BL corner (rounder)
          + `L ${s - dx} ${dy} `                                // left edge to before TL
          + `Q ${s} 0 ${s + r} 0 `                              // TL corner
          + `Z')` };
      }
    case 'notched':
      // Leaf: same parallelogram as Modern, but TR and BL corners much less rounded (nearly sharp)
      // giving a "pulled" leaf-like appearance at those corners
      { const s2 = height / Math.tan((75 * Math.PI) / 180);
        const r2 = Math.min(height * 0.3, s2 * 0.8);         // TL, BR corners (full round)
        const rSmall = r2 * 0.25;                              // TR, BL corners (nearly sharp)
        const w2 = width, h2 = height;
        const len2 = Math.sqrt(s2 * s2 + h2 * h2);
        const dx2 = (s2 / len2) * r2, dy2 = (h2 / len2) * r2;
        const dxS = (s2 / len2) * rSmall, dyS = (h2 / len2) * rSmall;
        return { clipPath: `path('`
          + `M ${s2 + r2} 0 `                                   // start after TL round
          + `L ${w2 - rSmall} 0 `                               // top edge to before TR
          + `Q ${w2} 0 ${w2 - dxS} ${dyS} `                    // TR corner (small round)
          + `L ${w2 - s2 + dx2} ${h2 - dy2} `                   // right edge to before BR
          + `Q ${w2 - s2} ${h2} ${w2 - s2 - r2} ${h2} `        // BR corner (full round)
          + `L ${rSmall} ${h2} `                                 // bottom edge to before BL
          + `Q 0 ${h2} ${dxS} ${h2 - dyS} `                    // BL corner (small round)
          + `L ${s2 - dx2} ${dy2} `                              // left edge to before TL
          + `Q ${s2} 0 ${s2 + r2} 0 `                           // TL corner (full round)
          + `Z')` };
      }
    case 'tab':
      return { clipPath: `polygon(0% 0%, 100% 0%, ${100 - insetPct}% 100%, ${insetPct}% 100%)` };
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
        className="flex items-center gap-2 px-3 rounded-lg border transition-all text-[var(--color-text)] w-full"
        style={{
          height: 32,
          fontSize: 13,
          borderColor: '#c8d3df',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <ShapePreview shape={value} color={ICON_COLOR} width={14} height={8} />
        <span className="flex-1 text-left font-medium">{currentLabel}</span>
        <ChevronDown size={11} className="text-[#607086] shrink-0" />
      </button>

      {/* Dropdown — portal to body so it escapes overflow clipping */}
      {isOpen && createPortal(
        <PopoverSurface
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            padding: 10,
          }}
        >
          <OptionGridPicker
            options={BAR_SHAPE_OPTIONS}
            value={value}
            onSelect={(next) => {
              onChange(next);
              setIsOpen(false);
            }}
            columns={6}
            renderOption={(shape, selected) => (
              <ShapePreview shape={shape.id} color={selected ? '#1e293b' : ICON_COLOR} width={19} height={10} />
            )}
          />
        </PopoverSurface>,
        document.body,
      )}
    </div>
  );
}
