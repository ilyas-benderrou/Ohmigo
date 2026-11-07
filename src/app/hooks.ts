import { useCallback, useEffect, useState } from 'react';
import { repo } from '../data/repository';
import type { Student } from '../data/types';
import { useStudentSession } from './auth';

/** Élève connecté, rechargé depuis le repository. */
export function useCurrentStudent() {
  const session = useStudentSession();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!session) return null;
    const s = await repo.getStudent(session.studentId);
    setStudent(s);
    setLoading(false);
    return s;
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (s: Student) => {
    const updated = { ...s, lastActive: new Date().toISOString() };
    await repo.saveStudent(updated);
    setStudent(updated);
    return updated;
  }, []);

  return { student, loading, reload, save, session };
}
