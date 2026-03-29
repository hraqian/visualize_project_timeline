import { Paintbrush } from 'lucide-react';
import { DATA_VIEW_COLOR_SWATCHES } from './pickerOptions';

type DataViewColorStripProps = {
  currentColor?: string;
  onSelect: (color: string) => void;
  selectedRing?: boolean;
};

export function DataViewColorStrip({ currentColor, onSelect, selectedRing = false }: DataViewColorStripProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0" style={{ borderColor: '#d9e3ef', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
        <Paintbrush size={14} className="text-slate-700" />
      </div>
      <div className="w-px h-6 mx-0.5 shrink-0" style={{ background: '#d9e3ef' }} />
      {DATA_VIEW_COLOR_SWATCHES.map((swatch, i) => {
        const isLight = ['#f8fafc', '#ffffff', '#fff'].includes(swatch.toLowerCase());
        const isSelected = currentColor === swatch;
        return (
          <button
            key={`${swatch}-${i}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(swatch);
            }}
            className={`w-7 h-7 rounded-md shrink-0 hover:scale-110 transition-all ${selectedRing && isSelected ? 'ring-2 ring-[#4b83e6] ring-offset-1' : ''} ${isLight ? 'border border-slate-200' : ''}`}
            style={{ backgroundColor: swatch }}
            title={swatch}
          />
        );
      })}
    </div>
  );
}
