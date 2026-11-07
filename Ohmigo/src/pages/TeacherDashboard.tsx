import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { ErrorBarChart } from '../components/charts';
import { CompetenceCells } from '../components/CompetenceBars';
import { Button, Card, LevelBadge, Notice, Spinner, relativeTime } from '../components/ui';
import { ERRORS } from '../content/errors';
import { attemptsCsv, classErrorFrequency, downloadText, summaryCsv } from '../data/analytics';
import { repo } from '../data/repository';
import type { Alert, Attempt, ClassRoom, Student, VideoView } from '../data/types';

interface Data {
  classes: ClassRoom[];
  students: Student[];
  attempts: Attempt[];
  alerts: Alert[];
  views: VideoView[];
}

const inputClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [classCode, setClassCode] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    const [classes, students, attempts, alerts, views] = await Promise.all([
      repo.listClasses(),
      repo.listStudents(),
      repo.listAttempts(),
      repo.listAlerts({ activeOnly: true }),
      repo.listVideoViews(),
    ]);
    setData({ classes, students, attempts, alerts, views });
    setClassCode((c) => c || classes[0]?.code || '');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(
    () => (data?.students ?? []).filter((s) => s.classCode === classCode).sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')),
    [data, classCode],
  );

  if (!data) return <AppShell wide><Spinner /></AppShell>;

  const ids = new Set(students.map((s) => s.id));
  const attempts = data.attempts.filter((a) => ids.has(a.studentId));
  const alerts = data.alerts.filter((a) => ids.has(a.studentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const freq = classErrorFrequency(students, attempts);
  const byStudent = new Map(students.map((s) => [s.id, s]));
  const stamp = new Date().toISOString().slice(0, 10);
  const top = [...freq].sort((a, b) => b.percent - a.percent)[0];

  return (
    <AppShell wide user="Espace professeur">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Tableau de bord</h1>
          <div className="mt-1 flex items-center gap-2 text-slate-600">
            <label htmlFor="class" className="text-sm">
              Classe
            </label>
            <select id="class" className={inputClass} value={classCode} onChange={(e) => setClassCode(e.target.value)}>
              {data.classes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadText(`ohmigo_${classCode}_tentatives_${stamp}.csv`, attemptsCsv(students, attempts))}>
            ⬇ Export CSV des tentatives
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadText(`ohmigo_${classCode}_synthese_${stamp}.csv`, summaryCsv(students, attempts, data.views))}>
            ⬇ Export CSV de synthèse
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/prof/exercices')}>
            Banque d’exercices
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
            ⚙ Réglages
          </Button>
        </div>
      </div>

      {showSettings && <SettingsPanel onChanged={load} />}

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <Card title={`Alertes${alerts.length ? ` (${alerts.length})` : ''}`}>
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun élève bloqué pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => {
                  const s = byStudent.get(a.studentId);
                  if (!s) return null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-50 p-3 ring-1 ring-warn-100">
                      <span className="text-sm text-slate-800">
                        <strong>{s.firstName} {s.lastName}</strong> bloqué sur <strong>{a.code}</strong> ({ERRORS[a.code].name.toLowerCase()}) – {a.count} échecs ·{' '}
                        <span className="text-slate-500">{relativeTime(a.createdAt)}</span>
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/prof/eleve/${s.id}`)}>
                          Voir la fiche
                        </Button>
                        <Button
                          size="sm"
                          variant="warn"
                          onClick={async () => {
                            await unblock(s);
                            await load();
                          }}
                        >
                          Débloquer
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`Élèves (${students.length})`}>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 sm:px-2">Élève</th>
                    <th className="px-2 py-2">Niveau</th>
                    <th className="px-2 py-2">Compétences C1–C6</th>
                    <th className="px-2 py-2">Dernière activité</th>
                    <th className="px-2 py-2">Alerte</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const alert = alerts.find((a) => a.studentId === s.id);
                    return (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 sm:px-2">
                          <Link to={`/prof/eleve/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                            {s.lastName} {s.firstName}
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          <LevelBadge level={s.model.level} />
                          {s.model.completed && <span className="ml-1 text-xs font-semibold text-ok-700">✓ validée</span>}
                        </td>
                        <td className="px-2 py-2">
                          <CompetenceCells competences={s.model.competences} />
                        </td>
                        <td className="px-2 py-2 text-slate-600">{relativeTime(s.lastActive)}</td>
                        <td className="px-2 py-2">
                          {alert ? (
                            <span className="rounded-full bg-warn-100 px-2 py-0.5 text-xs font-semibold text-warn-700">⚠ {alert.code}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">Ordre alphabétique : aucun classement entre élèves.</p>
          </Card>
        </div>

        <Card title="Erreurs fréquentes de la classe">
          {top && top.percent > 0 && (
            <p className="mb-3 text-sm text-slate-600">
              La plus répandue : <strong>{top.code}</strong> ({ERRORS[top.code].name.toLowerCase()}) chez {top.percent} % des élèves.
            </p>
          )}
          <ErrorBarChart data={freq} />
          <p className="mt-3 text-xs text-slate-400">% des élèves de la classe ayant commis l’erreur au moins une fois.</p>
        </Card>
      </div>
    </AppShell>
  );
}

/** Débloquer : alertes traitées et compteurs d'erreurs remis à zéro (l'élève repart sereinement). */
export async function unblock(s: Student): Promise<void> {
  await repo.resolveAlerts(s.id);
  await repo.saveStudent({ ...s, model: { ...s.model, errorStreaks: {}, focusCompetence: null } });
}

function SettingsPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const savePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) {
      setMsg({ tone: 'warn', text: 'Le PIN doit contenir 4 à 8 chiffres.' });
      return;
    }
    await repo.saveSettings({ ...(await repo.getSettings()), teacherPin: pin });
    setPin('');
    setMsg({ tone: 'ok', text: 'Nouveau PIN enregistré.' });
  };

  const addClass = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await repo.addClass({ code, name });
      setCode('');
      setName('');
      setMsg({ tone: 'ok', text: 'Classe ajoutée. Les élèves peuvent se connecter avec ce code.' });
      await onChanged();
    } catch (err) {
      setMsg({ tone: 'warn', text: err instanceof Error ? err.message : 'Erreur.' });
    }
  };

  return (
    <Card title="Réglages" className="mb-5">
      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={savePin} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="pin">
            Changer le code PIN professeur
          </label>
          <div className="flex gap-2">
            <input id="pin" className={`${inputClass} flex-1`} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Nouveau PIN" />
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
        <form onSubmit={addClass} className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Ajouter une classe</span>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputClass} w-28 uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="1STM-B" aria-label="Code de la classe" required />
            <input className={`${inputClass} min-w-0 flex-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (facultatif)" aria-label="Nom de la classe" />
            <Button type="submit" size="sm">
              Ajouter
            </Button>
          </div>
        </form>
      </div>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </Card>
  );
}
