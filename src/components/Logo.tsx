/** Mascotte Ohmigo : un « Ω » souriant, avec une étincelle jaune (le courant). */
export function Mascot({ size = 48, mood = 'happy', className = '' }: { size?: number; mood?: 'happy' | 'think' | 'cheer'; className?: string }) {
  const mouth =
    mood === 'think' ? 'M27 38h10' : mood === 'cheer' ? 'M25 35q7 8 14 0z' : 'M26 36q6 5 12 0';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#1f55f0" />
      <path
        d="M14 50h12v-5c-6-3-9-8-9-15 0-9 7-16 15-16s15 7 15 16c0 7-3 12-9 15v5h12"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="29" r="2.6" fill="#fff" />
      <circle cx="37" cy="29" r="2.6" fill="#fff" />
      <path d={mouth} fill={mood === 'cheer' ? '#facc15' : 'none'} stroke="#facc15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 8l-4 8h5l-4 8" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mascot size={compact ? 32 : 40} />
      <span className="text-xl font-extrabold tracking-tight text-brand-700">
        Ohm<span className="text-brand-500">igo</span>
      </span>
    </span>
  );
}
