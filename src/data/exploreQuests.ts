import { detectors } from "@/lib/movementDetectors";
import { novaMessages } from "@/lib/novaMessages";
import type { QuestDefinition } from "@/types/quest";
import { movementQuest, MOVEMENT_QUEST_TARGET } from "./movementQuest";

const safetyMessage = "This is a general movement experience, not treatment or medical dosage. Move comfortably, pause whenever you like, and stop if you experience discomfort. Follow any existing care-plan limits.";
export const exploreMovementQuest: QuestDefinition = {
  exerciseId: "movement-quest", source: "explore", trackingCapability: "interactive", detectorId: "knee_flexion", target: MOVEMENT_QUEST_TARGET,
  instructor: {
    ...movementQuest,
    targetLabel: "Explore challenge · not medical dosage",
    instructions: ["Begin standing comfortably. Bend your knees within a comfortable movement, then return to your starting position.", "There is no depth or speed goal. Each recognized completed movement earns one spark."],
    safetyMessage,
  },
};

function guidedQuest(id: string, name: string, target: number, positioning: string, instructions: string[]): QuestDefinition {
  return {
    exerciseId: id, source: "explore", trackingCapability: "guided", target,
    instructor: {
      name, prescription: { reps: target, repLabel: "self-reported movements" },
      targetLabel: "Explore challenge · not medical dosage",
      nextStepMessage: "Next: press Start. No camera or microphone needed.",
      positioning,
      cameraRequirements: "No camera is used. You mark each completed movement yourself; RehabVerse does not verify movement or form.",
      instructions,
      gameDescription: "Each movement you mark as complete sends one spark to the garden. There are no bonuses for moving farther or faster.",
      startInstruction: 'Press Start on the next screen. After each movement, select "Mark one movement". When the challenge target is reached, choose "Complete Quest" to save it.',
      activeMessage: novaMessages.guidedActive,
      completionMessage: novaMessages.guidedComplete,
      safetyMessage,
    },
  };
}
export const guidedQuests: QuestDefinition[] = [
  guidedQuest("arm-raise", "Starlight Arm Raise", 6,
    "Sit or stand in a comfortable, stable position with space around your arms.",
    ["Lift one arm only as far as feels comfortable, then return it to your starting position.", "A lift and return is one movement. You can alternate arms; there is no required height."]),
  guidedQuest("ankle-mobility", "Seated Ankle Orbit", 8,
    "Sit comfortably on a stable chair with your feet near the floor.",
    ["Move one ankle in a comfortable small circle, then let it settle. That is one movement.", "Choose a direction that feels comfortable and alternate feet if you like. There is no circle-size or speed goal."]),
];

export const shoulderQuests: QuestDefinition[] = (["shoulder_flexion", "shoulder_abduction"] as const).map(detectorId => ({
  exerciseId: detectorId.replaceAll("_", "-"), source: "explore", trackingCapability: "interactive", detectorId, target: 6,
  instructor: {
    ...exploreMovementQuest.instructor,
    name: detectorId === "shoulder_flexion" ? "Forward Arm Light" : "Side Arm Starlight",
    prescription: { reps: 6, repLabel: "movements" },
    positioning: detectors[detectorId].positioning,
    cameraRequirements: detectors[detectorId].cameraRequirements,
    instructions: [detectorId === "shoulder_flexion" ? "With your side toward the camera, move your visible arm forward comfortably, then return it to your starting position." : "Facing the camera, move one arm out to the side comfortably, then return it to your starting position.", "Use the same arm throughout. Choose Left or Right before enabling the camera. There is no height or speed goal. Pause whenever you like.", "The tracker reads movement in the camera view. It does not evaluate form or determine medical correctness."],
  },
}));
