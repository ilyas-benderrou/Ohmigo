import { ERRORS } from '../content/errors';
import { LEVEL_LABELS } from '../content/competences';
import { getTemplate } from '../content/templates';
import { levelIndex } from '../engine/adaptive';
import { COMPETENCES, ERROR_CODES, type Competence, type ErrorCode, type Level } from '../engine/types';
import type { Attempt, Student, VideoView } from './types';

/** Erreurs fréquentes de la classe : % d'élèves ayant commis chaque erreur au moins une fois. */
export function classErrorFrequency(students: Student[], attempts: Attempt[]): { code: ErrorCode; students: number; percent: number; occurrences: number }[] {
  const ids = new Set(students.map((s) => s.id));
  return ERROR_CODES.map((code) => {
    const who = new Set<string>();
    let occurrences = 0;
    for (const a of attempts) {
      if (!ids.has(a.studentId)) continue;
      const n = a.errors.filter((e) => e === code).length;
      if (n) {
        who.add(a.studentId);
        occurrences += n;
      }
    }
    return { code, students: who.size, occurrences, percent: students.length ? Math.round((who.size / students.length) * 100) : 0 };
  });
}

export interface StudentSummary {
  attempts: number;
  successes: number;
  successRate: number;
  timeSec: number;
  hints: number;
  videosReplayed: number;
  remediationVideos: number;
  errorCounts: { code: ErrorCode; count: number }[];
}

export function studentSummary(attempts: Attempt[], views: VideoView[]): StudentSummary {
  const successes = attempts.filter((a) => a.success).length;
  const counts = new Map<ErrorCode, number>();
  attempts.forEach((a) => a.errors.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  return {
    attempts: attempts.length,
    successes,
    successRate: attempts.length ? Math.round((successes / attempts.length) * 100) : 0,
    timeSec: attempts.reduce((s, a) => s + a.durationSec, 0),
    hints: attempts.reduce((s, a) => s + a.hintsUsed, 0),
    videosReplayed: views.filter((v) => v.reason === 'replay').length,
    remediationVideos: views.filter((v) => v.reason === 'remediation').length,
    errorCounts: [...counts.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
  };
}

/** Courbe de progression : maîtrise moyenne (C1–C6) après chaque tentative. */
export function progressSeries(attempts: Attempt[]): { at: string; mastery: number; level: Level }[] {
  return [...attempts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((a) => ({
      at: a.endedAt,
      mastery: Math.round(COMPETENCES.reduce((s, c) => s + a.competencesAfter[c], 0) / COMPETENCES.length),
      level: a.levelAfter,
    }));
}

export interface SessionBilan {
  exercises: number;
  successes: number;
  levelsValidated: Level[];
  errorsMade: ErrorCode[];
  errorsCorrected: ErrorCode[];
  timeSec: number;
  competences: Competence[];
}

/** Bilan de fin de session : niveaux validés, compétences travaillées, erreurs corrigées. */
export function sessionBilan(attempts: Attempt[]): SessionBilan {
  const sorted = [...attempts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const levelsValidated: Level[] = [];
  sorted.forEach((a) => {
    // La validation du niveau difficile se lit dans le modèle (completed), pas dans l'historique.
    if (a.success && levelIndex(a.levelAfter) > levelIndex(a.level) && !levelsValidated.includes(a.level)) levelsValidated.push(a.level);
  });
  const errorsMade = [...new Set(sorted.flatMap((a) => a.errors))];
  const errorsCorrected = errorsMade.filter((code) => {
    const lastIdx = sorted.map((a) => a.errors.includes(code)).lastIndexOf(true);
    const lastAttempt = sorted[lastIdx];
    // Corrigée : l'exercice où l'erreur a été commise a été réussi, ou un exercice testant cette erreur a été réussi ensuite.
    if (lastAttempt.success) return true;
    return sorted.slice(lastIdx + 1).some((a) => a.success && getTemplate(a.templateId).testsErrors.includes(code));
  });
  const competences = [...new Set(sorted.flatMap((a) => getTemplate(a.templateId).competences))].sort() as Competence[];
  return {
    exercises: sorted.length,
    successes: sorted.filter((a) => a.success).length,
    levelsValidated,
    errorsMade,
    errorsCorrected,
    timeSec: sorted.reduce((s, a) => s + a.durationSec, 0),
    competences,
  };
}

// ---------------------------------------------------------------------------
// Export CSV (séparateur « ; » pour Excel en français, BOM UTF-8)
// ---------------------------------------------------------------------------

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

const OUTCOMES: Record<Attempt['outcome'], string> = {
  success: 'réussi',
  remediation: 'remédiation',
  alert: 'alerte',
  abandoned: 'abandonné',
};

export function attemptsCsv(students: Student[], attempts: Attempt[]): string {
  const byId = new Map(students.map((s) => [s.id, s]));
  const header = [
    'classe', 'nom', 'prénom', 'début', 'fin', 'durée_s', 'exercice', 'niveau', 'mode', 'remédiation', 'révision',
    'résultat', 'réussite', 'erreurs', 'nb_étapes', 'indices', 'vidéos', 'réponse_finale', 'unité', 'valeurs',
    ...COMPETENCES.map((c) => `${c}_après`), 'niveau_après',
  ];
  const rows = [...attempts]
    .filter((a) => byId.has(a.studentId))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((a) => {
      const s = byId.get(a.studentId)!;
      return [
        s.classCode, s.lastName, s.firstName, a.startedAt, a.endedAt, a.durationSec, a.templateId, LEVEL_LABELS[a.level], a.mode === 'direct' ? 'réponse directe' : 'étapes',
        a.remediation ? 'oui' : 'non', a.review ? 'oui' : 'non', OUTCOMES[a.outcome], a.success ? 1 : 0, a.errors.join(' '), a.steps.length, a.hintsUsed,
        a.videosWatched.join(' '), a.finalAnswer === null ? '' : String(a.finalAnswer).replace('.', ','), a.unit,
        Object.entries(a.values).map(([k, v]) => `${k}=${v}`).join(' '),
        ...COMPETENCES.map((c) => a.competencesAfter[c]), LEVEL_LABELS[a.levelAfter],
      ];
    });
  return toCsv([header, ...rows]);
}

export function summaryCsv(students: Student[], attempts: Attempt[], views: VideoView[]): string {
  const header = [
    'classe', 'nom', 'prénom', 'niveau', 'leçon_validée', ...COMPETENCES, 'tentatives', 'réussites', 'taux_réussite_%', 'temps_total_s',
    'indices', 'vidéos_revues', 'vidéos_remédiation', ...ERROR_CODES.map((c) => `${c}_${ERRORS[c].name}`),
  ];
  const rows = [...students]
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
    .map((s) => {
      const at = attempts.filter((a) => a.studentId === s.id);
      const sum = studentSummary(at, views.filter((v) => v.studentId === s.id));
      return [
        s.classCode, s.lastName, s.firstName, LEVEL_LABELS[s.model.level], s.model.completed ? 'oui' : 'non', ...COMPETENCES.map((c) => s.model.competences[c]),
        sum.attempts, sum.successes, sum.successRate, sum.timeSec, sum.hints, sum.videosReplayed, sum.remediationVideos,
        ...ERROR_CODES.map((c) => sum.errorCounts.find((e) => e.code === c)?.count ?? 0),
      ];
    });
  return toCsv([header, ...rows]);
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
