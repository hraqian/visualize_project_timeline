import type { ReactNode } from 'react';
import { uiSize } from './uiTokens';

interface PropertyControlRowProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function PropertyControlRow({ label, children, className }: PropertyControlRowProps) {
  return (
    <div
      className={className ?? 'grid grid-cols-[minmax(0,1fr)_auto] items-center'}
      style={{
        columnGap: 16,
        minHeight: uiSize.sidePanelRowHeight,
      }}
    >
      <span className="text-[var(--color-text-muted)] leading-5" style={{ fontSize: uiSize.sidePanelLabelFontSize }}>{label}</span>
      <div className="justify-self-end">{children}</div>
    </div>
  );
}
