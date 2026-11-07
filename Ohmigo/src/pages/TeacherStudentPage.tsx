import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { LevelLegend, ProgressChart } from '../components/charts';
import { CompetenceBars } from '../components/CompetenceBars';
import { Button, Card, LevelBadge, Notice, Spinner, formatDate, formatDuration, relativeTime } from '../components/ui';
import { LEVEL_LABELS } from '../content/competences';
import { ERRORS } from '../content/errors';
import { getTemplate } from '../content/templates';
import { progressSeries, studentSummary } from '../data/analytics';
import { newId, repo } from '../data/repository';
import type { Alert, Attempt, Student, TeacherMessage, VideoView } from '../data/types';
import { levelIndex, nextLevel, previousLevel } from '../engine/adaptive';
import { unblock } from './TeacherDashboard';

const OUTCOME_LABEL: Record<Attempt['outcome'], { text: string; cls: string }> = {
  success: { text: 'Réussi', cls: 'bg-ok-100 text-ok-700' },
  remediation: { text: 'Remédiation', cls: 'bg-yellow-100 text-yellow-800' },
  alert: { text: 'Alerte', cls: 'bg-warn-100 text-warn-700' },
  abandoned: { text: 'Abandonné', cls: 'bg-slate-100 text-slate-600' },
};

export function TeacherStudentPage() {
  const { id = '' } = useParams();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [views, setViews] = useState<VideoView[]>([]);
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, at, al, v, m] = await Promise.all([
      repo.getStudent(id),
      repo.listAttempts({ studentId: id }),
      repo.listAlerts({ studentId: id }),
      repo.listVideoViews({ studentId: id }),
      repo.listMessages(id),
    ]);
    setStudent(s);
    setAttempts(at.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    setAlerts(al.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setViews(v);
    setMessages(m.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (student === undefined) return <AppShell wide><Spinner /></AppShell>;
  if (student === null)
    return (
      <AppShell wide>
        <Notice tone="warn">Élève introuvable.</Notice>
      </AppShell>
    );

  const m = student.model;
  const summary = studentSummary(attempts, views);
  const active = alerts.filter((a) => !a.resolved);
  const done = (msg: string) => {
    setNotice(msg);
    void load();
  };

  const setLevel = async (dir: 1 | -1) => {
    const level = dir === 1 ? nextLevel(m.level) : previousLevel(m.level);
    await repo.saveStudent({
      ...student,
      model: {
        ...m,
        level,
        maxLevelReached: levelIndex(level) > levelIndex(m.maxLevelReached) ? level : m.maxLevelReached,
        introDone: true,
        streak: { count: 0, noHint: 0 },
        extraNeeded: 0,
        focusCompetence: null,
      },
    });
    done(`${student.firstName} passe au niveau ${LEVEL_LABELS[level].toLowerCase()}.`);
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await repo.addMessage({ id: newId('msg'), studentId: student.id, text: text.trim(), createdAt: new Date().toISOString(), read: false });
    setText('');
    done('Message envoyé : il s’affichera sur l’accueil de l’élève.');
  };

  return (
    <AppShell wide user="Espace professeur">
      <Link to="/prof" className="text-sm font-semibold text-brand-600 hover:underline">
        ← Tableau de bord
      </Link>
      <div className="mb-5 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">
          {student.firstName} {student.lastName}
        </h1>
        <span className="text-slate-500">{student.classCode}</span>
        <LevelBadge level={m.level} />
        {m.completed && <span className="text-sm font-semibold text-ok-700">✓ Leçon validée</span>}
        <span className="text-sm text-slate-500">Dernière activité : {relativeTime(student.lastActive)}</span>
      </div>

      {notice && (
        <div className="mb-4">
          <Notice tone="ok">{notice}</Notice>
        </div>
      )}

      {active.map((a) => (
        <div key={a.id} className="mb-4">
          <Notice tone="warn" title={`Bloqué sur ${a.code} (${ERRORS[a.code].name.toLowerCase()}) – ${a.count} échecs`}>
            Alerte levée {relativeTime(a.createdAt)}. L’élève est revenu au niveau précédent pour consolider la compétence concernée.
          </Notice>
        </div>
      ))}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Card title="Actions">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="warn"
                size="sm"
                disabled={active.length === 0 && Object.values(m.errorStreaks).every((v) => !v)}
                onClick={async () => {
                  await unblock(student);
                  done('Élève débloqué : alertes traitées et compteurs d’erreurs remis à zéro.');
                }}
              >
                Débloquer
              </Button>
              <Button variant="secondary" size="sm" disabled={m.level === 'difficile'} onClick={() => setLevel(1)}>
                Niveau suivant
              </Button>
              <Button variant="secondary" size="sm" disabled={m.level === 'facile'} onClick={() => setLevel(-1)}>
                Niveau précédent
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!window.confirm(`Réinitialiser la progression de ${student.firstName} ? L’historique des tentatives est conservé.`)) return;
                  await repo.resetStudentProgress(student.id);
                  done('Progression réinitialisée.');
                }}
              >
                Réinitialiser la progression
              </Button>
            </div>
            <form onSubmit={sendMessage} className="mt-4 space-y-2">
              <label htmlFor="msg" className="block text-sm font-medium text-slate-700">
                Laisser un message à l’élève
              </label>
              <textarea
                id="msg"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="Ex. Revois la vidéo sur les courts-circuits, puis réessaie."
              />
              <Button type="submit" size="sm" disabled={!text.trim()}>
                Envoyer
              </Button>
            </form>
            {messages.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {messages.slice(0, 3).map((msg) => (
                  <li key={msg.id}>
                    <span className="text-slate-400">{relativeTime(msg.createdAt)} · {msg.read ? 'lu' : 'non lu'} —</span> {msg.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Compétences">
            <CompetenceBars competences={m.competences} compact />
          </Card>

          <Card title="En résumé">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Tentatives" value={summary.attempts} />
              <Stat label="Exercices terminés" value={`${summary.successes} (${summary.successRate} %)`} />
              <Stat label="Temps passé" value={formatDuration(summary.timeSec)} />
              <Stat label="Indices utilisés" value={summary.hints} />
              <Stat label="Vidéos revues" value={summary.videosReplayed} />
              <Stat label="Micro-vidéos de remédiation" value={summary.remediationVideos} />
            </dl>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700">Erreurs répétées</h3>
            {summary.errorCounts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune erreur enregistrée.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {summary.errorCounts.map((e) => (
                  <li key={e.code} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${e.count >= 3 ? 'bg-warn-100 text-warn-700' : 'bg-slate-100 text-slate-700'}`} title={ERRORS[e.code].name}>
                    {e.code} · {ERRORS[e.code].name} × {e.count}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Courbe de progression" action={<LevelLegend />}>
            <ProgressChart series={progressSeries(attempts)} />
          </Card>

          <Card title="Historique des tentatives">
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 sm:px-2">Date</th>
                    <th className="px-2 py-2">Exercice</th>
                    <th className="px-2 py-2">Résultat</th>
                    <th className="px-2 py-2">Erreurs</th>
                    <th className="px-2 py-2">Durée</th>
                    <th className="px-2 py-2">Aides</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <Fragment key={a.id}>
                      <tr className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600 sm:px-2">{formatDate(a.startedAt)}</td>
                        <td className="px-2 py-2">
                          <button type="button" className="text-left font-semibold text-slate-800" aria-expanded={open === a.id}>
                            {a.templateId}
                          </button>
                          <span className="ml-1 text-xs text-slate-500">
                            {LEVEL_LABELS[a.level]}
                            {a.remediation ? ' · remédiation' : ''}
                            {a.review ? ' · révision' : ''}
                            {a.mode === 'direct' ? ' · directe' : ''}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_LABEL[a.outcome].cls}`}>{OUTCOME_LABEL[a.outcome].text}</span>
                        </td>
                        <td className="px-2 py-2 text-slate-700">{a.errors.join(', ') || '—'}</td>
                        <td className="px-2 py-2 tabular-nums text-slate-600">{formatDuration(a.durationSec)}</td>
                        <td className="px-2 py-2 text-slate-600">
                          {a.hintsUsed ? `${a.hintsUsed} indice${a.hintsUsed > 1 ? 's' : ''}` : ''}
                          {a.videosWatched.length ? ` ${a.videosWatched.length} vidéo` : ''}
                          {!a.hintsUsed && !a.videosWatched.length ? '—' : ''}
                        </td>
                      </tr>
                      {open === a.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-3 text-xs text-slate-600 sm:px-3">
                            <p>
                              <strong>{getTemplate(a.templateId).title}</strong> — valeurs :{' '}
                              {Object.entries(a.values)
                                .map(([k, v]) => `${k} = ${a.unit === 'kΩ' ? `${v / 1000} kΩ` : `${v} Ω`}`)
                                .join(', ')}
                            </p>
                            <ol className="mt-2 list-decimal space-y-0.5 pl-5">
                              {a.steps.map((st, i) => (
                                <li key={i}>
                                  {(st.t / 1000).toFixed(0)} s · {stepText(st)} {st.ok ? '✓' : st.code ? `✗ ${st.code}` : '✗'}
                                </li>
                              ))}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {attempts.length === 0 && <p className="px-2 py-4 text-sm text-slate-500">Aucune tentative pour le moment.</p>}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function stepText(st: Attempt['steps'][number]): string {
  const sel = st.selection?.length ? st.selection.join(', ') : '';
  const type = st.groupType === 'S' ? 'série' : st.groupType === 'P' ? 'parallèle' : '';
  switch (st.action) {
    case 'group':
      return `groupe ${sel} ${type ? `en ${type}` : ''}`.trim();
    case 'value':
      return `valeur ${st.value ?? ''} ${st.unit ?? ''} ${sel ? `pour ${sel}` : ''}`.trim();
    case 'special':
      return `action spéciale (${st.note}) ${sel}`;
    case 'direct':
      return `réponse directe ${st.value ?? ''} ${st.unit ?? ''}`;
    case 'inverse':
      return `${st.note} : ${st.value ?? ''} ${st.unit ?? ''}`;
    case 'hint-request':
      return 'indice demandé';
  }
}
