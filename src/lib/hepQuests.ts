import { movementQuest } from "@/data/movementQuest";
import { detectors, detectorForExercise } from "./movementDetectors";
import { novaMessages } from "./novaMessages";
import type { ConfirmedExercise, ConfirmedPlan } from "@/types/schedule";
import type { QuestDefinition } from "@/types/quest";
export function hepCapability(exercise: ConfirmedExercise): "interactive" | "guided" | "reference" {
  const reps = exercise.repetitions;
  if (!Number.isSafeInteger(reps) || reps! <= 0 || (exercise.sets != null && (!Number.isSafeInteger(exercise.sets) || exercise.sets <= 0)) || !Number.isSafeInteger(reps! * (exercise.sets ?? 1)) || (exercise.holdSeconds != null && (!Number.isFinite(exercise.holdSeconds) || exercise.holdSeconds <= 0))) return "reference";
  // Holds remain self-reported; the camera does not verify hold duration.
  if (detectorForExercise(exercise.name) && !exercise.holdSeconds) return "interactive";
  return exercise.instructions?.trim() ? "guided" : "reference";
}
export function hepQuest(plan: ConfirmedPlan, index: number): QuestDefinition | null {
  const exercise = plan.exercises[index];
  if (!exercise) return null;
  const capability = hepCapability(exercise);
  if (capability === "reference") return null;
  const detectorId = capability === "interactive" ? detectorForExercise(exercise.name) : undefined;
  const camera = detectorId ? detectors[detectorId] : null;
  const target = exercise.repetitions! * (exercise.sets ?? 1);
  return {
    exerciseId: `${plan.id}:${index}`, source: "hep", planId: plan.id, target,
    prescribedSets: exercise.sets ?? undefined, holdSeconds: exercise.holdSeconds ?? undefined,
    trackingCapability: capability, detectorId,
    instructor: {
      ...movementQuest, name: exercise.name, targetLabel: "Confirmed HEP dosage",
      prescription: { reps: exercise.repetitions!, sets: exercise.sets ?? undefined, holdSeconds: exercise.holdSeconds ?? undefined, repLabel: exercise.sets ? "reps per set" : "reps" },
      positioning: camera?.positioning ?? "Follow the positioning instructions in your confirmed HEP.",
      cameraRequirements: camera?.cameraRequirements ?? "No camera is used. Completion is self-reported, not automatically verified.",
      instructions: [exercise.instructions, exercise.notes, ...(plan.generalInstructions ?? []), `${target} total movements. Follow your plan's set breaks and hold instructions.`].filter((text): text is string => Boolean(text)),
      ...(capability === "guided" ? {
        nextStepMessage: "Next: press Start. No camera or microphone needed.",
        startInstruction: 'Press Start, follow your confirmed instructions, and mark each repetition yourself. Select Complete Quest to save.',
        activeMessage: novaMessages.guidedActive, completionMessage: novaMessages.guidedComplete,
        gameDescription: "Each movement you mark restores the garden. Camera tracking does not verify these movements or holds.",
      } : {}),
    },
  };
}
