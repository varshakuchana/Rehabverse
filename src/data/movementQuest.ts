import { novaMessages } from "@/lib/novaMessages";
import type { InstructorExercise } from "@/lib/exerciseInstructor";

// Shared by tutorial, rep cap, completion copy, and garden presentation.
export const MOVEMENT_QUEST_TARGET = 10;

export const movementQuest: InstructorExercise = {
  name: "Movement Quest",
  prescription: { reps: MOVEMENT_QUEST_TARGET, repLabel: "movements" },
  positioning: "Begin in a comfortable standing position.",
  cameraRequirements: "Position the camera so your hips, knees, and ankles are visible. No hand gesture or full-body view is needed.",
  instructions: [
    "Follow the movement in your existing care plan.",
    "Return to your starting position after each movement.",
  ],
  gameDescription: "Each completed movement sends energy into the world and restores one part of the garden. Every completed movement earns the same spark.",
  startInstruction: 'Enable Camera on the next screen. Once tracking is ready, say "Start" or "begin", or use the manual Start button. Wait for the 3–2–1 countdown and GO before beginning.',
  activeMessage: novaMessages.active,
  completionMessage: novaMessages.complete,
  safetyMessage: "Follow your existing care plan and move comfortably within its limits. Stop if you experience discomfort.",
};
