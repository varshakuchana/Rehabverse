import type { QuestDefinition } from "./quest";

export type TrackingCapability =
  | "interactive"
  | "guided"
  | "hold"
  | "manual";

export type MovementMechanic =
  | "movement-energy"
  | "hold-charge"
  | "direction-control"
  | "balance";

export type Exercise = {
  id: string;
  name: string;
  description: string;

  category: "Lower Body" | "Upper Body" | "Full Body" | "Balance";

  trackingCapability: TrackingCapability;

  tracking: {
    type: "pose" | "hands" | "none";
    measurement?: string;
    requiredLandmarks?: number[];
  };

  gameMechanic: MovementMechanic;

  tutorial: {
    shortInstruction: string;
    steps: string[];
  };

  sessionRoute?: string;

  available: boolean;
  quest: QuestDefinition;
};