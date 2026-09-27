import type { DetectorId } from "@/lib/movementDetectors";
export type AbilityId = "lumen-rise" | "aether-wing" | "terra-pulse";
export type RealmId = "sleeping-grove" | "crystal-passage" | "sky-ruins" | "motion-core";
export type StoryStage = { ability: AbilityId; targetActions: number; objective: string };
export type StoryRealm = {
  id: RealmId; levelId: string; name: string; subtitle: string; introduction: string;
  zone: number; fragment: string | null; reward: AbilityId | null;
  sequence: boolean; stages: readonly StoryStage[];
};
export type MotionAbility = { id: AbilityId; name: string; movement: string; detectorId: DetectorId; symbol: string; accent: string; meaning: string };
export type StoryProgress = {
  version: 1; prologueSeen: boolean; unlockedRealms: RealmId[]; completedLevels: string[];
  collectedFragments: string[]; unlockedAbilities: AbilityId[];
  currentRealm: RealmId | null; storyCompleted: boolean;
};
// Objectives, not another rep counter. Only the shared tracker completes a stage.
export type StorySequence = { stage: number; done: boolean; resets: number };
