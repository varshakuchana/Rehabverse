"use client";

import { useId, type CSSProperties } from "react";
import type { SessionState } from "@/hooks/useHandsFreeStart";
import type { MovementPhase } from "@/lib/movementEngine";
import styles from "./RehabWorldGame.module.css";

type RehabWorldGameProps = {
  sessionState: SessionState;
  completedReps: number;
  targetReps: number;
  // A stage of the existing attempt, never a depth, speed, or effort target.
  movementProgress: MovementPhase;
  completionMode?: "tracked" | "manual";
};

export default function RehabWorldGame({
  sessionState,
  completedReps,
  targetReps,
  movementProgress,
  completionMode = "tracked",
}: RehabWorldGameProps) {
  const id = useId().replace(/:/g, "");
  const target = Math.max(1, Math.floor(targetReps));
  const restored = Math.min(target, Math.max(0, Math.floor(completedReps)));
  const fraction = restored / target;
  const complete = sessionState === "complete" && restored === target;
  const channeling = sessionState === "active" &&
    (movementProgress === "moving" || movementProgress === "returning");
  const status = complete ? "Quest Complete" : sessionState === "active"
    ? channeling ? "Movement in progress" : completionMode === "manual" ? "Your sparks, your pace" : "Your garden is listening"
    : sessionState === "countdown" ? "A little magic awaits"
    : "Awaken the sleeping garden";

  return (
    <section
      className={styles.world}
      style={{ "--restoration": fraction } as CSSProperties}
      aria-label="Restore the World garden"
      data-complete={complete}
      data-channeling={channeling}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Restore the World · Chapter 01</p>
          <h2>{complete ? "Garden Restored" : "The Starlight Garden"}</h2>
          <p className={styles.subtitle}>{completionMode === "manual" ? "One marked movement. One spark of life." : "One completed movement. One spark of life."}</p>
        </div>
        <span className={styles.badge}>{status}</span>
      </header>

      <div className={styles.scene}>
        <div className={styles.aurora} />
        <svg className={styles.landscape} viewBox="0 0 1000 500" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}-ground`}>
              <stop stopColor="#365b71" />
              <stop offset="1" stopColor="#0e1832" />
            </radialGradient>
            <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#e0fff8" />
              <stop offset=".45" stopColor="#67e8f9" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id={`${id}-island`} x2="0" y2="1">
              <stop stopColor="#233452" />
              <stop offset="1" stopColor="#080d20" />
            </linearGradient>
          </defs>

          {Array.from({ length: 32 }, (_, i) => (
            <circle key={i} cx={30 + (i * 137) % 940} cy={20 + (i * 47) % 245}
              r={i % 4 === 0 ? 2 : 1} fill="#c4b5fd" opacity={0.15 + fraction * 0.55} />
          ))}
          <circle cx="820" cy="80" r="34" fill="#c7d2fe" opacity=".09" />
          <circle cx="831" cy="72" r="29" fill="#10172d" />
          <path d="M0 280 120 185 230 267 360 176 500 280 640 184 775 250 907 169 1000 249V500H0Z" fill="#111b34" />
          <path d="M0 330 180 260 340 326 540 260 720 322 895 264 1000 310V500H0Z" fill="#17213b" />
          <path d="M115 313Q500 175 885 313L785 403 602 430 503 481 388 429 220 400Z" fill={`url(#${id}-island)`} />
          <path d="m220 362 45 39 88 10-56-42m260 40-54 72-30-68m217-62-40 65 71-42" fill="#34425f" opacity=".4" />
          <ellipse cx="500" cy="309" rx="385" ry="113" fill={`url(#${id}-ground)`} />
          <ellipse cx="500" cy="309" rx="365" ry="99" fill="#34d399" opacity={fraction * 0.25} className={styles.fade} />
          <ellipse cx="500" cy="309" rx="300" ry="77" fill="none" stroke="#a5b4fc" strokeDasharray="3 13" opacity=".2" />

          {Array.from({ length: target }, (_, i) => {
            const theta = -Math.PI + (i / target) * Math.PI * 2;
            const x = 500 + Math.cos(theta) * 305;
            const y = 306 + Math.sin(theta) * 77;
            const lit = i < restored;
            return (
              <g key={i} className={styles.node} data-lit={lit} transform={`translate(${x} ${y})`}>
                <path d={`M0 0 ${500 - x} ${309 - y}`} stroke={lit ? "#67e8f9" : "#475569"}
                  strokeWidth={lit ? 2 : 1} opacity={lit ? 0.4 : 0.15} />
                <ellipse rx="34" ry="13" fill={lit ? "#5eead4" : "#050c1c"} opacity={lit ? 0.28 : 0.7} />
                <path d="M0 0V-30M0-9Q-26-8-21-29Q-4-31 0-9M0-18Q24-19 20-37Q2-34 0-18"
                  fill={lit ? "#34d399" : "#28394a"} stroke={lit ? "#6ee7b7" : "#405064"} strokeWidth="2" />
                <path d="M0-59 12-42 0-25-12-42Z" fill={lit ? (i % 2 ? "#c4b5fd" : "#67e8f9") : "#38435e"}
                  stroke={lit ? "#e0f2fe" : "#50607a"} />
                {lit && <circle className={styles.firefly} cx="16" cy="-54" r="2.5" fill="#fef3c7"
                  style={{ animationDelay: `${i * -0.3}s` }} />}
                <text y="25" textAnchor="middle" fill={lit ? "#a7f3d0" : "#71829c"} fontSize="12">{String(i + 1).padStart(2, "0")}</text>
              </g>
            );
          })}

          <ellipse cx="500" cy="319" rx="88" ry="26" fill="#080f26" />
          <ellipse cx="500" cy="313" rx="73" ry="20" fill="none" stroke="#a5b4fc" strokeWidth="2" opacity={0.25 + fraction * 0.65} />
          <path d="M455 290 500 273 545 290V311L500 329 455 311Z" fill="#344563" />
          <path d="M455 290 500 307 545 290 500 273Z" fill="#596986" />
          <g className={styles.core} style={{ opacity: 0.3 + fraction * 0.7 }}>
            <path d="M500 130 539 189 527 259 500 294 473 259 461 189Z" fill={`url(#${id}-core)`} stroke="#c7f9ff" strokeWidth="2" />
            <path d="m500 130-13 70 13 94 13-94Z" fill="#efffff" opacity=".45" />
            <path d="m461 189 26 11 13-70m39 59-26 11-13 94" fill="none" stroke="#e0e7ff" opacity=".65" />
          </g>
          {restored > 0 && (
            <g key={restored} className={styles.energy}>
              <ellipse className={styles.wave} cx="500" cy="307" rx="65" ry="22" fill="none" stroke="#99f6e4" strokeWidth="3" />
              <path className={styles.beam} d="M500 300V150" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" />
            </g>
          )}
          {fraction > 0 && Array.from({ length: restored * 3 }, (_, i) => (
            <circle key={i} className={styles.firefly} cx={220 + (i * 113) % 570} cy={130 + (i * 41) % 220}
              r={i % 3 === 0 ? 2.5 : 1.5} fill={i % 2 ? "#a7f3d0" : "#fde68a"}
              style={{ animationDelay: `${i * -0.27}s` }} />
          ))}
        </svg>
        <div className={styles.sceneCaption} aria-live="polite" aria-atomic="true">
          {complete ? "Every spark has found its home." : restored === 0
            ? "A quiet world, waiting for your first spark."
            : `${restored} of ${target} garden lights restored`}
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.progressLabel}>
          <span>{complete ? "A world full of light" : "Garden restoration"}</span>
          <strong>{Math.round(fraction * 100)}%</strong>
        </div>
        <div className={styles.progress} role="progressbar" aria-label="Garden restoration"
          aria-valuemin={0} aria-valuemax={target} aria-valuenow={restored}>
          {Array.from({ length: target }, (_, i) => <span key={i} data-lit={i < restored} />)}
        </div>
        <p>Movement <span>→</span> energy <span>→</span> a little more life. {completionMode === "manual" ? "Every movement you mark restores one light." : "Every completed movement restores one light."}</p>
      </footer>
    </section>
  );
}
