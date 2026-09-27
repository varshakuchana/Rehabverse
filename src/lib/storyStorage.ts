import { decodeStory, initialStory, completeStoryLevel } from "./storyProgress";
import type { RealmId, StoryProgress } from "@/types/story";
export const STORY_STORAGE_KEY = "rehabverse.story.v1";
export function readStory(): StoryProgress { return decodeStory(localStorage.getItem(STORY_STORAGE_KEY)); }
function write(state: StoryProgress) { localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(state)); return state; }
export function beginStory() { return write({ ...readStory(), prologueSeen: true }); }
export function enterStoryRealm(id: RealmId) {
  const state = readStory();
  if (!state.unlockedRealms.includes(id)) throw new Error("This realm is still locked.");
  return write({ ...state, currentRealm: id });
}
export function saveStoryCompletion(id: RealmId) {
  const state = readStory();
  if (!state.unlockedRealms.includes(id)) throw new Error("This realm is no longer unlocked. Return to the map after checking Story progress.");
  return write(completeStoryLevel(state, id));
}
export function resetStory() { return write(initialStory()); }
