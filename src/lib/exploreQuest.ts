import { catalogQuest, queryExploreCatalog } from "./exerciseCatalog";
import { WELLNESS_LABEL } from "./exploreSafety";
export type ExploreQuest = { title: string; description: string; exercises: { exerciseId: string; targetReps: number }[] };
export const QUEST_TITLE = "Your Nova Movement Quest";
export const QUEST_DESCRIPTION = "A short journey through the supported movement library. Each completed movement restores the garden. Take breaks whenever you like.";
export function validateExploreQuest(value: unknown): ExploreQuest | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.title !== QUEST_TITLE || item.description !== QUEST_DESCRIPTION || !Array.isArray(item.exercises) || item.exercises.length < 1 || item.exercises.length > 3) return null;
  const seen = new Set<string>();
  const steps: ExploreQuest["exercises"] = [];
  for (const step of item.exercises) {
    if (!step || typeof step !== "object" || typeof step.exerciseId !== "string" || !Number.isSafeInteger(step.targetReps) || !catalogQuest(step.exerciseId, step.targetReps) || seen.has(step.exerciseId)) return null;
    seen.add(step.exerciseId);
    steps.push({ exerciseId: step.exerciseId, targetReps: step.targetReps });
  }
  return { title: QUEST_TITLE, description: QUEST_DESCRIPTION, exercises: steps };
}
export function generatedStep(step: ExploreQuest["exercises"][number]) {
  const definition = catalogQuest(step.exerciseId, step.targetReps);
  if (!definition) return null;
  return { ...definition, instructor: { ...definition.instructor, targetLabel: WELLNESS_LABEL } };
}
export function catalogForPrompt() { return JSON.stringify(queryExploreCatalog()); }
