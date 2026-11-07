import { describe, expect, it } from 'vitest';
import { createInstance } from '../content/templates';
import { makeBridge } from '../content/templates/difficile';
import { answerTree } from './diagnostic';
import { frac } from './fraction';
import { renderCircuit } from './layout';
import { applyMerge, applyRemoveBridge, applyRemoveShorted, finalValue, isReduced, stateResistors } from './reduction';
import { reqOf, resistors } from './tree';
import type { CircuitState } from './types';

describe('actions spéciales', () => {
  it('pont équilibré : retirer la résistance centrale', () => {
    const net = makeBridge([2, 4, 3, 6, 10]);
    const state: CircuitState = { type: 'bridge', net };
    expect(applyRemoveBridge(state, net.r1.id)).toBeNull();
    const out = applyRemoveBridge(state, net.r5.id)!;
    expect(out.type).toBe('tree');
    expect(stateResistors(out)).toHaveLength(4);
    if (out.type === 'tree') expect(reqOf(out.tree)).toEqual(frac(18, 5));
  });

  it('pont non équilibré : action refusée', () => {
    const net = makeBridge([1, 2, 3, 4, 5]);
    expect(applyRemoveBridge({ type: 'bridge', net }, net.r5.id)).toBeNull();
  });

  it('court-circuit : seule la résistance court-circuitée peut être retirée', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const inst = createInstance('D1', seed);
      if (inst.circuit.type !== 'tree') throw new Error();
      const rs = resistors(inst.circuit.tree);
      const removable = rs.filter((r) => applyRemoveShorted(inst.circuit, r.id) !== null);
      expect(removable).toHaveLength(1);
      const after = applyRemoveShorted(inst.circuit, removable[0].id)!;
      expect(reqOf(answerTree(after))).toEqual(inst.answer);
      expect(stateResistors(after)).toHaveLength(rs.length - 1);
    }
  });

  it('chaque gabarit se réduit jusqu’à une seule résistance égale à Req', () => {
    for (const id of ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'D1', 'D2', 'D3', 'D5', 'D6']) {
      for (let seed = 1; seed <= 30; seed++) {
        const inst = createInstance(id, seed);
        let state: CircuitState = inst.circuit;
        // Stratégie automatique : action spéciale si possible, sinon le premier groupe valide le plus profond.
        for (let guard = 0; guard < 20 && !isReduced(state); guard++) {
          if (state.type === 'bridge') {
            state = applyRemoveBridge(state, state.net.r5.id)!;
            continue;
          }
          const shorted = resistors(state.tree).find((r) => applyRemoveShorted(state, r.id));
          if (shorted) {
            state = applyRemoveShorted(state, shorted.id)!;
            continue;
          }
          const group = findLeafGroup(state.tree);
          state = applyMerge(state, group.ids, group.type).state;
          // Le schéma reste dessinable à chaque étape.
          renderCircuit(state, inst);
        }
        expect(isReduced(state)).toBe(true);
        expect(finalValue(state)).toEqual(inst.answer);
      }
    }
  });
});

type T = Extract<CircuitState, { type: 'tree' }>['tree'];
function findLeafGroup(t: T): { ids: string[]; type: 'S' | 'P' } {
  if (t.kind === 'R' || t.kind === 'W') throw new Error('Feuille');
  const leaves = t.children.filter((c) => c.kind === 'R');
  if (leaves.length >= 2) {
    if (t.kind === 'P') return { ids: leaves.map((l) => l.id), type: 'P' };
    for (let i = 0; i < t.children.length - 1; i++) {
      if (t.children[i].kind === 'R' && t.children[i + 1].kind === 'R') return { ids: [t.children[i].id, t.children[i + 1].id], type: 'S' };
    }
  }
  for (const c of t.children) if (c.kind === 'S' || c.kind === 'P') return findLeafGroup(c);
  throw new Error('Aucun groupe');
}
