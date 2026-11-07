/**
 * Fractions exactes (numérateur / dénominateur) pour éviter les erreurs d'arrondi.
 * Toutes les valeurs sont stockées réduites, avec un dénominateur strictement positif.
 */
export interface Frac {
  readonly n: number;
  readonly d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    // Valeur décimale : on passe par une conversion exacte en base 10.
    return div(fromDecimal(n), fromDecimal(d));
  }
  if (d === 0) throw new Error('Dénominateur nul');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** Convertit un décimal « humain » (ex. 2.2, 4.7) en fraction exacte. */
export function fromDecimal(x: number): Frac {
  if (Number.isInteger(x)) return frac(x, 1);
  let scale = 1;
  while (!Number.isInteger(Math.round(x * scale * 1e9) / 1e9) && scale < 1e9) scale *= 10;
  return frac(Math.round(x * scale), scale);
}

export const ZERO: Frac = { n: 0, d: 1 };
export const ONE: Frac = { n: 1, d: 1 };

export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const div = (a: Frac, b: Frac): Frac => {
  if (b.n === 0) throw new Error('Division par zéro');
  return frac(a.n * b.d, a.d * b.n);
};
export const inv = (a: Frac): Frac => div(ONE, a);
export const eq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const isZero = (a: Frac): boolean => a.n === 0;
export const cmp = (a: Frac, b: Frac): number => a.n * b.d - b.n * a.d;
export const toNumber = (a: Frac): number => a.n / a.d;
export const isInteger = (a: Frac): boolean => a.d === 1;

export function sum(list: Frac[]): Frac {
  return list.reduce(add, ZERO);
}

export function product(list: Frac[]): Frac {
  return list.reduce(mul, ONE);
}

/** Association en parallèle : 1/Req = Σ 1/Ri. Une branche nulle (fil) court-circuite tout. */
export function parallel(list: Frac[]): Frac {
  if (list.some(isZero)) return ZERO;
  return inv(sum(list.map(inv)));
}

/**
 * Résultat « propre » : au plus une décimale (dénominateur qui divise 10).
 * Ex. 2, 3,6, 2,5 sont propres ; 2,857… ne l'est pas.
 */
export function isClean(a: Frac): boolean {
  return a.n >= 0 && 10 % a.d === 0;
}

export function toString(a: Frac): string {
  return a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`;
}
