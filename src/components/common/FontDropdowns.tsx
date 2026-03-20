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
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
      >
        <span className="flex-1 text-left truncate" style={{ fontFamily: value }}>{value}</span>
        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[200px] max-h-[240px] overflow-y-auto bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1">
          {fonts.map((font) => (
            <button
              key={font}
              onClick={() => {
                onChange(font);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
              style={{ fontFamily: font }}
            >
              <span className="flex-1 text-left">{font}</span>
              {value === font && (
                <Check size={14} className="text-[var(--color-text-muted)] shrink-0" />
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
        className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors min-w-[52px]"
      >
        <span className="flex-1 text-center">{value}</span>
        <ChevronDown size={12} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[80px] max-h-[200px] overflow-y-auto bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1">
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => {
                onChange(size);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <span className="flex-1 text-left">{size}</span>
              {value === size && (
                <Check size={13} className="text-[var(--color-text-muted)] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
