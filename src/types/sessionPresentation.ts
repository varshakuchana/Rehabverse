import type { ReactNode, RefObject } from "react";
import type { SessionState } from "@/hooks/useHandsFreeStart";
import type { MovementPhase } from "@/lib/movementEngine";
import type { PosePoint } from "@/lib/movementDetectors";
export type SessionVisualState = { sessionState: SessionState; reps: number; target: number; movementPhase: MovementPhase; bodyDetected: boolean; landmarks: RefObject<PosePoint[] | null> };
/** Optional host for the shared tracker. Never supplies or mutates rep counts. */
export type SessionPresentation = {
  mode: "story";
  onComplete: () => void;
  onExit: () => void;
  onTrackingLost: () => void;
  renderWorld: (state: SessionVisualState) => ReactNode;
  /** Camera permission was already granted this run: turn the camera back on without another click. */
  autoCamera?: boolean;
  /** Go straight to the session; the Story guide explains the movement instead of a tutorial card. */
  skipIntro?: boolean;
  /** Start the countdown automatically once tracking is ready (the player already started this run). */
  autoStart?: boolean;
};
