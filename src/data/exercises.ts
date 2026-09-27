import { detectors } from "@/lib/movementDetectors";
import type { Exercise } from "@/types/exercise";
import { exploreMovementQuest, guidedQuests, shoulderQuests } from "./exploreQuests";

export const exercises: Exercise[] = [
  {
    id: "squat", name: "Movement Quest",
    description: "Send real-time movement energy into a sleeping garden. Your camera recognizes each completed movement and the world responds.",
    category: "Lower Body", trackingCapability: "interactive",
    tracking: { type: "pose", measurement: "knee-angle", requiredLandmarks: [23, 24, 25, 26, 27, 28] },
    gameMechanic: "movement-energy",
    tutorial: { shortInstruction: exploreMovementQuest.instructor.cameraRequirements, steps: [...exploreMovementQuest.instructor.instructions] },
    sessionRoute: "/session/squat", available: true, quest: exploreMovementQuest,
  },
  ...shoulderQuests.map((quest): Exercise => ({
    id: quest.exerciseId, name: quest.instructor.name,
    description: "Move your arm and return to send energy into the garden. Camera tracking recognizes the movement in the instructed view.",
    category: "Upper Body", trackingCapability: "interactive",
    tracking: { type: "pose", measurement: quest.detectorId, requiredLandmarks: detectors[quest.detectorId!].landmarks },
    gameMechanic: "movement-energy", tutorial: { shortInstruction: quest.instructor.cameraRequirements, steps: [...quest.instructor.instructions] },
    sessionRoute: `/session/squat?exercise=${quest.exerciseId}`, available: true, quest,
  })),
  ...guidedQuests.map((quest): Exercise => ({
    id: quest.exerciseId, name: quest.instructor.name,
    description: quest.exerciseId === "arm-raise"
      ? "Lift, return, and send a spark. Explore comfortable arm movements with Nova, marking your own progress."
      : "A seated movement moment for your ankles. Trace comfortable circles and bring the garden lights back, one at a time.",
    category: quest.exerciseId === "arm-raise" ? "Upper Body" : "Lower Body",
    trackingCapability: "guided", tracking: { type: "none" }, gameMechanic: "movement-energy",
    tutorial: { shortInstruction: quest.instructor.positioning, steps: [...quest.instructor.instructions] },
    sessionRoute: `/explore/guided/${quest.exerciseId}`, available: true, quest,
  })),
];
