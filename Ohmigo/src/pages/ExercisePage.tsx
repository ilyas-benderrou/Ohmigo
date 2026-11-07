import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCurrentStudent } from '../app/hooks';
import { AppShell } from '../components/AppShell';
import { CircuitView } from '../components/CircuitView';
import { Mascot } from '../components/Logo';
import { RichText, Tex } from '../components/Tex';
import { MicroVideoCard } from '../components/VideoPlayer';
import { Button, Card, LevelBadge, Notice, Spinner } from '../components/ui';
import { LEVEL_LABELS } from '../content/competences';
import { ERRORS } from '../content/errors';
import {
  BRIDGE_REMOVED,
  DIRECT_LABEL,
  DIRECT_WRONG,
  GENERAL_HINTS,
  GROUP_OK,
  NOT_BRIDGE,
  NOT_SHORTED,
  SELECTION_TOO_SMALL,
  SHORT_REMOVED,
  SUCCESS_MESSAGES,
  UNKNOWN_FINAL,
  VALUE_OK,
} from '../content/feedback';
import { TEMPLATES, createInstance, getTemplate } from '../content/templates';
import { newId, repo } from '../data/repository';
import type { Attempt, StepLog, Student } from '../data/types';
import { type CompletionResult, chooseNextTemplate, completeExercise, registerError } from '../engine/adaptive';
import { diagnoseFinal, diagnoseGroup, diagnoseGroupValue, diagnoseInverseStep } from '../engine/diagnostic';
import { type Frac, toNumber } from '../engine/fraction';
import { renderCircuit } from '../engine/layout';
import { stepFormula, texLabel, texOhms } from '../engine/math';
import { type Unit, parseUserNumber, unitFactor } from '../engine/numbers';
import { applyMerge, applyRemoveBridge, applyRemoveShorted, isReduced, labelsOf, resistorById } from '../engine/reduction';
import { mulberry32, newSeed, pick } from '../engine/rng';
import type { CircuitState, ErrorCode, ExerciseInstance, GroupType } from '../engine/types';

interface Exercise {
  instance: ExerciseInstance;
  circuit: CircuitState;
  startedAt: number;
  steps: StepLog[];
  errors: ErrorCode[];
  hints: number;
  videos: string[];
  directLocked: boolean;
  remediation: boolean;
  review: boolean;
  lastMergedId: string | null;
  showNodes: boolean;
  nodesUnlocked: boolean;
  inverseStep: 1 | 2;
  /** Étapes réussies : formule LaTeX (affichage) ou texte enrichi. */
  history: { tex: boolean; value: string }[];
}

type Phase =
  | { kind: 'solving' }
  | { kind: 'video'; code: ErrorCode }
  | { kind: 'alert'; code: ErrorCode }
  | { kind: 'success'; result: CompletionResult; message: string; mode: 'steps' | 'direct' };

interface Feedback {
  tone: 'warn' | 'ok' | 'info' | 'current';
  title?: string;
  text: string;
}

const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-lg tabular-nums shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

export function ExercisePage() {
  const { student: loaded, loading, session } = useCurrentStudent();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const studentRef = useRef<Student | null>(null);
  const [ex, setEx] = useState<Exercise | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'solving' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosenType, setChosenType] = useState<GroupType | null>(null);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>('Ω');
  const [direct, setDirect] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [exerciseCount, setExerciseCount] = useState(0);
  const valueRef = useRef<HTMLInputElement>(null);
  const rng = useMemo(() => mulberry32(newSeed()), []);

  const persist = useCallback(async (s: Student) => {
    const updated = { ...s, lastActive: new Date().toISOString() };
    studentRef.current = updated;
    setStudent(updated);
    await repo.saveStudent(updated);
    return updated;
  }, []);

  const startExercise = useCallback(
    async (base: Student, remediationOf?: string) => {
      let s = base;
      let templateId: string;
      let review = false;
      if (remediationOf) templateId = remediationOf;
      else {
        const next = chooseNextTemplate(s.model, TEMPLATES, rng);
        templateId = next.templateId;
        review = next.review;
        s = await persist({ ...s, model: next.model });
      }
      // Jamais le même exercice avec les mêmes valeurs : on compare à l'historique de l'élève.
      const signature = (values: Record<string, number>) => JSON.stringify(Object.values(values).sort((a, b) => a - b));
      const seen = new Set(
        (await repo.listAttempts({ studentId: s.id })).filter((a) => a.templateId === templateId).map((a) => signature(a.values)),
      );
      let instance = createInstance(templateId, newSeed());
      for (let i = 0; i < 30 && seen.has(signature(instance.values)); i++) instance = createInstance(templateId, newSeed());
      setEx({
        instance,
        circuit: instance.circuit,
        startedAt: Date.now(),
        steps: [],
        errors: [],
        hints: 0,
        videos: [],
        directLocked: !instance.allowDirect,
        remediation: !!remediationOf,
        review,
        lastMergedId: null,
        showNodes: false,
        nodesUnlocked: false,
        inverseStep: 1,
        history: [],
      });
      setPhase({ kind: 'solving' });
      setSelected(new Set());
      setChosenType(null);
      setValue('');
      setDirect('');
      setUnit(instance.unit);
      setFeedback(
        remediationOf
          ? { tone: 'info', title: 'Exercice de remédiation', text: 'Même type de schéma, nouvelles valeurs. Applique ce que tu viens de voir.' }
          : review
            ? { tone: 'info', title: 'Révision', text: 'Un exercice de ce type revient pour vérifier que c’est bien acquis.' }
            : null,
      );
      setExerciseCount((c) => c + 1);
    },
    [persist, rng],
  );

  useEffect(() => {
    if (!loaded || student) return;
    if (!loaded.model.introDone) {
      navigate('/eleve/video', { replace: true });
      return;
    }
    studentRef.current = loaded;
    setStudent(loaded);
    void startExercise(loaded);
  }, [loaded, student, startExercise, navigate]);

  const schematic = useMemo(() => (ex ? renderCircuit(ex.circuit, ex.instance) : null), [ex]);

  if (loading || !student || !ex || !schematic || !session) return <AppShell><Spinner /></AppShell>;

  const inst = ex.instance;
  const template = getTemplate(inst.templateId);
  const elapsedMs = () => Date.now() - ex.startedAt;
  const log = (step: Omit<StepLog, 't'>): StepLog[] => {
    const steps = [...ex.steps, { ...step, t: elapsedMs() }];
    return steps;
  };

  /** Enregistre la tentative et met à jour le modèle de l'apprenant. */
  const finishAttempt = async (
    current: Exercise,
    outcome: Attempt['outcome'],
    finalAnswer: number | null,
    mode: 'steps' | 'direct',
  ): Promise<CompletionResult> => {
    const s = studentRef.current!;
    const durationSec = Math.round((Date.now() - current.startedAt) / 1000);
    const success = outcome === 'success';
    const result = completeExercise(
      s.model,
      { template, success, usedHelp: current.hints > 0 || current.videos.length > 0, durationSec, errors: current.errors },
      rng,
    );
    const updated = await persist({ ...s, model: result.model });
    await repo.addAttempt({
      id: newId('att'),
      studentId: s.id,
      sessionId: session.sessionId,
      templateId: inst.templateId,
      level: inst.level,
      seed: inst.seed,
      values: inst.values,
      unit: inst.unit,
      mode,
      remediation: current.remediation,
      review: current.review,
      steps: current.steps,
      finalAnswer,
      errors: current.errors,
      success,
      outcome,
      hintsUsed: current.hints,
      videosWatched: current.videos,
      startedAt: new Date(current.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationSec,
      competencesAfter: { ...updated.model.competences },
      levelAfter: updated.model.level,
    });
    return result;
  };

  const succeed = async (current: Exercise, finalAnswer: number, mode: 'steps' | 'direct') => {
    const result = await finishAttempt(current, 'success', finalAnswer, mode);
    setPhase({ kind: 'success', result, message: pick(rng, SUCCESS_MESSAGES), mode });
    setFeedback(null);
  };

  /** Erreur diagnostiquée → aide progressive : indice, puis micro-vidéo, puis alerte professeur. */
  const handleError = async (code: ErrorCode, current: Exercise, extra?: string) => {
    const s = studentRef.current!;
    const { model, action, count } = registerError(s.model, code);
    await persist({ ...s, model });
    const next: Exercise = { ...current, errors: [...current.errors, code] };
    const info = ERRORS[code];
    if (action === 'hint') {
      next.hints += 1;
      if (code === 'E5') {
        next.showNodes = true;
        next.nodesUnlocked = true;
      }
      if (code === 'E0') next.directLocked = true;
      setEx(next);
      setFeedback({ tone: 'warn', title: 'Indice', text: extra ? `${info.hint} ${extra}` : info.hint });
    } else if (action === 'video') {
      const video = info.video!;
      next.videos = [...next.videos, video.id];
      setEx(next);
      setPhase({ kind: 'video', code });
      setFeedback(null);
      await repo.addVideoView({ id: newId('vid'), studentId: s.id, videoId: video.id, at: new Date().toISOString(), reason: 'remediation' });
    } else {
      setEx(next);
      setPhase({ kind: 'alert', code });
      setFeedback(null);
      await repo.addAlert({ id: newId('alr'), studentId: s.id, code, count, createdAt: new Date().toISOString(), resolved: false });
    }
  };

  const toggle = (id: string) => {
    if (phase.kind !== 'solving' || inst.kind === 'inverse') return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setChosenType(null);
    setValue('');
  };

  const chooseType = async (type: GroupType) => {
    const ids = [...selected];
    if (ids.length < 2) {
      setFeedback({ tone: 'info', text: SELECTION_TOO_SMALL });
      return;
    }
    const d = diagnoseGroup(ex.circuit, ids, type, { ladder: inst.ladder });
    const steps = log({ action: 'group', selection: labelsOf(ex.circuit, ids), groupType: type, ok: d.ok, code: d.ok ? null : d.code });
    const current = { ...ex, steps };
    if (d.ok) {
      setEx(current);
      setChosenType(type);
      setFeedback({ tone: 'ok', text: GROUP_OK[type] });
      window.setTimeout(() => valueRef.current?.focus(), 50);
      return;
    }
    setSelected(new Set());
    setChosenType(null);
    if (d.code) await handleError(d.code, current);
    else setEx(current);
  };

  const submitValue = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosenType) return;
    const parsed = parseUserNumber(value);
    if (parsed === null) {
      setFeedback({ tone: 'info', text: 'Écris un nombre, par exemple 4 ou 3,6.' });
      return;
    }
    const ids = [...selected];
    const valueOhm = parsed * unitFactor(unit);
    const d = diagnoseGroupValue(ex.circuit, ids, chosenType, valueOhm);
    const steps = log({ action: 'value', selection: labelsOf(ex.circuit, ids), groupType: chosenType, value: parsed, unit, ok: d.ok, code: d.ok ? null : d.code });
    if (!d.ok) {
      setValue('');
      await handleError(d.code ?? 'E9', { ...ex, steps });
      return;
    }
    const { state, merged } = applyMerge(ex.circuit, ids, chosenType);
    const labels = labelsOf(ex.circuit, ids);
    const values = ids.map((id) => resistorById(ex.circuit, id)!.value as Frac);
    const line = { tex: true, value: stepFormula(labels, values, chosenType, { label: merged.label, value: merged.value as Frac }, inst.unit) };
    const next: Exercise = { ...ex, steps, circuit: state, lastMergedId: merged.id, history: [...ex.history, line], directLocked: true };
    setEx(next);
    setSelected(new Set());
    setChosenType(null);
    setValue('');
    if (isReduced(state)) await succeed(next, valueOhm, 'steps');
    else setFeedback({ tone: 'ok', text: pick(rng, VALUE_OK) });
  };

  const special = async (kind: 'short' | 'bridge') => {
    const ids = [...selected];
    if (ids.length !== 1) {
      setFeedback({ tone: 'info', text: 'Sélectionne une seule résistance pour cette action.' });
      return;
    }
    const r = resistorById(ex.circuit, ids[0]);
    const state = kind === 'short' ? applyRemoveShorted(ex.circuit, ids[0]) : applyRemoveBridge(ex.circuit, ids[0]);
    const steps = log({ action: 'special', selection: r ? [r.label] : ids, ok: !!state, note: kind === 'short' ? 'court-circuit' : 'pont équilibré' });
    setSelected(new Set());
    if (!state) {
      setEx({ ...ex, steps });
      setFeedback({ tone: 'info', text: kind === 'short' ? NOT_SHORTED : NOT_BRIDGE });
      return;
    }
    const lab = `$${texLabel(r?.label ?? '')}$`;
    const line = { tex: false, value: kind === 'short' ? `${lab} court-circuitée par un fil : retirée` : `Pont équilibré : ${lab} ne conduit pas, retirée` };
    const next: Exercise = { ...ex, steps, circuit: state, lastMergedId: null, history: [...ex.history, line] };
    setEx(next);
    if (isReduced(state) && state.type === 'tree') await succeed(next, toNumber(inst.answer), 'steps');
    else setFeedback({ tone: 'ok', text: kind === 'short' ? SHORT_REMOVED : BRIDGE_REMOVED });
  };

  const submitDirect = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseUserNumber(direct);
    if (parsed === null) {
      setFeedback({ tone: 'info', text: 'Écris un nombre, par exemple 4 ou 3,6.' });
      return;
    }
    const valueOhm = parsed * unitFactor(unit);
    const d = diagnoseFinal(inst, valueOhm, elapsedMs() / 1000);
    const steps = log({ action: 'direct', value: parsed, unit, ok: d.ok, code: d.ok ? null : d.code });
    const current = { ...ex, steps, directLocked: true };
    setDirect('');
    if (d.ok) {
      await succeed(current, valueOhm, 'direct');
      return;
    }
    if (d.code) await handleError(d.code, current, DIRECT_WRONG);
    else {
      setEx(current);
      setFeedback({ tone: 'info', title: 'Montre-moi ton raisonnement', text: UNKNOWN_FINAL });
    }
  };

  const submitInverse = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseUserNumber(value);
    if (parsed === null) {
      setFeedback({ tone: 'info', text: 'Écris un nombre, par exemple 4 ou 3,6.' });
      return;
    }
    const valueOhm = parsed * unitFactor(unit);
    const d = diagnoseInverseStep(inst, ex.inverseStep, valueOhm);
    const steps = log({ action: 'inverse', value: parsed, unit, ok: d.ok, code: d.ok ? null : d.code, note: `étape ${ex.inverseStep}` });
    setValue('');
    if (!d.ok) {
      await handleError(d.code ?? 'E9', { ...ex, steps });
      return;
    }
    if (ex.inverseStep === 1) {
      const meta = inst.inverse!;
      setEx({ ...ex, steps, inverseStep: 2, history: [{ tex: true, value: `R_{eq} - R_{s} = ${texOhms(meta.parallelValue, inst.unit)}` }] });
      setFeedback({ tone: 'ok', text: 'Exact ! Il reste maintenant à trouver R dans la partie parallèle.' });
      return;
    }
    await succeed({ ...ex, steps }, valueOhm, 'steps');
  };

  const askHint = () => {
    const list = GENERAL_HINTS[inst.level];
    setFeedback({ tone: 'current', title: 'Indice', text: list[hintIndex % list.length] });
    setHintIndex((i) => i + 1);
    setEx({ ...ex, hints: ex.hints + 1, steps: log({ action: 'hint-request', ok: true }) });
  };

  const afterVideo = async () => {
    await finishAttempt(ex, 'remediation', null, 'steps');
    await startExercise(studentRef.current!, inst.templateId);
  };

  const afterAlert = async () => {
    await finishAttempt(ex, 'alert', null, 'steps');
    await startExercise(studentRef.current!);
  };

  const pristine = ex.circuit === inst.circuit && ex.steps.every((s) => s.action === 'hint-request');
  const selectedLabels = labelsOf(ex.circuit, [...selected]);
  const solving = phase.kind === 'solving';
  const terms = inst.terminals.join(' et ');

  return (
    <AppShell user={`${student.firstName} ${student.lastName}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LevelBadge level={student.model.level} />
        <span className="text-sm text-slate-500">Exercice {exerciseCount} de la séance</span>
        {ex.remediation && <span className="rounded-full bg-current-soft px-2.5 py-0.5 text-xs font-semibold text-yellow-900">Remédiation</span>}
        {ex.review && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Révision</span>}
        <Link to="/eleve" className="ml-auto text-sm font-semibold text-brand-600 hover:underline">
          ← Accueil
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-lg font-semibold text-slate-800">
              <RichText text={inst.prompt} />
            </p>
            <CircuitView
              schematic={schematic}
              selected={selected}
              onToggle={solving && inst.kind === 'reduce' ? toggle : undefined}
              showNodes={ex.showNodes}
              highlightId={ex.lastMergedId}
              flowing={phase.kind === 'success'}
              label={`Schéma électrique entre les bornes ${terms}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              {inst.kind === 'reduce' && solving && <span>Clique sur les résistances pour les sélectionner.</span>}
              {ex.nodesUnlocked && (
                <label className="ml-auto inline-flex items-center gap-2 font-medium text-slate-700">
                  <input type="checkbox" checked={ex.showNodes} onChange={(e) => setEx({ ...ex, showNodes: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                  Nœuds en couleur
                </label>
              )}
            </div>
          </Card>
          {ex.history.length > 0 && (
            <Card title="Mes étapes">
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">
                {ex.history.map((h, i) => (
                  <li key={i} className="tabular-nums">
                    {h.tex ? <Tex math={h.value} display className="[&_.katex-display>.katex]:text-left!" /> : <RichText text={h.value} />}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {phase.kind === 'success' && (
            <Card className="ring-ok-100">
              <div className="flex items-start gap-3">
                <Mascot size={56} mood="cheer" />
                <div>
                  <h2 className="text-xl font-extrabold text-ok-700">{phase.message}</h2>
                  <p className="mt-1 text-slate-700">
                    <Tex math={`${inst.kind === 'inverse' ? 'R' : 'R_{eq}'} = ${texOhms(inst.answer, inst.unit)}`} className="text-lg" />
                    {phase.mode === 'direct' && ' — trouvé directement !'}
                  </p>
                  {ex.errors.length > 0 && <p className="mt-1 text-sm text-slate-600">Tu as corrigé tes erreurs en cours de route : c’est comme ça qu’on progresse.</p>}
                </div>
              </div>
              {phase.result.levelUp && (
                <Notice tone="ok" title={`Niveau ${LEVEL_LABELS[phase.result.model.level].toLowerCase()} débloqué !`}>
                  Trois réussites d’affilée : tu passes au niveau suivant.
                </Notice>
              )}
              {phase.result.finished && (
                <Notice tone="ok" title="Leçon validée !">
                  Tu maîtrises le calcul de la résistance équivalente, y compris les cas particuliers.
                </Notice>
              )}
              {phase.result.slow && !phase.result.levelUp && (
                <p className="mt-2 text-sm text-slate-500">Tu as pris ton temps : encore un exercice de ce niveau pour bien consolider.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="success" onClick={() => startExercise(studentRef.current!)}>
                  Exercice suivant →
                </Button>
                <Button variant="secondary" onClick={() => navigate('/eleve/bilan')}>
                  Mon bilan
                </Button>
              </div>
            </Card>
          )}

          {phase.kind === 'video' && (
            <Card title="Regardons ce point ensemble">
              <p className="mb-3 text-slate-600">
                C’est la deuxième fois que cette difficulté revient. Cette courte vidéo explique le point clé, puis tu feras un exercice du même type avec de nouvelles valeurs.
              </p>
              <MicroVideoCard video={ERRORS[phase.code].video!} code={phase.code} />
              <Button className="mt-4 w-full" onClick={afterVideo}>
                J’ai compris : exercice de remédiation →
              </Button>
            </Card>
          )}

          {phase.kind === 'alert' && (
            <Card>
              <div className="flex items-start gap-3">
                <Mascot size={52} mood="think" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">On consolide les bases</h2>
                  <p className="mt-1 text-slate-600">
                    Cette difficulté ({ERRORS[phase.code].name.toLowerCase()}) revient plusieurs fois : ton professeur a été prévenu pour t’aider. En attendant, on
                    consolide les bases au niveau {LEVEL_LABELS[student.model.level].toLowerCase()}.
                  </p>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={afterAlert}>
                Continuer →
              </Button>
            </Card>
          )}

          {solving && inst.kind === 'reduce' && (
            <Card title="Simplifier le circuit">
              <div className="mb-3 min-h-8 text-sm">
                {selectedLabels.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500">Sélection :</span>
                    {selectedLabels.map((l) => (
                      <span key={l} className="rounded-md bg-brand-100 px-2 py-0.5 font-semibold text-brand-800">
                        {l}
                      </span>
                    ))}
                    <button type="button" className="ml-1 text-xs font-semibold text-slate-500 underline" onClick={() => { setSelected(new Set()); setChosenType(null); }}>
                      effacer
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500">Aucune résistance sélectionnée.</span>
                )}
              </div>
              <p className="mb-2 text-sm font-medium text-slate-700">Ces résistances sont…</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={chosenType === 'S' ? 'primary' : 'secondary'} onClick={() => chooseType('S')} aria-pressed={chosenType === 'S'}>
                  En série
                </Button>
                <Button variant={chosenType === 'P' ? 'primary' : 'secondary'} onClick={() => chooseType('P')} aria-pressed={chosenType === 'P'}>
                  En parallèle
                </Button>
              </div>

              {chosenType && (
                <form onSubmit={submitValue} className="mt-4 animate-fade">
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="group-value">
                    Résistance équivalente de {selectedLabels.join(', ')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="group-value"
                      ref={valueRef}
                      className={inputClass}
                      inputMode="decimal"
                      autoComplete="off"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="ex. 4 ou 3,6"
                    />
                    <UnitSelect unit={unit} onChange={setUnit} />
                    <Button type="submit">Valider</Button>
                  </div>
                </form>
              )}

              {inst.level === 'difficile' && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Cas particuliers (sélectionne une seule résistance)</p>
                  <div className="grid gap-2">
                    <Button variant="secondary" size="sm" onClick={() => special('short')}>
                      Supprimer la résistance court-circuitée
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => special('bridge')}>
                      Pont équilibré : retirer la résistance centrale
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {solving && inst.kind === 'inverse' && (
            <Card title={`Étape ${ex.inverseStep} sur 2`}>
              <form onSubmit={submitInverse}>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="inv-value">
                  {ex.inverseStep === 1 ? 'Quelle est la valeur de la partie du circuit qui contient R ?' : 'Quelle est la valeur de R ?'}
                </label>
                <div className="flex gap-2">
                  <input id="inv-value" className={inputClass} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex. 4" />
                  <UnitSelect unit={unit} onChange={setUnit} />
                  <Button type="submit">Valider</Button>
                </div>
              </form>
            </Card>
          )}

          {solving && feedback && (
            <Notice tone={feedback.tone} title={feedback.title}>
              <RichText text={feedback.text} />
            </Notice>
          )}

          {solving && inst.allowDirect && !ex.directLocked && pristine && (
            <Card>
              <form onSubmit={submitDirect}>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="direct">
                  <RichText text={DIRECT_LABEL} />
                </label>
                <div className="flex gap-2">
                  <input id="direct" className={inputClass} inputMode="decimal" autoComplete="off" value={direct} onChange={(e) => setDirect(e.target.value)} placeholder="Req" />
                  <UnitSelect unit={unit} onChange={setUnit} />
                  <Button type="submit" variant="secondary">
                    Vérifier
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {solving && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={askHint}>
                💡 Besoin d’un indice ?
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function UnitSelect({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return (
    <select
      aria-label="Unité"
      className="rounded-xl border border-slate-300 bg-white px-2 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      value={unit}
      onChange={(e) => onChange(e.target.value as Unit)}
    >
      <option value="Ω">Ω</option>
      <option value="kΩ">kΩ</option>
    </select>
  );
}
