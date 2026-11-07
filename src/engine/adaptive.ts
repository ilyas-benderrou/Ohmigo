import { ADAPTIVE } from '../config/adaptive';
import { ERRORS } from '../content/errors';
import type { ExerciseTemplate } from './generate';
import { type Rng, pick, randInt } from './rng';
import { COMPETENCES, LEVELS, type Competence, type ErrorCode, type Level } from './types';

/** Modèle de l'apprenant (section 8). */
export interface LearnerModel {
  level: Level;
  maxLevelReached: Level;
  introDone: boolean;
  /** Niveau difficile validé : leçon terminée (l'élève peut continuer à s'entraîner). */
  completed: boolean;
  competences: Record<Competence, number>;
  /** Nombre total d'occurrences de chaque erreur. */
  errorCounts: Partial<Record<ErrorCode, number>>;
  /** Occurrences de la même erreur non encore corrigée (pilote indice → vidéo → alerte). */
  errorStreaks: Partial<Record<ErrorCode, number>>;
  /** Réussites d'affilée dans le niveau courant. */
  streak: { count: number; noHint: number };
  /** Exercices supplémentaires exigés avant de passer (réussite très lente). */
  extraNeeded: number;
  /** Révision espacée : gabarits à réinsérer dans quelques exercices. */
  reviewQueue: { templateId: string; dueIn: number; code: ErrorCode }[];
  /** Compétence à retravailler en priorité (après une alerte). */
  focusCompetence: Competence | null;
  lastTemplateId: string | null;
  exercisesDone: number;
}

export function newLearnerModel(): LearnerModel {
  return {
    level: 'facile',
    maxLevelReached: 'facile',
    introDone: false,
    completed: false,
    competences: Object.fromEntries(COMPETENCES.map((c) => [c, ADAPTIVE.initialCompetence])) as Record<Competence, number>,
    errorCounts: {},
    errorStreaks: {},
    streak: { count: 0, noHint: 0 },
    extraNeeded: 0,
    reviewQueue: [],
    focusCompetence: null,
    lastTemplateId: null,
    exercisesDone: 0,
  };
}

export const levelIndex = (l: Level): number => LEVELS.indexOf(l);
export const previousLevel = (l: Level): Level => LEVELS[Math.max(0, levelIndex(l) - 1)];
export const nextLevel = (l: Level): Level => LEVELS[Math.min(LEVELS.length - 1, levelIndex(l) + 1)];
const maxLevel = (a: Level, b: Level): Level => (levelIndex(a) >= levelIndex(b) ? a : b);

const clamp = (x: number) => Math.max(0, Math.min(100, x));

function clone(m: LearnerModel): LearnerModel {
  return {
    ...m,
    competences: { ...m.competences },
    errorCounts: { ...m.errorCounts },
    errorStreaks: { ...m.errorStreaks },
    streak: { ...m.streak },
    reviewQueue: m.reviewQueue.map((r) => ({ ...r })),
  };
}

export type HelpAction = 'hint' | 'video' | 'alert';

/**
 * Enregistre une erreur et choisit l'aide (section 9) :
 * 1re fois → indice ; 2e fois → micro-vidéo + remédiation ; 3e fois → alerte professeur
 * et retour au niveau précédent sur la compétence concernée.
 */
export function registerError(model: LearnerModel, code: ErrorCode): { model: LearnerModel; action: HelpAction; count: number } {
  const m = clone(model);
  m.errorCounts[code] = (m.errorCounts[code] ?? 0) + 1;
  const count = (m.errorStreaks[code] ?? 0) + 1;
  m.errorStreaks[code] = count;
  for (const c of ERRORS[code].competences) m.competences[c] = clamp(m.competences[c] - ADAPTIVE.errorPenalty);

  // E0 n'a pas de vidéo : on reste sur l'indice (passage forcé en mode étapes) jusqu'à l'alerte.
  const hasVideo = ERRORS[code].video !== null;
  if (count >= ADAPTIVE.alertAt) {
    m.errorStreaks[code] = 0;
    m.level = previousLevel(m.level);
    m.streak = { count: 0, noHint: 0 };
    m.extraNeeded = 0;
    m.completed = false;
    const comps = ERRORS[code].competences;
    m.focusCompetence = comps.length ? comps[0] : null;
    return { model: m, action: 'alert', count };
  }
  if (count >= ADAPTIVE.videoAt && hasVideo) return { model: m, action: 'video', count };
  return { model: m, action: 'hint', count };
}

export interface ExerciseOutcome {
  template: Pick<ExerciseTemplate, 'id' | 'level' | 'competences' | 'testsErrors'>;
  /** Exercice terminé (sinon abandonné pour une remédiation ou après une alerte). */
  success: boolean;
  /** Au moins une aide (indice, vidéo) utilisée. */
  usedHelp: boolean;
  durationSec: number;
  /** Erreurs commises pendant l'exercice. */
  errors: ErrorCode[];
}

export interface CompletionResult {
  model: LearnerModel;
  levelUp: boolean;
  finished: boolean;
  slow: boolean;
}

export function completeExercise(model: LearnerModel, outcome: ExerciseOutcome, rng: Rng): CompletionResult {
  const m = clone(model);
  m.exercisesDone += 1;
  m.lastTemplateId = outcome.template.id;
  m.reviewQueue.forEach((r) => (r.dueIn -= 1));
  const sameLevel = outcome.template.level === m.level;
  let levelUp = false;
  let finished = false;
  let slow = false;

  if (!outcome.success) {
    if (sameLevel) m.streak = { count: 0, noHint: 0 };
    return { model: m, levelUp, finished, slow };
  }

  for (const c of outcome.template.competences) m.competences[c] = clamp(m.competences[c] + ADAPTIVE.successGain);
  if (m.focusCompetence && outcome.template.competences.includes(m.focusCompetence)) m.focusCompetence = null;

  // Erreurs travaillées par ce gabarit et non commises cette fois : elles sont corrigées.
  const tested = new Set<ErrorCode>([...outcome.template.testsErrors, 'E0', 'E9']);
  for (const code of tested) if (!outcome.errors.includes(code)) m.errorStreaks[code] = 0;

  // Erreur corrigée pendant l'exercice → révision espacée 2–3 exercices plus tard.
  for (const code of new Set(outcome.errors)) {
    if (!m.reviewQueue.some((r) => r.templateId === outcome.template.id)) {
      m.reviewQueue.push({ templateId: outcome.template.id, dueIn: randInt(rng, ADAPTIVE.reviewDelayMin, ADAPTIVE.reviewDelayMax), code });
    }
  }

  if (sameLevel) {
    m.streak.count += 1;
    if (!outcome.usedHelp) m.streak.noHint += 1;
    slow = outcome.durationSec > ADAPTIVE.slowTimeSec[m.level];
    if (slow) m.extraNeeded = ADAPTIVE.extraExercisesWhenSlow;
    const needed = ADAPTIVE.streakToLevelUp + m.extraNeeded;
    if (m.streak.count >= needed && m.streak.noHint >= ADAPTIVE.minNoHintInStreak) {
      m.streak = { count: 0, noHint: 0 };
      m.extraNeeded = 0;
      if (m.level === 'difficile') {
        finished = !m.completed;
        m.completed = true;
      } else {
        m.level = nextLevel(m.level);
        m.maxLevelReached = maxLevel(m.maxLevelReached, m.level);
        levelUp = true;
      }
    }
  }
  return { model: m, levelUp, finished, slow };
}

/**
 * Choix de l'exercice suivant : d'abord une révision espacée arrivée à échéance,
 * sinon un gabarit qui travaille la compétence la plus faible du niveau.
 */
export function chooseNextTemplate(
  model: LearnerModel,
  templates: ExerciseTemplate[],
  rng: Rng,
): { templateId: string; model: LearnerModel; review: boolean } {
  const m = clone(model);
  const due = m.reviewQueue.find(
    (r) => r.dueIn <= 0 && templates.some((t) => t.id === r.templateId && levelIndex(t.level) <= levelIndex(m.level)),
  );
  if (due) {
    m.reviewQueue = m.reviewQueue.filter((r) => r !== due);
    return { templateId: due.templateId, model: m, review: true };
  }
  // Révisions d'un niveau supérieur (après un retour en arrière) : on les garde pour plus tard.
  let levelTemplates = templates.filter((t) => t.level === m.level);
  // Jamais deux fois de suite le même gabarit (sauf remédiation, gérée ailleurs).
  if (levelTemplates.length > 1) levelTemplates = levelTemplates.filter((t) => t.id !== m.lastTemplateId);
  const comps = [...new Set(levelTemplates.flatMap((t) => t.competences))];
  let target: Competence;
  if (m.focusCompetence && comps.includes(m.focusCompetence)) target = m.focusCompetence;
  else if (rng() < ADAPTIVE.weakestCompetenceBias) {
    const min = Math.min(...comps.map((c) => m.competences[c]));
    target = pick(rng, comps.filter((c) => m.competences[c] === min));
  } else target = pick(rng, comps);
  const candidates = levelTemplates.filter((t) => t.competences.includes(target));
  return { templateId: pick(rng, candidates).id, model: m, review: false };
}

/** Niveau de maîtrise lisible pour une compétence. */
export function masteryBand(score: number): 'low' | 'mid' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}
