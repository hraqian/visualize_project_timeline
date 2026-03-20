import type { MilestoneIcon } from '@/types';
import {
  Diamond,
  Triangle,
  Flag,
  Star,
  Circle,
  Square,
  Check,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Hexagon,
  Plus,
  Pentagon,
  Heart,
  ChevronRight,
} from 'lucide-react';

interface MilestoneIconComponentProps {
  icon: MilestoneIcon;
  size: number;
  color: string;
  className?: string;
}

// Custom SVG for 6-pointed star (not in lucide)
function Star6pt({ size, color, className }: { size: number; color: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className}>
      <polygon points="12,0 14.5,8 22,8 16,13 18.5,21 12,16 5.5,21 8,13 2,8 9.5,8" />
    </svg>
  );
}

// Custom SVG for half circle
function CircleHalf({ size, color, className }: { size: number; color: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} stroke={color} strokeWidth={2} fill="none">
      <circle cx={12} cy={12} r={10} />
      <path d="M12 2 A10 10 0 0 1 12 22" fill={color} />
    </svg>
  );
}

// Triangle pointing down
function TriangleDown({ size, color, fill, className }: { size: number; color: string; fill?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} stroke={color} strokeWidth={2} fill={fill || 'none'} strokeLinejoin="round">
      <polygon points="4,6 20,6 12,20" />
    </svg>
  );
}

export function MilestoneIconComponent({ icon, size, color, className = '' }: MilestoneIconComponentProps) {
  const props = { size, color, className, strokeWidth: 2 };
  const filledProps = { ...props, fill: color };

  switch (icon) {
    case 'diamond':
      return <Diamond {...props} />;
    case 'diamond-filled':
      return <Diamond {...filledProps} />;
    case 'triangle':
      return <Triangle {...props} />;
    case 'triangle-filled':
      return <Triangle {...filledProps} />;
    case 'flag':
      return <Flag {...props} />;
    case 'flag-filled':
      return <Flag {...filledProps} />;
    case 'star':
      return <Star {...props} />;
    case 'star-filled':
      return <Star {...filledProps} />;
    case 'circle':
      return <Circle {...props} />;
    case 'circle-filled':
      return <Circle {...filledProps} />;
    case 'square-ms':
      return <Square {...props} />;
    case 'square-ms-filled':
      return <Square {...filledProps} />;
    case 'check':
      return <Check {...filledProps} />;
    case 'arrow-up':
      return <ArrowUp {...filledProps} />;
    case 'arrow-right':
      return <ArrowRight {...filledProps} />;
    case 'hexagon':
      return <Hexagon {...filledProps} />;
    case 'arrow-down':
      return <ArrowDown {...filledProps} />;
    case 'star-6pt':
      return <Star6pt size={size} color={color} className={className} />;
    case 'plus':
      return <Plus {...filledProps} />;
    case 'circle-half':
      return <CircleHalf size={size} color={color} className={className} />;
    case 'pentagon':
      return <Pentagon {...filledProps} />;
    case 'heart':
      return <Heart {...filledProps} />;
    case 'chevron-right':
      return <ChevronRight {...filledProps} />;
    case 'triangle-down':
      return <TriangleDown size={size} color={color} fill={color} className={className} />;
    default:
      return <Diamond {...filledProps} />;
  }
}
