import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCurrentStudent } from '../app/hooks';
import { AppShell } from '../components/AppShell';
import { CompetenceBars } from '../components/CompetenceBars';
import { Mascot } from '../components/Logo';
import { Button, Card, Spinner, formatDuration } from '../components/ui';
import { COMPETENCE_LABELS, LEVEL_LABELS } from '../content/competences';
import { ERRORS } from '../content/errors';
import { type SessionBilan, sessionBilan } from '../data/analytics';
import { repo } from '../data/repository';

/** Bilan de fin de session : niveaux validés, compétences, erreurs corrigées. Pas de note, pas de classement. */
export function BilanPage() {
  const { student, loading, session } = useCurrentStudent();
  const navigate = useNavigate();
  const [bilan, setBilan] = useState<SessionBilan | null>(null);

  useEffect(() => {
    if (!student || !session) return;
    repo.listAttempts({ studentId: student.id }).then((all) => setBilan(sessionBilan(all.filter((a) => a.sessionId === session.sessionId))));
  }, [student, session]);

  if (loading || !student || !bilan) return <AppShell><Spinner /></AppShell>;
  const remaining = bilan.errorsMade.filter((c) => !bilan.errorsCorrected.includes(c));

  return (
    <AppShell user={`${student.firstName} ${student.lastName}`}>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-4">
          <Mascot size={64} mood="cheer" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Bilan de ta séance</h1>
            <p className="text-slate-600">
              {bilan.exercises === 0
                ? 'Tu n’as pas encore fait d’exercice pendant cette séance.'
                : `${bilan.exercises} exercice${bilan.exercises > 1 ? 's' : ''} en ${formatDuration(bilan.timeSec)}, ${
                    bilan.successes === 0 ? 'aucun encore terminé jusqu’au bout' : `dont ${bilan.successes} terminé${bilan.successes > 1 ? 's' : ''} jusqu’au bout`
                  }.`}
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Niveaux">
            {bilan.levelsValidated.length || student.model.completed ? (
              <ul className="space-y-2">
                {bilan.levelsValidated.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-ok-700">
                    <span aria-hidden="true">✓</span> Niveau {LEVEL_LABELS[l].toLowerCase()} validé pendant cette séance
                  </li>
                ))}
                {student.model.completed && (
                  <li className="flex items-center gap-2 text-ok-700">
                    <span aria-hidden="true">★</span> Leçon complète validée
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-slate-600">Tu travailles le niveau {LEVEL_LABELS[student.model.level].toLowerCase()}. Continue : chaque exercice réussi te rapproche du suivant.</p>
            )}
            {bilan.competences.length > 0 && (
              <p className="mt-3 text-sm text-slate-500">
                Compétences travaillées : {bilan.competences.map((c) => `${c} (${COMPETENCE_LABELS[c].toLowerCase()})`).join(', ')}.
              </p>
            )}
          </Card>

          <Card title="Erreurs corrigées">
            {bilan.errorsCorrected.length === 0 && remaining.length === 0 ? (
              <p className="text-slate-600">Aucune erreur pendant cette séance. Bravo !</p>
            ) : (
              <ul className="space-y-2">
                {bilan.errorsCorrected.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-0.5 text-ok-500" aria-hidden="true">✓</span>
                    <span>
                      <strong>{ERRORS[c].name}</strong> — corrigée
                    </span>
                  </li>
                ))}
                {remaining.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-0.5 text-warn-500" aria-hidden="true">↻</span>
                    <span>
                      <strong>{ERRORS[c].name}</strong> — à retravailler la prochaine fois
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Mes compétences">
          <CompetenceBars competences={student.model.competences} />
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/eleve/exercice')}>Continuer à m’entraîner</Button>
          <Button variant="secondary" onClick={() => navigate('/eleve')}>
            Accueil
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
