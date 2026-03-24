import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getDay,
  getWeek,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DatePickerPopoverProps {
  /** 'range' for tasks, 'single' for milestones */
  mode: 'range' | 'single';
  startDate: string; // ISO string
  endDate: string;   // ISO string (same as startDate for milestones)
  anchorRect: DOMRect;
  onCommit: (startDate: string, endDate: string) => void;
  onCancel: () => void;
  onOpenSettings?: () => void;
}

type ActiveField = 'start' | 'end';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6;
}

/** Build the 6-row grid for a month. Each row = [weekNum, sun, mon, ..., sat]. Null for empty cells. */
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = endOfMonth(first);
  const startDow = getDay(first); // 0=Sun

  const rows: (Date | null)[][] = [];
  let currentDay = 1;
  const totalDays = last.getDate();

  // Fill up to 6 rows
  for (let row = 0; row < 6; row++) {
    const week: (Date | null)[] = [];
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < startDow) {
        week.push(null);
      } else if (currentDay > totalDays) {
        week.push(null);
      } else {
        week.push(new Date(year, month, currentDay));
        currentDay++;
      }
    }
    // Only add the row if it has at least one non-null day
    if (week.some((d) => d !== null)) {
      rows.push(week);
    }
  }
  return rows;
}

function getWeekNumber(row: (Date | null)[]): number {
  const firstDay = row.find((d) => d !== null);
  if (!firstDay) return 0;
  return getWeek(firstDay, { weekStartsOn: 0 });
}

// Year range for dropdown
const YEAR_MIN = 2000;
const YEAR_MAX = 2099;

// ─── Hatching SVG pattern (inline data URI) ──────────────────────────────────

const HATCH_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg width="6" height="6" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="6" x2="6" y2="0" stroke="%23cbd5e1" stroke-width="0.8"/></svg>`
)}`;

// ─── Component ───────────────────────────────────────────────────────────────

export function DatePickerPopover({
  mode,
  startDate: initialStart,
  endDate: initialEnd,
  anchorRect,
  onCommit,
  onCancel,
  onOpenSettings,
}: DatePickerPopoverProps) {
  const [draftStart, setDraftStart] = useState(() => parseISO(initialStart));
  const [draftEnd, setDraftEnd] = useState(() => parseISO(initialEnd));
  const [activeField, setActiveField] = useState<ActiveField>('start');
  const [clickCount, setClickCount] = useState(0); // tracks calendar clicks for range mode
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(parseISO(initialStart)));

  const popoverRef = useRef<HTMLDivElement>(null);

  // The right month is always leftMonth + 1
  const rightMonth = addMonths(leftMonth, 1);

  // ─── Navigation ──────────────────────────────────────────────────────

  const goToPrev = useCallback(() => setLeftMonth((m) => subMonths(m, 1)), []);
  const goToNext = useCallback(() => setLeftMonth((m) => addMonths(m, 1)), []);

  const goToToday = useCallback(() => {
    setLeftMonth(startOfMonth(new Date()));
  }, []);

  // ─── Month/Year dropdown handlers ────────────────────────────────────

  const setLeftMonthByMonthYear = useCallback((month: number, year: number) => {
    setLeftMonth(new Date(year, month, 1));
  }, []);

  const setRightMonthByMonthYear = useCallback((month: number, year: number) => {
    // Right panel controls: set leftMonth so that rightMonth = the selected month
    setLeftMonth(new Date(year, month - 1, 1));
  }, []);

  // ─── Day click ───────────────────────────────────────────────────────

  const handleDayClick = useCallback((date: Date) => {
    if (mode === 'single') {
      setDraftStart(date);
      setDraftEnd(date);
      return;
    }

    // Range mode
    if (activeField === 'start') {
      setDraftStart(date);
      // If the new start is after the current end, also move end
      if (isAfter(date, draftEnd)) {
        setDraftEnd(date);
      }
      setActiveField('end');
      setClickCount(1);
    } else {
      // activeField === 'end'
      if (clickCount === 0) {
        // First click ever — set start
        setDraftStart(date);
        setActiveField('end');
        setClickCount(1);
      } else {
        // Subsequent clicks — set end date
        if (isBefore(date, draftStart)) {
          // If clicked before start, swap: this becomes start, old start stays
          setDraftEnd(draftStart);
          setDraftStart(date);
        } else {
          setDraftEnd(date);
        }
      }
    }
  }, [mode, activeField, clickCount, draftStart, draftEnd]);

  // ─── Done / Cancel / Outside click ──────────────────────────────────

  const handleDone = useCallback(() => {
    const s = format(draftStart, 'yyyy-MM-dd');
    const e = mode === 'single' ? s : format(draftEnd, 'yyyy-MM-dd');
    onCommit(s, e);
  }, [draftStart, draftEnd, mode, onCommit]);

  // Click outside → commit
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleDone();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [handleDone]);

  // Escape → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  // ─── Positioning ─────────────────────────────────────────────────────

  const popoverWidth = 620;
  const popoverTop = anchorRect.bottom + 4;
  let popoverLeft = anchorRect.left;
  // Keep within viewport
  if (popoverLeft + popoverWidth > window.innerWidth - 8) {
    popoverLeft = window.innerWidth - popoverWidth - 8;
  }
  if (popoverLeft < 8) popoverLeft = 8;

  // ─── Render helpers ──────────────────────────────────────────────────

  const renderMonthPanel = (
    panelMonth: Date,
    onChangeMonth: (month: number) => void,
    onChangeYear: (year: number) => void,
  ) => {
    const year = panelMonth.getFullYear();
    const month = panelMonth.getMonth();
    const grid = buildMonthGrid(year, month);

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Month/Year header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {/* Month dropdown */}
          <select
            value={month}
            onChange={(e) => onChangeMonth(parseInt(e.target.value))}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              padding: '2px 0',
              appearance: 'auto' as never,
            }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          {/* Year dropdown */}
          <select
            value={year}
            onChange={(e) => onChangeYear(parseInt(e.target.value))}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              padding: '2px 0',
              appearance: 'auto' as never,
            }}
          >
            {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 0 }}>
          {/* Wk header */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'center', padding: '4px 0' }}>Wk</div>
          {DAY_HEADERS.map((d) => (
            <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textAlign: 'center', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Day grid rows */}
        {grid.map((row, ri) => {
          const wk = getWeekNumber(row);
          return (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 0 }}>
              {/* Week number */}
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{wk}</div>
              {row.map((date, ci) => {
                if (!date) {
                  return <div key={ci} />;
                }
                const isStart = isSameDay(date, draftStart);
                const isEnd = mode === 'range' && isSameDay(date, draftEnd);
                const inRange = mode === 'range' && !isSameDay(draftStart, draftEnd) &&
                  isWithinInterval(date, {
                    start: isBefore(draftStart, draftEnd) ? draftStart : draftEnd,
                    end: isAfter(draftStart, draftEnd) ? draftStart : draftEnd,
                  });
                const isToday = isSameDay(date, new Date());
                const weekend = isWeekend(date);

                // Background color
                let bg = 'transparent';
                if (isStart || isEnd) bg = '#3b82f6';
                else if (inRange) bg = '#dbeafe';

                // Text color
                let textColor = '#334155';
                if (isStart || isEnd) textColor = '#ffffff';

                // Hatching for weekends
                const hatchBg = weekend && !isStart && !isEnd
                  ? `url("${HATCH_SVG}")`
                  : undefined;

                return (
                  <div
                    key={ci}
                    onClick={(e) => { e.stopPropagation(); handleDayClick(date); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      aspectRatio: '1',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 400,
                      color: textColor,
                      backgroundColor: bg,
                      backgroundImage: hatchBg,
                      backgroundSize: hatchBg ? '6px 6px' : undefined,
                      borderRadius: (isStart || isEnd) ? 3 : inRange ? 0 : 3,
                      cursor: 'pointer',
                      position: 'relative',
                      boxSizing: 'border-box',
                      border: isToday && !isStart && !isEnd ? '1px solid #3b82f6' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isStart && !isEnd) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = inRange ? '#bfdbfe' : '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isStart && !isEnd) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = bg;
                      }
                    }}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────

  return createPortal(
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: popoverTop,
        left: popoverLeft,
        width: popoverWidth,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ── Header: date fields ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
        {/* Start date field */}
        <div
          onClick={() => setActiveField('start')}
          style={{
            padding: '4px 10px',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 4,
            cursor: 'pointer',
            border: activeField === 'start' ? '1.5px solid #3b82f6' : '1.5px solid transparent',
            backgroundColor: activeField === 'start' ? '#eff6ff' : 'transparent',
            color: '#334155',
          }}
        >
          {format(draftStart, 'MM/dd/yyyy')}
        </div>

        {mode === 'range' && (
          <>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>{'\u2192'}</span>
            {/* End date field */}
            <div
              onClick={() => setActiveField('end')}
              style={{
                padding: '4px 10px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 4,
                cursor: 'pointer',
                border: activeField === 'end' ? '1.5px solid #3b82f6' : '1.5px solid transparent',
                backgroundColor: activeField === 'end' ? '#eff6ff' : 'transparent',
                color: '#334155',
              }}
            >
              {format(draftEnd, 'MM/dd/yyyy')}
            </div>
          </>
        )}
      </div>

      {/* ── Calendar body ── */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 16 }}>
        {/* Left arrow */}
        <div
          onClick={goToPrev}
          style={{
            position: 'absolute',
            left: 12,
            top: 64,
            cursor: 'pointer',
            fontSize: 16,
            color: '#64748b',
            padding: '2px 4px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
        >
          {'<'}
        </div>

        {/* Left month */}
        {renderMonthPanel(
          leftMonth,
          (m) => setLeftMonthByMonthYear(m, leftMonth.getFullYear()),
          (y) => setLeftMonthByMonthYear(leftMonth.getMonth(), y),
        )}

        {/* Right month */}
        {renderMonthPanel(
          rightMonth,
          (m) => setRightMonthByMonthYear(m, rightMonth.getFullYear()),
          (y) => setRightMonthByMonthYear(rightMonth.getMonth(), y),
        )}

        {/* Right arrow */}
        <div
          onClick={goToNext}
          style={{
            position: 'absolute',
            right: 12,
            top: 64,
            cursor: 'pointer',
            fontSize: 16,
            color: '#64748b',
            padding: '2px 4px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
        >
          {'>'}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid #f1f5f9' }}>
        {/* Settings */}
        <div
          onClick={() => { if (onOpenSettings) { handleDone(); onOpenSettings(); } }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: onOpenSettings ? '#64748b' : '#cbd5e1',
            cursor: onOpenSettings ? 'pointer' : 'default',
            padding: '4px 8px',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { if (onOpenSettings) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, backgroundColor: '#e2e8f0', margin: '0 4px' }} />

        {/* Go today */}
        <div
          onClick={goToToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Go today
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Done button */}
        <button
          onClick={handleDone}
          style={{
            padding: '6px 24px',
            fontSize: 13,
            fontWeight: 500,
            color: '#334155',
            backgroundColor: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e2e8f0'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f1f5f9'; }}
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
