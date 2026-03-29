import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Paintbrush } from 'lucide-react';
import { MilestoneIconComponent } from '@/components/common/MilestoneIconComponent';
import type { BarShape, MilestoneIcon, ItemType, TaskStyle, MilestoneStyle } from '@/types';
import { BAR_SHAPE_LABELS, BAR_SHAPE_OPTIONS, DATA_VIEW_COLOR_SWATCHES, MILESTONE_ICON_OPTIONS } from '@/components/common/pickerOptions';

// ─── SVG task bar shape previews ─────────────────────────────────────────────

function TaskShapePreview({ shape, color, size = 32 }: { shape: BarShape; color: string; size?: number }) {
  const w = size;
  const h = size * 0.55;
  const inset = h * 0.35;
  const smallInset = inset * 0.5;

  // Parallelogram helpers for arrow-both and notched
  const s = h / Math.tan((75 * Math.PI) / 180);
  const r = Math.min(h * 0.3, s * 0.8);
  const rBig = r * 2.5;
  const len = Math.sqrt(s * s + h * h);
  const dx = (s / len) * r, dy = (h / len) * r;
  const dxB = (s / len) * rBig, dyB = (h / len) * rBig;
  const rSmall = r * 0.25;
  const dxS = (s / len) * rSmall, dyS = (h / len) * rSmall;

  const rr = h * 0.3; // rounded rectangle corner radius

  const paths: Record<BarShape, string> = {
    square: `M1,1 H${w - 1} V${h - 1} H1 Z`,
    rounded: `M${rr},1 H${w - rr} Q${w - 1},1 ${w - 1},${rr} V${h - rr} Q${w - 1},${h - 1} ${w - rr},${h - 1} H${rr} Q1,${h - 1} 1,${h - rr} V${rr} Q1,1 ${rr},1 Z`,
    capsule: `M${h / 2},1 H${w - h / 2} A${h / 2 - 1},${h / 2 - 1} 0 0 1 ${w - h / 2},${h - 1} H${h / 2} A${h / 2 - 1},${h / 2 - 1} 0 0 1 ${h / 2},1 Z`,
    flat: `M1,1 H${w - 1} V${h - 1} H1 Z`,
    chevron: `M1,1 H${w - inset} L${w - 1},${h / 2} L${w - inset},${h - 1} H1 Z`,
    'double-chevron': `M1,1 H${w - inset} L${w - 1},${h / 2} L${w - inset},${h - 1} H1 L${smallInset},${h / 2} Z`,
    'arrow-right': `M1,${h * 0.15} H${w - inset} V1 L${w - 1},${h / 2} L${w - inset},${h - 1} V${h * 0.85} H1 Z`,
    pointed: `M${inset},${h * 0.15} H${w - inset} V1 L${w - 1},${h / 2} L${w - inset},${h - 1} V${h * 0.85} H${inset} V${h - 1} L1,${h / 2} L${inset},1 Z`,
    'arrow-both': `M ${s + r} 0 L ${w - rBig} 0 Q ${w} 0 ${w - dxB} ${dyB} L ${w - s + dx} ${h - dy} Q ${w - s} ${h} ${w - s - r} ${h} L ${rBig} ${h} Q 0 ${h} ${dxB} ${h - dyB} L ${s - dx} ${dy} Q ${s} 0 ${s + r} 0 Z`,
    notched: `M ${s + r} 0 L ${w - rSmall} 0 Q ${w} 0 ${w - dxS} ${dyS} L ${w - s + dx} ${h - dy} Q ${w - s} ${h} ${w - s - r} ${h} L ${rSmall} ${h} Q 0 ${h} ${dxS} ${h - dyS} L ${s - dx} ${dy} Q ${s} 0 ${s + r} 0 Z`,
    tab: `M1,1 H${w - 1} L${w - inset},${h - 1} H${inset} Z`,
    trapezoid: `M${inset},1 H${w - inset} L${w - 1},${h - 1} H1 Z`,
  };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={paths[shape]} fill={color} stroke={color} strokeWidth={0.5} opacity={0.85} />
    </svg>
  );
}

// ─── TypePickerCell (the compact cell shown in the table) ────────────────────

interface TypePickerCellProps {
  item: {
    id: string;
    type: ItemType;
    taskStyle: TaskStyle;
    milestoneStyle: MilestoneStyle;
    startDate: string;
    endDate: string;
  };
  onUpdateItem: (id: string, updates: Record<string, unknown>) => void;
  onUpdateTaskStyle: (id: string, style: Partial<TaskStyle>) => void;
  onUpdateMilestoneStyle: (id: string, style: Partial<MilestoneStyle>) => void;
}

export function TypePickerCell({ item, onUpdateItem, onUpdateTaskStyle, onUpdateMilestoneStyle }: TypePickerCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const color = item.type === 'task' ? item.taskStyle.color : item.milestoneStyle.color;
  const typeLabel = item.type === 'task' ? 'T' : 'M';

  return (
    <div className="relative" ref={ref}>
      {/* Compact cell button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-muted)] transition-colors cursor-pointer"
      >
        {/* Shape preview */}
        <span className="shrink-0">
          {item.type === 'task' ? (
            <TaskShapePreview shape={item.taskStyle.barShape} color={color} size={20} />
          ) : (
            <MilestoneIconComponent icon={item.milestoneStyle.icon} size={14} color={color} />
          )}
        </span>
        {/* Type letter */}
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{typeLabel}</span>
        {/* Dropdown arrow */}
        <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
      </button>

      {/* Popover */}
      {open && (
        <TypePickerPopover
          item={item}
          onUpdateItem={onUpdateItem}
          onUpdateTaskStyle={onUpdateTaskStyle}
          onUpdateMilestoneStyle={onUpdateMilestoneStyle}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── TypePickerPopover ───────────────────────────────────────────────────────

interface TypePickerPopoverProps {
  item: TypePickerCellProps['item'];
  onUpdateItem: TypePickerCellProps['onUpdateItem'];
  onUpdateTaskStyle: TypePickerCellProps['onUpdateTaskStyle'];
  onUpdateMilestoneStyle: TypePickerCellProps['onUpdateMilestoneStyle'];
  onClose: () => void;
}

function TypePickerPopover({ item, onUpdateItem, onUpdateTaskStyle, onUpdateMilestoneStyle, onClose }: TypePickerPopoverProps) {
  const activeType = item.type;
  const selectedBarShape = item.taskStyle.barShape;
  const selectedMilestoneIcon = item.milestoneStyle.icon;
  const activeColor = activeType === 'task' ? item.taskStyle.color : item.milestoneStyle.color;

  const handleSelectType = (type: ItemType) => {
    if (type !== item.type) {
      onUpdateItem(item.id, {
        type,
        endDate: type === 'milestone' ? item.startDate : item.endDate,
      });
    }
  };

  const handleSelectBarShape = (shape: BarShape) => {
    handleSelectType('task');
    onUpdateTaskStyle(item.id, { barShape: shape });
  };

  const handleSelectMilestoneIcon = (icon: MilestoneIcon) => {
    handleSelectType('milestone');
    onUpdateMilestoneStyle(item.id, { icon });
  };

  const handleSelectColor = (color: string) => {
    if (activeType === 'task') {
      onUpdateTaskStyle(item.id, { color });
    } else {
      onUpdateMilestoneStyle(item.id, { color });
    }
  };

  return (
    <div
      className="absolute left-0 top-full mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 min-w-[420px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Shape sections: Task | Milestone */}
      <div className="flex border-b border-[var(--color-border)]">
        {/* Task shapes */}
        <div className="flex-1 p-3 border-r border-[var(--color-border)]">
          <h4
            className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${
              activeType === 'task' ? 'text-[#b45309]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            Task
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            {BAR_SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.id}
                onClick={() => handleSelectBarShape(shape.id)}
                className={`flex items-center justify-center w-11 h-11 rounded-md transition-all ${
                  activeType === 'task' && selectedBarShape === shape.id
                    ? 'bg-slate-200'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
                title={shape.label}
              >
                <TaskShapePreview
                  shape={shape.id}
                  color={activeType === 'task' && selectedBarShape === shape.id ? '#1e293b' : '#64748b'}
                  size={28}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Milestone shapes */}
        <div className="flex-1 p-3">
          <h4
            className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${
              activeType === 'milestone' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            Milestone
          </h4>
          <div className="grid grid-cols-6 gap-1.5">
            {MILESTONE_ICON_OPTIONS.map((icon) => (
              <button
                key={icon.id}
                onClick={() => handleSelectMilestoneIcon(icon.id)}
                className={`flex items-center justify-center w-9 h-9 rounded-md transition-all ${
                  activeType === 'milestone' && selectedMilestoneIcon === icon.id
                    ? 'bg-slate-200'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
                title={icon.label}
              >
                <MilestoneIconComponent
                  icon={icon.id}
                  size={18}
                  color={activeType === 'milestone' && selectedMilestoneIcon === icon.id ? '#1e293b' : '#64748b'}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Color section */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5">Color</h4>
        <div className="flex items-center gap-1.5">
          {/* Paint bucket icon — custom color trigger */}
          <button
            className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all ${
              !DATA_VIEW_COLOR_SWATCHES.includes(activeColor)
                ? 'border-[var(--color-text-muted)]'
                : 'border-[var(--color-border)]'
            } hover:border-[var(--color-text-muted)]`}
            title="Custom color"
          >
            <Paintbrush size={14} className="text-[var(--color-text)]" />
          </button>
          {/* Separator */}
          <div className="w-px h-6 bg-[var(--color-border)] mx-0.5" />
          {/* Color swatches */}
          {DATA_VIEW_COLOR_SWATCHES.map((swatch, i) => {
            const isLight = ['#f8fafc', '#ffffff', '#fff'].includes(swatch.toLowerCase());
            return (
              <button
                key={`${swatch}-${i}`}
                onClick={() => handleSelectColor(swatch)}
                className={`w-8 h-8 rounded-md border-2 transition-all ${
                  activeColor === swatch
                    ? 'border-[var(--color-text-muted)] scale-105'
                    : isLight
                      ? 'border-slate-200 hover:scale-110'
                      : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
              />
            );
          })}
        </div>
      </div>

      {/* Done button */}
      <div className="p-3 flex justify-center">
        <button
          onClick={onClose}
          className="px-10 py-1.5 rounded-md border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
