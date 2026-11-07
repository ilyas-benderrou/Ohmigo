import { ADAPTIVE } from '../config/adaptive';
import {
  type Frac,
  add,
  div,
  frac,
  inv,
  isZero,
  mul,
  parallel,
  product,
  sub,
  sum,
  toNumber,
} from './fraction';
import { bridgeResistors, bridgeToTree } from './netlist';
import { isClose } from './numbers';
import {
  type Node,
  type RNode,
  P,
  S,
  depthOf,
  findNode,
  groupValue,
  isLeaf,
  isShorted,
  reqOf,
  removeWires,
  replaceNode,
  resistors,
  validateGroup,
} from './tree';
import type { CircuitState, Distractor, ErrorCode, ExerciseInstance, GroupType, InverseMeta } from './types';

/** Arbre série-parallèle équivalent au circuit (pont : après retrait de la résistance centrale). */
export function answerTree(circuit: CircuitState): Node {
  return circuit.type === 'tree' ? circuit.tree : bridgeToTree(circuit.net);
}

// ---------------------------------------------------------------------------
// Évaluations « fautives » typiques
// ---------------------------------------------------------------------------

/** E3 : on additionne les inverses sans inverser le résultat. */
function evalNoInvert(n: Node): Frac {
  switch (n.kind) {
    case 'R':
    case 'W':
      return reqOf(n);
    case 'S':
      return sum(n.children.map(evalNoInvert));
    case 'P':
      return sum(n.children.map(evalNoInvert).filter((v) => !isZero(v)).map(inv));
  }
}

/** E4 : produit/somme appliqué à 3 résistances ou plus. */
function evalProdSum(n: Node): Frac {
  switch (n.kind) {
    case 'R':
    case 'W':
      return reqOf(n);
    case 'S':
      return sum(n.children.map(evalProdSum));
    case 'P': {
      const vals = n.children.map(evalProdSum);
      if (vals.length < 3 || vals.some(isZero)) return parallel(vals);
      return div(product(vals), sum(vals));
    }
  }
}

function hasWire(n: Node): boolean {
  if (n.kind === 'W') return true;
  return !isLeaf(n) && n.children.some(hasWire);
}

function hasBigParallel(n: Node): boolean {
  if (isLeaf(n)) return false;
  return (n.kind === 'P' && n.children.length >= 3) || n.children.some(hasBigParallel);
}

function* branches(n: Node): Generator<Extract<Node, { kind: 'S' | 'P' }>> {
  if (isLeaf(n)) return;
  yield n;
  for (const c of n.children) yield* branches(c);
}

/** E5 : mauvais regroupements plausibles (mutations structurelles de l'arbre). */
function regroupings(tree: Node): Node[] {
  const out: Node[] = [];
  for (const b of branches(tree)) {
    if (b.kind === 'P') {
      for (const c of b.children) {
        if (c.kind !== 'S' || c.children.length < 2) continue;
        const others = b.children.filter((x) => x !== c);
        const first = c.children[0];
        const restS = c.children.slice(1);
        const lastS = c.children[c.children.length - 1];
        const initS = c.children.slice(0, -1);
        const asS = (l: Node[]) => (l.length === 1 ? l[0] : S(...l));
        // Le premier élément de la branche est « sorti » du parallèle (ex. R1 + (R2 // R3)).
        out.push(replaceNode(tree, b.id, S(first, P(asS(restS), ...others))));
        out.push(replaceNode(tree, b.id, S(P(asS(initS), ...others), lastS)));
        // Tous les éléments de la branche considérés en parallèle.
        out.push(replaceNode(tree, b.id, P(...c.children, ...others)));
      }
    } else {
      // Une résistance en série « rentrée » dans le parallèle voisin.
      b.children.forEach((c, i) => {
        if (c.kind !== 'P') return;
        const prev = b.children[i - 1];
        if (prev && isLeaf(prev)) {
          const merged = P(S(prev, c.children[0]), ...c.children.slice(1));
          const children = b.children.filter((x) => x !== prev).map((x) => (x === c ? merged : x));
          out.push(replaceNode(tree, b.id, children.length === 1 ? children[0] : { ...b, children }));
        }
      });
    }
  }
  return out;
}

/** Séquence d'une échelle depuis A : [horizontale, échelon, horizontale, échelon, …, fin]. */
function ladderSequence(tree: Node): { r: RNode; role: 'h' | 'rung' | 'end' }[] | null {
  const seq: { r: RNode; role: 'h' | 'rung' | 'end' }[] = [];
  let n: Node = tree;
  for (;;) {
    if (n.kind === 'R') {
      seq.push({ r: n, role: 'end' });
      return seq;
    }
    if (n.kind === 'S' && n.children.length === 2 && n.children[0].kind === 'R') {
      seq.push({ r: n.children[0], role: 'h' });
      n = n.children[1];
    } else if (n.kind === 'P' && n.children.length === 2 && n.children[0].kind === 'R') {
      seq.push({ r: n.children[0], role: 'rung' });
      n = n.children[1];
    } else return null;
  }
}

/** E8 : échelle calculée depuis la borne A (mauvais bout). */
function reversedLadder(tree: Node): Frac | null {
  const seq = ladderSequence(tree);
  if (!seq) return null;
  let acc: Frac | null = null;
  for (const { r, role } of seq) {
    const v = reqOf(r);
    if (acc === null) acc = v;
    else acc = role === 'rung' ? parallel([acc, v]) : add(acc, v);
  }
  return acc;
}

function inverseDistractors(meta: InverseMeta): Distractor[] {
  const { givenReq, seriesValue, parallelKnown: R1, parallelValue: Rp } = meta;
  const out: Distractor[] = [{ value: Rp, code: 'E11', label: 'R prise égale à la partie parallèle' }];
  if (toNumber(R1) > toNumber(givenReq)) {
    out.push({ value: div(mul(givenReq, R1), sub(R1, givenReq)), code: 'E11', label: 'Série oubliée : R // R1 = Req' });
  }
  out.push({ value: div(mul(Rp, R1), add(Rp, R1)), code: 'E11', label: 'Erreur de signe : 1/R = 1/Rp + 1/R1' });
  out.push({ value: sub(R1, Rp), code: 'E11', label: 'Parallèle traité comme une série : R = R1 − Rp' });
  out.push({ value: sub(sub(givenReq, seriesValue), R1), code: 'E11', label: 'Tout soustrait : R = Req − Rs − R1' });
  return out;
}

/** Garde les distracteurs valides, différents de la bonne réponse et sans doublon (le premier gagne). */
function cleanDistractors(list: Distractor[], answer: Frac): Distractor[] {
  const out: Distractor[] = [];
  const a = toNumber(answer);
  for (const d of list) {
    const v = toNumber(d.value);
    if (!Number.isFinite(v) || v <= 0) continue;
    if (isClose(v, a, ADAPTIVE.answerRelTolerance * 2)) continue;
    if (out.some((o) => isClose(toNumber(o.value), v, ADAPTIVE.answerRelTolerance * 2))) continue;
    out.push(d);
  }
  return out;
}

export interface DistractorInput {
  circuit: CircuitState;
  answer: Frac;
  ladder?: boolean;
  inverse?: InverseMeta;
  extra?: Distractor[];
}

/** Réponses fausses typiques calculées automatiquement pour l'instance (section 7.1). */
export function computeDistractors(inp: DistractorInput): Distractor[] {
  const list: Distractor[] = [];
  const thousand = frac(1000);
  if (inp.inverse) {
    list.push(...inverseDistractors(inp.inverse));
  } else {
    const tree = answerTree(inp.circuit);
    const original = inp.circuit.type === 'tree' ? inp.circuit.tree : null;
    if (original) {
      const noWire = hasWire(original) ? removeWires(original) : null;
      if (noWire && resistors(noWire).length === resistors(original).length) {
        list.push({ value: reqOf(noWire), code: 'E6', label: 'Résistance court-circuitée comptée' });
      }
    }
    if (inp.circuit.type === 'bridge') {
      const { r1, r2, r3, r4, r5 } = inp.circuit.net;
      list.push({ value: reqOf(P(S(r1, r2), S(r3, r4), r5)), code: 'E7', label: 'Résistance centrale mise en parallèle' });
      list.push({ value: reqOf(S(r1, r5, r4)), code: 'E7', label: 'Chemin passant par la résistance centrale' });
    }
    if (inp.ladder) {
      const rev = reversedLadder(tree);
      if (rev) list.push({ value: rev, code: 'E8', label: 'Échelle calculée depuis A' });
    }
    const all = inp.circuit.type === 'bridge' ? bridgeResistors(inp.circuit.net) : resistors(original ?? tree);
    list.push({ value: sum(all.map(reqOf)), code: 'E2', label: 'Toutes les résistances additionnées' });
    list.push({ value: evalNoInvert(tree), code: 'E3', label: '1/Req non inversé' });
    if (hasBigParallel(tree)) list.push({ value: evalProdSum(tree), code: 'E4', label: 'Produit/somme sur 3 résistances' });
    regroupings(tree)
      .slice(0, 4)
      .forEach((t) => list.push({ value: reqOf(t), code: 'E5', label: 'Mauvais regroupement' }));
  }
  if (inp.extra) list.push(...inp.extra);
  list.push({ value: mul(inp.answer, thousand), code: 'E10', label: 'Unité : ×1000' });
  list.push({ value: div(inp.answer, thousand), code: 'E10', label: 'Unité : ÷1000' });
  return cleanDistractors(list, inp.answer);
}

// ---------------------------------------------------------------------------
// Diagnostic d'une réponse finale (mode « réponse directe »)
// ---------------------------------------------------------------------------

export type Diagnosis = { ok: true } | { ok: false; code: ErrorCode | null; detail?: string };

export function diagnoseFinal(inst: ExerciseInstance, valueOhm: number, elapsedSec: number): Diagnosis {
  if (isClose(valueOhm, toNumber(inst.answer))) return { ok: true };
  const d = inst.distractors.find((x) => isClose(valueOhm, toNumber(x.value)));
  if (d) return { ok: false, code: d.code, detail: d.label };
  if (elapsedSec < ADAPTIVE.guessTimeSec) return { ok: false, code: 'E0', detail: 'Réponse trop rapide' };
  return { ok: false, code: null };
}

// ---------------------------------------------------------------------------
// Diagnostic au niveau des étapes (réduction interactive)
// ---------------------------------------------------------------------------

/** Type choisi pour un groupe : E1 (mauvais type), E5 (mauvais regroupement), E6, E7, E8. */
export function diagnoseGroup(state: CircuitState, ids: string[], type: GroupType, opts: { ladder?: boolean } = {}): Diagnosis {
  if (ids.length < 2) return { ok: false, code: null, detail: 'too-few' };
  if (state.type === 'bridge') {
    if (ids.includes(state.net.r5.id)) return { ok: false, code: 'E7' };
    return { ok: false, code: 'E5' };
  }
  const tree = state.tree;
  if (ids.some((id) => isShorted(tree, id))) return { ok: false, code: 'E6' };
  const check = validateGroup(tree, ids, type);
  if (check.ok) return { ok: true };
  switch (check.reason) {
    case 'wrong-type':
      return { ok: false, code: 'E1' };
    case 'not-siblings': {
      if (opts.ladder) {
        const maxDepth = Math.max(...resistors(tree).map((r) => depthOf(tree, r.id)));
        if (maxDepth > 2 && ids.some((id) => depthOf(tree, id) <= 2)) return { ok: false, code: 'E8' };
      }
      return { ok: false, code: 'E5' };
    }
    default:
      return { ok: false, code: 'E5' };
  }
}

/** Valeur saisie pour un groupe valide : E2, E3, E4, E10 ou E9 (erreur de calcul). */
export function diagnoseGroupValue(state: CircuitState, ids: string[], type: GroupType, valueOhm: number): Diagnosis {
  if (state.type !== 'tree') return { ok: false, code: 'E5' };
  const tree = state.tree;
  const correct = toNumber(groupValue(tree, ids, type));
  if (isClose(valueOhm, correct)) return { ok: true };
  const vals = ids.map((id) => reqOf(findNode(tree, id)!));
  if (type === 'P') {
    if (isClose(valueOhm, toNumber(sum(vals)))) return { ok: false, code: 'E2' };
    if (!vals.some(isZero) && isClose(valueOhm, toNumber(sum(vals.map(inv))))) return { ok: false, code: 'E3' };
    if (vals.length >= 3 && isClose(valueOhm, toNumber(div(product(vals), sum(vals))))) return { ok: false, code: 'E4' };
  }
  if (isClose(valueOhm, correct * 1000) || isClose(valueOhm, correct / 1000)) return { ok: false, code: 'E10' };
  return { ok: false, code: 'E9' };
}

/** Problème inverse : étape 1 = partie parallèle, étape 2 = R. */
export function diagnoseInverseStep(inst: ExerciseInstance, step: 1 | 2, valueOhm: number): Diagnosis {
  const meta = inst.inverse;
  if (!meta) throw new Error('Pas un problème inverse');
  const target = toNumber(step === 1 ? meta.parallelValue : inst.answer);
  if (isClose(valueOhm, target)) return { ok: true };
  if (isClose(valueOhm, target * 1000) || isClose(valueOhm, target / 1000)) return { ok: false, code: 'E10' };
  if (step === 1) {
    const typical = [meta.givenReq, add(meta.givenReq, meta.seriesValue), meta.seriesValue];
    if (typical.some((t) => isClose(valueOhm, toNumber(t)))) return { ok: false, code: 'E11' };
    return { ok: false, code: 'E9' };
  }
  if (inst.distractors.some((d) => d.code === 'E11' && isClose(valueOhm, toNumber(d.value)))) return { ok: false, code: 'E11' };
  return { ok: false, code: 'E9' };
}

