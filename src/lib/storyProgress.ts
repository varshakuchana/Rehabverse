import { storyRealms } from "@/data/storyCampaign";
import type { AbilityId, RealmId, StoryProgress, StoryRealm, StorySequence } from "@/types/story";
export const initialStory = (): StoryProgress => ({ version: 1, prologueSeen: false, unlockedRealms: ["sleeping-grove"], completedLevels: [], collectedFragments: [], unlockedAbilities: [], currentRealm: null, storyCompleted: false });
export function completeStoryLevel(state: StoryProgress, realmId: RealmId): StoryProgress {
  const index = storyRealms.findIndex(r => r.id === realmId);
  const realm = storyRealms[index];
  if (!realm || !state.unlockedRealms.includes(realmId) || state.completedLevels.includes(realm.levelId)) return state;
  const next = storyRealms[index + 1];
  return { ...state, prologueSeen: true, currentRealm: realmId,
    completedLevels: [...state.completedLevels, realm.levelId],
    collectedFragments: realm.fragment ? [...state.collectedFragments, realm.fragment] : state.collectedFragments,
    unlockedAbilities: realm.reward ? [...state.unlockedAbilities, realm.reward] : state.unlockedAbilities,
    unlockedRealms: next ? [...new Set([...state.unlockedRealms, next.id])] : state.unlockedRealms,
    storyCompleted: realmId === "motion-core" || state.storyCompleted,
  };
}
/** Rebuild derived unlocks from a validated contiguous completion prefix. */
export function decodeStory(raw: string | null): StoryProgress {
  if (!raw) return initialStory();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) throw new Error("Unrecognized Story save. Reset Story Progress to start again.");
  const saved = value as Partial<StoryProgress>;
  if (!Array.isArray(saved.completedLevels) || typeof saved.prologueSeen !== "boolean") throw new Error("Story save could not be read. Reset Story Progress to start again.");
  let state = initialStory();
  for (const realm of storyRealms) {
    if (!saved.completedLevels.includes(realm.levelId)) break;
    state = completeStoryLevel(state, realm.id);
  }
  return { ...state, prologueSeen: saved.prologueSeen || state.completedLevels.length > 0,
    currentRealm: saved.currentRealm && state.unlockedRealms.includes(saved.currentRealm) ? saved.currentRealm : null };
}
export const initialSequence = (): StorySequence => ({ stage: 0, done: false, resets: 0 });
export function advanceSequence(state: StorySequence, realm: StoryRealm, ability: AbilityId): StorySequence {
  if (state.done) return state;
  if (realm.stages[state.stage]?.ability !== ability) return resetSequence(state, realm);
  const next = state.stage + 1;
  return { ...state, stage: Math.min(next, realm.stages.length - 1), done: next === realm.stages.length };
}
export function resetSequence(state: StorySequence, realm: StoryRealm): StorySequence {
  if (state.done || !realm.sequence) return state;
  // Preserve completed patterns; restart only the current three-ability pattern.
  return { stage: Math.floor(state.stage / 3) * 3, done: false, resets: state.resets + 1 };
}
