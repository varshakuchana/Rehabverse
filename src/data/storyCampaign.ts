import type { AbilityId, MotionAbility, StoryRealm } from "@/types/story";
import type { QuestDefinition } from "@/types/quest";
import { exploreMovementQuest, shoulderQuests } from "./exploreQuests";
import { storyLines } from "./storyLines";
export { storyLines } from "./storyLines";
export const abilities: Record<AbilityId, MotionAbility> = {
  "lumen-rise": { id: "lumen-rise", name: "Lumen Rise", movement: "Forward Arm Raise · Shoulder Flexion", detectorId: "shoulder_flexion", symbol: "☀", accent: "#F2C14E", meaning: "Send light upward to awaken crystals." },
  "aether-wing": { id: "aether-wing", name: "Aether Wing", movement: "Side Arm Raise · Shoulder Abduction", detectorId: "shoulder_abduction", symbol: "✧", accent: "#B69CFF", meaning: "Spread energy outward to open barriers." },
  "terra-pulse": { id: "terra-pulse", name: "Terra Pulse", movement: "Comfortable Knee Bend · Squat / Sit-to-Stand pattern", detectorId: "knee_flexion", symbol: "◉", accent: "#91D5A0", meaning: "Send a pulse through the ground to awaken structures." },
};
const pattern = (objective: string) => (["lumen-rise", "aether-wing", "terra-pulse"] as const).map(ability => ({ ability, targetActions: 1, objective }));
export const storyRealms: readonly StoryRealm[] = [
  { id: "sleeping-grove", levelId: "grove-light", name: "The Sleeping Grove", subtitle: "I · A light in the leaves", introduction: storyLines.grove, zone: 2, fragment: "Grove Fragment", reward: "lumen-rise", sequence: false,
    stages: [{ ability: "lumen-rise", targetActions: 5, objective: "Awaken five light crystals" }] },
  { id: "crystal-passage", levelId: "passage-gate", name: "The Crystal Passage", subtitle: "II · Beyond the barrier", introduction: storyLines.passage, zone: 0, fragment: "Crystal Fragment", reward: "aether-wing", sequence: false,
    stages: [{ ability: "lumen-rise", targetActions: 2, objective: "Power the two crystal pylons" }, { ability: "aether-wing", targetActions: 2, objective: "Spread light across the crystal gate" }] },
  { id: "sky-ruins", levelId: "ruins-pattern", name: "The Sky Ruins", subtitle: "III · The remembered pattern", introduction: storyLines.ruins, zone: 4, fragment: "Sky Fragment", reward: "terra-pulse", sequence: true,
    stages: [...pattern("Awaken the outer ring"), ...pattern("Open the fragment chamber")] },
  { id: "motion-core", levelId: "core-rebuilt", name: "The Motion Core", subtitle: "Finale · Everything returns to light", introduction: storyLines.core, zone: 1, fragment: null, reward: null, sequence: true,
    stages: [...pattern("Reunite the three fragments"), ...pattern("Ignite the Motion Core")] },
];
export function storyQuest(realm: StoryRealm, stage: number): QuestDefinition {
  const step = realm.stages[stage];
  const ability = abilities[step.ability];
  const base = ability.detectorId === "knee_flexion" ? exploreMovementQuest : shoulderQuests.find(q => q.detectorId === ability.detectorId)!;
  // Shared exercise definition only. Story completion is owned by the presentation adapter,
  // which explicitly bypasses HEP/Explore history persistence.
  return { ...base, exerciseId: `story:${realm.levelId}:${stage}`, target: step.targetActions,
    instructor: { ...base.instructor, name: `${ability.name} — ${ability.movement}`, targetLabel: "Story objective · general movement game",
      prescription: { reps: step.targetActions, repLabel: "motion actions" }, gameDescription: `${ability.meaning} ${step.objective}. One recognized movement is one action.`,
      activeMessage: realm.introduction, completionMessage: "The light is connected. Take a breath before the next stage.",
    },
  };
}
