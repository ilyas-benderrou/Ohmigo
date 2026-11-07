import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCurrentStudent } from '../app/hooks';
import { AppShell } from '../components/AppShell';
import { CompetenceBars } from '../components/CompetenceBars';
import { Mascot } from '../components/Logo';
import { Button, Card, LevelBadge, Notice, Spinner, relativeTime } from '../components/ui';
import { LEVEL_LABELS } from '../content/competences';
import { repo } from '../data/repository';
import type { TeacherMessage } from '../data/types';
import { levelIndex } from '../engine/adaptive';
import { LEVELS } from '../engine/types';

export function StudentHome() {
  const { student, loading } = useCurrentStudent();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<TeacherMessage[]>([]);

  useEffect(() => {
    if (!student) return;
    repo.listMessages(student.id).then((m) => setMessages(m.sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  }, [student]);

  if (loading || !student) return <AppShell><Spinner /></AppShell>;
  const m = student.model;
  const unread = messages.filter((x) => !x.read);

  return (
    <AppShell user={`${student.firstName} ${student.lastName} · ${student.classCode}`}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-start gap-4">
              <Mascot size={64} mood={m.completed ? 'cheer' : 'happy'} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-extrabold text-slate-900">Bonjour {student.firstName} !</h1>
                <p className="mt-1 text-slate-600">
                  {!m.introDone
                    ? 'Commence par une courte vidéo d’une minute, puis tu analyseras tes premiers schémas.'
                    : m.completed
                      ? 'Tu as validé les trois niveaux. Tu peux continuer à t’entraîner sur les cas difficiles.'
                      : 'Prêt à continuer ? On reprend là où tu t’étais arrêté.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="lg" onClick={() => navigate(m.introDone ? '/eleve/exercice' : '/eleve/video')}>
                    {m.introDone ? 'Continuer' : 'Commencer'} →
                  </Button>
                  {m.introDone && (
                    <Button variant="secondary" size="lg" onClick={() => navigate('/eleve/video')}>
                      Revoir la vidéo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Ma progression" action={<LevelBadge level={m.level} />}>
            <ol className="grid grid-cols-3 gap-2" aria-label="Niveaux">
              {LEVELS.map((l) => {
                const done = levelIndex(l) < levelIndex(m.level) || (l === 'difficile' && m.completed);
                const current = l === m.level && !m.completed;
                return (
                  <li
                    key={l}
                    className={`rounded-xl p-3 text-center ring-1 ${done ? 'bg-ok-50 ring-ok-100' : current ? 'bg-brand-50 ring-brand-300' : 'bg-slate-50 ring-slate-200'}`}
                    aria-current={current ? 'step' : undefined}
                  >
                    <div className={`text-2xl ${done ? 'text-ok-500' : current ? 'text-brand-600' : 'text-slate-300'}`} aria-hidden="true">
                      {done ? '✓' : current ? '●' : '○'}
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{LEVEL_LABELS[l]}</div>
                    <div className="text-xs text-slate-500">{done ? 'validé' : current ? 'en cours' : 'à venir'}</div>
                  </li>
                );
              })}
            </ol>
            {!m.completed && m.introDone && (
              <p className="mt-3 text-sm text-slate-500">
                Réussis {Math.max(0, 3 + m.extraNeeded - m.streak.count)} exercice(s) de plus d’affilée pour valider ce niveau.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {messages.length > 0 && (
            <Card title={`Messages du professeur${unread.length ? ` (${unread.length} nouveau${unread.length > 1 ? 'x' : ''})` : ''}`}>
              <ul className="space-y-2">
                {messages.slice(0, 3).map((msg) => (
                  <li key={msg.id}>
                    <Notice tone={msg.read ? 'info' : 'current'} title={relativeTime(msg.createdAt)}>
                      {msg.text}
                    </Notice>
                  </li>
                ))}
              </ul>
              {unread.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    await repo.markMessagesRead(student.id);
                    setMessages((ms) => ms.map((x) => ({ ...x, read: true })));
                  }}
                >
                  Marquer comme lu
                </Button>
              )}
            </Card>
          )}
          <Card title="Mes compétences">
            <CompetenceBars competences={m.competences} />
            <Link to="/eleve/bilan" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Voir mon bilan →
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
