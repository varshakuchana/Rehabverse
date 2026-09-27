export function NovaMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="22" fill="rgba(165,180,252,.18)" stroke="rgba(207,227,255,.5)" />
      <path d="m24 7 5 11 11 6-11 5-5 12-5-12-11-5 11-6Z" fill="#F4F6F2" fillOpacity=".25" stroke="#F4F6F2" strokeWidth="1.5" />
      <path d="M19 24h2m6 0h2" stroke="#F4F6F2" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M21.5 28.5q2.5 2.5 5 0" stroke="#F4F6F2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
