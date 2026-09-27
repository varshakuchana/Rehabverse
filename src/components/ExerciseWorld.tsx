"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { MovementPhase } from "@/lib/movementEngine";
import type { PosePoint } from "@/lib/movementDetectors";
import type { SessionWorld, WorldKind } from "@/lib/rehabWorld/worlds";
import { THEMES } from "@/lib/worldTheme";

/*
  Display-only adapter for the per-exercise worlds, following the same rules
  as IslandPresentation: it receives the completed count, the target and a
  phase cue from the session owner. It never detects, counts, starts,
  completes or saves anything. Energy is a phase cue, not movement depth.
  Reduced motion, WebGL failure or context loss show `fallback` instead.
*/
type Props = {
  world: WorldKind;
  completed: number;
  target: number;
  /** true while a session is running */
  active: boolean;
  phase?: MovementPhase;
  bodyReady?: boolean;
  landmarks?: RefObject<PosePoint[] | null>;
  /** brief pulse for marked (Guided) movements */
  pulseKey?: number;
  fallback: ReactNode;
};

export default function ExerciseWorld({ world, completed, target, active, phase = "waiting", bodyReady = false, landmarks, pulseKey = 0, fallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SessionWorld | null>(null);
  const previous = useRef(completed);
  const latest = useRef({ completed, target, active, phase, bodyReady, landmarks });
  const [ready, setReady] = useState(false);
  const theme = THEMES[world];
  const fraction = Math.min(1, Math.max(0, completed / Math.max(1, target)));

  useLayoutEffect(() => {
    latest.current = { completed, target, active, phase, bodyReady, landmarks };
    const engine = engineRef.current;
    if (!engine) return;
    engine.setReady(bodyReady);
    const f = Math.min(1, Math.max(0, completed / Math.max(1, target)));
    if (completed > previous.current) engine.completeRep(f);
    else if (completed < previous.current) engine.setProgressInstant(f);
    previous.current = completed;
    engine.setEnergy(active ? (phase === "moving" ? 1 : phase === "returning" ? 0.6 : 0) : 0);
  }, [completed, target, active, phase, bodyReady, landmarks]);

  // Guided quests: a short glow when a movement is marked.
  useEffect(() => {
    if (!pulseKey) return;
    const engine = engineRef.current;
    engine?.setEnergy(1);
    const t = window.setTimeout(() => engine?.setEnergy(0), 350);
    return () => window.clearTimeout(t);
  }, [pulseKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: SessionWorld | null = null;
    let observer: ResizeObserver | null = null;
    let poseFrame = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      cancelAnimationFrame(poseFrame);
      observer?.disconnect();
      observer = null;
      engine?.dispose();
      engine = null;
      engineRef.current = null;
    };
    const fallbackNow = () => { cancelled = true; stop(); setReady(false); };
    const contextLost = (e: Event) => { e.preventDefault(); fallbackNow(); };
    const visibility = () => engine?.setPaused(document.hidden);
    canvas.addEventListener("webglcontextlost", contextLost);
    motion.addEventListener("change", fallbackNow);
    document.addEventListener("visibilitychange", visibility);

    (async () => {
      if (motion.matches) return;
      try {
        const { SessionWorld } = await import("@/lib/rehabWorld/worlds");
        if (cancelled) return;
        const cur = latest.current;
        engine = new SessionWorld(canvas, world, cur.target, THEMES[world].accent);
        engine.setProgressInstant(Math.min(1, cur.completed / Math.max(1, cur.target)));
        engine.setReady(cur.bodyReady);
        previous.current = cur.completed;
        engineRef.current = engine;
        observer = new ResizeObserver(() => engine?.resize());
        observer.observe(canvas);
        visibility();
        const feed = () => {
          if (cancelled) return;
          engine?.setLandmarks(latest.current.landmarks?.current ?? null);
          poseFrame = requestAnimationFrame(feed);
        };
        feed();
        setReady(true);
      } catch {
        fallbackNow();
      }
    })();

    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", contextLost);
      motion.removeEventListener("change", fallbackNow);
      document.removeEventListener("visibilitychange", visibility);
      stop();
    };
    // One world per mount; target changes remount via key.
  }, [world]);

  return (
    <div className="absolute inset-0" data-world={world} data-ready={ready}>
      <div aria-hidden className="absolute inset-0" style={{ background: theme.skyDim }} />
      <div aria-hidden className="absolute inset-0 transition-opacity duration-1000" style={{ background: theme.skyBright, opacity: fraction * 0.9 }} />
      {!ready && <div className="absolute inset-0 overflow-hidden [&>section]:h-full">{fallback}</div>}
      <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
