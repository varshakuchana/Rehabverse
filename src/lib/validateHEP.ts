import type { ExtractedHEP } from "@/types/schedule";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const optionalText = (value: unknown) => value == null || typeof value === "string";
const optionalNumber = (value: unknown) => value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0);

// Validate the existing extraction contract without changing or inferring HEP data.
export function isExtractedHEP(value: unknown): value is ExtractedHEP {
  if (!record(value) || !Array.isArray(value.exercises) || !record(value.frequency) ||
    !strings(value.generalInstructions) || !strings(value.extractionNotes)) return false;
  const frequency = value.frequency;
  return optionalText(frequency.rawText) && optionalNumber(frequency.sessionsPerWeek) &&
    (frequency.specifiedDays == null || strings(frequency.specifiedDays)) &&
    value.exercises.every(item => record(item) && typeof item.name === "string" && item.name.trim().length > 0 &&
      optionalNumber(item.sets) && optionalNumber(item.repetitions) && optionalNumber(item.holdSeconds) &&
      optionalText(item.instructions) && optionalText(item.notes));
}
