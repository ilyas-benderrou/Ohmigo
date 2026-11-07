import { type Frac } from './fraction';
import { bridgeResistors, bridgeToTree, isBridgeBalanced } from './netlist';
import { type RNode, findNode, isShorted, mergeGroup, removeShorted, reqOf, resistors } from './tree';
import type { CircuitState, GroupType } from './types';

/** Opérations de la réduction interactive (section 5.4) sur l'état du circuit. */

export function stateResistors(state: CircuitState): RNode[] {
  return state.type === 'tree' ? resistors(state.tree) : bridgeResistors(state.net);
}

export function labelsOf(state: CircuitState, ids: string[]): string[] {
  const all = stateResistors(state);
  return ids.map((id) => all.find((r) => r.id === id)?.label ?? id);
}

/** Il ne reste qu'une résistance : c'est Req. */
export function isReduced(state: CircuitState): boolean {
  return state.type === 'tree' && state.tree.kind === 'R';
}

export function finalValue(state: CircuitState): Frac | null {
  return isReduced(state) && state.type === 'tree' ? reqOf(state.tree) : null;
}

export function applyMerge(state: CircuitState, ids: string[], type: GroupType): { state: CircuitState; merged: RNode } {
  if (state.type !== 'tree') throw new Error('Regroupement impossible sur un pont');
  const { tree, merged } = mergeGroup(state.tree, ids, type);
  return { state: { type: 'tree', tree }, merged };
}

/** Action spéciale « Supprimer la résistance court-circuitée » : valide seulement si un fil la court-circuite. */
export function applyRemoveShorted(state: CircuitState, id: string): CircuitState | null {
  if (state.type !== 'tree' || !isShorted(state.tree, id)) return null;
  return { type: 'tree', tree: removeShorted(state.tree, id) };
}

/** Action spéciale « Pont équilibré : retirer la résistance centrale » : valide seulement si R1/R2 = R3/R4. */
export function applyRemoveBridge(state: CircuitState, id: string): CircuitState | null {
  if (state.type !== 'bridge' || state.net.r5.id !== id || !isBridgeBalanced(state.net)) return null;
  return { type: 'tree', tree: bridgeToTree(state.net) };
}

export function resistorById(state: CircuitState, id: string): RNode | null {
  if (state.type === 'tree') return (findNode(state.tree, id) as RNode | null) ?? null;
  return bridgeResistors(state.net).find((r) => r.id === id) ?? null;
}
