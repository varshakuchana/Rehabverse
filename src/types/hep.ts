export type HEPExercise = {
  id: string;

  // Exercise name exactly as read from the uploaded plan
  name: string;

  // Optional match to an exercise RehabVerse knows how to track
  exerciseId?: string;

  sets?: number;
  repetitions?: number;
  holdSeconds?: number;

  instructions?: string;

  // Any restriction or note explicitly present in the uploaded HEP
  notes?: string;

  // Whether RehabVerse can currently track this movement
  trackingStatus:
    | "interactive"
    | "guided"
    | "hold"
    | "unsupported";
};

export type HEPFrequency = {
  sessionsPerWeek?: number;

  // Used only when exact days are present in the HEP
  specifiedDays?: string[];

  rawText?: string;
};

export type HomeExercisePlan = {
  id: string;

  sourceFileName: string;

  uploadedAt: string;

  exercises: HEPExercise[];

  frequency?: HEPFrequency;

  // Important: extracted plans must be reviewed before use
  confirmed: boolean;
};