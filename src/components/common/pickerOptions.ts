import type { BarShape, MilestoneIcon } from '@/types';

export const BAR_SHAPE_OPTIONS: { id: BarShape; label: string }[] = [
  { id: 'square', label: 'Rectangle' },
  { id: 'rounded', label: 'Round rectangle' },
  { id: 'capsule', label: 'Ellipse' },
  { id: 'chevron', label: 'Pentagon' },
  { id: 'double-chevron', label: 'Chevron' },
  { id: 'arrow-right', label: 'Right arrow' },
  { id: 'pointed', label: 'Double arrow' },
  { id: 'arrow-both', label: 'Modern' },
  { id: 'notched', label: 'Leaf' },
];

export const BAR_SHAPE_LABELS: Record<BarShape, string> = Object.fromEntries(
  BAR_SHAPE_OPTIONS.map((option) => [option.id, option.label]),
) as Record<BarShape, string>;

export const MILESTONE_ICON_OPTIONS: { id: MilestoneIcon; label: string }[] = [
  { id: 'flag', label: 'Flag' },
  { id: 'triangle-down', label: 'Triangle down' },
  { id: 'diamond-filled', label: 'Diamond' },
  { id: 'star', label: 'Star 5 point' },
  { id: 'star-6pt', label: 'Star 6 point' },
  { id: 'arrow-up', label: 'Arrow up' },
  { id: 'arrow-down', label: 'Arrow down' },
  { id: 'square-ms', label: 'Square outline' },
  { id: 'square-ms-filled', label: 'Square filled' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'chevron-right', label: 'Chevron right' },
  { id: 'triangle', label: 'Triangle up' },
  { id: 'plus', label: 'Plus' },
  { id: 'circle-half', label: 'Half circle' },
  { id: 'circle-filled', label: 'Circle filled' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'diamond', label: 'Diamond outline' },
  { id: 'heart', label: 'Heart' },
];

export const DATA_VIEW_COLOR_SWATCHES = [
  '#22c55e',
  '#ef4444',
  '#2563eb',
  '#334155',
  '#f8b878',
  '#000000',
  '#f8fafc',
  '#93a5cf',
  '#475569',
  '#6b7040',
] as const;
