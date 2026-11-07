import type { ExerciseTemplate } from '../../engine/generate';
import { buildInstance, parallelSet, randomLayout } from '../../engine/generate';
import { type Rng, chance, mulberry32, randInt } from '../../engine/rng';
import { P, R, S, relabel } from '../../engine/tree';
import type { ExerciseInstance, GroupType, Level } from '../../engine/types';
import { DIFFICILE_TEMPLATES } from './difficile';
import { FACILE_TEMPLATES, seriesValues } from './facile';
import { MOYEN_TEMPLATES } from './moyen';

export const TEMPLATES: ExerciseTemplate[] = [...FACILE_TEMPLATES, ...MOYEN_TEMPLATES, ...DIFFICILE_TEMPLATES];

export function getTemplate(id: string): ExerciseTemplate {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Gabarit inconnu : ${id}`);
  return t;
}

export const templatesOfLevel = (level: Level): ExerciseTemplate[] => TEMPLATES.filter((t) => t.level === level);

/** Nouvelle instance d'un gabarit : valeurs aléatoires reproductibles à partir de la graine. */
export function createInstance(templateId: string, seed: number): ExerciseInstance {
  const inst = getTemplate(templateId).generate(mulberry32(seed));
  return { ...inst, seed };
}

/** Question de compréhension après la vidéo : schéma simple, série ou parallèle ? */
export interface ComprehensionQuestion {
  instance: ExerciseInstance;
  answer: GroupType;
}

export function createComprehension(seed: number): ComprehensionQuestion {
  const rng: Rng = mulberry32(seed);
  const answer: GroupType = chance(rng, 0.5) ? 'S' : 'P';
  const n = randInt(rng, 2, 3);
  const tree =
    answer === 'S'
      ? relabel(S(...seriesValues(rng, n).map((v) => R('', v))))
      : relabel(P(...parallelSet(rng, n).map((v) => R('', v))));
  const instance = buildInstance({
    template: { id: 'Q', level: 'facile' },
    circuit: { type: 'tree', tree },
    layout: randomLayout(rng, 'classic', 0.25, 0.25),
    prompt: 'Ces résistances sont-elles montées en série ou en parallèle ?',
  });
  return { instance: { ...instance, seed }, answer };
}
