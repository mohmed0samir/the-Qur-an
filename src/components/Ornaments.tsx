/**
 * Decorative SVGs: brand mark (eight-pointed khatam) and a pointed arch.
 * All are purely decorative (aria-hidden).
 */

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M9 9h30v30H9z" />
        <path d="M24 1.5 46.5 24 24 46.5 1.5 24z" />
        <circle cx="24" cy="24" r="12.5" strokeWidth="1.2" opacity="0.7" />
      </g>
      {/* open book */}
      <path
        d="M24 31V19.5c-2.6-1.9-5.6-2.6-8.5-2.3v11.5c2.9-.3 5.9.4 8.5 2.3Zm0 0V19.5c2.6-1.9 5.6-2.6 8.5-2.3v11.5c-2.9-.3-5.9.4-8.5 2.3Z"
        fill="var(--gold)"
        opacity="0.9"
      />
    </svg>
  );
}

export function ArchOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 380" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMin meet">
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M24 380V180C24 104 112 62 160 6c48 56 136 98 136 174v200" />
        <path d="M44 380V184c0-66 78-104 116-154 38 50 116 88 116 154v196" opacity="0.6" />
        <path d="M64 380V190c0-52 62-86 96-126 34 40 96 74 96 126v190" opacity="0.32" />
        <circle cx="160" cy="6" r="3.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
