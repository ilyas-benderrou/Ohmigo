import { formatOhms, type Unit } from './numbers';
import { type Node, type PNode, type RNode, type SNode, findNode, isLeaf, signature } from './tree';
import type { BridgeNet, CircuitState, LayoutSpec } from './types';

/**
 * Schéma électrique calculé (coordonnées en px), dessiné ensuite par <CircuitView>.
 * Une résistance occupe RL px (corps + pattes), horizontale ou verticale.
 */
export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface SchResistor {
  id: string;
  cx: number;
  cy: number;
  orient: 'h' | 'v';
  label: string;
  value: string;
  nodes: [string, string];
}
export interface SchWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  node: string;
}
export interface SchTerminal {
  x: number;
  y: number;
  label: string;
  node: string;
  side: Side;
}
export interface SchNodeLabel {
  x: number;
  y: number;
  text: string;
  node: string;
  side: Side;
}
export interface SchDot {
  x: number;
  y: number;
  node: string;
}
export interface Schematic {
  w: number;
  h: number;
  resistors: SchResistor[];
  wires: SchWire[];
  terminals: SchTerminal[];
  nodeLabels: SchNodeLabel[];
  dots: SchDot[];
  /** Ordre d'apparition des nœuds électriques (pour la coloration). */
  nodes: string[];
}

export const RL = 80;
const HALF = RL / 2;
const STUB = 30;
const PAD = 18;

interface Raw {
  resistors: SchResistor[];
  wires: SchWire[];
  terminals: SchTerminal[];
  nodeLabels: SchNodeLabel[];
  unions: [string, string][];
}

interface Ctx {
  newNode(): string;
  fmt(r: RNode): string;
}

const emptyRaw = (): Raw => ({ resistors: [], wires: [], terminals: [], nodeLabels: [], unions: [] });

function wire(raw: Raw, x1: number, y1: number, x2: number, y2: number, node: string): void {
  if (x1 === x2 && y1 === y2) return;
  raw.wires.push({ x1, y1, x2, y2, node });
}

function resistor(raw: Raw, ctx: Ctx, r: RNode, cx: number, cy: number, orient: 'h' | 'v', nodes: [string, string]): void {
  raw.resistors.push({ id: r.id, cx, cy, orient, label: r.label, value: ctx.fmt(r), nodes });
}

// ---------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------

const ROTATE_SIDE: Record<Side, Side> = { left: 'top', top: 'left', right: 'bottom', bottom: 'right' };
const MIRROR_SIDE: Record<Side, Side> = { left: 'right', right: 'left', top: 'top', bottom: 'bottom' };

/** Rotation (échange x ↔ y) : un schéma horizontal devient vertical. */
function rotateRaw(raw: Raw): void {
  raw.resistors.forEach((r) => {
    [r.cx, r.cy] = [r.cy, r.cx];
    r.orient = r.orient === 'h' ? 'v' : 'h';
  });
  raw.wires.forEach((w) => {
    [w.x1, w.y1, w.x2, w.y2] = [w.y1, w.x1, w.y2, w.x2];
  });
  [...raw.terminals, ...raw.nodeLabels].forEach((t) => {
    [t.x, t.y] = [t.y, t.x];
    t.side = ROTATE_SIDE[t.side];
  });
}

function mirrorRaw(raw: Raw, width: number): void {
  raw.resistors.forEach((r) => (r.cx = width - r.cx));
  raw.wires.forEach((w) => {
    w.x1 = width - w.x1;
    w.x2 = width - w.x2;
  });
  [...raw.terminals, ...raw.nodeLabels].forEach((t) => {
    t.x = width - t.x;
    t.side = MIRROR_SIDE[t.side];
  });
}

function translateRaw(raw: Raw, dx: number, dy: number): void {
  raw.resistors.forEach((r) => {
    r.cx += dx;
    r.cy += dy;
  });
  raw.wires.forEach((w) => {
    w.x1 += dx;
    w.x2 += dx;
    w.y1 += dy;
    w.y2 += dy;
  });
  [...raw.terminals, ...raw.nodeLabels].forEach((t) => {
    t.x += dx;
    t.y += dy;
  });
}

function mergeRaw(into: Raw, from: Raw): void {
  into.resistors.push(...from.resistors);
  into.wires.push(...from.wires);
  into.terminals.push(...from.terminals);
  into.nodeLabels.push(...from.nodeLabels);
  into.unions.push(...from.unions);
}

// ---------------------------------------------------------------------------
// Layout automatique récursif : série = chaîne horizontale, parallèle = branches empilées
// ---------------------------------------------------------------------------

interface Block {
  w: number;
  h: number;
  /** Ordonnée de la ligne de connexion (bornes gauche et droite du bloc). */
  my: number;
  place(x: number, y: number, nl: string, nr: string, out: Raw): void;
}

const SERIES_GAP = 14;
const PAR_PAD = 24;
const PAR_VGAP = 6;

function block(node: Node, ctx: Ctx): Block {
  switch (node.kind) {
    case 'R':
      return {
        w: RL,
        h: 64,
        my: 32,
        place: (x, y, nl, nr, out) => resistor(out, ctx, node, x + HALF, y + 32, 'h', [nl, nr]),
      };
    case 'W':
      return {
        w: RL,
        h: 26,
        my: 13,
        place: (x, y, nl, nr, out) => {
          wire(out, x, y + 13, x + RL, y + 13, nl);
          out.unions.push([nl, nr]);
        },
      };
    case 'S': {
      const bs = node.children.map((c) => block(c, ctx));
      const my = Math.max(...bs.map((b) => b.my));
      const below = Math.max(...bs.map((b) => b.h - b.my));
      const w = bs.reduce((s, b) => s + b.w, 0) + SERIES_GAP * (bs.length - 1);
      return {
        w,
        h: my + below,
        my,
        place: (x, y, nl, nr, out) => {
          const nodes = [nl, ...bs.slice(1).map(() => ctx.newNode()), nr];
          let cx = x;
          bs.forEach((b, i) => {
            b.place(cx, y + my - b.my, nodes[i], nodes[i + 1], out);
            cx += b.w;
            if (i < bs.length - 1) {
              wire(out, cx, y + my, cx + SERIES_GAP, y + my, nodes[i + 1]);
              cx += SERIES_GAP;
            }
          });
        },
      };
    }
    case 'P': {
      const bs = node.children.map((c) => block(c, ctx));
      const maxw = Math.max(...bs.map((b) => b.w));
      const tops: number[] = [];
      let t = 0;
      bs.forEach((b) => {
        tops.push(t);
        t += b.h + PAR_VGAP;
      });
      const h = t - PAR_VGAP;
      const lines = bs.map((b, i) => tops[i] + b.my);
      const my = Math.round((lines[0] + lines[lines.length - 1]) / 2);
      const w = maxw + 2 * PAR_PAD;
      return {
        w,
        h,
        my,
        place: (x, y, nl, nr, out) => {
          const xl = x + PAR_PAD;
          const xr = x + PAR_PAD + maxw;
          bs.forEach((b, i) => {
            const bx = xl + (maxw - b.w) / 2;
            b.place(bx, y + tops[i], nl, nr, out);
            wire(out, xl, y + lines[i], bx, y + lines[i], nl);
            wire(out, bx + b.w, y + lines[i], xr, y + lines[i], nr);
          });
          const ys = [...new Set([...lines, my])].sort((a, b) => a - b).map((v) => y + v);
          for (let k = 0; k < ys.length - 1; k++) {
            wire(out, xl, ys[k], xl, ys[k + 1], nl);
            wire(out, xr, ys[k], xr, ys[k + 1], nr);
          }
          wire(out, x, y + my, xl, y + my, nl);
          wire(out, xr, y + my, x + w, y + my, nr);
        },
      };
    }
  }
}

function classicLayout(tree: Node, ctx: Ctx, terms: [string, string]): Raw {
  const b = block(tree, ctx);
  const raw = emptyRaw();
  raw.terminals.push({ x: 0, y: b.my, label: terms[0], node: 'T0', side: 'left' });
  wire(raw, 0, b.my, STUB, b.my, 'T0');
  b.place(STUB, 0, 'T0', 'T1', raw);
  wire(raw, STUB + b.w, b.my, 2 * STUB + b.w, b.my, 'T1');
  raw.terminals.push({ x: 2 * STUB + b.w, y: b.my, label: terms[1], node: 'T1', side: 'right' });
  return raw;
}

/**
 * Parallèle « en échelle de rails » : branches verticales entre deux rails horizontaux,
 * bornes A et B du même côté (présentation inhabituelle, niveau F4).
 */
function railsLayout(tree: PNode, ctx: Ctx, terms: [string, string]): Raw {
  const LEAD = 24;
  const GAP = 56;
  const raw = emptyRaw();
  const cols = tree.children.map((c) => {
    const b = block(c, ctx);
    const sub = emptyRaw();
    b.place(0, 0, 'T0', 'T1', sub);
    rotateRaw(sub);
    return { sub, cw: b.h, ch: b.w, cx: b.my };
  });
  const maxh = Math.max(...cols.map((c) => c.ch));
  const bottom = maxh + 2 * LEAD;
  let x = 40;
  const xs: number[] = [];
  cols.forEach((col) => {
    const connX = x + col.cx;
    const top = LEAD + (maxh - col.ch) / 2;
    translateRaw(col.sub, x, top);
    mergeRaw(raw, col.sub);
    wire(raw, connX, 0, connX, top, 'T0');
    wire(raw, connX, top + col.ch, connX, bottom, 'T1');
    xs.push(connX);
    x += col.cw + GAP;
  });
  const pts = [0, ...xs];
  for (let i = 0; i < pts.length - 1; i++) {
    wire(raw, pts[i], 0, pts[i + 1], 0, 'T0');
    wire(raw, pts[i], bottom, pts[i + 1], bottom, 'T1');
  }
  raw.terminals.push({ x: 0, y: 0, label: terms[0], node: 'T0', side: 'left' });
  raw.terminals.push({ x: 0, y: bottom, label: terms[1], node: 'T1', side: 'left' });
  return raw;
}

/** Série « en serpentin » : aller sur une ligne, retour sur la ligne du dessous. */
function snakeLayout(tree: SNode, ctx: Ctx, terms: [string, string]): Raw {
  const n = tree.children.length;
  const k = Math.ceil(n / 2);
  const asNode = (list: Node[]): Node => (list.length === 1 ? list[0] : { kind: 'S', id: `${tree.id}-${list[0].id}`, children: list });
  const top = block(asNode(tree.children.slice(0, k)), ctx);
  const bot = block(asNode(tree.children.slice(k)), ctx);
  const mid = ctx.newNode();
  const raw = emptyRaw();
  raw.terminals.push({ x: 0, y: top.my, label: terms[0], node: 'T0', side: 'left' });
  wire(raw, 0, top.my, STUB, top.my, 'T0');
  top.place(STUB, 0, 'T0', mid, raw);
  const xr = STUB + Math.max(top.w, bot.w) + 24;
  wire(raw, STUB + top.w, top.my, xr, top.my, mid);
  const yb = top.h + 24;
  const sub = emptyRaw();
  bot.place(0, 0, mid, 'T1', sub);
  mirrorRaw(sub, bot.w);
  translateRaw(sub, STUB, yb);
  mergeRaw(raw, sub);
  wire(raw, STUB + bot.w, yb + bot.my, xr, yb + bot.my, mid);
  wire(raw, xr, top.my, xr, yb + bot.my, mid);
  wire(raw, 0, yb + bot.my, STUB, yb + bot.my, 'T1');
  raw.terminals.push({ x: 0, y: yb + bot.my, label: terms[1], node: 'T1', side: 'left' });
  return raw;
}

/**
 * Réseau en échelle : résistances horizontales sur le rail du haut, échelons verticaux
 * vers le rail du bas. Fonctionne aussi pour les états intermédiaires de la réduction.
 * Renvoie null si l'arbre n'a pas la forme d'une échelle.
 */
function ladderLayout(tree: Node, ctx: Ctx, terms: [string, string]): Raw | null {
  const H = 150;
  const raw = emptyRaw();
  const bottomXs: number[] = [0];
  const rung = (r: RNode, X: number, topNode: string) => {
    resistor(raw, ctx, r, X, H / 2, 'v', [topNode, 'T1']);
    wire(raw, X, 0, X, H / 2 - HALF, topNode);
    wire(raw, X, H / 2 + HALF, X, H, 'T1');
    bottomXs.push(X);
  };
  const walk = (node: Node, x: number, topNode: string): boolean => {
    if (node.kind === 'R') {
      // Échelon final : assez loin du précédent pour que les étiquettes ne se chevauchent pas.
      const X = x + 76;
      wire(raw, x, 0, X, 0, topNode);
      rung(node, X, topNode);
      return true;
    }
    if (node.kind === 'S' && node.children.length === 2 && node.children[0].kind === 'R') {
      const next = ctx.newNode();
      wire(raw, x, 0, x + 14, 0, topNode);
      resistor(raw, ctx, node.children[0], x + 14 + HALF, 0, 'h', [topNode, next]);
      return walk(node.children[1], x + 14 + RL, next);
    }
    if (node.kind === 'P' && node.children.length === 2) {
      const leafIdx = node.children.findIndex((c) => c.kind === 'R');
      if (leafIdx < 0) return false;
      const r = node.children[leafIdx] as RNode;
      const rest = node.children[1 - leafIdx];
      const X = x + 24;
      wire(raw, x, 0, X, 0, topNode);
      rung(r, X, topNode);
      return walk(rest, X, topNode);
    }
    return false;
  };
  raw.terminals.push({ x: 0, y: 0, label: terms[0], node: 'T0', side: 'left' });
  if (!walk(tree, 0, 'T0')) return null;
  const xs = [...new Set(bottomXs)].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) wire(raw, xs[i], H, xs[i + 1], H, 'T1');
  raw.terminals.push({ x: 0, y: H, label: terms[1], node: 'T1', side: 'left' });
  return raw;
}

// ---------------------------------------------------------------------------
// Layouts prédéfinis (cas particuliers)
// ---------------------------------------------------------------------------

/** Pont de Wheatstone dessiné en rectangle, résistance centrale verticale. */
function bridgeLayout(net: BridgeNet, ctx: Ctx, terms: [string, string]): Raw {
  const raw = emptyRaw();
  const [A, B, C, D] = ['T0', 'T1', 'nC', 'nD'];
  raw.terminals.push({ x: 0, y: 140, label: terms[0], node: A, side: 'left' });
  wire(raw, 0, 140, 60, 140, A);
  wire(raw, 60, 60, 60, 140, A);
  wire(raw, 60, 140, 60, 220, A);
  // Branche du haut : R1 – C – R2
  wire(raw, 60, 60, 90, 60, A);
  resistor(raw, ctx, net.r1, 130, 60, 'h', [A, C]);
  wire(raw, 170, 60, 210, 60, C);
  wire(raw, 210, 60, 250, 60, C);
  resistor(raw, ctx, net.r2, 290, 60, 'h', [C, B]);
  wire(raw, 330, 60, 370, 60, B);
  // Branche du bas : R3 – D – R4
  wire(raw, 60, 220, 90, 220, A);
  resistor(raw, ctx, net.r3, 130, 220, 'h', [A, D]);
  wire(raw, 170, 220, 210, 220, D);
  wire(raw, 210, 220, 250, 220, D);
  resistor(raw, ctx, net.r4, 290, 220, 'h', [D, B]);
  wire(raw, 330, 220, 370, 220, B);
  // Rail de droite et borne B
  wire(raw, 370, 60, 370, 140, B);
  wire(raw, 370, 140, 370, 220, B);
  wire(raw, 370, 140, 430, 140, B);
  raw.terminals.push({ x: 430, y: 140, label: terms[1], node: B, side: 'right' });
  // Résistance centrale C – D
  wire(raw, 210, 60, 210, 100, C);
  resistor(raw, ctx, net.r5, 210, 140, 'v', [C, D]);
  wire(raw, 210, 180, 210, 220, D);
  raw.nodeLabels.push({ x: 210, y: 60, text: 'C', node: C, side: 'top' });
  raw.nodeLabels.push({ x: 210, y: 220, text: 'D', node: D, side: 'bottom' });
  return raw;
}

/** Boucle de 4 résistances (A, C, B, D aux coins) ; on mesure entre C et D. */
function ringLayout(tree: Node, roles: Record<string, string>, ctx: Ctx, terms: [string, string]): Raw | null {
  const get = (role: string) => findNode(tree, roles[role]) as RNode | null;
  const [r1, r2, r3, r4] = ['r1', 'r2', 'r3', 'r4'].map(get);
  if (!r1 || !r2 || !r3 || !r4) return null;
  const raw = emptyRaw();
  const [C, D, A, B] = ['T0', 'T1', 'nA', 'nB'];
  // Haut : A — R1 — C
  wire(raw, 60, 40, 140, 40, A);
  resistor(raw, ctx, r1, 180, 40, 'h', [A, C]);
  wire(raw, 220, 40, 300, 40, C);
  // Droite : C — R2 — B
  wire(raw, 300, 40, 300, 100, C);
  resistor(raw, ctx, r2, 300, 140, 'v', [C, B]);
  wire(raw, 300, 180, 300, 240, B);
  // Bas : B — R3 — D
  wire(raw, 300, 240, 220, 240, B);
  resistor(raw, ctx, r3, 180, 240, 'h', [D, B]);
  wire(raw, 140, 240, 60, 240, D);
  // Gauche : D — R4 — A
  wire(raw, 60, 240, 60, 180, D);
  resistor(raw, ctx, r4, 60, 140, 'v', [A, D]);
  wire(raw, 60, 100, 60, 40, A);
  // Bornes de mesure C et D
  wire(raw, 300, 40, 380, 40, C);
  raw.terminals.push({ x: 380, y: 40, label: terms[0], node: C, side: 'right' });
  wire(raw, 60, 240, -20, 240, D);
  raw.terminals.push({ x: -20, y: 240, label: terms[1], node: D, side: 'left' });
  raw.nodeLabels.push({ x: 60, y: 40, text: 'A', node: A, side: 'left' });
  raw.nodeLabels.push({ x: 300, y: 240, text: 'B', node: B, side: 'right' });
  return raw;
}

/**
 * Circuit mixte « à redessiner » : R2 // R3 dessinées en boucle, R5 qui enjambe tout par le haut,
 * R6 verticale et retour vers B par le bas. Arbre : R1 + ((R2 // R3) + R4) // R5 + R6.
 */
function tangleLayout(tree: Node, roles: Record<string, string>, ctx: Ctx, terms: [string, string]): Raw | null {
  const get = (role: string) => findNode(tree, roles[role]) as RNode | null;
  const rs = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map(get);
  if (rs.some((r) => !r)) return null;
  const [r1, r2, r3, r4, r5, r6] = rs as RNode[];
  const raw = emptyRaw();
  const [A, N1, N2, N3, B] = ['T0', 'n1', 'n2', 'n3', 'T1'];
  raw.terminals.push({ x: 0, y: 110, label: terms[0], node: A, side: 'left' });
  resistor(raw, ctx, r1, 40, 110, 'h', [A, N1]);
  wire(raw, 80, 110, 180, 110, N1);
  wire(raw, 180, 110, 220, 110, N1);
  resistor(raw, ctx, r2, 260, 110, 'h', [N1, N2]);
  wire(raw, 300, 110, 340, 110, N2);
  // R3 en boucle par le bas
  wire(raw, 180, 110, 180, 190, N1);
  wire(raw, 180, 190, 220, 190, N1);
  resistor(raw, ctx, r3, 260, 190, 'h', [N1, N2]);
  wire(raw, 300, 190, 340, 190, N2);
  wire(raw, 340, 190, 340, 110, N2);
  wire(raw, 340, 110, 380, 110, N2);
  resistor(raw, ctx, r4, 420, 110, 'h', [N2, N3]);
  wire(raw, 460, 110, 520, 110, N3);
  // R5 enjambe par le haut
  wire(raw, 180, 110, 180, 30, N1);
  wire(raw, 180, 30, 300, 30, N1);
  resistor(raw, ctx, r5, 340, 30, 'h', [N1, N3]);
  wire(raw, 380, 30, 520, 30, N3);
  wire(raw, 520, 30, 520, 110, N3);
  // R6 verticale puis retour vers B
  wire(raw, 520, 110, 520, 150, N3);
  resistor(raw, ctx, r6, 520, 190, 'v', [N3, B]);
  wire(raw, 520, 230, 520, 280, B);
  wire(raw, 520, 280, 0, 280, B);
  raw.terminals.push({ x: 0, y: 280, label: terms[1], node: B, side: 'left' });
  return raw;
}

// ---------------------------------------------------------------------------
// Finalisation : nœuds électriques, points de jonction, cadrage
// ---------------------------------------------------------------------------

function finalize(raw: Raw): Schematic {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const [a, b] of raw.unions) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }
  const wires = raw.wires.map((w) => ({ ...w, node: find(w.node) }));
  const resistors = raw.resistors.map((r) => ({ ...r, nodes: [find(r.nodes[0]), find(r.nodes[1])] as [string, string] }));
  const terminals = raw.terminals.map((t) => ({ ...t, node: find(t.node) }));
  const nodeLabels = raw.nodeLabels.map((t) => ({ ...t, node: find(t.node) }));

  // Points de jonction : au moins 3 conducteurs se rejoignent.
  const key = (x: number, y: number) => `${Math.round(x * 10)}:${Math.round(y * 10)}`;
  const candidates = new Map<string, { x: number; y: number; node: string }>();
  const ends: { x: number; y: number }[] = [];
  wires.forEach((w) => {
    candidates.set(key(w.x1, w.y1), { x: w.x1, y: w.y1, node: w.node });
    candidates.set(key(w.x2, w.y2), { x: w.x2, y: w.y2, node: w.node });
  });
  resistors.forEach((r) => {
    const pts =
      r.orient === 'h'
        ? [
            { x: r.cx - HALF, y: r.cy },
            { x: r.cx + HALF, y: r.cy },
          ]
        : [
            { x: r.cx, y: r.cy - HALF },
            { x: r.cx, y: r.cy + HALF },
          ];
    ends.push(...pts);
  });
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  const dots: SchDot[] = [];
  candidates.forEach((p) => {
    let count = ends.filter((e) => near(e.x, p.x) && near(e.y, p.y)).length;
    for (const w of wires) {
      if ((near(w.x1, p.x) && near(w.y1, p.y)) || (near(w.x2, p.x) && near(w.y2, p.y))) count += 1;
      else if (near(w.x1, w.x2) && near(w.x1, p.x) && p.y > Math.min(w.y1, w.y2) && p.y < Math.max(w.y1, w.y2)) count += 2;
      else if (near(w.y1, w.y2) && near(w.y1, p.y) && p.x > Math.min(w.x1, w.x2) && p.x < Math.max(w.x1, w.x2)) count += 2;
    }
    if (count >= 3) dots.push(p);
  });

  // Cadre englobant (avec la place des étiquettes).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const ext = (x1: number, y1: number, x2: number, y2: number) => {
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  };
  wires.forEach((w) => ext(Math.min(w.x1, w.x2), Math.min(w.y1, w.y2), Math.max(w.x1, w.x2), Math.max(w.y1, w.y2)));
  resistors.forEach((r) =>
    r.orient === 'h' ? ext(r.cx - HALF, r.cy - 30, r.cx + HALF, r.cy + 32) : ext(r.cx - 14, r.cy - HALF, r.cx + 66, r.cy + HALF),
  );
  const sideExt = (t: { x: number; y: number; side: Side }, d: number) => {
    if (t.side === 'left') ext(t.x - d, t.y - 12, t.x + 8, t.y + 12);
    else if (t.side === 'right') ext(t.x - 8, t.y - 12, t.x + d, t.y + 12);
    else if (t.side === 'top') ext(t.x - 12, t.y - d, t.x + 12, t.y + 8);
    else ext(t.x - 12, t.y - 8, t.x + 12, t.y + d);
  };
  terminals.forEach((t) => sideExt(t, 30));
  nodeLabels.forEach((t) => sideExt(t, 26));

  const dx = PAD - minX;
  const dy = PAD - minY;
  const out: Raw = { resistors, wires, terminals, nodeLabels, unions: [] };
  translateRaw(out, dx, dy);
  dots.forEach((d) => {
    d.x += dx;
    d.y += dy;
  });

  const nodes: string[] = [];
  const addNode = (n: string) => !nodes.includes(n) && nodes.push(n);
  terminals.forEach((t) => addNode(t.node));
  nodeLabels.forEach((t) => addNode(t.node));
  wires.forEach((w) => addNode(w.node));
  resistors.forEach((r) => r.nodes.forEach(addNode));

  return {
    w: Math.ceil(maxX - minX + 2 * PAD),
    h: Math.ceil(maxY - minY + 2 * PAD),
    resistors: out.resistors,
    wires: out.wires,
    terminals: out.terminals,
    nodeLabels: out.nodeLabels,
    dots,
    nodes,
  };
}

function makeCtx(unit: Unit): Ctx {
  let k = 0;
  return {
    newNode: () => `n${++k}`,
    fmt: (r) => (r.value === 'unknown' ? '?' : formatOhms(r.value, unit)),
  };
}

export interface RenderOptions {
  layout: LayoutSpec;
  unit: Unit;
  terminals: [string, string];
  initialSignature?: string;
  roles?: Record<string, string>;
}

/** Calcule le schéma d'un état de circuit selon la présentation demandée. */
export function renderCircuit(state: CircuitState, opts: RenderOptions): Schematic {
  const ctx = makeCtx(opts.unit);
  const terms = opts.terminals;
  let raw: Raw | null = null;
  let allowRotate = false;
  if (state.type === 'bridge') {
    raw = bridgeLayout(state.net, ctx, terms);
  } else {
    const tree = state.tree;
    const pristine = opts.initialSignature !== undefined && signature(tree) === opts.initialSignature;
    switch (opts.layout.style) {
      case 'ladder':
        raw = ladderLayout(tree, ctx, terms);
        break;
      case 'ring':
        if (pristine && opts.roles) raw = ringLayout(tree, opts.roles, ctx, terms);
        break;
      case 'tangle':
        if (pristine && opts.roles) raw = tangleLayout(tree, opts.roles, ctx, terms);
        break;
      case 'rails':
        if (tree.kind === 'P') raw = railsLayout(tree, ctx, terms);
        break;
      case 'snake':
        if (tree.kind === 'S' && tree.children.length >= 3) raw = snakeLayout(tree, ctx, terms);
        break;
      default:
        break;
    }
    if (!raw) {
      raw = classicLayout(tree, ctx, terms);
      allowRotate = !isLeaf(tree);
    }
  }
  if (opts.layout.rotate && allowRotate) rotateRaw(raw);
  if (opts.layout.mirror) mirrorRaw(raw, 0);
  return finalize(raw);
}
