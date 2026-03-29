import type { ReactNode } from 'react';
import { uiSize } from './uiTokens';

interface LabeledFieldProps {
  label: string;
  children: ReactNode;
  grow?: boolean;
}

function LabeledField({ label, children, grow = false }: LabeledFieldProps) {
  return (
    <div className={grow ? 'min-w-0 flex-1' : undefined}>
      <label
        className="block mb-1.5 text-[var(--color-text-muted)] font-medium"
        style={{
          fontSize: uiSize.sidePanelLabelFontSize,
          lineHeight: '20px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface LabeledFieldPairProps {
  leftLabel: string;
  left: ReactNode;
  rightLabel: string;
  right: ReactNode;
  leftWidth?: number;
}

export function LabeledFieldPair({
  leftLabel,
  left,
  rightLabel,
  right,
  leftWidth = uiSize.sidePanelCompositeSwatchWidth,
}: LabeledFieldPairProps) {
  return (
    <div className="flex items-start" style={{ gap: uiSize.sidePanelCompositeGap }}>
      <div style={{ width: leftWidth }}>
        <LabeledField label={leftLabel}>{left}</LabeledField>
      </div>
      <LabeledField label={rightLabel} grow>{right}</LabeledField>
    </div>
  );
}
