import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { BarShape } from '@/types';
import { PopoverSurface } from './PopoverPrimitives';
import { OptionGridPicker } from './OptionGridPicker';
import { BAR_SHAPE_OPTIONS } from './pickerOptions';
import { getShapeStyle } from './shapeStyle';

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
  onChange: (shape: BarShape) => void;
}

const ICON_COLOR = '#475569'; // slate-600 — neutral dark for shape icons

export function ShapeDropdown({ value, onChange }: ShapeDropdownProps) {
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
