import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ConnectionPoint } from '@/types';

const CP_OPTIONS: { value: Exclude<ConnectionPoint, 'auto'>; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

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

  const fromPos = resolvedFrom === 'top'
    ? { x: 22, y: 12 }
    : resolvedFrom === 'bottom'
      ? { x: 22, y: 38 }
      : { x: 34, y: 25 };
  const toPos = resolvedTo === 'top'
    ? { x: 86, y: 12 }
    : resolvedTo === 'bottom'
      ? { x: 86, y: 38 }
      : { x: 74, y: 25 };

  return (
    <svg width={110} height={50} viewBox="0 0 110 50" fill="none">
      <rect x={10} y={15} width={24} height={20} rx={4} fill="#ffffff" stroke="#cbd5e1" />
      <rect x={74} y={15} width={24} height={20} rx={4} fill="#ffffff" stroke="#cbd5e1" />
      <circle cx={fromPos.x} cy={fromPos.y} r={2.75} fill="#334155" />
      <circle cx={toPos.x} cy={toPos.y} r={2.75} fill="#334155" />
      <path
        d={`M ${fromPos.x} ${fromPos.y} C ${fromPos.x + 14} ${fromPos.y}, ${toPos.x - 14} ${toPos.y}, ${toPos.x} ${toPos.y}`}
        stroke="#64748b"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    const width = 280;
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
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
          gap: 5,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <rect x={1} y={1} width={5} height={4} rx={1} fill={disabled ? '#94a3b8' : '#475569'} />
          <rect x={8} y={9} width={5} height={4} rx={1} fill={disabled ? '#94a3b8' : '#475569'} />
          <path d="M 6 3 L 8 3 L 8 11 L 8 11" fill="none" stroke={disabled ? '#94a3b8' : '#475569'} strokeWidth={1} />
        </svg>
        {buttonLabel}
        <ChevronDown size={12} />
      </button>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '10px 10px',
            zIndex: 30,
            width: 280,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>From</span>
              <select
                value={isAuto ? 'side' : fromPoint}
                disabled={isAuto}
                onChange={(e) => onChange(e.target.value as ConnectionPoint, toPoint)}
                style={{
                  fontSize: 11,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: isAuto ? '#f1f5f9' : 'white',
                  color: isAuto ? '#94a3b8' : '#334155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>To</span>
              <select
                value={isAuto ? 'side' : toPoint}
                disabled={isAuto}
                onChange={(e) => onChange(fromPoint, e.target.value as ConnectionPoint)}
                style={{
                  fontSize: 11,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: isAuto ? '#f1f5f9' : 'white',
                  color: isAuto ? '#94a3b8' : '#334155',
                  cursor: isAuto ? 'default' : 'pointer',
                  outline: 'none',
                }}
              >
                {CP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={isAuto}
                onChange={handleAutoToggle}
                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#334155' }}
              />
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Auto</span>
            </label>
          </div>
          <div style={{ borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <ConnectionPointIllustration fromPoint={fromPoint} toPoint={toPoint} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
