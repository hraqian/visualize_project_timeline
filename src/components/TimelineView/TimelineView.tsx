import { useRef, useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseISO, differenceInDays, addDays, subDays } from 'date-fns';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import { generateTierLabels, getProjectRange } from '@/utils';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ProjectItem, Swimlane } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const SWIMLANE_LABEL_WIDTH = 180;

const ROW_HEIGHT = 48;
const SWIMLANE_HEADER_HEIGHT = 32;
const SWIMLANE_PADDING = 8;

// ─── TimelineView ────────────────────────────────────────────────────────────

export function TimelineView() {
  const items = useProjectStore((s) => s.items);
  const swimlanes = useProjectStore((s) => s.swimlanes);
  const dependencies = useProjectStore((s) => s.dependencies);
  const timescale = useProjectStore((s) => s.timescale);
  const zoom = useProjectStore((s) => s.zoom);
  const setZoom = useProjectStore((s) => s.setZoom);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);
  const moveItem = useProjectStore((s) => s.moveItem);
  const moveItemToSwimlane = useProjectStore((s) => s.moveItemToSwimlane);
  const showCriticalPath = useProjectStore((s) => s.showCriticalPath);

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  const sortedSwimlanes = useMemo(
    () => [...swimlanes].sort((a, b) => a.order - b.order),
    [swimlanes]
  );

  const visibleItems = useMemo(() => items.filter((i) => i.visible), [items]);

  // Compute project range with padding
  const { origin, totalDays } = useMemo(() => {
    const range = getProjectRange(items);
    const padStart = subDays(parseISO(range.start), 14);
    const padEnd = addDays(parseISO(range.end), 30);
    const total = differenceInDays(padEnd, padStart);
    return { origin: padStart.toISOString().split('T')[0], totalDays: total };
  }, [items]);

  const totalWidth = totalDays * zoom;

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

  // Swimlane layout: compute y offset for each swimlane
  const swimlaneLayout = useMemo(() => {
    let y = 0;
    const layout: { swimlane: Swimlane; y: number; height: number }[] = [];
    for (const sl of sortedSwimlanes) {
      const slItems = visibleItems.filter((i) => i.swimlaneId === sl.id);
      const maxRow = slItems.length > 0 ? Math.max(...slItems.map((i) => i.row)) : 0;
      const height = SWIMLANE_HEADER_HEIGHT + (maxRow + 1) * ROW_HEIGHT + SWIMLANE_PADDING * 2;
      layout.push({ swimlane: sl, y, height });
      y += height;
    }
    return layout;
  }, [sortedSwimlanes, visibleItems]);

  const canvasHeight = swimlaneLayout.reduce((sum, sl) => sum + sl.height, 0);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      setDraggingId(itemId);
      setDragStartX(e.clientX);
      setDragOffset(0);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return;
      setDragOffset(e.clientX - dragStartX);
    },
    [draggingId, dragStartX]
  );

  const handleMouseUp = useCallback(() => {
    if (!draggingId) return;
    const daysDelta = Math.round(dragOffset / zoom);
    if (daysDelta !== 0) {
      moveItem(draggingId, daysDelta);
    }
    setDraggingId(null);
    setDragOffset(0);
  }, [draggingId, dragOffset, zoom, moveItem]);

  // Compute timescale tiers
  const tierLabels = useMemo(() => {
    const rangeStart = parseISO(origin);
    const rangeEnd = addDays(rangeStart, totalDays);
    return timescale.tiers
      .filter((t) => t.visible)
      .map((tier) => ({
        tier,
        labels: generateTierLabels(tier.unit, rangeStart, rangeEnd, timescale.fiscalYearStartMonth),
      }));
  }, [origin, totalDays, timescale]);

  const timescaleHeight = tierLabels.length * 28;

  // Dependency lines SVG paths
  const depPaths = useMemo(() => {
    return dependencies
      .map((dep) => {
        const from = visibleItems.find((i) => i.id === dep.fromId);
        const to = visibleItems.find((i) => i.id === dep.toId);
        if (!from || !to) return null;

        const fromSl = swimlaneLayout.find((sl) => sl.swimlane.id === from.swimlaneId);
        const toSl = swimlaneLayout.find((sl) => sl.swimlane.id === to.swimlaneId);
        if (!fromSl || !toSl) return null;

        const fromX = itemToX(from.endDate) + (from.type === 'milestone' ? from.milestoneStyle.size / 2 : 0);
        const fromY = fromSl.y + SWIMLANE_HEADER_HEIGHT + from.row * ROW_HEIGHT + ROW_HEIGHT / 2;

        const toX = itemToX(to.startDate) - (to.type === 'milestone' ? to.milestoneStyle.size / 2 : 0);
        const toY = toSl.y + SWIMLANE_HEADER_HEIGHT + to.row * ROW_HEIGHT + ROW_HEIGHT / 2;

        const isCritical = showCriticalPath && from.isCriticalPath && to.isCriticalPath;

        // S-curve path
        const midX = (fromX + toX) / 2;
        const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

        return { path, isCritical, key: `${dep.fromId}-${dep.toId}` };
      })
      .filter(Boolean);
  }, [dependencies, visibleItems, swimlaneLayout, itemToX, showCriticalPath]);

  // Handle drop on swimlane
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* Toolbar with zoom controls */}
      <div className="px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-end shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom - 2)}
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-[var(--color-text-muted)] w-8 text-center">{zoom}x</span>
          <button
            onClick={() => setZoom(zoom + 2)}
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto scrollbar-thin relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="flex" style={{ minWidth: SWIMLANE_LABEL_WIDTH + totalWidth }}>
          {/* Swimlane Labels Column */}
          <div
            className="sticky left-0 z-20 bg-[var(--color-bg)] border-r border-[var(--color-border)] shrink-0"
            style={{ width: SWIMLANE_LABEL_WIDTH }}
          >
            {/* Timescale spacer */}
            <div
              className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]"
              style={{ height: timescaleHeight }}
            />

            {/* Swimlane labels */}
            {swimlaneLayout.map(({ swimlane, height }) => (
              <div
                key={swimlane.id}
                className="border-b border-[var(--color-border)]/30"
                style={{ height }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnSwimlane(swimlane.id, e)}
              >
                <div
                  className="h-8 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: swimlane.color }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: swimlane.color }} />
                  {swimlane.name}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline Area */}
          <div className="relative" style={{ width: totalWidth }}>
            {/* Timescale Headers */}
            <div className="sticky top-0 z-10 border-b border-[var(--color-border)]">
              {tierLabels.map(({ tier, labels }, tierIdx) => (
                <div key={tierIdx} className="flex h-7" style={{ backgroundColor: tier.backgroundColor }}>
                  {labels.map((label, i) => {
                    const startX = differenceInDays(label.startDate, parseISO(origin)) * zoom;
                    const endX = differenceInDays(label.endDate, parseISO(origin)) * zoom + zoom;
                    const width = Math.max(endX - startX, 1);
                    return (
                      <div
                        key={i}
                        className="border-r border-white/10 flex items-center justify-center shrink-0 overflow-hidden"
                        style={{
                          position: 'absolute',
                          left: startX,
                          width,
                          height: 28,
                          color: tier.fontColor,
                          fontSize: tier.fontSize,
                        }}
                      >
                        <span className="truncate px-1">{label.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Grid + Swimlanes */}
            <div className="relative" style={{ height: canvasHeight }}>
              {/* Grid lines (monthly) */}
              {tierLabels.length > 0 &&
                tierLabels[tierLabels.length - 1].labels.map((label, i) => {
                  const x = differenceInDays(label.startDate, parseISO(origin)) * zoom;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-[var(--color-border)]/20"
                      style={{ left: x }}
                    />
                  );
                })}

              {/* Today Line */}
              {timescale.showToday && todayX >= 0 && todayX <= totalWidth && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: todayX }}
                >
                  <div
                    className="w-0.5 h-full"
                    style={{ backgroundColor: timescale.todayColor }}
                  />
                  <div
                    className="absolute -top-0 -translate-x-1/2 px-1.5 py-0.5 rounded-b text-[10px] font-medium text-white"
                    style={{ backgroundColor: timescale.todayColor }}
                  >
                    Today
                  </div>
                </div>
              )}

              {/* Swimlane backgrounds */}
              {swimlaneLayout.map(({ swimlane, y, height }, idx) => (
                <div
                  key={swimlane.id}
                  className={`absolute left-0 right-0 border-b border-[var(--color-border)]/30 ${
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--color-bg-secondary)]/20'
                  }`}
                  style={{ top: y, height }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSwimlane(swimlane.id, e)}
                />
              ))}

              {/* Dependency Lines (SVG) */}
              <svg
                className="absolute top-0 left-0 pointer-events-none z-5"
                width={totalWidth}
                height={canvasHeight}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                  </marker>
                  <marker
                    id="arrowhead-critical"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                </defs>
                {depPaths.map(
                  (dep) =>
                    dep && (
                      <path
                        key={dep.key}
                        d={dep.path}
                        fill="none"
                        stroke={dep.isCritical ? '#ef4444' : '#475569'}
                        strokeWidth={dep.isCritical ? 2 : 1.5}
                        strokeDasharray={dep.isCritical ? 'none' : '4 3'}
                        markerEnd={dep.isCritical ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'}
                        opacity={0.7}
                      />
                    )
                )}
              </svg>

              {/* Task Bars & Milestones */}
              {visibleItems.map((item) => {
                const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
                if (!sl) return null;

                const x = itemToX(item.startDate);
                const y =
                  sl.y + SWIMLANE_HEADER_HEIGHT + SWIMLANE_PADDING + item.row * ROW_HEIGHT;
                const isDragging = draggingId === item.id;
                const translateX = isDragging ? dragOffset : 0;
                const isSelected = selectedItemId === item.id;

                if (item.type === 'milestone') {
                  return (
                    <MilestoneItem
                      key={item.id}
                      item={item}
                      x={x}
                      y={y}
                      translateX={translateX}
                      isSelected={isSelected}
                      isDragging={isDragging}
                      onMouseDown={(e) => handleMouseDown(e, item.id)}
                      onClick={() => setSelectedItem(item.id)}
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
                    width={width}
                    translateX={translateX}
                    isSelected={isSelected}
                    isDragging={isDragging}
                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                    onClick={() => setSelectedItem(item.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TaskBar Component ───────────────────────────────────────────────────────

interface TaskBarProps {
  item: ProjectItem;
  x: number;
  y: number;
  width: number;
  translateX: number;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function TaskBar({ item, x, y, width, translateX, isSelected, isDragging, onMouseDown, onClick }: TaskBarProps) {
  const style = item.taskStyle;
  const barHeight = style.thickness;
  const barY = y + (ROW_HEIGHT - barHeight) / 2;
  const w = Math.max(width, 8);

  // Compute borderRadius (for simple shapes) or clipPath (for complex shapes)
  const insetPx = barHeight * 0.4;
  const insetPct = (insetPx / w) * 100;

  let borderRadius = 0;
  let clipPath: string | undefined;

  switch (style.barShape) {
    case 'rounded':
      borderRadius = barHeight / 2;
      break;
    case 'square':
      borderRadius = 4;
      break;
    case 'capsule':
      borderRadius = barHeight;
      break;
    case 'chevron':
      clipPath = `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)`;
      break;
    case 'double-chevron':
      clipPath = `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)`;
      break;
    case 'arrow-right':
      clipPath = `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)`;
      break;
    case 'pointed':
      clipPath = `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)`;
      break;
    case 'notched':
      clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${insetPct}% 50%)`;
      break;
    case 'tab':
      clipPath = `polygon(0% 0%, 100% 0%, ${100 - insetPct}% 100%, ${insetPct}% 100%)`;
      break;
    case 'arrow-both':
      clipPath = `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${insetPct}% 100%, 0% 50%)`;
      break;
    case 'trapezoid':
      clipPath = `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 100%, 0% 100%)`;
      break;
    // 'flat' and default: borderRadius = 0, no clipPath
  }

  const shapeStyle: React.CSSProperties = clipPath
    ? { clipPath }
    : { borderRadius };

  return (
    <div
      className={`absolute cursor-grab select-none group ${isDragging ? 'cursor-grabbing z-30 opacity-80' : 'z-10'}`}
      style={{
        left: x,
        top: barY,
        width: w,
        height: barHeight,
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.15s ease',
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
    >
      {/* Bar Background */}
      <div
        className="w-full h-full relative overflow-hidden"
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
      >
        {/* Progress Fill */}
        <div
          className="absolute top-0 left-0 h-full transition-all duration-300"
          style={{
            width: `${item.percentComplete}%`,
            backgroundColor: style.color,
            ...(clipPath ? {} : { borderRadius }),
            opacity: 0.85,
          }}
        />

        {/* Critical Path Indicator */}
        {item.isCriticalPath && !clipPath && (
          <div className="absolute inset-0 border-2 border-red-500 rounded-inherit" style={{ borderRadius }} />
        )}
      </div>

      {/* Label */}
      <div
        className="absolute whitespace-nowrap truncate"
        style={{
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          color: style.fontColor,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(style.labelPosition === 'inside'
            ? { left: 8, top: '50%', transform: 'translateY(-50%)' }
            : style.labelPosition === 'above'
            ? { left: 0, bottom: '100%', marginBottom: 2 }
            : style.labelPosition === 'left'
            ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
            : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }),
        }}
      >
        <span>{item.name}</span>
        {item.percentComplete > 0 && item.percentComplete < 100 && (
          <span className="text-[10px] text-[var(--color-text-muted)] ml-1">{item.percentComplete}%</span>
        )}
      </div>

      {/* Resize Handle (right edge) */}
      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 rounded-r" />
    </div>
  );
}

// ─── MilestoneItem Component ─────────────────────────────────────────────────

interface MilestoneItemProps {
  item: ProjectItem;
  x: number;
  y: number;
  translateX: number;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function MilestoneItem({ item, x, y, translateX, isSelected, isDragging, onMouseDown, onClick }: MilestoneItemProps) {
  const style = item.milestoneStyle;
  const centerY = y + ROW_HEIGHT / 2;

  return (
    <div
      className={`absolute cursor-grab select-none ${isDragging ? 'cursor-grabbing z-30 opacity-80' : 'z-10'}`}
      style={{
        left: x - style.size / 2,
        top: centerY - style.size / 2,
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.15s ease',
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
    >
      <div
        className={`relative ${isSelected ? 'drop-shadow-lg' : ''}`}
        style={{
          filter: isSelected ? `drop-shadow(0 0 6px ${style.color}80)` : 'none',
        }}
      >
        <MilestoneIconComponent icon={style.icon} size={style.size} color={style.color} />
        {item.isCriticalPath && (
          <div className="absolute inset-0 rounded-full border-2 border-red-500" />
        )}
      </div>

      {/* Label */}
      <div
        className="absolute whitespace-nowrap truncate"
        style={{
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          color: style.fontColor,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(style.labelPosition === 'above'
            ? { left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 4 }
            : style.labelPosition === 'left'
            ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
            : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }),
        }}
      >
        <span>{item.name}</span>
      </div>
    </div>
  );
}
