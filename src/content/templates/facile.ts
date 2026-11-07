import { isClean, frac } from '../../engine/fraction';
import {
  type ExerciseTemplate,
  buildInstance,
  isCleanIn,
  parallelSet,
  randomLayout,
  retry,
} from '../../engine/generate';
import { type Rng, chance, pick, pickDistinct, randInt } from '../../engine/rng';
import { type Node, P, R, S, relabel, reqOf, scaleValues } from '../../engine/tree';

/** Valeurs courantes pour les montages en série (Ω). */
export const SERIES_POOL = [5, 8, 10, 12, 15, 18, 20, 21, 22, 25, 27, 30, 33, 39, 40, 47, 50, 56, 68, 82, 100];
const IDENTICAL_POOL = [10, 12, 15, 20, 24, 30, 36, 40, 45, 50, 60, 80, 100, 120];
/** Valeurs en kΩ (normalisées). */
const K_POOL = [1, 1.2, 1.5, 2.2, 2.7, 3.3, 4.7, 5.6, 6.8, 8.2, 10];

const tree = (values: number[], kind: 'S' | 'P'): Node =>
  relabel(kind === 'S' ? S(...values.map((v) => R('', v))) : P(...values.map((v) => R('', v))));

export function seriesValues(rng: Rng, n: number): number[] {
  return pickDistinct(rng, SERIES_POOL, n);
}

export function identicalValues(rng: Rng): number[] {
  return retry(
    () => {
      const n = randInt(rng, 2, 5);
      const r = pick(rng, IDENTICAL_POOL);
      return isClean(frac(r, n)) ? Array.from({ length: n }, () => r) : null;
    },
    () => [20, 20, 20, 20],
  );
}

export const F1: ExerciseTemplate = {
  id: 'F1',
  level: 'facile',
  title: '3–4 résistances en série',
  competences: ['C1', 'C2'],
  testsErrors: ['E1', 'E9', 'E10', 'E0'],
  generate(rng) {
    const values = seriesValues(rng, randInt(rng, 3, 4));
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: tree(values, 'S') },
      layout: randomLayout(rng, 'classic', 0.2, 0.2),
      allowDirect: true,
    });
  },
};

export const F2: ExerciseTemplate = {
  id: 'F2',
  level: 'facile',
  title: '3 résistances en parallèle',
  competences: ['C1', 'C3'],
  testsErrors: ['E1', 'E2', 'E3', 'E4', 'E9', 'E10', 'E0'],
  generate(rng) {
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: tree(parallelSet(rng, 3), 'P') },
      layout: randomLayout(rng, 'classic', 0.2, 0.2),
      allowDirect: true,
    });
  },
};

export const F3: ExerciseTemplate = {
  id: 'F3',
  level: 'facile',
  title: 'n résistances identiques en parallèle (R/n)',
  competences: ['C3'],
  testsErrors: ['E2', 'E3', 'E4', 'E9', 'E10', 'E0'],
  generate(rng) {
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: tree(identicalValues(rng), 'P') },
      layout: randomLayout(rng, chance(rng, 0.3) ? 'rails' : 'classic', 0.2, 0.2),
      allowDirect: true,
    });
  },
};

export const F4: ExerciseTemplate = {
  id: 'F4',
  level: 'facile',
  title: 'Série ou parallèle dessiné de façon inhabituelle',
  competences: ['C1'],
  testsErrors: ['E1', 'E2', 'E3', 'E9', 'E0'],
  generate(rng) {
    const isSeries = chance(rng, 0.5);
    if (isSeries) {
      const values = seriesValues(rng, randInt(rng, 3, 4));
      return buildInstance({
        template: this,
        circuit: { type: 'tree', tree: tree(values, 'S') },
        layout: chance(rng, 0.65) ? randomLayout(rng, 'snake', 0, 0.4) : { style: 'classic', rotate: true, mirror: chance(rng, 0.5) },
        allowDirect: true,
      });
    }
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: tree(parallelSet(rng, randInt(rng, 2, 3)), 'P') },
      layout: randomLayout(rng, 'rails', 0, 0.4),
      allowDirect: true,
    });
  },
};

export const F5: ExerciseTemplate = {
  id: 'F5',
  level: 'facile',
  title: 'Même type de circuit avec des valeurs en kΩ',
  competences: ['C2', 'C3'],
  testsErrors: ['E10', 'E2', 'E3', 'E9', 'E0'],
  generate(rng) {
    const variant = randInt(rng, 0, 2);
    let t: Node;
    if (variant === 0) {
      t = tree(
        pickDistinct(rng, K_POOL, randInt(rng, 3, 4)).map((v) => Math.round(v * 1000)),
        'S',
      );
    } else if (variant === 1) {
      t = scaleValues(tree(parallelSet(rng, 3), 'P'), 1000);
    } else {
      t = scaleValues(tree(identicalValues(rng), 'P'), 1000);
    }
    if (!isCleanIn(reqOf(t), 'kΩ')) t = scaleValues(tree([12, 6, 4], 'P'), 1000);
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: t },
      layout: randomLayout(rng, 'classic', 0.2, 0.2),
      unit: 'kΩ',
      allowDirect: true,
    });
  },
};

export const FACILE_TEMPLATES = [F1, F2, F3, F4, F5];
