/** Bounded classifications only. These values select reviewed local geometry. */
export const MOVEMENT_PRIMITIVES = [
  "knee_flexion",
  "arm_raise_forward",
  "arm_raise_side",
  "knee_raise",
  "leg_abduction",
  "knee_curl",
  "elbow_flexion",
  "pelvis_raise",
  "torso_raise",
  "opposite_arm_leg_extension",
  "plank_alignment",
  "knee_to_chest",
] as const;

export type MovementPrimitive = (typeof MOVEMENT_PRIMITIVES)[number];
export const MOVEMENT_PATTERNS = [...MOVEMENT_PRIMITIVES, "guided"] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];
export type TrackingMode = "dynamic_pose" | "pose_hold" | "guided";

export function isMovementPattern(value: unknown): value is MovementPattern {
  return typeof value === "string" && (MOVEMENT_PATTERNS as readonly string[]).includes(value);
}

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[()\-–_/]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Conservative textual evidence for local primitives. Instructions lead;
 * the name is used only to clarify short instructions such as "lift and hold".
 */
export function instructionMovementPattern(name: string, instructions: string): MovementPattern | undefined {
  const text = normalized(instructions);
  if (!text) return undefined;
  const context = `${normalized(name)} ${text}`;

  if (/\b(?:hands? and knees?|all fours|quadruped)\b/.test(context) &&
      /\b(?:extend|raise|lift|reach)\b.{0,35}\barm\b/.test(context) &&
      /\b(?:opposite|other)\b.{0,30}\bleg\b/.test(context)) return "opposite_arm_leg_extension";
  if (/\bplank\b/.test(context) && /\b(?:forearms?|elbows?|hands?|floor|ground|straight|line|lift|hold)\b/.test(text) ||
      /\b(?:forearms?|elbows?)\b.{0,30}\b(?:floor|ground)\b/.test(text) && /\b(?:straight|line|lift|hold)\b/.test(text)) return "plank_alignment";
  if (/\b(?:bridge|pelvis|hips?|buttocks)\b/.test(context) &&
      /\b(?:lie|lying|back|supine)\b/.test(context) &&
      /\b(?:lift|raise)\b.{0,35}\b(?:pelvis|hips?|buttocks)\b/.test(context)) return "pelvis_raise";
  if (/\b(?:crunch|curl up)\b/.test(context) && /\b(?:lift|raise|curl)\b/.test(text) ||
      /\b(?:lie|lying|back|supine)\b/.test(text) && /\b(?:lift|raise|curl)\b.{0,40}\b(?:head|shoulders?|upper body|torso)\b/.test(text)) return "torso_raise";
  if (/\b(?:knee to chest|bring|pull)\b.{0,35}\b(?:knee|leg)\b.{0,25}\b(?:chest|torso)\b/.test(context)) return "knee_to_chest";
  if (/\b(?:squat|sit to stand)\b/.test(context) && /\b(?:bend|lower|sit|stand|return)\b/.test(text)) return "knee_flexion";
  if (/\b(?:arm|shoulder)\b.{0,25}\b(?:forward|in front|overhead)\b/.test(context) && /\b(?:raise|lift|move|reach)\b/.test(text)) return "arm_raise_forward";
  if (/\b(?:arm|shoulder)\b.{0,25}\b(?:side|outward|abduction)\b/.test(context) && /\b(?:raise|lift|move)\b/.test(text)) return "arm_raise_side";
  if (/\b(?:stand|standing)\b/.test(context) && /\b(?:raise|lift|bring)\b.{0,25}\bknee\b/.test(context)) return "knee_raise";
  if (/\b(?:stand|standing)\b/.test(context) && /\b(?:move|raise|lift)\b.{0,30}\bleg\b.{0,20}\b(?:side|outward)\b/.test(context)) return "leg_abduction";
  if (/\b(?:stand|standing)\b/.test(context) && /\b(?:bend)\b.{0,25}\bknee\b|\blift\b.{0,25}\bheel\b.{0,20}\bbehind\b/.test(context)) return "knee_curl";
  if (/\b(?:bend|flex)\b.{0,20}\belbow\b/.test(context)) return "elbow_flexion";
  if (/\b(?:tighten|brace|contract|draw in|pull in)\b.{0,35}\b(?:abdominals?|stomach|core)\b/.test(context)) return "guided";
  return undefined;
}

export function classifiedMovementPattern(name: string, instructions: string, provided?: unknown): MovementPattern | undefined {
  const derived = instructionMovementPattern(name, instructions);
  if (derived) return derived;
  // A model value is accepted only when the confirmed instructions supply
  // enough matching evidence for the bounded primitive.
  if (!isMovementPattern(provided) || provided === "guided") return provided === "guided" ? "guided" : undefined;
  return instructionMovementPattern(provided.replaceAll("_", " "), instructions) === provided ? provided : undefined;
}
