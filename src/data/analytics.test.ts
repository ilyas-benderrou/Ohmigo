import { describe, expect, it } from 'vitest';
import { attemptsCsv, classErrorFrequency, progressSeries, sessionBilan, studentSummary, summaryCsv } from './analytics';
import { buildDemoDatabase } from './demo';

const db = buildDemoDatabase(Date.UTC(2026, 9, 26, 12));

describe('tableau de bord', () => {
  it('calcule le % d’élèves par code d’erreur', () => {
    const freq = classErrorFrequency(db.students, db.attempts);
    expect(freq).toHaveLength(12);
    const e6 = freq.find((f) => f.code === 'E6')!;
    expect(e6.students).toBeGreaterThanOrEqual(1);
    freq.forEach((f) => {
      expect(f.percent).toBeGreaterThanOrEqual(0);
      expect(f.percent).toBeLessThanOrEqual(100);
    });
  });

  it('résume l’activité d’un élève', () => {
    const s = db.students[0];
    const sum = studentSummary(
      db.attempts.filter((a) => a.studentId === s.id),
      db.videoViews.filter((v) => v.studentId === s.id),
    );
    expect(sum.attempts).toBeGreaterThan(0);
    expect(sum.timeSec).toBeGreaterThan(0);
    expect(sum.errorCounts[0].code).toBeDefined();
  });

  it('produit une courbe de progression ordonnée', () => {
    const series = progressSeries(db.attempts.filter((a) => a.studentId === db.students[1].id));
    expect(series.length).toBeGreaterThan(3);
    for (let i = 1; i < series.length; i++) expect(series[i].at >= series[i - 1].at).toBe(true);
  });

  it('établit un bilan de session', () => {
    const at = db.attempts.filter((a) => a.studentId === db.students[1].id);
    const b = sessionBilan(at);
    expect(b.exercises).toBe(at.length);
    expect(b.levelsValidated).toContain('facile');
    b.errorsCorrected.forEach((c) => expect(b.errorsMade).toContain(c));
  });

  it('exporte en CSV (séparateur ;)', () => {
    const csv = attemptsCsv(db.students, db.attempts);
    const lines = csv.split('\r\n');
    expect(lines[0].startsWith('﻿classe;nom;prénom')).toBe(true);
    expect(lines).toHaveLength(db.attempts.length + 1);
    const sum = summaryCsv(db.students, db.attempts, db.videoViews).split('\r\n');
    expect(sum).toHaveLength(9);
  });
});
