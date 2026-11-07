import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useCurrentStudent } from '../app/hooks';
import { AppShell } from '../components/AppShell';
import { VideoPlayer } from '../components/VideoPlayer';
import { Button, Card, Notice, Spinner } from '../components/ui';
import { INTRO_VIDEO, segmentVideoId, type VideoSegment } from '../content/videos';
import { newId, repo } from '../data/repository';

/** Vidéo d'introduction (2 segments). ?segment=serie|parallele ne lit que le segment concerné. */
export function IntroVideoPage() {
  const { student, loading } = useCurrentStudent();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const only = (params.get('segment') as VideoSegment['id'] | null) ?? undefined;
  const [watched, setWatched] = useState<string[]>([]);

  if (loading || !student) return <AppShell><Spinner /></AppShell>;
  const onlySeg = only ? INTRO_VIDEO.segments.find((s) => s.id === only) : undefined;

  const onWatched = (id: VideoSegment['id']) => {
    setWatched((w) => [...w, id]);
    void repo.addVideoView({
      id: newId('vid'),
      studentId: student.id,
      videoId: segmentVideoId(id),
      at: new Date().toISOString(),
      reason: student.model.introDone || only ? 'replay' : 'intro',
    });
  };

  const done = onlySeg ? watched.includes(onlySeg.id) : watched.length >= INTRO_VIDEO.segments.length;
  const next = () => navigate(student.model.introDone ? '/eleve/exercice' : '/eleve/comprehension');

  return (
    <AppShell user={`${student.firstName} ${student.lastName}`}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{INTRO_VIDEO.title}</h1>
          <p className="text-slate-600">
            {onlySeg ? `Revoyons uniquement le passage « ${onlySeg.title} » (30 s).` : 'Une minute en deux parties : le montage en série, puis le montage en parallèle.'}
          </p>
        </div>
        <VideoPlayer title={INTRO_VIDEO.title} videoUrl={INTRO_VIDEO.videoUrl} segments={INTRO_VIDEO.segments} onlySegment={only} onSegmentWatched={onWatched} />
        {done && <Notice tone="ok" title="Vidéo terminée">Tu peux passer à la suite.</Notice>}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {student.model.introDone ? 'Tu as déjà vu cette vidéo : reprends les exercices quand tu veux.' : 'Après la vidéo, une petite question pour vérifier que tout est clair.'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate('/eleve')}>
                Retour
              </Button>
              <Button onClick={next} variant={done ? 'primary' : 'secondary'}>
                {student.model.introDone ? 'Aux exercices' : 'Passer à la question'} →
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
