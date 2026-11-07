import { ERRORS } from '../content/errors';
import type { ErrorCode, Level } from '../engine/types';

/** Erreurs fréquentes de la classe : barres horizontales (% des élèves). */
export function ErrorBarChart({ data }: { data: { code: ErrorCode; percent: number; students: number }[] }) {
  const rows = data.filter((d) => d.code !== 'E0' || d.students > 0);
  return (
    <ul className="space-y-2" aria-label="Erreurs fréquentes de la classe">
      {rows.map((d) => (
        <li key={d.code} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-2 text-sm sm:grid-cols-[13rem_1fr_3.5rem]">
          <span className="truncate text-slate-700" title={ERRORS[d.code].name}>
            <strong className="text-slate-900">{d.code}</strong>
            <span className="hidden sm:inline"> · {ERRORS[d.code].name}</span>
          </span>
          <div className="h-5 overflow-hidden rounded-md bg-slate-100">
            <div
              className={`h-full rounded-md ${d.percent >= 50 ? 'bg-warn-500' : d.percent > 0 ? 'bg-brand-400' : ''}`}
              style={{ width: `${d.percent}%` }}
              role="img"
              aria-label={`${d.code} : ${d.percent} % des élèves`}
            />
          </div>
          <span className="text-right tabular-nums text-slate-600">{d.percent} %</span>
        </li>
      ))}
    </ul>
  );
}

const LEVEL_Y: Record<Level, number> = { facile: 0, moyen: 1, difficile: 2 };

/** Courbe de progression : maîtrise moyenne (0–100) après chaque tentative, niveau en arrière-plan. */
export function ProgressChart({ series }: { series: { at: string; mastery: number; level: Level }[] }) {
  if (series.length < 2) return <p className="text-sm text-slate-500">Pas encore assez de tentatives pour tracer une courbe.</p>;
  const W = 600;
  const H = 200;
  const pad = { l: 34, r: 10, t: 10, b: 24 };
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const points = series.map((p, i) => `${x(i)},${y(p.mastery)}`).join(' ');
  const levelBand = ['#eef4ff', '#e0e7ff', '#ede9fe'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Courbe de progression de la maîtrise moyenne">
      {series.map((p, i) =>
        i < series.length - 1 ? (
          <rect key={`b${i}`} x={x(i)} y={pad.t} width={x(i + 1) - x(i)} height={H - pad.t - pad.b} fill={levelBand[LEVEL_Y[p.level]]} />
        ) : null,
      )}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {v}
          </text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="#1f55f0" strokeWidth={2.5} strokeLinejoin="round" />
      {series.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.mastery)} r={3} fill="#1f55f0" />
      ))}
      <text x={pad.l} y={H - 6} className="fill-slate-400 text-[11px]">
        1re tentative
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-slate-400 text-[11px]">
        dernière
      </text>
    </svg>
  );
}

export function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#eef4ff] ring-1 ring-slate-200" /> facile</span>
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#e0e7ff] ring-1 ring-slate-200" /> moyen</span>
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#ede9fe] ring-1 ring-slate-200" /> difficile</span>
    </div>
  );
}
