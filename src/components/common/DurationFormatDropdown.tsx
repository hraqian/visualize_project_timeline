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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-[var(--color-text)] transition-all min-w-[124px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <span className="flex-1 text-left truncate">{value}</span>
        <ChevronDown size={13} className="text-[#607086] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[180px] rounded-xl py-1.5" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          {DURATION_CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              className="relative"
              onMouseEnter={() => setHoveredCategory(cat.label)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <button
                className={`flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] transition-colors ${
                  hoveredCategory === cat.label ? 'bg-[#f7fafc]' : ''
                }`}
              >
                <span className="flex-1 text-left">{cat.label}</span>
                <ChevronRight size={13} className="text-[#607086] shrink-0" />
              </button>

              {/* Submenu */}
              {hoveredCategory === cat.label && (
                <div className="absolute left-full top-0 ml-1 z-50 w-[140px] rounded-xl py-1.5" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}>
                  {cat.formats.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        onChange(fmt);
                        setIsOpen(false);
                        setHoveredCategory(null);
                      }}
                      className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[#f7fafc] transition-colors"
                      style={value === fmt ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
                    >
                      <span className="flex-1 text-left">{fmt}</span>
                      {value === fmt && (
                        <Check size={14} className="text-[#4b83e6] shrink-0" />
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
