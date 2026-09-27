import type { AbilityId } from "@/types/story";
import { abilities } from "@/data/storyCampaign";

/* Small visual vocabulary for Story Mode: ability orbs, fragment gems, energy pips. Decorative only. */

export function AbilityOrb({ id, size = 56, lit = true, pulse = false }: { id: AbilityId; size?: number; lit?: boolean; pulse?: boolean }) {
  const a = abilities[id];
  return (
    <span aria-hidden className={`relative inline-grid shrink-0 place-items-center rounded-full ${pulse ? "motion-safe:animate-[storyorb_2.4s_ease-in-out_infinite]" : ""}`}
      style={{ width: size, height: size, background: lit ? `radial-gradient(circle at 35% 30%, #fff8, ${a.accent} 45%, ${a.accent}33 75%)` : "radial-gradient(circle at 35% 30%, #ffffff22, #2a2d4a 70%)", boxShadow: lit ? `0 0 ${size / 2}px ${a.accent}88` : "none", border: `2px solid ${lit ? a.accent : "#ffffff30"}` }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke={lit ? "#1a1530" : "#ffffff70"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {id === "lumen-rise" && <><path d="M12 19V6" /><path d="m7 11 5-5 5 5" /><path d="M8 21h8" /></>}
        {id === "aether-wing" && <><path d="M12 13c-3-4-7-5-9-4 2 1 3 4 9 7" /><path d="M12 13c3-4 7-5 9-4-2 1-3 4-9 7" /><path d="M12 13v7" /></>}
        {id === "terra-pulse" && <><path d="M3 18h18" /><path d="M12 15V5" /><path d="M6 15c0-3 3-4 6-4s6 1 6 4" /></>}
      </svg>
    </span>
  );
}

export function FragmentGem({ lit, color = "#F2C14E", size = 64 }: { lit: boolean; color?: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" width={size} height={size} className={lit ? "drop-shadow-[0_0_14px_rgba(242,193,78,.7)]" : ""}>
      <path d="M32 4 52 22 32 60 12 22Z" fill={lit ? color : "#ffffff10"} stroke={lit ? "#FFF3C4" : "#ffffff45"} strokeWidth="2" strokeDasharray={lit ? undefined : "4 4"} />
      {lit && <><path d="M12 22h40M32 4 24 22l8 38 8-38Z" fill="none" stroke="#FFF8DD" strokeOpacity=".7" strokeWidth="1.5" /><path d="M32 4 24 22H12Z" fill="#fff" fillOpacity=".35" /></>}
    </svg>
  );
}

export function Pips({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <span className="inline-flex gap-1.5" role="img" aria-label={`${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-3.5 w-3.5 rounded-full border-2 transition" style={i < done ? { background: color, borderColor: color, boxShadow: `0 0 10px ${color}` } : { borderColor: "#ffffff55" }} />
      ))}
    </span>
  );
}
