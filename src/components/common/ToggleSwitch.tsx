import type { ButtonHTMLAttributes } from 'react';

type ToggleSwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
};

export function ToggleSwitch({ checked, onChange, disabled = false, className, style, ...props }: ToggleSwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
      className={className ?? `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${disabled ? 'opacity-40' : ''} ${checked ? 'bg-green-500' : 'bg-slate-300'}`}
      style={style}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}
