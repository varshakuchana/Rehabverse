import { novaMessages } from "./novaMessages";
import type { SessionState } from "@/hooks/useHandsFreeStart";
import type { MovementPhase } from "@/lib/movementEngine";

export type InstructorExercise = {
  name: string;
  targetLabel?: string;
  nextStepMessage?: string;
  prescription: {
    reps?: number;
    repLabel?: string;
    sets?: number;
    holdSeconds?: number;
  };
  positioning: string;
  cameraRequirements: string;
  instructions: readonly string[];
  gameDescription: string;
  startInstruction: string;
  safetyMessage: string;
  activeMessage: string;
  completionMessage: string;
};

// Stable text + identity is the future spoken-output boundary. Render this
// same message as text; a future voice adapter can speak it once per change.
export type InstructorMessage = { id: string; text: string };

export function getInstructorMessage({
  exercise,
  sessionState,
  trackingReady,
}: {
  exercise: InstructorExercise;
  sessionState: SessionState;
  trackingReady: boolean;
  movementPhase: MovementPhase;
}): InstructorMessage {
  if (sessionState === "complete") {
    return { id: "complete", text: exercise.completionMessage };
  }
  if ((sessionState === "active" || sessionState === "countdown") && !trackingReady) {
    return { id: "tracking-lost", text: novaMessages.trackingLost };
  }
  switch (sessionState) {
    case "ready":
      return { id: "ready", text: 'You\'re in position. Say "Start" when you\'re ready.' };
    case "countdown":
      return { id: "countdown", text: "Get ready..." };
    case "active":
      return { id: "active", text: exercise.activeMessage };
    default:
      return { id: "positioning", text: `${exercise.positioning} ${exercise.cameraRequirements}` };
  }
}

export function formatPrescription(prescription: InstructorExercise["prescription"]) {
  return [
    prescription.sets !== undefined ? `${prescription.sets} ${prescription.sets === 1 ? "set" : "sets"}` : null,
    prescription.reps !== undefined ? `${prescription.reps} ${prescription.repLabel ?? "movements"}` : null,
    prescription.holdSeconds !== undefined ? `${prescription.holdSeconds}-second holds` : null,
  ].filter(Boolean).join(" · ");
}
