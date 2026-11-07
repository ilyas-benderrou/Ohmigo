import { LocalStorageRepository } from './localStorageRepository';
import type { Alert, Attempt, ClassRoom, Settings, Student, TeacherMessage, VideoView } from './types';

/**
 * Couche d'accès aux données (abstraite).
 * V1 : localStorage + données de démo (aucune configuration).
 * V2 : Firebase (Auth + Firestore) — il suffira d'écrire une autre implémentation de cette interface
 * et de la renvoyer dans `createRepository()`.
 */
export interface Repository {
  init(): Promise<void>;
  resetDemo(): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  checkTeacherPin(pin: string): Promise<boolean>;

  listClasses(): Promise<ClassRoom[]>;
  addClass(room: ClassRoom): Promise<void>;

  /** Connexion élève : prénom + nom + code de classe (crée l'élève à la première connexion). */
  findOrCreateStudent(firstName: string, lastName: string, classCode: string): Promise<Student>;
  getStudent(id: string): Promise<Student | null>;
  listStudents(classCode?: string): Promise<Student[]>;
  saveStudent(student: Student): Promise<void>;
  /** Réinitialise la progression (le modèle) ; l'historique est conservé pour l'expérimentation. */
  resetStudentProgress(id: string): Promise<void>;

  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(filter?: { studentId?: string }): Promise<Attempt[]>;

  addAlert(alert: Alert): Promise<void>;
  listAlerts(filter?: { studentId?: string; activeOnly?: boolean }): Promise<Alert[]>;
  resolveAlerts(studentId: string): Promise<void>;

  addMessage(message: TeacherMessage): Promise<void>;
  listMessages(studentId: string): Promise<TeacherMessage[]>;
  markMessagesRead(studentId: string): Promise<void>;

  addVideoView(view: VideoView): Promise<void>;
  listVideoViews(filter?: { studentId?: string }): Promise<VideoView[]>;
}

export function createRepository(): Repository {
  return new LocalStorageRepository();
}

/** Instance unique utilisée par l'application. */
export const repo: Repository = createRepository();

export { newId, RepositoryError } from './ids';
