import { isClean } from '../../engine/fraction';
import { type ExerciseTemplate, buildInstance, distinctCount, randomLayout, retry, shuffleTree } from '../../engine/generate';
import { type Rng, pick } from '../../engine/rng';
import { type Node, P, R, S, allSubtreesClean, relabel, reqOf, resistors } from '../../engine/tree';

/** Valeurs utilisées dans les circuits mixtes (Ω). */
export const MIXED_POOL = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 18, 20, 24, 30, 36, 40];

/**
 * Tire des valeurs au hasard jusqu'à obtenir un circuit où chaque sous-bloc
 * (donc chaque étape de calcul) donne un résultat propre.
 */
export function cleanMixed(
  rng: Rng,
  build: (v: () => number) => Node,
  fallback: () => Node,
  pool: number[] = MIXED_POOL,
  minDistinct = 3,
): Node {
  return retry(
    () => {
      const t = build(() => pick(rng, pool));
      const vals = resistors(t).map((r) => (r.value === 'unknown' ? 0 : r.value.n / r.value.d));
      if (distinctCount(vals) < Math.min(minDistinct, vals.length)) return null;
      return allSubtreesClean(t) && isClean(reqOf(t)) ? t : null;
    },
    fallback,
  );
}

const r = (v: number) => R('', v);

export const M1: ExerciseTemplate = {
  id: 'M1',
  level: 'moyen',
  title: '(R1 + R2) // R3, puis en série avec R4',
  competences: ['C4'],
  testsErrors: ['E5', 'E1', 'E2', 'E3', 'E9', 'E10'],
  generate(rng) {
    const t = cleanMixed(
      rng,
      (v) => S(P(S(r(v()), r(v())), r(v())), r(v())),
      () => S(P(S(r(4), r(8)), r(6)), r(5)),
    );
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(shuffleTree(rng, t)) },
      layout: randomLayout(rng, 'classic', 0.15, 0.3),
    });
  },
};

export const M2: ExerciseTemplate = {
  id: 'M2',
  level: 'moyen',
  title: 'Deux blocs parallèles en série, le tout en parallèle avec R5',
  competences: ['C4'],
  testsErrors: ['E5', 'E1', 'E2', 'E3', 'E9', 'E10'],
  generate(rng) {
    const t = cleanMixed(
      rng,
      (v) => P(S(P(r(v()), r(v())), P(r(v()), r(v()))), r(v())),
      () => P(S(P(r(6), r(3)), P(r(12), r(4))), r(20)),
    );
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(shuffleTree(rng, t)) },
      layout: randomLayout(rng, 'classic', 0.1, 0.3),
    });
  },
};

export const M3: ExerciseTemplate = {
  id: 'M3',
  level: 'moyen',
  title: 'R1 en série avec (R2 // (R3 + R4))',
  competences: ['C4'],
  testsErrors: ['E5', 'E1', 'E2', 'E3', 'E9', 'E10'],
  generate(rng) {
    const t = cleanMixed(
      rng,
      (v) => S(r(v()), P(r(v()), S(r(v()), r(v())))),
      () => S(r(2), P(r(6), S(r(1), r(2)))),
    );
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(shuffleTree(rng, t)) },
      layout: randomLayout(rng, 'classic', 0.15, 0.3),
    });
  },
};

export const M4: ExerciseTemplate = {
  id: 'M4',
  level: 'moyen',
  title: 'Mixte à deux niveaux dessiné « en désordre »',
  competences: ['C4'],
  testsErrors: ['E5', 'E1', 'E2', 'E3', 'E9', 'E10'],
  generate(rng) {
    const t = cleanMixed(
      rng,
      (v) => S(P(r(v()), r(v())), r(v()), P(r(v()), S(r(v()), r(v())))),
      () => S(P(r(6), r(3)), r(4), P(r(12), S(r(2), r(4)))),
    );
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(shuffleTree(rng, t)) },
      layout: randomLayout(rng, 'snake', 0, 0.5),
    });
  },
};

export const MOYEN_TEMPLATES = [M1, M2, M3, M4];
