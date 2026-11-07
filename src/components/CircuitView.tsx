import { useState, type KeyboardEvent } from 'react';
import type { SchResistor, Schematic, Side } from '../engine/layout';

/** Couleurs des nœuds (distinctes du jaune « courant » et de l'orange « erreur »). */
const NODE_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#4f46e5', '#65a30d', '#0d9488', '#7c3aed', '#be185d'];
const WIRE = '#334155';

interface Props {
  schematic: Schematic;
  selected?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  showNodes?: boolean;
  /** Résistance qui vient d'apparaître (petite animation). */
  highlightId?: string | null;
  /** Courant animé en jaune (réussite). */
  flowing?: boolean;
  disabled?: boolean;
  label: string;
  zoomable?: boolean;
}

function labelPos(side: Side, x: number, y: number, d: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  switch (side) {
    case 'left':
      return { x: x - d, y: y + 5, anchor: 'end' };
    case 'right':
      return { x: x + d, y: y + 5, anchor: 'start' };
    case 'top':
      return { x, y: y - d + 4, anchor: 'middle' };
    case 'bottom':
      return { x, y: y + d + 6, anchor: 'middle' };
  }
}

export function CircuitView({ schematic: s, selected, onToggle, showNodes = false, highlightId, flowing = false, disabled = false, label, zoomable = true }: Props) {
  const [zoom, setZoom] = useState(1);
  const color = (node: string) => (showNodes ? NODE_COLORS[s.nodes.indexOf(node) % NODE_COLORS.length] : WIRE);
  const interactive = !!onToggle && !disabled;

  return (
    <div className="relative">
      {zoomable && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-slate-200">
          <button type="button" className="h-8 w-8 rounded-md text-lg font-bold text-slate-600 hover:bg-slate-100" onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))} aria-label="Dézoomer">
            −
          </button>
          <button type="button" className="h-8 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setZoom(1)} aria-label="Taille normale">
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" className="h-8 w-8 rounded-md text-lg font-bold text-slate-600 hover:bg-slate-100" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoomer">
            +
          </button>
        </div>
      )}
      <div className={`overflow-auto rounded-xl bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] p-2 ${zoomable ? 'pt-12' : ''}`}>
        <svg
          viewBox={`0 0 ${s.w} ${s.h}`}
          role="img"
          aria-label={label}
          className="mx-auto block select-none"
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? `${Math.round(s.w * 1.35)}px` : 'none', minWidth: zoom > 1 ? `${Math.round(s.w * zoom * 0.8)}px` : undefined }}
        >
          {s.wires.map((w, i) => (
            <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={color(w.node)} strokeWidth={showNodes ? 3 : 2.2} strokeLinecap="round" />
          ))}
          {flowing &&
            s.wires.map((w, i) => (
              <line key={`f${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#facc15" strokeWidth={4} strokeLinecap="round" className="current-flow" />
            ))}
          {s.dots.map((d, i) => (
            <circle key={`d${i}`} cx={d.x} cy={d.y} r={3.8} fill={showNodes ? color(d.node) : '#0f172a'} />
          ))}
          {s.resistors.map((r) => (
            <Resistor
              key={r.id}
              r={r}
              selected={!!selected?.has(r.id)}
              interactive={interactive}
              onToggle={onToggle}
              leadColors={[color(r.nodes[0]), color(r.nodes[1])]}
              showNodes={showNodes}
              highlight={highlightId === r.id}
            />
          ))}
          {s.nodeLabels.map((t, i) => {
            const p = labelPos(t.side, t.x, t.y, 12);
            return (
              <g key={`n${i}`}>
                <circle cx={t.x} cy={t.y} r={4.5} fill={showNodes ? color(t.node) : '#0f172a'} />
                <text x={p.x} y={p.y} textAnchor={p.anchor} className="fill-slate-700 text-[14px] font-bold">
                  {t.text}
                </text>
              </g>
            );
          })}
          {s.terminals.map((t, i) => {
            const p = labelPos(t.side, t.x, t.y, 13);
            return (
              <g key={`t${i}`}>
                <circle cx={t.x} cy={t.y} r={6} fill="#fff" stroke={showNodes ? color(t.node) : '#0f172a'} strokeWidth={2.4} />
                <text x={p.x} y={p.y} textAnchor={p.anchor} className="fill-slate-900 text-[16px] font-extrabold">
                  {t.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Resistor({
  r,
  selected,
  interactive,
  onToggle,
  leadColors,
  showNodes,
  highlight,
}: {
  r: SchResistor;
  selected: boolean;
  interactive: boolean;
  onToggle?: (id: string) => void;
  leadColors: [string, string];
  showNodes: boolean;
  highlight: boolean;
}) {
  const h = r.orient === 'h';
  const { cx, cy } = r;
  const leadW = showNodes ? 3 : 2.2;
  const body = h ? { x: cx - 22, y: cy - 9, width: 44, height: 18 } : { x: cx - 9, y: cy - 22, width: 18, height: 44 };
  const hit = h ? { x: cx - 30, y: cy - 20, width: 60, height: 40 } : { x: cx - 20, y: cy - 30, width: 40, height: 60 };
  const isUnknown = r.value === '?';
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle?.(r.id);
    }
  };
  return (
    <g
      className={`group outline-none ${interactive ? 'cursor-pointer' : ''} ${highlight ? 'pop-in' : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={`${r.label} = ${r.value}`}
      onClick={interactive ? () => onToggle?.(r.id) : undefined}
      onKeyDown={interactive ? onKey : undefined}
    >
      {h ? (
        <>
          <line x1={cx - 40} y1={cy} x2={cx - 22} y2={cy} stroke={leadColors[0]} strokeWidth={leadW} />
          <line x1={cx + 22} y1={cy} x2={cx + 40} y2={cy} stroke={leadColors[1]} strokeWidth={leadW} />
        </>
      ) : (
        <>
          <line x1={cx} y1={cy - 40} x2={cx} y2={cy - 22} stroke={leadColors[0]} strokeWidth={leadW} />
          <line x1={cx} y1={cy + 22} x2={cx} y2={cy + 40} stroke={leadColors[1]} strokeWidth={leadW} />
        </>
      )}
      <rect {...hit} fill="transparent" />
      {interactive && (
        <rect
          x={hit.x - 2}
          y={hit.y - 2}
          width={hit.width + 4}
          height={hit.height + 4}
          rx={8}
          fill="none"
          stroke="#5f8cff"
          strokeWidth={2}
          strokeDasharray="4 3"
          className="opacity-0 group-focus-visible:opacity-100"
        />
      )}
      <rect
        {...body}
        rx={3}
        fill={selected ? '#dbe6ff' : isUnknown ? '#fef9c3' : '#ffffff'}
        stroke={selected ? '#1f55f0' : '#0f172a'}
        strokeWidth={selected ? 3.2 : 2.2}
        className={interactive ? 'transition-colors group-hover:fill-brand-50' : ''}
      />
      {h ? (
        <>
          <text x={cx} y={cy - 15} textAnchor="middle" className={`text-[13px] font-bold ${selected ? 'fill-brand-700' : 'fill-slate-900'}`}>
            {r.label}
          </text>
          <text x={cx} y={cy + 25} textAnchor="middle" className="fill-slate-600 text-[12px] font-medium">
            {r.value}
          </text>
        </>
      ) : (
        <>
          <text x={cx + 15} y={cy - 3} textAnchor="start" className={`text-[13px] font-bold ${selected ? 'fill-brand-700' : 'fill-slate-900'}`}>
            {r.label}
          </text>
          <text x={cx + 15} y={cy + 13} textAnchor="start" className="fill-slate-600 text-[12px] font-medium">
            {r.value}
          </text>
        </>
      )}
    </g>
  );
}
