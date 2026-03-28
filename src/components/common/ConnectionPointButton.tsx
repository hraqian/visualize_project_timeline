import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ConnectionPoint } from '@/types';

const CP_OPTIONS: { value: Exclude<ConnectionPoint, 'auto'>; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

const CONNECTION_POPOVER_WIDTH = 372;

function getPointLabel(point: ConnectionPoint): string {
  switch (point) {
    case 'top':
      return 'Top';
    case 'bottom':
      return 'Bottom';
    case 'side':
      return 'Side';
    case 'auto':
    default:
      return 'Auto';
  }
}

function ConnectionPointIllustration({
  fromPoint,
  toPoint,
}: {
  fromPoint: ConnectionPoint;
  toPoint: ConnectionPoint;
}) {
  const isAuto = fromPoint === 'auto' && toPoint === 'auto';
  const resolvedFrom = isAuto ? 'side' : fromPoint;
  const resolvedTo = isAuto ? 'side' : toPoint;
  const W = 250;
  const H = 88;
  const barH = 16;
  const barW = 66;
  const bar1X = 26;
  const bar1Y = 50;
  const bar2X = W - 26 - barW;
  const bar2Y = 50;
  const stub = 10;

  const anchorFor = (side: ConnectionPoint, isTarget: boolean): [number, number] => {
    const x = isTarget ? bar2X : bar1X;
    const y = isTarget ? bar2Y : bar1Y;
    if (side === 'top') return [x + barW / 2, y];
    if (side === 'bottom') return [x + barW / 2, y + barH];
    return isTarget ? [x, y + barH / 2] : [x + barW, y + barH / 2];
  };

  const extendOutward = (point: [number, number], side: ConnectionPoint, isTarget: boolean): [number, number] => {
    if (side === 'top') return [point[0], point[1] - stub];
    if (side === 'bottom') return [point[0], point[1] + stub];
    return [point[0] + (isTarget ? -stub : stub), point[1]];
  };

  const fromAnchor = anchorFor(resolvedFrom, false);
  const toAnchor = anchorFor(resolvedTo, true);
  const fromExit = extendOutward(fromAnchor, resolvedFrom, false);
  const toEntry = extendOutward(toAnchor, resolvedTo, true);
  const midX = Math.round((fromExit[0] + toEntry[0]) / 2);
  const rawPoints: [number, number][] = [
    fromAnchor,
    fromExit,
    [midX, fromExit[1]],
    [midX, toEntry[1]],
    toEntry,
    toAnchor,
  ];

  const points = rawPoints.filter((point, idx) => {
    const prev = rawPoints[idx - 1];
    return !prev || prev[0] !== point[0] || prev[1] !== point[1];
  }).filter((point, idx, arr) => {
    if (idx === 0 || idx === arr.length - 1) return true;
    const prev = arr[idx - 1];
    const next = arr[idx + 1];
    const sameX = prev[0] === point[0] && point[0] === next[0];
    const sameY = prev[1] === point[1] && point[1] === next[1];
    return !sameX && !sameY;
  });

  const path = points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`).join(' ');
  const tip = points[points.length - 1];
  const prev = points[points.length - 2] ?? tip;
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const dirX = dx === 0 ? 0 : Math.sign(dx);
  const dirY = dy === 0 ? 0 : Math.sign(dy);
  const normalX = -dirY;
  const normalY = dirX;
  const arrowDepth = 6;
  const arrowHalf = 3.5;
  const arrowBaseX = tip[0] - dirX * arrowDepth;
  const arrowBaseY = tip[1] - dirY * arrowDepth;
  const arrowPoints = `${tip[0]},${tip[1]} ${arrowBaseX + normalX * arrowHalf},${arrowBaseY + normalY * arrowHalf} ${arrowBaseX - normalX * arrowHalf},${arrowBaseY - normalY * arrowHalf}`;

  return (
    <svg width={250} height={88} viewBox="0 0 250 88" fill="none" style={{ display: 'block' }}>
      <rect x={bar1X} y={bar1Y} width={barW} height={barH} rx={4} fill="#cfdae8" fillOpacity={0.92} />
      <rect x={bar2X} y={bar2Y} width={barW} height={barH} rx={4} fill="#cfdae8" fillOpacity={0.92} />
      <path
        d={path}
        fill="none"
        stroke="#4b83e6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points={arrowPoints} fill="#4b83e6" />
    </svg>
  );
}

export function ConnectionPointButton({
  fromPoint,
  toPoint,
  disabled,
  onChange,
}: {
  fromPoint: ConnectionPoint;
  toPoint: ConnectionPoint;
  disabled: boolean;
  onChange: (fp: ConnectionPoint, tp: ConnectionPoint) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - CONNECTION_POPOVER_WIDTH - margin);
    setPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      if (ref.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleViewport = () => updatePos();
    window.addEventListener('resize', handleViewport);
    window.addEventListener('scroll', handleViewport, true);
    return () => {
      window.removeEventListener('resize', handleViewport);
      window.removeEventListener('scroll', handleViewport, true);
    };
  }, [open, updatePos]);

  const isAuto = fromPoint === 'auto' && toPoint === 'auto';
  const buttonLabel = isAuto ? 'Auto' : `${getPointLabel(fromPoint)}-${getPointLabel(toPoint)}`;

  const handleAutoToggle = () => {
    if (isAuto) {
      onChange('side', 'side');
    } else {
      onChange('auto', 'auto');
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        ref={triggerRef}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePos();
          setOpen(!open);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: disabled ? '1px solid #d7dee8' : '1px solid #c8d3df',
          background: disabled
            ? 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          color: disabled ? '#94a3b8' : '#334155',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
          boxShadow: disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
          <rect x={1.5} y={2} width={5.5} height={4.5} rx={1.25} fill={disabled ? '#cbd5e1' : '#94a3b8'} />
          <rect x={9} y={9.5} width={5.5} height={4.5} rx={1.25} fill={disabled ? '#cbd5e1' : '#94a3b8'} />
          <path d="M 7 4.25 H 10 V 11.75" fill="none" stroke={disabled ? '#94a3b8' : '#4b83e6'} strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {buttonLabel}
        <ChevronDown size={13} color={disabled ? '#94a3b8' : '#607086'} />
      </button>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            background: 'linear-gradient(180deg, #ffffff 0%, #fcfdff 100%)',
            border: '1px solid #d9e3ef',
            borderRadius: 12,
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
            padding: '12px',
            zIndex: 30,
            width: CONNECTION_POPOVER_WIDTH,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#607086', fontWeight: 600, letterSpacing: 0.1 }}>From</span>
              <select
                value={isAuto ? 'side' : fromPoint}
                disabled={isAuto}
                onChange={(e) => onChange(e.target.value as ConnectionPoint, toPoint)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 26px 6px 10px',
                  width: 96,
                  minWidth: 96,
                  borderRadius: 8,
                  border: '1px solid #c7d2df',
                  background: isAuto
                    ? 'linear-gradient(180deg, #f7f9fc 0%, #f1f5f9 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                  color: isAuto ? '#94a3b8' : '#314155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                  boxShadow: isAuto ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.9)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23607086' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#607086', fontWeight: 600, letterSpacing: 0.1 }}>To</span>
              <select
                value={isAuto ? 'side' : toPoint}
                disabled={isAuto}
                onChange={(e) => onChange(fromPoint, e.target.value as ConnectionPoint)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 26px 6px 10px',
                  width: 96,
                  minWidth: 96,
                  borderRadius: 8,
                  border: '1px solid #c7d2df',
                  background: isAuto
                    ? 'linear-gradient(180deg, #f7f9fc 0%, #f1f5f9 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                  color: isAuto ? '#94a3b8' : '#314155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                  boxShadow: isAuto ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.9)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23607086' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: isAuto ? '#f8fbff' : '#ffffff' }}>
              <input
                type="checkbox"
                checked={isAuto}
                onChange={handleAutoToggle}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#4b83e6' }}
              />
              <span style={{ fontSize: 12, color: '#4b5b70', fontWeight: 600 }}>Auto</span>
            </label>
          </div>
          <div style={{ borderRadius: 8, background: 'linear-gradient(180deg, #fdfefe 0%, #f5f8fc 100%)', border: '1px solid #dde6f0', display: 'flex', justifyContent: 'center', padding: '12px 0 10px', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            <ConnectionPointIllustration fromPoint={fromPoint} toPoint={toPoint} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
