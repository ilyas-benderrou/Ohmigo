import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCurrentStudent } from '../app/hooks';
import { AppShell } from '../components/AppShell';
import { CircuitView } from '../components/CircuitView';
import { Mascot } from '../components/Logo';
import { RichText } from '../components/Tex';
import { Button, Card, Notice, Spinner } from '../components/ui';
import { createComprehension } from '../content/templates';
import { renderCircuit } from '../engine/layout';
import { newSeed } from '../engine/rng';
import type { GroupType } from '../engine/types';

/** Question de compréhension après la vidéo : série ou parallèle ? Si faux → revoir le segment concerné. */
export function ComprehensionPage() {
  const { student, loading, save } = useCurrentStudent();
  const navigate = useNavigate();
  const [seed] = useState(newSeed);
  const q = useMemo(() => createComprehension(seed), [seed]);
  const sch = useMemo(() => renderCircuit(q.instance.circuit, q.instance), [q]);
  const [answer, setAnswer] = useState<GroupType | null>(null);

  if (loading || !student) return <AppShell><Spinner /></AppShell>;
  const correct = answer === q.answer;
  const segment = q.answer === 'S' ? 'serie' : 'parallele';

  const choose = async (a: GroupType) => {
    setAnswer(a);
    if (a === q.answer && !student.model.introDone) await save({ ...student, model: { ...student.model, introDone: true } });
  };

  return (
    <AppShell user={`${student.firstName} ${student.lastName}`}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Mascot size={48} mood="think" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Question de compréhension</h1>
            <p className="text-slate-600">
              <RichText text={q.instance.prompt} />
            </p>
          </div>
        </div>
        <Card>
          <CircuitView schematic={sch} label="Schéma de la question de compréhension" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button size="lg" variant="secondary" onClick={() => choose('S')} disabled={answer !== null}>
              En série
            </Button>
            <Button size="lg" variant="secondary" onClick={() => choose('P')} disabled={answer !== null}>
              En parallèle
            </Button>
          </div>
        </Card>
        {answer !== null &&
          (correct ? (
            <Notice tone="ok" title="Exactement !">
              {q.answer === 'S'
                ? 'Le courant n’a qu’un seul chemin : il traverse les résistances l’une après l’autre.'
                : 'Le courant se divise entre les branches, toutes reliées aux deux mêmes nœuds.'}
              <div className="mt-3">
                <Button variant="success" onClick={() => navigate('/eleve/exercice')}>
                  Aux exercices →
                </Button>
              </div>
            </Notice>
          ) : (
            <Notice tone="warn" title="Pas tout à fait.">
              Suis le chemin du courant entre les deux bornes. Revoyons le passage de la vidéo sur le montage {q.answer === 'S' ? 'en série' : 'en parallèle'}.
              <div className="mt-3">
                <Button variant="warn" onClick={() => navigate(`/eleve/video?segment=${segment}`)}>
                  Revoir ce passage (30 s)
                </Button>
              </div>
            </Notice>
          ))}
      </div>
    </AppShell>
  );
}
