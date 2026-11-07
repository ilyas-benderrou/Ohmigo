import type { LearnerModel } from '../engine/adaptive';
import type { Unit } from '../engine/numbers';
import type { Competence, ErrorCode, GroupType, Level } from '../engine/types';

/** Données minimales (élèves mineurs) : prénom, nom, classe. Rien d'autre. */
export interface ClassRoom {
  code: string;
  name: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  classCode: string;
  createdAt: string;
  lastActive: string | null;
  model: LearnerModel;
}

export interface StepLog {
  /** Millisecondes depuis le début de l'exercice. */
  t: number;
  action: 'group' | 'value' | 'special' | 'direct' | 'inverse' | 'hint-request';
  selection?: string[];
  groupType?: GroupType;
  value?: number | null;
  unit?: Unit;
  ok: boolean;
  code?: ErrorCode | null;
  note?: string;
}

export type AttemptOutcome = 'success' | 'remediation' | 'alert' | 'abandoned';

export interface Attempt {
  id: string;
  studentId: string;
  sessionId: string;
  templateId: string;
  level: Level;
  seed: number;
  values: Record<string, number>;
  unit: Unit;
  mode: 'steps' | 'direct';
  remediation: boolean;
  review: boolean;
  steps: StepLog[];
  finalAnswer: number | null;
  errors: ErrorCode[];
  success: boolean;
  outcome: AttemptOutcome;
  hintsUsed: number;
  videosWatched: string[];
  startedAt: string;
  endedAt: string;
  durationSec: number;
  competencesAfter: Record<Competence, number>;
  levelAfter: Level;
}

export interface Alert {
  id: string;
  studentId: string;
  code: ErrorCode;
  count: number;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface TeacherMessage {
  id: string;
  studentId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface VideoView {
  id: string;
  studentId: string;
  videoId: string;
  at: string;
  /** Vue imposée par le système (micro-vidéo) ou revue volontairement. */
  reason: 'intro' | 'remediation' | 'replay';
}

export interface Settings {
  teacherPin: string;
}

export interface Database {
  version: 1;
  classes: ClassRoom[];
  students: Student[];
  attempts: Attempt[];
  alerts: Alert[];
  messages: TeacherMessage[];
  videoViews: VideoView[];
  settings: Settings;
}
