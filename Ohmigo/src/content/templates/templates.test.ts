import { describe, expect, it } from 'vitest';
import { answerTree, diagnoseFinal, diagnoseGroup, diagnoseGroupValue, diagnoseInverseStep, computeDistractors } from '../../engine/diagnostic';
import { frac, isClean, toNumber } from '../../engine/fraction';
import { isCleanIn } from '../../engine/generate';
import { renderCircuit } from '../../engine/layout';
import { isBridgeBalanced } from '../../engine/netlist';
import { P, R, S, reqOf, resistors } from '../../engine/tree';
import { TEMPLATES, createComprehension, createInstance } from './index';

const N = 1000;

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('gabarit %s', (id, template) => {
  it(`produit ${N} instances valides avec un Req propre`, () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= N; seed++) {
      const inst = createInstance(id, seed * 7919);
      expect(inst.templateId).toBe(id);
      expect(inst.level).toBe(template.level);
      // Résultat propre dans l'unité de l'exercice.
      expect(isCleanIn(inst.answer, inst.unit)).toBe(true);
      // Le Req calculé correspond bien au circuit.
      if (inst.kind === 'reduce') {
        expect(reqOf(answerTree(inst.circuit))).toEqual(inst.answer);
      } else {
        const meta = inst.inverse!;
        expect(toNumber(inst.answer)).toBeGreaterThan(0);
        expect(Number.isInteger(toNumber(inst.answer))).toBe(true);
        expect(isClean(meta.givenReq)).toBe(true);
      }
      if (inst.circuit.type === 'bridge') expect(isBridgeBalanced(inst.circuit.net)).toBe(true);
      // Aucun distracteur n'est égal à la bonne réponse.
      inst.distractors.forEach((d) => expect(Math.abs(toNumber(d.value) - toNumber(inst.answer))).toBeGreaterThan(1e-9));
      // Valeurs strictement positives.
      Object.values(inst.values).forEach((x) => expect(x).toBeGreaterThan(0));
      // L'énoncé ne trahit jamais le type de montage.
      expect(inst.prompt).not.toMatch(/série|parallèle/i);
      // Le schéma se dessine.
      if (seed <= 50) {
        const sch = renderCircuit(inst.circuit, inst);
        expect(sch.resistors.length).toBe(Object.keys(inst.values).length + (inst.inverse ? 1 : 0));
        expect(sch.w).toBeGreaterThan(0);
      }
      seen.add(JSON.stringify(inst.values));
    }
    // Valeurs aléatoires : beaucoup d'instances différentes.
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('distracteurs et diagnostic (section 7.1)', () => {
  const r1 = R('R1', 4);
  const r2 = R('R2', 8);
  const r3 = R('R3', 6);
  const r4 = R('R4', 5);
  const tree = S(P(S(r1, r2), r3), r4);
  const circuit = { type: 'tree' as const, tree };
  const answer = frac(9);
  const distractors = computeDistractors({ circuit, answer });
  const inst = createInstance('M1', 1);
  const m1 = { ...inst, circuit, answer, distractors };

  it('M1 : 23 Ω → E2 (tout additionné)', () => {
    expect(diagnoseFinal(m1, 23, 60)).toMatchObject({ ok: false, code: 'E2' });
  });
  it('M1 : 5,25 Ω → E3 (oubli d’inverser)', () => {
    expect(diagnoseFinal(m1, 5.25, 60)).toMatchObject({ ok: false, code: 'E3' });
  });
  it('M1 : 12,43 Ω → E5 (mauvais regroupement)', () => {
    expect(diagnoseFinal(m1, 12.43, 60)).toMatchObject({ ok: false, code: 'E5' });
  });
  it('M1 : réponse inconnue rapide → E0, sinon résolution par étapes', () => {
    expect(diagnoseFinal(m1, 17, 3)).toMatchObject({ ok: false, code: 'E0' });
    expect(diagnoseFinal(m1, 17, 60)).toMatchObject({ ok: false, code: null });
  });
  it('M1 : bonne réponse acceptée (9, 9.0, 9,0)', () => {
    expect(diagnoseFinal(m1, 9, 60)).toEqual({ ok: true });
  });
  it('E10 : erreur d’unité', () => {
    expect(diagnoseFinal(m1, 9000, 60)).toMatchObject({ ok: false, code: 'E10' });
  });

  it('étapes : E1 mauvais type, E5 mauvais regroupement', () => {
    expect(diagnoseGroup(circuit, [r1.id, r2.id], 'P')).toMatchObject({ code: 'E1' });
    expect(diagnoseGroup(circuit, [r3.id, r4.id], 'S')).toMatchObject({ code: 'E5' });
    expect(diagnoseGroup(circuit, [r1.id, r2.id], 'S')).toEqual({ ok: true });
  });
  it('étapes : valeur d’un groupe parallèle → E2, E3, E4, E9', () => {
    const a = R('R1', 12);
    const b = R('R2', 6);
    const c = R('R3', 4);
    const st = { type: 'tree' as const, tree: P(a, b, c) };
    const ids = [a.id, b.id, c.id];
    expect(diagnoseGroupValue(st, ids, 'P', 2)).toEqual({ ok: true });
    expect(diagnoseGroupValue(st, ids, 'P', 22)).toMatchObject({ code: 'E2' });
    expect(diagnoseGroupValue(st, ids, 'P', 0.5)).toMatchObject({ code: 'E3' });
    expect(diagnoseGroupValue(st, ids, 'P', 288 / 22)).toMatchObject({ code: 'E4' });
    expect(diagnoseGroupValue(st, ids, 'P', 2.4)).toMatchObject({ code: 'E9' });
  });
  it('court-circuit inclus → E6', () => {
    const s = createInstance('D1', 42);
    if (s.circuit.type !== 'tree') throw new Error();
    const all = resistors(s.circuit.tree).map((x) => x.id);
    expect(diagnoseGroup(s.circuit, all, 'S')).toMatchObject({ code: 'E6' });
    expect(s.distractors.some((d) => d.code === 'E6')).toBe(true);
  });
  it('pont : résistance centrale incluse → E7', () => {
    const s = createInstance('D3', 42);
    if (s.circuit.type !== 'bridge') throw new Error();
    expect(diagnoseGroup(s.circuit, [s.circuit.net.r5.id, s.circuit.net.r1.id], 'S')).toMatchObject({ code: 'E7' });
  });
  it('échelle prise côté A → E8', () => {
    const s = createInstance('D2', 42);
    if (s.circuit.type !== 'tree') throw new Error();
    const [a, b] = resistors(s.circuit.tree);
    expect(diagnoseGroup(s.circuit, [a.id, b.id], 'S', { ladder: true })).toMatchObject({ code: 'E8' });
  });
  it('problème inverse : équation mal posée → E11', () => {
    const s = createInstance('D4', 42);
    const meta = s.inverse!;
    expect(diagnoseInverseStep(s, 1, toNumber(meta.parallelValue))).toEqual({ ok: true });
    expect(diagnoseInverseStep(s, 1, toNumber(meta.givenReq))).toMatchObject({ code: 'E11' });
    expect(diagnoseInverseStep(s, 2, toNumber(s.answer))).toEqual({ ok: true });
    expect(diagnoseInverseStep(s, 2, toNumber(meta.parallelValue))).toMatchObject({ code: 'E11' });
  });
});

describe('question de compréhension', () => {
  it('produit un schéma simple série ou parallèle', () => {
    for (let seed = 1; seed < 200; seed++) {
      const q = createComprehension(seed);
      const t = q.instance.circuit.type === 'tree' ? q.instance.circuit.tree : null;
      expect(t?.kind).toBe(q.answer);
    }
  });
});

describe('rendu SVG', () => {
  it('dessine les variantes de présentation sans erreur', () => {
    const t = P(S(R('R1', 1), R('R2', 2)), R('R3', 3), R('R4', 4));
    for (const style of ['classic', 'rails'] as const) {
      for (const rotate of [false, true]) {
        for (const mirror of [false, true]) {
          const sch = renderCircuit({ type: 'tree', tree: t }, { layout: { style, rotate, mirror }, unit: 'Ω', terminals: ['A', 'B'] });
          expect(sch.resistors).toHaveLength(4);
          expect(sch.terminals).toHaveLength(2);
          expect(sch.dots.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
