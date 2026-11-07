import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { newId } from '../data/ids';

/** Session de l'utilisateur connecté (gardée dans le navigateur, sans mot de passe en V1). */
export type Session =
  | { role: 'student'; studentId: string; sessionId: string; startedAt: string }
  | { role: 'teacher'; startedAt: string };

const KEY = 'ohmigo:session';

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : la session reste en mémoire.
  }
}

interface AuthValue {
  session: Session | null;
  loginStudent(studentId: string): void;
  loginTeacher(): void;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const update = useCallback((s: Session | null) => {
    writeSession(s);
    setSession(s);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loginStudent: (studentId) =>
        update({ role: 'student', studentId, sessionId: newId('ses'), startedAt: new Date().toISOString() }),
      loginTeacher: () => update({ role: 'teacher', startedAt: new Date().toISOString() }),
      logout: () => update(null),
    }),
    [session, update],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
}

export function useStudentSession() {
  const { session } = useAuth();
  return session?.role === 'student' ? session : null;
}
