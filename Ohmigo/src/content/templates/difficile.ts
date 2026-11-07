import { add, frac, isClean, parallel, sub } from '../../engine/fraction';
import { type ExerciseTemplate, buildInstance, randomLayout, retry, shuffleTree } from '../../engine/generate';
import { isBridgeBalanced } from '../../engine/netlist';
import { texOhms } from '../../engine/math';
import { type Rng, chance, pick, shuffle } from '../../engine/rng';
import { type Node, type RNode, P, R, S, W, allSubtreesClean, relabel, reqOf } from '../../engine/tree';
import type { BridgeNet } from '../../engine/types';
import { cleanMixed } from './moyen';


const r = (v: number, label = '') => R(label, v);
const SMALL = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const SHORTED_POOL = [47, 68, 100, 150, 220, 330];

export const D1: ExerciseTemplate = {
  id: 'D1',
  level: 'difficile',
  title: 'Court-circuit caché : un fil met une résistance hors circuit',
  competences: ['C5'],
  testsErrors: ['E6', 'E5', 'E2', 'E3', 'E9'],
  generate(rng) {
    const [a, b] = retry(
      () => {
        const x = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30]);
        const y = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30]);
        return x !== y && isClean(parallel([frac(x), frac(y)])) ? [x, y] : null;
      },
      () => [6, 3],
    );
    const shorted = r(pick(rng, SHORTED_POOL));
    const shortBlock = P(...shuffle(rng, [shorted, W()]));
    const t: Node = chance(rng, 0.6) ? S(P(r(a), r(b)), shortBlock) : P(S(r(a), shortBlock), r(b));
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(chance(rng, 0.5) ? t : shuffleTree(rng, t)) },
      layout: randomLayout(rng, 'classic', 0, 0.4),
    });
  },
};

/** Réseau en échelle construit depuis l'extrémité : chaque étape reste propre. */
function ladderTree(rng: Rng, rungs: number): Node | null {
  let inner: Node | null = null;
  for (let i = 0; i < 50 && !inner; i++) {
    const x = pick(rng, SMALL);
    const y = pick(rng, SMALL);
    if (isClean(parallel([frac(x), frac(y)]))) inner = P(r(x), r(y));
  }
  if (!inner) return null;
  let cur: Node = inner;
  for (let k = 1; k < rungs; k++) {
    const s = S(r(pick(rng, SMALL)), cur);
    const sv = reqOf(s);
    const rung = shuffle(rng, SMALL).find((v) => isClean(parallel([frac(v), sv])));
    if (rung === undefined) return null;
    cur = P(r(rung), s);
  }
  const t = S(r(pick(rng, SMALL)), cur);
  return allSubtreesClean(t) ? t : null;
}

export const D2: ExerciseTemplate = {
  id: 'D2',
  level: 'difficile',
  title: 'Réseau en échelle (2–3 échelons), à calculer depuis l’extrémité',
  competences: ['C5'],
  testsErrors: ['E8', 'E5', 'E2', 'E3', 'E9'],
  generate(rng) {
    const rungs = chance(rng, 0.6) ? 2 : 3;
    const t = retry(
      () => ladderTree(rng, rungs),
      () => S(r(2), P(r(4), S(r(2), P(r(4), r(4))))),
      500,
    );
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: relabel(t) },
      layout: { style: 'ladder', mirror: chance(rng, 0.25) },
      ladder: true,
    });
  },
};

export function makeBridge(v: [number, number, number, number, number]): BridgeNet {
  const [a, b, c, d, e] = v;
  return { r1: r(a, 'R1'), r2: r(b, 'R2'), r3: r(c, 'R3'), r4: r(d, 'R4'), r5: r(e, 'R5') };
}

export const D3: ExerciseTemplate = {
  id: 'D3',
  level: 'difficile',
  title: 'Pont de Wheatstone équilibré (R1/R2 = R3/R4)',
  competences: ['C5'],
  testsErrors: ['E7', 'E5', 'E2', 'E3', 'E9'],
  generate(rng) {
    const net = retry(
      () => {
        const r1 = pick(rng, [1, 2, 3, 4, 5, 6, 8, 10, 12]);
        const r2 = pick(rng, [1, 2, 3, 4, 5, 6, 8, 10, 12]);
        const r3 = pick(rng, [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20]);
        if (r1 === r2 || r3 === r1 || (r3 * r2) % r1 !== 0) return null;
        const r4 = (r3 * r2) / r1;
        if (r4 > 40) return null;
        const req = parallel([frac(r1 + r2), frac(r3 + r4)]);
        if (!isClean(req)) return null;
        const r5 = pick(rng, [5, 10, 15, 20, 47, 100].filter((x) => ![r1, r2, r3, r4].includes(x)));
        return makeBridge([r1, r2, r3, r4, r5]);
      },
      () => makeBridge([2, 4, 3, 6, 10]),
    );
    if (!isBridgeBalanced(net)) throw new Error('Pont non équilibré');
    return buildInstance({
      template: this,
      circuit: { type: 'bridge', net },
      layout: { style: 'bridge', mirror: chance(rng, 0.3) },
    });
  },
};

export const D4: ExerciseTemplate = {
  id: 'D4',
  level: 'difficile',
  title: 'Problème inverse : Req donnée, trouver R',
  competences: ['C6'],
  testsErrors: ['E11', 'E9', 'E10'],
  generate(rng) {
    const vals = retry(
      () => {
        const known = pick(rng, [6, 8, 10, 12, 15, 20, 24, 30, 36, 40, 60]);
        const x = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30]);
        if (x === known) return null;
        const rp = parallel([frac(x), frac(known)]);
        const rs = pick(rng, [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]);
        const req = add(rp, frac(rs));
        return isClean(rp) && isClean(req) ? { known, x, rs, rp, req } : null;
      },
      () => ({ known: 12, x: 4, rs: 4, rp: frac(3), req: frac(7) }),
    );
    const unknown: RNode = R('R', 'unknown');
    const t = relabel(shuffleTree(rng, S(P(unknown, r(vals.known)), r(vals.rs))));
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: t },
      layout: randomLayout(rng, 'classic', 0, 0.3),
      prompt: `La résistance équivalente entre les bornes A et B vaut $R_{eq} = ${texOhms(vals.req, 'Ω')}$. Trouve la valeur de la résistance $R$.`,
      answer: frac(vals.x),
      inverse: {
        unknownId: unknown.id,
        givenReq: vals.req,
        seriesValue: frac(vals.rs),
        parallelKnown: frac(vals.known),
        parallelValue: sub(vals.req, frac(vals.rs)),
      },
    });
  },
};

export const D5: ExerciseTemplate = {
  id: 'D5',
  level: 'difficile',
  title: 'Req entre deux autres points (C et D) d’un même circuit',
  competences: ['C4', 'C5'],
  testsErrors: ['E5', 'E1', 'E3', 'E9'],
  generate(rng) {
    const pool = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
    const v = retry(
      () => {
        const [a, b, c, d] = [pick(rng, pool), pick(rng, pool), pick(rng, pool), pick(rng, pool)];
        const cd = parallel([frac(a + d), frac(b + c)]);
        const ab = parallel([frac(a + b), frac(c + d)]);
        if (!isClean(cd) || cd.n * ab.d === ab.n * cd.d) return null;
        return [a, b, c, d];
      },
      () => [2, 3, 3, 4],
    );
    const [r1, r2, r3, r4] = v.map((x, i) => r(x, `R${i + 1}`));
    const tree = P(S(r1, r4), S(r2, r3));
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree },
      layout: { style: 'ring', mirror: chance(rng, 0.3) },
      terminals: ['C', 'D'],
      roles: { r1: r1.id, r2: r2.id, r3: r3.id, r4: r4.id },
      prompt: 'Ce circuit est habituellement branché entre A et B. Calcule cette fois la résistance équivalente $R_{eq}$ entre les bornes C et D.',
      extraDistractors: [{ value: reqOf(P(S(r1, r2), S(r4, r3))), code: 'E5', label: 'Req calculée entre A et B' }],
    });
  },
};

export const D6: ExerciseTemplate = {
  id: 'D6',
  level: 'difficile',
  title: 'Circuit mixte complexe (6 résistances) à redessiner',
  competences: ['C4', 'C5'],
  testsErrors: ['E5', 'E1', 'E2', 'E3', 'E9'],
  generate(rng) {
    const t = cleanMixed(
      rng,
      (v) => S(r(v()), P(S(P(r(v()), r(v())), r(v())), r(v())), r(v())),
      () => S(r(2), P(S(P(r(6), r(3)), r(4)), r(12)), r(1)),
      [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24],
      4,
    );
    // Ordre de parcours : R1, R2, R3, R4, R5, R6 → rôles du layout prédéfini.
    const lab = relabel(t);
    const ids: string[] = [];
    const collect = (n: Node) => {
      if (n.kind === 'R') ids.push(n.id);
      else if (n.kind === 'S' || n.kind === 'P') n.children.forEach(collect);
    };
    collect(lab);
    return buildInstance({
      template: this,
      circuit: { type: 'tree', tree: lab },
      layout: { style: 'tangle', mirror: chance(rng, 0.3) },
      roles: { r1: ids[0], r2: ids[1], r3: ids[2], r4: ids[3], r5: ids[4], r6: ids[5] },
    });
  },
};

export const DIFFICILE_TEMPLATES = [D1, D2, D3, D4, D5, D6];
