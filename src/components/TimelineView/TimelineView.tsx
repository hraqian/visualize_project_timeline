import { useRef, useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseISO, differenceInDays, differenceInCalendarMonths, addMonths, addDays, subDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import { generateTierLabels, buildVisibleTierCells, getProjectRange, resolveAutoUnit } from '@/utils';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ProjectItem, Swimlane, DurationFormat, ConnectorThickness, OutlineThickness, TimescaleBarShape, EndCapConfig } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44;
const SWIMLANE_BADGE_WIDTH = 120;
const INDEPENDENT_SECTION_PADDING = 12;
const CONNECTOR_THICKNESS_MAP: Record<ConnectorThickness, number> = { thin: 1, medium: 2, thick: 3 };
const OUTLINE_THICKNESS_MAP: Record<OutlineThickness, number> = { none: 0, thin: 1, medium: 2, thick: 3 };
const SWIMLANE_PADDING_TOP = 10;
const SWIMLANE_PADDING_BOTTOM = 10;

function getTimescaleBarShapeStyle(shape: TimescaleBarShape): React.CSSProperties {
  switch (shape) {
    case 'rectangle': return {};
    case 'rounded': return { borderRadius: '6px' };
    case 'leaf': return { borderRadius: '0 9999px 9999px 0' };
    case 'ellipse': return { borderRadius: '9999px' };
    case 'modern': return { borderRadius: '4px 12px 4px 12px' };
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
  const selectedSwimlaneId = useProjectStore((s) => s.selectedSwimlaneId);
  const setSelectedSwimlane = useProjectStore((s) => s.setSelectedSwimlane);
  const setStylePaneSection = useProjectStore((s) => s.setStylePaneSection);
  const moveItem = useProjectStore((s) => s.moveItem);
  const moveItemToSwimlane = useProjectStore((s) => s.moveItemToSwimlane);
  const showCriticalPath = useProjectStore((s) => s.showCriticalPath);
  const swimlaneSpacing = useProjectStore((s) => s.swimlaneSpacing);
  const selectedTierIndex = useProjectStore((s) => s.selectedTierIndex);
  const setSelectedTierIndex = useProjectStore((s) => s.setSelectedTierIndex);

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

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

  // Compute project range with padding
  const { origin, totalDays, rangeEndDate } = useMemo(() => {
    const range = getProjectRange(items);
    const padStart = startOfMonth(subDays(parseISO(range.start), 14));
    // End at the end of the month containing the last item
    const endMonth = startOfMonth(parseISO(range.end));
    const numMonths = differenceInCalendarMonths(endMonth, padStart) + 1;
    const padEnd = addMonths(padStart, numMonths);
    const total = differenceInDays(padEnd, padStart);
    return { origin: padStart.toISOString().split('T')[0], totalDays: total, rangeEndDate: subDays(padEnd, 1) };
  }, [items]);

  // Auto-fit zoom to container width on mount
  useEffect(() => {
    if (!containerRef.current || totalDays <= 0) return;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;
    const idealZoom = Math.round(containerWidth / totalDays);
    setZoom(Math.max(2, Math.min(30, idealZoom)));
  }, [totalDays, setZoom]);

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
    const maxRow = Math.max(...belowIndependentItems.map((i) => i.row), 0);
    return (maxRow + 1) * ROW_HEIGHT + INDEPENDENT_SECTION_PADDING * 2;
  }, [belowIndependentItems]);

  // Swimlane layout: compute y offset for each swimlane
  const swimlaneLayout = useMemo(() => {
    let y = independentHeight;
    const layout: { swimlane: Swimlane; y: number; height: number; contentY: number }[] = [];
    for (let i = 0; i < sortedSwimlanes.length; i++) {
      const sl = sortedSwimlanes[i];
      if (i > 0) y += swimlaneSpacing; // gap between bands
      const slItems = swimlanedItems.filter((it) => it.swimlaneId === sl.id);
      const maxRow = slItems.length > 0 ? Math.max(...slItems.map((it) => it.row)) : 0;
      const contentHeight = (maxRow + 1) * ROW_HEIGHT;
      const height = SWIMLANE_PADDING_TOP + contentHeight + SWIMLANE_PADDING_BOTTOM;
      layout.push({ swimlane: sl, y, height, contentY: y + SWIMLANE_PADDING_TOP });
      y += height;
    }
    return layout;
  }, [sortedSwimlanes, swimlanedItems, independentHeight, swimlaneSpacing]);

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

  // Dependency lines SVG paths
  const depPaths = useMemo(() => {
    return dependencies
      .map((dep) => {
        const from = visibleItems.find((i) => i.id === dep.fromId);
        const to = visibleItems.find((i) => i.id === dep.toId);
        if (!from || !to) return null;

        const getItemY = (item: ProjectItem) => {
          // "Above" milestones are rendered above the timescale bar — use top of canvas as endpoint
          if (item.type === 'milestone' && item.swimlaneId === null && item.milestoneStyle.position === 'above') {
            return 0;
          }
          if (!swimlaneIds.has(item.swimlaneId)) {
            return INDEPENDENT_SECTION_PADDING + item.row * ROW_HEIGHT + ROW_HEIGHT / 2;
          }
          const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
          if (!sl) return 0;
          return sl.contentY + item.row * ROW_HEIGHT + ROW_HEIGHT / 2;
        };

        const fromX = itemToX(from.endDate) + (from.type === 'milestone' ? from.milestoneStyle.size / 2 : 0);
        const fromY = getItemY(from);
        const toX = itemToX(to.startDate) - (to.type === 'milestone' ? to.milestoneStyle.size / 2 : 0);
        const toY = getItemY(to);

        const isCritical = showCriticalPath && from.isCriticalPath && to.isCriticalPath;

        const midX = (fromX + toX) / 2;
        const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

        return { path, isCritical, key: `${dep.fromId}-${dep.toId}` };
      })
      .filter(Boolean);
  }, [dependencies, visibleItems, swimlaneLayout, swimlaneIds, itemToX, showCriticalPath]);

  // Vertical connector lines (two dashed lines per task, start edge + end edge, going up to timescale)
  const verticalConnectors = useMemo(() => {
    const lines: { x: number; y1: number; y2: number; color: string; thickness: number; key: string }[] = [];

    const getItemY = (item: ProjectItem) => {
      if (!swimlaneIds.has(item.swimlaneId)) {
        return INDEPENDENT_SECTION_PADDING + item.row * ROW_HEIGHT;
      }
      const sl = swimlaneLayout.find((s) => s.swimlane.id === item.swimlaneId);
      if (!sl) return 0;
      return sl.contentY + item.row * ROW_HEIGHT;
    };

    for (const item of visibleItems) {
      if (item.type !== 'task') continue;
      const style = item.taskStyle;
      if (!style.showVerticalConnector) continue;

      const startX = itemToX(item.startDate);
      const barWidth = differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) * zoom + zoom;
      const endX = startX + barWidth;
      const barY = getItemY(item) + (ROW_HEIGHT - style.thickness) / 2;
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
  }, [visibleItems, swimlaneIds, swimlaneLayout, itemToX, zoom]);

  // ─── Drag handlers ─────────────────────────────────────────────────

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

  // ─── Render helpers ────────────────────────────────────────────────

  const belowMilestoneGap = 4; // px between timescale bar bottom edge and milestone top edge

  const renderItem = (item: ProjectItem, yBase: number) => {
    const x = itemToX(item.startDate);
    const y = yBase + item.row * ROW_HEIGHT;
    const isDragging = draggingId === item.id;
    const translateX = isDragging ? dragOffset : 0;
    const isSelected = selectedItemId === item.id;

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
          iconTopOverride={belowOverride}
          translateX={translateX}
          isSelected={isSelected}
          isDragging={isDragging}
          onMouseDown={(e) => handleMouseDown(e, item.id)}
          onClickIcon={() => { setSelectedItem(item.id); setStylePaneSection('milestoneShape'); }}
          onClickLabel={() => { setSelectedItem(item.id); setStylePaneSection('milestoneTitle'); }}
          onClickDate={() => { setSelectedItem(item.id); setStylePaneSection('milestoneDate'); }}
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
        onClickBar={() => { setSelectedItem(item.id); setStylePaneSection('bar'); }}
        onClickSection={(section) => { setSelectedItem(item.id); setStylePaneSection(section); }}
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ minWidth: totalWidth, position: 'relative' }}>
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
                const txl = isDraggingItem ? dragOffset : 0;
                const isSel = selectedItemId === item.id;
                return (
                  <MilestoneItem
                    key={item.id}
                    item={item}
                    x={ax}
                    y={0}
                    iconTopOverride={ay}
                    translateX={txl}
                    isSelected={isSel}
                    isDragging={isDraggingItem}
                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                    onClickIcon={() => { setSelectedItem(item.id); setStylePaneSection('milestoneShape'); }}
                    onClickLabel={() => { setSelectedItem(item.id); setStylePaneSection('milestoneTitle'); }}
                    onClickDate={() => { setSelectedItem(item.id); setStylePaneSection('milestoneDate'); }}
                  />
                );
              })}
            </div>
          )}

           {/* Timescale Headers */}
           <div className="sticky top-0 z-10 relative flex items-center" style={timescale.showToday ? (todayPos === 'below' ? { marginBottom: 22 } : { marginTop: 22 }) : undefined}>
              {/* Left end cap */}
              {timescale.leftEndCap?.show && (
                <div
                  className="shrink-0 pr-3 whitespace-nowrap"
                  style={{
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

              <div className="flex-1 relative">
                <div className="border-b border-[var(--color-border)] overflow-hidden relative" style={getTimescaleBarShapeStyle(timescale.barShape)}>
                  {tierLabels.map(({ tier, storeIndex, labels }, tierIdx) => {
                    const originDate = parseISO(origin);
                    const cells = buildVisibleTierCells(labels, tier.unit, originDate, totalDays, totalWidth);
                    const isSelected = selectedTierIndex === storeIndex;

                    return (
                      <div
                        key={tierIdx}
                        className={`flex h-7 relative cursor-pointer transition-shadow ${isSelected ? 'ring-2 ring-inset ring-white/40' : ''}`}
                        style={{ backgroundColor: tier.backgroundColor }}
                        onClick={() => { setSelectedTierIndex(storeIndex); setStylePaneSection('scale'); }}
                      >
                        {cells.map((cell, ci) => (
                          <div
                            key={ci}
                            className={`flex items-center shrink-0 overflow-hidden ${tier.separators && ci > 0 ? 'border-l border-white/20' : ''}`}
                            style={{
                              position: 'absolute',
                              left: cell.fraction * totalWidth,
                              width: cell.widthFrac * totalWidth,
                              height: 28,
                              color: tier.fontColor,
                              fontSize: tier.fontSize,
                              fontFamily: tier.fontFamily,
                              fontWeight: tier.fontWeight,
                              fontStyle: tier.fontStyle,
                              textDecoration: tier.textDecoration,
                              justifyContent: 'flex-start',
                            }}
                          >
                            <span className="truncate px-1">{cell.label}</span>
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

              {/* Right end cap */}
              {timescale.rightEndCap?.show && (
                <div
                  className="shrink-0 pl-3 whitespace-nowrap"
                  style={{
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
          <div className="relative" style={{ height: canvasHeight }}>
            {/* Grid lines */}
            {tierLabels.length > 0 &&
              tierLabels[tierLabels.length - 1].labels.map((label, i) => {
                const x = differenceInDays(label.startDate, parseISO(origin)) * zoom;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-[var(--color-border)]/15"
                    style={{ left: x }}
                  />
                );
              })}

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
                    className={`absolute left-0 top-0 bottom-0 flex items-center justify-center rounded-r-md tracking-wide z-[6] cursor-pointer transition-shadow ${
                      selectedSwimlaneId === swimlane.id ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
                    }`}
                    style={{
                      width: SWIMLANE_BADGE_WIDTH,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSwimlane(swimlane.id);
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
  onClickBar: () => void;
  onClickSection: (section: 'title' | 'date' | 'duration' | 'percentComplete') => void;
}

function TaskBar({ item, x, y, width, translateX, isSelected, isDragging, onMouseDown, onClickBar, onClickSection }: TaskBarProps) {
  const style = item.taskStyle;
  const barHeight = style.thickness;
  const barY = y + (ROW_HEIGHT - barHeight) / 2;
  const w = Math.max(width, 8);

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
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
    >
      <div
        className="w-full h-full relative overflow-hidden cursor-pointer"
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
          className="absolute whitespace-nowrap truncate cursor-pointer"
          style={{
            fontSize: style.fontSize,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle ?? 'normal',
            textDecoration: style.textDecoration ?? 'none',
            color: style.fontColor,
            maxWidth: 200,
            overflow: 'hidden',
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
        >
          <span>{item.name}</span>
          {item.percentComplete > 0 && item.percentComplete < 100 && (
            <span className="text-[10px] text-[var(--color-text-muted)] ml-1">{item.percentComplete}%</span>
          )}
        </div>
      )}

      {/* Date Label */}
      {style.showDate && (
        <div
          className="absolute whitespace-nowrap truncate cursor-pointer"
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
        >
          <span>
            {format(parseISO(item.startDate), style.dateFormat)} - {format(parseISO(item.endDate), style.dateFormat)}
          </span>
        </div>
      )}

      {/* Duration Label */}
      {style.showDuration && (
        <div
          className="absolute whitespace-nowrap truncate cursor-pointer"
          style={{
            fontSize: style.durationFontSize,
            fontFamily: style.durationFontFamily,
            fontWeight: style.durationFontWeight,
            fontStyle: style.durationFontStyle ?? 'normal',
            textDecoration: style.durationTextDecoration ?? 'none',
            color: style.durationFontColor,
            maxWidth: 200,
            overflow: 'hidden',
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
        >
          <span>{formatDuration(item.startDate, item.endDate, style.durationFormat)}</span>
        </div>
      )}

      {/* Percent Complete Label */}
      {style.showPercentComplete && (
        <div
          className="absolute whitespace-nowrap truncate cursor-pointer"
          style={{
            fontSize: style.pctFontSize,
            fontFamily: style.pctFontFamily,
            fontWeight: style.pctFontWeight,
            fontStyle: style.pctFontStyle ?? 'normal',
            textDecoration: style.pctTextDecoration ?? 'none',
            color: style.pctFontColor,
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(style.pctLabelPosition === 'left'
              ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
              : style.pctLabelPosition === 'center'
              ? { left: `${item.percentComplete}%`, top: '50%', transform: 'translate(-50%, -50%)', maxWidth: 'none' }
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
        >
          <span>{item.percentComplete}%</span>
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
  iconTopOverride?: number;
  translateX: number;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClickIcon: () => void;
  onClickLabel: () => void;
  onClickDate: () => void;
}

function MilestoneItem({ item, x, y, iconTopOverride, translateX, isSelected, isDragging, onMouseDown, onClickIcon, onClickLabel, onClickDate }: MilestoneItemProps) {
  const style = item.milestoneStyle;
  const isIndependent = item.swimlaneId === null;

  // ─── Independent milestones: vertical stack layout ───
  // "above" position: title → date → shape (top to bottom)
  // "below" position: shape → date → title (top to bottom)
  if (isIndependent) {
    const iconTop = iconTopOverride !== undefined ? iconTopOverride : y + ROW_HEIGHT / 2 - style.size / 2;

    // Build the title element
    const titleEl = style.showTitle ? (
      <div
        className="whitespace-nowrap truncate cursor-pointer text-center"
        style={{
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle ?? 'normal',
          textDecoration: style.textDecoration ?? 'none',
          color: style.fontColor,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
      >
        {item.name}
      </div>
    ) : null;

    // Build the date element
    const dateEl = style.showDate ? (
      <div
        className="whitespace-nowrap cursor-pointer text-center"
        style={{
          fontSize: style.dateFontSize,
          fontFamily: style.dateFontFamily,
          fontWeight: style.dateFontWeight,
          fontStyle: style.dateFontStyle ?? 'normal',
          textDecoration: style.dateTextDecoration ?? 'none',
          color: style.dateFontColor,
        }}
        onClick={(e) => { e.stopPropagation(); onClickDate(); }}
      >
        {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
      </div>
    ) : null;

    // Build the icon element
    const iconEl = (
      <div
        className={`relative cursor-pointer ${isSelected ? 'drop-shadow-lg' : ''}`}
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
        className={`absolute cursor-grab select-none ${isDragging ? 'cursor-grabbing z-30 opacity-80' : 'z-10'}`}
        style={{
          left: x - style.size / 2,
          top: iconTop,
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease',
        }}
        onMouseDown={onMouseDown}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
      >
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
  const iconTop = iconTopOverride !== undefined ? iconTopOverride : y + ROW_HEIGHT / 2 - style.size / 2;

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
      className={`absolute cursor-grab select-none ${isDragging ? 'cursor-grabbing z-30 opacity-80' : 'z-10'}`}
      style={{
        left: x - style.size / 2,
        top: iconTop,
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.15s ease',
      }}
      onMouseDown={onMouseDown}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
    >
      <div
        className={`relative cursor-pointer ${isSelected ? 'drop-shadow-lg' : ''}`}
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
            className="truncate cursor-pointer"
            style={{
              fontSize: style.fontSize,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle ?? 'normal',
              textDecoration: style.textDecoration ?? 'none',
              color: style.fontColor,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
          >
            {item.name}
          </div>
          <div
            className="cursor-pointer"
            style={{
              fontSize: style.dateFontSize,
              fontFamily: style.dateFontFamily,
              fontWeight: style.dateFontWeight,
              fontStyle: style.dateFontStyle ?? 'normal',
              textDecoration: style.dateTextDecoration ?? 'none',
              color: style.dateFontColor,
            }}
            onClick={(e) => { e.stopPropagation(); onClickDate(); }}
          >
            {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
          </div>
        </div>
      ) : (
        <>
          {/* Title label */}
          {style.showTitle && (
            <div
              className="absolute whitespace-nowrap truncate cursor-pointer"
              style={{
                fontSize: style.fontSize,
                fontFamily: style.fontFamily,
                fontWeight: style.fontWeight,
                fontStyle: style.fontStyle ?? 'normal',
                textDecoration: style.textDecoration ?? 'none',
                color: style.fontColor,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...sideStyle(titlePos),
              }}
              onClick={(e) => { e.stopPropagation(); onClickLabel(); }}
            >
              <span>{item.name}</span>
            </div>
          )}

          {/* Date label */}
          {style.showDate && (
            <div
              className="absolute whitespace-nowrap cursor-pointer"
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
            >
              {format(parseISO(item.startDate), style.dateFormat || 'MMM d')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
