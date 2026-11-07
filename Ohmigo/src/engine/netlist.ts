import { type Frac, ZERO, ONE, add, div, eq, isZero, mul, sub, inv } from './fraction';
import { type Node, type RNode, P, S, nextId } from './tree';
import type { BridgeNet } from './types';

/**
 * Netlist (nœuds + résistances + fils) pour les circuits qui ne sont pas des arbres
 * série-parallèle (pont de Wheatstone, Req entre deux autres points…).
 */
export interface NetResistor {
  id: string;
  label: string;
  value: Frac;
  a: string;
  b: string;
}

export interface Netlist {
  resistors: NetResistor[];
  wires: [string, string][];
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let p = this.parent.get(x)!;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Résistance équivalente entre a et b par analyse nodale exacte :
 * on injecte 1 A en a, b est à la masse, Req = V(a).
 */
export function reqNetlist(net: Netlist, a: string, b: string): Frac {
  const uf = new UnionFind();
  for (const [x, y] of net.wires) uf.union(x, y);
  for (const r of net.resistors) if (isZero(r.value)) uf.union(r.a, r.b);
  const A = uf.find(a);
  const B = uf.find(b);
  if (A === B) return ZERO;
  const edges = net.resistors
    .filter((r) => !isZero(r.value))
    .map((r) => ({ a: uf.find(r.a), b: uf.find(r.b), g: inv(r.value) }))
    .filter((e) => e.a !== e.b);

  // Composante connexe contenant A.
  const seen = new Set<string>([A]);
  const stack = [A];
  while (stack.length) {
    const x = stack.pop()!;
    for (const e of edges) {
      const y = e.a === x ? e.b : e.b === x ? e.a : null;
      if (y && !seen.has(y)) {
        seen.add(y);
        stack.push(y);
      }
    }
  }
  if (!seen.has(B)) throw new Error('A et B ne sont pas reliés');
  const unknowns = [...seen].filter((x) => x !== B);
  const index = new Map(unknowns.map((x, i) => [x, i]));
  const n = unknowns.length;
  const M: Frac[][] = Array.from({ length: n }, () => Array.from({ length: n + 1 }, () => ZERO));
  for (const e of edges) {
    if (!seen.has(e.a)) continue;
    const ia = index.get(e.a);
    const ib = index.get(e.b);
    if (ia !== undefined) M[ia][ia] = add(M[ia][ia], e.g);
    if (ib !== undefined) M[ib][ib] = add(M[ib][ib], e.g);
    if (ia !== undefined && ib !== undefined) {
      M[ia][ib] = sub(M[ia][ib], e.g);
      M[ib][ia] = sub(M[ib][ia], e.g);
    }
  }
  M[index.get(A)!][n] = ONE;

  // Élimination de Gauss-Jordan en fractions exactes.
  for (let col = 0; col < n; col++) {
    const pivot = M.findIndex((row, r) => r >= col && !isZero(row[col]));
    if (pivot < 0) throw new Error('Système singulier');
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    M[col] = M[col].map((v) => div(v, pv));
    for (let r = 0; r < n; r++) {
      if (r === col || isZero(M[r][col])) continue;
      const f = M[r][col];
      M[r] = M[r].map((v, c) => sub(v, mul(f, M[col][c])));
    }
  }
  return M[index.get(A)!][n];
}

/** Conversion arbre → netlist (sert aux tests de cohérence). */
export function treeToNetlist(tree: Node, a = 'A', b = 'B'): Netlist {
  const net: Netlist = { resistors: [], wires: [] };
  const rec = (n: Node, x: string, y: string): void => {
    switch (n.kind) {
      case 'R':
        if (n.value === 'unknown') throw new Error('Valeur inconnue');
        net.resistors.push({ id: n.id, label: n.label, value: n.value, a: x, b: y });
        return;
      case 'W':
        net.wires.push([x, y]);
        return;
      case 'P':
        n.children.forEach((c) => rec(c, x, y));
        return;
      case 'S': {
        let cur = x;
        n.children.forEach((c, i) => {
          const next = i === n.children.length - 1 ? y : nextId('n');
          rec(c, cur, next);
          cur = next;
        });
      }
    }
  };
  rec(tree, a, b);
  return net;
}

function value(r: RNode): Frac {
  if (r.value === 'unknown') throw new Error('Valeur inconnue');
  return r.value;
}

export function bridgeNetlist(net: BridgeNet): Netlist {
  const mk = (r: RNode, a: string, b: string): NetResistor => ({ id: r.id, label: r.label, value: value(r), a, b });
  return {
    resistors: [
      mk(net.r1, 'A', 'C'),
      mk(net.r2, 'C', 'B'),
      mk(net.r3, 'A', 'D'),
      mk(net.r4, 'D', 'B'),
      mk(net.r5, 'C', 'D'),
    ],
    wires: [],
  };
}

/** Pont équilibré : R1/R2 = R3/R4 ⇔ R1·R4 = R2·R3 ⇒ même potentiel en C et D. */
export function isBridgeBalanced(net: BridgeNet): boolean {
  return eq(mul(value(net.r1), value(net.r4)), mul(value(net.r2), value(net.r3)));
}

/** Après retrait de la résistance centrale : (R1 + R2) // (R3 + R4). */
export function bridgeToTree(net: BridgeNet): Node {
  return P(S(net.r1, net.r2), S(net.r3, net.r4));
}

export function bridgeResistors(net: BridgeNet): RNode[] {
  return [net.r1, net.r2, net.r3, net.r4, net.r5];
}
