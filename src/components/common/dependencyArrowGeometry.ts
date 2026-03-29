import type { DependencyArrowType } from '@/types';

export type DependencyArrowHead =
  | { kind: 'polygon'; points: string; fill: boolean }
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | null;

type RoutePoint = { x: number; y: number };

function clampArrowSize(size: number | undefined): number {
  return Math.max(1, Math.min(9, Math.round(size ?? 4)));
}

function clampStrokeWidth(lineWidth: number | undefined): number {
  return Math.max(0.5, lineWidth ?? 1.5);
}

function parseRoutePoints(path: string): RoutePoint[] {
  return path
    .split(/(?=[ML])/) 
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [, xs, ys] = part.split(/\s+/);
      return { x: Number(xs), y: Number(ys) };
    });
}

function stringifyRoutePoints(points: RoutePoint[]): string {
  return points
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(point.x * 1000) / 1000} ${Math.round(point.y * 1000) / 1000}`)
    .join(' ');
}

function dependencyArrowDepth(type: DependencyArrowType, size: number, stroke: number, isVertical: boolean): number {
  if (type === 'standard') {
    return (6.2 + size * 0.66 + stroke * 0.14) * (isVertical ? 0.94 : 1);
  }

  if (type === 'open') {
    return (7.2 + size * 0.78 + stroke * 0.16) * (isVertical ? 0.95 : 1);
  }

  return (7.6 + size * 0.92 + stroke * 0.18) * (isVertical ? 0.96 : 1);
}

function dependencyArrowHalf(type: DependencyArrowType, size: number, stroke: number, isVertical: boolean): number {
  if (type === 'standard') {
    return (2.6 + size * 0.28 + stroke * 0.08) * (isVertical ? 0.9 : 1);
  }

  if (type === 'open') {
    return (3 + size * 0.34 + stroke * 0.1) * (isVertical ? 0.92 : 1);
  }

  return (3.1 + size * 0.42 + stroke * 0.12) * (isVertical ? 0.94 : 1);
}

export function dependencyArrowVisualClearance(lineWidth: number | undefined, arrowSize: number | undefined): number {
  const strokeWidth = clampStrokeWidth(lineWidth);
  const size = clampArrowSize(arrowSize);
  const extraStroke = Math.max(0, strokeWidth - 1.5);
  const extraArrow = Math.max(0, size - 4);
  return Math.ceil(extraStroke * 0.8 + extraArrow * 0.7);
}

export function dependencyArrowEndInset(
  arrowType: DependencyArrowType | undefined,
  arrowSize: number | undefined,
  lineWidth: number | undefined,
  dir?: 'left' | 'right' | 'top' | 'bottom',
): number {
  if (!arrowType || arrowType === 'none') return 0;

  const size = clampArrowSize(arrowSize);
  const stroke = clampStrokeWidth(lineWidth);
  const directionalBonus = dir === 'top' || dir === 'bottom' ? Math.max(2, stroke) : 0;

  if (arrowType === 'circle') {
    const radius = 2.4 + size * 0.34;
    return Math.ceil(radius * 2 + Math.max(1.5, 1 + stroke * 0.35) + directionalBonus);
  }

  const depth = dependencyArrowDepth(arrowType, size, stroke, dir === 'top' || dir === 'bottom');
  const lineGap = arrowType === 'standard' ? Math.max(1.25, 0.9 + stroke * 0.18) : 0;
  return Math.ceil(depth + lineGap + directionalBonus);
}

export function buildDependencyRenderGeometry(
  path: string,
  arrowType: DependencyArrowType | undefined,
  arrowSize: number | undefined,
  lineWidth: number | undefined,
): { linePath: string; head: DependencyArrowHead } {
  const type = arrowType ?? 'standard';
  if (type === 'none') return { linePath: path, head: null };

  const points = parseRoutePoints(path);
  if (points.length < 2) return { linePath: path, head: null };

  const tip = points[points.length - 1];
  const prev = points[points.length - 2];
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const segLen = Math.abs(dx) + Math.abs(dy);
  if (segLen <= 1) return { linePath: path, head: null };

  const dirX = dx === 0 ? 0 : Math.sign(dx);
  const dirY = dy === 0 ? 0 : Math.sign(dy);
  const isVertical = dirY !== 0;
  const normalX = -dirY;
  const normalY = dirX;
  const size = clampArrowSize(arrowSize);
  const stroke = clampStrokeWidth(lineWidth);

  if (type === 'circle') {
    const radius = 2.4 + size * 0.34;
    const trim = Math.min(radius * 2 + Math.max(1.5, stroke * 0.55), segLen - 1);
    const centerX = tip.x - dirX * radius;
    const centerY = tip.y - dirY * radius;
    points[points.length - 1] = { x: tip.x - dirX * trim, y: tip.y - dirY * trim };
    return { linePath: stringifyRoutePoints(points), head: { kind: 'circle', cx: centerX, cy: centerY, r: radius } };
  }

  const depth = Math.min(dependencyArrowDepth(type, size, stroke, isVertical), segLen - 1);
  const half = dependencyArrowHalf(type, size, stroke, isVertical);
  const baseX = tip.x - dirX * depth;
  const baseY = tip.y - dirY * depth;
  const lineGap = type === 'standard' ? Math.max(1.25, 0.9 + stroke * 0.18) : 0;

  points[points.length - 1] = {
    x: tip.x - dirX * Math.min(segLen - 1, depth + lineGap),
    y: tip.y - dirY * Math.min(segLen - 1, depth + lineGap),
  };

  if (type === 'standard') {
    const p1 = `${tip.x},${tip.y}`;
    const p2 = `${baseX + normalX * half},${baseY + normalY * half}`;
    const p3 = `${baseX - normalX * half},${baseY - normalY * half}`;
    return { linePath: stringifyRoutePoints(points), head: { kind: 'polygon', points: `${p1} ${p2} ${p3}`, fill: true } };
  }

  if (type === 'open') {
    const leftX = baseX + normalX * half;
    const leftY = baseY + normalY * half;
    const rightX = baseX - normalX * half;
    const rightY = baseY - normalY * half;
    return {
      linePath: stringifyRoutePoints(points),
      head: { kind: 'path', d: `M ${leftX} ${leftY} L ${tip.x} ${tip.y} L ${rightX} ${rightY}` },
    };
  }

  const midDepth = depth * 0.5;
  const midX = tip.x - dirX * midDepth;
  const midY = tip.y - dirY * midDepth;
  const backX = baseX;
  const backY = baseY;
  const p1 = `${tip.x},${tip.y}`;
  const p2 = `${midX + normalX * half},${midY + normalY * half}`;
  const p3 = `${backX},${backY}`;
  const p4 = `${midX - normalX * half},${midY - normalY * half}`;
  return { linePath: stringifyRoutePoints(points), head: { kind: 'polygon', points: `${p1} ${p2} ${p3} ${p4}`, fill: false } };
}

export function getDependencyArrowPreviewProps(type: DependencyArrowType, size = 4) {
  const strokeWidth = Math.max(1.5, 0.95 + size * 0.18);
  const shaftStart = 3;
  const tipX = 23;
  const centerY = 6;
  const depth = dependencyArrowDepth(type === 'none' ? 'standard' : type, size, strokeWidth, false);
  const half = dependencyArrowHalf(type === 'none' ? 'standard' : type, size, strokeWidth, false);
  const shaftEnd = type === 'none' ? 23 : Math.max(shaftStart + 7, tipX - depth - (type === 'standard' ? Math.max(1.25, 0.9 + strokeWidth * 0.18) : 0));

  return {
    strokeWidth,
    shaftStart,
    shaftEnd,
    tipX,
    centerY,
    depth,
    half,
    circleRadius: 2.4 + size * 0.34,
  };
}
