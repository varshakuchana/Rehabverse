import type { ConfirmedExercise, ExtractedHEP } from "@/types/schedule";
export type ReviewExercise = { included: boolean; exercise: ConfirmedExercise };
export function blankDose(value: unknown): number | null {
  // Template strings never become quantities, even when they contain example digits.
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
export function createHEPReview(plan: ExtractedHEP): ReviewExercise[] {
  return plan.exercises.map(exercise => ({ included: false, exercise: { ...exercise, sets: blankDose(exercise.sets), repetitions: blankDose(exercise.repetitions), holdSeconds: blankDose(exercise.holdSeconds) } }));
}
export function selectedHEP(original: ExtractedHEP, review: ReviewExercise[]): ExtractedHEP {
  return { ...original, exercises: review.filter(item => item.included).map(({ exercise }) => ({ ...exercise, name: exercise.name.trim() })) };
}
export function reviewValid(review: ReviewExercise[]) {
  const selected = review.filter(item => item.included);
  return selected.length > 0 && selected.every(({ exercise: e }) => e.name.trim() && [e.sets, e.repetitions].every(n => n == null || (Number.isSafeInteger(n) && n > 0)) && (e.holdSeconds == null || (Number.isFinite(e.holdSeconds) && e.holdSeconds > 0)));
}

/** Defensive handling when a reader returns template text despite a numeric schema.
 * Do not parse arbitrary prose or infer numbers from instructions.
 */
export function normalizeTemplateFields(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("exercises" in value) || !Array.isArray(value.exercises)) return value;
  return { ...value, exercises: value.exercises.map(item => {
    if (!item || typeof item !== "object") return item;
    const exercise = { ...item };
    for (const key of ["sets", "repetitions", "holdSeconds"]) {
      const field = exercise[key];
      if (typeof field === "string" && /^(?:\s*|[_… .-]+|not specified|not provided|n\/?a|blank)$/i.test(field.trim())) exercise[key] = null;
    }
    return exercise;
  }) };
}
