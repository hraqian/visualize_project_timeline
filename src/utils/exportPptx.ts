/**
 * Native PowerPoint export — recreates the timeline as editable PPTX shapes.
 */
import PptxGenJS from 'pptxgenjs';
import {
  differenceInDays,
  parseISO,
  format,
} from 'date-fns';
import type {
  ProjectItem,
  Swimlane,
  Dependency,
  TimescaleConfig,
  TaskLayout,
  DurationFormat,
  LabelPosition,
} from '@/types';
import {
  getProjectRangePadded,
  generateTierLabels,
  buildVisibleTierCells,
  computeAutoFontSize,
  resolveAutoUnit,
} from '@/utils/index';

// ─── Constants (mirror TimelineView) ─────────────────────────────────────────

const ROW_HEIGHT = 44;
const SWIMLANE_BADGE_WIDTH = 120;
const INDEPENDENT_SECTION_PADDING = 12;
const SWIMLANE_PADDING_TOP = 10;
const SWIMLANE_PADDING_BOTTOM = 10;
const OUTLINE_THICKNESS_MAP: Record<string, number> = { none: 0, thin: 1, medium: 2, thick: 3 };
const CONNECTOR_THICKNESS_MAP: Record<string, number> = { thin: 1, medium: 2, thick: 3 };

// ─── Slide layout ────────────────────────────────────────────────────────────

const SLIDE_W = 13.333; // inches (widescreen 16:9)
const SLIDE_H = 7.5;
const MARGIN = 0.4; // inches margin on each side
const CONTENT_W = SLIDE_W - MARGIN * 2;
const CONTENT_H = SLIDE_H - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert hex color #RRGGBB to PPTX color (RRGGBB without #) */
function c(hex: string): string {
  return hex.replace('#', '');
}

/** Parse hex color with optional alpha: #RRGGBB or #RRGGBBAA */
function parseHexAlpha(hex: string): { color: string; alpha: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 8) {
    const a = parseInt(clean.slice(6, 8), 16) / 255;
    return { color: clean.slice(0, 6), alpha: Math.round(a * 100) };
  }
  return { color: clean.slice(0, 6), alpha: 100 };
}

function formatDuration(startDate: string, endDate: string, fmt: DurationFormat): string {
  const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
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

/** Map font weight number to PPTX bold boolean */
function isBold(weight: number): boolean {
  return weight >= 600;
}

/** Map pptx text alignment */
function textAlign(align: string): 'left' | 'center' | 'right' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

// ─── Layout computation (mirrors TimelineView useMemo logic) ─────────────────

interface LayoutContext {
  origin: string;
  totalDays: number;
  totalWidth: number; // px
  zoom: number;
  scale: number; // px to inches
  offsetX: number; // inches offset for content area
  offsetY: number; // inches offset (below timescale)
  timescaleY: number; // inches — top of timescale bar
  timescaleHeight: number; // inches
  aboveHeight: number; // inches
}

interface SwimlaneLayout {
  swimlane: Swimlane;
  y: number; // px relative to canvas top
  height: number; // px
  contentY: number; // px
}

function computeLayout(
  items: ProjectItem[],
  swimlanes: Swimlane[],
  timescale: TimescaleConfig,
  zoom: number,
  taskLayout: TaskLayout,
  swimlaneSpacing: number,
): {
  ctx: LayoutContext;
  visibleItems: ProjectItem[];
  independentItems: ProjectItem[];
  aboveMilestones: ProjectItem[];
  belowIndependentItems: ProjectItem[];
  swimlanedItems: ProjectItem[];
  swimlaneLayout: SwimlaneLayout[];
  sortedSwimlanes: Swimlane[];
  getRow: (item: ProjectItem) => number;
  canvasHeight: number;
  tierLabels: { tier: typeof timescale.tiers[0]; labels: ReturnType<typeof generateTierLabels> }[];
  rangeEndDate: Date;
} {
  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);
  const visibleItems = items.filter((i) => i.visible);
  const swimlaneIds = new Set(swimlanes.map((s) => s.id));
  const independentItems = visibleItems.filter((i) => !swimlaneIds.has(i.swimlaneId));
  const swimlanedItemsList = visibleItems.filter((i) => swimlaneIds.has(i.swimlaneId));

  const aboveMilestones = independentItems.filter(
    (i) => i.type === 'milestone' && i.swimlaneId === null && i.milestoneStyle.position === 'above'
  );
  const belowIndependentItems = independentItems.filter(
    (i) => !(i.type === 'milestone' && i.swimlaneId === null && i.milestoneStyle.position === 'above')
  );

  // Row assignment
  const getRow = buildGetRow(taskLayout, belowIndependentItems, swimlanedItemsList, sortedSwimlanes);

  // Range computation — shared with TimelineView
  const { origin, totalDays, rangeEndDate } = getProjectRangePadded(items, timescale);
  const totalWidth = totalDays * zoom;

  // Above milestones height
  const aboveRowGap = 4;
  let aboveHeightPx = 0;
  if (aboveMilestones.length > 0) {
    const maxStack = Math.max(...aboveMilestones.map((i) => {
      const s = i.milestoneStyle;
      let h = s.size;
      if (s.showTitle) h += Math.ceil(s.fontSize * 1.25) + 1;
      if (s.showDate) h += Math.ceil(s.dateFontSize * 1.25) + 1;
      return h;
    }), 20);
    aboveHeightPx = maxStack + aboveRowGap * 2;
  }

  // Independent height
  let independentHeight = 0;
  if (belowIndependentItems.length > 0) {
    const maxRow = Math.max(...belowIndependentItems.map((i) => getRow(i)), 0);
    independentHeight = (maxRow + 1) * ROW_HEIGHT + INDEPENDENT_SECTION_PADDING * 2;
  }

  // Swimlane layout
  let y = independentHeight;
  const swimlaneLayoutList: SwimlaneLayout[] = [];
  for (let i = 0; i < sortedSwimlanes.length; i++) {
    const sl = sortedSwimlanes[i];
    if (i > 0) y += swimlaneSpacing;
    const slItems = swimlanedItemsList.filter((it) => it.swimlaneId === sl.id);
    const maxRow = slItems.length > 0 ? Math.max(...slItems.map((it) => getRow(it))) : 0;
    const contentHeight = (maxRow + 1) * ROW_HEIGHT;
    const height = SWIMLANE_PADDING_TOP + contentHeight + SWIMLANE_PADDING_BOTTOM;
    swimlaneLayoutList.push({ swimlane: sl, y, height, contentY: y + SWIMLANE_PADDING_TOP });
    y += height;
  }

  const canvasHeight = (swimlaneLayoutList.length > 0
    ? swimlaneLayoutList[swimlaneLayoutList.length - 1].y + swimlaneLayoutList[swimlaneLayoutList.length - 1].height
    : independentHeight) || ROW_HEIGHT * 2;

  // Tier labels
  const rangeStart = parseISO(origin);
  const tierLabels = timescale.tiers
    .filter((tier) => tier.visible)
    .map((tier) => {
      const resolvedUnit = tier.unit === 'auto' ? resolveAutoUnit(totalDays) : tier.unit;
      const resolvedFormat = tier.unit === 'auto' ? undefined : tier.format;
      return {
        tier: { ...tier, unit: resolvedUnit },
        labels: generateTierLabels(resolvedUnit, rangeStart, rangeEndDate, timescale.fiscalYearStartMonth, resolvedFormat),
      };
    });

  const timescaleHeightPx = tierLabels.length * 28;
  const totalContentHeightPx = aboveHeightPx + timescaleHeightPx + canvasHeight;

  // Scale to fit slide
  const scale = Math.min(CONTENT_W / totalWidth, CONTENT_H / totalContentHeightPx);
  const renderedW = totalWidth * scale;
  const renderedH = totalContentHeightPx * scale;
  const offsetX = MARGIN + (CONTENT_W - renderedW) / 2;
  const offsetY = MARGIN + (CONTENT_H - renderedH) / 2;

  const ctx: LayoutContext = {
    origin,
    totalDays,
    totalWidth,
    zoom,
    scale,
    offsetX,
    offsetY: offsetY + (aboveHeightPx + timescaleHeightPx) * scale,
    timescaleY: offsetY + aboveHeightPx * scale,
    timescaleHeight: timescaleHeightPx * scale,
    aboveHeight: aboveHeightPx * scale,
  };

  return {
    ctx,
    visibleItems,
    independentItems,
    aboveMilestones,
    belowIndependentItems,
    swimlanedItems: swimlanedItemsList,
    swimlaneLayout: swimlaneLayoutList,
    sortedSwimlanes,
    getRow,
    canvasHeight,
    tierLabels,
    rangeEndDate,
  };
}

function buildGetRow(
  taskLayout: TaskLayout,
  belowIndependentItems: ProjectItem[],
  swimlanedItems: ProjectItem[],
  sortedSwimlanes: Swimlane[],
): (item: ProjectItem) => number {
  if (taskLayout === 'single-row') {
    return (item) => item.row;
  }
  const rowMap = new Map<string, number>();
  const assignRows = (groupItems: ProjectItem[]) => {
    const sorted = [...groupItems].sort((a, b) => a.row - b.row || a.startDate.localeCompare(b.startDate));
    if (taskLayout === 'one-per-row') {
      sorted.forEach((it, idx) => rowMap.set(it.id, idx));
    } else {
      const rowEnds: number[] = [];
      for (const it of sorted) {
        const start = parseISO(it.startDate).getTime();
        const end = parseISO(it.endDate).getTime();
        let placed = false;
        for (let r = 0; r < rowEnds.length; r++) {
          if (start >= rowEnds[r]) {
            rowMap.set(it.id, r);
            rowEnds[r] = end + 1;
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
  assignRows(belowIndependentItems);
  for (const sl of sortedSwimlanes) {
    const slItems = swimlanedItems.filter((it) => it.swimlaneId === sl.id);
    assignRows(slItems);
  }
  return (item) => rowMap.get(item.id) ?? item.row;
}

// ─── Coordinate converters ───────────────────────────────────────────────────

function px2in(px: number, scale: number): number {
  return px * scale;
}

function itemX(date: string, ctx: LayoutContext): number {
  return ctx.offsetX + differenceInDays(parseISO(date), parseISO(ctx.origin)) * ctx.zoom * ctx.scale;
}

function canvasY(pyPx: number, ctx: LayoutContext): number {
  return ctx.offsetY + pyPx * ctx.scale;
}

// ─── Drawing functions ───────────────────────────────────────────────────────

function drawTimescale(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  tierLabels: { tier: TimescaleConfig['tiers'][0]; labels: ReturnType<typeof generateTierLabels> }[],
  timescale: TimescaleConfig,
  origin: string,
  rangeEndDate: Date,
) {
  const tierHeight = px2in(28, ctx.scale);

  // End caps
  if (timescale.leftEndCap?.show) {
    const cap = timescale.leftEndCap;
    const fontSize = Math.max(6, cap.fontSize * ctx.scale * 0.75);
    slide.addText(format(parseISO(origin), 'yyyy'), {
      x: ctx.offsetX - px2in(cap.fontSize * 3 + 12, ctx.scale),
      y: ctx.timescaleY,
      w: px2in(cap.fontSize * 3 + 12, ctx.scale),
      h: ctx.timescaleHeight,
      fontSize,
      fontFace: cap.fontFamily,
      bold: isBold(cap.fontWeight),
      italic: cap.fontStyle === 'italic',
      color: c(cap.fontColor),
      align: 'right',
      valign: 'middle',
    });
  }

  if (timescale.rightEndCap?.show) {
    const cap = timescale.rightEndCap;
    const fontSize = Math.max(6, cap.fontSize * ctx.scale * 0.75);
    slide.addText(format(rangeEndDate, 'yyyy'), {
      x: ctx.offsetX + px2in(ctx.totalWidth, ctx.scale),
      y: ctx.timescaleY,
      w: px2in(cap.fontSize * 3 + 12, ctx.scale),
      h: ctx.timescaleHeight,
      fontSize,
      fontFace: cap.fontFamily,
      bold: isBold(cap.fontWeight),
      italic: cap.fontStyle === 'italic',
      color: c(cap.fontColor),
      align: 'left',
      valign: 'middle',
    });
  }

  // Tier rows
  tierLabels.forEach(({ tier, labels }, tierIdx) => {
    const tierY = ctx.timescaleY + tierIdx * tierHeight;
    const originDate = parseISO(origin);
    const cells = buildVisibleTierCells(labels, tier.unit, originDate, ctx.totalDays, ctx.totalWidth);

    // Background bar
    slide.addShape('rect', {
      x: ctx.offsetX,
      y: tierY,
      w: px2in(ctx.totalWidth, ctx.scale),
      h: tierHeight,
      fill: { color: c(tier.backgroundColor) },
      line: { color: c(tier.backgroundColor), width: 0 },
    });

    // Cell labels
    const cellWidthPx = cells.length > 0 ? cells[0].widthFrac * ctx.totalWidth : 0;
    const baseFontSize = (tier.fontSizeAuto ?? true)
      ? computeAutoFontSize(cells, tier.fontFamily, tier.fontWeight, tier.fontStyle, cellWidthPx, 12)
      : tier.fontSize;
    for (const cell of cells) {
      const cellX = ctx.offsetX + px2in(cell.fraction * ctx.totalWidth, ctx.scale);
      const cellW = px2in(cell.widthFrac * ctx.totalWidth, ctx.scale);
      const fontSize = Math.max(5, baseFontSize * ctx.scale * 0.75);

      // Separator line
      if (tier.separators && cell.fraction > 0.001) {
        slide.addShape('line', {
          x: cellX,
          y: tierY,
          w: 0,
          h: tierHeight,
          line: { color: 'FFFFFF', width: 0.5, transparency: 80 },
        });
      }

      slide.addText(cell.label, {
        x: cellX,
        y: tierY,
        w: cellW,
        h: tierHeight,
        fontSize,
        fontFace: tier.fontFamily,
        bold: isBold(tier.fontWeight),
        italic: tier.fontStyle === 'italic',
        color: c(tier.fontColor),
        align: 'left',
        valign: 'middle',
        margin: [0, 0, 0, 2],
      });
    }
  });

  // Today marker
  if (timescale.showToday) {
    const todayXPx = differenceInDays(new Date(), parseISO(origin)) * ctx.zoom;
    if (todayXPx >= 0 && todayXPx <= ctx.totalWidth) {
      const tx = ctx.offsetX + px2in(todayXPx, ctx.scale);
      const lineTop = ctx.timescaleY;
      const lineBottom = ctx.timescaleY + ctx.timescaleHeight;
      // Vertical line through timescale
      slide.addShape('line', {
        x: tx,
        y: lineTop,
        w: 0,
        h: lineBottom - lineTop,
        line: { color: c(timescale.todayColor), width: 1 },
      });
    }
  }

  // Elapsed time bar
  if (timescale.showElapsedTime) {
    const todayXPx = differenceInDays(new Date(), parseISO(origin)) * ctx.zoom;
    if (todayXPx > 0) {
      const barW = px2in(Math.min(todayXPx, ctx.totalWidth), ctx.scale);
      const thickness = (timescale.elapsedTimeThickness ?? 'thin') === 'thick' ? 6 : 3;
      const barH = px2in(thickness, ctx.scale);
      const barY = (timescale.todayPosition ?? 'below') === 'above'
        ? ctx.timescaleY
        : ctx.timescaleY + ctx.timescaleHeight - barH;
      slide.addShape('rect', {
        x: ctx.offsetX,
        y: barY,
        w: barW,
        h: barH,
        fill: { color: c(timescale.elapsedTimeColor ?? '#ef4444') },
        line: { width: 0 },
      });
    }
  }
}

function drawGridLines(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  tierLabels: { tier: TimescaleConfig['tiers'][0]; labels: ReturnType<typeof generateTierLabels> }[],
  canvasHeight: number,
) {
  if (tierLabels.length === 0) return;
  const lastTier = tierLabels[tierLabels.length - 1];
  for (const label of lastTier.labels) {
    const xPx = differenceInDays(label.startDate, parseISO(ctx.origin)) * ctx.zoom;
    if (xPx <= 0 || xPx >= ctx.totalWidth) continue;
    const x = ctx.offsetX + px2in(xPx, ctx.scale);
    slide.addShape('line', {
      x,
      y: ctx.offsetY,
      w: 0,
      h: px2in(canvasHeight, ctx.scale),
      line: { color: 'E2E8F0', width: 0.25, transparency: 85 },
    });
  }
}

function drawSwimlanes(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  swimlaneLayout: SwimlaneLayout[],
) {
  for (const { swimlane, y: yPx, height: hPx } of swimlaneLayout) {
    const y = canvasY(yPx, ctx);
    const h = px2in(hPx, ctx.scale);
    const w = px2in(ctx.totalWidth, ctx.scale);

    // Body background
    const bodyAlpha = swimlane.bodyTransparency;
    slide.addShape('rect', {
      x: ctx.offsetX,
      y,
      w,
      h,
      fill: { color: c(swimlane.bodyColor), transparency: bodyAlpha },
      line: (() => {
        const outlinePx = OUTLINE_THICKNESS_MAP[swimlane.outlineThickness] ?? 0;
        if (outlinePx > 0) {
          return { color: c(swimlane.outlineColor), width: outlinePx * 0.5 };
        }
        return { width: 0 };
      })(),
      rectRadius: 0.03,
    });

    // Badge
    const badgeW = px2in(SWIMLANE_BADGE_WIDTH, ctx.scale);
    const headerAlpha = swimlane.headerTransparency;
    slide.addShape('rect', {
      x: ctx.offsetX,
      y,
      w: badgeW,
      h,
      fill: { color: c(swimlane.headerColor), transparency: headerAlpha },
      line: { width: 0 },
      rectRadius: 0.03,
    });

    // Badge text
    const fontSize = Math.max(5, swimlane.titleFontSize * ctx.scale * 0.75);
    slide.addText(swimlane.name, {
      x: ctx.offsetX,
      y,
      w: badgeW,
      h,
      fontSize,
      fontFace: swimlane.titleFontFamily,
      bold: isBold(swimlane.titleFontWeight),
      italic: swimlane.titleFontStyle === 'italic',
      color: c(swimlane.titleFontColor),
      align: 'center',
      valign: 'middle',
    });
  }
}

function drawTaskBar(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  item: ProjectItem,
  yBasePx: number,
  rowNum: number,
) {
  const style = item.taskStyle;
  const x = itemX(item.startDate, ctx);
  const barWidthPx = (differenceInDays(parseISO(item.endDate), parseISO(item.startDate)) + 1) * ctx.zoom;
  const w = px2in(Math.max(barWidthPx, 8), ctx.scale);
  const barHeightPx = style.thickness;
  const h = px2in(barHeightPx, ctx.scale);
  const rowY = yBasePx + rowNum * ROW_HEIGHT;
  const barYPx = rowY + (ROW_HEIGHT - barHeightPx) / 2;
  const y = canvasY(barYPx, ctx);

  // Bar border radius (simplified for PPTX)
  let rectRadius = 0.02;
  const shape = style.barShape;
  if (shape === 'capsule') rectRadius = h / 2;
  else if (shape === 'rounded') rectRadius = Math.min(0.06, h / 2);
  else if (shape === 'flat' || shape === 'square') rectRadius = 0;

  // Bar background (light fill)
  const { color: barColor } = parseHexAlpha(style.color);
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: barColor, transparency: 80 },
    line: { color: barColor, width: 0.5, transparency: 50 },
    rectRadius,
  });

  // Progress fill
  if (item.percentComplete > 0) {
    const progressW = w * (item.percentComplete / 100);
    slide.addShape('rect', {
      x, y, w: progressW, h,
      fill: { color: barColor, transparency: 15 },
      line: { width: 0 },
      rectRadius,
    });
  }

  // Vertical connector lines
  if (style.showVerticalConnector) {
    const connW = CONNECTOR_THICKNESS_MAP[style.connectorThickness] ?? 1;
    const connColor = c(style.connectorColor);
    // Start edge
    slide.addShape('line', {
      x, y: ctx.offsetY, w: 0, h: y - ctx.offsetY,
      line: { color: connColor, width: connW * 0.5, dashType: 'dash' },
    });
    // End edge
    const endX = x + w;
    slide.addShape('line', {
      x: endX, y: ctx.offsetY, w: 0, h: y - ctx.offsetY,
      line: { color: connColor, width: connW * 0.5, dashType: 'dash' },
    });
  }

  // Labels
  const labelPad = px2in(8, ctx.scale);
  const rowCenterY = y + h / 2;

  // Title
  if (style.showTitle) {
    const fontSize = Math.max(5, style.fontSize * ctx.scale * 0.75);
    const maxW = px2in(200, ctx.scale);
    const textH = px2in(style.fontSize * 1.5, ctx.scale);
    const pos = labelPosition(style.labelPosition, x, y, w, h, labelPad, maxW, textH, rowCenterY);
    slide.addText(item.name, {
      ...pos,
      fontSize,
      fontFace: style.fontFamily,
      bold: isBold(style.fontWeight),
      italic: style.fontStyle === 'italic',
      underline: style.textDecoration === 'underline' ? { style: 'sng' } : undefined,
      color: c(style.fontColor),
      align: style.labelPosition === 'center' ? textAlign(style.textAlign) : 'left',
      valign: 'middle',
    });
  }

  // Date
  if (style.showDate) {
    const dateText = `${format(parseISO(item.startDate), style.dateFormat)} - ${format(parseISO(item.endDate), style.dateFormat)}`;
    const fontSize = Math.max(5, style.dateFontSize * ctx.scale * 0.75);
    const maxW = px2in(200, ctx.scale);
    const textH = px2in(style.dateFontSize * 1.5, ctx.scale);
    const stackOffset = style.showTitle && sameVerticalSide(style.labelPosition, style.dateLabelPosition) ? px2in(16, ctx.scale) : 0;
    const pos = labelPosition(style.dateLabelPosition, x, y, w, h, labelPad, maxW, textH, rowCenterY, stackOffset);
    slide.addText(dateText, {
      ...pos,
      fontSize,
      fontFace: style.dateFontFamily,
      bold: isBold(style.dateFontWeight),
      italic: style.dateFontStyle === 'italic',
      color: c(style.dateFontColor),
      align: 'left',
      valign: 'middle',
    });
  }

  // Duration
  if (style.showDuration) {
    const durText = formatDuration(item.startDate, item.endDate, style.durationFormat);
    const fontSize = Math.max(5, style.durationFontSize * ctx.scale * 0.75);
    const maxW = px2in(200, ctx.scale);
    const textH = px2in(style.durationFontSize * 1.5, ctx.scale);
    let stackOffset = 0;
    if (style.showTitle && sameVerticalSide(style.labelPosition, style.durationLabelPosition)) stackOffset += px2in(16, ctx.scale);
    if (style.showDate && sameVerticalSide(style.dateLabelPosition, style.durationLabelPosition)) stackOffset += px2in(16, ctx.scale);
    const pos = labelPosition(style.durationLabelPosition, x, y, w, h, labelPad, maxW, textH, rowCenterY, stackOffset);
    slide.addText(durText, {
      ...pos,
      fontSize,
      fontFace: style.durationFontFamily,
      bold: isBold(style.durationFontWeight),
      italic: style.durationFontStyle === 'italic',
      color: c(style.durationFontColor),
      align: 'left',
      valign: 'middle',
    });
  }

  // Percent complete
  if (style.showPercentComplete && item.percentComplete > 0) {
    const pctText = `${item.percentComplete}%`;
    const fontSize = Math.max(5, style.pctFontSize * ctx.scale * 0.75);
    const maxW = px2in(60, ctx.scale);
    const textH = px2in(style.pctFontSize * 1.5, ctx.scale);

    if (style.pctLabelPosition === 'center') {
      // Special center positioning: at progress edge
      const pctX = x + w * (item.percentComplete / 100);
      slide.addText(pctText, {
        x: pctX - maxW / 2,
        y: rowCenterY - textH / 2,
        w: maxW,
        h: textH,
        fontSize,
        fontFace: style.pctFontFamily,
        bold: isBold(style.pctFontWeight),
        italic: style.pctFontStyle === 'italic',
        color: c(style.pctFontColor),
        align: 'center',
        valign: 'middle',
      });
    } else {
      let stackOffset = 0;
      if (style.showTitle && sameVerticalSide(style.labelPosition, style.pctLabelPosition)) stackOffset += px2in(16, ctx.scale);
      if (style.showDate && sameVerticalSide(style.dateLabelPosition, style.pctLabelPosition)) stackOffset += px2in(16, ctx.scale);
      if (style.showDuration && sameVerticalSide(style.durationLabelPosition, style.pctLabelPosition)) stackOffset += px2in(16, ctx.scale);
      const pos = labelPosition(style.pctLabelPosition, x, y, w, h, labelPad, maxW, textH, rowCenterY, stackOffset);
      slide.addText(pctText, {
        ...pos,
        fontSize,
        fontFace: style.pctFontFamily,
        bold: isBold(style.pctFontWeight),
        italic: style.pctFontStyle === 'italic',
        color: c(style.pctFontColor),
        align: 'left',
        valign: 'middle',
      });
    }
  }
}

function sameVerticalSide(pos1: LabelPosition, pos2: LabelPosition): boolean {
  return (pos1 === 'above' && pos2 === 'above') || (pos1 === 'below' && pos2 === 'below');
}

function labelPosition(
  pos: LabelPosition,
  x: number, y: number, w: number, h: number,
  pad: number, maxW: number, textH: number, rowCenterY: number,
  stackOffset = 0,
): { x: number; y: number; w: number; h: number } {
  switch (pos) {
    case 'far-left':
      return { x: x - maxW - pad * 3, y: rowCenterY - textH / 2, w: maxW, h: textH };
    case 'left':
      return { x: x - maxW - pad, y: rowCenterY - textH / 2, w: maxW, h: textH };
    case 'center':
      return { x, y: rowCenterY - textH / 2, w, h: textH };
    case 'above':
      return { x, y: y - textH - stackOffset, w: maxW, h: textH };
    case 'below':
      return { x, y: y + h + stackOffset, w: maxW, h: textH };
    case 'right':
    default:
      return { x: x + w + pad, y: rowCenterY - textH / 2, w: maxW, h: textH };
  }
}

function drawMilestone(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  item: ProjectItem,
  yBasePx: number,
  rowNum: number,
  isAbove: boolean,
  aboveYPx?: number,
) {
  const style = item.milestoneStyle;
  const xPx = differenceInDays(parseISO(item.startDate), parseISO(ctx.origin)) * ctx.zoom;
  const centerX = ctx.offsetX + px2in(xPx, ctx.scale);
  const sizePx = style.size;
  const sizeIn = px2in(sizePx, ctx.scale);

  let centerYIn: number;
  if (isAbove && aboveYPx !== undefined) {
    // Above milestones: position relative to timescale top
    centerYIn = ctx.timescaleY - ctx.aboveHeight + px2in(aboveYPx + sizePx / 2, ctx.scale);
  } else {
    const rowY = yBasePx + rowNum * ROW_HEIGHT;
    centerYIn = canvasY(rowY + ROW_HEIGHT / 2, ctx);
  }

  // Diamond shape (default milestone representation)
  const halfSize = sizeIn / 2;
  slide.addShape('diamond', {
    x: centerX - halfSize,
    y: centerYIn - halfSize,
    w: sizeIn,
    h: sizeIn,
    fill: { color: c(style.color) },
    line: { color: c(style.color), width: 0.5 },
  });

  // Title label
  if (style.showTitle) {
    const fontSize = Math.max(5, style.fontSize * ctx.scale * 0.75);
    const maxW = px2in(200, ctx.scale);
    const textH = px2in(style.fontSize * 1.5, ctx.scale);
    const pad = px2in(6, ctx.scale);
    const pos = milestoneLabelPosition(style.labelPosition, centerX, centerYIn, halfSize, pad, maxW, textH);
    slide.addText(item.name, {
      ...pos,
      fontSize,
      fontFace: style.fontFamily,
      bold: isBold(style.fontWeight),
      italic: style.fontStyle === 'italic',
      color: c(style.fontColor),
      align: (style.labelPosition === 'above' || style.labelPosition === 'below') ? 'center' : 'left',
      valign: 'middle',
    });
  }

  // Date label
  if (style.showDate) {
    const dateText = format(parseISO(item.startDate), style.dateFormat || 'MMM d');
    const fontSize = Math.max(5, style.dateFontSize * ctx.scale * 0.75);
    const maxW = px2in(150, ctx.scale);
    const textH = px2in(style.dateFontSize * 1.5, ctx.scale);
    const pad = px2in(6, ctx.scale);
    // Stack below title if same side
    let stackOffset = 0;
    if (style.showTitle && style.labelPosition === style.dateLabelPosition) {
      stackOffset = px2in(style.fontSize * 1.5, ctx.scale);
    }
    const pos = milestoneLabelPosition(style.dateLabelPosition, centerX, centerYIn, halfSize, pad, maxW, textH, stackOffset);
    slide.addText(dateText, {
      ...pos,
      fontSize,
      fontFace: style.dateFontFamily,
      bold: isBold(style.dateFontWeight),
      italic: style.dateFontStyle === 'italic',
      color: c(style.dateFontColor),
      align: (style.dateLabelPosition === 'above' || style.dateLabelPosition === 'below') ? 'center' : 'left',
      valign: 'middle',
    });
  }
}

function milestoneLabelPosition(
  pos: LabelPosition,
  centerX: number, centerY: number,
  halfSize: number, pad: number,
  maxW: number, textH: number,
  stackOffset = 0,
): { x: number; y: number; w: number; h: number } {
  switch (pos) {
    case 'above':
      return { x: centerX - maxW / 2, y: centerY - halfSize - textH - pad - stackOffset, w: maxW, h: textH };
    case 'below':
      return { x: centerX - maxW / 2, y: centerY + halfSize + pad + stackOffset, w: maxW, h: textH };
    case 'left':
    case 'far-left':
      return { x: centerX - halfSize - maxW - pad, y: centerY - textH / 2 + stackOffset, w: maxW, h: textH };
    case 'right':
    default:
      return { x: centerX + halfSize + pad, y: centerY - textH / 2 + stackOffset, w: maxW, h: textH };
  }
}

function drawDependencies(
  slide: PptxGenJS.Slide,
  ctx: LayoutContext,
  dependencies: Dependency[],
  items: ProjectItem[],
  belowIndependentItems: ProjectItem[],
  swimlanedItems: ProjectItem[],
  swimlaneLayout: SwimlaneLayout[],
  getRow: (item: ProjectItem) => number,
) {
  const itemMap = new Map(items.filter(i => i.visible).map(i => [i.id, i]));

  for (const dep of dependencies) {
    const from = itemMap.get(dep.fromId);
    const to = itemMap.get(dep.toId);
    if (!from || !to) continue;

    // Compute from point
    const fromEndXPx = differenceInDays(parseISO(from.endDate), parseISO(ctx.origin)) * ctx.zoom +
      (from.type === 'task' ? ctx.zoom : from.milestoneStyle.size / 2);
    const fromX = ctx.offsetX + px2in(fromEndXPx, ctx.scale);

    // Compute to point
    const toStartXPx = differenceInDays(parseISO(to.startDate), parseISO(ctx.origin)) * ctx.zoom -
      (to.type === 'milestone' ? to.milestoneStyle.size / 2 : 0);
    const toX = ctx.offsetX + px2in(toStartXPx, ctx.scale);

    // Y positions
    const fromYPx = getItemCenterYPx(from, belowIndependentItems, swimlanedItems, swimlaneLayout, getRow);
    const toYPx = getItemCenterYPx(to, belowIndependentItems, swimlanedItems, swimlaneLayout, getRow);
    const fromY = canvasY(fromYPx, ctx);
    const toY = canvasY(toYPx, ctx);

    const isCrit = from.isCriticalPath && to.isCriticalPath;
    const color = isCrit ? 'EF4444' : '475569';
    const lineW = isCrit ? 1 : 0.75;

    // Draw as a simple line (PPTX doesn't support bezier curves natively without custom paths)
    // Use a connector-style line
    slide.addShape('line', {
      x: fromX,
      y: fromY,
      w: toX - fromX,
      h: toY - fromY,
      line: {
        color,
        width: lineW,
        dashType: isCrit ? 'solid' : 'dash',
        endArrowType: 'triangle',
      },
    });
  }
}

function getItemCenterYPx(
  item: ProjectItem,
  belowIndependentItems: ProjectItem[],
  swimlanedItems: ProjectItem[],
  swimlaneLayout: SwimlaneLayout[],
  getRow: (item: ProjectItem) => number,
): number {
  const row = getRow(item);
  // Check if independent
  if (belowIndependentItems.some(i => i.id === item.id)) {
    return INDEPENDENT_SECTION_PADDING + row * ROW_HEIGHT + ROW_HEIGHT / 2;
  }
  // Check swimlane
  const slLayout = swimlaneLayout.find(sl => sl.swimlane.id === item.swimlaneId);
  if (slLayout) {
    return slLayout.contentY + row * ROW_HEIGHT + ROW_HEIGHT / 2;
  }
  return row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

// ─── Main Export Function ────────────────────────────────────────────────────

export async function exportNativePptx(
  projectName: string,
  items: ProjectItem[],
  swimlanes: Swimlane[],
  dependencies: Dependency[],
  timescale: TimescaleConfig,
  zoom: number,
  taskLayout: TaskLayout,
  swimlaneSpacing: number,
): Promise<void> {
  const {
    ctx,
    aboveMilestones,
    belowIndependentItems,
    swimlanedItems,
    swimlaneLayout,
    sortedSwimlanes,
    getRow,
    canvasHeight,
    tierLabels,
    rangeEndDate,
  } = computeLayout(items, swimlanes, timescale, zoom, taskLayout, swimlaneSpacing);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'WIDE';
  const slide = pptx.addSlide();

  // 1. Grid lines (background)
  drawGridLines(slide, ctx, tierLabels, canvasHeight);

  // 2. Swimlane bands + badges
  drawSwimlanes(slide, ctx, swimlaneLayout);

  // 3. Timescale header
  drawTimescale(slide, ctx, tierLabels, timescale, ctx.origin, rangeEndDate);

  // 4. Task bars and milestones
  // Independent "below" items
  for (const item of belowIndependentItems) {
    const row = getRow(item);
    if (item.type === 'task') {
      drawTaskBar(slide, ctx, item, INDEPENDENT_SECTION_PADDING, row);
    } else {
      drawMilestone(slide, ctx, item, INDEPENDENT_SECTION_PADDING, row, false);
    }
  }

  // "Above" milestones
  const aboveRowGap = 4;
  for (const item of aboveMilestones) {
    const s = item.milestoneStyle;
    let stackH = s.size;
    if (s.showTitle) stackH += Math.ceil(s.fontSize * 1.25) + 1;
    if (s.showDate) stackH += Math.ceil(s.dateFontSize * 1.25) + 1;
    const aboveHeightPx = ctx.aboveHeight / ctx.scale;
    const ay = aboveHeightPx - stackH - aboveRowGap;
    drawMilestone(slide, ctx, item, 0, 0, true, ay);
  }

  // Swimlaned items
  for (const sl of swimlaneLayout) {
    const slItems = swimlanedItems.filter((it) => it.swimlaneId === sl.swimlane.id);
    for (const item of slItems) {
      const row = getRow(item);
      if (item.type === 'task') {
        drawTaskBar(slide, ctx, item, sl.contentY, row);
      } else {
        drawMilestone(slide, ctx, item, sl.contentY, row, false);
      }
    }
  }

  // 5. Dependency lines
  drawDependencies(slide, ctx, dependencies, items, belowIndependentItems, swimlanedItems, swimlaneLayout, getRow);

  // Write file
  const fileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx`;
  await pptx.writeFile({ fileName });
}
