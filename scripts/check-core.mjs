// Deterministic checks only: no camera, browser, network, credentials, or test dependency.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const nativeRequire = createRequire(import.meta.url);
const root = process.cwd();
const cache = new Map();
let modelOutput;
let calls = 0;
const mocks = { "@google/genai": { Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY", INTEGER: "INTEGER" }, GoogleGenAI: class {
  models = { generateContent: async () => { calls++; return { text: JSON.stringify(modelOutput) }; } };
} } };
function load(filename) {
  const file = path.resolve(root, filename);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = id => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(`${target}.ts`);
    }
    return nativeRequire(id);
  };
  vm.runInThisContext(`(function(require, module, exports) {${output}\n})`, { filename: file })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`✓ ${name}`); }
const detector = load("src/lib/movementDetectors.ts");
const { MovementAttemptEngine } = load("src/lib/movementEngine.ts");
const review = load("src/lib/hepReview.ts");
const { isExtractedHEP } = load("src/lib/validateHEP.ts");
const { hepCapability, hepQuest } = load("src/lib/hepQuests.ts");
const safety = load("src/lib/exploreSafety.ts");
const catalog = load("src/lib/exerciseCatalog.ts");
const quests = load("src/lib/exploreQuest.ts");
const base = { title: quests.QUEST_TITLE, description: quests.QUEST_DESCRIPTION, exercises: [{ exerciseId: "shoulder-flexion", targetReps: 6 }] };
await check("Conservative detector aliases exclude distinct unsupported movements and inherited properties", () => {
  for (const [name, id] of [[" Squat ", "knee_flexion"], ["Sit-to-Stand", "knee_flexion"], ["  Shoulder   Flexion ", "shoulder_flexion"], ["Side arm raise", "shoulder_abduction"]]) assert.equal(detector.detectorForExercise(name), id);
  for (const name of ["supine shoulder flexion", "shoulder flexion stretch", "assisted shoulder abduction", "straight leg raise", "constructor", "__proto__"]) assert.equal(detector.detectorForExercise(name), undefined);
});
const p = (x, y, visibility = 1) => ({ x, y, visibility });
function shoulder(angle, side = "left") {
  const points = [];
  const i = side === "left" ? 0 : 1;
  points[11 + i] = p(.5, .3); points[23 + i] = p(.5, .7);
  const r = angle * Math.PI / 180;
  points[13 + i] = p(.5 + Math.sin(r) * .2, .3 + Math.cos(r) * .2);
  return points;
}
await check("Shoulder readiness needs only the selected shoulder, elbow and hip", () => {
  for (const id of ["shoulder_flexion", "shoulder_abduction"]) {
    assert.equal(detector.measureMovement(id, shoulder(0), "left").angle, 180);
    assert.equal(detector.measureMovement(id, shoulder(0), "right"), null);
    const missing = shoulder(0); missing[13].visibility = .5;
    assert.equal(detector.measureMovement(id, missing, "left"), null);
    assert.equal(detector.measureMovement(id, shoulder(0, "right"), "left"), null);
    assert.equal(detector.measureMovement(id, [], "left"), null);
  }
});
await check("Existing knee geometry accepts one visible hip/knee/ankle chain and averages two", () => {
  const points = [];
  points[23] = p(.3, .2); points[25] = p(.3, .5); points[27] = p(.3, .8);
  assert.equal(detector.measureMovement("knee_flexion", points).angle, 180);
  points[24] = p(.5, .2); points[26] = p(.5, .5); points[28] = p(.8, .5);
  assert.equal(detector.measureMovement("knee_flexion", points).angle, 135);
  points[27].visibility = .1; points[28].visibility = .1;
  assert.equal(detector.measureMovement("knee_flexion", points), null);
});
await check("Each shoulder detector drives the shared engine for exactly one lift-and-return", () => {
  for (const id of ["shoulder_flexion", "shoulder_abduction"]) {
    const engine = new MovementAttemptEngine(); let count = 0; let time = 0;
    for (const elevation of [...Array(12).fill(0), 8, 15, 24, 30, 25, 18, 10, 0, ...Array(12).fill(0)]) {
      const result = engine.process(detector.measureMovement(id, shoulder(elevation), "left").angle, time += 100);
      if (result.completedAttempt) count++;
    }
    assert.equal(count, 1);
    engine.reset();
    for (let i = 0; i < 40; i++) assert.equal(engine.process(180 - (i % 3), time += 100).completedAttempt, false);
  }
});
await check("Tracking-loss reset discards an incomplete attempt without completing it", () => {
  const engine = new MovementAttemptEngine(); let time = 0;
  for (const angle of [...Array(10).fill(180), 170, 160, 150]) engine.process(angle, time += 100);
  engine.reset();
  for (const angle of [155, 165, 180, ...Array(10).fill(180)]) assert.equal(engine.process(angle, time += 100).completedAttempt, false);
});
const extracted = { exercises: [{ name: "Squat", repetitions: null, sets: null, instructions: "Start at ____ reps" }, { name: "Shoulder flexion", repetitions: 6, instructions: "Only marked exercises" }], frequency: { rawText: "Do marked exercises ____ times a day" }, generalInstructions: ["Do marked exercises"], extractionNotes: [] };
await check("Booklet review starts unchecked; missing values stay missing; exclusions never enter plan", () => {
  const draft = review.createHEPReview(extracted);
  assert.equal(review.reviewValid(draft), false);
  assert.equal(review.selectedHEP(extracted, draft).exercises.length, 0);
  draft[0].included = true;
  assert.equal(review.reviewValid(draft), true);
  assert.equal(review.selectedHEP(extracted, draft).exercises[0].repetitions, null);
  draft[0].exercise.repetitions = 4;
  assert.equal(review.selectedHEP(extracted, draft).exercises.length, 1);
  assert.equal(extracted.exercises[0].repetitions, null);
  assert.equal(extracted.exercises[0].instructions, "Start at ____ reps");
  draft[0].exercise.sets = -1; assert.equal(review.reviewValid(draft), false);
  draft[0].exercise.sets = 1.5; assert.equal(review.reviewValid(draft), false);
});
await check("Blank HEP dosage text normalizes to null without inventing numeric values", () => {
  for (const value of ["", "_____", "...", "not specified", "N/A"]) {
    const normalized = review.normalizeTemplateFields({ ...extracted, exercises: [{ name: "Squat", repetitions: value }] });
    assert.equal(normalized.exercises[0].repetitions, null);
    assert.equal(isExtractedHEP(normalized), true);
  }
  assert.equal(review.blankDose(0), null);
  assert.equal(review.blankDose("Start at ____ reps"), null);
  assert.equal(isExtractedHEP(review.normalizeTemplateFields({ ...extracted, exercises: [{ name: "Squat", repetitions: "ten or twenty" }] })), false);
});
await check("HEP classification and sessions use only confirmed dosage, preserving HEP source", () => {
  assert.equal(hepCapability({ name: "Shoulder flexion", repetitions: 6 }), "interactive");
  assert.equal(hepCapability({ name: "Squat", repetitions: null }), "reference");
  assert.equal(hepCapability({ name: "Ankle circles", repetitions: 6 }), "reference");
  const e = { name: "Ankle circles", repetitions: 7, sets: 2, holdSeconds: 5, instructions: "Follow these instructions" };
  assert.equal(hepCapability(e), "guided");
  const def = hepQuest({ id: "hep-original", exercises: [e] }, 0);
  assert.equal(def.target, 14); assert.equal(def.source, "hep"); assert.equal(def.holdSeconds, 5);
  assert.equal(def.prescribedSets, 2); assert.equal(def.planId, "hep-original");
  assert.equal(hepCapability({ name: "Shoulder flexion", repetitions: 6, holdSeconds: 5, instructions: "Hold" }), "guided");
});
await check("Medical routing catches injury/pain/surgery requests before model selection", () => {
  for (const text of ["I tore my ACL. What exercises should I do?", "My knee hurts. Give me rehab exercises.", "What should I do after shoulder surgery?", "Light movement for arthritis", "A 5 minute break for my back pain", "Improve my diagnosed condition", "I have osteoporosis", "I need physio exercises", "pаin treatment", "Recover from a stroke"]) assert.equal(safety.isMedicalRequest(text), true, text);
  for (const text of ["A light 5 minute movement break", "A beginner upper-body game", "I have been sitting at my desk and want to move"]) assert.equal(safety.isWellnessRequest(text), true, text);
});
await check("Explore validation rejects unknown IDs, duplicates, arbitrary dosage and generated prose", () => {
  assert.ok(quests.validateExploreQuest(base));
  for (const step of [{ exerciseId: "new-treatment", targetReps: 6 }, { exerciseId: "shoulder-flexion", targetReps: 999 }, { exerciseId: "shoulder-flexion", targetReps: 5 }, { exerciseId: "shoulder-flexion", targetReps: "6" }, { exerciseId: "constructor", targetReps: 6 }]) assert.equal(quests.validateExploreQuest({ ...base, exercises: [step] }), null);
  assert.equal(quests.validateExploreQuest({ ...base, exercises: [] }), null);
  assert.equal(quests.validateExploreQuest({ ...base, exercises: [...base.exercises, ...base.exercises] }), null);
  assert.equal(quests.validateExploreQuest({ ...base, title: "Heal your injury" }), null);
  assert.equal(quests.validateExploreQuest({ ...base, exercises: Array(4).fill(base.exercises[0]) }), null);
  for (const entry of catalog.queryExploreCatalog()) for (const target of entry.allowedTargets) {
    const def = quests.generatedStep({ exerciseId: entry.id, targetReps: target });
    assert.equal(def.source, "explore"); assert.equal(def.target, target);
    if (def.trackingCapability === "interactive") assert.ok(detector.detectors[def.detectorId]);
  }
});
await check("Explore API blocks medical requests without credentials/model calls and validates mocked model output", async () => {
  const { POST } = load("src/app/api/explore/route.ts");
  const key = process.env.GEMINI_API_KEY;
  const request = prompt => new Request("http://localhost/api/explore", { method: "POST", body: JSON.stringify({ prompt }) });
  try {
    delete process.env.GEMINI_API_KEY;
    let response = await POST(request("My knee hurts. Give me rehab exercises."));
    assert.equal((await response.json()).message, safety.MEDICAL_REDIRECT); assert.equal(calls, 0);
    response = await POST(request("A light movement break")); assert.equal(response.status, 503);
    process.env.GEMINI_API_KEY = "test-placeholder-not-a-credential";
    modelOutput = { kind: "wellness", exercises: base.exercises };
    response = await POST(request("A light upper-body movement break")); assert.equal(response.status, 200);
    assert.ok(quests.validateExploreQuest((await response.json()).quest));
    modelOutput = { kind: "wellness", exercises: [{ exerciseId: "invented", targetReps: 8 }] };
    response = await POST(request("A light movement break")); assert.equal(response.status, 502);
    modelOutput = { kind: "medical", exercises: [] };
    response = await POST(request("A light movement break")); assert.equal((await response.json()).message, safety.MEDICAL_REDIRECT);
    response = await POST(request("a".repeat(601))); assert.equal(response.status, 400);
    response = await POST(request("a".repeat(5000))); assert.equal(response.status, 413);
    response = await POST(new Request("http://localhost/api/explore", { method: "POST", body: "not json" })); assert.equal(response.status, 400);
  } finally { if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
});
await check("Updated HEP selection preserves history and carries only compatible scheduling", () => {
  const storage = new Map();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } });
  try {
    const plans = load("src/lib/scheduleStorage.ts");
    const progress = load("src/lib/progressStorage.ts");
    const old = { ...extracted, id: "old-plan", confirmed: true, sourceFileName: "old.pdf", uploadedAt: "2026-01-01", frequency: { rawText: "3 times per week", sessionsPerWeek: 3 } };
    plans.saveConfirmedPlan(old);
    plans.saveSchedule({ planId: old.id, frequencyKey: plans.frequencyInfo(old.frequency).key, days: [1, 3, 5] });
    const record = { id: "session-1", exerciseId: "old-plan:0", exerciseName: "Squat", completedAt: "2026-01-01T12:00:00Z", completedLocalDate: "2026-01-01", completedReps: 6, targetReps: 6, status: "complete", score: 600, source: "hep", planId: old.id };
    progress.saveCompletedSession(record); progress.saveCompletedSession(record);
    assert.equal(progress.decodeProgress(storage.get(progress.PROGRESS_KEY)).length, 1);
    const draft = review.createHEPReview(extracted); draft[1].included = true;
    const next = { ...old, ...review.selectedHEP(extracted, draft), frequency: old.frequency, id: "new-plan", originalExtraction: extracted };
    plans.confirmPlanReplacement(next, old.id);
    assert.equal(plans.getConfirmedPlan().exercises.length, 1);
    assert.equal(plans.getConfirmedPlan().originalExtraction.exercises.length, 2);
    assert.equal(progress.decodeProgress(storage.get(progress.PROGRESS_KEY))[0].planId, old.id);
    const preferences = plans.decodeSchedules(storage.get(plans.SCHEDULE_KEY));
    assert.deepEqual(preferences.find(item => item.planId === next.id).days, [1, 3, 5]);
    assert.equal(plans.compatibleSchedule(next, { ...next, id: "third-plan", frequency: { rawText: "4 times per week", sessionsPerWeek: 4 } }, preferences), null);
    assert.equal(plans.frequencyInfo(extracted.frequency).weekly, undefined);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else delete globalThis.window;
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage); else delete globalThis.localStorage;
  }
});
await check("Guided controller ignores pre-start taps, caps reps and resets its authoritative state", () => {
  const { guidedQuestReducer: reduce, initialGuidedState } = load("src/lib/guidedQuest.ts");
  let state = initialGuidedState;
  state = reduce(state, { type: "mark", target: 2 }); assert.equal(state.reps, 0);
  state = reduce(state, { type: "ready" }); state = reduce(state, { type: "start", id: "guided-test" });
  state = reduce(state, { type: "mark", target: 2 }); state = reduce(state, { type: "pause" });
  state = reduce(state, { type: "mark", target: 2 }); assert.equal(state.reps, 1);
  state = reduce(state, { type: "resume" }); state = reduce(state, { type: "mark", target: 2 });
  state = reduce(state, { type: "mark", target: 2 }); assert.equal(state.reps, 2);
  state = reduce(state, { type: "complete", target: 2 }); assert.equal(state.phase, "complete");
  state = reduce(state, { type: "reset" }); assert.equal(state.reps, 0); assert.equal(state.sessionId, null);
});
console.log(`\n${passed} deterministic core checks passed.`);
