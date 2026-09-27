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
};
