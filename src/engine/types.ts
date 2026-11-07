import type { Frac } from './fraction';
import type { Unit } from './numbers';
import type { Node, RNode } from './tree';

export type Level = 'facile' | 'moyen' | 'difficile';
export const LEVELS: Level[] = ['facile', 'moyen', 'difficile'];

export type Competence = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export const COMPETENCES: Competence[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

export type ErrorCode = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9' | 'E10' | 'E11';
export const ERROR_CODES: ErrorCode[] = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11'];

/** Type de groupe choisi par l'élève : série ou parallèle. */
export type GroupType = 'S' | 'P';

/**
 * Pont de Wheatstone (netlist, pas un arbre série-parallèle) :
 * r1 : A–C, r2 : C–B, r3 : A–D, r4 : D–B, r5 : C–D (résistance centrale).
 */
export interface BridgeNet {
  r1: RNode;
  r2: RNode;
  r3: RNode;
  r4: RNode;
  r5: RNode;
}

/** État courant du circuit pendant la réduction interactive. */
export type CircuitState = { type: 'tree'; tree: Node } | { type: 'bridge'; net: BridgeNet };

export type LayoutStyle = 'classic' | 'rails' | 'snake' | 'ladder' | 'bridge' | 'ring' | 'tangle';

export interface LayoutSpec {
  style: LayoutStyle;
  /** Schéma dessiné verticalement (rotation de 90°). */
  rotate?: boolean;
  /** Schéma en miroir (bornes à droite). */
  mirror?: boolean;
}

export interface Distractor {
  value: Frac;
  code: ErrorCode;
  label: string;
}

export interface InverseMeta {
  unknownId: string;
  /** Req imposée entre A et B. */
  givenReq: Frac;
  /** Résistance en série connue. */
  seriesValue: Frac;
  /** Résistance connue en parallèle avec l'inconnue. */
  parallelKnown: Frac;
  /** Valeur attendue de la partie parallèle (Req − série). */
  parallelValue: Frac;
}

export interface ExerciseInstance {
  templateId: string;
  level: Level;
  seed: number;
  kind: 'reduce' | 'inverse';
  circuit: CircuitState;
  layout: LayoutSpec;
  /** Signature du circuit initial : les layouts prédéfinis ne valent que pour lui. */
  initialSignature: string;
  /** Rôle géométrique → id de résistance, pour les layouts prédéfinis. */
  roles?: Record<string, string>;
  unit: Unit;
  terminals: [string, string];
  prompt: string;
  /** Bonne réponse en Ω (Req, ou R inconnue pour un problème inverse). */
  answer: Frac;
  distractors: Distractor[];
  /** Mode « réponse directe » autorisé (niveau facile). */
  allowDirect: boolean;
  /** Réseau en échelle : réduction attendue depuis l'extrémité opposée à A. */
  ladder?: boolean;
  inverse?: InverseMeta;
  /** Valeurs initiales (étiquette → Ω), pour l'historique. */
  values: Record<string, number>;
}
