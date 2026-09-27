import type { CompletedSession } from "@/types/progress";
import { parseStored, readStored, writeStored } from "./demoStorage";
export const PROGRESS_KEY = "rehabverse-progress-v1";
export function decodeProgress(raw: string | null): CompletedSession[] {
  const value = parseStored(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CompletedSession =>
    item && typeof item.id === "string" && typeof item.exerciseId === "string" &&
    typeof item.exerciseName === "string" && item.status === "complete" &&
    (item.source === "hep" || item.source === "explore") &&
    typeof item.completedAt === "string" && Number.isFinite(Date.parse(item.completedAt)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.completedLocalDate) &&
    Number.isInteger(item.targetReps) && item.targetReps > 0 &&
    Number.isInteger(item.completedReps) && item.completedReps >= item.targetReps &&
    Number.isFinite(item.score)
  ).filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
export function saveCompletedSession(session: CompletedSession) {
  const sessions = decodeProgress(readStored(PROGRESS_KEY));
  if (sessions.some(item => item.id === session.id)) return;
  writeStored(PROGRESS_KEY, [...sessions, session]);
}
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function thisWeek(sessions: CompletedSession[], now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  return sessions.filter(item => item.completedLocalDate >= localDateKey(monday) &&
    item.completedLocalDate < localDateKey(nextMonday) && Date.parse(item.completedAt) <= now.getTime());
}
export function progressSummary(sessions: CompletedSession[], now = new Date()) {
  const week = thisWeek(sessions, now);
  return { total: sessions.length, week: week.length, activeDays: new Set(week.map(item => item.completedLocalDate)).size };
}
