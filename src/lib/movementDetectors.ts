/** Image-space measurements, not clinical range-of-motion assessments. */
export type DetectorId = "knee_flexion" | "shoulder_flexion" | "shoulder_abduction";
export type PosePoint = { x: number; y: number; z?: number; visibility?: number };
export const detectors = {
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
  const triples = { left: [23, 11, 13], right: [24, 12, 14] } as const;
  const choices: TrackedSide[] = side ? [side] : ["left", "right"];
  // Prefer the most visible arm on initial acquisition; never swap during a session.
  choices.sort((a, b) => Math.min(...triples[b].map(i => points[i]?.visibility ?? 0)) - Math.min(...triples[a].map(i => points[i]?.visibility ?? 0)));
  for (const selected of choices) {
    const [hip, shoulder, elbow] = triples[selected];
    if (![hip, shoulder, elbow].every(i => landmarkVisible(points[i]))) continue;
    if (Math.hypot(points[hip].x - points[shoulder].x, points[hip].y - points[shoulder].y) < .02 || Math.hypot(points[elbow].x - points[shoulder].x, points[elbow].y - points[shoulder].y) < .02) continue;
    return { angle: 180 - angle(points[hip], points[shoulder], points[elbow], aspect), side: selected };
  }
  return null;
}
/** Conservative exact aliases: do not map stretches, assisted, weighted or lying variants. */
export function detectorForExercise(name: string): DetectorId | undefined {
  const normalized = name.toLowerCase().trim().replace(/[-–]/g, " ").replace(/\s+/g, " ");
  const aliases: Record<string, DetectorId> = {
    "mini squat": "knee_flexion", "mini squats": "knee_flexion", squat: "knee_flexion", squats: "knee_flexion", "sit to stand": "knee_flexion", "sit to stands": "knee_flexion",
    "shoulder flexion": "shoulder_flexion", "forward arm raise": "shoulder_flexion", "standing shoulder flexion": "shoulder_flexion", "seated shoulder flexion": "shoulder_flexion",
    "shoulder abduction": "shoulder_abduction", "side arm raise": "shoulder_abduction", "standing shoulder abduction": "shoulder_abduction", "seated shoulder abduction": "shoulder_abduction",
  };
  return Object.hasOwn(aliases, normalized) ? aliases[normalized] : undefined;
}
