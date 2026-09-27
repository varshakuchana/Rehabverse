import type { InstructorExercise } from "@/lib/exerciseInstructor";

// Shared presentation/session configuration; runtime progress belongs to each
// session controller, never to the garden or the catalog.
export type QuestDefinition = {
  exerciseId: string;
  source: "hep" | "explore";
  trackingCapability: "interactive" | "guided";
  instructor: InstructorExercise;
  target: number;
  detectorId?: import("@/lib/movementDetectors").DetectorId;
  trackingMode?: Exclude<import("@/lib/movementPrimitives").TrackingMode, "guided">;
  trackedSide?: import("@/lib/movementDetectors").TrackedSide;
  holdSeconds?: number;
  planId?: string;
  prescribedSets?: number;
};
