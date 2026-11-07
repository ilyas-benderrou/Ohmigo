import { useEffect, useRef, useState } from 'react';
import type { MicroVideo } from '../content/errors';
import type { VideoSegment } from '../content/videos';
import { Mascot } from './Logo';
import { RichText, Tex } from './Tex';
import { Button } from './ui';

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

interface Props {
  title: string;
  videoUrl: string;
  segments: VideoSegment[];
  /** Ne lire que ce segment (ex. après une mauvaise réponse à la question de compréhension). */
  onlySegment?: VideoSegment['id'];
  onSegmentWatched?: (id: VideoSegment['id']) => void;
}

/**
 * Lecteur avec chapitres. Tant que la vidéo n'existe pas (videoUrl vide), un placeholder
 * simule la lecture et affiche le script du segment en cours.
 */
export function VideoPlayer({ title, videoUrl, segments, onlySegment, onSegmentWatched }: Props) {
  const total = segments[segments.length - 1].end;
  const initial = onlySegment ? segments.find((s) => s.id === onlySegment)! : null;
  const [range, setRange] = useState<{ start: number; end: number }>(initial ? { start: initial.start, end: initial.end } : { start: 0, end: total });
  const [t, setT] = useState(range.start);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watched = useRef(new Set<string>());
  const current = segments.find((s) => t >= s.start && t < s.end) ?? segments[segments.length - 1];

  const markWatched = (time: number) => {
    for (const s of segments) {
      if (time >= s.end - 0.3 && range.start <= s.start && !watched.current.has(s.id)) {
        watched.current.add(s.id);
        onSegmentWatched?.(s.id);
      }
    }
  };

  // Lecture simulée (placeholder).
  useEffect(() => {
    if (!playing || videoUrl) return;
    const id = window.setInterval(() => setT((prev) => Math.min(prev + 0.25, range.end)), 250);
    return () => window.clearInterval(id);
  }, [playing, videoUrl, range]);

  useEffect(() => {
    if (videoUrl) return;
    markWatched(t);
    if (t >= range.end) setPlaying(false);
    // markWatched ne dépend que de props stables pendant la lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, range, videoUrl]);

  const playRange = (start: number, end: number) => {
    setRange({ start, end });
    setT(start);
    setPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      void videoRef.current.play();
    }
  };

  const toggle = () => {
    if (videoUrl && videoRef.current) {
      if (videoRef.current.paused) void videoRef.current.play();
      else videoRef.current.pause();
      return;
    }
    if (!playing && t >= range.end) setT(range.start);
    setPlaying((p) => !p);
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg">
      <div className="relative aspect-video w-full">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="h-full w-full"
            onTimeUpdate={(e) => {
              const time = e.currentTarget.currentTime;
              setT(time);
              markWatched(time);
              if (time >= range.end) e.currentTarget.pause();
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-900 to-slate-900 p-5 text-center sm:p-8">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-current">Vidéo à venir · aperçu du script</span>
            <Mascot size={52} mood={playing ? 'cheer' : 'happy'} />
            <p className="text-base font-bold sm:text-xl">{current.title}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
              <RichText text={current.script} />
            </p>
            <Tex math={current.formula} display className="max-w-full text-lg text-current sm:text-2xl" />
          </div>
        )}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
            {playing ? '❚❚ Pause' : '▶ Lecture'}
          </Button>
          <div className="relative h-2 flex-1 rounded-full bg-white/15" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 rounded-full bg-current" style={{ width: `${(t / total) * 100}%` }} />
            {segments.slice(1).map((s) => (
              <span key={s.id} className="absolute -top-1 h-4 w-0.5 bg-white/60" style={{ left: `${(s.start / total) * 100}%` }} />
            ))}
          </div>
          <span className="w-20 text-right text-xs tabular-nums text-slate-300">
            {fmt(t)} / {fmt(total)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Chapitres de la vidéo ${title}`}>
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => playRange(s.start, s.end)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm ring-1 transition ${current.id === s.id ? 'bg-white/15 ring-current' : 'ring-white/20 hover:bg-white/10'}`}
            >
              <span className="font-semibold">{s.title}</span>
              <span className="ml-2 text-xs text-slate-300">
                {fmt(s.start)}–{fmt(s.end)}
              </span>
            </button>
          ))}
          <button type="button" onClick={() => playRange(0, total)} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/20 hover:bg-white/10">
            Tout lire
          </button>
        </div>
      </div>
    </div>
  );
}

/** Micro-vidéo d'erreur (30–45 s) : placeholder « à venir » + script tant que videoUrl est vide. */
export function MicroVideoCard({ video, code }: { video: MicroVideo; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 text-white">
      {video.videoUrl ? (
        <video src={video.videoUrl} controls className="aspect-video w-full" />
      ) : (
        <div className="flex flex-col gap-3 bg-gradient-to-br from-brand-900 to-slate-900 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl" aria-hidden="true">
            ▶
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-current">Vidéo {code} – à venir</p>
            <p className="text-lg font-bold">{video.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-200">
              <RichText text={video.script} />
            </p>
            {video.formula && <Tex math={video.formula} display className="mt-2 text-base text-current" />}
          </div>
        </div>
      )}
    </div>
  );
}
