import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { uiColor, uiControlStyles } from './uiTokens';

type PopoverSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  style?: CSSProperties;
};

export const PopoverSurface = forwardRef<HTMLDivElement, PopoverSurfaceProps>(function PopoverSurface(
  { children, style, className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={className}
      style={{
        ...uiControlStyles.panel,
        ...style,
      }}
    >
      {children}
    </div>
  );
});

export function MenuRow({
  children,
  active = false,
  disabled = false,
  style,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: active ? 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' : 'transparent',
        color: disabled ? uiColor.textDisabled : undefined,
        opacity: disabled ? 0.7 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
