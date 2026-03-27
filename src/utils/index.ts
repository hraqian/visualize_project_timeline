import {
  differenceInDays,
  differenceInCalendarMonths,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  parseISO,
  startOfMonth,
  startOfYear,
  startOfWeek,
  startOfQuarter,
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
  DependencyType,
  LagUnit,
  TimescaleTier,
  TimescaleConfig,
  TierFormat,
  DependencyConflictMode,
  SchedulingConflict,
  DependencyLagAdjustment,
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

/**
 * Compute padded project range with origin and end aligned to full unit
 * boundaries across all visible timescale tiers, so no tier shows partial cells.
 */
export function getProjectRangePadded(
  items: ProjectItem[],
  timescale: TimescaleConfig,
): { origin: string; totalDays: number; rangeEndDate: Date } {
  const range = getProjectRange(items);
  let padStart = startOfMonth(subDays(parseISO(range.start), 14));

  // First pass: compute rough padEnd to get totalDays for resolveAutoUnit
  const roughEndMonth = startOfMonth(parseISO(range.end));
  const roughNumMonths = differenceInCalendarMonths(roughEndMonth, padStart) + 1;
  const roughPadEnd = addMonths(padStart, roughNumMonths);
  const roughTotalDays = differenceInDays(roughPadEnd, padStart);

  // Resolve visible tier units using the padded span (same as TimelineView)
  const visibleUnits = timescale.tiers
    .filter((t) => t.visible)
    .map((t) => t.unit === 'auto' ? resolveAutoUnit(roughTotalDays) : t.unit);

  // Align padStart backwards to the earliest unit boundary
  for (const unit of visibleUnits) {
    let aligned: Date;
    switch (unit) {
      case 'week':
        aligned = startOfWeek(padStart, { weekStartsOn: 1 });
        break;
      case 'quarter':
        aligned = startOfQuarter(padStart);
        break;
      case 'year':
        aligned = startOfYear(padStart);
        break;
      default:
        aligned = padStart;
    }
    if (aligned < padStart) padStart = aligned;
  }

  // Compute padEnd from the aligned padStart
  const endMonth = startOfMonth(parseISO(range.end));
  const numMonths = differenceInCalendarMonths(endMonth, padStart) + 1;
  let padEnd = addMonths(padStart, numMonths);

  // Extend padEnd forward to the next full unit boundary
  for (const unit of visibleUnits) {
    let aligned: Date;
    switch (unit) {
      case 'week': {
        const weekStart = startOfWeek(padEnd, { weekStartsOn: 1 });
        aligned = weekStart < padEnd ? addDays(weekStart, 7) : padEnd;
        break;
      }
      case 'quarter':
        aligned = startOfQuarter(addMonths(padEnd, 3));
        if (aligned <= padEnd) aligned = startOfQuarter(addMonths(padEnd, 6));
        break;
      case 'year':
        aligned = startOfYear(addMonths(padEnd, 12));
        if (aligned <= padEnd) aligned = startOfYear(addMonths(padEnd, 24));
        break;
      default:
        aligned = padEnd;
    }
    if (aligned > padEnd) padEnd = aligned;
  }

  const total = differenceInDays(padEnd, padStart);
  return { origin: padStart.toISOString().split('T')[0], totalDays: total, rangeEndDate: subDays(padEnd, 1) };
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
  if (labels.length === 0) return [];

  const minLabelWidth: Record<string, number> = { day: 60, week: 70, month: 50, quarter: 50, year: 50 };
  const minW = minLabelWidth[unit] ?? 40;

  // Calculate skip factor using a full interior cell
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

  // Build cells — origin and end are aligned to unit boundaries so no partial cells
  const rawCells: TierCell[] = [];
  for (let i = 0; i < labels.length; i += skipFactor) {
    const startFrac = Math.max(differenceInDays(labels[i].startDate, originDate) / totalDays, 0);
    const endIdx = Math.min(i + skipFactor, labels.length) - 1;
    const endFrac = Math.min((differenceInDays(labels[endIdx].endDate, originDate) + 1) / totalDays, 1);
    rawCells.push({
      label: labels[i].label,
      fraction: startFrac,
      widthFrac: endFrac - startFrac,
    });
  }

  // Drop degenerate slivers (< 1% of a full cell) — these are alignment artifacts
  const fullCellWidth = rawCells.length > 1 ? Math.max(...rawCells.map(c => c.widthFrac)) : 1;
  const cells = rawCells.filter(c => c.widthFrac >= fullCellWidth * 0.01);

  // Drop trailing partial cell (less than half a full cell) to avoid clipped labels
  if (cells.length > 1 && cells[cells.length - 1].widthFrac < fullCellWidth * 0.5) {
    cells.pop();
  }

  // Prefix first visible label for sequential units (e.g., "Week 9", "Day 1")
  if (cells.length > 0 && (unit === 'week' || unit === 'day')) {
    const prefix = unit === 'week' ? 'Week ' : 'Day ';
    cells[0].label = prefix + cells[0].label;
  }

  return cells;
}

// ─── Auto Font Sizing ────────────────────────────────────────────────────────

let _measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  return _measureCanvas.getContext('2d');
}

/**
 * Compute the optimal font size so that the longest label fits within cellWidthPx.
 * Uses canvas text measurement for accuracy.
 * The font is capped so it doesn't exceed the row height (28px) — max ~22px.
 *
 * @param cells         The tier cells (first cell has the prefix, so it's usually longest)
 * @param fontFamily    CSS font family string
 * @param fontWeight    CSS font weight (number)
 * @param fontStyle     'normal' | 'italic'
 * @param cellWidthPx   Width of a single cell in pixels
 * @param hPadding      Total horizontal padding inside the cell (left + right)
 * @returns             Optimal font size in px
 */
export function computeAutoFontSize(
  cells: TierCell[],
  fontFamily: string,
  fontWeight: number,
  fontStyle: 'normal' | 'italic',
  cellWidthPx: number,
  hPadding: number = 12,
): number {
  const MIN_SIZE = 7;
  const MAX_SIZE = 22; // row is 28px; cap font so it fits vertically with some margin
  const ctx = getMeasureCtx();
  if (!ctx || cells.length === 0) return 12; // fallback

  const availableWidth = cellWidthPx - hPadding;
  if (availableWidth <= 0) return MIN_SIZE;

  // Find the longest label by measuring each at a reference size
  ctx.font = `${fontWeight} ${MAX_SIZE}px ${fontFamily}`;
  let longestLabel = '';
  let longestWidth = 0;
  for (const cell of cells) {
    const w = ctx.measureText(cell.label).width;
    if (w > longestWidth) {
      longestWidth = w;
      longestLabel = cell.label;
    }
  }

  // Binary search for the largest font size that fits
  let lo = MIN_SIZE;
  let hi = MAX_SIZE;
  let best = MIN_SIZE;

  while (lo <= hi) {
    const mid = Math.round((lo + hi) / 2);
    ctx.font = `${fontWeight} ${mid}px ${fontFamily}`;
    const measured = ctx.measureText(longestLabel).width;
    if (measured <= availableWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
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

// ─── Dependency Scheduling ───────────────────────────────────────────────────

/** Convert a lag value + unit to a number of days. */
function lagToDays(lag: number, unit: LagUnit): number {
  switch (unit) {
    case 'w': return lag * 7;
    case 'm': return lag * 30; // approximate
    case 'd':
    default: return lag;
  }
}

/** Add lag (in its native unit) to a date, returning ISO date string. */
function addLag(date: Date, lag: number, unit: LagUnit): string {
  let result: Date;
  switch (unit) {
    case 'w': result = addWeeks(date, lag); break;
    case 'm': result = addMonths(date, lag); break;
    case 'd':
    default: result = addDays(date, lag); break;
  }
  return result.toISOString().split('T')[0];
}

/**
 * For a given dependency, compute the earliest allowed start and end dates
 * for the successor, based on the predecessor's current dates.
 *
 * Returns { earliestStart, earliestEnd } as ISO strings, or null values
 * for whichever anchor the dependency type doesn't constrain directly.
 *
 * FS: successor.start >= predecessor.end + 1 + lag  (end-of-day means next day)
 * SS: successor.start >= predecessor.start + lag
 * FF: successor.end   >= predecessor.end + lag
 * SF: successor.end   >= predecessor.start + lag
 */
function computeConstraint(
  dep: Dependency,
  predecessor: ProjectItem
): { constrainedStart: string | null; constrainedEnd: string | null } {
  const predStart = parseISO(predecessor.startDate);
  const predEnd = parseISO(predecessor.endDate);
  const lag = dep.lag ?? 0;
  const unit = dep.lagUnit ?? 'd';

  switch (dep.type) {
    case 'finish-to-start':
      // predEnd represents end-of-day (5 PM), so successor can't start until the next day.
      // Add 1 day to account for this, then apply lag on top.
      return { constrainedStart: addLag(addDays(predEnd, 1), lag, unit), constrainedEnd: null };
    case 'start-to-start':
      return { constrainedStart: addLag(predStart, lag, unit), constrainedEnd: null };
    case 'finish-to-finish':
      return { constrainedEnd: addLag(predEnd, lag, unit), constrainedStart: null };
    case 'start-to-finish':
      return { constrainedEnd: addLag(predStart, lag, unit), constrainedStart: null };
    default:
      return { constrainedStart: null, constrainedEnd: null };
  }
}

/**
 * Schedule dependents after an item has been moved/resized or dependencies changed.
 *
 * For each successor, computes the constraint date from ALL its predecessors.
 * A "violation" means successor starts before the constraint (too early).
 * "Slack" means successor starts after the constraint (too late).
 *
 * In flexible mode (strictSnap=false): only violations trigger action. Slack is OK.
 * In strict mode (strictSnap=true): any mismatch triggers action (no slack allowed).
 *
 * When a violation (or strict mismatch) is detected:
 * - dont-allow: Auto-snap the successor to the constraint date. Cascade.
 * - allow-exception: Leave item in place. Adjust each dependency's lag so
 *     the link reflects the actual gap. Record as conflict. Cascade.
 * - ask: Record as conflict for user decision. Don't cascade.
 *
 * @returns { items, conflicts, lagAdjustments }
 */
export function scheduleDependents(
  changedItemIds: string[],
  items: ProjectItem[],
  dependencies: Dependency[],
  conflictMode: DependencyConflictMode = 'dont-allow',
  strictSnap: boolean = false
): { items: ProjectItem[]; conflicts: SchedulingConflict[]; lagAdjustments: DependencyLagAdjustment[] } {
  const updated = items.map((i) => ({ ...i }));
  const itemMap = new Map(updated.map((i) => [i.id, i]));
  const conflicts: SchedulingConflict[] = [];
  const lagAdjustments: DependencyLagAdjustment[] = [];

  /**
   * Compute the lag (in days) that a single dependency would need so that
   * its constraint matches the successor's actual position.
   */
  const computeRequiredLag = (dep: Dependency, pred: ProjectItem, succ: ProjectItem): number => {
    const predStart = parseISO(pred.startDate);
    const predEnd = parseISO(pred.endDate);
    const succStart = parseISO(succ.startDate);
    const succEnd = parseISO(succ.endDate);

    switch (dep.type) {
      // FS: natural baseline gap is 1 day (successor starts day after predecessor ends),
      // so required lag = actual gap - 1.
      case 'finish-to-start':  return differenceInDays(succStart, predEnd) - 1;
      case 'start-to-start':   return differenceInDays(succStart, predStart);
      case 'finish-to-finish': return differenceInDays(succEnd, predEnd);
      case 'start-to-finish':  return differenceInDays(succEnd, predStart);
      default: return 0;
    }
  };

  /** Evaluate a successor against all its predecessors. Returns true if BFS should cascade. */
  const evaluateSuccessor = (succId: string): boolean => {
    const successor = itemMap.get(succId);
    if (!successor) return false;

    const allDepsToSuccessor = dependencies.filter((d) => d.toId === succId);
    if (allDepsToSuccessor.length === 0) return false;

    const succStart = parseISO(successor.startDate);
    const succEnd = parseISO(successor.endDate);
    const duration = differenceInDays(succEnd, succStart);

    // Compute the tightest constraint from all predecessors
    let latestRequiredStart: Date | null = null;
    let latestRequiredEnd: Date | null = null;

    for (const dep of allDepsToSuccessor) {
      const pred = itemMap.get(dep.fromId);
      if (!pred) continue;

      const { constrainedStart, constrainedEnd } = computeConstraint(dep, pred);

      if (constrainedStart) {
        const cs = parseISO(constrainedStart);
        if (!latestRequiredStart || cs > latestRequiredStart) {
          latestRequiredStart = cs;
        }
      }
      if (constrainedEnd) {
        const ce = parseISO(constrainedEnd);
        if (!latestRequiredEnd || ce > latestRequiredEnd) {
          latestRequiredEnd = ce;
        }
      }
    }

    // Compute what the successor's dates should be per the constraints
    let reqStart = succStart;
    let reqEnd = succEnd;
    let hasViolation = false;

    if (latestRequiredStart) {
      if (latestRequiredStart > succStart) {
        // Violation: successor starts before constraint
        reqStart = latestRequiredStart;
        reqEnd = addDays(reqStart, duration);
        hasViolation = true;
      } else if (strictSnap && latestRequiredStart < succStart) {
        // Strict mode: slack is not allowed, snap back
        reqStart = latestRequiredStart;
        reqEnd = addDays(reqStart, duration);
        hasViolation = true;
      }
    }

    if (latestRequiredEnd) {
      if (latestRequiredEnd > reqEnd) {
        // Violation: end constraint pushes further
        reqEnd = latestRequiredEnd;
        reqStart = addDays(reqEnd, -duration);
        hasViolation = true;
      } else if (strictSnap && latestRequiredEnd < reqEnd && !hasViolation) {
        // Strict mode: snap back
        reqEnd = latestRequiredEnd;
        reqStart = addDays(reqEnd, -duration);
        hasViolation = true;
      }
    }

    if (!hasViolation) return false;

    const reqStartISO = reqStart.toISOString().split('T')[0];
    const reqEndISO = reqEnd.toISOString().split('T')[0];

    if (conflictMode === 'dont-allow') {
      // Auto-snap to exact constraint date
      successor.startDate = reqStartISO;
      successor.endDate = reqEndISO;
      return true; // cascade
    } else if (conflictMode === 'allow-exception') {
      // Leave item in place, adjust lag on each dependency to match actual position
      for (const dep of allDepsToSuccessor) {
        const pred = itemMap.get(dep.fromId);
        if (!pred) continue;
        const requiredLag = computeRequiredLag(dep, pred, successor);
        const currentLagDays = lagToDays(dep.lag ?? 0, dep.lagUnit ?? 'd');
        if (requiredLag !== currentLagDays) {
          lagAdjustments.push({
            fromId: dep.fromId,
            toId: dep.toId,
            newLag: requiredLag,
            newLagUnit: 'd',
          });
        }
      }
      conflicts.push({
        itemId: succId,
        itemName: successor.name,
        currentStart: successor.startDate,
        currentEnd: successor.endDate,
        requiredStart: reqStartISO,
        requiredEnd: reqEndISO,
      });
      return true; // cascade to check further dependents
    } else {
      // 'ask' mode: record conflict, wait for user decision
      conflicts.push({
        itemId: succId,
        itemName: successor.name,
        currentStart: successor.startDate,
        currentEnd: successor.endDate,
        requiredStart: reqStartISO,
        requiredEnd: reqEndISO,
      });
      return false; // don't cascade
    }
  };

  // Phase 1: If any changedItemIds are themselves successors (have incoming deps),
  // evaluate them first. This handles the case where dependencies were added/changed
  // ON the item itself (e.g. setItemDependencies, addDependency passing toId).
  const seedIds = new Set<string>();
  for (const id of changedItemIds) {
    const incomingDeps = dependencies.filter((d) => d.toId === id);
    if (incomingDeps.length > 0) {
      const shouldCascade = evaluateSuccessor(id);
      if (shouldCascade) {
        seedIds.add(id);
      }
    }
    // Always seed the item for downstream BFS (it may also be a predecessor)
    seedIds.add(id);
  }

  // Phase 2: BFS from seed items through successor chain
  const visited = new Set<string>();
  const queue = [...seedIds];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    // Find all successors (deps where currId is the predecessor)
    const successorDeps = dependencies.filter((d) => d.fromId === currId);
    const successorIds = new Set(successorDeps.map((d) => d.toId));

    for (const succId of successorIds) {
      if (visited.has(succId)) continue;
      const shouldCascade = evaluateSuccessor(succId);
      if (shouldCascade) {
        queue.push(succId);
      }
    }
  }

  return { items: updated, conflicts, lagAdjustments };
}

/**
 * Legacy wrapper — kept for backward compatibility.
 * @deprecated Use scheduleDependents instead.
 */
export function shiftDependents(
  movedItemId: string,
  _daysDelta: number,
  items: ProjectItem[],
  dependencies: Dependency[]
): ProjectItem[] {
  return scheduleDependents([movedItemId], items, dependencies).items;
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
      { unit: 'auto', format: 'MMM', visible: true, backgroundColor: '#334155', fontColor: '#e2e8f0', fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', separators: true },
    ],
    barShape: 'rounded',
    fiscalYearStartMonth: 1,
    showToday: true,
    todayColor: '#ef4444',
    todayPosition: 'below',
    todayAutoAdjusted: false,
    showElapsedTime: false,
    elapsedTimeColor: '#ef4444',
    elapsedTimeThickness: 'thin',
    leftEndCap: {
      show: false,
      fontColor: '#1e293b',
      fontFamily: 'Arial',
      fontSize: 16,
      fontWeight: 700,
      fontStyle: 'normal',
      textDecoration: 'none',
    },
    rightEndCap: {
      show: false,
      fontColor: '#1e293b',
      fontFamily: 'Arial',
      fontSize: 16,
      fontWeight: 700,
      fontStyle: 'normal',
      textDecoration: 'none',
    },
  };
}

// ─── Dependency Shorthand Parsing/Formatting ─────────────────────────────────

const DEP_TYPE_SHORT: Record<string, DependencyType> = {
  FS: 'finish-to-start',
  SS: 'start-to-start',
  FF: 'finish-to-finish',
  SF: 'start-to-finish',
};

const DEP_TYPE_TO_SHORT: Record<DependencyType, string> = {
  'finish-to-start': 'FS',
  'start-to-start': 'SS',
  'finish-to-finish': 'FF',
  'start-to-finish': 'SF',
};

/**
 * Build a map of item ID -> 1-based display row number in DataView order.
 * Order: independent items (sorted by row), then swimlane items
 * (sorted by swimlane order, then row within swimlane).
 */
export function buildRowNumberMap(
  items: ProjectItem[],
  swimlanes: { id: string; order: number }[]
): Map<string, number> {
  const slOrder = new Map(swimlanes.map((s) => [s.id, s.order]));

  // Independent items first (no swimlane), then swimlane items sorted by swimlane order then row
  const sorted = [...items].sort((a, b) => {
    const asl = a.swimlaneId ? (slOrder.get(a.swimlaneId) ?? 999) : -1;
    const bsl = b.swimlaneId ? (slOrder.get(b.swimlaneId) ?? 999) : -1;
    if (asl !== bsl) return asl - bsl;
    return a.row - b.row;
  });

  const map = new Map<string, number>();
  sorted.forEach((item, i) => map.set(item.id, i + 1));
  return map;
}

/** Reverse lookup: row number -> item ID */
export function rowNumberToId(
  rowNum: number,
  rowMap: Map<string, number>
): string | undefined {
  for (const [id, num] of rowMap) {
    if (num === rowNum) return id;
  }
  return undefined;
}

interface ParsedDependency {
  rowNum: number;
  type: DependencyType;
  lag: number;
  lagUnit: LagUnit;
}

/**
 * Parse a single shorthand token like "7FS+7d" or "3" or "5FF-2w".
 * Returns null if unparseable.
 */
function parseSingleShorthand(token: string): ParsedDependency | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Pattern: {rowNum}{optional type}{optional lag}
  // e.g. "7", "7FS", "7FS+7d", "7+7d", "7-5d", "7FF-2w"
  const match = trimmed.match(/^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+\s*[dwm]?)?$/i);
  if (!match) return null;

  const rowNum = parseInt(match[1], 10);
  if (rowNum < 1) return null;

  const typeStr = (match[2] || 'FS').toUpperCase();
  const type = DEP_TYPE_SHORT[typeStr] || 'finish-to-start';

  let lag = 0;
  let lagUnit: LagUnit = 'd';

  if (match[3]) {
    const lagMatch = match[3].replace(/\s/g, '').match(/^([+-])(\d+)([dwm])?$/i);
    if (lagMatch) {
      const sign = lagMatch[1] === '-' ? -1 : 1;
      lag = sign * parseInt(lagMatch[2], 10);
      lagUnit = ((lagMatch[3] || 'd').toLowerCase()) as LagUnit;
    }
  }

  return { rowNum, type, lag, lagUnit };
}

/**
 * Parse a full shorthand string like "7FS+7d,6FF-5d" into an array of parsed dependencies.
 */
export function parseDependencyShorthand(input: string): ParsedDependency[] {
  if (!input.trim()) return [];
  return input
    .split(',')
    .map(parseSingleShorthand)
    .filter((d): d is ParsedDependency => d !== null);
}

/**
 * Validate a shorthand string and return warning messages for bad tokens.
 * Returns an empty array if everything is valid.
 */
export function validateDependencyShorthand(
  input: string,
  targetItemId: string,
  rowMap: Map<string, number>
): string[] {
  if (!input.trim()) return [];
  const warnings: string[] = [];
  const targetRowNum = rowMap.get(targetItemId);
  const tokens = input.split(',');

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const parsed = parseSingleShorthand(trimmed);
    if (!parsed) {
      warnings.push(`"${trimmed}" is not valid`);
      continue;
    }

    if (targetRowNum != null && parsed.rowNum === targetRowNum) {
      warnings.push(`Row ${parsed.rowNum} is this item`);
      continue;
    }

    const fromId = rowNumberToId(parsed.rowNum, rowMap);
    if (!fromId) {
      warnings.push(`Row ${parsed.rowNum} does not exist`);
    }
  }

  return warnings;
}

/**
 * Format a single dependency as shorthand like "7FS+7d".
 * Omits type suffix if FS (default). Omits lag if 0.
 */
export function formatDependencyShorthand(
  dep: Dependency,
  rowMap: Map<string, number>
): string {
  const rowNum = rowMap.get(dep.fromId);
  if (rowNum == null) return '';

  const typeStr = dep.type === 'finish-to-start' ? '' : DEP_TYPE_TO_SHORT[dep.type];

  let lagStr = '';
  if (dep.lag !== 0) {
    const sign = dep.lag > 0 ? '+' : '';
    lagStr = `${sign}${dep.lag}${dep.lagUnit || 'd'}`;
  }

  return `${rowNum}${typeStr}${lagStr}`;
}

/**
 * Format all dependencies targeting a given item as a shorthand string.
 */
export function formatItemDependencies(
  itemId: string,
  dependencies: Dependency[],
  rowMap: Map<string, number>
): string {
  return dependencies
    .filter((d) => d.toId === itemId)
    .map((d) => formatDependencyShorthand(d, rowMap))
    .filter(Boolean)
    .join(',');
}

/**
 * Convert parsed shorthands into Dependency objects for a given target item.
 */
export function shorthandToDependencies(
  parsed: ParsedDependency[],
  targetItemId: string,
  rowMap: Map<string, number>,
  existingDeps: Dependency[]
): Dependency[] {
  // Build a map of existing deps keyed by fromId for preserving visibility
  const existingByFrom = new Map(
    existingDeps.filter((d) => d.toId === targetItemId).map((d) => [d.fromId, d])
  );

  return parsed
    .map((p) => {
      const fromId = rowNumberToId(p.rowNum, rowMap);
      if (!fromId || fromId === targetItemId) return null; // can't depend on self
      const existing = existingByFrom.get(fromId);
      return {
        fromId,
        toId: targetItemId,
        type: p.type,
        lag: p.lag,
        lagUnit: p.lagUnit,
        visible: existing?.visible ?? true,
      } as Dependency;
    })
    .filter((d): d is Dependency => d !== null);
}
