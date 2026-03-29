import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ModalSurface({ children, style, className, ...props }: ModalSurfaceProps) {
  return (
    <div
      {...props}
      className={className}
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)',
        border: '1px solid #d9e3ef',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18), 0 8px 24px rgba(15, 23, 42, 0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type ModalCloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: number;
};

export function ModalCloseButton({ size = 18, style, className, ...props }: ModalCloseButtonProps) {
  return (
    <button
      {...props}
      className={className ?? 'flex items-center justify-center w-8 h-8 rounded-lg transition-all'}
      style={{
        color: '#94a3b8',
        ...style,
      }}
    >
      <X size={size} />
    </button>
  );
}

type DialogButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'secondary' | 'primary' | 'danger';
  children: ReactNode;
};

export function DialogButton({ tone = 'secondary', children, style, className, ...props }: DialogButtonProps) {
  const toneStyle: Record<string, CSSProperties> = {
    secondary: {
      color: '#64748b',
      border: '1px solid #d9e3ef',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    },
    primary: {
      color: '#ffffff',
      border: '1px solid transparent',
      background: 'linear-gradient(180deg, #3c6fd9 0%, #2f5fc7 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
    },
    danger: {
      color: '#dc2626',
      border: '1px solid #fecdd3',
      background: 'linear-gradient(180deg, #fff8f8 0%, #fff1f2 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    },
  };

  return (
    <button
      {...props}
      className={className ?? 'px-4 py-2 rounded-lg text-sm font-medium transition-all'}
      style={{
        ...toneStyle[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
