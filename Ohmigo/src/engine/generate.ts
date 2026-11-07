import { computeDistractors, answerTree } from './diagnostic';
import { type Frac, isClean, frac, toNumber } from './fraction';
import { bridgeResistors } from './netlist';
import { type Unit, unitFactor } from './numbers';
import { type Rng, pickDistinct, pick, shuffle } from './rng';
import { type Node, isLeaf, reqOf, resistors, signature } from './tree';
import type {
  CircuitState,
  Competence,
  Distractor,
  ErrorCode,
  ExerciseInstance,
  InverseMeta,
  LayoutSpec,
  Level,
} from './types';

/** Gabarit d'exercice (section 6) : structure fixe + générateur de valeurs à résultat propre. */
export interface ExerciseTemplate {
  id: string;
  level: Level;
  /** Description pour le professeur (jamais montrée à l'élève : elle trahirait le type de montage). */
  title: string;
  competences: Competence[];
  testsErrors: ErrorCode[];
  generate(rng: Rng): ExerciseInstance;
}

export const standardPrompt = (t: [string, string]): string =>
  `Calcule la résistance équivalente $R_{eq}$ entre les bornes ${t[0]} et ${t[1]}.`;

/** Essaie de construire une instance valide ; en dernier recours, utilise l'exemple de référence. */
export function retry<T>(build: () => T | null, fallback: () => T, tries = 4000): T {
  for (let i = 0; i < tries; i++) {
    const v = build();
    if (v !== null) return v;
  }
  return fallback();
}

export function shuffleTree(rng: Rng, node: Node): Node {
  if (isLeaf(node)) return node;
  return { ...node, children: shuffle(rng, node.children.map((c) => shuffleTree(rng, c))) };
}

/** Valeur « propre » dans l'unité affichée (au plus une décimale). */
export function isCleanIn(f: Frac, unit: Unit): boolean {
  return isClean(frac(f.n, f.d * unitFactor(unit)));
}

export function distinctCount(values: number[]): number {
  return new Set(values).size;
}

export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

const PARALLEL_BASES = [12, 18, 20, 24, 30, 36, 40, 48, 60, 72, 90, 120];

/**
 * k résistances distinctes en parallèle avec Req propre :
 * Ri = B / ki, donc 1/Req = Σki / B et Req = B / Σki.
 */
export function parallelSet(rng: Rng, k: number): number[] {
  return retry(
    () => {
      const B = pick(rng, PARALLEL_BASES);
      const divs = divisors(B).filter((d) => B / d >= 2 && B / d <= 150);
      if (divs.length < k) return null;
      const ks = pickDistinct(rng, divs, k);
      const total = ks.reduce((a, b) => a + b, 0);
      return isClean(frac(B, total)) ? ks.map((d) => B / d) : null;
    },
    () => (k === 2 ? [12, 6] : [12, 6, 4]),
  );
}

export function randomLayout(rng: Rng, style: LayoutSpec['style'] = 'classic', rotateP = 0.2, mirrorP = 0.3): LayoutSpec {
  return { style, rotate: rng() < rotateP, mirror: rng() < mirrorP };
}

export function circuitResistors(c: CircuitState) {
  return c.type === 'tree' ? resistors(c.tree) : bridgeResistors(c.net);
}

export interface BuildParams {
  template: Pick<ExerciseTemplate, 'id' | 'level'>;
  circuit: CircuitState;
  layout: LayoutSpec;
  unit?: Unit;
  terminals?: [string, string];
  prompt?: string;
  roles?: Record<string, string>;
  ladder?: boolean;
  inverse?: InverseMeta;
  answer?: Frac;
  extraDistractors?: Distractor[];
  allowDirect?: boolean;
}

export function buildInstance(p: BuildParams): ExerciseInstance {
  const terminals = p.terminals ?? ['A', 'B'];
  const answer = p.answer ?? reqOf(answerTree(p.circuit));
  const distractors = computeDistractors({
    circuit: p.circuit,
    answer,
    ladder: p.ladder,
    inverse: p.inverse,
    extra: p.extraDistractors,
  });
  const values: Record<string, number> = {};
  circuitResistors(p.circuit).forEach((r) => {
    if (r.value !== 'unknown') values[r.label] = toNumber(r.value);
  });
  return {
    templateId: p.template.id,
    level: p.template.level,
    seed: 0,
    kind: p.inverse ? 'inverse' : 'reduce',
    circuit: p.circuit,
    layout: p.layout,
    initialSignature: p.circuit.type === 'tree' ? signature(p.circuit.tree) : 'bridge',
    roles: p.roles,
    unit: p.unit ?? 'Ω',
    terminals,
    prompt: p.prompt ?? standardPrompt(terminals),
    answer,
    distractors,
    allowDirect: p.allowDirect ?? false,
    ladder: p.ladder,
    inverse: p.inverse,
    values,
  };
}

