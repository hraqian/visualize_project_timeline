import {
  differenceInDays,
  addDays,
  parseISO,
  startOfMonth,
  startOfYear,
  startOfWeek,
  endOfMonth,
  endOfYear,
  format,
  getWeek,
  eachMonthOfInterval,
  eachYearOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import type {
  ProjectItem,
  Dependency,
  TimescaleTier,
  TimescaleConfig,
  TierFormat,
} from '@/types';

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function dateToDayOffset(date: string, origin: string): number {
  return differenceInDays(parseISO(date), parseISO(origin));
}

export function dayOffsetToDate(offset: number, origin: string): string {
  return addDays(parseISO(origin), offset).toISOString().split('T')[0];
}

export function getProjectRange(items: ProjectItem[]): { start: string; end: string } {
  const visible = items.filter((i) => i.visible);
  if (visible.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  }
  const starts = visible.map((i) => i.startDate).sort();
  const ends = visible.map((i) => i.endDate).sort();
  return { start: starts[0], end: ends[ends.length - 1] };
}

export function getDuration(item: ProjectItem): number {
  return Math.max(1, differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) + 1);
}

// ─── Timescale Generators ────────────────────────────────────────────────────

export interface TimescaleLabel {
  label: string;
  startDate: Date;
  endDate: Date;
  isToday?: boolean;
}

// Map a date to a label string based on unit + format
function formatTierLabel(date: Date, unit: TimescaleTier, fmt: TierFormat, fiscalYearStartMonth: number): string {
  switch (unit) {
    case 'auto':
      return format(date, 'MMM'); // fallback; should be resolved before calling
    case 'year': {
      if (fiscalYearStartMonth !== 1) {
        const fyStart = new Date(date.getFullYear(), fiscalYearStartMonth - 1, 1);
        const base = `FY${fyStart.getFullYear()}`;
        return fmt === 'yy' ? `FY${String(fyStart.getFullYear()).slice(-2)}` : base;
      }
      return fmt === 'yy' ? format(date, 'yy') : format(date, 'yyyy');
    }
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      if (fmt === 'Qq') return `Q${q}`;
      return `Q${q} ${format(date, 'yyyy')}`;
    }
    case 'month': {
      switch (fmt) {
        case 'MMMM': return format(date, 'MMMM');     // July
        case 'M_letter': return format(date, 'MMMMM'); // J (first letter)
        case 'MM': return format(date, 'MM');           // 07
        case 'M_num': return String(date.getMonth() + 1); // 7
        default: return format(date, 'MMM');            // Jul
      }
    }
    case 'week': {
      const w = getWeek(date, { weekStartsOn: 1 });
      if (fmt === 'Ww') return `Week ${w}`;
      return String(w);                                 // 1
    }
    case 'day': {
      switch (fmt) {
        case 'EEE': return format(date, 'EEE');         // Mon
        case 'EEEE': return format(date, 'EEEE');       // Monday
        case 'dd': return format(date, 'dd');            // 01
        case 'MM/dd': return format(date, 'MM/dd');      // 03/20
        default: return String(date.getDate());          // 1
      }
    }
  }
}

export function generateTierLabels(
  tier: TimescaleTier,
  rangeStart: Date,
  rangeEnd: Date,
  fiscalYearStartMonth: number,
  fmt?: TierFormat
): TimescaleLabel[] {
  // Default format per unit when not specified
  const effectiveFmt: TierFormat = fmt ?? ({
    auto: 'MMM',
    year: 'yyyy',
    quarter: 'Qq yyyy',
    month: 'MMM',
    week: 'w_num',
    day: 'd_num',
  } as Record<TimescaleTier, TierFormat>)[tier];

  switch (tier) {
    case 'auto':
      // Should be resolved before calling; fall back to month
      return generateTierLabels('month', rangeStart, rangeEnd, fiscalYearStartMonth, fmt);
    case 'year': {
      const years = eachYearOfInterval({ start: startOfYear(rangeStart), end: rangeEnd });
      return years.map((y) => {
        const end = endOfYear(y);
        if (fiscalYearStartMonth !== 1) {
          const fyStart = new Date(y.getFullYear(), fiscalYearStartMonth - 1, 1);
          const fyEnd = new Date(fyStart.getFullYear() + 1, fiscalYearStartMonth - 1, 0);
          return { label: formatTierLabel(y, tier, effectiveFmt, fiscalYearStartMonth), startDate: fyStart, endDate: fyEnd };
        }
        return { label: formatTierLabel(y, tier, effectiveFmt, fiscalYearStartMonth), startDate: y, endDate: end };
      });
    }
    case 'quarter': {
      const months = eachMonthOfInterval({ start: startOfMonth(rangeStart), end: rangeEnd });
      const quarters: TimescaleLabel[] = [];
      let currentQ = -1;
      for (const m of months) {
        const q = Math.floor(m.getMonth() / 3);
        if (q !== currentQ || quarters.length === 0) {
          currentQ = q;
          const qStart = new Date(m.getFullYear(), q * 3, 1);
          const qEnd = endOfMonth(new Date(m.getFullYear(), q * 3 + 2, 1));
          quarters.push({ label: formatTierLabel(qStart, tier, effectiveFmt, fiscalYearStartMonth), startDate: qStart, endDate: qEnd });
        }
      }
      return quarters;
    }
    case 'month': {
      const months = eachMonthOfInterval({ start: startOfMonth(rangeStart), end: rangeEnd });
      return months.map((m) => ({
        label: formatTierLabel(m, tier, effectiveFmt, fiscalYearStartMonth),
        startDate: m,
        endDate: endOfMonth(m),
      }));
    }
    case 'week': {
      const weeks = eachWeekOfInterval({ start: startOfWeek(rangeStart), end: rangeEnd }, { weekStartsOn: 1 });
      return weeks.map((w) => ({
        label: formatTierLabel(w, tier, effectiveFmt, fiscalYearStartMonth),
        startDate: w,
        endDate: addDays(w, 6),
      }));
    }
    case 'day': {
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      return days.map((d) => ({
        label: formatTierLabel(d, tier, effectiveFmt, fiscalYearStartMonth),
        startDate: d,
        endDate: d,
        isToday: isToday(d),
      }));
    }
  }
}

// ─── Visible Tier Cells ──────────────────────────────────────────────────────

export interface TierCell {
  label: string;
  fraction: number;   // 0-1 position within bar
  widthFrac: number;  // 0-1 width within bar
}

/**
 * Build visible tier cells from raw labels.
 * Shared by both the main TimelineView and the Tier Settings Modal preview.
 * Works in fractional (0-1) coordinates; callers convert to px or % as needed.
 */
export function buildVisibleTierCells(
  labels: TimescaleLabel[],
  unit: TimescaleTier,
  originDate: Date,
  totalDays: number,
  barWidthPx: number,
): TierCell[] {
  const minLabelWidth: Record<string, number> = { day: 60, week: 70, month: 50, quarter: 50, year: 50 };
  const minW = minLabelWidth[unit] ?? 40;

  // Calculate skip factor using a full interior cell (not the first, which may be partial)
  let skipFactor = 1;
  if (labels.length > 1) {
    const refIdx = Math.min(1, labels.length - 1);
    const refStartFrac = differenceInDays(labels[refIdx].startDate, originDate) / totalDays;
    const refEndFrac = (differenceInDays(labels[refIdx].endDate, originDate) + 1) / totalDays;
    const cellWidthPx = (refEndFrac - refStartFrac) * barWidthPx;
    if (cellWidthPx < minW) {
      skipFactor = Math.ceil(minW / cellWidthPx);
    }
  }

  // Build cells with skip-factor grouping — drop partial cells at the end
  const cells: TierCell[] = [];
  for (let i = 0; i < labels.length; i += skipFactor) {
    const startFrac = differenceInDays(labels[i].startDate, originDate) / totalDays;
    const endIdx = Math.min(i + skipFactor, labels.length) - 1;
    const endFrac = (differenceInDays(labels[endIdx].endDate, originDate) + 1) / totalDays;
    if (endFrac <= 0) continue; // entirely before the visible range
    if (startFrac >= 1) break;  // past the visible range
    if (endFrac > 1) break;     // partial period at the end — don't show
    cells.push({
      label: labels[i].label,
      fraction: Math.max(startFrac, 0),
      widthFrac: Math.max(endFrac - Math.max(startFrac, 0), 0.001),
    });
  }

  // Prefix first visible label for sequential units
  if (cells.length > 0 && (unit === 'week' || unit === 'day')) {
    const prefix = unit === 'week' ? 'Week ' : 'Day ';
    cells[0].label = prefix + cells[0].label;
  }

  return cells;
}

// ─── Critical Path ───────────────────────────────────────────────────────────

export function computeCriticalPath(
  items: ProjectItem[],
  dependencies: Dependency[]
): Set<string> {
  // Build adjacency list
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const item of items) {
    adj.set(item.id, []);
    inDeg.set(item.id, 0);
  }
  for (const dep of dependencies) {
    adj.get(dep.fromId)?.push(dep.toId);
    inDeg.set(dep.toId, (inDeg.get(dep.toId) || 0) + 1);
  }

  // Forward pass: compute earliest start
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const projectStart = items.length > 0
    ? Math.min(...items.map((i) => parseISO(i.startDate).getTime()))
    : Date.now();

  // Topological sort
  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    topoOrder.push(curr);
    for (const next of adj.get(curr) || []) {
      inDeg.set(next, (inDeg.get(next) || 0) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  for (const id of topoOrder) {
    const item = itemMap.get(id)!;
    const deps = dependencies.filter((d) => d.toId === id);
    const earliest = deps.length > 0
      ? Math.max(...deps.map((d) => ef.get(d.fromId) || 0))
      : differenceInDays(parseISO(item.startDate), new Date(projectStart));
    es.set(id, earliest);
    ef.set(id, earliest + getDuration(item));
  }

  // Backward pass: compute latest start
  const projectEnd = Math.max(...[...ef.values()]);
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  for (const id of [...topoOrder].reverse()) {
    const item = itemMap.get(id)!;
    const successors = dependencies.filter((d) => d.fromId === id);
    const latest = successors.length > 0
      ? Math.min(...successors.map((d) => ls.get(d.toId) || projectEnd))
      : projectEnd;
    lf.set(id, latest);
    ls.set(id, latest - getDuration(item));
  }

  // Items on critical path: total float = 0
  const criticalSet = new Set<string>();
  for (const id of topoOrder) {
    const totalFloat = (ls.get(id) || 0) - (es.get(id) || 0);
    if (totalFloat === 0) criticalSet.add(id);
  }

  return criticalSet;
}

// ─── Dependency Auto-shift ───────────────────────────────────────────────────

export function shiftDependents(
  movedItemId: string,
  daysDelta: number,
  items: ProjectItem[],
  dependencies: Dependency[]
): ProjectItem[] {
  const updated = items.map((i) => ({ ...i }));
  const itemMap = new Map(updated.map((i) => [i.id, i]));

  const visited = new Set<string>();
  const queue = [movedItemId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const successors = dependencies.filter((d) => d.fromId === currId);
    for (const dep of successors) {
      const successor = itemMap.get(dep.toId);
      if (successor) {
        successor.startDate = addDays(parseISO(successor.startDate), daysDelta).toISOString().split('T')[0];
        successor.endDate = addDays(parseISO(successor.endDate), daysDelta).toISOString().split('T')[0];
        queue.push(successor.id);
      }
    }
  }

  return updated;
}

// ─── Auto Unit Resolution ────────────────────────────────────────────────────

/** Resolve 'auto' to a concrete unit based on project duration in days. */
export function resolveAutoUnit(totalDays: number): Exclude<TimescaleTier, 'auto'> {
  if (totalDays < 30) return 'day';          // < 1 month
  if (totalDays < 180) return 'week';         // 1–6 months
  if (totalDays < 730) return 'month';        // 6 months–2 years
  if (totalDays < 1825) return 'quarter';     // 2–5 years
  return 'year';                              // 5+ years
}

// ─── Timescale Defaults ──────────────────────────────────────────────────────

export function getDefaultFormatForUnit(unit: TimescaleTier): TierFormat {
  const map: Record<TimescaleTier, TierFormat> = {
    auto: 'MMM',  // fallback; callers should resolve auto first
    year: 'yyyy',
    quarter: 'Qq yyyy',
    month: 'MMM',
    week: 'w_num',
    day: 'd_num',
  };
  return map[unit];
}

export function getFormatOptionsForUnit(unit: TimescaleTier): { value: TierFormat; label: string }[] {
  switch (unit) {
    case 'auto':
      // Show month formats as default for auto; callers can re-resolve
      return [
        { value: 'MMM', label: 'Auto' },
      ];
    case 'year':
      return [
        { value: 'yyyy', label: '2020, 2021' },
        { value: 'yy', label: '20, 21' },
      ];
    case 'quarter':
      return [
        { value: 'Qq yyyy', label: 'Q1 2020' },
        { value: 'Qq', label: 'Q1' },
      ];
    case 'month':
      return [
        { value: 'MMM', label: 'Jul, Aug, Sep' },
        { value: 'MMMM', label: 'July, August' },
        { value: 'M_letter', label: 'J, A, S' },
        { value: 'MM', label: '07, 08, 09' },
        { value: 'M_num', label: '1, 2, 3' },
      ];
    case 'week':
      return [
        { value: 'w_num', label: '1, 2, 3' },
        { value: 'Ww', label: 'Week 1, Week 2' },
      ];
    case 'day':
      return [
        { value: 'd_num', label: '1, 2, 3' },
        { value: 'EEE', label: 'Mon, Tue' },
        { value: 'EEEE', label: 'Monday, Tuesday' },
        { value: 'dd', label: '01, 02, 03' },
        { value: 'MM/dd', label: '03/20' },
      ];
  }
}

export function getDefaultTimescale(): TimescaleConfig {
  return {
    tiers: [
      { unit: 'year', format: 'yyyy', visible: true, backgroundColor: '#1e293b', fontColor: '#f8fafc', fontSize: 13, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
      { unit: 'month', format: 'MMM', visible: true, backgroundColor: '#334155', fontColor: '#e2e8f0', fontSize: 12, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
    ],
    fiscalYearStartMonth: 1,
    showToday: true,
    todayColor: '#ef4444',
  };
}
