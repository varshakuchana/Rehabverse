/** Image-space measurements, not clinical range-of-motion assessments. */
export type DetectorId = "knee_flexion" | "shoulder_flexion" | "shoulder_abduction" | "hip_flexion" | "hip_abduction" | "knee_curl" | "elbow_flexion";
export type PosePoint = { x: number; y: number; z?: number; visibility?: number };
export type RecognitionMode = "pose" | "hands" | "pose_hold" | "guided";
export const detectors = {
  hip_flexion: { cameraRequirements: "Stand side-on. Keep shoulder, hip and knee on your moving side visible.", positioning: "Stand comfortably side-on. Raise one knee and return; use the same leg.", landmarks: [11, 12, 23, 24, 25, 26] },
  hip_abduction: { cameraRequirements: "Face the camera. Keep shoulder, hip and knee on your moving side visible.", positioning: "Stand facing the camera. Move one leg sideways and return; keep your torso still.", landmarks: [11, 12, 23, 24, 25, 26] },
  knee_curl: { cameraRequirements: "Stand side-on with hip, knee and ankle visible.", positioning: "Stand side-on. Bend one knee to lift the heel behind you, then return.", landmarks: [23, 24, 25, 26, 27, 28] },
  elbow_flexion: { cameraRequirements: "Turn side-on. Keep shoulder, elbow and wrist visible.", positioning: "Keep your upper arm by your side. Bend your elbow comfortably, then return.", landmarks: [11, 12, 13, 14, 15, 16] },
  knee_flexion: { cameraRequirements: "Keep the hip, knee, and ankle of at least one side visible.", positioning: "Begin standing comfortably with space to move.", landmarks: [23, 24, 25, 26, 27, 28] },
  shoulder_flexion: { cameraRequirements: "Turn side-on to the camera. Keep the shoulder, elbow, and hip on your moving side visible; your feet do not need to be in frame.", positioning: "Sit or stand comfortably, side-on, with your moving arm resting by your side. Keep the same side toward the camera.", landmarks: [11, 12, 13, 14, 23, 24] },
  shoulder_abduction: { cameraRequirements: "Face the camera. Keep the shoulder, elbow, and hip on your moving side visible; your feet do not need to be in frame.", positioning: "Sit or stand comfortably facing the camera, with your moving arm resting by your side. Use the same arm throughout this quest.", landmarks: [11, 12, 13, 14, 23, 24] },
} satisfies Record<DetectorId, { cameraRequirements: string; positioning: string; landmarks: number[] }>;
export function landmarkVisible(point: PosePoint | undefined) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) > .55);
}
function angle(a: PosePoint, b: PosePoint, c: PosePoint, aspect = 1) {
  const value = Math.abs((Math.atan2(c.y - b.y, (c.x - b.x) * aspect) - Math.atan2(a.y - b.y, (a.x - b.x) * aspect)) * 180 / Math.PI);
  return value > 180 ? 360 - value : value;
}
export type TrackedSide = "left" | "right";
/** Shoulder planes depend on the instructed camera view. Pose is not a form judge.
 * Lock the chosen arm for the session, so changing arms cannot complete an attempt.
 * Inversion adapts arm elevation to the existing decreasing-angle attempt engine.
 */
export function measureMovement(id: DetectorId, points: PosePoint[], side: TrackedSide | null = null, aspect = 1): { angle: number; side: TrackedSide | null } | null {
  if (id === "knee_flexion") {
    const values = [[23, 25, 27], [24, 26, 28]].filter(indices => indices.every(i => landmarkVisible(points[i]))).map(([a, b, c]) => angle(points[a], points[b], points[c]));
    return values.length ? { angle: values.reduce((a, b) => a + b, 0) / values.length, side: null } : null;
  }
  const triples = id === "elbow_flexion" ? { left: [11, 13, 15], right: [12, 14, 16] } as const
    : id === "knee_curl" ? { left: [23, 25, 27], right: [24, 26, 28] } as const
    : id === "hip_flexion" || id === "hip_abduction" ? { left: [11, 23, 25], right: [12, 24, 26] } as const
    : { left: [23, 11, 13], right: [24, 12, 14] } as const;
  const choices: TrackedSide[] = side ? [side] : ["left", "right"];
  // Prefer the most visible arm on initial acquisition; never swap during a session.
  choices.sort((a, b) => Math.min(...triples[b].map(i => points[i]?.visibility ?? 0)) - Math.min(...triples[a].map(i => points[i]?.visibility ?? 0)));
  for (const selected of choices) {
    const [hip, shoulder, elbow] = triples[selected];
    if (![hip, shoulder, elbow].every(i => landmarkVisible(points[i]))) continue;
    if (Math.hypot(points[hip].x - points[shoulder].x, points[hip].y - points[shoulder].y) < .02 || Math.hypot(points[elbow].x - points[shoulder].x, points[elbow].y - points[shoulder].y) < .02) continue;
    const measured = angle(points[hip], points[shoulder], points[elbow], aspect);
    return { angle: id.startsWith("shoulder") ? 180 - measured : measured, side: selected };
  }
  return null;
}
/** Conservative aliases: context resolves names that can describe seated or standing variants. */
export function detectorForExercise(name: string, instructions = ""): DetectorId | undefined {
  const normalize = (value: string) => value.toLowerCase().trim().replace(/[()\-–_/]+/g, " ").replace(/\s+/g, " ");
  const normalized = normalize(name);
  const context = normalize(`${name} ${instructions}`);
  const unsupportedLowerBodyVariant = /\b(seated|sitting|supine|lie|lying|bed|assist(?:ed|ance|ive)?|passive|stretch)\b/.test(context);
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:knee raise|hip flexion)(?: exercise)?$/.test(normalized) &&
      (normalized.startsWith("standing") || normalized.startsWith("knee raise") || /\bstand(?:ing)?\b/.test(context))) return "hip_flexion";
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:hip abduction|side leg raise)(?: exercise)?$/.test(normalized) &&
      (normalized.startsWith("standing") || normalized.startsWith("side leg raise") || /\bstand(?:ing)?\b/.test(context))) return "hip_abduction";
  if (!unsupportedLowerBodyVariant && /^(?:standing )?(?:knee curl|hamstring curl|hamstring flexion)(?: exercise)?$/.test(normalized) &&
      (normalized.startsWith("standing") || /\bstand(?:ing)?\b/.test(context))) return "knee_curl";
  if (/^(?:mini )?squats?(?: exercise)?$|^sit to stands?(?: exercise)?$/.test(normalized) && !/\b(supine|lying|assisted|passive)\b/.test(context)) return "knee_flexion";
  if (/^(?:standing |seated )?shoulder flexion(?: exercise)?$|^forward arm raise(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch|supine|lie|lying)\b/.test(context)) return "shoulder_flexion";
  if (/^(?:standing |seated )?shoulder abduction(?: exercise)?$|^side arm raise(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch|supine|lie|lying)\b/.test(context)) return "shoulder_abduction";
  if (/^elbow flexion(?: exercise)?$/.test(normalized) && !/\b(assist(?:ed|ance|ive)?|passive|stretch)\b/.test(context)) return "elbow_flexion";
  return undefined;
}

export function recognitionForExercise(name: string, instructions = ""): { mode: RecognitionMode; detectorId?: DetectorId } {
  const detectorId = detectorForExercise(name, instructions);
  return detectorId ? { mode: "pose", detectorId } : { mode: "guided" };
}
