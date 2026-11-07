import { newLearnerModel } from '../engine/adaptive';
import { buildDemoDatabase } from './demo';
import { RepositoryError, capitalizeName, newId, normalizeName } from './ids';
import type { Repository } from './repository';
import type { Alert, Attempt, ClassRoom, Database, Settings, Student, TeacherMessage, VideoView } from './types';

const KEY = 'ohmigo:db:v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const copy = <T>(x: T): T => structuredClone(x);

/** Implémentation V1 : toute la base dans une clé localStorage (avec repli en mémoire). */
export class LocalStorageRepository implements Repository {
  private db: Database | null = null;

  private load(): Database {
    if (this.db) return this.db;
    const raw = storage()?.getItem(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Database;
        if (parsed.version === 1 && Array.isArray(parsed.students)) {
          this.db = parsed;
          return parsed;
        }
      } catch {
        // Données corrompues : on repart des données de démo.
      }
    }
    this.db = buildDemoDatabase();
    this.persist();
    return this.db;
  }

  private persist(): void {
    try {
      storage()?.setItem(KEY, JSON.stringify(this.db));
    } catch {
      // Stockage plein ou indisponible (navigation privée) : on garde la base en mémoire.
    }
  }

  async init(): Promise<void> {
    this.load();
  }

  async resetDemo(): Promise<void> {
    this.db = buildDemoDatabase();
    this.persist();
  }

  async getSettings(): Promise<Settings> {
    return copy(this.load().settings);
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.load().settings = copy(settings);
    this.persist();
  }

  async checkTeacherPin(pin: string): Promise<boolean> {
    return pin.trim() === this.load().settings.teacherPin;
  }

  async listClasses(): Promise<ClassRoom[]> {
    return copy(this.load().classes);
  }

  async addClass(room: ClassRoom): Promise<void> {
    const db = this.load();
    const code = room.code.trim().toUpperCase();
    if (!code) throw new RepositoryError('Code de classe vide.');
    if (db.classes.some((c) => c.code === code)) throw new RepositoryError('Ce code de classe existe déjà.');
    db.classes.push({ code, name: room.name.trim() || code });
    this.persist();
  }

  async findOrCreateStudent(firstName: string, lastName: string, classCode: string): Promise<Student> {
    const db = this.load();
    const code = classCode.trim().toUpperCase();
    if (!db.classes.some((c) => c.code === code)) throw new RepositoryError('Code de classe inconnu. Vérifie-le auprès de ton professeur.');
    if (!firstName.trim() || !lastName.trim()) throw new RepositoryError('Indique ton prénom et ton nom.');
    const f = normalizeName(firstName);
    const l = normalizeName(lastName);
    let student = db.students.find((s) => s.classCode === code && normalizeName(s.firstName) === f && normalizeName(s.lastName) === l);
    if (!student) {
      student = {
        id: newId('stu'),
        firstName: capitalizeName(firstName),
        lastName: capitalizeName(lastName),
        classCode: code,
        createdAt: new Date().toISOString(),
        lastActive: null,
        model: newLearnerModel(),
      };
      db.students.push(student);
    }
    student.lastActive = new Date().toISOString();
    this.persist();
    return copy(student);
  }

  async getStudent(id: string): Promise<Student | null> {
    const s = this.load().students.find((x) => x.id === id);
    return s ? copy(s) : null;
  }

  async listStudents(classCode?: string): Promise<Student[]> {
    return copy(this.load().students.filter((s) => !classCode || s.classCode === classCode));
  }

  async saveStudent(student: Student): Promise<void> {
    const db = this.load();
    const i = db.students.findIndex((s) => s.id === student.id);
    if (i < 0) throw new RepositoryError('Élève introuvable.');
    db.students[i] = copy(student);
    this.persist();
  }

  async resetStudentProgress(id: string): Promise<void> {
    const db = this.load();
    const s = db.students.find((x) => x.id === id);
    if (!s) throw new RepositoryError('Élève introuvable.');
    s.model = newLearnerModel();
    db.alerts.filter((a) => a.studentId === id && !a.resolved).forEach((a) => {
      a.resolved = true;
      a.resolvedAt = new Date().toISOString();
    });
    this.persist();
  }

  async addAttempt(attempt: Attempt): Promise<void> {
    this.load().attempts.push(copy(attempt));
    this.persist();
  }

  async listAttempts(filter: { studentId?: string } = {}): Promise<Attempt[]> {
    return copy(this.load().attempts.filter((a) => !filter.studentId || a.studentId === filter.studentId));
  }

  async addAlert(alert: Alert): Promise<void> {
    this.load().alerts.push(copy(alert));
    this.persist();
  }

  async listAlerts(filter: { studentId?: string; activeOnly?: boolean } = {}): Promise<Alert[]> {
    return copy(
      this.load().alerts.filter((a) => (!filter.studentId || a.studentId === filter.studentId) && (!filter.activeOnly || !a.resolved)),
    );
  }

  async resolveAlerts(studentId: string): Promise<void> {
    this.load()
      .alerts.filter((a) => a.studentId === studentId && !a.resolved)
      .forEach((a) => {
        a.resolved = true;
        a.resolvedAt = new Date().toISOString();
      });
    this.persist();
  }

  async addMessage(message: TeacherMessage): Promise<void> {
    this.load().messages.push(copy(message));
    this.persist();
  }

  async listMessages(studentId: string): Promise<TeacherMessage[]> {
    return copy(this.load().messages.filter((m) => m.studentId === studentId));
  }

  async markMessagesRead(studentId: string): Promise<void> {
    this.load()
      .messages.filter((m) => m.studentId === studentId)
      .forEach((m) => (m.read = true));
    this.persist();
  }

  async addVideoView(view: VideoView): Promise<void> {
    this.load().videoViews.push(copy(view));
    this.persist();
  }

  async listVideoViews(filter: { studentId?: string } = {}): Promise<VideoView[]> {
    return copy(this.load().videoViews.filter((v) => !filter.studentId || v.studentId === filter.studentId));
  }
}
