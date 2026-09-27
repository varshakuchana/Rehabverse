import type { ConfirmedExercise, ConfirmedPlan } from "./schedule";

export type ComparableHEP = Pick<ConfirmedPlan, "sourceFileName" | "exercises" | "frequency" | "generalInstructions">;
export type ChangeCategory = "Added" | "Removed" | "Changed" | "Unchanged";
export type FieldDifference = { field: string; before: string; after: string };
export type ExerciseDifference = {
  category: ChangeCategory;
  before?: ConfirmedExercise;
  after?: ConfirmedExercise;
  fields: FieldDifference[];
};
export type HEPComparison = {
  exercises: ExerciseDifference[];
  planFields: FieldDifference[];
  hasDuplicateNames: boolean;
};
