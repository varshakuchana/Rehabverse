"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { RehabWorldEngine } from "@/lib/rehabWorld/engine";

type Props = {
  completedReps?: number;
  targetReps?: number;
  channeling?: boolean;
  backdrop?: boolean;
  children?: ReactNode;
};

/** Display-only adapter. Session owners remain responsible for counts and completion. */
export default function IslandPresentation({ completedReps = 0, targetReps = 1, channeling = false, backdrop = false, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RehabWorldEngine | null>(null);
  const latest = useRef({ completedReps, targetReps, channeling });
  const previous = useRef(completedReps);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    latest.current = { completedReps, targetReps, channeling };
    const engine = engineRef.current;
    if (!engine || backdrop) return;
    const fraction = Math.min(1, Math.max(0, completedReps / Math.max(1, targetReps)));
    if (completedReps < previous.current) engine.cancelEffects();
    if (completedReps > previous.current) engine.releaseEnergy(fraction);
    // All zones reflect the same authoritative session fraction, never independent progress.
    for (let i = 0; i < engine.zoneCount(); i++) engine.setZoneProgress(i, fraction);
    engine.setEnergy(channeling ? 0.55 : 0);
    previous.current = completedReps;
  }, [completedReps, targetReps, channeling, backdrop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: RehabWorldEngine | null = null;
    let observer: ResizeObserver | null = null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function stop() {
      observer?.disconnect();
      observer = null;
      engine?.dispose();
      engine = null;
      engineRef.current = null;
    }
    function fallback() {
      cancelled = true;
      stop();
      setReady(false);
    }
    const contextLost = (event: Event) => { event.preventDefault(); fallback(); };
    const visibility = () => engine?.setPaused(document.hidden);
    canvas.addEventListener("webglcontextlost", contextLost);
    motion.addEventListener("change", fallback);
    document.addEventListener("visibilitychange", visibility);
    async function init() {
      if (motion.matches) return;
      try {
        const { RehabWorldEngine } = await import("@/lib/rehabWorld/engine");
        if (cancelled) return;
        engine = new RehabWorldEngine(canvas!);
        engine.showSessionElements(!backdrop);
        engine.overview();
        const current = latest.current;
        const fraction = Math.min(1, Math.max(0, current.completedReps / Math.max(1, current.targetReps)));
        for (let i = 0; i < engine.zoneCount(); i++) engine.setZoneProgress(i, fraction);
        engine.setEnergy(current.channeling ? 0.55 : 0);
        previous.current = current.completedReps;
        engineRef.current = engine;
        observer = new ResizeObserver(() => engine?.resize());
        observer.observe(canvas!);
        visibility();
        setReady(true);
      } catch {
        fallback();
      }
    }
    void init();
    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", contextLost);
      motion.removeEventListener("change", fallback);
      document.removeEventListener("visibilitychange", visibility);
      stop();
    };
  }, [backdrop]);

  return (
    <div className={`rv-island ${backdrop ? "rv-island-backdrop" : ""}`} data-ready={ready}>
      <div className="rv-island-fallback">{children}</div>
      <canvas ref={canvasRef} aria-hidden="true" className="rv-island-canvas" />
    </div>
  );
}
