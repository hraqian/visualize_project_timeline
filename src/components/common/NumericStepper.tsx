import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { uiColor, uiShadow } from './uiTokens';

type NumericStepperProps = {
  valueDisplay: ReactNode;
  onIncrement: () => void;
  onDecrement: () => void;
  input?: ReactNode;
  incrementTitle?: string;
  decrementTitle?: string;
  axis?: 'vertical' | 'horizontal';
  style?: CSSProperties;
};

export function NumericStepper({
  valueDisplay,
  onIncrement,
  onDecrement,
  input,
  incrementTitle,
  decrementTitle,
  axis = 'vertical',
  style,
}: NumericStepperProps) {
  const UpIcon = axis === 'horizontal' ? ChevronRight : ChevronUp;
  const DownIcon = axis === 'horizontal' ? ChevronRight : ChevronDown;
  const upClass = axis === 'horizontal' ? '-rotate-90' : '';
  const downClass = axis === 'horizontal' ? 'rotate-90' : '';

  return (
    <div
      className="flex items-center rounded-lg overflow-hidden border"
      style={{
        borderColor: uiColor.border,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: uiShadow.insetSoft,
        ...style,
      }}
    >
      {input ?? valueDisplay}
      <div className="flex flex-col border-l" style={{ borderColor: '#d7e0ea' }}>
        <button
          onClick={onIncrement}
          className="px-1.5 h-[18px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center hover:bg-[#f7fafc]"
          title={incrementTitle}
        >
          <UpIcon size={10} className={upClass} />
        </button>
        <button
          onClick={onDecrement}
          className="px-1.5 h-[18px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center border-t hover:bg-[#f7fafc]"
          style={{ borderColor: '#d7e0ea' }}
          title={decrementTitle}
        >
          <DownIcon size={10} className={downClass} />
        </button>
      </div>
    </div>
  );
}
