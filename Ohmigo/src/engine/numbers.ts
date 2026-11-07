import { ADAPTIVE } from '../config/adaptive';
import { type Frac, toNumber } from './fraction';

export type Unit = 'Ω' | 'kΩ';

export const unitFactor = (u: Unit): number => (u === 'kΩ' ? 1000 : 1);

/**
 * Lit un nombre saisi par l'élève : « 2 », « 2.0 », « 2,0 », « 3,6 », « 18/5 ».
 * Renvoie null si la saisie n'est pas un nombre.
 */
export function parseUserNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '').replace(/Ω|ohms?/gi, '').replace(',', '.');
  if (s === '') return null;
  const fracMatch = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (fracMatch) {
    const den = Number(fracMatch[2]);
    if (den === 0) return null;
    return Number(fracMatch[1]) / den;
  }
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Comparaison avec la tolérance relative de 1 % (configurable). */
export function isClose(x: number, target: number, rel = ADAPTIVE.answerRelTolerance): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(target)) return false;
  if (target === 0) return Math.abs(x) < 1e-9;
  return Math.abs(x - target) <= rel * Math.abs(target) + 1e-12;
}

export function isCloseFrac(x: number, target: Frac, rel?: number): boolean {
  return isClose(x, toNumber(target), rel);
}

/** Format français : virgule décimale, au plus 3 décimales, zéros inutiles supprimés. */
export function formatNumber(x: number, maxDecimals = 3): string {
  const rounded = Math.round(x * 10 ** maxDecimals) / 10 ** maxDecimals;
  return String(rounded).replace('.', ',');
}

/** Valeur exacte (en Ω) affichée dans l'unité de l'exercice. */
export function formatOhms(valueOhm: Frac | number, unit: Unit): string {
  const v = typeof valueOhm === 'number' ? valueOhm : toNumber(valueOhm);
  return `${formatNumber(v / unitFactor(unit))} ${unit}`;
}
