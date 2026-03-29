import type { CSSProperties } from 'react';
import { AdvancedColorPicker } from './AdvancedColorPicker';
import { uiColor, uiRadius } from './uiTokens';

interface ColorTransparencyControlProps {
  color: string;
  transparency: number;
  onColorChange: (color: string) => void;
  onTransparencyChange: (transparency: number) => void;
  className?: string;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(75, 131, 230, ${alpha})`;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ColorTransparencyControl({
  color,
  transparency,
  onColorChange,
  onTransparencyChange,
  className,
}: ColorTransparencyControlProps) {
  const sliderStyle = {
    '--slider-fill': hexToRgba(color, 0.85),
    '--slider-progress': `${transparency}%`,
  } as CSSProperties;

  return (
    <div className={className}>
      <div className="grid grid-cols-[56px_minmax(0,1fr)_82px] gap-x-3 gap-y-2">
        <div className="text-[13px] leading-5 text-[#526277] font-medium">Color</div>
        <div className="text-[13px] leading-5 text-[#526277] font-medium">Transparency</div>
        <div />

        <div className="h-9 flex items-center justify-start">
          <AdvancedColorPicker value={color} onChange={onColorChange} triggerSize="compact" />
        </div>

        <div className="min-w-0 h-9 flex items-center">
          <div className="w-full flex items-center min-w-0">
            <input
              type="range"
              min={0}
              max={100}
              value={transparency}
              onChange={(e) => onTransparencyChange(Number(e.target.value))}
              className="color-transparency-slider"
              style={sliderStyle}
            />
          </div>
        </div>

        <div
          className="h-9 rounded-[10px] border flex items-center justify-center text-[13px] font-medium tabular-nums text-[#1f2937]"
          style={{
            borderColor: '#d7dee8',
            background: 'linear-gradient(180deg, #ffffff 0%, #fdfefe 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.88), inset 0 1px 0 rgba(255,255,255,0.72)',
            borderRadius: uiRadius.control,
          }}
        >
          {transparency}%
        </div>
      </div>
    </div>
  );
}
