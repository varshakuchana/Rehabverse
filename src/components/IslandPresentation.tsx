"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { AbilityId } from "@/types/story";
import type { PosePoint } from "@/lib/movementDetectors";
import type { RehabWorldEngine } from "@/lib/rehabWorld/engine";

type Props = {
  completedReps?: number;
  targetReps?: number;
  channeling?: boolean;
  backdrop?: boolean;
  children?: ReactNode;
  focus?: number | null;
  zoneProgress?: readonly number[];
  ability?: AbilityId;
  finale?: boolean;
  celebrated?: boolean;
  landmarks?: RefObject<PosePoint[] | null>;
  bodyReady?: boolean;
};

/** Display-only adapter. Session owners remain responsible for counts and completion. */
export default function IslandPresentation({ completedReps = 0, targetReps = 1, channeling = false, backdrop = false, children, focus, zoneProgress, ability, finale = false, celebrated = false, landmarks, bodyReady = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RehabWorldEngine | null>(null);
  const latest = useRef({ completedReps, targetReps, channeling, focus, zoneProgress, ability, finale, celebrated, landmarks, bodyReady });
  const previous = useRef(completedReps);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    latest.current = { completedReps, targetReps, channeling, focus, zoneProgress, ability, finale, celebrated, landmarks, bodyReady };
    const engine = engineRef.current;
    if (!engine) return;
    if (ability) engine.setStoryAbility(ability, focus ?? 0, finale);
    if (focus === null) engine.overview();
    else if (focus !== undefined && !ability) engine.focusZone(focus);
    engine.setReady(bodyReady);
    const fraction = Math.min(1, Math.max(0, completedReps / Math.max(1, targetReps)));
    if (completedReps < previous.current) engine.cancelEffects();
    if (completedReps > previous.current) engine.releaseEnergy(fraction);
    // Story supplies campaign restoration per zone; ordinary quests use one session fraction.
    for (let i = 0; i < engine.zoneCount(); i++) engine.setZoneProgress(i, zoneProgress?.[i] ?? fraction);
    engine.setEnergy(channeling ? 0.55 : 0);
    if (celebrated) engine.celebrateStory(finale);
    previous.current = completedReps;
  }, [completedReps, targetReps, channeling, backdrop, focus, zoneProgress, ability, finale, celebrated, landmarks, bodyReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: RehabWorldEngine | null = null;
    let observer: ResizeObserver | null = null;
    let poseFrame = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function stop() {
      cancelAnimationFrame(poseFrame);
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
        if (current.ability) engine.setStoryAbility(current.ability, current.focus ?? 0, current.finale);
        if (current.focus === null) engine.overview();
        else if (current.focus !== undefined && !current.ability) engine.focusZone(current.focus);
        for (let i = 0; i < engine.zoneCount(); i++) engine.setZoneProgress(i, current.zoneProgress?.[i] ?? fraction);
        engine.setReady(current.bodyReady);
        if (current.celebrated) engine.celebrateStory(current.finale);
        engine.setEnergy(current.channeling ? 0.55 : 0);
        previous.current = current.completedReps;
        engineRef.current = engine;
        observer = new ResizeObserver(() => engine?.resize());
        observer.observe(canvas!);
        visibility();
        if (latest.current.landmarks) {
          const feedPose = () => {
            if (cancelled) return;
            engine?.setLandmarks(latest.current.landmarks?.current ?? null);
            poseFrame = requestAnimationFrame(feedPose);
          };
          feedPose();
        }
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
