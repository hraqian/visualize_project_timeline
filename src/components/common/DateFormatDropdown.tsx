import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { DateFormat } from '@/types';

// Sample date used for preview: July 1, 2020 (Wednesday)
const SAMPLE_DATE = new Date(2020, 6, 1);

const DATE_FORMATS: DateFormat[] = [
  'MMM d',
  "MMM d ''yy",
  'MMM d, yyyy',
  'MMM yyyy',
  'MMMM d, yyyy',
  'MMMM dd, yyyy',
  'MM/dd/yyyy',
  'EEE M/d',
  "EEE M/d/yy",
  'EEE MMM d',
  "EEE MMM d, ''yy",
];

function formatPreview(fmt: DateFormat): string {
  return format(SAMPLE_DATE, fmt);
}

interface DateFormatDropdownProps {
  value: DateFormat;
  onChange: (fmt: DateFormat) => void;
}

export function DateFormatDropdown({ value, onChange }: DateFormatDropdownProps) {
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-[var(--color-text)] transition-all min-w-[124px]"
        style={{ borderColor: '#c8d3df', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <span className="flex-1 text-left truncate">{formatPreview(value)}</span>
        <ChevronDown size={13} className="text-[#607086] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[200px] max-h-[280px] overflow-y-auto rounded-xl py-1.5" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)', border: '1px solid #d9e3ef', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          {DATE_FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => {
                onChange(fmt);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[#f7fafc]"
              style={value === fmt ? { background: 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' } : undefined}
            >
              <span className="flex-1 text-left">{formatPreview(fmt)}</span>
              {value === fmt && (
                <Check size={14} className="text-[#4b83e6] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
