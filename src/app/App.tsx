import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { repo } from '../data/repository';
import { BilanPage } from '../pages/BilanPage';
import { ComprehensionPage } from '../pages/ComprehensionPage';
import { ExercisePage } from '../pages/ExercisePage';
import { IntroVideoPage } from '../pages/IntroVideoPage';
import { LoginPage } from '../pages/LoginPage';
import { StudentHome } from '../pages/StudentHome';
import { TeacherBankPage } from '../pages/TeacherBankPage';
import { TeacherDashboard } from '../pages/TeacherDashboard';
import { TeacherStudentPage } from '../pages/TeacherStudentPage';
import { AuthProvider, useAuth } from './auth';

function RequireRole({ role, children }: { role: 'student' | 'teacher'; children: ReactNode }) {
  const { session } = useAuth();
  if (!session || session.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    repo.init().then(() => setReady(true));
  }, []);
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500" role="status">
        Chargement…
      </div>
    );
  }
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/eleve" element={<RequireRole role="student"><StudentHome /></RequireRole>} />
          <Route path="/eleve/video" element={<RequireRole role="student"><IntroVideoPage /></RequireRole>} />
          <Route path="/eleve/comprehension" element={<RequireRole role="student"><ComprehensionPage /></RequireRole>} />
          <Route path="/eleve/exercice" element={<RequireRole role="student"><ExercisePage /></RequireRole>} />
          <Route path="/eleve/bilan" element={<RequireRole role="student"><BilanPage /></RequireRole>} />
          <Route path="/prof" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
          <Route path="/prof/exercices" element={<RequireRole role="teacher"><TeacherBankPage /></RequireRole>} />
          <Route path="/prof/eleve/:id" element={<RequireRole role="teacher"><TeacherStudentPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
