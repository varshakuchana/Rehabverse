import type { ConfirmedExercise } from "@/types/schedule";
import type { ComparableHEP, FieldDifference, HEPComparison } from "@/types/hepComparison";

const clean = (text?: string | null) => (text ?? "").trim().replace(/\s+/g, " ");
// Keep laterality, qualifiers, punctuation, and word order intact.
export const normalizeExerciseName = (name: string) => clean(name).toLowerCase();
const display = (value?: string | null) => clean(value) || "Not specified";
const exerciseFields = [
  ["sets", "Sets", "sets"],
  ["repetitions", "Repetitions", "reps"],
  ["holdSeconds", "Hold duration", "second hold"],
  ["instructions", "Instructions", ""],
  ["notes", "Notes / restrictions", ""],
] as const;

export function compareExerciseFields(before: ConfirmedExercise, after: ConfirmedExercise): FieldDifference[] {
  return exerciseFields.flatMap(([key, field, unit]) => {
    const oldValue = before[key], newValue = after[key];
    const normalized = (value: typeof oldValue) => typeof value === "string" ? clean(value) || null : value ?? null;
    if (normalized(oldValue) === normalized(newValue)) return [];
    const format = (value: typeof oldValue) => typeof value === "number" ? `${value} ${unit}` : display(value);
    return [{ field, before: format(oldValue), after: format(newValue) }];
  });
}

export function compareHEPs(before: ComparableHEP, after: ComparableHEP): HEPComparison {
  const used = new Set<number>();
  // Reserve exact matches first so reordered duplicate names don't create false changes.
  const matches = after.exercises.map(exercise => {
    const index = before.exercises.findIndex((old, i) => !used.has(i) &&
      normalizeExerciseName(old.name) === normalizeExerciseName(exercise.name) && compareExerciseFields(old, exercise).length === 0);
    if (index >= 0) used.add(index);
    return index;
  });
  after.exercises.forEach((exercise, i) => {
    if (matches[i] >= 0) return;
    const index = before.exercises.findIndex((old, j) => !used.has(j) && normalizeExerciseName(old.name) === normalizeExerciseName(exercise.name));
    if (index >= 0) { matches[i] = index; used.add(index); }
  });
  const exercises: HEPComparison["exercises"] = after.exercises.map((exercise, i) => {
    const old = before.exercises[matches[i]];
    if (!old) return { category: "Added", after: exercise, fields: [] };
    const fields = compareExerciseFields(old, exercise);
    return { category: fields.length ? "Changed" : "Unchanged", before: old, after: exercise, fields };
  });
  before.exercises.forEach((exercise, i) => { if (!used.has(i)) exercises.push({ category: "Removed", before: exercise, fields: [] }); });
  const planFields: FieldDifference[] = [];
  const add = (field: string, old: string, next: string) => {
    if (old !== next) planFields.push({ field, before: old, after: next });
  };
  add("Source file", display(before.sourceFileName), display(after.sourceFileName));
  add("Frequency instruction", display(before.frequency?.rawText), display(after.frequency?.rawText));
  const weekly = (value?: number | null) => value == null ? "Not specified" : `${value} sessions per week (extracted)`;
  add("Extracted weekly frequency", weekly(before.frequency?.sessionsPerWeek), weekly(after.frequency?.sessionsPerWeek));
  const list = (values?: string[] | null) => values?.map(clean).filter(Boolean).join("\n") || "Not specified";
  add("Specified days / timing", list(before.frequency?.specifiedDays), list(after.frequency?.specifiedDays));
  add("General instructions", list(before.generalInstructions), list(after.generalInstructions));
  const duplicates = (plan: ComparableHEP) => new Set(plan.exercises.map(item => normalizeExerciseName(item.name))).size !== plan.exercises.length;
  return { exercises, planFields, hasDuplicateNames: duplicates(before) || duplicates(after) };
}
