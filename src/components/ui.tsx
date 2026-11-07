import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LEVEL_LABELS } from '../content/competences';
import type { Level } from '../engine/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'warn' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300',
  secondary: 'bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:text-slate-400 disabled:ring-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  warn: 'bg-warn-500 text-white hover:bg-warn-700 disabled:opacity-50',
  success: 'bg-ok-500 text-white hover:bg-ok-700 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const LEVEL_STYLES: Record<Level, string> = {
  facile: 'bg-brand-50 text-brand-700 ring-brand-200',
  moyen: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  difficile: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function LevelBadge({ level, className = '' }: { level: Level; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${LEVEL_STYLES[level]} ${className}`}>
      Niveau {LEVEL_LABELS[level].toLowerCase()}
    </span>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-slate-500" role="status">
      {label}
    </div>
  );
}

/** Message de feedback : orange pour une erreur (jamais de rouge agressif), vert pour une réussite. */
export function Notice({ tone, title, children, icon }: { tone: 'info' | 'warn' | 'ok' | 'current'; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const tones = {
    info: 'bg-brand-50 ring-brand-200 text-brand-900',
    warn: 'bg-warn-50 ring-warn-100 text-warn-700',
    ok: 'bg-ok-50 ring-ok-100 text-ok-700',
    current: 'bg-current-soft ring-yellow-200 text-yellow-900',
  };
  return (
    <div className={`animate-fade rounded-xl p-3 ring-1 sm:p-4 ${tones[tone]}`} role="status" aria-live="polite">
      <div className="flex gap-3">
        {icon && <div className="shrink-0 pt-0.5">{icon}</div>}
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="text-sm leading-relaxed text-slate-700">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'jamais';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
