import type { CSSProperties } from 'react';
import type { BarShape } from '@/types';

export function getShapeStyle(shape: BarShape, width: number, height: number): CSSProperties {
  const insetPx = height * 0.4;
  const insetPct = (insetPx / width) * 100;
  const smallInset = insetPct * 0.5;

  switch (shape) {
    case 'square':
      return { borderRadius: 3 };
    case 'rounded':
      return { borderRadius: height * 0.3 };
    case 'capsule':
      return { borderRadius: height };
    case 'flat':
      return { borderRadius: 0 };
    case 'chevron':
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%)` };
    case 'double-chevron':
      return { clipPath: `polygon(0% 0%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, 0% 100%, ${smallInset}% 50%)` };
    case 'arrow-right':
      return { clipPath: `polygon(0% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, 0% 85%)` };
    case 'pointed':
      return { clipPath: `polygon(${insetPct}% 15%, ${100 - insetPct}% 15%, ${100 - insetPct}% 0%, 100% 50%, ${100 - insetPct}% 100%, ${100 - insetPct}% 85%, ${insetPct}% 85%, ${insetPct}% 100%, 0% 50%, ${insetPct}% 0%)` };
    case 'arrow-both': {
      const s = height / Math.tan((75 * Math.PI) / 180);
      const r = Math.min(height * 0.3, s * 0.8);
      const rBig = r * 2.5;
      const w = width;
      const h = height;
      const len = Math.sqrt(s * s + h * h);
      const dx = (s / len) * r;
      const dy = (h / len) * r;
      const dxB = (s / len) * rBig;
      const dyB = (h / len) * rBig;
      return { clipPath: `path('M ${s + r} 0 L ${w - rBig} 0 Q ${w} 0 ${w - dxB} ${dyB} L ${w - s + dx} ${h - dy} Q ${w - s} ${h} ${w - s - r} ${h} L ${rBig} ${h} Q 0 ${h} ${dxB} ${h - dyB} L ${s - dx} ${dy} Q ${s} 0 ${s + r} 0 Z')` };
    }
    case 'notched': {
      const s2 = height / Math.tan((75 * Math.PI) / 180);
      const r2 = Math.min(height * 0.3, s2 * 0.8);
      const rSmall = r2 * 0.25;
      const w2 = width;
      const h2 = height;
      const len2 = Math.sqrt(s2 * s2 + h2 * h2);
      const dx2 = (s2 / len2) * r2;
      const dy2 = (h2 / len2) * r2;
      const dxS = (s2 / len2) * rSmall;
      const dyS = (h2 / len2) * rSmall;
      return { clipPath: `path('M ${s2 + r2} 0 L ${w2 - rSmall} 0 Q ${w2} 0 ${w2 - dxS} ${dyS} L ${w2 - s2 + dx2} ${h2 - dy2} Q ${w2 - s2} ${h2} ${w2 - s2 - r2} ${h2} L ${rSmall} ${h2} Q 0 ${h2} ${dxS} ${h2 - dyS} L ${s2 - dx2} ${dy2} Q ${s2} 0 ${s2 + r2} 0 Z')` };
    }
    case 'tab':
      return { clipPath: `polygon(0% 0%, 100% 0%, ${100 - insetPct}% 100%, ${insetPct}% 100%)` };
    case 'trapezoid':
      return { clipPath: `polygon(${insetPct}% 0%, ${100 - insetPct}% 0%, 100% 100%, 0% 100%)` };
    default:
      return {};
  }
}
