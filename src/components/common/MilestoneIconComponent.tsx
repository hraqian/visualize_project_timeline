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
  Hexagon,
} from 'lucide-react';

interface MilestoneIconComponentProps {
  icon: MilestoneIcon;
  size: number;
  color: string;
  className?: string;
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
    default:
      return <Diamond {...filledProps} />;
  }
}
