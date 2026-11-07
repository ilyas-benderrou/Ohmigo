import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppShell } from '../components/AppShell';
import { CircuitView } from '../components/CircuitView';
import { RichText } from '../components/Tex';
import { Button, Card, LevelBadge } from '../components/ui';
import { ERRORS } from '../content/errors';
import { TEMPLATES, createInstance } from '../content/templates';
import type { ExerciseTemplate } from '../engine/generate';
import { renderCircuit } from '../engine/layout';
import { formatOhms } from '../engine/numbers';
import { newSeed } from '../engine/rng';

/** Banque d'exercices : aperçu de chaque gabarit avec une instance aléatoire (réservé au professeur). */
export function TeacherBankPage() {
  return (
    <AppShell wide user="Espace professeur">
      <Link to="/prof" className="text-sm font-semibold text-brand-600 hover:underline">
        ← Tableau de bord
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold text-slate-900">Banque d’exercices</h1>
      <p className="mb-5 text-slate-600">
        Chaque gabarit génère des valeurs aléatoires à chaque tentative, avec un résultat « propre ». Les élèves ne voient jamais la description du montage.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </AppShell>
  );
}

function TemplateCard({ template }: { template: ExerciseTemplate }) {
  const [seed, setSeed] = useState(newSeed);
  const inst = useMemo(() => createInstance(template.id, seed), [template.id, seed]);
  const sch = useMemo(() => renderCircuit(inst.circuit, inst), [inst]);
  return (
    <Card
      title={
        <span>
          {template.id} · <span className="font-semibold text-slate-600">{template.title}</span>
        </span>
      }
      action={<LevelBadge level={template.level} />}
    >
      <p className="mb-2 text-sm text-slate-600">
        <RichText text={inst.prompt} />
      </p>
      <CircuitView schematic={sch} label={`Exemple du gabarit ${template.id}`} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-700">
          Réponse : <strong>{formatOhms(inst.answer, inst.unit)}</strong> · Compétences : {template.competences.join(', ')}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setSeed(newSeed())}>
          Autre exemple
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Erreurs testées : {template.testsErrors.map((c) => `${c} (${ERRORS[c].name.toLowerCase()})`).join(', ')}.
      </p>
      {inst.distractors.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Distracteurs : {inst.distractors.map((d) => `${formatOhms(d.value, inst.unit)} → ${d.code}`).join(' · ')}
        </p>
      )}
    </Card>
  );
}
