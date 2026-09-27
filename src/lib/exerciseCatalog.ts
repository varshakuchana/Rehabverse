import { exercises } from "@/data/exercises";
import type { QuestDefinition } from "@/types/quest";
// One query boundary for the local approved catalog. A future adapter can replace it.
// These are game targets, not clinical recommendations or personalized dosage.
const targets: Record<string, readonly number[]> = {
  "hip-flexion": [4, 6, 8], "hip-abduction": [4, 6, 8], "knee-curl": [4, 6, 8], "elbow-flexion": [4, 6, 8],
  squat: [4, 6, 8, 10], "shoulder-flexion": [4, 6, 8], "shoulder-abduction": [4, 6, 8], "ankle-mobility": [4, 6, 8],
};
export function queryExploreCatalog() {
  return exercises.filter(item => item.available && targets[item.id]).map(item => ({
    id: item.id, name: item.name, category: item.category,
    capability: item.quest.trackingCapability, description: item.description,
    cameraRequirements: item.quest.instructor.cameraRequirements,
    allowedTargets: targets[item.id],
  }));
}
export function catalogQuest(exerciseId: string, target: number): QuestDefinition | null {
  const entry = queryExploreCatalog().find(item => item.id === exerciseId);
  const base = exercises.find(item => item.id === exerciseId)?.quest;
  if (!entry || !base || !entry.allowedTargets.includes(target)) return null;
  return { ...base, target, instructor: { ...base.instructor, prescription: { ...base.instructor.prescription, reps: target } } };
}
