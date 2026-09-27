import type { WorldKind } from "@/lib/rehabWorld/worlds";
import { THEMES } from "@/lib/worldTheme";

/* Small painted preview of each exercise world. Decorative SVG, no WebGL. */
export default function WorldPostcard({ world, className = "" }: { world: WorldKind; className?: string }) {
  const t = THEMES[world];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden className={`block h-full w-full ${className}`}>
      <defs>
        <linearGradient id={`sky-${world}`} x1="0" y1="0" x2="0" y2="1">
          {world === "well" && <><stop stopColor="#8CC8E8" /><stop offset=".6" stopColor="#CDE8F0" /><stop offset="1" stopColor="#FBE7B5" /></>}
          {world === "flock" && <><stop stopColor="#4D3D66" /><stop offset=".6" stopColor="#E08C80" /><stop offset="1" stopColor="#FFD9A8" /></>}
          {world === "cairn" && <><stop stopColor="#1A2A48" /><stop offset=".6" stopColor="#3E6D96" /><stop offset="1" stopColor="#8DB8CF" /></>}
          {world === "orbit" && <><stop stopColor="#07081A" /><stop offset=".6" stopColor="#1C1646" /><stop offset="1" stopColor="#3A2468" /></>}
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#sky-${world})`} />

      {world === "well" && <>
        <ellipse cx="60" cy="150" rx="140" ry="50" fill="#6E9A55" />
        <ellipse cx="270" cy="148" rx="130" ry="46" fill="#5C8748" />
        <rect x="0" y="140" width="320" height="40" fill="#6E8F4E" />
        <circle cx="262" cy="42" r="16" fill="#FFE39A" opacity=".9" />
        <g transform="translate(92 96)">
          <rect x="-3" y="-2" width="5" height="44" fill="#7A5334" /><rect x="40" y="-2" width="5" height="44" fill="#7A5334" />
          <path d="M-12 2 21-22 54 2Z" fill="#8E3F2F" />
          <line x1="21" y1="8" x2="21" y2="28" stroke="#D9C6A0" strokeWidth="1.5" />
          <rect x="15" y="26" width="12" height="10" rx="2" fill="#8A5A3C" />
          <path d="M-4 38h50v16H-4Z" fill="#9A948A" /><ellipse cx="21" cy="38" rx="25" ry="5" fill="#2E5E7A" />
        </g>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i} transform={`translate(${178 + i * 26} ${136 - (i % 2) * 4})`}>
            <rect x="-10" y="0" width="20" height="7" fill="#5A3E2B" />
            <line x1="0" y1="0" x2="0" y2={-14 - (i % 3) * 5} stroke="#4E8A3A" strokeWidth="2" />
            <circle cx="0" cy={-16 - (i % 3) * 5} r="5" fill={["#F5C542", "#E4513A", "#9C7BD6", "#F08A3C", "#F5C542"][i]} />
          </g>
        ))}
      </>}

      {world === "flock" && <>
        <circle cx="238" cy="118" r="26" fill="#FFD2A0" opacity=".9" />
        <rect x="0" y="118" width="320" height="62" fill="#3C6F93" />
        <path d="M0 118h320" stroke="#FFE0B8" strokeOpacity=".5" />
        <path d="M0 132q20-4 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" fill="none" stroke="#9CC6DE" strokeOpacity=".4" />
        <path d="M0 108 60 100 116 112 124 180H0Z" fill="#6F9A55" /><path d="M116 112 124 180H96Z" fill="#8C7F73" />
        <g fill="none" stroke="#F4F1EA" strokeWidth="2.4" strokeLinecap="round">
          <path d="m150 58 8 5 8-5" /><path d="m176 44 7 4 7-4" /><path d="m198 62 8 5 8-5" /><path d="m214 40 6 4 6-4" /><path d="m168 76 6 3 6-3" />
        </g>
        <g transform="translate(78 96)"><path d="M-8 0 8 0 4-6Z" fill={t.accent} /><path d="M-2-2-14-16M2-2 12-18" stroke={t.accent} strokeWidth="3" strokeLinecap="round" /></g>
      </>}

      {world === "cairn" && <>
        <path d="M0 110 50 58 92 96 150 40 214 104 262 64 320 108V180H0Z" fill="#4A5670" />
        <path d="M150 40 138 54 162 54Z M50 58 42 68 58 68Z" fill="#E8EEF4" />
        <circle cx="262" cy="30" r="10" fill="#DDEFFF" opacity=".85" />
        <rect x="0" y="110" width="320" height="70" fill="#2E6F82" />
        <ellipse cx="200" cy="134" rx="46" ry="8" fill="none" stroke="#CFEFFF" strokeOpacity=".45" />
        <ellipse cx="200" cy="134" rx="28" ry="5" fill="none" stroke="#CFEFFF" strokeOpacity=".55" />
        <ellipse cx="200" cy="128" rx="34" ry="8" fill="#8E8C88" />
        {[[26, 9, "#8A857E"], [21, 8, "#B5AFA5"], [17, 7, "#9A958D"], [12, 6, "#C2BCB1"]].map(([r, h, c], i) => (
          <ellipse key={i} cx="200" cy={118 - i * 13} rx={r} ry={h} fill={c as string} />
        ))}
        {[[60, 150], [90, 140], [260, 150], [120, 160]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#FFF3B0" />)}
      </>}

      {world === "orbit" && <>
        {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 83) % 320} cy={(i * 47) % 180} r={i % 5 ? 0.8 : 1.4} fill="#fff" opacity=".8" />)}
        <circle cx="70" cy="40" r="46" fill="#7A5CFF" opacity=".18" />
        <ellipse cx="160" cy="92" rx="96" ry="24" fill="none" stroke="#FFB3D1" strokeOpacity=".45" transform="rotate(-8 160 92)" />
        <ellipse cx="160" cy="92" rx="70" ry="17" fill="none" stroke="#9EE7FF" strokeOpacity=".5" transform="rotate(6 160 92)" />
        <circle cx="160" cy="92" r="34" fill="#5B6BB5" />
        <path d="M126 92a34 34 0 0 0 68 0" fill="#4A579B" />
        <ellipse cx="160" cy="92" rx="52" ry="10" fill="none" stroke="#C8B8FF" strokeWidth="3" strokeOpacity=".55" transform="rotate(-12 160 92)" />
        <circle cx="86" cy="104" r="6" fill="#FFB3D1" /><circle cx="228" cy="80" r="7" fill="#9EE7FF" /><circle cx="198" cy="112" r="5" fill="#FFD59E" />
      </>}
    </svg>
  );
}
