import { describe, expect, it } from 'vitest';
import { ADAPTIVE } from '../config/adaptive';
import { TEMPLATES, getTemplate } from '../content/templates';
import { type LearnerModel, chooseNextTemplate, completeExercise, newLearnerModel, registerError } from './adaptive';
import { mulberry32 } from './rng';

const rng = () => mulberry32(123);
const ok = (id: string, usedHelp = false, durationSec = 60) => ({
  template: getTemplate(id),
  success: true,
  usedHelp,
  durationSec,
  errors: [],
});

describe('règles d’adaptation (section 9)', () => {
  it('passe au niveau suivant après 3 réussites dont 2 sans indice', () => {
    let m = newLearnerModel();
    m = completeExercise(m, ok('F1', true), rng()).model;
    m = completeExercise(m, ok('F2'), rng()).model;
    expect(m.level).toBe('facile');
    const r = completeExercise(m, ok('F3'), rng());
    expect(r.levelUp).toBe(true);
    expect(r.model.level).toBe('moyen');
  });

  it('ne passe pas si seulement 1 réussite sans indice', () => {
    let m = newLearnerModel();
    m = completeExercise(m, ok('F1', true), rng()).model;
    m = completeExercise(m, ok('F2', true), rng()).model;
    m = completeExercise(m, ok('F3'), rng()).model;
    expect(m.level).toBe('facile');
  });

  it('exige un exercice de plus après une réussite très lente', () => {
    let m = newLearnerModel();
    m = completeExercise(m, ok('F1', false, ADAPTIVE.slowTimeSec.facile + 10), rng()).model;
    m = completeExercise(m, ok('F2'), rng()).model;
    m = completeExercise(m, ok('F3'), rng()).model;
    expect(m.level).toBe('facile');
    m = completeExercise(m, ok('F4'), rng()).model;
    expect(m.level).toBe('moyen');
  });

  it('une erreur casse la série de réussites', () => {
    let m = newLearnerModel();
    m = completeExercise(m, ok('F1'), rng()).model;
    m = completeExercise(m, { ...ok('F2'), success: false }, rng()).model;
    expect(m.streak.count).toBe(0);
  });

  it('indice → micro-vidéo → alerte professeur et retour au niveau précédent', () => {
    let m: LearnerModel = { ...newLearnerModel(), level: 'difficile' };
    let r = registerError(m, 'E6');
    expect(r.action).toBe('hint');
    m = r.model;
    r = registerError(m, 'E6');
    expect(r.action).toBe('video');
    m = r.model;
    r = registerError(m, 'E6');
    expect(r.action).toBe('alert');
    expect(r.model.level).toBe('moyen');
    expect(r.model.focusCompetence).toBe('C5');
    expect(r.model.errorCounts.E6).toBe(3);
  });

  it('met à jour la maîtrise des compétences, bornée entre 0 et 100', () => {
    let m = newLearnerModel();
    m = registerError(m, 'E3').model;
    expect(m.competences.C3).toBe(0);
    for (let i = 0; i < 10; i++) m = completeExercise(m, ok('F3'), rng()).model;
    expect(m.competences.C3).toBe(100);
  });

  it('une erreur corrigée remet l’exercice en révision 2–3 exercices plus tard', () => {
    let m = newLearnerModel();
    m = completeExercise(m, { ...ok('F2', true), errors: ['E3'] }, rng()).model;
    expect(m.reviewQueue).toHaveLength(1);
    const delay = m.reviewQueue[0].dueIn;
    expect(delay).toBeGreaterThanOrEqual(2);
    expect(delay).toBeLessThanOrEqual(3);
    for (let i = 0; i < delay; i++) m = completeExercise(m, ok('F1'), rng()).model;
    const next = chooseNextTemplate(m, TEMPLATES, rng());
    expect(next.templateId).toBe('F2');
    expect(next.review).toBe(true);
  });

  it('une réussite sans l’erreur la considère corrigée', () => {
    let m = newLearnerModel();
    m = registerError(m, 'E2').model;
    expect(m.errorStreaks.E2).toBe(1);
    m = completeExercise(m, ok('F2'), rng()).model;
    expect(m.errorStreaks.E2).toBe(0);
  });

  it('privilégie la compétence la plus faible du niveau', () => {
    const m = newLearnerModel();
    m.competences = { ...m.competences, C1: 80, C2: 80, C3: 10 };
    const counts: Record<string, number> = {};
    const r = mulberry32(7);
    for (let i = 0; i < 400; i++) {
      const id = chooseNextTemplate(m, TEMPLATES, r).templateId;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const c3 = (counts.F2 ?? 0) + (counts.F3 ?? 0) + (counts.F5 ?? 0);
    expect(c3 / 400).toBeGreaterThan(0.7);
    expect(Object.keys(counts).every((id) => id.startsWith('F'))).toBe(true);
  });

  it('valide la leçon au niveau difficile', () => {
    let m: LearnerModel = { ...newLearnerModel(), level: 'difficile' };
    m = completeExercise(m, ok('D1'), rng()).model;
    m = completeExercise(m, ok('D2'), rng()).model;
    const r = completeExercise(m, ok('D3'), rng());
    expect(r.finished).toBe(true);
    expect(r.model.completed).toBe(true);
    expect(r.model.level).toBe('difficile');
  });
});
