import { classifiedMovementPattern, type MovementPattern, type TrackingMode } from "./movementPrimitives";

/** Image-space measurements, not clinical range-of-motion assessments. */
export type DetectorId =
  | "knee_flexion"
  | "shoulder_flexion"
  | "shoulder_abduction"
  | "hip_flexion"
  | "hip_abduction"
  | "knee_curl"
  | "elbow_flexion"
  | "pelvis_raise"
  | "torso_raise"
  | "opposite_arm_leg_extension"
  | "plank_alignment";
export type PosePoint = { x: number; y: number; z?: number; visibility?: number };
export type RecognitionMode = "pose" | "hands" | "pose_hold" | "guided";
export type TrackedSide = "left" | "right";
export type DetectorConfig = {
  cameraRequirements: string;
  positioning: string;
  landmarks: number[];
  selectSide: boolean;
  supportsHold?: boolean;
  holdRequiresReturn?: boolean;
  defaultMode?: "dynamic_pose" | "pose_hold";
};

export const detectors: Record<DetectorId, DetectorConfig> = {
  hip_flexion: { cameraRequirements: "Stand side-on. Keep shoulder, hip and knee on your moving side visible.", positioning: "Stand comfortably side-on. Raise one knee and return; use the same leg.", landmarks: [11, 12, 23, 24, 25, 26], selectSide: true },
  hip_abduction: { cameraRequirements: "Face the camera. Keep shoulder, hip and knee on your moving side visible.", positioning: "Stand facing the camera. Move one leg sideways and return; keep your torso still.", landmarks: [11, 12, 23, 24, 25, 26], selectSide: true },
  knee_curl: { cameraRequirements: "Stand side-on with hip, knee and ankle visible.", positioning: "Stand side-on. Bend one knee to lift the heel behind you, then return.", landmarks: [23, 24, 25, 26, 27, 28], selectSide: true },
  elbow_flexion: { cameraRequirements: "Turn side-on. Keep shoulder, elbow and wrist visible.", positioning: "Keep your upper arm by your side. Bend your elbow comfortably, then return.", landmarks: [11, 12, 13, 14, 15, 16], selectSide: true },
  knee_flexion: { cameraRequirements: "Keep the hip, knee, and ankle of at least one side visible.", positioning: "Begin standing comfortably with space to move.", landmarks: [23, 24, 25, 26, 27, 28], selectSide: false },
  shoulder_flexion: { cameraRequirements: "Turn side-on to the camera. Keep the shoulder, elbow, and hip on your moving side visible; your feet do not need to be in frame.", positioning: "Sit or stand comfortably, side-on, with your moving arm resting by your side. Keep the same side toward the camera.", landmarks: [11, 12, 13, 14, 23, 24], selectSide: true },
  shoulder_abduction: { cameraRequirements: "Face the camera. Keep the shoulder, elbow, and hip on your moving side visible; your feet do not need to be in frame.", positioning: "Sit or stand comfortably facing the camera, with your moving arm resting by your side. Use the same arm throughout this quest.", landmarks: [11, 12, 13, 14, 23, 24], selectSide: true },
  pelvis_raise: { cameraRequirements: "Use a side view with one shoulder, hip, and knee visible.", positioning: "Lie on your back side-on to the camera in the starting position from your HEP. Keep one shoulder, hip, and knee visible.", landmarks: [11, 12, 23, 24, 25, 26], selectSide: false, supportsHold: true, holdRequiresReturn: true },
  torso_raise: { cameraRequirements: "Use a side view with one shoulder, hip, and knee visible.", positioning: "Lie on your back side-on to the camera in the starting position from your HEP. Keep one shoulder, hip, and knee visible.", landmarks: [11, 12, 23, 24, 25, 26], selectSide: false, supportsHold: true, holdRequiresReturn: true },
  opposite_arm_leg_extension: { cameraRequirements: "Use a side view. Keep the chosen shoulder, elbow, wrist and the opposite hip, knee, and ankle visible.", positioning: "Begin on hands and knees, side-on to the camera. Choose the arm you will extend and keep that arm and the opposite leg visible.", landmarks: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28], selectSide: true, supportsHold: true, holdRequiresReturn: true },
  plank_alignment: { cameraRequirements: "Use a side view with one shoulder, hip, knee, and ankle visible.", positioning: "Set up side-on to the camera in the starting position from your HEP. Keep one shoulder, hip, knee, and ankle visible.", landmarks: [11, 12, 23, 24, 25, 26, 27, 28], selectSide: false, supportsHold: true, defaultMode: "pose_hold" },
};

export function landmarkVisible(point: PosePoint | undefined) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) > .55);
}
function angle(a: PosePoint, b: PosePoint, c: PosePoint, aspect = 1) {
  const value = Math.abs((Math.atan2(c.y - b.y, (c.x - b.x) * aspect) - Math.atan2(a.y - b.y, (a.x - b.x) * aspect)) * 180 / Math.PI);
  return value > 180 ? 360 - value : value;
}
function visibleChain(points: PosePoint[], indices: readonly number[]) {
  return indices.every(index => landmarkVisible(points[index]));
}
function bestVisibleSide(points: PosePoint[], chains: Record<TrackedSide, readonly number[]>, side: TrackedSide | null) {
  const choices: TrackedSide[] = side ? [side] : ["left", "right"];
  choices.sort((a, b) => Math.min(...chains[b].map(i => points[i]?.visibility ?? 0)) - Math.min(...chains[a].map(i => points[i]?.visibility ?? 0)));
  return choices.find(choice => visibleChain(points, chains[choice])) ?? null;
}

/** Every detector emits a relative signal which decreases during movement. */
export function measureMovement(id: DetectorId, points: PosePoint[], side: TrackedSide | null = null, aspect = 1): { angle: number; side: TrackedSide | null } | null {
  if (id === "knee_flexion") {
    const values = [[23, 25, 27], [24, 26, 28]].filter(indices => visibleChain(points, indices)).map(([a, b, c]) => angle(points[a], points[b], points[c], aspect));
    return values.length ? { angle: values.reduce((a, b) => a + b, 0) / values.length, side: null } : null;
  }
  if (id === "opposite_arm_leg_extension") {
    const chains = { left: [11, 13, 15, 24, 26, 28], right: [12, 14, 16, 23, 25, 27] } as const;
    const selected = bestVisibleSide(points, chains, side);
    if (!selected) return null;
    const [shoulder, elbow, wrist, hip, knee, ankle] = chains[selected];
    const extension = angle(points[shoulder], points[elbow], points[wrist], aspect) + angle(points[hip], points[knee], points[ankle], aspect);
    return { angle: 360 - extension, side: selected };
  }
  if (id === "plank_alignment") {
    const chains = { left: [11, 23, 25, 27], right: [12, 24, 26, 28] } as const;
    const selected = bestVisibleSide(points, chains, side);
    if (!selected) return null;
    const [shoulder, hip, knee, ankle] = chains[selected];
    return { angle: 360 - angle(points[shoulder], points[hip], points[knee], aspect) - angle(points[hip], points[knee], points[ankle], aspect), side: selected };
  }
  if (id === "pelvis_raise" || id === "torso_raise") {
    const chains = { left: [11, 23, 25], right: [12, 24, 26] } as const;
    const selected = bestVisibleSide(points, chains, side);
    if (!selected) return null;
    const [shoulder, hip, knee] = chains[selected];
    if (id === "torso_raise") return { angle: angle(points[shoulder], points[hip], points[knee], aspect), side: selected };
    const torso = Math.max(.02, Math.hypot((points[shoulder].x - points[hip].x) * aspect, points[shoulder].y - points[hip].y));
    const hipRise = ((points[shoulder].y + points[knee].y) / 2 - points[hip].y) / torso;
    return { angle: 180 - hipRise * 100, side: selected };
  }
  const triples = id === "elbow_flexion" ? { left: [11, 13, 15], right: [12, 14, 16] } as const
    : id === "knee_curl" ? { left: [23, 25, 27], right: [24, 26, 28] } as const
    : id === "hip_flexion" || id === "hip_abduction" ? { left: [11, 23, 25], right: [12, 24, 26] } as const
    : { left: [23, 11, 13], right: [24, 12, 14] } as const;
  const selected = bestVisibleSide(points, triples, side);
  if (!selected) return null;
  const [first, middle, last] = triples[selected];
  if (Math.hypot(points[first].x - points[middle].x, points[first].y - points[middle].y) < .02 || Math.hypot(points[last].x - points[middle].x, points[last].y - points[middle].y) < .02) return null;
  const measured = angle(points[first], points[middle], points[last], aspect);
  return { angle: id.startsWith("shoulder") ? 180 - measured : measured, side: selected };
}

const PATTERN_DETECTORS: Partial<Record<MovementPattern, DetectorId>> = {
  knee_flexion: "knee_flexion", arm_raise_forward: "shoulder_flexion", arm_raise_side: "shoulder_abduction",
  knee_raise: "hip_flexion", leg_abduction: "hip_abduction", knee_curl: "knee_curl", elbow_flexion: "elbow_flexion",
  pelvis_raise: "pelvis_raise", torso_raise: "torso_raise", opposite_arm_leg_extension: "opposite_arm_leg_extension", plank_alignment: "plank_alignment",
};

/** Preserve the reviewed aliases which were already camera tracked. */
function explicitDetector(name: string, instructions = ""): DetectorId | undefined {
  const normalize = (value: string) => value.toLowerCase().trim().replace(/[()\-–_/]+/g, " ").replace(/\s+/g, " ");
  const normalized = normalize(name);
  const context = normalize(`${name} ${instructions}`);
  const unsupportedLowerBodyVariant = /\b(seated|sitting|supine|lie|lying|bed|assist(?:ed|ance|ive)?|passive|stretch)\b/.test(context);
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:knee raise|hip flexion)(?: exercise)?$/.test(normalized) && (normalized.startsWith("standing") || normalized.startsWith("knee raise") || /\bstand(?:ing)?\b/.test(context))) return "hip_flexion";
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:hip abduction|side leg raise)(?: exercise)?$/.test(normalized) && (normalized.startsWith("standing") || normalized.startsWith("side leg raise") || /\bstand(?:ing)?\b/.test(context))) return "hip_abduction";
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:knee curl|hamstring curl|hamstring flexion)(?: exercise)?$/.test(normalized) && (normalized.startsWith("standing") || /\bstand(?:ing)?\b/.test(context))) return "knee_curl";
  if (/^(?:mini )?squats?(?: exercise)?$|^sit to stands?(?: exercise)?$/.test(normalized) && !/\b(supine|lying|assisted|passive)\b/.test(context)) return "knee_flexion";
  if (/^(?:standing |seated )?shoulder flexion(?: exercise)?$|^forward arm raise(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch|supine|lie|lying)\b/.test(context)) return "shoulder_flexion";
  if (/^(?:standing |seated )?shoulder abduction(?: exercise)?$|^side arm raise(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch|supine|lie|lying)\b/.test(context)) return "shoulder_abduction";
  if (/^elbow flexion(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch)\b/.test(context)) return "elbow_flexion";
  return undefined;
}

export function detectorForExercise(name: string, instructions = "", movementPattern?: unknown): DetectorId | undefined {
  const existing = explicitDetector(name, instructions);
  if (existing) return existing;
  const pattern = classifiedMovementPattern(name, instructions, movementPattern);
  return pattern ? PATTERN_DETECTORS[pattern] : undefined;
}

export function trackingForExercise(exercise: { name: string; instructions?: string | null; notes?: string | null; holdSeconds?: number | null; movementPattern?: MovementPattern | null }): { mode: TrackingMode; detectorId?: DetectorId } {
  const instructions = [exercise.instructions, exercise.notes].filter(Boolean).join(" ");
  const detectorId = detectorForExercise(exercise.name, instructions, exercise.movementPattern);
  if (!detectorId) return { mode: "guided" };
  const config = detectors[detectorId];
  if (exercise.holdSeconds != null) return config.supportsHold ? { mode: "pose_hold", detectorId } : { mode: "guided" };
  if (config.defaultMode === "pose_hold") return { mode: "guided" };
  return { mode: "dynamic_pose", detectorId };
}

export function recognitionForExercise(name: string, instructions = ""): { mode: RecognitionMode; detectorId?: DetectorId } {
  const detectorId = detectorForExercise(name, instructions);
  return detectorId ? { mode: detectors[detectorId].defaultMode === "pose_hold" ? "pose_hold" : "pose", detectorId } : { mode: "guided" };
}
