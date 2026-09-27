"use client";
import { useSyncExternalStore } from "react";
import { localDataStatus, readStored, subscribeStorage } from "@/lib/demoStorage";
import { decodeProgress, PROGRESS_KEY } from "@/lib/progressStorage";
import { decodePlan, decodeSchedules, subscribePlan, PLAN_KEY, SCHEDULE_KEY } from "@/lib/scheduleStorage";
const serverSnapshot = () => null;
const progressSnapshot = () => readStored(PROGRESS_KEY);
const planSnapshot = () => readStored(PLAN_KEY, true);
const scheduleSnapshot = () => readStored(SCHEDULE_KEY);
export function useProgress() {
  return decodeProgress(useSyncExternalStore(subscribeStorage, progressSnapshot, serverSnapshot));
}
export function useConfirmedPlan() {
  return decodePlan(useSyncExternalStore(subscribePlan, planSnapshot, serverSnapshot));
}
export function useSchedules() {
  return decodeSchedules(useSyncExternalStore(subscribeStorage, scheduleSnapshot, serverSnapshot));
}

const loadingSnapshot = () => "loading" as const;
export function useLocalDataStatus() {
  return useSyncExternalStore(subscribeStorage, localDataStatus, loadingSnapshot);
}
