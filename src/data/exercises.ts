import type { Exercise } from "@/types/exercise";

export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Squat",
    description: "A camera-tracked lower-body movement experience.",
    category: "Lower Body",

    trackingCapability: "interactive",

    tracking: {
      type: "pose",
      measurement: "knee-angle",
      requiredLandmarks: [23, 24, 25, 26, 27, 28],
    },

    gameMechanic: "movement-energy",

    tutorial: {
      shortInstruction:
        "Position your full body in view and move at a comfortable pace.",
      steps: [
        "Stand where your hips, knees, and ankles are visible.",
        "Begin from a comfortable standing position.",
        "Lower with control.",
        "Return to your starting position.",
      ],
    },

    sessionRoute: "/session/squat",
    available: true,
  },

  {
    id: "arm-raise",
    name: "Arm Raise",
    description:
      "Use upper-body movement to power a RehabVerse challenge.",
    category: "Upper Body",

    trackingCapability: "interactive",

    tracking: {
      type: "pose",
      measurement: "shoulder-angle",
      requiredLandmarks: [11, 12, 13, 14, 15, 16],
    },

    gameMechanic: "movement-energy",

    tutorial: {
      shortInstruction:
        "Keep your upper body visible while performing the movement.",
      steps: [
        "Face the camera.",
        "Keep your shoulders and arms visible.",
        "Raise your arm comfortably.",
        "Return with control.",
      ],
    },

    available: false,
  },

  {
    id: "balance-hold",
    name: "Balance Hold",
    description:
      "Maintain a tracked position to charge energy in RehabVerse.",
    category: "Balance",

    trackingCapability: "hold",

    tracking: {
      type: "pose",
      measurement: "position-duration",
    },

    gameMechanic: "hold-charge",

    tutorial: {
      shortInstruction:
        "Maintain the demonstrated position for the challenge duration.",
      steps: [
        "Position yourself where your body is visible.",
        "Follow the demonstrated starting position.",
        "Maintain the position comfortably.",
        "Reset whenever you need to.",
      ],
    },

    available: false,
  },
];

export function getExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id);
}