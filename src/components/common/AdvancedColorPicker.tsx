import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

// ─── Color Conversion Utilities ──────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ─── Theme Color Palette (Office-style 10 columns x 6 rows) ─────────────────

const THEME_BASE_COLORS = [
  '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
  '#70AD47', '#264478', '#9B57A0', '#636363', '#EB6E3D',
];

function generateTintShadeMatrix(): string[][] {
  const rows: string[][] = [];
  // Row 0: lighter tints (80% white mix)
  // Row 1: lighter tints (60% white mix)
  // Row 2: lighter tints (40% white mix)
  // Row 3: base colors
  // Row 4: darker shades (25% black mix)
  // Row 5: darker shades (50% black mix)
  const tintFactors = [0.8, 0.6, 0.4, 0, -0.25, -0.5];

  for (const factor of tintFactors) {
    const row: string[] = [];
    for (const base of THEME_BASE_COLORS) {
      const [r, g, b] = hexToRgb(base);
      let nr: number, ng: number, nb: number;
      if (factor > 0) {
        // Tint: mix with white
        nr = Math.round(r + (255 - r) * factor);
        ng = Math.round(g + (255 - g) * factor);
        nb = Math.round(b + (255 - b) * factor);
      } else if (factor < 0) {
        // Shade: mix with black
        const f = Math.abs(factor);
        nr = Math.round(r * (1 - f));
        ng = Math.round(g * (1 - f));
        nb = Math.round(b * (1 - f));
      } else {
        nr = r; ng = g; nb = b;
      }
      row.push(rgbToHex(nr, ng, nb));
    }
    rows.push(row);
  }
  return rows;
}

const THEME_MATRIX = generateTintShadeMatrix();

const STANDARD_COLORS = [
  '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050',
  '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0',
];

// ─── Persistent recent colors (module-level) ────────────────────────────────

let recentColors: string[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

interface AdvancedColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function AdvancedColorPicker({ value, onChange }: AdvancedColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - popoverWidth - margin,
    );
    const top = rect.bottom + 8;
    setPos({ top, left });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
    const handleViewportChange = () => updatePos();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updatePos]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => {
          if (!isOpen) updatePos();
          setIsOpen(!isOpen);
        }}
        className="w-7 h-7 rounded-md border-2 border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-colors cursor-pointer shadow-sm"
        style={{ backgroundColor: value }}
        title={value}
      />

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-[280px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <PopoverContent
            value={value}
            onChange={(c) => {
              onChange(c);
            }}
            onClose={() => setIsOpen(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Popover Content ─────────────────────────────────────────────────────────

function PopoverContent({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);

  // HSV state for custom picker
  const [rgb, setRgb] = useState(hexToRgb(value));
  const [hsv, setHsv] = useState(rgbToHsv(...rgb));

  // Hex input
  const [hexInput, setHexInput] = useState(value);

  // Sync hex input when value changes externally
  useEffect(() => {
    setHexInput(value);
    const newRgb = hexToRgb(value);
    setRgb(newRgb);
    setHsv(rgbToHsv(...newRgb));
  }, [value]);

  const applyColor = useCallback(
    (hex: string) => {
      onChange(hex);
      setHexInput(hex);
      const newRgb = hexToRgb(hex);
      setRgb(newRgb);
      setHsv(rgbToHsv(...newRgb));
    },
    [onChange]
  );

  const handleHsvChange = useCallback(
    (h: number, s: number, v: number) => {
      setHsv([h, s, v]);
      const newRgb = hsvToRgb(h, s, v);
      setRgb(newRgb);
      const hex = rgbToHex(...newRgb);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleRgbChange = useCallback(
    (r: number, g: number, b: number) => {
      setRgb([r, g, b]);
      setHsv(rgbToHsv(r, g, b));
      const hex = rgbToHex(r, g, b);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleHexSubmit = useCallback(
    (input: string) => {
      const clean = input.startsWith('#') ? input : '#' + input;
      if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
        applyColor(clean.toLowerCase());
      }
    },
    [applyColor]
  );

  const addToRecent = useCallback(() => {
    const hex = rgbToHex(...rgb).toLowerCase();
    recentColors = [hex, ...recentColors.filter((c) => c !== hex)].slice(0, 10);
  }, [rgb]);

  return (
    <div className="p-3 space-y-2">
      {/* ─── Recent Colors ─── */}
      {recentColors.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
            Recent
          </div>
          <div className="flex gap-1 flex-wrap">
            {recentColors.map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                onClick={() => applyColor(color)}
                className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                  value === color ? 'border-[var(--color-text)] shadow' : 'border-[var(--color-border)]'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Color Palette (collapsible) ─── */}
      <div>
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 hover:text-[var(--color-text-secondary)]"
        >
          {paletteOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Color palette
        </button>
        {paletteOpen && (
          <div className="space-y-1.5">
            {/* Theme matrix */}
            <div className="grid grid-cols-10 gap-px">
              {THEME_MATRIX.map((row, ri) =>
                row.map((color, ci) => (
                  <button
                    key={`${ri}-${ci}`}
                    onClick={() => applyColor(color)}
                    className={`w-full aspect-square transition-all hover:scale-125 hover:z-10 hover:shadow-md relative ${
                      ri === 0 && ci === 0 ? 'rounded-tl' : ''
                    } ${ri === 0 && ci === 9 ? 'rounded-tr' : ''} ${
                      ri === 5 && ci === 0 ? 'rounded-bl' : ''
                    } ${ri === 5 && ci === 9 ? 'rounded-br' : ''} ${
                      value.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-[var(--color-text)] ring-offset-1 z-20'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))
              )}
            </div>

            {/* Standard colors */}
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                Standard colors
              </div>
              <div className="grid grid-cols-10 gap-px">
                {STANDARD_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => applyColor(color)}
                    className={`w-full aspect-square rounded-sm transition-all hover:scale-125 hover:z-10 hover:shadow-md ${
                      value.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-[var(--color-text)] ring-offset-1 z-20'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Custom Colors (collapsible) ─── */}
      <div>
        <button
          onClick={() => setCustomOpen(!customOpen)}
          className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 hover:text-[var(--color-text-secondary)]"
        >
          {customOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Custom colors
        </button>
        {customOpen && (
          <div className="space-y-2">
            {/* Gradient + Hue strip */}
            <div className="flex gap-2">
              <SatBrightnessGradient
                hue={hsv[0]}
                saturation={hsv[1]}
                brightness={hsv[2]}
                onChange={(s, v) => handleHsvChange(hsv[0], s, v)}
              />
              <HueStrip
                hue={hsv[0]}
                onChange={(h) => handleHsvChange(h, hsv[1], hsv[2])}
              />
            </div>

            {/* Preview bar + add to recent */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-6 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: rgbToHex(...rgb) }}
              />
              <button
                onClick={addToRecent}
                className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                title="Add to recent colors"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Hex + RGB inputs */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Hex</label>
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  onBlur={() => handleHexSubmit(hexInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(hexInput); }}
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text)] font-mono outline-none focus:border-slate-700"
                />
              </div>
              <RgbInput label="R" value={rgb[0]} onChange={(v) => handleRgbChange(v, rgb[1], rgb[2])} />
              <RgbInput label="G" value={rgb[1]} onChange={(v) => handleRgbChange(rgb[0], v, rgb[2])} />
              <RgbInput label="B" value={rgb[2]} onChange={(v) => handleRgbChange(rgb[0], rgb[1], v)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RGB Input ───────────────────────────────────────────────────────────────

function RgbInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="w-10">
      <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">{label}</label>
      <input
        type="number"
        min={0}
        max={255}
        value={value}
        onChange={(e) => {
          const v = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
          onChange(v);
        }}
        className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[11px] text-[var(--color-text)] font-mono outline-none focus:border-slate-700 text-center"
      />
    </div>
  );
}

// ─── Saturation / Brightness Gradient ────────────────────────────────────────

function SatBrightnessGradient({
  hue,
  saturation,
  brightness,
  onChange,
}: {
  hue: number;
  saturation: number;
  brightness: number;
  onChange: (s: number, v: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Draw gradient
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Hue background
    const [r, g, b] = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);

    // White gradient (left to right)
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // Black gradient (top to bottom)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hue]);

  const updateFromMouse = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onChange(x, 1 - y);
    },
    [onChange]
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (dragging.current) updateFromMouse(e);
    };
    const handleUp = () => {
      dragging.current = false;
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [updateFromMouse]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-[120px] rounded cursor-crosshair overflow-hidden border border-[var(--color-border)]"
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromMouse(e);
      }}
    >
      <canvas ref={canvasRef} width={200} height={120} className="w-full h-full" />
      {/* Selector circle */}
      <div
        className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{
          left: `${saturation * 100}%`,
          top: `${(1 - brightness) * 100}%`,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}

// ─── Hue Strip ───────────────────────────────────────────────────────────────

function HueStrip({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromMouse = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onChange(y * 360);
    },
    [onChange]
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (dragging.current) updateFromMouse(e);
    };
    const handleUp = () => {
      dragging.current = false;
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [updateFromMouse]);

  return (
    <div
      ref={containerRef}
      className="relative w-4 h-[120px] rounded cursor-pointer border border-[var(--color-border)]"
      style={{
        background: 'linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
      }}
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromMouse(e);
      }}
    >
      {/* Selector */}
      <div
        className="absolute left-0 right-0 h-2 border-2 border-white rounded-sm pointer-events-none"
        style={{
          top: `${(hue / 360) * 100}%`,
          transform: 'translateY(-50%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}
