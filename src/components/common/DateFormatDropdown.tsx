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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors min-w-[120px]"
      >
        <span className="flex-1 text-left truncate">{formatPreview(value)}</span>
        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[200px] max-h-[280px] overflow-y-auto bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1">
          {DATE_FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => {
                onChange(fmt);
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <span className="flex-1 text-left">{formatPreview(fmt)}</span>
              {value === fmt && (
                <Check size={14} className="text-[var(--color-text-muted)] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
