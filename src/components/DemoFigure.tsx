"use client";

import { useEffect, useRef } from "react";

/*
  A small looping figure that shows how to do the current exercise.
  Two key poses per movement, eased between with a pause at each end,
  drawn straight to SVG attributes (no React re-render per frame).
*/

type P = [number, number];
type Pose = Record<string, P>;

type Demo = {
  edges: [string, string][];
  a: Pose;
  b: Pose;
  /** seconds for one full out-and-back */
  period: number;
  /** fraction of the cycle spent holding the end pose */
  hold: number;
  /** optional joint that traces a circle instead (ankle circles) */
  circle?: { joint: string; around: string; rx: number; ry: number };
};

// Squat, side view facing right: hips go back, knees forward, arms reach for balance.
const SQUAT: Demo = {
  period: 3.2,
  hold: 0.12,
  edges: [["head", "neck"], ["neck", "hip"], ["hip", "knee"], ["knee", "ankle"], ["ankle", "toe"], ["neck", "elbow"], ["elbow", "hand"]],
  a: { head: [50, 16], neck: [50, 30], hip: [50, 62], knee: [52, 85], ankle: [50, 108], toe: [60, 110], elbow: [63, 32], hand: [77, 32] },
  b: { head: [60, 38], neck: [54, 50], hip: [35, 78], knee: [60, 84], ankle: [50, 108], toe: [60, 110], elbow: [68, 52], hand: [82, 50] },
};

// Arm raise, front view: both arms lift out to the side to shoulder height.
const ARMS: Demo = {
  period: 3.4,
  hold: 0.14,
  edges: [
    ["head", "neck"], ["lS", "rS"], ["neck", "pelvis"], ["lH", "rH"],
    ["lS", "lE"], ["lE", "lW"], ["rS", "rE"], ["rE", "rW"],
    ["lH", "lK"], ["lK", "lA"], ["rH", "rK"], ["rK", "rA"],
  ],
  a: {
    head: [50, 15], neck: [50, 30], pelvis: [50, 62], lS: [40, 32], rS: [60, 32], lH: [44, 62], rH: [56, 62],
    lE: [37, 48], lW: [36, 62], rE: [63, 48], rW: [64, 62], lK: [44, 85], lA: [44, 108], rK: [56, 85], rA: [56, 108],
  },
  b: {
    head: [50, 15], neck: [50, 30], pelvis: [50, 62], lS: [40, 32], rS: [60, 32], lH: [44, 62], rH: [56, 62],
    lE: [25, 30], lW: [11, 28], rE: [75, 30], rW: [89, 28], lK: [44, 85], lA: [44, 108], rK: [56, 85], rA: [56, 108],
  },
};

// Balance, front view: one knee lifts and holds, hand stays near a support.
const BALANCE: Demo = {
  period: 5,
  hold: 0.45,
  edges: [
    ["head", "neck"], ["lS", "rS"], ["neck", "pelvis"], ["lH", "rH"],
    ["lS", "lE"], ["lE", "lW"], ["rS", "rE"], ["rE", "rW"],
    ["lH", "lK"], ["lK", "lA"], ["rH", "rK"], ["rK", "rA"],
  ],
  a: {
    head: [50, 15], neck: [50, 30], pelvis: [50, 62], lS: [40, 32], rS: [60, 32], lH: [44, 62], rH: [56, 62],
    lE: [36, 47], lW: [33, 60], rE: [64, 47], rW: [67, 60], lK: [44, 85], lA: [44, 108], rK: [56, 85], rA: [56, 108],
  },
  b: {
    head: [49, 15], neck: [49, 30], pelvis: [49, 62], lS: [39, 32], rS: [59, 32], lH: [44, 62], rH: [55, 62],
    lE: [33, 44], lW: [27, 54], rE: [66, 44], rW: [73, 54], lK: [44, 85], lA: [44, 108], rK: [60, 74], rA: [58, 94],
  },
};

// Seated ankle circles, side view: the foot traces a slow circle.
const ANKLE: Demo = {
  period: 2.6,
  hold: 0,
  edges: [["head", "neck"], ["neck", "hip"], ["hip", "knee"], ["knee", "ankle"], ["ankle", "toe"], ["neck", "elbow"], ["elbow", "hand"], ["seat", "seatEnd"], ["seatEnd", "leg"]],
  a: { head: [36, 20], neck: [36, 35], hip: [36, 66], knee: [62, 68], ankle: [70, 92], toe: [82, 92], elbow: [42, 52], hand: [52, 64], seat: [26, 70], seatEnd: [52, 70], leg: [52, 108] },
  b: { head: [36, 20], neck: [36, 35], hip: [36, 66], knee: [62, 68], ankle: [70, 92], toe: [82, 92], elbow: [42, 52], hand: [52, 64], seat: [26, 70], seatEnd: [52, 70], leg: [52, 108] },
  circle: { joint: "toe", around: "ankle", rx: 11, ry: 8 },
};

// Forward arm raise (shoulder flexion), side view: one arm swings forward and up.
const FLEX: Demo = {
  period: 3.4,
  hold: 0.14,
  edges: [["head", "neck"], ["neck", "hip"], ["hip", "knee"], ["knee", "ankle"], ["ankle", "toe"], ["neck", "elbow"], ["elbow", "hand"]],
  a: { head: [48, 16], neck: [48, 31], hip: [48, 63], knee: [49, 86], ankle: [48, 108], toe: [58, 110], elbow: [50, 47], hand: [51, 62] },
  b: { head: [48, 16], neck: [48, 31], hip: [48, 63], knee: [49, 86], ankle: [48, 108], toe: [58, 110], elbow: [62, 20], hand: [70, 7] },
};

export type DemoKind = "squat" | "abduction" | "flexion" | "balance" | "ankle";
const DEMOS: Record<DemoKind, Demo> = { squat: SQUAT, abduction: ARMS, flexion: FLEX, balance: BALANCE, ankle: ANKLE };

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** 0 → 1 → 0 over the cycle, with pauses at both ends. */
function mixAt(t: number, hold: number) {
  const move = (1 - hold - 0.1) / 2; // 0.1 of the cycle rests at the start pose
  if (t < 0.1) return 0;
  if (t < 0.1 + move) return ease((t - 0.1) / move);
  if (t < 0.1 + move + hold) return 1;
  return 1 - ease((t - 0.1 - move - hold) / move);
}

export default function DemoFigure({ demo: kind, accent, size = 104 }: { demo: DemoKind; accent: string; size?: number }) {
  const demo = DEMOS[kind];
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const headRef = useRef<SVGCircleElement>(null);
  const floorRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = reduce ? 0.5 : (((now - start) / 1000) % demo.period) / demo.period;
      const m = reduce ? 1 : mixAt(t, demo.hold);
      const at = (k: string): P => {
        if (demo.circle && k === demo.circle.joint) {
          const [cx, cy] = demo.a[demo.circle.around];
          const ang = (reduce ? 0.3 : t) * Math.PI * 2;
          return [cx + Math.cos(ang) * demo.circle.rx, cy + Math.sin(ang) * demo.circle.ry];
        }
        const [ax, ay] = demo.a[k];
        const [bx, by] = demo.b[k];
        return [ax + (bx - ax) * m, ay + (by - ay) * m];
      };
      demo.edges.forEach(([i, j], n) => {
        const el = lineRefs.current[n];
        if (!el) return;
        const [x1, y1] = at(i);
        const [x2, y2] = at(j);
        el.setAttribute("x1", x1.toFixed(2));
        el.setAttribute("y1", y1.toFixed(2));
        el.setAttribute("x2", x2.toFixed(2));
        el.setAttribute("y2", y2.toFixed(2));
      });
      const [hx, hy] = at("head");
      headRef.current?.setAttribute("cx", hx.toFixed(2));
      headRef.current?.setAttribute("cy", hy.toFixed(2));
      floorRef.current?.setAttribute("opacity", (0.25 + 0.35 * m).toFixed(2));
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [demo]);

  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} aria-label="How to do this movement" role="img">
      <defs>
        <filter id="rv-demo-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse ref={floorRef} cx="50" cy="111" rx="26" ry="4" fill={accent} opacity="0.3" />
      <g filter="url(#rv-demo-glow)" stroke={accent} strokeWidth="4.5" strokeLinecap="round">
        {demo.edges.map((_, n) => (
          <line key={`${kind}-${n}`} ref={(el) => { lineRefs.current[n] = el; }} />
        ))}
        <circle ref={headRef} r="7.5" fill={accent} stroke="none" />
      </g>
    </svg>
  );
}
