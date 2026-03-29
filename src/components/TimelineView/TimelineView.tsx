import { useRef, useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseISO, differenceInDays, addDays, format } from 'date-fns';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import { buildDependencyRenderGeometry, dependencyArrowEndInset, dependencyArrowVisualClearance } from '@/components/common/dependencyArrowGeometry';
import { generateTierLabels, buildVisibleTierCells, computeAutoFontSize, getProjectRangePadded, resolveAutoUnit } from '@/utils';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DatePickerPopover } from './DatePickerPopover';
import type { ProjectItem, Swimlane, DurationFormat, ConnectorThickness, OutlineThickness, TimescaleBarShape, DependencyType } from '@/types';

// ─── Types for inline editing ────────────────────────────────────────────────

type EditingField = {
  itemId: string;
  field: 'title' | 'date' | 'duration' | 'percentComplete' | 'milestoneTitle' | 'milestoneDate' | 'swimlaneName';
} | null;

// ─── InlineEditInput ─────────────────────────────────────────────────────────
// A small inline text input that auto-focuses, selects all, and commits on Enter/blur.

function InlineEditInput({
  value,
  onCommit,
  onCancel,
  style: inputStyle,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        e.stopPropagation();
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={className}
      style={{
        border: '1px solid #ef4444',
        borderRadius: 2,
        outline: 'none',
        background: 'white',
        padding: '0 2px',
        margin: '-1px -3px',
        boxSizing: 'content-box',
        ...inputStyle,
        color: '#334155',
      }}
    />
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44; // Default/fallback: ROW_BASE + default spacing (8)
const ROW_BASE = 36;   // Base cell height (bar slot) before spacing is added
const SWIMLANE_BADGE_WIDTH = 120;
const INDEPENDENT_SECTION_PADDING = 12;
const CONNECTOR_THICKNESS_MAP: Record<ConnectorThickness, number> = { thin: 1, medium: 2, thick: 3 };
const OUTLINE_THICKNESS_MAP: Record<OutlineThickness, number> = { none: 0, thin: 1, medium: 2, thick: 3 };
const SWIMLANE_PADDING_TOP = 10;
const SWIMLANE_PADDING_BOTTOM = 10;

// ─── Obstacle-avoidance routing for dependency links ─────────────────────────
// Visibility-graph + Dijkstra router with proximity + bend penalties.
// Three independent constants:
//   GEOM_EPS  – tiny offset for candidate scanlines (hard geometry)
//   PORT_OFFSET – how far glue ports sit outside the object boundary
//   SOFT_ZONE – proximity penalty zone (soft preference only)
interface ObstacleRect { leftX: number; rightX: number; topY: number; bottomY: number }

type AnchorDir = 'right' | 'left' | 'top' | 'bottom';

function dependencyTypeToSides(type: DependencyType): { fromSide: 'start' | 'end'; toSide: 'start' | 'end' } {
  switch (type) {
    case 'start-to-start':
      return { fromSide: 'start', toSide: 'start' };
    case 'finish-to-finish':
      return { fromSide: 'end', toSide: 'end' };
    case 'start-to-finish':
      return { fromSide: 'start', toSide: 'end' };
    case 'finish-to-start':
    default:
      return { fromSide: 'end', toSide: 'start' };
  }
}

function dependencySidesToType(fromSide: 'start' | 'end', toSide: 'start' | 'end'): DependencyType {
  if (fromSide === 'start' && toSide === 'start') return 'start-to-start';
  if (fromSide === 'end' && toSide === 'end') return 'finish-to-finish';
  if (fromSide === 'start' && toSide === 'end') return 'start-to-finish';
  return 'finish-to-start';
}

function getItemHorizontalAnchor(item: ProjectItem, side: 'start' | 'end', zoom: number, itemToX: (date: string) => number) {
  if (item.type === 'milestone') {
    const centerX = itemToX(item.startDate);
    return side === 'start'
      ? centerX - item.milestoneStyle.size / 2
      : centerX + item.milestoneStyle.size / 2;
  }

  const startX = itemToX(item.startDate);
  const endX = startX + differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;
  return side === 'start' ? startX : endX;
}

function getDependencyPreviewOffset(type: DependencyType, predecessor: ProjectItem, successor: ProjectItem) {
  const predStart = parseISO(predecessor.startDate);
  const predEnd = parseISO(predecessor.endDate);
  const succStart = parseISO(successor.startDate);
  const succEnd = parseISO(successor.endDate);

  switch (type) {
    case 'start-to-start':
      return differenceInDays(predStart, succStart);
    case 'finish-to-finish':
      return differenceInDays(predEnd, succEnd);
    case 'start-to-finish':
      return differenceInDays(predStart, succEnd);
    case 'finish-to-start':
    default:
      return differenceInDays(addDays(predEnd, 1), succStart);
  }
}

const DEFAULT_DEPENDENCY_COLOR = '#475569';
const DEPENDENCY_DASH_MAP: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 4',
  'long-dashed': '10 6',
  'dash-dot': '8 4 2 4',
  'long-dot': '10 4 2 4',
};

function dependencyStrokeOpacity(transparency: number | undefined): number {
  const clamped = Math.max(0, Math.min(100, transparency ?? 0));
  return (100 - clamped) / 100;
}

function renderDependencyHead(
  head: NonNullable<ReturnType<typeof buildDependencyRenderGeometry>['head']>,
  stroke: string,
  strokeOpacity: number,
  strokeWidth: number,
  isSelected: boolean,
): React.ReactNode {
  const haloStroke = strokeWidth + 4;

  if (head.kind === 'polygon') {
    return (
      <>
        {isSelected && (
          <polygon
            points={head.points}
            fill="none"
            stroke="#3b82f6"
            strokeOpacity={0.28}
            strokeWidth={haloStroke}
            strokeLinejoin="round"
          />
        )}
        {!head.fill && (
          <polygon
            points={head.points}
            fill="#ffffff"
            fillOpacity={0.96}
            stroke="#ffffff"
            strokeWidth={strokeWidth + 1.5}
            strokeLinejoin="round"
          />
        )}
        <polygon
          points={head.points}
          fill={head.fill ? stroke : 'none'}
          fillOpacity={head.fill ? strokeOpacity : undefined}
          stroke={head.fill ? 'none' : stroke}
          strokeOpacity={head.fill ? undefined : strokeOpacity}
          strokeWidth={head.fill ? undefined : strokeWidth}
          strokeLinejoin="round"
        />
      </>
    );
  }

  if (head.kind === 'path') {
    return (
      <>
        {isSelected && (
          <path
            d={head.d}
            fill="none"
            stroke="#3b82f6"
            strokeOpacity={0.28}
            strokeWidth={haloStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <path
          d={head.d}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.96}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={head.d}
          fill="none"
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }

  return (
    <>
      {isSelected && (
        <circle
          cx={head.cx}
          cy={head.cy}
          r={head.r}
          fill="none"
          stroke="#3b82f6"
          strokeOpacity={0.28}
          strokeWidth={haloStroke}
        />
      )}
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r}
        fill="#ffffff"
        fillOpacity={0.96}
        stroke="#ffffff"
        strokeWidth={strokeWidth + 1.5}
      />
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r}
        fill="none"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
      />
    </>
  );
}

function routeDepLink(
  fromX: number, fromY: number,
  toX: number, toY: number,
  allObjects: ObstacleRect[],
  startObj: ObstacleRect,
  endObj: ObstacleRect,
  fromDir: AnchorDir = 'right',
  toDir: AnchorDir = 'left',
  visualClearance: number = 0,
  endInset: number = 0,
): string {
  type NodeKey = string;
  type EdgeDir = 'H' | 'V' | 'S';
  type GraphEdge = { key: NodeKey; cost: number; dir: EdgeDir };
  type StateKey = string;

  const GEOM_EPS = 0.5;
  const HARD_PAD = 1 + visualClearance;
  const MIN_PORT_OFFSET = 3;
  const MAX_PORT_OFFSET = 16 + visualClearance;
  const SOFT_ZONE = 28 + visualClearance;
  const PROXIMITY_WEIGHT = 1.25;
  const BEND_PENALTY = 18;
  const OUTER_MARGIN = 48 + visualClearance;
  const ANCHOR_DEVIATION_WEIGHT = 24;

  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const approxEq = (a: number, b: number) => Math.abs(a - b) <= GEOM_EPS;
  const isHorizontalDir = (dir: AnchorDir) => dir === 'left' || dir === 'right';
  const manhattan = (ax: number, ay: number, bx: number, by: number) => Math.abs(bx - ax) + Math.abs(by - ay);

  const rectEq = (a: ObstacleRect, b: ObstacleRect) =>
    approxEq(a.leftX, b.leftX) &&
    approxEq(a.rightX, b.rightX) &&
    approxEq(a.topY, b.topY) &&
    approxEq(a.bottomY, b.bottomY);

  const normalizeRect = (r: ObstacleRect): ObstacleRect => ({
    leftX: Math.min(r.leftX, r.rightX),
    rightX: Math.max(r.leftX, r.rightX),
    topY: Math.min(r.topY, r.bottomY),
    bottomY: Math.max(r.topY, r.bottomY),
  });

  const expandRect = (r: ObstacleRect, amount: number): ObstacleRect => ({
    leftX: r.leftX - amount,
    rightX: r.rightX + amount,
    topY: r.topY - amount,
    bottomY: r.bottomY + amount,
  });

  const objects = allObjects.map(normalizeRect);
  const startRect = normalizeRect(startObj);
  const endRect = normalizeRect(endObj);

  const nodeKey = (x: number, y: number): NodeKey => `${round3(x)},${round3(y)}`;

  const pointInRect = (x: number, y: number, r: ObstacleRect): boolean =>
    x >= r.leftX - GEOM_EPS &&
    x <= r.rightX + GEOM_EPS &&
    y >= r.topY - GEOM_EPS &&
    y <= r.bottomY + GEOM_EPS;

  const pointStrictlyInsideRect = (x: number, y: number, r: ObstacleRect): boolean =>
    x > r.leftX &&
    x < r.rightX &&
    y > r.topY &&
    y < r.bottomY;

  const segmentHitsRect = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    rect: ObstacleRect,
    extraPad: number = 0,
  ): boolean => {
    const r = expandRect(rect, extraPad);

    if (approxEq(ax, bx)) {
      const x = ax;
      const lo = Math.min(ay, by);
      const hi = Math.max(ay, by);
      return (
        x >= r.leftX - GEOM_EPS &&
        x <= r.rightX + GEOM_EPS &&
        hi >= r.topY - GEOM_EPS &&
        lo <= r.bottomY + GEOM_EPS
      );
    }

    if (approxEq(ay, by)) {
      const y = ay;
      const lo = Math.min(ax, bx);
      const hi = Math.max(ax, bx);
      return (
        y >= r.topY - GEOM_EPS &&
        y <= r.bottomY + GEOM_EPS &&
        hi >= r.leftX - GEOM_EPS &&
        lo <= r.rightX + GEOM_EPS
      );
    }

    return true;
  };

  const pointInFreeSpace = (x: number, y: number): boolean => {
    for (const rect of objects) {
      if (pointInRect(x, y, expandRect(rect, HARD_PAD))) return false;
    }
    return true;
  };

  const segmentClear = (ax: number, ay: number, bx: number, by: number): boolean => {
    if (!approxEq(ax, bx) && !approxEq(ay, by)) return false;
    for (const rect of objects) {
      if (segmentHitsRect(ax, ay, bx, by, rect, HARD_PAD)) return false;
    }
    return true;
  };

  const validGlueExit = (
    obj: ObstacleRect,
    glueX: number,
    glueY: number,
    portX: number,
    portY: number,
  ): boolean => {
    if (!approxEq(glueX, portX) && !approxEq(glueY, portY)) return false;
    if (!pointInFreeSpace(portX, portY)) return false;

    const probeX = approxEq(glueX, portX)
      ? glueX
      : glueX + Math.sign(portX - glueX) * GEOM_EPS;
    const probeY = approxEq(glueY, portY)
      ? glueY
      : glueY + Math.sign(portY - glueY) * GEOM_EPS;

    for (const rect of objects) {
      if (rectEq(rect, obj)) {
        if (pointStrictlyInsideRect(probeX, probeY, rect)) return false;
      } else {
        if (segmentHitsRect(glueX, glueY, portX, portY, rect, HARD_PAD)) return false;
      }
    }

    return true;
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const anchorInsetForSpan = (span: number) => Math.max(2, Math.min(8, span / 4));

  const buildSideAnchors = (
    obj: ObstacleRect,
    preferredX: number,
    preferredY: number,
    dir: AnchorDir,
    oppositeX: number,
    _oppositeY: number,
  ): [number, number][] => {
    const candidates = new Set<string>();
    const addPoint = (x: number, y: number) => {
      candidates.add(`${round3(x)},${round3(y)}`);
    };

    if (dir === 'top' || dir === 'bottom') {
      const y = dir === 'top' ? obj.topY : obj.bottomY;
      const insetX = anchorInsetForSpan(obj.rightX - obj.leftX);
      const minX = Math.min((obj.leftX + obj.rightX) / 2, obj.leftX + insetX);
      const maxX = Math.max((obj.leftX + obj.rightX) / 2, obj.rightX - insetX);
      const midX = (obj.leftX + obj.rightX) / 2;

      addPoint(clamp(preferredX, minX, maxX), y);
      addPoint(clamp(oppositeX, minX, maxX), y);
      addPoint(midX, y);

      for (const rect of objects) {
        addPoint(clamp(rect.leftX - HARD_PAD - GEOM_EPS, minX, maxX), y);
        addPoint(clamp(rect.rightX + HARD_PAD + GEOM_EPS, minX, maxX), y);
      }
    } else {
      const x = dir === 'left' ? obj.leftX : obj.rightX;
      const midY = (obj.topY + obj.bottomY) / 2;
      addPoint(x, midY);
    }

    return Array.from(candidates)
      .map((key) => key.split(',').map(Number) as [number, number])
      .sort((a, b) => {
        const da = Math.abs(a[0] - preferredX) + Math.abs(a[1] - preferredY);
        const db = Math.abs(b[0] - preferredX) + Math.abs(b[1] - preferredY);
        return da - db;
      });
  };

  const buildPorts = (obj: ObstacleRect, gx: number, gy: number, dir: AnchorDir, minOffset: number): [number, number][] => {
    const ports: [number, number][] = [];
    const portForOffset = (offset: number): [number, number] => {
      switch (dir) {
        case 'left': return [gx - offset, gy];
        case 'right': return [gx + offset, gy];
        case 'top': return [gx, gy - offset];
        case 'bottom': return [gx, gy + offset];
      }
    };

    const clearanceInDir = (): number => {
      let best = Infinity;

      for (const rect of objects) {
        if (rectEq(rect, obj)) continue;

        if (isHorizontalDir(dir)) {
          if (gy < rect.topY - GEOM_EPS || gy > rect.bottomY + GEOM_EPS) continue;
          if (dir === 'right' && rect.leftX >= gx - GEOM_EPS) {
            best = Math.min(best, rect.leftX - gx);
          }
          if (dir === 'left' && rect.rightX <= gx + GEOM_EPS) {
            best = Math.min(best, gx - rect.rightX);
          }
        } else {
          if (gx < rect.leftX - GEOM_EPS || gx > rect.rightX + GEOM_EPS) continue;
          if (dir === 'bottom' && rect.topY >= gy - GEOM_EPS) {
            best = Math.min(best, rect.topY - gy);
          }
          if (dir === 'top' && rect.bottomY <= gy + GEOM_EPS) {
            best = Math.min(best, gy - rect.bottomY);
          }
        }
      }

      return best;
    };

    const clampedMinOffset = Math.max(GEOM_EPS * 2, minOffset);
    const maxOffset = Math.max(0, Math.min(MAX_PORT_OFFSET, clearanceInDir() - HARD_PAD));
    const candidateOffsets = new Set<number>();

    for (const offset of [clampedMinOffset, 4, 6, 8, 12, MAX_PORT_OFFSET]) {
      if (offset >= clampedMinOffset - GEOM_EPS && offset <= maxOffset + GEOM_EPS) {
        candidateOffsets.add(offset);
      }
    }
    if (maxOffset >= clampedMinOffset - GEOM_EPS) candidateOffsets.add(Math.max(clampedMinOffset, round3(maxOffset)));
    if (candidateOffsets.size === 0 && maxOffset > GEOM_EPS * 2) {
      const fallbackOffset = Math.max(clampedMinOffset, maxOffset / 2);
      if (fallbackOffset <= maxOffset + GEOM_EPS) {
        candidateOffsets.add(round3(fallbackOffset));
      }
    }

    for (const offset of candidateOffsets) {
      ports.push(portForOffset(offset));
    }

    return ports
      .filter(([px, py]) => validGlueExit(obj, gx, gy, px, py))
      .sort((a, b) => {
        const da = Math.abs(a[0] - gx) + Math.abs(a[1] - gy);
        const db = Math.abs(b[0] - gx) + Math.abs(b[1] - gy);
        return da - db;
      });
  };

  const startAnchors = buildSideAnchors(startRect, fromX, fromY, fromDir, toX, toY);
  const endAnchors = buildSideAnchors(endRect, toX, toY, toDir, fromX, fromY);

  const startPortToAnchor = new Map<string, [number, number]>();
  const endPortToAnchor = new Map<string, [number, number]>();
  const startPorts: [number, number][] = [];
  const endPorts: [number, number][] = [];

  const startMinOffset = MIN_PORT_OFFSET;
  const endMinOffset = Math.max(MIN_PORT_OFFSET, endInset);

  for (const [gx, gy] of startAnchors) {
    for (const port of buildPorts(startRect, gx, gy, fromDir, startMinOffset)) {
      const key = nodeKey(port[0], port[1]);
      if (!startPortToAnchor.has(key)) {
        startPorts.push(port);
        startPortToAnchor.set(key, [gx, gy]);
      }
    }
  }

  for (const [gx, gy] of endAnchors) {
    for (const port of buildPorts(endRect, gx, gy, toDir, endMinOffset)) {
      const key = nodeKey(port[0], port[1]);
      if (!endPortToAnchor.has(key)) {
        endPorts.push(port);
        endPortToAnchor.set(key, [gx, gy]);
      }
    }
  }

  if (startPorts.length === 0 || endPorts.length === 0) {
    return '';
  }

  const xSet = new Set<number>();
  const ySet = new Set<number>();
  const addX = (x: number) => xSet.add(round3(x));
  const addY = (y: number) => ySet.add(round3(y));

  let minX = Math.min(fromX, toX);
  let maxX = Math.max(fromX, toX);
  let minY = Math.min(fromY, toY);
  let maxY = Math.max(fromY, toY);

  for (const rect of objects) {
    minX = Math.min(minX, rect.leftX);
    maxX = Math.max(maxX, rect.rightX);
    minY = Math.min(minY, rect.topY);
    maxY = Math.max(maxY, rect.bottomY);

    addX(rect.leftX - HARD_PAD);
    addX(rect.rightX + HARD_PAD);
    addY(rect.topY - HARD_PAD);
    addY(rect.bottomY + HARD_PAD);

    addX(rect.leftX - MAX_PORT_OFFSET);
    addX(rect.rightX + MAX_PORT_OFFSET);
    addY(rect.topY - MAX_PORT_OFFSET);
    addY(rect.bottomY + MAX_PORT_OFFSET);

    addX(rect.leftX - SOFT_ZONE);
    addX(rect.rightX + SOFT_ZONE);
    addY(rect.topY - SOFT_ZONE);
    addY(rect.bottomY + SOFT_ZONE);
  }

  addX(minX - OUTER_MARGIN);
  addX(maxX + OUTER_MARGIN);
  addY(minY - OUTER_MARGIN);
  addY(maxY + OUTER_MARGIN);
  addX(fromX);
  addX(toX);
  addY(fromY);
  addY(toY);

  for (const [px, py] of startPorts) {
    addX(px);
    addY(py);
  }
  for (const [px, py] of endPorts) {
    addX(px);
    addY(py);
  }

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);

  const nodes = new Map<NodeKey, [number, number]>();
  for (const x of xs) {
    for (const y of ys) {
      if (pointInFreeSpace(x, y)) {
        nodes.set(nodeKey(x, y), [x, y]);
      }
    }
  }
  for (const point of startPorts) nodes.set(nodeKey(point[0], point[1]), point);
  for (const point of endPorts) nodes.set(nodeKey(point[0], point[1]), point);

  const segmentMinDist = (ax: number, ay: number, bx: number, by: number, rect: ObstacleRect): number => {
    if (approxEq(ax, bx)) {
      const x = ax;
      const lo = Math.min(ay, by);
      const hi = Math.max(ay, by);
      if (hi >= rect.topY && lo <= rect.bottomY) {
        if (x < rect.leftX) return rect.leftX - x;
        if (x > rect.rightX) return x - rect.rightX;
        return 0;
      }
      const dx = Math.max(0, rect.leftX - x, x - rect.rightX);
      const dy = Math.min(Math.abs(lo - rect.bottomY), Math.abs(hi - rect.topY));
      return Math.sqrt(dx * dx + dy * dy);
    }

    const y = ay;
    const lo = Math.min(ax, bx);
    const hi = Math.max(ax, bx);
    if (hi >= rect.leftX && lo <= rect.rightX) {
      if (y < rect.topY) return rect.topY - y;
      if (y > rect.bottomY) return y - rect.bottomY;
      return 0;
    }
    const dy = Math.max(0, rect.topY - y, y - rect.bottomY);
    const dx = Math.min(Math.abs(lo - rect.rightX), Math.abs(hi - rect.leftX));
    return Math.sqrt(dx * dx + dy * dy);
  };

  const computeEdgeCost = (ax: number, ay: number, bx: number, by: number): number => {
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    let proxPenalty = 0;
    for (const rect of objects) {
      if (rectEq(rect, startRect) || rectEq(rect, endRect)) continue;
      const dist = segmentMinDist(ax, ay, bx, by, rect);
      if (dist < SOFT_ZONE) {
        proxPenalty += (SOFT_ZONE - dist) * PROXIMITY_WEIGHT * (len / SOFT_ZONE);
      }
    }
    return len + proxPenalty;
  };

  const graph = new Map<NodeKey, GraphEdge[]>();
  const addEdge = (a: NodeKey, b: NodeKey, cost: number, dir: EdgeDir) => {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)!.push({ key: b, cost, dir });
    graph.get(b)!.push({ key: a, cost, dir });
  };

  const byX = new Map<number, [number, number][]>();
  const byY = new Map<number, [number, number][]>();
  for (const [, point] of nodes) {
    const col = byX.get(point[0]) ?? [];
    col.push(point);
    byX.set(point[0], col);

    const row = byY.get(point[1]) ?? [];
    row.push(point);
    byY.set(point[1], row);
  }

  for (const [, col] of byX) {
    col.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < col.length - 1; i++) {
      const a = col[i];
      const b = col[i + 1];
      if (segmentClear(a[0], a[1], b[0], b[1])) {
        addEdge(nodeKey(a[0], a[1]), nodeKey(b[0], b[1]), computeEdgeCost(a[0], a[1], b[0], b[1]), 'V');
      }
    }
  }

  for (const [, row] of byY) {
    row.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i];
      const b = row[i + 1];
      if (segmentClear(a[0], a[1], b[0], b[1])) {
        addEdge(nodeKey(a[0], a[1]), nodeKey(b[0], b[1]), computeEdgeCost(a[0], a[1], b[0], b[1]), 'H');
      }
    }
  }

  const S = 'S';
  const T = 'T';
  graph.set(S, []);
  graph.set(T, []);

  const axisForDir = (dir: AnchorDir): EdgeDir => (isHorizontalDir(dir) ? 'H' : 'V');
  const terminalEdgeCost = (point: [number, number], anchor: [number, number], preferredX: number, preferredY: number) =>
    manhattan(point[0], point[1], anchor[0], anchor[1]) + manhattan(anchor[0], anchor[1], preferredX, preferredY) * ANCHOR_DEVIATION_WEIGHT;
  const segmentMatchesDir = (a: [number, number], b: [number, number], dir: AnchorDir) =>
    (dir === 'left' && approxEq(a[1], b[1]) && b[0] < a[0]) ||
    (dir === 'right' && approxEq(a[1], b[1]) && b[0] > a[0]) ||
    (dir === 'top' && approxEq(a[0], b[0]) && b[1] < a[1]) ||
    (dir === 'bottom' && approxEq(a[0], b[0]) && b[1] > a[1]);

  const fromAxis: EdgeDir = axisForDir(fromDir);
  const toAxis: EdgeDir = axisForDir(toDir);

  for (const point of startPorts) {
    const key = nodeKey(point[0], point[1]);
    const anchor = startPortToAnchor.get(key);
    if (!anchor) continue;
    graph.get(S)!.push({
      key,
      cost: terminalEdgeCost(point, anchor, fromX, fromY),
      dir: fromAxis,
    });
  }

  for (const point of endPorts) {
    const key = nodeKey(point[0], point[1]);
    const anchor = endPortToAnchor.get(key);
    if (!anchor) continue;
    if (!graph.has(key)) graph.set(key, []);
    graph.get(key)!.push({
      key: T,
      cost: terminalEdgeCost(point, anchor, toX, toY),
      dir: toAxis,
    });
  }

  const stateKey = (node: NodeKey, dir: EdgeDir): StateKey => `${node}|${dir}`;
  const stateNode = new Map<StateKey, NodeKey>();
  const dist = new Map<StateKey, number>();
  const prev = new Map<StateKey, StateKey>();
  const startState = stateKey(S, 'S');
  stateNode.set(startState, S);
  dist.set(startState, 0);

  const queue: { state: StateKey; cost: number }[] = [{ state: startState, cost: 0 }];
  let reached: StateKey | null = null;

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[minIdx].cost) minIdx = i;
    }

    const { state, cost } = queue[minIdx];
    queue.splice(minIdx, 1);
    if (cost > (dist.get(state) ?? Infinity)) continue;

    const curNode = stateNode.get(state)!;
    if (curNode === T) {
      reached = state;
      break;
    }

    const curDir = state.split('|')[1] as EdgeDir;
    for (const edge of graph.get(curNode) ?? []) {
      const bend = curDir !== 'S' && curDir !== edge.dir ? BEND_PENALTY : 0;
      const nextCost = cost + edge.cost + bend;
      const nextState = stateKey(edge.key, edge.key === T ? 'S' : edge.dir);
      if (nextCost < (dist.get(nextState) ?? Infinity)) {
        dist.set(nextState, nextCost);
        prev.set(nextState, state);
        stateNode.set(nextState, edge.key);
        queue.push({ state: nextState, cost: nextCost });
      }
    }
  }

  if (!reached) {
    return '';
  }

  const rawPath: [number, number][] = [];
  let cursor: StateKey | undefined = reached;
  while (cursor) {
    const key = stateNode.get(cursor);
    if (key && key !== S && key !== T) {
      const point = nodes.get(key);
      if (point) rawPath.unshift(point);
    }
    cursor = prev.get(cursor);
  }

  if (rawPath.length === 0) return '';

  const chosenStartAnchor = startPortToAnchor.get(nodeKey(rawPath[0][0], rawPath[0][1]));
  const chosenEndAnchor = endPortToAnchor.get(nodeKey(rawPath[rawPath.length - 1][0], rawPath[rawPath.length - 1][1]));
  if (!chosenStartAnchor || !chosenEndAnchor) return '';

  const fullPath: [number, number][] = [chosenStartAnchor, ...rawPath, chosenEndAnchor];
  const deduped: [number, number][] = [];
  for (const point of fullPath) {
    const last = deduped[deduped.length - 1];
    if (!last || !approxEq(last[0], point[0]) || !approxEq(last[1], point[1])) {
      deduped.push(point);
    }
  }

  if (deduped.length < 2) return '';

  const simplified: [number, number][] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = simplified[simplified.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    if ((approxEq(a[0], b[0]) && approxEq(b[0], c[0])) || (approxEq(a[1], b[1]) && approxEq(b[1], c[1]))) {
      continue;
    }
    simplified.push(b);
  }
  simplified.push(deduped[deduped.length - 1]);

  if (simplified.length < 2) return '';

  const ensureArrowComfort = (pathPoints: [number, number][]): [number, number][] => {
    if (pathPoints.length < 3 || endInset <= 0) return pathPoints;

    const comfortTarget = Math.ceil(endInset * 1.25);
    const lastIdx = pathPoints.length - 1;
    const finalBendIdx = lastIdx - 1;
    const finalLen = manhattan(
      pathPoints[finalBendIdx][0],
      pathPoints[finalBendIdx][1],
      pathPoints[lastIdx][0],
      pathPoints[lastIdx][1],
    );

    if (finalLen >= comfortTarget) return pathPoints;

    const needed = comfortTarget - finalLen;
    const isFinalHorizontal = approxEq(pathPoints[finalBendIdx][1], pathPoints[lastIdx][1]);
    const axisValue = isFinalHorizontal ? pathPoints[finalBendIdx][0] : pathPoints[finalBendIdx][1];
    let runStart = finalBendIdx;

    while (runStart - 1 >= 0) {
      const prev = pathPoints[runStart - 1];
      const matches = isFinalHorizontal ? approxEq(prev[0], axisValue) : approxEq(prev[1], axisValue);
      if (!matches) break;
      runStart -= 1;
    }

    const sign = toDir === 'left' ? -1 : toDir === 'right' ? 1 : toDir === 'top' ? -1 : 1;

    const isComfortCandidateValid = (candidate: [number, number][]): boolean => {
      const candidateFinalLen = manhattan(
        candidate[finalBendIdx][0],
        candidate[finalBendIdx][1],
        candidate[lastIdx][0],
        candidate[lastIdx][1],
      );
      if (candidateFinalLen < comfortTarget) return false;

      for (let i = 1; i < candidate.length - 1; i += 1) {
        const [x, y] = candidate[i];
        if (!pointInFreeSpace(x, y)) return false;
      }

      for (let i = 0; i < candidate.length - 1; i += 1) {
        const a = candidate[i];
        const b = candidate[i + 1];
        if (!approxEq(a[0], b[0]) && !approxEq(a[1], b[1])) return false;

        if (i === 0) {
          if (!validGlueExit(startRect, chosenStartAnchor[0], chosenStartAnchor[1], b[0], b[1])) return false;
        } else if (i === candidate.length - 2) {
          if (!validGlueExit(endRect, chosenEndAnchor[0], chosenEndAnchor[1], a[0], a[1])) return false;
        } else if (!segmentClear(a[0], a[1], b[0], b[1])) {
          return false;
        }
      }

      return true;
    };

    for (let delta = needed; delta >= 1; delta -= 1) {
      const candidate = pathPoints.map((point) => [...point] as [number, number]);
      for (let i = runStart; i <= finalBendIdx; i += 1) {
        if (isFinalHorizontal) {
          candidate[i][0] += sign * delta;
        } else {
          candidate[i][1] += sign * delta;
        }
      }

      if (isComfortCandidateValid(candidate)) return candidate;
    }

    return pathPoints;
  };

  const comfortable = ensureArrowComfort(simplified);

  const first = comfortable[0];
  const second = comfortable[1];
  const beforeLast = comfortable[comfortable.length - 2];
  const last = comfortable[comfortable.length - 1];

  const firstSegOk = segmentMatchesDir(first, second, fromDir);
  const lastSegOk = segmentMatchesDir(last, beforeLast, toDir);

  if (!firstSegOk || !lastSegOk) return '';

  for (let i = 0; i < comfortable.length - 1; i++) {
    const a = comfortable[i];
    const b = comfortable[i + 1];
    if (!approxEq(a[0], b[0]) && !approxEq(a[1], b[1])) return '';

    if (i === 0) {
      if (!validGlueExit(startRect, chosenStartAnchor[0], chosenStartAnchor[1], b[0], b[1])) return '';
    } else if (i === simplified.length - 2) {
      if (!validGlueExit(endRect, chosenEndAnchor[0], chosenEndAnchor[1], a[0], a[1])) return '';
    } else {
      if (!segmentClear(a[0], a[1], b[0], b[1])) return '';
    }
  }

  return comfortable.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${round3(point[0])} ${round3(point[1])}`).join(' ');
}

function getTimescaleBarShapeStyle(shape: TimescaleBarShape): React.CSSProperties {
  switch (shape) {
    case 'rectangle': return { borderRadius: 0 };
    case 'rounded': return { borderRadius: 6 };
    case 'ellipse': return { borderRadius: '9999px' };
    case 'modern': return { borderRadius: 6, transform: 'skewX(-5deg)' };
    case 'leaf': return { borderRadius: '6px 2px 6px 2px', transform: 'skewX(-5deg)' };
    case 'slant': return { clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' };
  }
}

// ─── Duration Formatting ─────────────────────────────────────────────────────

function formatDuration(startDate: string, endDate: string, fmt: DurationFormat): string {
  const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1; // inclusive
  switch (fmt) {
    case 'd': return `${days}d`;
    case 'days': return `${days} days`;
    case 'w': { const w = (days / 7).toFixed(1).replace(/\.0$/, ''); return `${w}w`; }
    case 'wks': { const w = (days / 7).toFixed(1).replace(/\.0$/, ''); return `${w} wks`; }
    case 'weeks': { const w = (days / 7).toFixed(1).replace(/\.0$/, ''); return `${w} weeks`; }
    case 'mons': { const m = (days / 30.44).toFixed(1).replace(/\.0$/, ''); return `${m} mons`; }
    case 'months': { const m = (days / 30.44).toFixed(1).replace(/\.0$/, ''); return `${m} months`; }
    case 'q': { const q = (days / 91.31).toFixed(1).replace(/\.0$/, ''); return `${q}q`; }
    case 'qrts': { const q = (days / 91.31).toFixed(1).replace(/\.0$/, ''); return `${q} qrts`; }
    case 'quarters': { const q = (days / 91.31).toFixed(1).replace(/\.0$/, ''); return `${q} quarters`; }
    case 'y': { const y = (days / 365.25).toFixed(1).replace(/\.0$/, ''); return `${y}y`; }
    case 'yrs': { const y = (days / 365.25).toFixed(1).replace(/\.0$/, ''); return `${y} yrs`; }
    case 'years': { const y = (days / 365.25).toFixed(1).replace(/\.0$/, ''); return `${y} years`; }
    default: return `${days} days`;
  }
}

/** Parse a duration string like "7d", "2w", "1.5 months" back to inclusive days. Returns null if invalid. */
function parseDurationToDays(text: string): number | null {
  const t = text.trim().toLowerCase();
  // Try pure number (treat as days)
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  // Match number + unit
  const m = t.match(/^([\d.]+)\s*(d|days?|w|wks?|weeks?|mons?|months?|q|qrts?|quarters?|y|yrs?|years?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (isNaN(n) || n <= 0) return null;
  const unit = m[2];
  if (unit.startsWith('d')) return Math.round(n);
  if (unit.startsWith('w')) return Math.round(n * 7);
  if (unit.startsWith('mo')) return Math.round(n * 30.44);
  if (unit.startsWith('q')) return Math.round(n * 91.31);
  if (unit.startsWith('y')) return Math.round(n * 365.25);
  return null;
}

// ─── TimelineView ────────────────────────────────────────────────────────────

export interface TimelineViewHandle {
  getExportElement: () => HTMLDivElement | null;
}

interface TimelineViewProps {
  onOpenSettings?: () => void;
}

export const TimelineView = forwardRef<TimelineViewHandle, TimelineViewProps>(function TimelineView({ onOpenSettings }, ref) {
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const dependencies = useProjectStore((s) => s.dependencies);
  const timescale = useProjectStore((s) => s.timescale);
  const zoom = useProjectStore((s) => s.zoom);
  const setZoom = useProjectStore((s) => s.setZoom);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const selectedSwimlaneId = useProjectStore((s) => s.selectedSwimlaneId);
  const setSelectedSwimlane = useProjectStore((s) => s.setSelectedSwimlane);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);
  const moveItem = useProjectStore((s) => s.moveItem);
  const moveItemToSwimlane = useProjectStore((s) => s.moveItemToSwimlane);
  const showCriticalPath = useProjectStore((s) => s.showCriticalPath);
  const showDependencies = useProjectStore((s) => s.showDependencies);
  const swimlaneSpacing = useProjectStore((s) => s.swimlaneSpacing);
  const taskLayout = useProjectStore((s) => s.taskLayout);
  const selectedTierIndex = useProjectStore((s) => s.selectedTierIndex);
  const setSelectedTierIndex = useProjectStore((s) => s.setSelectedTierIndex);
  const updateTier = useProjectStore((s) => s.updateTier);
  const updateItem = useProjectStore((s) => s.updateItem);
  const updateSwimlane = useProjectStore((s) => s.updateSwimlane);
  const addDependency = useProjectStore((s) => s.addDependency);
  const updateDependency = useProjectStore((s) => s.updateDependency);
  const removeDependency = useProjectStore((s) => s.removeDependency);

  // ─── Inline editing state ──────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<EditingField>(null);

  const startEditing = useCallback((itemId: string, field: EditingField extends null ? never : NonNullable<EditingField>['field']) => {
    setEditingField({ itemId, field });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingField(null);
  }, []);

  const commitEdit = useCallback((itemId: string, field: string, value: string) => {
    const item = items.find((i) => i.id === itemId);
    switch (field) {
      case 'title':
        if (item) updateItem(itemId, { name: value });
        break;
      case 'milestoneTitle':
        if (item) updateItem(itemId, { name: value });
        break;
      case 'percentComplete': {
        const pct = parseInt(value.replace('%', ''), 10);
        if (!isNaN(pct) && item) updateItem(itemId, { percentComplete: Math.max(0, Math.min(100, pct)) });
        break;
      }
      case 'duration': {
        if (!item) break;
        const days = parseDurationToDays(value);
        if (days && days > 0) {
          const newEnd = addDays(parseISO(item.startDate), days - 1); // inclusive
          updateItem(itemId, { endDate: format(newEnd, 'yyyy-MM-dd') });
        }
        break;
      }
      case 'swimlaneName': {
        updateSwimlane(itemId, { name: value });
        break;
      }
    }
    setEditingField(null);
  }, [items, updateItem, updateSwimlane]);

  // ─── Date picker popover state ─────────────────────────────────────────────
  const [datePicker, setDatePicker] = useState<{
    itemId: string;
    mode: 'range' | 'single';
    anchorRect: DOMRect;
  } | null>(null);

  const openDatePicker = useCallback((itemId: string, mode: 'range' | 'single', anchorEl: HTMLElement) => {
    setDatePicker({ itemId, mode, anchorRect: anchorEl.getBoundingClientRect() });
  }, []);

  const closeDatePicker = useCallback(() => {
    setDatePicker(null);
  }, []);

  const commitDatePicker = useCallback((startDate: string, endDate: string) => {
    if (datePicker) {
      updateItem(datePicker.itemId, { startDate, endDate });
    }
    setDatePicker(null);
  }, [datePicker, updateItem]);

  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    getExportElement: () => exportRef.current,
  }));
  const [dragState, setDragState] = useState<{ id: string; offset: number } | null>(null);
  const draggingId = dragState?.id ?? null;
  const dragOffset = dragState?.offset ?? 0;
  const dragRef = useRef<{ id: string; startX: number } | null>(null);

  // ─── Hovered item tracking ────────────────────────────────────────────────
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // ─── Dependency drag-to-connect state ─────────────────────────────────────
  const [depDrag, setDepDrag] = useState<{
    sourceId: string;
    sourceSide: 'start' | 'end';
    mouseX: number;
    mouseY: number;
    targetId: string | null;
    targetSide: 'start' | 'end' | null;
  } | null>(null);
  const depDragRef = useRef<{ sourceId: string; sourceSide: 'start' | 'end'; startX: number; startY: number } | null>(null);
  // Keep a ref to the latest depDrag value so onUp always reads fresh data
  const depDragLatestRef = useRef(depDrag);
  depDragLatestRef.current = depDrag;
  // Refs for stable access in dep drag effect (avoids re-running effect on every change)
  const getItemPositionsRef = useRef<typeof getItemPositions>(null!);
  const dependenciesRef = useRef(dependencies);
  dependenciesRef.current = dependencies;
  const addDependencyRef = useRef(addDependency);
  addDependencyRef.current = addDependency;
  const updateDependencyRef = useRef(updateDependency);
  updateDependencyRef.current = updateDependency;

  const selectedDepKey = useProjectStore((s) => s.selectedDepKey);
  const setSelectedDepKey = useProjectStore((s) => s.setSelectedDepKey);

  const sortedSwimlanes = useMemo(
    () => [...swimlanes].sort((a, b) => a.order - b.order),
    [swimlanes]
  );

  const visibleItems = useMemo(() => items.filter((i) => i.visible), [items]);

  // Items NOT in any existing swimlane (independent items)
  const swimlaneIds = useMemo(() => new Set(swimlanes.map((s) => s.id)), [swimlanes]);
  const independentItems = useMemo(
    () => visibleItems.filter((i) => !swimlaneIds.has(i.swimlaneId)),
    [visibleItems, swimlaneIds]
  );
  const swimlanedItems = useMemo(
    () => visibleItems.filter((i) => swimlaneIds.has(i.swimlaneId)),
    [visibleItems, swimlaneIds]
  );

  // Split independent items: "above" milestones go above timescale bar, everything else stays below
  const aboveMilestones = useMemo(
    () => independentItems.filter(
      (i) => i.type === 'milestone' && i.swimlaneId === null && i.milestoneStyle.position === 'above'
    ),
    [independentItems]
  );
  const belowIndependentItems = useMemo(
    () => independentItems.filter(
      (i) => !(i.type === 'milestone' && i.swimlaneId === null && i.milestoneStyle.position === 'above')
    ),
    [independentItems]
  );

  // Compute layout rows based on taskLayout mode
  const getRow = useMemo(() => {
    if (taskLayout === 'single-row') {
      return (item: ProjectItem) => item.row;
    }
    // Build row assignments for packed or one-per-row modes
    const rowMap = new Map<string, number>();

    const assignRows = (groupItems: ProjectItem[]) => {
      const sorted = [...groupItems].sort((a, b) => a.row - b.row || a.startDate.localeCompare(b.startDate));
      if (taskLayout === 'one-per-row') {
        sorted.forEach((it, idx) => rowMap.set(it.id, idx));
      } else {
        // packed: assign to first row where item doesn't overlap
        const rowEnds: number[] = []; // end day per row (exclusive)
        for (const it of sorted) {
          const start = parseISO(it.startDate).getTime();
          const end = parseISO(it.endDate).getTime();
          let placed = false;
          for (let r = 0; r < rowEnds.length; r++) {
            if (start >= rowEnds[r]) {
              rowMap.set(it.id, r);
              rowEnds[r] = end + 1; // +1 to avoid same-day overlap
              placed = true;
              break;
            }
          }
          if (!placed) {
            rowMap.set(it.id, rowEnds.length);
            rowEnds.push(end + 1);
          }
        }
      }
    };

    // Assign rows per group: independent items, then each swimlane
    assignRows(belowIndependentItems);
    for (const sl of sortedSwimlanes) {
      const slItems = swimlanedItems.filter((it) => it.swimlaneId === sl.id);
      assignRows(slItems);
    }

    return (item: ProjectItem) => rowMap.get(item.id) ?? item.row;
  }, [taskLayout, belowIndependentItems, swimlanedItems, sortedSwimlanes]);

  // ─── Per-row layout: cumulative Y positions accounting for per-item spacing ──
  // Spacing = gap below each row. Row height = ROW_BASE + max(spacing of items in row).
  // Builds a map: itemId → { rowY: cumulative Y from group start, rowHeight: full row height }
  const { getRowY, getRowH, getGroupHeight } = useMemo(() => {
    const rowYMap = new Map<string, number>();  // itemId → cumY
    const rowHMap = new Map<string, number>();  // itemId → row total height (ROW_BASE + spacing)

    // For a group of items, compute row Y offsets
    const processGroup = (groupItems: ProjectItem[]): number => {
      if (groupItems.length === 0) return 0;
      // Group items by row index
      const rowItems = new Map<number, ProjectItem[]>();
      for (const it of groupItems) {
        const r = getRow(it);
        if (!rowItems.has(r)) rowItems.set(r, []);
        rowItems.get(r)!.push(it);
      }
      // Sort rows
      const sortedRows = [...rowItems.keys()].sort((a, b) => a - b);
      let cumY = 0;
      for (const r of sortedRows) {
        const items = rowItems.get(r)!;
        // Max spacing in this row
        const maxSpacing = Math.max(...items.map((it) => it.taskStyle.spacing));
        const rowH = ROW_BASE + maxSpacing;
        for (const it of items) {
          rowYMap.set(it.id, cumY);
          rowHMap.set(it.id, rowH);
        }
        cumY += rowH;
      }
      return cumY;
    };

    // Track total height per group key
    const groupHeightMap = new Map<string, number>();
    groupHeightMap.set('__independent__', processGroup(belowIndependentItems));
    for (const sl of sortedSwimlanes) {
      const slItems = swimlanedItems.filter((it) => it.swimlaneId === sl.id);
      groupHeightMap.set(sl.id, processGroup(slItems));
    }

    return {
      getRowY: (item: ProjectItem) => rowYMap.get(item.id) ?? getRow(item) * ROW_HEIGHT,
      getRowH: (item: ProjectItem) => rowHMap.get(item.id) ?? ROW_HEIGHT,
      getGroupHeight: (groupKey: string) => groupHeightMap.get(groupKey) ?? 0,
    };
  }, [getRow, belowIndependentItems, swimlanedItems, sortedSwimlanes]);

  // Compute project range with padding — origin aligned to unit boundaries
  const { origin, totalDays, rangeEndDate } = useMemo(
    () => getProjectRangePadded(items, timescale),
    [items, timescale],
  );

  // Migrate legacy single-tier {unit:'month', format:'MMM'} to unit:'auto' for already-loaded projects
  useEffect(() => {
    if (
      timescale.tiers.length === 1 &&
      timescale.tiers[0].unit === 'month' &&
      timescale.tiers[0].format === 'MMM'
    ) {
      updateTier(0, { unit: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fit zoom to container width on mount
  useEffect(() => {
    if (!containerRef.current || totalDays <= 0) return;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;
    // Reserve space for end cap labels so the bar + caps fit without scrolling
    let reserved = 0;
    if (timescale.leftEndCap?.show) reserved += (timescale.leftEndCap.fontSize ?? 16) * 3 + 12;
    if (timescale.rightEndCap?.show) reserved += (timescale.rightEndCap.fontSize ?? 16) * 3 + 12;
    const available = Math.max(containerWidth - reserved, totalDays * 2);
    const idealZoom = Math.floor(available / totalDays);
    const clamped = Math.max(2, Math.min(30, idealZoom));
    if (clamped !== zoom) setZoom(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDays]);

  const totalWidth = totalDays * zoom;

  // Reserve horizontal space for end cap labels so they don't get clipped
  const leftCapWidth = timescale.leftEndCap?.show ? (timescale.leftEndCap.fontSize ?? 16) * 3 + 12 : 0;
  const rightCapWidth = timescale.rightEndCap?.show ? (timescale.rightEndCap.fontSize ?? 16) * 3 + 12 : 0;

  // Map item to x position
  const itemToX = useCallback(
    (date: string) => differenceInDays(parseISO(date), parseISO(origin)) * zoom,
    [origin, zoom]
  );

  // Today line position
  const todayX = useMemo(() => {
    const today = new Date();
    return differenceInDays(today, parseISO(origin)) * zoom;
  }, [origin, zoom]);
  const todayPos = timescale.todayPosition ?? 'below';

  // ─── Layout computation ────────────────────────────────────────────

  // Height for "above" milestones row (rendered before timescale header)
  // Stack layout: title → date → shape (top to bottom). Account for full stack height.
  const aboveRowGap = 4; // px between stack bottom edge and timescale bar top
  const aboveHeight = useMemo(() => {
    if (aboveMilestones.length === 0) return 0;
    const maxStack = Math.max(...aboveMilestones.map((i) => {
      const s = i.milestoneStyle;
      let h = s.size; // shape
      if (s.showTitle) h += Math.ceil(s.fontSize * 1.25) + 1; // title + gap-px
      if (s.showDate) h += Math.ceil(s.dateFontSize * 1.25) + 1; // date + gap-px
      return h;
    }), 20);
    return maxStack + aboveRowGap * 2;
  }, [aboveMilestones]);

  // Independent items section height (only "below" items — those in the canvas)
  const independentHeight = useMemo(() => {
    if (belowIndependentItems.length === 0) return 0;
    return getGroupHeight('__independent__') + INDEPENDENT_SECTION_PADDING * 2;
  }, [belowIndependentItems, getGroupHeight]);

  // Swimlane layout: compute y offset for each swimlane
  const swimlaneLayout = useMemo(() => {
    let y = independentHeight;
    const layout: { swimlane: Swimlane; y: number; height: number; contentY: number }[] = [];
    for (let i = 0; i < sortedSwimlanes.length; i++) {
      const sl = sortedSwimlanes[i];
      if (i > 0) y += swimlaneSpacing; // gap between bands
      const contentHeight = getGroupHeight(sl.id);
      const height = SWIMLANE_PADDING_TOP + contentHeight + SWIMLANE_PADDING_BOTTOM;
      layout.push({ swimlane: sl, y, height, contentY: y + SWIMLANE_PADDING_TOP });
      y += height;
    }
    return layout;
  }, [sortedSwimlanes, independentHeight, swimlaneSpacing, getGroupHeight]);

  const canvasHeight = (swimlaneLayout.length > 0
    ? swimlaneLayout[swimlaneLayout.length - 1].y + swimlaneLayout[swimlaneLayout.length - 1].height
    : independentHeight) || ROW_HEIGHT * 2;

  // Compute timescale tiers
  const tierLabels = useMemo(() => {
    const rangeStart = parseISO(origin);
    return timescale.tiers
      .map((tier, idx) => ({ tier, storeIndex: idx }))
      .filter(({ tier }) => tier.visible)
      .map(({ tier, storeIndex }) => {
        const resolvedUnit = tier.unit === 'auto' ? resolveAutoUnit(totalDays) : tier.unit;
        const resolvedFormat = tier.unit === 'auto' ? undefined : tier.format;
        return {
          tier: { ...tier, unit: resolvedUnit },
          storeIndex,
          labels: generateTierLabels(resolvedUnit, rangeStart, rangeEndDate, timescale.fiscalYearStartMonth, resolvedFormat),
        };
      });
  }, [origin, totalDays, rangeEndDate, timescale]);

  const timescaleHeight = tierLabels.length * 28;

  // Dependency lines SVG paths — orthogonal routing (right-angle segments only)
  const depPaths = useMemo(() => {
    if (!showDependencies) return [];

    // Helper: get an item's row-top Y in canvas coordinates
    const getItemRowTopY = (item: ProjectItem) => {
      if (item.type === 'milestone' && item.swimlaneId === null && item.milestoneStyle.position === 'above') {
        return 0;
      }
      if (!swimlaneIds.has(item.swimlaneId)) {
        return INDEPENDENT_SECTION_PADDING + getRowY(item);
      }
      const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
      if (!sl) return 0;
      return sl.contentY + getRowY(item);
    };

    // Build obstacle rects for all visible items using actual bar/milestone geometry
    const allObstacles: { id: string; leftX: number; rightX: number; topY: number; bottomY: number }[] = [];
    for (const item of visibleItems) {
      const rowTop = getItemRowTopY(item);
      if (item.type === 'task') {
        const xStart = itemToX(item.startDate);
        const barWidth = differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;
        const barTop = rowTop + (ROW_BASE - item.taskStyle.thickness) / 2;
        const barBottom = barTop + item.taskStyle.thickness;
        allObstacles.push({ id: item.id, leftX: xStart, rightX: xStart + barWidth, topY: barTop, bottomY: barBottom });
      } else {
        const cx = itemToX(item.startDate);
        const sz = item.milestoneStyle.size;
        const barTop = rowTop + (ROW_BASE - sz) / 2;
        const barBottom = barTop + sz;
        allObstacles.push({ id: item.id, leftX: cx - sz / 2, rightX: cx + sz / 2, topY: barTop, bottomY: barBottom });
      }
    }

    return dependencies
      .map((dep) => {
        const from = visibleItems.find((i) => i.id === dep.fromId);
        const to = visibleItems.find((i) => i.id === dep.toId);
        if (!from || !to) return null;
        const isHidden = dep.visible === false;

        const fromRowTop = getItemRowTopY(from);
        const toRowTop = getItemRowTopY(to);
        const fp = dep.fromPoint ?? 'auto';
        const tp = dep.toPoint ?? 'auto';
        const depSides = dependencyTypeToSides(dep.type ?? 'finish-to-start');

        // Compute actual bar/milestone vertical bounds within the row
        const fromBarTop = from.type === 'task'
          ? fromRowTop + (ROW_BASE - from.taskStyle.thickness) / 2
          : fromRowTop + (ROW_BASE - from.milestoneStyle.size) / 2;
        const fromBarBottom = from.type === 'task'
          ? fromBarTop + from.taskStyle.thickness
          : fromBarTop + from.milestoneStyle.size;
        const toBarTop = to.type === 'task'
          ? toRowTop + (ROW_BASE - to.taskStyle.thickness) / 2
          : toRowTop + (ROW_BASE - to.milestoneStyle.size) / 2;
        const toBarBottom = to.type === 'task'
          ? toBarTop + to.taskStyle.thickness
          : toBarTop + to.milestoneStyle.size;

        // Compute from anchor
        let fromX: number;
        let fromY: number;
        if (fp === 'top') {
          fromX = from.type === 'milestone'
            ? itemToX(from.startDate)
            : itemToX(from.startDate) + (differenceInDays(parseISO(from.endDate), parseISO(from.startDate)) * zoom + zoom) / 2;
          fromY = fromBarTop;
        } else if (fp === 'bottom') {
          fromX = from.type === 'milestone'
            ? itemToX(from.startDate)
            : itemToX(from.startDate) + (differenceInDays(parseISO(from.endDate), parseISO(from.startDate)) * zoom + zoom) / 2;
          fromY = fromBarBottom;
        } else {
          fromX = getItemHorizontalAnchor(from, depSides.fromSide, zoom, itemToX);
          fromY = fromRowTop + ROW_BASE / 2;
        }

        const arrowType = dep.arrowType ?? 'standard';
        const arrowSize = dep.arrowSize ?? 4;
        const lineWidth = dep.lineWidth ?? 1.5;

        // Compute to anchor
        let toX: number;
        let toY: number;
        if (tp === 'top') {
          toX = to.type === 'milestone'
            ? itemToX(to.startDate)
            : itemToX(to.startDate) + (differenceInDays(parseISO(to.endDate), parseISO(to.startDate)) * zoom + zoom) / 2;
          toY = toBarTop;
        } else if (tp === 'bottom') {
          toX = to.type === 'milestone'
            ? itemToX(to.startDate)
            : itemToX(to.startDate) + (differenceInDays(parseISO(to.endDate), parseISO(to.startDate)) * zoom + zoom) / 2;
          toY = toBarBottom;
        } else {
          toX = getItemHorizontalAnchor(to, depSides.toSide, zoom, itemToX);
          toY = toRowTop + ROW_BASE / 2;
        }

        // Determine anchor directions for routing
        const fromDir: AnchorDir = (fp === 'top') ? 'top' : (fp === 'bottom') ? 'bottom' : (depSides.fromSide === 'start' ? 'left' : 'right');
        const toDir: AnchorDir = (tp === 'top') ? 'top' : (tp === 'bottom') ? 'bottom' : (depSides.toSide === 'start' ? 'left' : 'right');
        const isCritical = showCriticalPath && from.isCriticalPath && to.isCriticalPath;

        // Pass all obstacles + source/target object rects to the router
        // IMPORTANT: startObj/endObj must be references INTO allObjRects (same objects)
        // so that identity comparison (===) works in validGlueExit.
        const startObsIdx = allObstacles.findIndex((o) => o.id === from.id);
        const endObsIdx = allObstacles.findIndex((o) => o.id === to.id);
        if (startObsIdx < 0 || endObsIdx < 0) return null;
        const allObjRects: ObstacleRect[] = allObstacles.map(({ leftX, rightX, topY, bottomY }) => ({ leftX, rightX, topY, bottomY }));
        const startObjRect = allObjRects[startObsIdx];
        const endObjRect = allObjRects[endObsIdx];
        const visualClearance = dependencyArrowVisualClearance(lineWidth, arrowSize);
        const endInset = dependencyArrowEndInset(arrowType, arrowSize, lineWidth, toDir);
        const path = routeDepLink(fromX, fromY, toX, toY, allObjRects, startObjRect, endObjRect, fromDir, toDir, visualClearance, endInset);

        return {
          path,
          isCritical,
          isHidden,
          key: `${dep.fromId}-${dep.toId}`,
          fromId: dep.fromId,
          toId: dep.toId,
          color: dep.color,
          transparency: dep.transparency,
          arrowType,
          arrowSize,
          lineDash: dep.lineDash,
          lineWidth,
          targetX: toX,
          targetY: toY,
        };
      })
      .filter(Boolean);
  }, [showDependencies, dependencies, visibleItems, swimlaneLayout, swimlaneIds, itemToX, showCriticalPath, getRowY, getRowH, zoom]);

  // Vertical connector lines (two dashed lines per task, start edge + end edge, going up to timescale)
  const verticalConnectors = useMemo(() => {
    const lines: { x: number; y1: number; y2: number; color: string; thickness: number; key: string }[] = [];

    const getItemY = (item: ProjectItem) => {
      if (!swimlaneIds.has(item.swimlaneId)) {
        return INDEPENDENT_SECTION_PADDING + getRowY(item);
      }
      const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
      if (!sl) return 0;
      return sl.contentY + getRowY(item);
    };

    for (const item of visibleItems) {
      if (item.type !== 'task') continue;
      const style = item.taskStyle;
      if (!style.showVerticalConnector) continue;

      const startX = itemToX(item.startDate);
      const barWidth = differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;
      const endX = startX + barWidth;
      const barY = getItemY(item) + (ROW_BASE - style.thickness) / 2;
      const strokeWidth = CONNECTOR_THICKNESS_MAP[style.connectorThickness] ?? 1;

      // Left edge line: from bar top up to y=0
      lines.push({
        x: startX,
        y1: 0,
        y2: barY,
        color: style.connectorColor,
        thickness: strokeWidth,
        key: `${item.id}-start`,
      });

      // Right edge line: from bar top up to y=0
      lines.push({
        x: endX,
        y1: 0,
        y2: barY,
        color: style.connectorColor,
        thickness: strokeWidth,
        key: `${item.id}-end`,
      });
    }

    return lines;
  }, [visibleItems, swimlaneIds, swimlaneLayout, itemToX, zoom, getRowY, getRowH]);

  // ─── Drag handlers ─────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = { id: itemId, startX: e.clientX };
      setDragState({ id: itemId, offset: 0 });
    },
    []
  );

  // Attach mousemove/mouseup to window so drag works even outside the container
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setDragState({ id: dragRef.current.id, offset: e.clientX - dragRef.current.startX });
    };
    const onUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const offset = e.clientX - dragRef.current.startX;
      const daysDelta = Math.round(offset / zoom);
      const itemId = dragRef.current.id;
      dragRef.current = null;
      // Clear drag state synchronously BEFORE moveItem.
      // This works because the CSS transition on translateX has been removed,
      // so the bar won't animate back. Zustand + React batch in the same tick:
      // bar goes from (oldX + snappedOffset) to (newX + 0) = same pixel position.
      setDragState(null);
      if (daysDelta !== 0) {
        moveItem(itemId, daysDelta);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingId, zoom, moveItem]);

  const handleDropOnSwimlane = useCallback(
    (swimlaneId: string, e: React.DragEvent) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if (itemId) {
        moveItemToSwimlane(itemId, swimlaneId);
      }
    },
    [moveItemToSwimlane]
  );

  // ─── Dependency drag-to-connect handlers ──────────────────────────
  // Helper: compute item center positions for hit-testing during dep drag
  const getItemPositions = useCallback(() => {
    const positions: { id: string; type: string; leftX: number; rightX: number; centerY: number; barHeight: number }[] = [];

    const getItemYBase = (item: ProjectItem) => {
      if (item.type === 'milestone' && item.swimlaneId === null && item.milestoneStyle.position === 'above') {
        return 0;
      }
      if (!swimlaneIds.has(item.swimlaneId)) {
        return INDEPENDENT_SECTION_PADDING + getRowY(item);
      }
      const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
      if (!sl) return 0;
      return sl.contentY + getRowY(item);
    };

    for (const item of visibleItems) {
      const yBase = getItemYBase(item);
      const rowH = getRowH(item);
      if (item.type === 'task') {
        const xStart = itemToX(item.startDate);
        const barWidth = differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;
        const bh = item.taskStyle.thickness;
        const barY = yBase + (ROW_BASE - bh) / 2;
        positions.push({
          id: item.id,
          type: 'task',
          leftX: xStart,
          rightX: xStart + barWidth,
          centerY: barY + bh / 2,
          barHeight: bh,
        });
      } else {
        const cx = itemToX(item.startDate);
        const sz = item.milestoneStyle.size;
        positions.push({
          id: item.id,
          type: 'milestone',
          leftX: cx - sz / 2,
          rightX: cx + sz / 2,
          centerY: yBase + ROW_BASE / 2,
          barHeight: sz,
        });
      }
    }
    return positions;
  }, [visibleItems, swimlaneIds, swimlaneLayout, getRowY, getRowH, itemToX, zoom]);
  getItemPositionsRef.current = getItemPositions;

  const handleDepHandleMouseDown = useCallback(
    (sourceId: string, sourceSide: 'start' | 'end', e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      depDragRef.current = { sourceId, sourceSide, startX: mouseX, startY: mouseY };
      setDepDrag({ sourceId, sourceSide, mouseX, mouseY, targetId: null, targetSide: null });
    },
    []
  );

  // Dep drag mousemove/mouseup
  const depDragActive = !!depDrag;
  useEffect(() => {
    if (!depDragActive) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    let lastClientX = -1;
    let lastClientY = -1;

    const onMove = (e: MouseEvent) => {
      if (!depDragRef.current) return;
      // Skip if raw client coords haven't changed (avoids re-render from synthetic mousemove)
      if (e.clientX === lastClientX && e.clientY === lastClientY) return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Hit-test: check if mouse is over any bar's bounding box (using ORIGINAL positions)
      const positions = getItemPositionsRef.current();
      const HIT_PAD = 4; // small padding around bar for easier targeting
      let bestId: string | null = null;
      let bestSide: 'start' | 'end' | null = null;
      for (const pos of positions) {
        if (pos.id === depDragRef.current.sourceId) continue;
        const inX = mouseX >= pos.leftX - HIT_PAD && mouseX <= pos.rightX + HIT_PAD;
        const inY = mouseY >= pos.centerY - pos.barHeight / 2 - HIT_PAD && mouseY <= pos.centerY + pos.barHeight / 2 + HIT_PAD;
        if (inX && inY) {
          bestId = pos.id;
          bestSide = mouseX <= (pos.leftX + pos.rightX) / 2 ? 'start' : 'end';
          break;
        }
      }

      setDepDrag({
        sourceId: depDragRef.current.sourceId,
        sourceSide: depDragRef.current.sourceSide,
        mouseX,
        mouseY,
        targetId: bestId,
        targetSide: bestSide,
      });
    };

    const onUp = () => {
      if (!depDragRef.current) return;
      // Read from the ref to avoid stale closure issues
      const currentDrag = depDragLatestRef.current;
      depDragRef.current = null;
      setDepDrag(null);

      if (currentDrag?.targetId && currentDrag.targetId !== currentDrag.sourceId) {
        const targetSide = currentDrag.targetSide ?? 'start';
        const dependencyType = dependencySidesToType(currentDrag.sourceSide, targetSide);
        const fromId = currentDrag.sourceId;
        const toId = currentDrag.targetId;

        // Check if dependency already exists
        const deps = dependenciesRef.current;
        const existing = deps.find((d) => d.fromId === fromId && d.toId === toId);
        if (existing) {
          if (existing.type !== dependencyType) {
            updateDependencyRef.current(fromId, toId, { type: dependencyType, forceSchedule: true });
          }
        } else {
          addDependencyRef.current(fromId, toId, { type: dependencyType, forceSchedule: true });
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [depDragActive]);

  // ─── Keyboard: Delete/Backspace selected dep, Escape to deselect ──────────
  useEffect(() => {
    if (!selectedDepKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDepKey(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Find the dep by key to get fromId/toId
        const dep = depPaths.find((d) => d && d.key === selectedDepKey);
        if (dep) {
          removeDependency(dep.fromId, dep.toId);
        }
        setSelectedDepKey(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDepKey, removeDependency, depPaths]);

  // ─── Render helpers ────────────────────────────────────────────────

  const belowMilestoneGap = 4; // px between timescale bar bottom edge and milestone top edge

  // Drag guide: compute snapped position and new dates
  const dragGuide = useMemo(() => {
    if (!draggingId || dragOffset === 0) return null;
    const item = items.find((i) => i.id === draggingId);
    if (!item) return null;
    const daysDelta = Math.round(dragOffset / zoom);
    if (daysDelta === 0) return null;
    const snappedOffsetPx = daysDelta * zoom;
    const newStart = addDays(parseISO(item.startDate), daysDelta);
    const newEnd = addDays(parseISO(item.endDate), daysDelta);
    return { item, daysDelta, snappedOffsetPx, newStart, newEnd };
  }, [draggingId, dragOffset, zoom, items]);

  // ─── Dependency drag preview: compute where the target would move ────────
  const depDragPreview = useMemo<{ targetId: string; offsetPx: number } | null>(() => {
    if (!depDrag?.targetId) return null;
    const dependencyType = dependencySidesToType(depDrag.sourceSide, depDrag.targetSide ?? 'start');
    const fromId = depDrag.sourceId;
    const toId = depDrag.targetId;
    const predecessor = visibleItems.find((i) => i.id === fromId);
    const successor = visibleItems.find((i) => i.id === toId);
    if (!predecessor || !successor) return null;
    const daysDelta = getDependencyPreviewOffset(dependencyType, predecessor, successor);
    if (daysDelta <= 0) return null; // Already at or after constraint — no move needed
    return { targetId: toId, offsetPx: daysDelta * zoom };
  }, [depDrag, visibleItems, zoom]);

  const renderItem = (item: ProjectItem, yBase: number) => {
    const x = itemToX(item.startDate);
    const y = yBase + getRowY(item);
    const isDragging = draggingId === item.id;
    // Snap to day grid during drag so the bar doesn't jump on drop
    let translateX = isDragging ? Math.round(dragOffset / zoom) * zoom : 0;
    // Apply dependency drag preview offset
    if (depDragPreview && item.id === depDragPreview.targetId) {
      translateX += depDragPreview.offsetPx;
    }
    const isSelected = selectedItemId === item.id;
    const isHovered = hoveredItemId === item.id;
    const isDepDragTarget = depDrag?.targetId === item.id;
    const depDragTargetSide = isDepDragTarget ? depDrag?.targetSide ?? null : null;

    if (item.type === 'milestone') {
      // For "below" independent milestones, place icon tight against the timescale bar
      const isBelow = item.swimlaneId === null && item.milestoneStyle.position === 'below';
      const belowOverride = isBelow ? belowMilestoneGap : undefined;
      return (
        <MilestoneItem
          key={item.id}
          item={item}
          x={x}
          y={y}
          rowHeight={getRowH(item)}
          iconTopOverride={belowOverride}
          translateX={translateX}
          isSelected={isSelected}
          isDragging={isDragging}
          isHovered={isHovered}
          onMouseDown={(e) => handleMouseDown(e, item.id)}
          onClickIcon={() => { setSelectedItem(item.id); setStylePaneSection('milestoneShape'); }}
          onClickLabel={() => { setSelectedItem(item.id); setStylePaneSection('milestoneTitle'); }}
          onClickDate={() => { setSelectedItem(item.id); setStylePaneSection('milestoneDate'); }}
          editingField={editingField}
          onStartEdit={(field) => startEditing(item.id, field)}
          onCommitEdit={(field, value) => commitEdit(item.id, field, value)}
          onCancelEdit={cancelEditing}
          onOpenDatePicker={(el) => openDatePicker(item.id, 'single', el)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
          onHandleMouseDown={(side, e) => handleDepHandleMouseDown(item.id, side, e)}
          isDepDragTarget={isDepDragTarget}
          depDragTargetSide={depDragTargetSide}
        />
      );
    }

    const width = differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;

    return (
      <TaskBar
        key={item.id}
        item={item}
        x={x}
        y={y}
        rowHeight={getRowH(item)}
        width={width}
        translateX={translateX}
        isSelected={isSelected}
        isDragging={isDragging}
        isHovered={isHovered}
        onMouseDown={(e) => handleMouseDown(e, item.id)}
        onClickBar={() => { setSelectedItem(item.id); setStylePaneSection('bar'); }}
        onClickSection={(section) => { setSelectedItem(item.id); setStylePaneSection(section); }}
        editingField={editingField}
        onStartEdit={(field) => startEditing(item.id, field)}
        onCommitEdit={(field, value) => commitEdit(item.id, field, value)}
        onCancelEdit={cancelEditing}
        onOpenDatePicker={(el) => openDatePicker(item.id, 'range', el)}
        onMouseEnter={() => setHoveredItemId(item.id)}
        onMouseLeave={() => setHoveredItemId(null)}
        onHandleMouseDown={(side, e) => handleDepHandleMouseDown(item.id, side, e)}
        isDepDragTarget={isDepDragTarget}
        depDragTargetSide={depDragTargetSide}
      />
    );
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* ─── Card container ─── */}
      <div className="flex-1 mx-3 mb-3 rounded border border-[var(--color-border)] bg-white overflow-hidden flex flex-col">
      {/* ─── Scrollable timeline content ─── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto scrollbar-thin relative"
        onClick={() => {
          setSelectedItem(null);
          setSelectedSwimlane(null);
          setSelectedTierIndex(null);
          setStylePaneSection(null);
          setSelectedDepKey(null);
        }}
      >
        <div style={{
          width: totalWidth + leftCapWidth + rightCapWidth,
          margin: '12px auto 0',
        }}>
        <div ref={exportRef} style={{
          width: totalWidth,
          position: 'relative',
          marginLeft: leftCapWidth,
          marginRight: rightCapWidth,
        }}>
          {/* ─── "Above" milestones row (before sticky timescale header) ─── */}
          {aboveHeight > 0 && (
            <div className="relative" style={{ height: aboveHeight }}>
              {aboveMilestones.map((item) => {
                const ax = itemToX(item.startDate);
                // Position whole stack so its bottom edge is aboveRowGap from the row bottom (timescale bar top)
                const s = item.milestoneStyle;
                let stackH = s.size;
                if (s.showTitle) stackH += Math.ceil(s.fontSize * 1.25) + 1;
                if (s.showDate) stackH += Math.ceil(s.dateFontSize * 1.25) + 1;
                const ay = aboveHeight - stackH - aboveRowGap;
                const isDraggingItem = draggingId === item.id;
                let txl = isDraggingItem ? Math.round(dragOffset / zoom) * zoom : 0;
                if (depDragPreview && item.id === depDragPreview.targetId) txl += depDragPreview.offsetPx;
                const isSel = selectedItemId === item.id;
                return (
                  <MilestoneItem
                    key={item.id}
                    item={item}
                    x={ax}
                    y={0}
                    rowHeight={ROW_HEIGHT}
                    iconTopOverride={ay}
                    translateX={txl}
                    isSelected={isSel}
                    isDragging={isDraggingItem}
                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                    onClickIcon={() => { setSelectedItem(item.id); setStylePaneSection('milestoneShape'); }}
                    onClickLabel={() => { setSelectedItem(item.id); setStylePaneSection('milestoneTitle'); }}
                    onClickDate={() => { setSelectedItem(item.id); setStylePaneSection('milestoneDate'); }}
                    editingField={editingField}
                    onStartEdit={(field) => startEditing(item.id, field)}
                    onCommitEdit={(field, value) => commitEdit(item.id, field, value)}
                    onCancelEdit={cancelEditing}
                    onOpenDatePicker={(el) => openDatePicker(item.id, 'single', el)}
                  />
                );
              })}
            </div>
          )}

           {/* Timescale Headers */}
           <div className="sticky top-0 z-10 relative" style={timescale.showToday ? (todayPos === 'below' ? { marginBottom: 22 } : { marginTop: 22 }) : undefined}>
              {/* Left end cap — positioned outside the timescale bar */}
              {timescale.leftEndCap?.show && (
                <div
                  className="absolute whitespace-nowrap"
                  style={{
                    right: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    paddingRight: 8,
                    color: timescale.leftEndCap.fontColor,
                    fontFamily: timescale.leftEndCap.fontFamily,
                    fontSize: timescale.leftEndCap.fontSize,
                    fontWeight: timescale.leftEndCap.fontWeight,
                    fontStyle: timescale.leftEndCap.fontStyle,
                    textDecoration: timescale.leftEndCap.textDecoration,
                  }}
                >
                  {format(parseISO(origin), 'yyyy')}
                </div>
              )}

              <div className="relative">
                <div className="border-b border-[var(--color-border)] overflow-hidden relative" style={getTimescaleBarShapeStyle(timescale.barShape)}>
                  {tierLabels.map(({ tier, storeIndex, labels }, tierIdx) => {
                    const originDate = parseISO(origin);
                    const cells = buildVisibleTierCells(labels, tier.unit, originDate, totalDays, totalWidth);
                    const isSelected = selectedTierIndex === storeIndex;

                    // Compute cell width in px — use the widest interior cell (first cell may be partial/degenerate)
                    let representativeFrac = 0;
                    for (const cell of cells) {
                      if (cell.widthFrac > representativeFrac) representativeFrac = cell.widthFrac;
                    }
                    const cellWidthPx = representativeFrac * totalWidth;

                    // Auto font sizing: pick optimal size to fit the longest label (first cell with prefix)
                    const effectiveFontSize = (tier.fontSizeAuto ?? true)
                      ? computeAutoFontSize(cells, tier.fontFamily, tier.fontWeight, tier.fontStyle, cellWidthPx, 12)
                      : tier.fontSize;

                    return (
                      <div
                        key={tierIdx}
                        className={`flex h-7 relative cursor-pointer transition-shadow hover:outline hover:outline-1 hover:outline-red-400 ${isSelected ? 'ring-2 ring-inset ring-white/40' : ''}`}
                        style={{ backgroundColor: tier.backgroundColor }}
                        onClick={(e) => { e.stopPropagation(); setSelectedTierIndex(storeIndex); setStylePaneSection('scale'); }}
                      >
                        {cells.map((cell, ci) => (
                          <div
                            key={ci}
                            className={`flex items-center shrink-0 ${tier.separators && ci > 0 ? 'border-l border-white/20' : ''}`}
                            style={{
                              position: 'absolute',
                              left: cell.fraction * totalWidth,
                              width: cell.widthFrac * totalWidth,
                              height: 28,
                              color: tier.fontColor,
                              fontSize: effectiveFontSize,
                              fontFamily: tier.fontFamily,
                              fontWeight: tier.fontWeight,
                              fontStyle: tier.fontStyle,
                              textDecoration: tier.textDecoration,
                              justifyContent: 'flex-start',
                              paddingLeft: ci === 0 ? 8 : 4,
                              paddingRight: ci === cells.length - 1 ? 8 : 4,
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap' }}>{cell.label}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Elapsed time bar — colored strip from left to today */}
                  {(timescale.showElapsedTime ?? false) && todayX > 0 && (
                    <div
                      className="absolute left-0 pointer-events-none z-10"
                      style={{
                        width: Math.min(todayX, totalWidth),
                        height: (timescale.elapsedTimeThickness ?? 'thin') === 'thick' ? 6 : 3,
                        backgroundColor: timescale.elapsedTimeColor ?? '#ef4444',
                        ...(todayPos === 'above' ? { top: 0 } : { bottom: 0 }),
                      }}
                    />
                  )}
                </div>

                {/* Today label — positioned relative to timescale bar */}
                {timescale.showToday && todayX >= 0 && todayX <= totalWidth && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{
                      left: todayX,
                      transform: 'translateX(-50%)',
                      ...(todayPos === 'above'
                        ? { bottom: '100%' }
                        : { top: '100%' }
                      ),
                    }}
                  >
                    <div className="flex flex-col items-center">
                      {todayPos === 'below' && (
                        <svg width="10" height="6" viewBox="0 0 10 6">
                          <path d="M5 0L0 6h10L5 0z" fill={timescale.todayColor} />
                        </svg>
                      )}
                      <div className="border border-[var(--color-border)] bg-white rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text)] whitespace-nowrap leading-tight">
                        Today
                      </div>
                      {todayPos === 'above' && (
                        <svg width="10" height="6" viewBox="0 0 10 6">
                          <path d="M5 6L0 0h10L5 6z" fill={timescale.todayColor} />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right end cap — positioned outside the timescale bar */}
              {timescale.rightEndCap?.show && (
                <div
                  className="absolute whitespace-nowrap"
                  style={{
                    left: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    paddingLeft: 8,
                    color: timescale.rightEndCap.fontColor,
                    fontFamily: timescale.rightEndCap.fontFamily,
                    fontSize: timescale.rightEndCap.fontSize,
                    fontWeight: timescale.rightEndCap.fontWeight,
                    fontStyle: timescale.rightEndCap.fontStyle,
                    textDecoration: timescale.rightEndCap.textDecoration,
                  }}
                >
                  {format(rangeEndDate, 'yyyy')}
                </div>
              )}
           </div>

          {/* ─── Canvas: grid, swimlane bands, items ─── */}
          <div ref={canvasRef} className="relative" style={{ height: canvasHeight }}>


            {/* ─── Swimlane bands (bg + colored badge) ─── */}
            {swimlaneLayout.map(({ swimlane, y, height }) => {
              const outlinePx = OUTLINE_THICKNESS_MAP[swimlane.outlineThickness];
              return (
                <div
                  key={swimlane.id}
                  className="absolute left-0 right-0"
                  style={{
                    top: y,
                    height,
                    ...(outlinePx > 0 ? {
                      border: `${outlinePx}px solid ${swimlane.outlineColor}`,
                      borderRadius: 4,
                    } : undefined),
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSwimlane(swimlane.id, e)}
                >
                  {/* Body background band */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: swimlane.bodyColor,
                      opacity: (100 - swimlane.bodyTransparency) / 100,
                    }}
                  />

                  {/* Colored swimlane badge on left edge */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 flex items-center justify-center rounded-r-md tracking-wide z-[6] cursor-pointer transition-shadow hover:outline hover:outline-1 hover:outline-red-400 ${
                      selectedSwimlaneId === swimlane.id ? 'ring-2 ring-offset-1 ring-slate-700' : ''
                    }`}
                    style={{
                      width: SWIMLANE_BADGE_WIDTH,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSwimlane(swimlane.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(swimlane.id, 'swimlaneName');
                    }}
                  >
                    {/* Badge background (separate layer so text is not affected by transparency) */}
                    <div
                      className="absolute inset-0 rounded-r-md"
                      style={{
                        backgroundColor: swimlane.headerColor,
                        opacity: (100 - swimlane.headerTransparency) / 100,
                      }}
                    />
                    {editingField?.itemId === swimlane.id && editingField?.field === 'swimlaneName' ? (
                      <InlineEditInput
                        value={swimlane.name}
                        onCommit={(v) => commitEdit(swimlane.id, 'swimlaneName', v)}
                        onCancel={cancelEditing}
                        style={{
                          color: swimlane.titleFontColor,
                          fontSize: swimlane.titleFontSize,
                          fontFamily: swimlane.titleFontFamily,
                          fontWeight: swimlane.titleFontWeight,
                          width: SWIMLANE_BADGE_WIDTH - 16,
                          position: 'relative',
                          zIndex: 1,
                        }}
                      />
                    ) : (
                      <span
                        className="truncate px-2 relative"
                        style={{
                          color: swimlane.titleFontColor,
                          fontSize: swimlane.titleFontSize,
                          fontFamily: swimlane.titleFontFamily,
                          fontWeight: swimlane.titleFontWeight,
                          fontStyle: swimlane.titleFontStyle,
                          textDecoration: swimlane.titleTextDecoration,
                        }}
                      >
                        {swimlane.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dependency Lines (SVG) */}
            <svg
              className="absolute top-0 left-0 pointer-events-none z-[5]"
              width={totalWidth}
              height={canvasHeight}
            >
              <defs />
              {/* Vertical connector lines */}
              {verticalConnectors.map((c) => (
                <line
                  key={c.key}
                  x1={c.x}
                  y1={c.y1}
                  x2={c.x}
                  y2={c.y2}
                  stroke={c.color}
                  strokeWidth={c.thickness}
                  strokeDasharray="4 3"
                />
              ))}
              {/* Dependency lines — orthogonal paths with click-to-select */}
              {depPaths.map(
                (dep) => {
                  if (!dep) return null;
                  const isDepSelected = selectedDepKey === dep.key;
                  const baseColor = dep.color ?? DEFAULT_DEPENDENCY_COLOR;
                  const alpha = dependencyStrokeOpacity(dep.transparency);
                  const stroke = dep.isHidden
                    ? '#94a3b8'
                    : dep.isCritical
                      ? '#ef4444'
                      : baseColor;
                  const arrowType = dep.arrowType ?? 'standard';
                  const strokeOpacity = alpha;
                  const strokeWidth = dep.lineWidth ?? (dep.isCritical ? 2 : 1.5);
                  const dasharray = dep.isHidden ? '4 3' : DEPENDENCY_DASH_MAP[dep.lineDash ?? 'solid'];
                  const renderGeometry = buildDependencyRenderGeometry(dep.path, arrowType, dep.arrowSize, strokeWidth);
                  const linePath = renderGeometry.linePath;
                  return (
                    <g key={dep.key} opacity={dep.isHidden && !isDepSelected ? 0.4 : 1}>
                      {/* Invisible fat hit area for clicking */}
                      <path
                        d={linePath}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDepKey(dep.key);
                        }}
                      />
                      {isDepSelected && (
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#3b82f6"
                          strokeOpacity={0.28}
                          strokeWidth={strokeWidth + 4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {/* Visible path */}
                      <path
                        d={linePath}
                        fill="none"
                        stroke={stroke}
                        strokeOpacity={strokeOpacity}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dasharray}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                }
              )}
              {/* Temporary dependency drag line */}
              {depDrag && (() => {
                const TEMP_OFFSET = 12;
                const positions = getItemPositions();
                const sourcePos = positions.find((p) => p.id === depDrag.sourceId);
                if (!sourcePos) return null;
                const fromX = depDrag.sourceSide === 'end' ? sourcePos.rightX : sourcePos.leftX;
                const fromY = sourcePos.centerY;

                // If locked onto a target, route to its (possibly previewed) left edge
                let endX: number;
                let endY: number;
                let showArrow = false;
                if (depDrag.targetId) {
                  const targetPos = positions.find((p) => p.id === depDrag.targetId);
                  if (targetPos) {
                    const previewOff = depDragPreview?.targetId === depDrag.targetId ? depDragPreview.offsetPx : 0;
                    endX = (depDrag.targetSide === 'end' ? targetPos.rightX : targetPos.leftX) + previewOff;
                    endY = targetPos.centerY;
                    showArrow = true;
                  } else {
                    endX = depDrag.mouseX;
                    endY = depDrag.mouseY;
                  }
                } else {
                  endX = depDrag.mouseX;
                  endY = depDrag.mouseY;
                }

                let path: string;
                if (showArrow) {
                  // Locked on target — use obstacle-avoidance routing
                  // IMPORTANT: sourceObjRect/targetObjRect must be references INTO allObjRects
                  const sourceIdx = positions.findIndex((p) => p.id === depDrag.sourceId);
                  const targetIdx = positions.findIndex((p) => p.id === depDrag.targetId);
                  const allObjRects: ObstacleRect[] = positions
                    .map((p) => ({ leftX: p.leftX, rightX: p.rightX, topY: p.centerY - p.barHeight / 2, bottomY: p.centerY + p.barHeight / 2 }));
                  const sourceObjRect = allObjRects[sourceIdx >= 0 ? sourceIdx : 0];
                  const targetObjRect = allObjRects[targetIdx >= 0 ? targetIdx : 0];
                  const fromDir: AnchorDir = depDrag.sourceSide === 'start' ? 'left' : 'right';
                  const toDir: AnchorDir = depDrag.targetSide === 'end' ? 'right' : 'left';
                  path = routeDepLink(fromX, fromY, endX, endY, allObjRects, sourceObjRect, targetObjRect, fromDir, toDir, dependencyArrowVisualClearance(1.5, 4), dependencyArrowEndInset('standard', 4, 1.5, toDir));
                } else {
                  // Free-dragging — simple orthogonal routing
                  const gap = endX - fromX;
                  if (gap >= TEMP_OFFSET) {
                    if (fromY === endY) {
                      path = `M ${fromX} ${fromY} L ${endX} ${endY}`;
                    } else {
                      const turnX = fromX + TEMP_OFFSET;
                      path = `M ${fromX} ${fromY} L ${turnX} ${fromY} L ${turnX} ${endY} L ${endX} ${endY}`;
                    }
                  } else {
                    const exitX = fromX + TEMP_OFFSET;
                    const enterX = endX - TEMP_OFFSET;
                    const midY = fromY === endY ? fromY + ROW_BASE / 2 : (fromY + endY) / 2;
                    path = `M ${fromX} ${fromY} L ${exitX} ${fromY} L ${exitX} ${midY} L ${enterX} ${midY} L ${enterX} ${endY} L ${endX} ${endY}`;
                  }
                }

                return (
                  <path
                    d={path}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={1.5}
                    strokeDasharray={showArrow ? undefined : '6 3'}
                    markerEnd={showArrow ? 'url(#arrowhead)' : undefined}
                    opacity={showArrow ? 0.8 : 0.6}
                  />
                );
              })()}
            </svg>

            {/* Dependency arrowheads above items */}
            <svg
              className="absolute top-0 left-0 pointer-events-none z-[45]"
              width={totalWidth}
              height={canvasHeight}
            >
              {depPaths.map((dep) => {
                if (!dep) return null;
                const isDepSelected = selectedDepKey === dep.key;
                const baseColor = dep.color ?? DEFAULT_DEPENDENCY_COLOR;
                const alpha = dependencyStrokeOpacity(dep.transparency);
                const stroke = dep.isHidden
                  ? '#94a3b8'
                  : dep.isCritical
                    ? '#ef4444'
                    : baseColor;
                const arrowType = dep.arrowType ?? 'standard';
                const strokeOpacity = alpha;
                const strokeWidth = dep.lineWidth ?? (dep.isCritical ? 2 : 1.5);
                const renderGeometry = buildDependencyRenderGeometry(dep.path, arrowType, dep.arrowSize, strokeWidth);
                if (!renderGeometry.head) return null;
                return (
                  <g key={`${dep.key}-head`} opacity={dep.isHidden && !isDepSelected ? 0.4 : 1}>
                    {renderDependencyHead(renderGeometry.head, stroke, strokeOpacity, strokeWidth, isDepSelected)}
                  </g>
                );
              })}
            </svg>

            {/* ─── Render independent items (below timescale only) ─── */}
            {belowIndependentItems.map((item) =>
              renderItem(item, INDEPENDENT_SECTION_PADDING)
            )}

            {/* ─── Render swimlaned items ─── */}
            {swimlanedItems.map((item) => {
              const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
              if (!sl) return null;
              return renderItem(item, sl.contentY);
            })}

            {/* ─── Drag guide (ghost + dashed outline + vertical guidelines + date tooltip) ─── */}
            {dragGuide && (() => {
              const { item, snappedOffsetPx, newStart, newEnd } = dragGuide;
              const gx = itemToX(item.startDate);
              // Find yBase
              let yBase = INDEPENDENT_SECTION_PADDING;
              if (item.swimlaneId && swimlaneIds.has(item.swimlaneId)) {
                const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
                if (sl) yBase = sl.contentY;
              }

              if (item.type === 'milestone') {
                const iconSize = item.milestoneStyle.size;
                const cx = gx + snappedOffsetPx;
                const origCx = gx;
                const cy = yBase + getRowY(item) + (getRowH(item) - iconSize) / 2;
                return (
                  <>
                    {/* Ghost at original position */}
                    <div
                      style={{
                        position: 'absolute',
                        left: origCx - iconSize / 2,
                        top: cy,
                        width: iconSize,
                        height: iconSize,
                        opacity: 0.25,
                        zIndex: 35,
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', backgroundColor: item.milestoneStyle.color, transform: 'rotate(45deg)' }} />
                    </div>
                    {/* Vertical guideline at snap position */}
                    <div
                      style={{
                        position: 'absolute',
                        left: cx,
                        top: 0,
                        width: 0,
                        height: canvasHeight,
                        borderLeft: '1px dashed #94a3b8',
                        zIndex: 38,
                        pointerEvents: 'none',
                      }}
                    />
                    {/* Dashed outline at snap position */}
                    <div
                      style={{
                        position: 'absolute',
                        left: cx - iconSize / 2,
                        top: cy,
                        width: iconSize,
                        height: iconSize,
                        zIndex: 40,
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', border: `2px dashed ${item.milestoneStyle.color}`, transform: 'rotate(45deg)' }} />
                    </div>
                    {/* Date tooltip */}
                    <div
                      style={{
                        position: 'absolute',
                        left: cx,
                        top: cy + iconSize + 6,
                        transform: 'translateX(-50%)',
                        backgroundColor: '#334155',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        zIndex: 40,
                        pointerEvents: 'none',
                      }}
                    >
                      {format(newStart, 'EEE, MMM d, yyyy')}
                    </div>
                  </>
                );
              }

              const barHeight = item.taskStyle.thickness;
              const width = Math.max(differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom, 8);
              const gy = yBase + getRowY(item) + (getRowH(item) - barHeight) / 2;
              const snapLeft = gx + snappedOffsetPx;
              const snapRight = snapLeft + width;
              return (
                <>
                  {/* Ghost bar at original position */}
                  <div
                    style={{
                      position: 'absolute',
                      left: gx,
                      top: gy,
                      width,
                      height: barHeight,
                      backgroundColor: item.taskStyle.color,
                      borderRadius: 4,
                      opacity: 0.2,
                      zIndex: 35,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Vertical guideline at snap start */}
                  <div
                    style={{
                      position: 'absolute',
                      left: snapLeft,
                      top: 0,
                      width: 0,
                      height: canvasHeight,
                      borderLeft: '1px dashed #94a3b8',
                      zIndex: 38,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Vertical guideline at snap end */}
                  <div
                    style={{
                      position: 'absolute',
                      left: snapRight,
                      top: 0,
                      width: 0,
                      height: canvasHeight,
                      borderLeft: '1px dashed #94a3b8',
                      zIndex: 38,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Dashed outline at snap position */}
                  <div
                    style={{
                      position: 'absolute',
                      left: snapLeft,
                      top: gy,
                      width,
                      height: barHeight,
                      border: `2px dashed ${item.taskStyle.color}`,
                      borderRadius: 4,
                      zIndex: 40,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Date tooltip */}
                  <div
                    style={{
                      position: 'absolute',
                      left: snapLeft + width / 2,
                      top: gy + barHeight + 6,
                      transform: 'translateX(-50%)',
                      backgroundColor: '#334155',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      zIndex: 40,
                      pointerEvents: 'none',
                    }}
                  >
                    {format(newStart, 'EEE, MMM d, yyyy')}
                    <span style={{ margin: '0 6px', opacity: 0.5 }}>&mdash;</span>
                    {format(newEnd, 'EEE, MMM d, yyyy')}
                  </div>
                </>
              );
            })()}
           </div>
         </div>
         </div>
       </div>

      {/* ─── Zoom controls (bottom-right overlay) ─── */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 border border-[var(--color-border)] rounded-lg px-2 py-1 shadow-sm z-20">
        <button
          onClick={() => setZoom(zoom - 2)}
          className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[11px] text-[var(--color-text-muted)] w-7 text-center">{zoom}px</span>
        <button
          onClick={() => setZoom(zoom + 2)}
          className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <ZoomIn size={14} />
        </button>
      </div>
      </div>

      {/* ─── Date Picker Popover ─── */}
      {datePicker && (() => {
        const pickerItem = items.find((i) => i.id === datePicker.itemId);
        if (!pickerItem) return null;
        return (
          <DatePickerPopover
            mode={datePicker.mode}
            startDate={pickerItem.startDate}
            endDate={pickerItem.endDate}
            anchorRect={datePicker.anchorRect}
            onCommit={commitDatePicker}
            onCancel={closeDatePicker}
            onOpenSettings={onOpenSettings}
          />
        );
      })()}
    </div>
  );
});

// ─── TaskBar Component ───────────────────────────────────────────────────────

interface TaskBarProps {
  item: ProjectItem;
  x: number;
  y: number;
  rowHeight: number;
  width: number;
  translateX: number;
  isSelected: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClickBar: () => void;
  onClickSection: (section: 'title' | 'date' | 'duration' | 'percentComplete') => void;
  editingField: EditingField;
  onStartEdit: (field: 'title' | 'duration' | 'percentComplete') => void;
  onCommitEdit: (field: string, value: string) => void;
  onCancelEdit: () => void;
  onOpenDatePicker: (anchorEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onHandleMouseDown: (side: 'start' | 'end', e: React.MouseEvent) => void;
  isDepDragTarget: boolean;
  depDragTargetSide: 'start' | 'end' | null;
}

function TaskBar({ item, x, y, rowHeight, width, translateX, isSelected, isDragging, isHovered, onMouseDown, onClickBar, onClickSection, editingField, onStartEdit, onCommitEdit, onCancelEdit, onOpenDatePicker, onMouseEnter, onMouseLeave, onHandleMouseDown, isDepDragTarget, depDragTargetSide }: TaskBarProps) {
  const isEditing = (field: string) => editingField?.itemId === item.id && editingField?.field === field;
  const style = item.taskStyle;
  const barHeight = style.thickness;
  const barY = y + (ROW_BASE - barHeight) / 2;
  const w = Math.max(width, 8);

  const insetPx = barHeight * 0.4;
  const insetPct = (insetPx / w) * 100;
  const smallInset = insetPct * 0.5;

  let borderRadius = 0;
  let clipPath: string | undefined;

  switch (style.barShape) {
    case 'rounded':
      borderRadius = barHeight * 0.3;
      break;
    case 'square':
      borderRadius = 3;
      break;
    case 'capsule':
      borderRadius = barHeight;
      break;
    case 'chevron':
      clipPath = `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)`;
      break;
    case 'double-chevron':
      clipPath = `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%, ${smallInset}% 50%)`;
      break;
    case 'arrow-right':
      clipPath = `polygon(0% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, 0% 85%)`;
      break;
    case 'pointed':
      clipPath = `polygon(${insetPct}% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, ${insetPct}% 85%, ${insetPct}% 100%, 0% 50%, ${insetPct}% 0%)`;
      break;
    case 'arrow-both': {
      const s = barHeight / Math.tan((75 * Math.PI) / 180);
      const r = Math.min(barHeight * 0.3, s * 0.8);
      const rBig = r * 2.5;
      const len = Math.sqrt(s * s + barHeight * barHeight);
      const dx = (s / len) * r, dy = (barHeight / len) * r;
      const dxB = (s / len) * rBig, dyB = (barHeight / len) * rBig;
      clipPath = `path('`
        + `M ${s + r} 0 `
        + `L ${w - rBig} 0 `
        + `Q ${w} 0 ${w - dxB} ${dyB} `
        + `L ${w - s + dx} ${barHeight - dy} `
        + `Q ${w - s} ${barHeight} ${w - s - r} ${barHeight} `
        + `L ${rBig} ${barHeight} `
        + `Q 0 ${barHeight} ${dxB} ${barHeight - dyB} `
        + `L ${s - dx} ${dy} `
        + `Q ${s} 0 ${s + r} 0 `
        + `Z')`;
      break;
    }
    case 'notched': {
      const s2 = barHeight / Math.tan((75 * Math.PI) / 180);
      const r2 = Math.min(barHeight * 0.3, s2 * 0.8);
      const rSmall = r2 * 0.25;
      const len2 = Math.sqrt(s2 * s2 + barHeight * barHeight);
      const dx2 = (s2 / len2) * r2, dy2 = (barHeight / len2) * r2;
      const dxS = (s2 / len2) * rSmall, dyS = (barHeight / len2) * rSmall;
      clipPath = `path('`
        + `M ${s2 + r2} 0 `
        + `L ${w - rSmall} 0 `
        + `Q ${w} 0 ${w - dxS} ${dyS} `
        + `L ${w - s2 + dx2} ${barHeight - dy2} `
        + `Q ${w - s2} ${barHeight} ${w - s2 - r2} ${barHeight} `
        + `L ${rSmall} ${barHeight} `
        + `Q 0 ${barHeight} ${dxS} ${barHeight - dyS} `
        + `L ${s2 - dx2} ${dy2} `
        + `Q ${s2} 0 ${s2 + r2} 0 `
        + `Z')`;
      break;
    }
    case 'tab':
      clipPath = `polygon(0% 0%, 100% 0%, ${100 - insetPct}% 100%, ${insetPct}% 100%)`;
      break;
    case 'trapezoid':
      clipPath = `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 100%, 0% 100%)`;
      break;
  }

  const shapeStyle: React.CSSProperties = clipPath
    ? { clipPath }
    : { borderRadius };

  return (
    <div
      className={`absolute cursor-grab select-none group ${isDragging ? 'cursor-grabbing z-30' : 'z-10'}`}
      style={{
        left: x,
        top: barY,
        width: w,
        height: barHeight,
        transform: `translateX(${translateX}px)`,
        transition: isDepDragTarget && translateX !== 0 ? 'transform 150ms ease-out' : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Dependency drag target highlight */}
      {isDepDragTarget && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: -3,
              border: '2px dashed #475569',
              borderRadius: borderRadius + 2,
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
          {depDragTargetSide === 'start' && (
            <div
              style={{
                position: 'absolute',
                left: -2,
                top: -3,
                bottom: -3,
                width: 4,
                backgroundColor: '#334155',
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 51,
              }}
            />
          )}
          {depDragTargetSide === 'end' && (
            <div
              style={{
                position: 'absolute',
                right: -2,
                top: -3,
                bottom: -3,
                width: 4,
                backgroundColor: '#334155',
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 51,
              }}
            />
          )}
        </>
      )}

      {/* Connector handle circles — visible only when selected */}
      {isSelected && (
        <>
          {/* Left (start) handle */}
          <div
            className="dep-handle"
            title="Click+drag to add dependency"
            onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('start', e); }}
            style={{
              position: 'absolute',
              left: -18,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 52,
              pointerEvents: 'auto',
            }}
          />
          {/* Right (end) handle */}
          <div
            className="dep-handle"
            title="Click+drag to add dependency"
            onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('end', e); }}
            style={{
              position: 'absolute',
              right: -18,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 52,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
      <div
        className="w-full h-full relative overflow-hidden cursor-pointer hover:outline hover:outline-1 hover:outline-red-400"
        style={{
          ...shapeStyle,
          backgroundColor: `${style.color}30`,
          border: clipPath ? 'none' : isSelected ? `2px solid ${style.color}` : `1px solid ${style.color}50`,
          boxShadow: isSelected
            ? `0 0 0 2px ${style.color}30, 0 2px 8px ${style.color}20`
            : item.isCriticalPath
            ? '0 0 0 2px rgba(239,68,68,0.3)'
            : 'none',
        }}
        onClick={(e) => { e.stopPropagation(); onClickBar(); }}
      >
        <div
          className="absolute top-0 left-0 h-full transition-all duration-300"
          style={{
            width: `${item.percentComplete}%`,
            backgroundColor: style.showPercentComplete && style.pctLabelPosition === 'center'
              ? style.pctHighlightColor
              : style.color,
            ...(clipPath ? {} : { borderRadius }),
            opacity: 0.85,
          }}
        />
        {item.isCriticalPath && !clipPath && (
          <div className="absolute inset-0 border-2 border-red-500 rounded-inherit" style={{ borderRadius }} />
        )}
      </div>

      {/* Title Label */}
      {style.showTitle && (
        <div
          className={`absolute whitespace-nowrap cursor-pointer ${isEditing('title') ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
          style={{
            fontSize: style.fontSize,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle ?? 'normal',
            textDecoration: isEditing('title') ? 'none' : (style.textDecoration ?? 'none'),
            color: style.fontColor,
            maxWidth: isEditing('title') ? 'none' : 200,
            overflow: isEditing('title') ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
            ...(style.labelPosition === 'far-left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 24 }
              : style.labelPosition === 'left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
              : style.labelPosition === 'center'
              ? { left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: style.textAlign ?? 'left', maxWidth: 'none', paddingLeft: 4, paddingRight: 4 }
              : style.labelPosition === 'above'
              ? { left: 0, bottom: '100%', marginBottom: 2 }
              : style.labelPosition === 'below'
              ? { left: 0, top: '100%', marginTop: 2 }
              : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }),
          }}
          onClick={(e) => { e.stopPropagation(); onClickSection('title'); }}
          onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('title'); }}
        >
          {isEditing('title') ? (
            <InlineEditInput
              value={item.name}
              onCommit={(v) => onCommitEdit('title', v)}
              onCancel={onCancelEdit}
              style={{ fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, color: style.fontColor }}
            />
          ) : (
            <span>{item.name}</span>
          )}
        </div>
      )}

      {/* Date Label */}
      {style.showDate && (
        <div
          className="absolute whitespace-nowrap truncate cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1"
          style={{
            fontSize: style.dateFontSize,
            fontFamily: style.dateFontFamily,
            fontWeight: style.dateFontWeight,
            fontStyle: style.dateFontStyle ?? 'normal',
            textDecoration: style.dateTextDecoration ?? 'none',
            color: style.dateFontColor,
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(style.dateLabelPosition === 'far-left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 24 }
              : style.dateLabelPosition === 'left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
              : style.dateLabelPosition === 'center'
              ? { left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: style.dateTextAlign ?? 'left', maxWidth: 'none', paddingLeft: 4, paddingRight: 4 }
              : style.dateLabelPosition === 'above'
              ? { left: 0, bottom: '100%', marginBottom: style.showTitle && style.labelPosition === 'above' ? 16 : 2 }
              : style.dateLabelPosition === 'below'
              ? { left: 0, top: '100%', marginTop: style.showTitle && style.labelPosition === 'below' ? 16 : 2 }
              : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }),
          }}
          onClick={(e) => { e.stopPropagation(); onClickSection('date'); }}
          onDoubleClick={(e) => { e.stopPropagation(); onOpenDatePicker(e.currentTarget as HTMLElement); }}
        >
          <span>
            {format(parseISO(item.startDate), style.dateFormat)} - {format(parseISO(item.endDate), style.dateFormat)}
          </span>
        </div>
      )}

      {/* Duration Label */}
      {style.showDuration && (
        <div
          className={`absolute whitespace-nowrap cursor-pointer ${isEditing('duration') ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
          style={{
            fontSize: style.durationFontSize,
            fontFamily: style.durationFontFamily,
            fontWeight: style.durationFontWeight,
            fontStyle: style.durationFontStyle ?? 'normal',
            textDecoration: isEditing('duration') ? 'none' : (style.durationTextDecoration ?? 'none'),
            color: style.durationFontColor,
            maxWidth: isEditing('duration') ? 'none' : 200,
            overflow: isEditing('duration') ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
            ...(style.durationLabelPosition === 'left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
              : style.durationLabelPosition === 'center'
              ? { left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: style.durationTextAlign ?? 'left', maxWidth: 'none', paddingLeft: 4, paddingRight: 4 }
              : style.durationLabelPosition === 'above'
              ? {
                  left: 0,
                  bottom: '100%',
                  marginBottom:
                    ((style.showTitle && style.labelPosition === 'above') ? 16 : 0)
                    + ((style.showDate && style.dateLabelPosition === 'above') ? 16 : 0)
                    + 2,
                }
              : style.durationLabelPosition === 'below'
              ? {
                  left: 0,
                  top: '100%',
                  marginTop:
                    ((style.showTitle && style.labelPosition === 'below') ? 16 : 0)
                    + ((style.showDate && style.dateLabelPosition === 'below') ? 16 : 0)
                    + 2,
                }
              : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }), // 'right' (default)
          }}
          onClick={(e) => { e.stopPropagation(); onClickSection('duration'); }}
          onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('duration'); }}
        >
          {isEditing('duration') ? (
            <InlineEditInput
              value={formatDuration(item.startDate, item.endDate, style.durationFormat)}
              onCommit={(v) => onCommitEdit('duration', v)}
              onCancel={onCancelEdit}
              style={{ fontSize: style.durationFontSize, fontFamily: style.durationFontFamily, fontWeight: style.durationFontWeight, color: style.durationFontColor, width: 80 }}
            />
          ) : (
            <span>{formatDuration(item.startDate, item.endDate, style.durationFormat)}</span>
          )}
        </div>
      )}

      {/* Percent Complete Label */}
      {style.showPercentComplete && (
        <div
          className={`absolute whitespace-nowrap cursor-pointer ${isEditing('percentComplete') ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
          style={{
            fontSize: style.pctFontSize,
            fontFamily: style.pctFontFamily,
            fontWeight: style.pctFontWeight,
            fontStyle: style.pctFontStyle ?? 'normal',
            textDecoration: isEditing('percentComplete') ? 'none' : (style.pctTextDecoration ?? 'none'),
            color: style.pctFontColor,
            maxWidth: isEditing('percentComplete') ? 'none' : 200,
            overflow: isEditing('percentComplete') ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
            ...(style.pctLabelPosition === 'left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
              : style.pctLabelPosition === 'center'
              ? {
                  left: `${item.percentComplete}%`,
                  top: '50%',
                  transform: item.percentComplete <= 0
                    ? 'translateY(-50%)'
                    : 'translate(-100%, -50%)',
                  maxWidth: 'none',
                  paddingLeft: item.percentComplete <= 0 ? 4 : 0,
                  paddingRight: item.percentComplete > 0 ? 4 : 0,
                }
              : style.pctLabelPosition === 'above'
              ? {
                  left: 0,
                  bottom: '100%',
                  marginBottom:
                    ((style.showTitle && style.labelPosition === 'above') ? 16 : 0)
                    + ((style.showDate && style.dateLabelPosition === 'above') ? 16 : 0)
                    + ((style.showDuration && style.durationLabelPosition === 'above') ? 16 : 0)
                    + 2,
                }
              : style.pctLabelPosition === 'below'
              ? {
                  left: 0,
                  top: '100%',
                  marginTop:
                    ((style.showTitle && style.labelPosition === 'below') ? 16 : 0)
                    + ((style.showDate && style.dateLabelPosition === 'below') ? 16 : 0)
                    + ((style.showDuration && style.durationLabelPosition === 'below') ? 16 : 0)
                    + 2,
                }
              : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }), // 'right'
          }}
          onClick={(e) => { e.stopPropagation(); onClickSection('percentComplete'); }}
          onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('percentComplete'); }}
        >
          {isEditing('percentComplete') ? (
            <InlineEditInput
              value={`${item.percentComplete}%`}
              onCommit={(v) => onCommitEdit('percentComplete', v)}
              onCancel={onCancelEdit}
              style={{ fontSize: style.pctFontSize, fontFamily: style.pctFontFamily, fontWeight: style.pctFontWeight, color: style.pctFontColor, width: 50 }}
            />
          ) : (
            <span>{item.percentComplete}%</span>
          )}
        </div>
      )}

      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 rounded-r" />
    </div>
  );
}

// ─── MilestoneItem Component ─────────────────────────────────────────────────

interface MilestoneItemProps {
  item: ProjectItem;
  x: number;
  y: number;
  rowHeight: number;
  iconTopOverride?: number;
  translateX: number;
  isSelected: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClickIcon: () => void;
  onClickLabel: () => void;
  onClickDate: () => void;
  editingField: EditingField;
  onStartEdit: (field: 'milestoneTitle') => void;
  onCommitEdit: (field: string, value: string) => void;
  onCancelEdit: () => void;
  onOpenDatePicker: (anchorEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onHandleMouseDown: (side: 'start' | 'end', e: React.MouseEvent) => void;
  isDepDragTarget: boolean;
  depDragTargetSide: 'start' | 'end' | null;
}

function MilestoneItem({ item, x, y, rowHeight, iconTopOverride, translateX, isSelected, isDragging, isHovered, onMouseDown, onClickIcon, onClickLabel, onClickDate, editingField, onStartEdit, onCommitEdit, onCancelEdit, onOpenDatePicker, onMouseEnter, onMouseLeave, onHandleMouseDown, isDepDragTarget, depDragTargetSide }: MilestoneItemProps) {
  const isEditingTitle = editingField?.itemId === item.id && editingField?.field === 'milestoneTitle';
  const style = item.milestoneStyle;
  const isIndependent = item.swimlaneId === null;

  // ─── Independent milestones: vertical stack layout ───
  // "above" position: title → date → shape (top to bottom)
  // "below" position: shape → date → title (top to bottom)
  if (isIndependent) {
    const iconTop = iconTopOverride !== undefined ? iconTopOverride : y + ROW_BASE / 2 - style.size / 2;

    // Build the title element
    const titleEl = style.showTitle ? (
      <div
        className={`whitespace-nowrap cursor-pointer text-center ${isEditingTitle ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
        style={{
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle ?? 'normal',
          textDecoration: isEditingTitle ? 'none' : (style.textDecoration ?? 'none'),
          color: style.fontColor,
          maxWidth: isEditingTitle ? 'none' : 200,
          overflow: isEditingTitle ? 'visible' : 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('milestoneTitle'); }}
      >
        {isEditingTitle ? (
          <InlineEditInput
            value={item.name}
            onCommit={(v) => onCommitEdit('milestoneTitle', v)}
            onCancel={onCancelEdit}
            style={{ fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, color: style.fontColor, width: 120 }}
          />
        ) : (
          item.name
        )}
      </div>
    ) : null;

    // Build the date element
    const dateEl = style.showDate ? (
      <div
        className="whitespace-nowrap cursor-pointer text-center hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1"
        style={{
          fontSize: style.dateFontSize,
          fontFamily: style.dateFontFamily,
          fontWeight: style.dateFontWeight,
          fontStyle: style.dateFontStyle ?? 'normal',
          textDecoration: style.dateTextDecoration ?? 'none',
          color: style.dateFontColor,
        }}
        onClick={(e) => { e.stopPropagation(); onClickDate(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onOpenDatePicker(e.currentTarget as HTMLElement); }}
      >
        {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
      </div>
    ) : null;

    // Build the icon element
    const iconEl = (
      <div
        className={`relative cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 ${isSelected ? 'drop-shadow-lg' : ''}`}
        style={{
          filter: isSelected ? `drop-shadow(0 0 6px ${style.color}80)` : 'none',
        }}
        onClick={(e) => { e.stopPropagation(); onClickIcon(); }}
      >
        <MilestoneIconComponent icon={style.icon} size={style.size} color={style.color} />
        {item.isCriticalPath && (
          <div className="absolute inset-0 rounded-full border-2 border-red-500" />
        )}
      </div>
    );

    // "above": title, date, shape — shape at bottom (nearest timescale bar)
    // "below": shape, date, title — shape at top (nearest timescale bar)
    const isAbove = style.position === 'above';

    return (
      <div
        className={`absolute cursor-grab select-none ${isDragging ? 'cursor-grabbing z-30' : 'z-10'}`}
        style={{
          left: x - style.size / 2,
          top: iconTop,
        transform: `translateX(${translateX}px)`,
        transition: isDepDragTarget && translateX !== 0 ? 'transform 150ms ease-out' : undefined,
      }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Dependency drag target highlight */}
        {isDepDragTarget && (
          <div
            style={{
              position: 'absolute',
              left: -3,
              right: -3,
              top: isAbove ? undefined : -3,
              bottom: isAbove ? -3 : undefined,
              width: style.size + 6,
              height: style.size + 6,
              border: '2px dashed #475569',
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
        )}
        {/* Connector handle circles — visible only when selected */}
        {isSelected && (
          <>
            {/* Left handle */}
            <div
              className="dep-handle"
              title="Click+drag to add dependency"
              onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('start', e); }}
              style={{
                position: 'absolute',
                left: -18,
                top: isAbove ? undefined : style.size / 2 - 5,
                bottom: isAbove ? style.size / 2 - 5 : undefined,
                width: 10,
                height: 10,
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 52,
                pointerEvents: 'auto',
              }}
            />
            {/* Right handle */}
            <div
              className="dep-handle"
              title="Click+drag to add dependency"
              onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('end', e); }}
              style={{
                position: 'absolute',
                right: -18,
                top: isAbove ? undefined : style.size / 2 - 5,
                bottom: isAbove ? style.size / 2 - 5 : undefined,
                width: 10,
                height: 10,
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 52,
                pointerEvents: 'auto',
              }}
            />
          </>
        )}
        <div className="flex flex-col items-center gap-px">
          {isAbove ? (
            <>
              {titleEl}
              {dateEl}
              {iconEl}
            </>
          ) : (
            <>
              {iconEl}
              {dateEl}
              {titleEl}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Swimlaned milestones: position-based layout ───
  const iconTop = iconTopOverride !== undefined ? iconTopOverride : y + ROW_BASE / 2 - style.size / 2;

  // Determine if title and date are on the same side
  const titlePos = style.labelPosition;
  const datePos = style.dateLabelPosition;
  const sameSide = style.showTitle && style.showDate && titlePos === datePos;

  // Helper: compute positioning style for a given side
  const sideStyle = (side: string) => {
    switch (side) {
      case 'above': return { left: '50%', transform: 'translateX(-50%)', bottom: '100%', marginBottom: 2 } as const;
      case 'below': return { left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 2 } as const;
      case 'left': return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 } as const;
      case 'right': return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 } as const;
      default: return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 } as const;
    }
  };

  // Helper: text alignment for vertical sides
  const textAlignForSide = (side: string) =>
    side === 'above' || side === 'below' ? 'center' as const : 'left' as const;

  return (
    <div
      className={`absolute cursor-grab select-none ${isDragging ? 'cursor-grabbing z-30' : 'z-10'}`}
      style={{
        left: x - style.size / 2,
        top: iconTop,
        transform: `translateX(${translateX}px)`,
        transition: isDepDragTarget && translateX !== 0 ? 'transform 150ms ease-out' : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Dependency drag target highlight */}
      {isDepDragTarget && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            width: style.size + 6,
            height: style.size + 6,
            border: '2px dashed #475569',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
      {/* Connector handle circles — visible only when selected */}
      {isSelected && (
        <>
          {/* Left handle */}
          <div
            className="dep-handle"
            title="Click+drag to add dependency"
            onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('start', e); }}
            style={{
              position: 'absolute',
              left: -18,
              top: style.size / 2 - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 52,
              pointerEvents: 'auto',
            }}
          />
          {/* Right handle */}
          <div
            className="dep-handle"
            title="Click+drag to add dependency"
            onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown('end', e); }}
            style={{
              position: 'absolute',
              right: -18,
              top: style.size / 2 - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 52,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
      <div
        className={`relative cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 ${isSelected ? 'drop-shadow-lg' : ''}`}
        style={{
          filter: isSelected ? `drop-shadow(0 0 6px ${style.color}80)` : 'none',
        }}
        onClick={(e) => { e.stopPropagation(); onClickIcon(); }}
      >
        <MilestoneIconComponent icon={style.icon} size={style.size} color={style.color} />
        {item.isCriticalPath && (
          <div className="absolute inset-0 rounded-full border-2 border-red-500" />
        )}
      </div>

      {sameSide ? (
        /* Title and date on the same side — stack them in a single container */
        <div
          className="absolute whitespace-nowrap"
          style={{
            ...sideStyle(titlePos),
            textAlign: textAlignForSide(titlePos),
          }}
        >
          <div
            className={`cursor-pointer ${isEditingTitle ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
            style={{
              fontSize: style.fontSize,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle ?? 'normal',
              textDecoration: isEditingTitle ? 'none' : (style.textDecoration ?? 'none'),
              color: style.fontColor,
              maxWidth: isEditingTitle ? 'none' : 200,
              overflow: isEditingTitle ? 'visible' : 'hidden',
              textOverflow: 'ellipsis',
            }}
            onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
            onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('milestoneTitle'); }}
          >
            {isEditingTitle ? (
              <InlineEditInput
                value={item.name}
                onCommit={(v) => onCommitEdit('milestoneTitle', v)}
                onCancel={onCancelEdit}
                style={{ fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, color: style.fontColor, width: 120 }}
              />
            ) : (
              item.name
            )}
          </div>
          <div
            className="cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1"
            style={{
              fontSize: style.dateFontSize,
              fontFamily: style.dateFontFamily,
              fontWeight: style.dateFontWeight,
              fontStyle: style.dateFontStyle ?? 'normal',
              textDecoration: style.dateTextDecoration ?? 'none',
              color: style.dateFontColor,
            }}
            onClick={(e) => { e.stopPropagation(); onClickDate(); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpenDatePicker(e.currentTarget as HTMLElement); }}
          >
            {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
          </div>
        </div>
      ) : (
        <>
          {/* Title label */}
          {style.showTitle && (
            <div
              className={`absolute whitespace-nowrap cursor-pointer ${isEditingTitle ? '' : 'truncate hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1'}`}
              style={{
                fontSize: style.fontSize,
                fontFamily: style.fontFamily,
                fontWeight: style.fontWeight,
                fontStyle: style.fontStyle ?? 'normal',
                textDecoration: isEditingTitle ? 'none' : (style.textDecoration ?? 'none'),
                color: style.fontColor,
                maxWidth: isEditingTitle ? 'none' : 200,
                overflow: isEditingTitle ? 'visible' : 'hidden',
                textOverflow: 'ellipsis',
                ...sideStyle(titlePos),
              }}
              onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
              onDoubleClick={(e) => { e.stopPropagation(); onStartEdit('milestoneTitle'); }}
            >
              {isEditingTitle ? (
                <InlineEditInput
                  value={item.name}
                  onCommit={(v) => onCommitEdit('milestoneTitle', v)}
                  onCancel={onCancelEdit}
                  style={{ fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, color: style.fontColor, width: 120 }}
                />
              ) : (
                <span>{item.name}</span>
              )}
            </div>
          )}

          {/* Date label */}
          {style.showDate && (
            <div
              className="absolute whitespace-nowrap cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 hover:outline-offset-1"
              style={{
                fontSize: style.dateFontSize,
                fontFamily: style.dateFontFamily,
                fontWeight: style.dateFontWeight,
                fontStyle: style.dateFontStyle ?? 'normal',
                textDecoration: style.dateTextDecoration ?? 'none',
                color: style.dateFontColor,
                ...sideStyle(datePos),
              }}
              onClick={(e) => { e.stopPropagation(); onClickDate(); }}
              onDoubleClick={(e) => { e.stopPropagation(); onOpenDatePicker(e.currentTarget as HTMLElement); }}
            >
              {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
