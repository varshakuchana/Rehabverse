import type { ConfirmedPlan, Frequency, SchedulePreference } from "@/types/schedule";
import { parseStored, readStored, subscribeStorage, writeStored } from "./demoStorage";
export const PLAN_KEY = "rehabverse-confirmed-hep";
export const SCHEDULE_KEY = "rehabverse-schedule-v1";
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function decodePlan(raw: string | null): ConfirmedPlan | null {
  const value = parseStored(raw) as ConfirmedPlan | null;
  if (!value || value.confirmed !== true || typeof value.id !== "string" || !Array.isArray(value.exercises) ||
    !value.exercises.every(item => item && typeof item.name === "string")) return null;
  return value;
}
export function subscribePlan(listener: () => void) {
  const unsubscribe = subscribeStorage(listener);
  // Upgrade a previously confirmed session-only plan without requiring re-upload.
  if (!readStored(PLAN_KEY)) {
    const legacy = decodePlan(readStored(PLAN_KEY, true));
    if (legacy) {
      try { writeStored(PLAN_KEY, legacy); } catch { /* Keep the legacy read fallback. */ }
    }
  }
  return unsubscribe;
}
export function saveConfirmedPlan(plan: ConfirmedPlan) { writeStored(PLAN_KEY, plan); }
export function getConfirmedPlan() { return decodePlan(readStored(PLAN_KEY, true)); }
export function exerciseKey(plan: ConfirmedPlan, index: number) { return `${plan.id}:${index}`; }
export function isPlayableExercise(exercise: ConfirmedPlan["exercises"][number]) {
  return /squat|sit[ -]to[ -]stand/i.test(exercise.name) &&
    Number.isInteger(exercise.repetitions) && (exercise.repetitions ?? 0) > 0 &&
    (exercise.sets == null || (Number.isInteger(exercise.sets) && exercise.sets > 0)) &&
    !exercise.holdSeconds;
}
export function frequencyInfo(frequency?: Frequency) {
  const raw = typeof frequency?.rawText === "string" ? frequency.rawText.trim() : "";
  const specified = Array.isArray(frequency?.specifiedDays) ? frequency.specifiedDays.filter(day => typeof day === "string" && day.trim()) : [];
  // A deliberately narrow parser. Free-form, ranges, timing and templates stay text.
  const text = raw.toLowerCase().replace(/[.!]$/, "").trim();
  const weeklyMatch = text.match(/^(?:perform\s+)?([1-7])\s*(?:times|sessions|x)\s*(?:per|a|\/)\s*week$/);
  const daily = /^(daily|every day|once daily|once a day|1 time per day)$/.test(text);
  const parsed = daily ? 7 : weeklyMatch ? Number(weeklyMatch[1]) : undefined;
  const structured = frequency?.sessionsPerWeek;
  const weekly = raw ? (parsed !== undefined && (structured == null || structured === parsed) ? parsed : undefined)
    : Number.isInteger(structured) && structured! > 0 && structured! <= 7 ? structured! : undefined;
  return {
    instruction: raw || (specified.length ? specified.join(", ") : weekly ? `${weekly} times per week` : "Frequency not specified in the confirmed HEP."),
    specified,
    weekly,
    daily,
    canChoose: weekly !== undefined && !daily && specified.length === 0,
    key: JSON.stringify([raw, structured, specified]),
  };
}
export function decodeSchedules(raw: string | null): SchedulePreference[] {
  const value = parseStored(raw);
  return Array.isArray(value) ? value.filter(item => item && typeof item.planId === "string" && typeof item.frequencyKey === "string" &&
    Array.isArray(item.days) && item.days.every((day: unknown) => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(item.days).size === item.days.length) : [];
}
export function saveSchedule(preference: SchedulePreference) {
  const existing = decodeSchedules(readStored(SCHEDULE_KEY));
  writeStored(SCHEDULE_KEY, [...existing.filter(item => item.planId !== preference.planId), preference]);
}

// Keep preferences only when both plans permit user-selected days and the
// confirmed weekly count is unchanged. Exact prescribed days take precedence.
export function compatibleSchedule(previous: ConfirmedPlan, next: ConfirmedPlan, schedules: SchedulePreference[]) {
  const oldInfo = frequencyInfo(previous.frequency);
  const newInfo = frequencyInfo(next.frequency);
  const saved = schedules.find(item => item.planId === previous.id && item.frequencyKey === oldInfo.key);
  if (!saved || !oldInfo.canChoose || !newInfo.canChoose || oldInfo.weekly !== newInfo.weekly || saved.days.length !== newInfo.weekly) return null;
  return { planId: next.id, frequencyKey: newInfo.key, days: [...saved.days] };
}

export function confirmPlanReplacement(plan: ConfirmedPlan, expectedCurrentId: string | null) {
  const current = getConfirmedPlan();
  if ((current?.id ?? null) !== expectedCurrentId) {
    throw new Error("The current HEP changed in another tab. Review the comparison again before confirming.");
  }
  if (!plan.confirmed || !plan.exercises.length || plan.id === current?.id) {
    throw new Error("Review a new plan with at least one extracted exercise before confirming.");
  }
  const schedules = decodeSchedules(readStored(SCHEDULE_KEY));
  const compatible = current ? compatibleSchedule(current, plan, schedules) : null;
  // Prepare a preference under the NEW id before switching plans. If either
  // write fails, the previous plan and its preferences remain intact. Any
  // staged preference is inert until its plan becomes current.
  if (compatible) saveSchedule(compatible);
  saveConfirmedPlan(plan);
  // Progress records are deliberately never touched by a plan update.
}
