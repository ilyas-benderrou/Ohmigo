import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { ERRORS } from '../content/errors';
import * as FEEDBACK from '../content/feedback';
import { TEMPLATES, createInstance } from '../content/templates';
import { INTRO_VIDEO } from '../content/videos';
import { frac } from './fraction';
import { splitMath, stepFormula, stripMath, texLabel, texOhms } from './math';

/** Lève une erreur si la formule n'est pas du LaTeX valide pour KaTeX. */
const parses = (tex: string) => katex.renderToString(tex, { throwOnError: true, strict: 'error' });
const mathOf = (text: string) => splitMath(text).filter((p) => p.type === 'math').map((p) => p.value);

describe('formules LaTeX', () => {
  it('découpe le texte enrichi', () => {
    expect(splitMath('As-tu calculé $R_{eq}$ ou $\\frac{1}{R_{eq}}$ ?')).toEqual([
      { type: 'text', value: 'As-tu calculé ' },
      { type: 'math', value: 'R_{eq}' },
      { type: 'text', value: ' ou ' },
      { type: 'math', value: '\\frac{1}{R_{eq}}' },
      { type: 'text', value: ' ?' },
    ]);
    expect(splitMath('sans formule')).toEqual([{ type: 'text', value: 'sans formule' }]);
  });

  it('produit du texte brut lisible', () => {
    expect(stripMath('As-tu calculé $R_{eq}$ ou $\\dfrac{1}{R_{eq}}$ ?')).toBe('As-tu calculé Req ou 1/Req ?');
  });

  it('formate valeurs, unités et étiquettes', () => {
    expect(texOhms(frac(18, 5), 'Ω')).toBe('3{,}6\\,\\Omega');
    expect(texOhms(2200, 'kΩ')).toBe('2{,}2\\,\\mathrm{k}\\Omega');
    expect(texLabel('R123')).toBe('R_{123}');
    expect(texLabel('R')).toBe('R');
  });

  it('écrit la formule d’une étape (série et parallèle)', () => {
    const s = stepFormula(['R1', 'R2'], [frac(4), frac(8)], 'S', { label: 'R12', value: frac(12) }, 'Ω');
    expect(s).toBe('R_{12} = R_{1} + R_{2} = 4 + 8 = 12\\,\\Omega');
    const p = stepFormula(['R1', 'R2', 'R3'], [frac(2), frac(3), frac(6)], 'P', { label: 'R123', value: frac(1) }, 'Ω');
    expect(p).toContain('\\frac{1}{R_{123}}');
    expect(p).toContain('\\frac{1}{2} + \\frac{1}{3} + \\frac{1}{6}');
    expect(() => parses(s)).not.toThrow();
    expect(() => parses(p)).not.toThrow();
    expect(() => parses(stepFormula(['R1', 'R2'], [frac(2200), frac(4700)], 'S', { label: 'R12', value: frac(6900) }, 'kΩ'))).not.toThrow();
  });

  it('toutes les formules du contenu pédagogique sont valides', () => {
    const texts: string[] = [];
    Object.values(ERRORS).forEach((e) => {
      texts.push(e.hint, e.detection, e.name);
      if (e.video) {
        texts.push(e.video.script);
        if (e.video.formula) expect(() => parses(e.video!.formula!)).not.toThrow();
      }
    });
    INTRO_VIDEO.segments.forEach((s) => {
      texts.push(s.script);
      expect(() => parses(s.formula)).not.toThrow();
    });
    Object.values(FEEDBACK).forEach((v) => {
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) texts.push(...v);
      else Object.values(v).forEach((x) => texts.push(...(Array.isArray(x) ? x : [x])));
    });
    TEMPLATES.forEach((t) => {
      for (let seed = 1; seed <= 20; seed++) texts.push(createInstance(t.id, seed).prompt);
    });
    const formulas = texts.flatMap(mathOf);
    expect(formulas.length).toBeGreaterThan(10);
    formulas.forEach((f) => expect(() => parses(f), f).not.toThrow());
    // Pas de dollar orphelin.
    texts.forEach((t) => expect((t.match(/\$/g) ?? []).length % 2, t).toBe(0));
  });
});
