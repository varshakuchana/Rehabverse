export type SchedulePreference = {
  planId: string;
  frequencyKey: string;
  days: number[]; // Sunday = 0; local calendar days.
};
export type Frequency = {
  sessionsPerWeek?: number | null;
  specifiedDays?: string[] | null;
  rawText?: string | null;
};
export type ConfirmedExercise = {
  name: string;
  sets?: number | null;
  repetitions?: number | null;
  holdSeconds?: number | null;
  instructions?: string | null;
  notes?: string | null;
};
export type ConfirmedPlan = {
  id: string;
  sourceFileName: string;
  uploadedAt: string;
  exercises: ConfirmedExercise[];
  frequency?: Frequency;
  generalInstructions?: string[];
  extractionNotes?: string[];
  confirmed: boolean;
};

export type ExtractedHEP = {
  exercises: ConfirmedExercise[];
  frequency: Frequency;
  generalInstructions: string[];
  extractionNotes: string[];
};
