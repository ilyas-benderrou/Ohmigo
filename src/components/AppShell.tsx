import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../app/auth';
import { Logo } from './Logo';
import { Button } from './ui';

export function AppShell({ children, user, nav, wide = false }: { children: ReactNode; user?: string; nav?: ReactNode; wide?: boolean }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const home = session?.role === 'teacher' ? '/prof' : session?.role === 'student' ? '/eleve' : '/';
  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-2.5 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Link to={home} aria-label="Accueil Ohmigo">
            <Logo compact />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {nav}
            {user && <span className="hidden truncate text-sm font-medium text-slate-600 sm:inline">{user}</span>}
            {session && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Déconnexion
              </Button>
            )}
          </div>
        </div>
      </header>
      <main id="contenu" className={`mx-auto px-4 py-5 sm:py-8 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {children}
      </main>
    </div>
  );
}
