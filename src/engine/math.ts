import { type Frac, toNumber } from './fraction';
import { type Unit, unitFactor } from './numbers';
import type { GroupType } from './types';

/**
 * Formules LaTeX (rendues par KaTeX dans l'interface).
 * Les textes pédagogiques peuvent contenir des formules entre dollars : « As-tu calculé $R_{eq}$ ? ».
 */
export type RichPart = { type: 'text'; value: string } | { type: 'math'; value: string };

export function splitMath(text: string): RichPart[] {
  const parts: RichPart[] = [];
  const re = /\$([^$]+)\$/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'math', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/** Retire le balisage mathématique (pour le texte brut : CSV, attributs title…). */
export function stripMath(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, m: string) =>
    m
      .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
      .replace(/_\{([^}]*)\}/g, '$1')
      .replace(/\\,|\\;|\\!/g, ' ')
      .replace(/\\Omega/g, 'Ω')
      .replace(/\\cdot/g, '·')
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/[{}\\]/g, ''),
  );
}

/** Nombre au format français dans une formule : 3,6 → « 3{,}6 ». */
export function texNumber(x: number, maxDecimals = 3): string {
  const rounded = Math.round(x * 10 ** maxDecimals) / 10 ** maxDecimals;
  return String(rounded).replace('.', '{,}');
}

export function texUnit(unit: Unit): string {
  return unit === 'kΩ' ? '\\mathrm{k}\\Omega' : '\\Omega';
}

export function texOhms(value: Frac | number, unit: Unit): string {
  const v = typeof value === 'number' ? value : toNumber(value);
  return `${texNumber(v / unitFactor(unit))}\\,${texUnit(unit)}`;
}

/** « R12 » → « R_{12} », « R » → « R ». */
export function texLabel(label: string): string {
  const m = /^R(.+)$/.exec(label);
  if (!m) return label === 'R' ? 'R' : `\\text{${label}}`;
  return /^\d+$/.test(m[1]) ? `R_{${m[1]}}` : `R_{\\text{${m[1]}}}`;
}

/**
 * Formule d'une étape de réduction réussie, avec les valeurs.
 * Série : R12 = R1 + R2 = 4 + 8 = 12 Ω. Parallèle : 1/R123 = 1/R1 + 1/R2 + 1/R3 = 1/2 + 1/3 + 1/6 ⇒ R123 = 1 Ω.
 */
export function stepFormula(labels: string[], values: Frac[], type: GroupType, result: { label: string; value: Frac }, unit: Unit): string {
  const nums = values.map((v) => texNumber(toNumber(v) / unitFactor(unit)));
  const res = texLabel(result.label);
  const val = texOhms(result.value, unit);
  if (type === 'S') {
    return `${res} = ${labels.map(texLabel).join(' + ')} = ${nums.join(' + ')} = ${val}`;
  }
  const symbolic = labels.map((l) => `\\frac{1}{${texLabel(l)}}`).join(' + ');
  const numeric = nums.map((n) => `\\frac{1}{${n}}`).join(' + ');
  return `\\frac{1}{${res}} = ${symbolic} = ${numeric} \\;\\Rightarrow\\; ${res} = ${val}`;
}
