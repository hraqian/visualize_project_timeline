import type { ReactNode } from 'react';
import { uiColor } from './uiTokens';

type OptionGridPickerProps<T extends string> = {
  options: readonly { id: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
  renderOption: (option: { id: T; label: string }, selected: boolean) => ReactNode;
  columns: number;
  tileSize?: number;
  gap?: number;
};

export function OptionGridPicker<T extends string>({
  options,
  value,
  onSelect,
  renderOption,
  columns,
  tileSize = 32,
  gap = 6,
}: OptionGridPickerProps<T>) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: tileSize,
              height: tileSize,
              borderRadius: 8,
              border: selected ? '1px solid #c7d8f8' : '1px solid transparent',
              cursor: 'pointer',
              background: selected ? 'linear-gradient(180deg, #eff5ff 0%, #e6efff 100%)' : 'transparent',
            }}
            title={option.label}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.background = uiColor.hoverSoft;
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.background = 'transparent';
            }}
          >
            {renderOption(option, selected)}
          </button>
        );
      })}
    </div>
  );
}
