import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { uiColor, uiControlStyles, uiSize } from './uiTokens';

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  chevron?: ReactNode;
  active?: boolean;
  destructive?: boolean;
  tone?: 'default' | 'secondary';
  children: ReactNode;
};

export function ToolbarButton({
  icon,
  chevron,
  active = false,
  destructive = false,
  tone = 'default',
  disabled,
  children,
  style,
  className,
  ...props
}: ToolbarButtonProps) {
  const resolvedStyle: CSSProperties = disabled
    ? { ...uiControlStyles.toolbarButtonDisabled, color: uiColor.textDisabled, ...style }
    : active
      ? {
          ...uiControlStyles.toolbarButton,
          borderColor: 'rgba(75, 131, 230, 0.28)',
          background: 'linear-gradient(180deg, #f8fbff 0%, #edf4ff 100%)',
          color: '#1e293b',
          ...style,
        }
      : destructive
        ? {
            ...uiControlStyles.toolbarButton,
            borderColor: '#f1c7ce',
            background: 'linear-gradient(180deg, #fff8f8 0%, #fff1f2 100%)',
            color: 'var(--color-danger)',
            ...style,
          }
        : { ...uiControlStyles.toolbarButton, color: tone === 'secondary' ? uiColor.textMuted : uiColor.text, ...style };

  return (
    <button
      {...props}
      disabled={disabled}
      className={className ?? 'flex items-center rounded-lg font-medium border transition-all'}
      style={resolvedStyle}
    >
      {icon}
      {children}
      {chevron}
    </button>
  );
}

type ToolbarSplitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  children: ReactNode;
  chevron?: ReactNode;
};

export function ToolbarSplitButton({ icon, children, chevron, style, className, ...props }: ToolbarSplitButtonProps) {
  return (
    <button
      {...props}
      className={className ?? 'flex items-center rounded-lg font-medium border transition-all'}
      style={{ ...uiControlStyles.toolbarButton, color: uiColor.textMuted, ...style }}
    >
      {icon}
      {children}
      {chevron}
    </button>
  );
}

type ToolbarIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function ToolbarIconButton({ children, disabled, style, className, ...props }: ToolbarIconButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={className ?? 'flex items-center justify-center rounded-lg border transition-all'}
      style={{
        ...(disabled ? uiControlStyles.toolbarButtonDisabled : uiControlStyles.toolbarButton),
        width: uiControlStyles.toolbarButton.height,
        padding: 0,
        color: disabled ? uiColor.textDisabled : uiColor.textMuted,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function toolbarContentStyle(extra?: CSSProperties): CSSProperties {
  return {
    gap: uiSize.toolbarGap,
    paddingLeft: uiSize.toolbarPaddingX,
    paddingRight: uiSize.toolbarPaddingX,
    lineHeight: uiSize.toolbarLineHeight,
    ...extra,
  };
}
