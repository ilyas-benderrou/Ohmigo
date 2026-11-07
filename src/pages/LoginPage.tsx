import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../app/auth';
import { Mascot } from '../components/Logo';
import { Button, Notice } from '../components/ui';
import { repo } from '../data/repository';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

export function LoginPage() {
  const { session, loginStudent, loginTeacher } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [classCode, setClassCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (session?.role === 'student') navigate('/eleve', { replace: true });
    if (session?.role === 'teacher') navigate('/prof', { replace: true });
  }, [session, navigate]);

  const submitStudent = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const s = await repo.findOrCreateStudent(first, last, classCode);
      loginStudent(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submitTeacher = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (await repo.checkTeacherPin(pin)) loginTeacher();
    else setError('Code PIN incorrect.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-[#f5f7fb]">
      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-10 md:flex-row md:items-start md:py-20">
        <section className="flex-1 text-center md:pt-6 md:text-left">
          <Mascot size={88} mood="cheer" className="mx-auto md:mx-0" />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-brand-800 sm:text-5xl">Ohmigo</h1>
          <p className="mt-2 text-lg text-slate-600">Ton compagnon intelligent pour maîtriser les résistances.</p>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-slate-600 md:mx-0">
            <li className="flex gap-2">
              <span className="text-brand-600">●</span> Analyse des schémas, du plus simple au plus difficile.
            </li>
            <li className="flex gap-2">
              <span className="text-current">●</span> Simplifie le circuit étape par étape.
            </li>
            <li className="flex gap-2">
              <span className="text-ok-500">●</span> Une aide adaptée à chacune de tes erreurs.
            </li>
          </ul>
        </section>

        <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 sm:p-7">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Type de connexion">
            {(['student', 'teacher'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${tab === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'student' ? 'Élève' : 'Professeur'}
              </button>
            ))}
          </div>

          {tab === 'student' ? (
            <form onSubmit={submitStudent} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Prénom
                <input className={inputClass} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Nom
                <input className={inputClass} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Code de classe
                <input
                  className={`${inputClass} uppercase`}
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="ex. 1STE-A"
                  autoCapitalize="characters"
                  required
                />
              </label>
              {error && <Notice tone="warn">{error}</Notice>}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                Commencer
              </Button>
            </form>
          ) : (
            <form onSubmit={submitTeacher} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Code PIN professeur
                <input
                  className={`${inputClass} tracking-[0.4em]`}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </label>
              {error && <Notice tone="warn">{error}</Notice>}
              <Button type="submit" size="lg" className="w-full">
                Accéder au tableau de bord
              </Button>
            </form>
          )}

          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            <p>
              <strong className="text-slate-700">Démo :</strong> classe <code className="font-semibold">1STE-A</code> (ex. Youssef Amrani, ou
              ton propre nom), PIN professeur <code className="font-semibold">1234</code>.
            </p>
            <button
              type="button"
              className="mt-1 font-semibold text-brand-600 underline-offset-2 hover:underline"
              onClick={async () => {
                if (!window.confirm('Effacer toutes les données et recharger les données de démo ?')) return;
                await repo.resetDemo();
                setResetDone(true);
              }}
            >
              Réinitialiser les données de démo
            </button>
            {resetDone && <span className="ml-2 text-ok-700">Données réinitialisées.</span>}
          </div>
        </section>
      </main>
      <footer className="pb-6 text-center text-xs text-slate-400">Master « Système éducatif intelligent et communicant » – ENS Fès</footer>
    </div>
  );
}
