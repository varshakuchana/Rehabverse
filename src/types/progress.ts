export type CompletedSession = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  completedAt: string;
  completedLocalDate: string;
  completedReps: number;
  targetReps: number;
  prescribedSets?: number;
  status: "complete";
  completionMethod?: "camera-tracked" | "self-reported";
  score: number;
  source: "hep" | "explore";
  planId?: string;
};
