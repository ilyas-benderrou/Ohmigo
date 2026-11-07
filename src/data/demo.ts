import { DEFAULT_TEACHER_PIN } from '../config/adaptive';
import { ERRORS } from '../content/errors';
import { TEMPLATES, createInstance, getTemplate } from '../content/templates';
import { segmentVideoId } from '../content/videos';
import { type LearnerModel, chooseNextTemplate, completeExercise, newLearnerModel, registerError } from '../engine/adaptive';
import { toNumber } from '../engine/fraction';
import { stateResistors } from '../engine/reduction';
import { type Rng, mulberry32, pick, randInt } from '../engine/rng';
import type { ErrorCode, Level } from '../engine/types';
import type { Alert, Attempt, Database, StepLog, Student, TeacherMessage, VideoView } from './types';

/**
 * Données de démonstration : 1 classe, 8 élèves fictifs à l'historique varié.
 * L'historique est obtenu en simulant le vrai moteur adaptatif (déterministe : graine fixe),
 * ce qui garantit des données cohérentes avec les règles de l'application.
 */
export const DEMO_CLASS = { code: '1STE-A', name: '1re année Bac STE – groupe A' };

interface Profile {
  first: string;
  last: string;
  exercises: number;
  skill: Record<Level, number>;
  errors: ErrorCode[];
  /** Séquence forcée en fin d'historique (ex. 3 échecs sur la même erreur → alerte). */
  tail?: { templateId: string; code: ErrorCode }[];
  /** Dernière activité il y a… (heures). */
  lastActiveHoursAgo: number;
}

const PROFILES: Profile[] = [
  {
    first: 'Youssef',
    last: 'Amrani',
    exercises: 20,
    skill: { facile: 0.92, moyen: 0.85, difficile: 0.6 },
    errors: ['E6', 'E9'],
    tail: [
      { templateId: 'D1', code: 'E6' },
      { templateId: 'D1', code: 'E6' },
      { templateId: 'D1', code: 'E6' },
    ],
    lastActiveHoursAgo: 3,
  },
  { first: 'Salma', last: 'Benali', exercises: 24, skill: { facile: 0.97, moyen: 0.92, difficile: 0.85 }, errors: ['E9'], lastActiveHoursAgo: 20 },
  { first: 'Adam', last: 'El Idrissi', exercises: 14, skill: { facile: 0.35, moyen: 0.3, difficile: 0.3 }, errors: ['E2', 'E3'], lastActiveHoursAgo: 28 },
  { first: 'Imane', last: 'Tazi', exercises: 18, skill: { facile: 0.85, moyen: 0.55, difficile: 0.45 }, errors: ['E5', 'E9'], lastActiveHoursAgo: 6 },
  {
    first: 'Omar',
    last: 'Chraibi',
    exercises: 8,
    skill: { facile: 0.5, moyen: 0.5, difficile: 0.5 },
    errors: ['E1', 'E0'],
    tail: [
      { templateId: 'F4', code: 'E1' },
      { templateId: 'F4', code: 'E1' },
      { templateId: 'F4', code: 'E1' },
    ],
    lastActiveHoursAgo: 50,
  },
  { first: 'Hiba', last: 'Alaoui', exercises: 22, skill: { facile: 0.93, moyen: 0.88, difficile: 0.7 }, errors: ['E7', 'E11'], lastActiveHoursAgo: 2 },
  { first: 'Mehdi', last: 'Bennani', exercises: 12, skill: { facile: 0.8, moyen: 0.4, difficile: 0.4 }, errors: ['E5', 'E4'], lastActiveHoursAgo: 75 },
  { first: 'Nour', last: 'Fassi', exercises: 3, skill: { facile: 0.7, moyen: 0.6, difficile: 0.5 }, errors: ['E2'], lastActiveHoursAgo: 1 },
];

const HOUR = 3600_000;

function syntheticSteps(rng: Rng, nResistors: number, error: ErrorCode | null, durationSec: number): StepLog[] {
  const steps: StepLog[] = [];
  const n = Math.max(1, nResistors - 1);
  const dt = (durationSec * 1000) / (2 * n + (error ? 1 : 0));
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += dt;
    steps.push({ t: Math.round(t), action: 'group', groupType: pick(rng, ['S', 'P'] as const), ok: true });
    if (i === 0 && error) {
      t += dt;
      steps.push({ t: Math.round(t), action: 'value', ok: false, code: error });
    }
    t += dt;
    steps.push({ t: Math.round(t), action: 'value', ok: true });
  }
  return steps;
}

function simulate(profile: Profile, index: number, now: number, counter: { n: number }) {
  const rng = mulberry32(1000 + index * 97);
  const id = (p: string) => `${p}_demo${++counter.n}`;
  const studentId = `stu_demo_${index + 1}`;
  let model: LearnerModel = { ...newLearnerModel(), introDone: true };
  const attempts: Attempt[] = [];
  const alerts: Alert[] = [];
  const views: VideoView[] = [];

  const end = now - profile.lastActiveHoursAgo * HOUR;
  const start = end - Math.min(13, 2 + profile.exercises / 2) * 24 * HOUR;
  const total = profile.exercises + (profile.tail?.length ?? 0);
  let sessionId = id('ses');
  views.push({ id: id('vid'), studentId, videoId: segmentVideoId('serie'), at: new Date(start - 10 * 60_000).toISOString(), reason: 'intro' });
  views.push({ id: id('vid'), studentId, videoId: segmentVideoId('parallele'), at: new Date(start - 9 * 60_000).toISOString(), reason: 'intro' });

  let remediationOf: string | null = null;
  let previousDay = -1;
  let tailDone = false;
  for (let i = 0; i < total; i++) {
    if (i >= profile.exercises && tailDone) break;
    const forced = i >= profile.exercises ? profile.tail![i - profile.exercises] : null;
    let templateId: string;
    let review = false;
    if (forced) templateId = forced.templateId;
    else if (remediationOf) templateId = remediationOf;
    else {
      const next = chooseNextTemplate(model, TEMPLATES, rng);
      model = next.model;
      templateId = next.templateId;
      review = next.review;
    }
    const remediation = remediationOf === templateId;
    remediationOf = null;
    const tpl = getTemplate(templateId);
    const seed = randInt(rng, 1, 2 ** 30);
    const inst = createInstance(templateId, seed);
    const startedAt = start + ((end - start) * i) / Math.max(1, total - 1);
    const day = Math.floor(startedAt / (24 * HOUR));
    if (day !== previousDay) {
      sessionId = id('ses');
      previousDay = day;
    }

    const errors: ErrorCode[] = [];
    let hints = 0;
    const videos: string[] = [];
    let outcome: Attempt['outcome'] = 'success';
    const makesError = forced !== null || rng() > profile.skill[tpl.level];
    if (makesError) {
      const preferred = tpl.testsErrors.filter((c) => profile.errors.includes(c));
      const code = forced?.code ?? (preferred.length && rng() < 0.75 ? pick(rng, preferred) : pick(rng, tpl.testsErrors.filter((c) => c !== 'E0')));
      const r = registerError(model, code);
      model = r.model;
      errors.push(code);
      if (r.action === 'hint') hints += 1;
      else if (r.action === 'video') {
        const video = ERRORS[code].video;
        if (video) {
          videos.push(video.id);
          views.push({ id: id('vid'), studentId, videoId: video.id, at: new Date(startedAt + 60_000).toISOString(), reason: 'remediation' });
        }
        outcome = 'remediation';
        remediationOf = templateId;
      } else {
        outcome = 'alert';
        if (forced) tailDone = true;
        alerts.push({ id: id('alr'), studentId, code, count: r.count, createdAt: new Date(startedAt + 90_000).toISOString(), resolved: false });
      }
    }
    const baseDuration = { facile: 70, moyen: 130, difficile: 190 }[tpl.level];
    const durationSec = Math.round(baseDuration * (0.6 + rng() * 0.9) + (errors.length ? 60 : 0));
    const success = outcome === 'success';
    const res = completeExercise(model, { template: tpl, success, usedHelp: hints > 0 || videos.length > 0, durationSec, errors }, rng);
    model = res.model;
    const nRes = stateResistors(inst.circuit).length;
    attempts.push({
      id: id('att'),
      studentId,
      sessionId,
      templateId,
      level: tpl.level,
      seed,
      values: inst.values,
      unit: inst.unit,
      mode: 'steps',
      remediation,
      review,
      steps: syntheticSteps(rng, nRes, errors[0] ?? null, durationSec),
      finalAnswer: success ? toNumber(inst.answer) : null,
      errors,
      success,
      outcome,
      hintsUsed: hints,
      videosWatched: videos,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(startedAt + durationSec * 1000).toISOString(),
      durationSec,
      competencesAfter: { ...model.competences },
      levelAfter: model.level,
    });
  }

  // Les alertes anciennes ont déjà été traitées par le professeur ; seule la dernière reste active.
  alerts.slice(0, -1).forEach((a) => {
    a.resolved = true;
    a.resolvedAt = new Date(new Date(a.createdAt).getTime() + 20 * HOUR).toISOString();
  });

  const student: Student = {
    id: studentId,
    firstName: profile.first,
    lastName: profile.last,
    classCode: DEMO_CLASS.code,
    createdAt: new Date(start - 15 * 60_000).toISOString(),
    lastActive: attempts.length ? attempts[attempts.length - 1].endedAt : null,
    model,
  };
  return { student, attempts, alerts, views };
}

export function buildDemoDatabase(now = Date.now()): Database {
  const counter = { n: 0 };
  const db: Database = {
    version: 1,
    classes: [DEMO_CLASS],
    students: [],
    attempts: [],
    alerts: [],
    messages: [],
    videoViews: [],
    settings: { teacherPin: DEFAULT_TEACHER_PIN },
  };
  PROFILES.forEach((p, i) => {
    const s = simulate(p, i, now, counter);
    db.students.push(s.student);
    db.attempts.push(...s.attempts);
    db.alerts.push(...s.alerts);
    db.videoViews.push(...s.views);
  });
  const adam = db.students.find((s) => s.firstName === 'Adam');
  if (adam) {
    const msg: TeacherMessage = {
      id: 'msg_demo_1',
      studentId: adam.id,
      text: 'Bravo pour tes efforts ! Revois le passage de la vidéo sur le montage en parallèle avant de continuer.',
      createdAt: new Date(now - 26 * HOUR).toISOString(),
      read: false,
    };
    db.messages.push(msg);
  }
  return db;
}
