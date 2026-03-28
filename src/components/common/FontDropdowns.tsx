import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// ─── FontFamilyDropdown ──────────────────────────────────────────────────────

interface FontFamilyDropdownProps {
  value: string;
  onChange: (font: string) => void;
  fonts: readonly string[];
}

export function FontFamilyDropdown({ value, onChange, fonts }: FontFamilyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg border text-sm text-[var(--color-text)] transition-all"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <span className="flex-1 text-left truncate" style={{ fontFamily: value }}>{value}</span>
        <ChevronDown size={13} className="text-[#607086] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[200px] max-h-[240px] overflow-y-auto rounded-xl py-1.5" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          {fonts.map((font) => (
            <button
              key={font}
              onClick={() => {
                onChange(font);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[#f7fafc] transition-colors"
              style={value === font ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)', fontFamily: font } : { fontFamily: font }}
            >
              <span className="flex-1 text-left">{font}</span>
              {value === font && (
                <Check size={14} className="text-[#4b83e6] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FontSizeDropdown ────────────────────────────────────────────────────────

interface FontSizeDropdownProps {
  value: number;
  onChange: (size: number) => void;
  sizes?: number[];
}

const DEFAULT_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24];

export function FontSizeDropdown({ value, onChange, sizes = DEFAULT_FONT_SIZES }: FontSizeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-sm text-[var(--color-text)] transition-all min-w-[56px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <span className="flex-1 text-center">{value}</span>
        <ChevronDown size={12} className="text-[#607086] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[80px] max-h-[200px] overflow-y-auto rounded-xl py-1.5" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => {
                onChange(size);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[#f7fafc] transition-colors"
              style={value === size ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
            >
              <span className="flex-1 text-left">{size}</span>
              {value === size && (
                <Check size={13} className="text-[#4b83e6] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
