import type { ConfirmedExercise, ConfirmedPlan, ExtractedHEP } from "@/types/schedule";
export type ReviewExercise = { included: boolean; exercise: ConfirmedExercise };
export function blankDose(value: unknown): number | null {
  // Template strings never become quantities, even when they contain example digits.
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
export function createHEPReview(plan: ExtractedHEP): ReviewExercise[] {
  return plan.exercises.map(exercise => ({ included: false, exercise: { ...exercise, sets: blankDose(exercise.sets), repetitions: blankDose(exercise.repetitions), holdSeconds: blankDose(exercise.holdSeconds) } }));
}
export function reviewedExtraction(original: ExtractedHEP, review: ReviewExercise[]): ExtractedHEP {
  return { ...original, exercises: review.map(({ exercise }) => ({ ...exercise, name: exercise.name.trim() })) };
}
export function selectedReviewIndexes(review: ReviewExercise[]) {
  return review.flatMap((item, index) => item.included ? [index] : []);
}
export function canCompareUpdatedHEP(review: ReviewExercise[]) {
  return review.some(item => item.included);
}
export function createConfirmedHEPReview(plan: ConfirmedPlan): { original: ExtractedHEP; review: ReviewExercise[] } {
  const original = plan.originalExtraction ?? {
    exercises: plan.exercises,
    frequency: plan.frequency ?? {},
    generalInstructions: plan.generalInstructions ?? [],
    extractionNotes: plan.extractionNotes ?? [],
  };
  const review = createHEPReview(original);
  const used = new Set<number>();
  const normalized = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  plan.exercises.forEach((selected, selectedIndex) => {
    const storedIndex = plan.selectedExerciseIndexes?.[selectedIndex];
    const match = storedIndex != null && review[storedIndex] && !used.has(storedIndex)
      ? storedIndex
      : review.findIndex((item, index) => !used.has(index) && normalized(item.exercise.name) === normalized(selected.name));
    if (match >= 0) {
      used.add(match);
      review[match] = { included: true, exercise: { ...selected } };
    }
  });
  return { original, review };
}
export function selectedHEP(original: ExtractedHEP, review: ReviewExercise[]): ExtractedHEP {
  return normalizeConfirmedHEP({ ...original, exercises: review.filter(item => item.included).map(({ exercise }) => ({ ...exercise, name: exercise.name.trim() })) });
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
      if (typeof field === "string" && (templateText(field) || /^(?:\s*|[_… .-]+|not specified|not provided|n\/?a|blank)$/i.test(field.trim()))) exercise[key] = null;
    }
    return exercise;
  }) };
}

/** Normal UI never treats booklet placeholders as dosage or instructions. */
export function templateText(value: unknown): boolean {
  return typeof value === "string" && /_{2,}|…|\.{3,}|\[\s*\]/.test(value);
}
export function usableInstruction(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split(/(?<=[.!?])\s+|\n/).filter(line => !templateText(line)).join(" ").trim() || null;
}
function instructionLines(value: string | null | undefined) {
  return value?.split(/(?<=[.!?])\s+|\n+/).map(line => line.trim()).filter(Boolean) ?? [];
}
function isPlanGuidance(line: string) {
  return /\b(?:warm[ -]?up|this (?:exercise )?program|program (?:length|duration)|general stretch(?:ing)?|before (?:starting|beginning) (?:the )?program|(?:all|only) (?:of these |the )?(?:marked |highlighted )?exercises|do (?:the )?(?:marked|highlighted) exercises|for \d+(?:\s*[-–]\s*\d+)? weeks?|if you experience pain|stop (?:the program|exercising) if|contact your (?:doctor|therapist|provider))\b/i.test(line) || /^stretch in a .* manner[.!]?$/i.test(line.trim());
}
export function separatePlanGuidance(plan: ExtractedHEP): ExtractedHEP {
  const moved: string[] = [];
  const keepSpecific = (value: string | null | undefined) => {
    const specific = instructionLines(value).filter(line => {
      if (!isPlanGuidance(line)) return true;
      moved.push(line); return false;
    });
    return specific.join(" ") || null;
  };
  const exercises = plan.exercises.map(exercise => {
    return { ...exercise, instructions: keepSpecific(exercise.instructions), notes: keepSpecific(exercise.notes) };
  });
  const seen = new Set<string>();
  const generalInstructions = [...plan.generalInstructions, ...moved].filter(line => {
    const key = line.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
  return { ...plan, exercises, generalInstructions };
}
export function normalizeConfirmedHEP(plan: ExtractedHEP): ExtractedHEP {
  const separated = separatePlanGuidance(plan);
  return { ...separated,
    exercises: separated.exercises.map(e => ({ ...e, sets: blankDose(e.sets), repetitions: blankDose(e.repetitions), holdSeconds: blankDose(e.holdSeconds), instructions: usableInstruction(e.instructions), notes: usableInstruction(e.notes) })),
    frequency: templateText(separated.frequency.rawText) ? { sessionsPerWeek: null, specifiedDays: null, rawText: null } : separated.frequency,
    generalInstructions: separated.generalInstructions.map(usableInstruction).filter((s): s is string => !!s),
  };
}
