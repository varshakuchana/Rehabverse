
/*
  The Story guide: a small robot that acts out what to do right now.
  Pose names map to CSS animations in story.css. Decorative; the text
  bubble next to it carries the actual instruction.
*/
export type BotPose = "wave" | "lumen-rise" | "aether-wing" | "terra-pulse" | "cheer" | "look";

export default function Cutebot({ pose, accent, size = 104 }: { pose: BotPose; accent: string; size?: number }) {
  return (
    <svg viewBox="0 0 120 140" width={size} height={size * 140 / 120} aria-hidden className={`cutebot cb-${pose}`} style={{ ["--cb" as string]: accent }}>
      <ellipse cx="60" cy="133" rx="30" ry="5" fill="#000" opacity=".3" className="cb-shadow" />
      <g className="cb-rig">
        {/* legs */}
        <g className="cb-legs">
          <rect x="45" y="96" width="11" height="28" rx="5.5" fill="#C9CEDF" />
          <rect x="64" y="96" width="11" height="28" rx="5.5" fill="#C9CEDF" />
          <rect x="41" y="121" width="17" height="8" rx="4" fill="#8E95B2" />
          <rect x="62" y="121" width="17" height="8" rx="4" fill="#8E95B2" />
        </g>
        <g className="cb-upper">
          {/* arms (behind body) */}
          <g className="cb-arm cb-arm-l"><rect x="27" y="62" width="11" height="30" rx="5.5" fill="#DDE1EE" /><circle cx="32.5" cy="93" r="6" fill="#8E95B2" /></g>
          <g className="cb-arm cb-arm-r"><rect x="82" y="62" width="11" height="30" rx="5.5" fill="#DDE1EE" /><circle cx="87.5" cy="93" r="6" fill="#8E95B2" /></g>
          {/* body */}
          <rect x="36" y="58" width="48" height="42" rx="14" fill="#EEF1F8" />
          <circle cx="60" cy="78" r="7" fill="var(--cb)" className="cb-core" />
          {/* head */}
          <g className="cb-head">
            <line x1="60" y1="14" x2="60" y2="4" stroke="#C9CEDF" strokeWidth="3" strokeLinecap="round" />
            <path d="m60-4 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="var(--cb)" className="cb-star" />
            <rect x="26" y="14" width="68" height="44" rx="18" fill="#F4F6FB" />
            <rect x="33" y="21" width="54" height="30" rx="13" fill="#1B1F3B" />
            <g className="cb-eyes">
              <ellipse cx="48" cy="35" rx="5" ry="6" fill="#8FF3FF" />
              <ellipse cx="72" cy="35" rx="5" ry="6" fill="#8FF3FF" />
            </g>
            <path d="M52 44q8 5 16 0" stroke="#8FF3FF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="37" cy="45" r="3" fill="#FF9FB5" opacity=".7" /><circle cx="83" cy="45" r="3" fill="#FF9FB5" opacity=".7" />
          </g>
        </g>
      </g>
    </svg>
  );
}
