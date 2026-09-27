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
const comparisons = load("src/lib/compareHEPs.ts");
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
  assert.equal(review.canCompareUpdatedHEP(draft), false);
  assert.equal(review.selectedHEP(extracted, draft).exercises.length, 0);
  draft[0].included = true;
  assert.equal(review.canCompareUpdatedHEP(draft), true);
  assert.equal(review.reviewValid(draft), true);
  assert.equal(review.selectedHEP(extracted, draft).exercises[0].repetitions, null);
  draft[0].exercise.repetitions = 4;
  assert.equal(review.selectedHEP(extracted, draft).exercises.length, 1);
  assert.equal(extracted.exercises[0].repetitions, null);
  assert.equal(extracted.exercises[0].instructions, "Start at ____ reps");
  draft[0].exercise.sets = -1; assert.equal(review.reviewValid(draft), false);
  draft[0].exercise.sets = 1.5; assert.equal(review.reviewValid(draft), false);
});
await check("Updated-plan comparison stays disabled before selection and compares only selected exercises", () => {
  const draft = review.createHEPReview(extracted);
  assert.equal(review.canCompareUpdatedHEP(draft), false);
  draft[0].included = true;
  const selected = review.selectedHEP(extracted, draft);
  const current = { ...extracted, sourceFileName: "current.pdf", exercises: [extracted.exercises[1]] };
  const update = { ...selected, sourceFileName: "updated.pdf" };
  const compared = comparisons.compareHEPs(current, update);
  assert.equal(selected.exercises.length, 1);
  assert.deepEqual(compared.exercises.map(item => [item.category, (item.after ?? item.before).name]), [["Added", "Squat"], ["Removed", "Shoulder flexion"]]);
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
await check("Plan-wide guidance is removed from exercise cards while specific instructions and notes remain", () => {
  const cleaned = review.separatePlanGuidance({
    exercises: [{
      name: "Head rolls", sets: 1, repetitions: 6, holdSeconds: null,
      instructions: "Warm up for 5 minutes. Slowly roll your head from side to side. Exercise program length 8-12 weeks.",
      notes: "Contact your therapist if you experience pain. Keep the movement comfortable.",
    }],
    frequency: { rawText: "3 times per week" }, generalInstructions: ["Only marked exercises."], extractionNotes: [],
  });
  assert.equal(cleaned.exercises[0].instructions, "Slowly roll your head from side to side.");
  assert.equal(cleaned.exercises[0].notes, "Keep the movement comfortable.");
  assert.deepEqual(cleaned.generalInstructions, ["Only marked exercises.", "Warm up for 5 minutes.", "Exercise program length 8-12 weeks.", "Contact your therapist if you experience pain."]);
  const definition = hepQuest({ ...cleaned, id: "clean-plan", sourceFileName: "plan.pdf", uploadedAt: "2026-01-01", confirmed: true }, 0);
  assert.deepEqual(definition.instructor.instructions, ["Slowly roll your head from side to side.", "Keep the movement comfortable."]);
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
    const old = { ...extracted, exercises: [extracted.exercises[1]], originalExtraction: extracted, selectedExerciseIndexes: [1], id: "old-plan", confirmed: true, persistenceVersion: 2, selectionConfirmed: true, sourceFileName: "old.pdf", uploadedAt: "2026-01-01", frequency: { rawText: "3 times per week", sessionsPerWeek: 3 } };
    plans.saveConfirmedPlan(old);
    plans.saveSchedule({ planId: old.id, frequencyKey: plans.frequencyInfo(old.frequency).key, days: [1, 3, 5] });
    const record = { id: "session-1", exerciseId: "old-plan:0", exerciseName: "Shoulder flexion", completedAt: "2026-01-01T12:00:00Z", completedLocalDate: "2026-01-01", completedReps: 6, targetReps: 6, status: "complete", score: 600, source: "hep", planId: old.id };
    progress.saveCompletedSession(record); progress.saveCompletedSession(record);
    assert.equal(progress.decodeProgress(storage.get(progress.PROGRESS_KEY)).length, 1);
    const editable = review.createConfirmedHEPReview(plans.getConfirmedPlan());
    assert.deepEqual(editable.review.map(item => item.included), [false, true]);
    editable.review[0].included = true; editable.review[1].included = false;
    editable.review[0].exercise.instructions = "Sit back toward the chair, then stand.";
    const next = { ...old, ...review.selectedHEP(editable.original, editable.review), frequency: old.frequency, id: "new-plan", originalExtraction: review.reviewedExtraction(editable.original, editable.review), selectedExerciseIndexes: review.selectedReviewIndexes(editable.review) };
    plans.confirmPlanReplacement(next, old.id);
    assert.equal(plans.getConfirmedPlan().exercises.length, 1);
    assert.equal(plans.getConfirmedPlan().exercises[0].name, "Squat");
    assert.equal(plans.getConfirmedPlan().exercises[0].instructions, "Sit back toward the chair, then stand.");
    assert.equal(plans.getConfirmedPlan().originalExtraction.exercises.length, 2);
    assert.deepEqual(plans.getConfirmedPlan().selectedExerciseIndexes, [0]);
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
await check("Legacy plans are invalidated silently; versioned explicitly selected plans load", () => {
  const plans = load("src/lib/scheduleStorage.ts");
  const legacy = { ...extracted, id: "legacy", confirmed: true, sourceFileName: "booklet.pdf" };
  assert.equal(plans.decodePlan(JSON.stringify(legacy)), null);
  assert.equal(plans.requiresPlanReview(JSON.stringify(legacy)), true);
  assert.equal(plans.decodePlan(JSON.stringify({ ...legacy, persistenceVersion: 2 })), null);
  const current = { ...legacy, persistenceVersion: 2, selectionConfirmed: true };
  assert.equal(plans.decodePlan(JSON.stringify(current)).exercises.length, 2);
  assert.equal(plans.requiresPlanReview(JSON.stringify(current)), false);
  assert.equal(plans.decodePlan(JSON.stringify({ ...current, exercises: [] })), null);
  const storage = new Map([[plans.PLAN_KEY, JSON.stringify(legacy)], ["rehabverse.story.v1", "story-kept"], ["rehabverse-progress-v1", "progress-kept"]]);
  const session = new Map([[plans.PLAN_KEY, JSON.stringify(legacy)]]);
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: key => session.get(key) ?? null, removeItem: key => session.delete(key) } });
  try {
    const unsubscribe = plans.subscribePlan(() => {}); unsubscribe();
    assert.equal(storage.has(plans.PLAN_KEY), false); assert.equal(session.has(plans.PLAN_KEY), false);
    assert.equal(storage.get("rehabverse.story.v1"), "story-kept"); assert.equal(storage.get("rehabverse-progress-v1"), "progress-kept");
    assert.ok(!fs.readFileSync("src/app/hep/page.tsx", "utf8").includes("Your older HEP needs exercise selection"));
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else delete globalThis.window;
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage); else delete globalThis.localStorage;
    if (oldSession) Object.defineProperty(globalThis, "sessionStorage", oldSession); else delete globalThis.sessionStorage;
  }
});
await check("Template frequency and instructions never create schedules or normal UI dosage", () => {
  const plans = load("src/lib/scheduleStorage.ts");
  const frequency = { rawText: "Do marked exercises ____ times a day.", sessionsPerWeek: 7 };
  const info = plans.frequencyInfo(frequency);
  assert.equal(info.weekly, undefined); assert.equal(info.canChoose, false); assert.ok(!info.instruction.includes("____"));
  const normalized = review.normalizeConfirmedHEP({ ...extracted, frequency, generalInstructions: ["Start at ____ reps.", "Move comfortably."], exercises: [{ name: "Squat", repetitions: "____", instructions: "Start at ____ reps. Move comfortably." }] });
  assert.equal(normalized.frequency.rawText, null);
  assert.equal(normalized.exercises[0].repetitions, null);
  assert.equal(normalized.exercises[0].instructions, "Move comfortably.");
  assert.deepEqual(normalized.generalInstructions, ["Move comfortably."]);
  assert.equal(hepCapability(normalized.exercises[0]), "reference");
});
await check("New registry aliases propagate to HEP and Explore; unobservable variants stay Guided", () => {
  for (const [name, id, instructions = ""] of [["Standing hip flexion", "hip_flexion"], ["Hip flexion", "hip_flexion", "Stand tall beside a counter."], ["Standing hip abduction", "hip_abduction"], ["Hamstring flexion", "knee_curl", "Perform standing with support."], ["Elbow flexion", "elbow_flexion"]]) {
    assert.equal(detector.detectorForExercise(name, instructions), id);
    assert.equal(detector.recognitionForExercise(name, instructions).mode, "pose");
    assert.equal(hepCapability({ name, repetitions: 6, instructions }), "interactive");
    const configured = hepQuest({ id: "mapped-plan", sourceFileName: "plan.pdf", uploadedAt: "2026-01-01", confirmed: true, exercises: [{ name, repetitions: 6, instructions }] }, 0);
    assert.equal(configured.trackingCapability, "interactive"); assert.equal(configured.detectorId, id); assert.equal(configured.source, "hep");
    assert.ok(catalog.catalogQuest(id.replaceAll("_", "-"), 6));
  }
  for (const [name, instructions] of [["Hip flexion", "Perform seated in a chair."], ["Knee raise", "Lie on your back."], ["Hip abduction", "Perform lying on your side."], ["Hamstring curl", "Perform seated."], ["Shoulder flexion", "Use the other arm to assist the movement."]]) {
    assert.equal(detector.detectorForExercise(name, instructions), undefined);
    assert.equal(detector.recognitionForExercise(name, instructions).mode, "guided");
  }
  for (const name of ["Gluteal sets", "Quad sets", "Bridging", "Heel slide", "Straight leg raise", "Lower trunk rotation", "Finger flexion", "Wrist extension", "Heel raise", "Sitting knee extension", "Chest press out"]) {
    assert.equal(detector.recognitionForExercise(name).mode, "guided");
    assert.equal(hepCapability({ name, repetitions: 6, instructions: "Follow your confirmed plan." }), "guided");
  }
});
await check("New pose geometry counts full cycles, rejects missing landmarks and locks sides", () => {
  for (const [id, indices] of [["hip_flexion", [11,23,25]], ["hip_abduction", [11,23,25]], ["knee_curl", [23,25,27]], ["elbow_flexion", [11,13,15]]]) {
    const engine = new MovementAttemptEngine(); let count = 0; let time = 0;
    function pointsFor(degrees) {
      const points = []; const [a,b,c] = indices; const r = degrees * Math.PI / 180;
      points[a] = p(.5,.2); points[b] = p(.5,.5); points[c] = p(.5 + Math.sin(r) * .2, .5 + Math.cos(r) * .2);
      return points;
    }
    for (const degrees of [...Array(12).fill(0), 8, 15, 24, 30, 25, 18, 10, 0, ...Array(12).fill(0)]) {
      const sample = detector.measureMovement(id, pointsFor(degrees), "left", 1);
      if (engine.process(sample.angle, time += 100).completedAttempt) count++;
    }
    assert.equal(count, 1, id);
    assert.equal(detector.measureMovement(id, pointsFor(0), "right"), null);
    const missing = pointsFor(0); missing[indices[2]].visibility = .1;
    assert.equal(detector.measureMovement(id, missing, "left"), null);
    assert.equal(detector.measureMovement(id, [], "left"), null);
  }
});
const nova = load("src/lib/novaAssistant.ts");
const novaInteraction = load("src/lib/novaInteraction.ts");
await check("Nova submits Enter, preserves Shift+Enter, sends final speech and auto-speaks only when enabled", () => {
  assert.equal(novaInteraction.shouldSubmitNovaKey("Enter", false, false), true);
  assert.equal(novaInteraction.shouldSubmitNovaKey("Enter", true, false), false);
  assert.equal(novaInteraction.shouldSubmitNovaKey("Enter", false, true), false);
  assert.equal(novaInteraction.finalSpeechQuestion("  explain head rolls  ", false), null);
  assert.equal(novaInteraction.finalSpeechQuestion("  explain head rolls  ", true), "explain head rolls");
  assert.equal(novaInteraction.shouldAutoSpeakNova(true, "Answer"), true);
  assert.equal(novaInteraction.shouldAutoSpeakNova(false, "Answer"), false);
  const source = fs.readFileSync("src/components/GlobalNova.tsx", "utf8");
  assert.match(source, /void ask\(final\)/); assert.match(source, /void speak\(answer, text\)/);
  assert.ok(!source.includes("Speak answer"));
});
await check("Nova routes navigation and session questions without model calls", () => {
  for (const [question, href] of [["go home", "/"], ["open home", "/"], ["open my HEP", "/hep"], ["show my quest", "/quest"], ["open Explore", "/explore"], ["open Story Mode", "/story"], ["show progress", "/progress"]]) assert.equal(nova.deterministicNova(question, { route: "/" }).href, href);
  const context = { route: "/session/squat", exercise: "Squat", target: 6, completed: 2, sessionState: "active", cameraEnabled: true, trackingReady: false, missingLandmarks: "Keep your knee visible." };
  assert.match(nova.deterministicNova("how many do I have left", context).text, /4 movements left/);
  assert.match(nova.deterministicNova("what exercise am I doing", context).text, /Squat/);
  assert.match(nova.deterministicNova("is my camera on", context).text, /on/);
  assert.match(nova.deterministicNova("why can't you see me", context).text, /knee visible/);
  assert.equal(nova.deterministicNova("start over", context).action, "reset");
  assert.equal(nova.deterministicNova("start over", { route: "/" }).action, undefined);
  assert.match(nova.deterministicNova("how many do I have left", { route: "/" }).text, /no active/);
  const explained = nova.deterministicNova("explain me how to do head rolls", { route: "/quest", mode: "HEP", exercise: "Head rolls", instructions: "Slowly roll your head from side to side." });
  assert.equal(explained.text, "For Head rolls, your confirmed HEP says: Slowly roll your head from side to side.");
  assert.match(nova.deterministicNova("how should I do head rolls", { route: "/quest", mode: "HEP", exercise: "Head rolls" }).text, /doesn't include exercise-specific instructions/);
});
await check("Nova strips image/private context fields and validates conversational responses", () => {
  const context = nova.safeNovaContext({ route: "/hep", cameraFrames: "private", patientName: "private", completed: -1, target: "6", instructions: "a".repeat(5000) });
  assert.equal(context.cameraFrames, undefined); assert.equal(context.patientName, undefined);
  assert.equal(context.target, undefined); assert.equal(context.completed, undefined); assert.equal(context.instructions.length, 2000);
  assert.equal(nova.validateNovaAnswer({ text: "Open My HEP to review your selected exercises." }), "Open My HEP to review your selected exercises.");
  assert.equal(nova.validateNovaAnswer({ text: "You should open My HEP to review your selected exercises." }), "You should open My HEP to review your selected exercises.");
  for (const value of [{ text: "Push harder" }, { text: "Increase your reps" }, { text: "hello", action: "reset" }, { text: "https://bad.example" }, { text: "" }, { text: "x".repeat(1201) }]) assert.equal(nova.validateNovaAnswer(value), null);
  assert.equal(nova.deterministicNova("My knee hurts. What exercise should I do?", { route: "/" }).text, nova.MEDICAL_ANSWER);
});
await check("Nova API bypasses Gemini for medical/state requests and rejects unsafe model output", async () => {
  const { POST } = load("src/app/api/nova/route.ts");
  const key = process.env.GEMINI_API_KEY; const voiceKey = process.env.ELEVENLABS_API_KEY;
  process.env.GEMINI_API_KEY = "test-only"; process.env.ELEVENLABS_API_KEY = "test-only";
  const request = (question, context = { route: "/", target: 6, completed: 2 }) => new Request("http://localhost/api/nova", { method: "POST", body: JSON.stringify({ question, context }) });
  try {
    const before = calls;
    assert.equal((await (await POST(request("My knee hurts"))).json()).text, nova.MEDICAL_ANSWER);
    assert.match((await (await POST(request("how many do I have left"))).json()).text, /4 movements/);
    const explained = await (await POST(request("explain me how to do head rolls", { route: "/session/squat", mode: "HEP", exercise: "Head rolls", instructions: "Slowly roll your head from side to side." }))).json();
    assert.equal(explained.text, "For Head rolls, your confirmed HEP says: Slowly roll your head from side to side.");
    assert.equal(typeof explained.voiceToken, "string");
    assert.equal(calls, before);
    modelOutput = { text: "My HEP lets you review your uploaded plan." };
    assert.equal((await POST(request("Explain the upload button"))).status, 200);
    modelOutput = { text: "Push harder" };
    assert.equal((await POST(request("Explain the upload button"))).status, 502);
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
    if (voiceKey === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = voiceKey;
  }
});
await check("PDF retry is sequential, capped at two, and excludes permanent errors/cancellation", async () => {
  const { analyzeWithRetry, retryDelayMilliseconds, transientAnalysisError } = load("src/lib/analysisRetry.ts");
  let attempts = 0; const delays = [];
  assert.equal(await analyzeWithRetry(async () => { if (++attempts === 1) throw { status: 503 }; return "ok"; }, new AbortController().signal, 45000, 2, undefined, { random: () => 0, sleep: async delay => { delays.push(delay); } }), "ok");
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [750]);
  assert.equal(retryDelayMilliseconds({ status: 429, headers: { "Retry-After": "2" } }, 0, () => 0, 0), 2000);
  assert.equal(retryDelayMilliseconds({ status: 503 }, 1, () => 0), 1500);
  attempts = 0;
  await assert.rejects(analyzeWithRetry(async () => { attempts++; throw new Error("timeout"); }, new AbortController().signal, 45000, 2, undefined, { sleep: async () => {} })); assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(analyzeWithRetry(async () => { attempts++; throw { status: 400 }; }, new AbortController().signal)); assert.equal(attempts, 1);
  const cancelled = new AbortController(); cancelled.abort(); attempts = 0;
  await assert.rejects(analyzeWithRetry(async () => { attempts++; return "bad"; }, cancelled.signal)); assert.equal(attempts, 0);
  assert.equal(transientAnalysisError({ status: 401 }), false);
  assert.equal(transientAnalysisError({ name: "TimeoutError" }), true);
  // Keep a timer active because AbortSignal.timeout intentionally does not keep Node alive.
  const keepAlive = setTimeout(() => {}, 1000); attempts = 0;
  try { await assert.rejects(analyzeWithRetry(signal => new Promise((resolve, reject) => { attempts++; signal.addEventListener("abort", () => reject(signal.reason), { once: true }); }), new AbortController().signal, 5, 2, undefined, { sleep: async () => {} })); }
  finally { clearTimeout(keepAlive); }
  assert.equal(attempts, 2);
});
const hepDocuments = load("src/lib/hepDocumentAnalysis.ts");
const { PDFDocument } = nativeRequire("pdf-lib");
async function blankPDF(pageCount) {
  const document = await PDFDocument.create();
  for (let page = 0; page < pageCount; page++) document.addPage([300, 400]);
  return document.save();
}
const batchHEP = (exercises, overrides = {}) => ({
  exercises,
  frequency: { sessionsPerWeek: null, specifiedDays: null, rawText: null },
  generalInstructions: [], extractionNotes: [], ...overrides,
});
await check("A 16-page PDF falls back to four visual page batches after a whole-document timeout", async () => {
  const bytes = await blankPDF(16);
  let wholeCalls = 0; let batchCalls = 0; let active = 0; let maxActive = 0;
  const result = await hepDocuments.analyzePDFWithFallback({
    bytes, signal: new AbortController().signal, longPageThreshold: 20,
    analyzePart: async (_part, _signal, context) => {
      if (context.kind === "whole") { wholeCalls++; throw new DOMException("Document analysis timed out", "TimeoutError"); }
      batchCalls++; active++; maxActive = Math.max(maxActive, active); await new Promise(resolve => setImmediate(resolve)); active--;
      return batchHEP([{ name: `Exercise ${context.batch.index + 1}`, sets: null, repetitions: 6, holdSeconds: null, instructions: null, notes: null }]);
    },
  });
  assert.equal(wholeCalls, 1); assert.equal(batchCalls, 4);
  assert.equal(maxActive, 1);
  assert.equal(result.pageCount, 16); assert.equal(result.usedBatches, true); assert.equal(result.extractedHEP.exercises.length, 4);
  const direct = await hepDocuments.splitPDF(bytes);
  assert.equal(direct.batches.length, 4); assert.deepEqual(direct.batches.map(batch => [batch.startPage, batch.endPage]), [[1,4],[5,8],[9,12],[13,16]]);
});
await check("Batch merging deduplicates compatible exercises and preserves meaningful variants", () => {
  const merged = hepDocuments.mergeExtractedHEPs([
    batchHEP([{ name: "Squat", sets: null, repetitions: null, holdSeconds: null, instructions: "Rise from the chair.", notes: null }], { generalInstructions: ["Move comfortably."], frequency: { sessionsPerWeek: 3, specifiedDays: null, rawText: "3 times per week" } }),
    batchHEP([
      { name: " squat ", sets: 2, repetitions: 6, holdSeconds: null, instructions: "Rise from the chair.", notes: null },
      { name: "Squat", sets: null, repetitions: 4, holdSeconds: null, instructions: "Hold the counter and bend your knees.", notes: null },
    ], { generalInstructions: ["move comfortably."], frequency: { sessionsPerWeek: 3, specifiedDays: null, rawText: "3 times per week" } }),
  ]);
  assert.equal(merged.exercises.length, 2);
  assert.equal(merged.exercises[0].sets, 2); assert.equal(merged.exercises[0].repetitions, 6);
  assert.match(merged.exercises[1].instructions, /counter/);
  assert.deepEqual(merged.generalInstructions, ["Move comfortably."]);
  assert.equal(merged.frequency.sessionsPerWeek, 3); assert.equal(merged.frequency.rawText, "3 times per week");
});
await check("Batch parsing keeps underscore template values missing", () => {
  const parsed = hepDocuments.parseHEPModelResponse(JSON.stringify({
    exercises: [{ name: "Heel slide", sets: "____", repetitions: "_____", holdSeconds: "...", instructions: "Start at ____ reps.", notes: null }],
    frequency: { sessionsPerWeek: 7, specifiedDays: null, rawText: "Do marked exercises ____ times a day." },
    generalInstructions: [], extractionNotes: [],
  }));
  assert.equal(parsed.exercises[0].sets, null); assert.equal(parsed.exercises[0].repetitions, null); assert.equal(parsed.exercises[0].holdSeconds, null);
  assert.deepEqual(parsed.frequency, { sessionsPerWeek: null, specifiedDays: null, rawText: null });
});
await check("One failed PDF batch receives one bounded retry", async () => {
  const bytes = await blankPDF(4); let calls = 0;
  const result = await hepDocuments.analyzePDFWithFallback({
    bytes, signal: new AbortController().signal, longPageThreshold: 0, concurrency: 1,
    analyzePart: async (_part, _signal, context) => {
      calls++;
      if (context.attempt === 0) throw { status: 503 };
      return batchHEP([{ name: "Elbow flexion", sets: null, repetitions: 6, holdSeconds: null, instructions: null, notes: null }]);
    },
  });
  assert.equal(calls, 2); assert.equal(result.extractedHEP.exercises.length, 1);
  assert.equal(hepDocuments.analysisErrorCategory({ status: 503 }), "network_upstream_failure");
  assert.equal(hepDocuments.analysisErrorCategory({ status: 429 }), "rate_limit");
  assert.equal(hepDocuments.analysisErrorCategory({ message: "RESOURCE_EXHAUSTED" }), "rate_limit");
});
await check("Cancelling a sequential PDF analysis stops before another batch begins", async () => {
  const controller = new AbortController(); let calls = 0; let started;
  const firstStarted = new Promise(resolve => { started = resolve; });
  const pending = hepDocuments.analyzePDFWithFallback({
    bytes: await blankPDF(12), signal: controller.signal,
    analyzePart: async (_part, signal) => new Promise((resolve, reject) => {
      calls++; started(); signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  await firstStarted; controller.abort(new DOMException("Cancelled", "AbortError"));
  await assert.rejects(pending); assert.equal(calls, 1);
});
await check("HEP upload failure keeps the selected file available for retry and replacement cancels work", () => {
  const source = fs.readFileSync("src/app/hep/page.tsx", "utf8");
  const analyzeStart = source.indexOf("async function analyzeHEP");
  const analyze = source.slice(analyzeStart, source.indexOf("\n  return (", analyzeStart));
  assert.match(analyze, /analysisRef\.current \|\| savingRef\.current/);
  assert.match(analyze, /setAnalysisError\(/);
  assert.ok(!analyze.includes("setSelectedFile(null)"));
  assert.match(source, /analysisError \? "Try again" : "Analyze HEP/);
  const choose = source.slice(source.indexOf("function chooseFile"), source.indexOf("function removeFile"));
  assert.match(choose, /analysisRef\.current\.abort\(\)/);
});
await check("A total PDF analysis failure cannot replace the current HEP", async () => {
  const plans = load("src/lib/scheduleStorage.ts");
  const storage = new Map();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  const current = { ...extracted, id: "current-plan", sourceFileName: "current.pdf", uploadedAt: "2026-01-01", confirmed: true, persistenceVersion: 2, selectionConfirmed: true };
  try {
    plans.saveConfirmedPlan(current);
    const before = storage.get(plans.PLAN_KEY);
    await assert.rejects(hepDocuments.analyzePDFWithFallback({
      bytes: await blankPDF(12), signal: new AbortController().signal, concurrency: 1,
      analyzePart: async () => { throw { status: 400 }; },
    }));
    assert.equal(storage.get(plans.PLAN_KEY), before);
    assert.equal(plans.getConfirmedPlan().id, "current-plan");
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else delete globalThis.window;
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage); else delete globalThis.localStorage;
  }
});
await check("Assistant speech tokens cannot authorize altered text", () => {
  const { signNovaVoice, verifyNovaVoice } = load("src/lib/novaVoiceToken.ts");
  const key = process.env.ELEVENLABS_API_KEY; process.env.ELEVENLABS_API_KEY = "test-only";
  try { const token = signNovaVoice("Hello"); assert.equal(verifyNovaVoice("Hello", token), true); assert.equal(verifyNovaVoice("Changed", token), false); assert.equal(verifyNovaVoice("Hello", "bad"), false); }
  finally { if (key === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = key; }
});
console.log(`\n${passed} deterministic core checks passed.`);
