import { describe, expect, it } from 'vitest';
import { buildDemoDatabase } from './demo';
import { capitalizeName, normalizeName } from './ids';
import { LocalStorageRepository } from './localStorageRepository';

describe('données de démo', () => {
  const db = buildDemoDatabase(Date.UTC(2026, 9, 26, 12));

  it('contient 1 classe et 8 élèves avec un historique', () => {
    expect(db.classes).toHaveLength(1);
    expect(db.students).toHaveLength(8);
    db.students.forEach((s) => expect(db.attempts.some((a) => a.studentId === s.id)).toBe(true));
  });

  it('montre au moins une alerte active (Youssef bloqué sur E6)', () => {
    const youssef = db.students.find((s) => s.firstName === 'Youssef')!;
    expect(db.alerts.some((a) => a.studentId === youssef.id && a.code === 'E6' && !a.resolved)).toBe(true);
  });

  it('présente des niveaux variés', () => {
    const levels = new Set(db.students.map((s) => s.model.level));
    expect(levels.size).toBeGreaterThanOrEqual(2);
  });

  it('ne stocke que prénom, nom et classe', () => {
    const keys = Object.keys(db.students[0]).sort();
    expect(keys).toEqual(['classCode', 'createdAt', 'firstName', 'id', 'lastActive', 'lastName', 'model']);
  });

  it('est déterministe', () => {
    const again = buildDemoDatabase(Date.UTC(2026, 9, 26, 12));
    expect(again.attempts.map((a) => a.templateId)).toEqual(db.attempts.map((a) => a.templateId));
  });
});

describe('repository (sans localStorage : repli en mémoire)', () => {
  it('connecte un élève existant sans tenir compte des accents ni de la casse', async () => {
    const repo = new LocalStorageRepository();
    const s = await repo.findOrCreateStudent('  youssef ', 'AMRANI', '1ste-a');
    expect(s.id).toBe('stu_demo_1');
  });
  it('crée un nouvel élève et refuse un code de classe inconnu', async () => {
    const repo = new LocalStorageRepository();
    const s = await repo.findOrCreateStudent('Rim', 'el ouazzani', '1STE-A');
    expect(s.lastName).toBe('El Ouazzani');
    expect(s.model.level).toBe('facile');
    await expect(repo.findOrCreateStudent('A', 'B', 'XXX')).rejects.toThrow(/inconnu/);
  });
  it('vérifie le PIN professeur', async () => {
    const repo = new LocalStorageRepository();
    expect(await repo.checkTeacherPin('1234')).toBe(true);
    expect(await repo.checkTeacherPin('0000')).toBe(false);
  });
});

describe('noms', () => {
  it('normalise et capitalise', () => {
    expect(normalizeName('  Hïba  ')).toBe('hiba');
    expect(capitalizeName('el idrissi')).toBe('El Idrissi');
  });
});
