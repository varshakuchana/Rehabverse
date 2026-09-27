import { parseStored, readStored, writeStored } from "./demoStorage";
import { validateExploreQuest, type ExploreQuest } from "./exploreQuest";
export const EXPLORE_QUEST_KEY = "rehabverse-nova-quest-v1";
export function saveExploreQuest(quest: ExploreQuest) {
  const valid = validateExploreQuest(quest);
  if (!valid) throw new Error("This quest is not in the supported library.");
  writeStored(EXPLORE_QUEST_KEY, valid);
}
export function readExploreQuest() { return readStored(EXPLORE_QUEST_KEY); }
export function decodeExploreQuest(raw: string | null) { return validateExploreQuest(parseStored(raw)); }
