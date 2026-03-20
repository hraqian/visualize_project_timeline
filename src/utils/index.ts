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

export function generateTierLabels(
  tier: TimescaleTier,
  rangeStart: Date,
  rangeEnd: Date,
  fiscalYearStartMonth: number
): TimescaleLabel[] {
  switch (tier) {
    case 'year': {
      const years = eachYearOfInterval({ start: startOfYear(rangeStart), end: rangeEnd });
      return years.map((y) => {
        const end = endOfYear(y);
        if (fiscalYearStartMonth !== 1) {
          const fyStart = new Date(y.getFullYear(), fiscalYearStartMonth - 1, 1);
          const label = `FY${fyStart.getFullYear()}`;
          return { label, startDate: fyStart, endDate: new Date(fyStart.getFullYear() + 1, fiscalYearStartMonth - 1, 0) };
        }
        return { label: format(y, 'yyyy'), startDate: y, endDate: end };
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
          quarters.push({ label: `Q${q + 1} ${format(m, 'yyyy')}`, startDate: qStart, endDate: qEnd });
        }
      }
      return quarters;
    }
    case 'month': {
      const months = eachMonthOfInterval({ start: startOfMonth(rangeStart), end: rangeEnd });
      return months.map((m) => ({
        label: format(m, 'MMM yyyy'),
        startDate: m,
        endDate: endOfMonth(m),
      }));
    }
    case 'week': {
      const weeks = eachWeekOfInterval({ start: startOfWeek(rangeStart), end: rangeEnd }, { weekStartsOn: 1 });
      return weeks.map((w) => ({
        label: format(w, "'W'w"),
        startDate: w,
        endDate: addDays(w, 6),
      }));
    }
    case 'day': {
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      return days.map((d) => ({
        label: format(d, 'd'),
        startDate: d,
        endDate: d,
        isToday: isToday(d),
      }));
    }
  }
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

// ─── Timescale Defaults ──────────────────────────────────────────────────────

export function getDefaultTimescale(): TimescaleConfig {
  return {
    tiers: [
      { unit: 'year', visible: true, backgroundColor: '#1e293b', fontColor: '#f8fafc', fontSize: 13 },
      { unit: 'month', visible: true, backgroundColor: '#334155', fontColor: '#e2e8f0', fontSize: 12 },
    ],
    fiscalYearStartMonth: 1,
    showToday: true,
    todayColor: '#ef4444',
  };
}
