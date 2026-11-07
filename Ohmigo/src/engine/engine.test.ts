import { describe, expect, it } from 'vitest';
import { add, eq, frac, isClean, parallel, toNumber } from './fraction';
import { bridgeNetlist, bridgeToTree, isBridgeBalanced, reqNetlist, treeToNetlist } from './netlist';
import { formatNumber, isClose, parseUserNumber } from './numbers';
import {
  P,
  R,
  S,
  W,
  groupValue,
  isShorted,
  mergeGroup,
  mergedLabel,
  removeShorted,
  reqOf,
  validateGroup,
} from './tree';
import { makeBridge } from '../content/templates/difficile';

const v = (x: number) => frac(x);

describe('fractions exactes', () => {
  it('réduit et additionne sans erreur d’arrondi', () => {
    expect(add(frac(1, 3), frac(1, 6))).toEqual(frac(1, 2));
    expect(eq(frac(2, 4), frac(1, 2))).toBe(true);
    expect(frac(3, -6)).toEqual({ n: -1, d: 2 });
  });
  it('calcule le parallèle exactement', () => {
    expect(parallel([v(12), v(6), v(4)])).toEqual(frac(2));
    expect(toNumber(parallel([v(6), v(9)]))).toBeCloseTo(3.6);
  });
  it('reconnaît un résultat propre', () => {
    expect(isClean(frac(18, 5))).toBe(true);
    expect(isClean(frac(5, 2))).toBe(true);
    expect(isClean(frac(20, 7))).toBe(false);
  });
  it('convertit les décimaux', () => {
    expect(frac(2.2)).toEqual(frac(11, 5));
  });
});

describe('saisie de l’élève', () => {
  it('accepte 2, 2.0, 2,0 et les fractions', () => {
    expect(parseUserNumber('2')).toBe(2);
    expect(parseUserNumber('2.0')).toBe(2);
    expect(parseUserNumber('2,0')).toBe(2);
    expect(parseUserNumber(' 3,6 ')).toBe(3.6);
    expect(parseUserNumber('18/5')).toBe(3.6);
    expect(parseUserNumber('abc')).toBeNull();
    expect(parseUserNumber('')).toBeNull();
  });
  it('tolère 1 % d’écart relatif', () => {
    expect(isClose(2.857, 20 / 7)).toBe(true);
    expect(isClose(3.6, 3.6)).toBe(true);
    expect(isClose(3.7, 3.6)).toBe(false);
  });
  it('formate à la française', () => {
    expect(formatNumber(3.6)).toBe('3,6');
    expect(formatNumber(2)).toBe('2');
  });
});

describe('exemples de référence (section 6)', () => {
  it('F1 : 10 + 22 + 47 + 21 = 100 Ω', () => {
    expect(reqOf(S(R('R1', 10), R('R2', 22), R('R3', 47), R('R4', 21)))).toEqual(frac(100));
  });
  it('F2 : 12 // 6 // 4 = 2 Ω', () => {
    expect(reqOf(P(R('R1', 12), R('R2', 6), R('R3', 4)))).toEqual(frac(2));
  });
  it('F3 : 4 × 20 Ω en parallèle = 5 Ω', () => {
    expect(reqOf(P(R('R1', 20), R('R2', 20), R('R3', 20), R('R4', 20)))).toEqual(frac(5));
  });
  it('M1 : (4 + 8) // 6 + 5 = 9 Ω', () => {
    expect(reqOf(S(P(S(R('R1', 4), R('R2', 8)), R('R3', 6)), R('R4', 5)))).toEqual(frac(9));
  });
  it('M2 : ((6//3) + (12//4)) // 20 = 4 Ω', () => {
    expect(reqOf(P(S(P(R('R1', 6), R('R2', 3)), P(R('R3', 12), R('R4', 4))), R('R5', 20)))).toEqual(frac(4));
  });
  it('D1 : 6 // 3 avec 100 Ω court-circuitée = 2 Ω', () => {
    expect(reqOf(S(P(R('R1', 6), R('R2', 3)), P(R('R3', 100), W())))).toEqual(frac(2));
  });
  it('D2 : 2 + (4 // (2 + (4 // 4))) = 4 Ω', () => {
    expect(reqOf(S(R('R1', 2), P(R('R2', 4), S(R('R3', 2), P(R('R4', 4), R('R5', 4))))))).toEqual(frac(4));
  });
  it('D3 : pont équilibré (2 + 4) // (3 + 6) = 3,6 Ω, la 10 Ω centrale est retirée', () => {
    const net = makeBridge([2, 4, 3, 6, 10]);
    expect(isBridgeBalanced(net)).toBe(true);
    expect(reqOf(bridgeToTree(net))).toEqual(frac(18, 5));
    // L'analyse nodale complète (avec la résistance centrale) donne le même résultat.
    expect(reqNetlist(bridgeNetlist(net), 'A', 'B')).toEqual(frac(18, 5));
  });
  it('D4 : (R // 12) + 4 = 7 → R = 4 Ω', () => {
    expect(reqOf(S(P(R('R', 4), R('R1', 12)), R('R2', 4)))).toEqual(frac(7));
  });
});

describe('netlist', () => {
  it('donne le même Req que l’arbre', () => {
    const t = S(P(S(R('R1', 4), R('R2', 8)), R('R3', 6)), R('R4', 5));
    expect(reqNetlist(treeToNetlist(t), 'A', 'B')).toEqual(reqOf(t));
  });
  it('gère les fils (court-circuit)', () => {
    const t = S(P(R('R1', 6), R('R2', 3)), P(R('R3', 100), W()));
    expect(reqNetlist(treeToNetlist(t), 'A', 'B')).toEqual(frac(2));
  });
  it('pont non équilibré : la résistance centrale compte', () => {
    const net = makeBridge([1, 2, 3, 4, 5]);
    expect(isBridgeBalanced(net)).toBe(false);
    expect(eq(reqNetlist(bridgeNetlist(net), 'A', 'B'), reqOf(bridgeToTree(net)))).toBe(false);
  });
});

describe('réduction interactive', () => {
  const r1 = R('R1', 4);
  const r2 = R('R2', 8);
  const r3 = R('R3', 6);
  const r4 = R('R4', 5);
  const m1 = S(P(S(r1, r2), r3), r4);

  it('valide un groupe série de résistances consécutives', () => {
    expect(validateGroup(m1, [r1.id, r2.id], 'S').ok).toBe(true);
  });
  it('refuse un mauvais type', () => {
    expect(validateGroup(m1, [r1.id, r2.id], 'P')).toEqual({ ok: false, reason: 'wrong-type' });
  });
  it('refuse des résistances qui ne sont pas sœurs', () => {
    expect(validateGroup(m1, [r3.id, r4.id], 'S')).toEqual({ ok: false, reason: 'not-siblings' });
  });
  it('refuse une série non consécutive', () => {
    const a = R('R1', 1);
    const b = R('R2', 2);
    const c = R('R3', 3);
    const t = S(a, P(b, R('R5', 3)), c);
    expect(validateGroup(t, [a.id, c.id], 'S')).toEqual({ ok: false, reason: 'not-consecutive' });
  });
  it('réduit M1 étape par étape jusqu’à Req', () => {
    let t = mergeGroup(m1, [r1.id, r2.id], 'S');
    expect(t.merged.label).toBe('R12');
    expect(t.merged.value).toEqual(frac(12));
    t = mergeGroup(t.tree, [t.merged.id, r3.id], 'P');
    expect(t.merged.label).toBe('R123');
    expect(t.merged.value).toEqual(frac(4));
    t = mergeGroup(t.tree, [t.merged.id, r4.id], 'S');
    expect(t.tree.kind).toBe('R');
    expect(t.merged.value).toEqual(frac(9));
  });
  it('autorise un sous-ensemble d’un parallèle', () => {
    const a = R('R1', 12);
    const b = R('R2', 6);
    const c = R('R3', 4);
    const t = P(a, b, c);
    expect(validateGroup(t, [a.id, c.id], 'P').ok).toBe(true);
    expect(groupValue(t, [a.id, c.id], 'P')).toEqual(frac(3));
    const m = mergeGroup(t, [a.id, c.id], 'P');
    expect(m.tree.kind).toBe('P');
    expect(reqOf(m.tree)).toEqual(frac(2));
  });
  it('retire une résistance court-circuitée', () => {
    const s = R('R3', 100);
    const t = S(P(R('R1', 6), R('R2', 3)), P(s, W()));
    expect(isShorted(t, s.id)).toBe(true);
    const out = removeShorted(t, s.id);
    expect(out.kind).toBe('P');
    expect(reqOf(out)).toEqual(frac(2));
  });
  it('nomme les résistances équivalentes', () => {
    expect(mergedLabel(['R3', 'R12'])).toBe('R123');
  });
});
