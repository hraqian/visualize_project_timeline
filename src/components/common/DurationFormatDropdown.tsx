import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { DurationFormat } from '@/types';

interface DurationCategory {
  label: string;
  formats: DurationFormat[];
}

const DURATION_CATEGORIES: DurationCategory[] = [
  { label: 'Days', formats: ['d', 'days'] },
  { label: 'Weeks', formats: ['w', 'wks', 'weeks'] },
  { label: 'Months', formats: ['mons', 'months'] },
  { label: 'Quarters', formats: ['q', 'qrts', 'quarters'] },
  { label: 'Years', formats: ['y', 'yrs', 'years'] },
];

interface DurationFormatDropdownProps {
  value: DurationFormat;
  onChange: (fmt: DurationFormat) => void;
}

export function DurationFormatDropdown({ value, onChange }: DurationFormatDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoveredCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors min-w-[120px]"
      >
        <span className="flex-1 text-left truncate">{value}</span>
        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[180px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1">
          {DURATION_CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              className="relative"
              onMouseEnter={() => setHoveredCategory(cat.label)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <button
                className={`flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] transition-colors ${
                  hoveredCategory === cat.label ? 'bg-[var(--color-surface-hover)]' : ''
                }`}
              >
                <span className="flex-1 text-left">{cat.label}</span>
                <ChevronRight size={13} className="text-[var(--color-text-muted)] shrink-0" />
              </button>

              {/* Submenu */}
              {hoveredCategory === cat.label && (
                <div className="absolute left-full top-0 ml-0 z-50 w-[140px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1">
                  {cat.formats.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        onChange(fmt);
                        setIsOpen(false);
                        setHoveredCategory(null);
                      }}
                      className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <span className="flex-1 text-left">{fmt}</span>
                      {value === fmt && (
                        <Check size={14} className="text-[var(--color-text-muted)] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
