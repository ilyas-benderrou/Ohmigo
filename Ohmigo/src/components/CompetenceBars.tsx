import { COMPETENCE_LABELS } from '../content/competences';
import { masteryBand } from '../engine/adaptive';
import { COMPETENCES, type Competence } from '../engine/types';

const BAND_COLORS = {
  low: { bar: 'bg-warn-500', cell: 'bg-warn-100 text-warn-700' },
  mid: { bar: 'bg-current', cell: 'bg-yellow-100 text-yellow-800' },
  high: { bar: 'bg-ok-500', cell: 'bg-ok-100 text-ok-700' },
};

/** Compétences C1–C6 en barres de couleur (orange → jaune → vert). */
export function CompetenceBars({ competences, compact = false }: { competences: Record<Competence, number>; compact?: boolean }) {
  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {COMPETENCES.map((c) => {
        const v = Math.round(competences[c]);
        const band = masteryBand(v);
        return (
          <li key={c}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-700">
                <span className="font-semibold text-slate-900">{c}</span> · {COMPETENCE_LABELS[c]}
              </span>
              <span className="tabular-nums text-slate-500">{v} %</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={v}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${c} ${COMPETENCE_LABELS[c]}`}
            >
              <div className={`h-full rounded-full transition-all duration-700 ${BAND_COLORS[band].bar}`} style={{ width: `${Math.max(v, 2)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Version « pastilles » pour le tableau de bord du professeur. */
export function CompetenceCells({ competences }: { competences: Record<Competence, number> }) {
  return (
    <div className="flex gap-1">
      {COMPETENCES.map((c) => {
        const v = Math.round(competences[c]);
        return (
          <span
            key={c}
            title={`${c} · ${COMPETENCE_LABELS[c]} : ${v} %`}
            className={`inline-grid h-7 w-9 place-items-center rounded-md text-[11px] font-semibold tabular-nums ${BAND_COLORS[masteryBand(v)].cell}`}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}
