import {
  type Frac,
  ZERO,
  frac,
  fromDecimal,
  isClean,
  parallel,
  sum,
} from './fraction';
import type { GroupType } from './types';

/**
 * Arbre série-parallèle (section 5.1).
 * Extensions par rapport au cahier des charges :
 *  - chaque nœud porte un id (clé de rendu / sélection) ;
 *  - une résistance porte une étiquette (« R3 ») et une valeur en fraction exacte (en Ω) ;
 *  - une feuille « W » représente un fil (résistance nulle), utilisée pour les courts-circuits.
 */
export type RNode = { kind: 'R'; id: string; label: string; value: Frac | 'unknown' };
export type WNode = { kind: 'W'; id: string };
export type SNode = { kind: 'S'; id: string; children: Node[] };
export type PNode = { kind: 'P'; id: string; children: Node[] };
export type Node = RNode | WNode | SNode | PNode;
export type Leaf = RNode | WNode;
export type Branch = SNode | PNode;

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export function R(label: string, value: number | Frac | 'unknown', id?: string): RNode {
  const v = value === 'unknown' ? 'unknown' : typeof value === 'number' ? fromDecimal(value) : value;
  return { kind: 'R', id: id ?? nextId('r'), label, value: v };
}
export const W = (id?: string): WNode => ({ kind: 'W', id: id ?? nextId('w') });
export const S = (...children: Node[]): SNode => ({ kind: 'S', id: nextId('s'), children });
export const P = (...children: Node[]): PNode => ({ kind: 'P', id: nextId('p'), children });

export const isLeaf = (n: Node): n is Leaf => n.kind === 'R' || n.kind === 'W';

/** Résistance équivalente exacte. */
export function reqOf(node: Node): Frac {
  switch (node.kind) {
    case 'R':
      if (node.value === 'unknown') throw new Error(`Valeur inconnue : ${node.label}`);
      return node.value;
    case 'W':
      return ZERO;
    case 'S':
      return sum(node.children.map(reqOf));
    case 'P':
      return parallel(node.children.map(reqOf));
  }
}

export function resistors(node: Node): RNode[] {
  if (node.kind === 'R') return [node];
  if (node.kind === 'W') return [];
  return node.children.flatMap(resistors);
}

export function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  if (isLeaf(root)) return null;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

export function findParent(root: Node, id: string): { parent: Branch; index: number } | null {
  if (isLeaf(root)) return null;
  const index = root.children.findIndex((c) => c.id === id);
  if (index >= 0) return { parent: root, index };
  for (const c of root.children) {
    const f = findParent(c, id);
    if (f) return f;
  }
  return null;
}

export function depthOf(root: Node, id: string, depth = 0): number {
  if (root.id === id) return depth;
  if (isLeaf(root)) return -1;
  for (const c of root.children) {
    const d = depthOf(c, id, depth + 1);
    if (d >= 0) return d;
  }
  return -1;
}

/**
 * Normalisation : fusionne S dans S et P dans P, supprime les fils en série,
 * remplace un groupe à un seul enfant par cet enfant.
 */
export function normalize(node: Node): Node {
  if (isLeaf(node)) return node;
  let children = node.children.map(normalize).flatMap((c) => (c.kind === node.kind ? (c as Branch).children : [c]));
  if (node.kind === 'S') {
    const nonWire = children.filter((c) => c.kind !== 'W');
    if (nonWire.length === 0) return children[0];
    children = nonWire;
  }
  if (children.length === 1) return children[0];
  return { ...node, children };
}

/** Remplace le nœud d'id donné (ou le supprime si replacement === null), puis normalise. */
export function replaceNode(root: Node, id: string, replacement: Node | null): Node {
  const rec = (n: Node): Node | null => {
    if (n.id === id) return replacement;
    if (isLeaf(n)) return n;
    const children = n.children.map(rec).filter((c): c is Node => c !== null);
    if (children.length === n.children.length && children.every((c, i) => c === n.children[i])) return n;
    return { ...n, children };
  };
  const out = rec(root);
  if (!out) throw new Error('Arbre vide');
  return normalize(out);
}

export type GroupCheck =
  | { ok: true; parent: Branch }
  | { ok: false; reason: 'too-few' | 'unknown-id' | 'not-siblings' | 'wrong-type' | 'not-consecutive' };

/**
 * Validation topologique (section 5.4) :
 *  - série : enfants consécutifs d'un même nœud S ;
 *  - parallèle : enfants (sous-ensemble) d'un même nœud P.
 */
export function validateGroup(root: Node, ids: string[], type: GroupType): GroupCheck {
  if (ids.length < 2) return { ok: false, reason: 'too-few' };
  const infos = ids.map((id) => findParent(root, id));
  if (infos.some((i) => i === null)) return { ok: false, reason: 'unknown-id' };
  const parent = infos[0]!.parent;
  if (infos.some((i) => i!.parent !== parent)) return { ok: false, reason: 'not-siblings' };
  if (parent.kind !== type) return { ok: false, reason: 'wrong-type' };
  if (type === 'S') {
    const idx = infos.map((i) => i!.index).sort((a, b) => a - b);
    for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1] + 1) return { ok: false, reason: 'not-consecutive' };
  }
  return { ok: true, parent };
}

/** Une résistance est court-circuitée si un fil est en parallèle avec elle. */
export function isShorted(root: Node, id: string): boolean {
  const info = findParent(root, id);
  return !!info && info.parent.kind === 'P' && info.parent.children.some((c) => c.kind === 'W');
}

export function leafValue(root: Node, id: string): Frac {
  const n = findNode(root, id);
  if (!n) throw new Error(`Résistance introuvable : ${id}`);
  return reqOf(n);
}

/** Valeur exacte du groupe sélectionné, associé selon le type choisi. */
export function groupValue(root: Node, ids: string[], type: GroupType): Frac {
  const values = ids.map((id) => leafValue(root, id));
  return type === 'S' ? sum(values) : parallel(values);
}

/** Nom d'une résistance équivalente : R1 + R2 → R12. */
export function mergedLabel(labels: string[]): string {
  const parts = labels.map((l) => l.replace(/^R/, ''));
  if (parts.every((p) => /^\d+$/.test(p))) {
    const digits = parts.join('').split('').sort((a, b) => Number(a) - Number(b));
    return `R${digits.join('')}`;
  }
  return 'Réq';
}

/** Remplace le groupe par une seule résistance équivalente (à la place du premier élément). */
export function mergeGroup(root: Node, ids: string[], type: GroupType): { tree: Node; merged: RNode } {
  const check = validateGroup(root, ids, type);
  if (!check.ok) throw new Error(`Groupe invalide : ${check.reason}`);
  const labels = ids.map((id) => (findNode(root, id) as RNode).label);
  const merged: RNode = { kind: 'R', id: nextId('m'), label: mergedLabel(labels), value: groupValue(root, ids, type) };
  const parent = check.parent;
  const set = new Set(ids);
  const firstIdx = parent.children.findIndex((c) => set.has(c.id));
  const children: Node[] = [];
  parent.children.forEach((c, i) => {
    if (i === firstIdx) children.push(merged);
    else if (!set.has(c.id)) children.push(c);
  });
  return { tree: replaceNode(root, parent.id, { ...parent, children }), merged };
}

/** Action spéciale : retire une résistance court-circuitée. */
export function removeShorted(root: Node, id: string): Node {
  if (!isShorted(root, id)) throw new Error('Résistance non court-circuitée');
  return replaceNode(root, id, null);
}

/** Retire tous les fils (utilisé pour calculer le distracteur « court-circuit non vu »). */
export function removeWires(node: Node): Node | null {
  if (node.kind === 'W') return null;
  if (node.kind === 'R') return node;
  const children = node.children.map(removeWires).filter((c): c is Node => c !== null);
  if (children.length === 0) return null;
  return normalize({ ...node, children });
}

/** Signature structurelle (ids) : sert à savoir si le circuit a été modifié. */
export function signature(node: Node): string {
  if (isLeaf(node)) return node.id;
  return `${node.kind}(${node.children.map(signature).join(',')})`;
}

/** Vrai si la résistance équivalente de chaque sous-bloc est « propre ». */
export function allSubtreesClean(node: Node): boolean {
  if (isLeaf(node)) return true;
  return isClean(reqOf(node)) && node.children.every(allSubtreesClean);
}

/** Copie profonde avec de nouveaux ids pour les nœuds S/P (les feuilles gardent leur id). */
export function mapResistors(node: Node, f: (r: RNode) => RNode): Node {
  if (node.kind === 'R') return f(node);
  if (node.kind === 'W') return node;
  return { ...node, children: node.children.map((c) => mapResistors(c, f)) };
}

/** Renomme R1, R2, … dans l'ordre de lecture (parcours en profondeur). L'inconnue garde son nom. */
export function relabel(node: Node): Node {
  let k = 0;
  return mapResistors(node, (r) => (r.value === 'unknown' ? r : { ...r, label: `R${++k}` }));
}

export function scaleValues(node: Node, factor: number): Node {
  return mapResistors(node, (r) =>
    r.value === 'unknown' ? r : { ...r, value: frac(r.value.n * factor, r.value.d) },
  );
}
