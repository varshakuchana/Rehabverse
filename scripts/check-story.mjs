import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(filename) {
  const file = path.resolve(filename);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = id => id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : id.startsWith('.') ? load(`${path.resolve(path.dirname(file), id)}.ts`) : nativeRequire(id);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(require, loaded, loaded.exports);
  return loaded.exports;
}
const { initialStory, completeStoryLevel, decodeStory, initialSequence, advanceSequence, resetSequence } = load('src/lib/storyProgress.ts');
const { storyRealms, storyQuest, abilities, storyLines } = load('src/data/storyCampaign.ts');
const storage = load('src/lib/storyStorage.ts');
const { isSpeakableNovaText } = load('src/lib/novaMessages.ts');
let count = 0;
function check(name, fn) { fn(); count++; console.log(`✓ ${name}`); }
check('Initial Story has only the Grove available and no rewards', () => {
  const state = initialStory();
  assert.deepEqual(state.unlockedRealms, ['sleeping-grove']);
  for (const key of ['completedLevels', 'collectedFragments', 'unlockedAbilities']) assert.deepEqual(state[key], []);
  assert.equal(state.prologueSeen, false); assert.equal(state.storyCompleted, false); assert.equal(state.currentRealm, null);
});
check('Locked realm and finale cannot complete early', () => {
  const state = initialStory();
  assert.equal(completeStoryLevel(state, 'motion-core'), state);
  assert.equal(completeStoryLevel(state, 'sky-ruins'), state);
});
check('Each completion awards one fragment/ability and unlocks exactly the next realm', () => {
  let state = initialStory();
  for (let i = 0; i < 3; i++) {
    const realm = storyRealms[i]; state = completeStoryLevel(state, realm.id);
    assert.equal(state.completedLevels.length, i + 1);
    assert.equal(state.collectedFragments.length, i + 1);
    assert.equal(state.unlockedAbilities.length, i + 1);
    assert.equal(state.unlockedRealms.length, i + 2);
    assert.ok(state.collectedFragments.includes(realm.fragment));
    assert.equal(completeStoryLevel(state, realm.id), state);
  }
  assert.ok(state.unlockedRealms.includes('motion-core')); assert.equal(state.storyCompleted, false);
  state = completeStoryLevel(state, 'motion-core'); assert.equal(state.storyCompleted, true); assert.equal(state.collectedFragments.length, 3);
});
check('Save decoding reconstructs unlocks and rejects forged unlock fields', () => {
  const forged = { ...initialStory(), unlockedRealms: ['motion-core'], storyCompleted: true, collectedFragments: ['fake'], completedLevels: ['core-rebuilt'] };
  assert.deepEqual(decodeStory(JSON.stringify(forged)), initialStory());
  let complete = initialStory(); for (const r of storyRealms) complete = completeStoryLevel(complete, r.id);
  assert.deepEqual(decodeStory(JSON.stringify(complete)), complete);
  assert.throws(() => decodeStory('{broken')); assert.throws(() => decodeStory('{"version":42}'));
});
check('Visible sequences advance by completed ability stages and terminate once', () => {
  const realm = storyRealms[2]; let state = initialSequence();
  for (const stage of realm.stages) state = advanceSequence(state, realm, stage.ability);
  assert.equal(state.done, true); assert.equal(state.stage, 5);
  assert.equal(advanceSequence(state, realm, 'lumen-rise'), state);
});
check('Wrong ability or tracking loss restarts only the current pattern', () => {
  const realm = storyRealms[2]; let state = initialSequence();
  state = advanceSequence(state, realm, 'lumen-rise');
  assert.equal(advanceSequence(state, realm, 'terra-pulse').stage, 0);
  assert.equal(resetSequence(state, realm).stage, 0);
  for (const ability of ['aether-wing', 'terra-pulse', 'lumen-rise', 'aether-wing']) state = advanceSequence(state, realm, ability);
  const reset = resetSequence(state, realm);
  assert.equal(reset.stage, 3); assert.equal(reset.resets, 1); assert.equal(reset.done, false);
  assert.equal(resetSequence(initialSequence(), storyRealms[0]).resets, 0);
});
check('Every Story stage uses an existing detector and modest action target', () => {
  for (const realm of storyRealms) realm.stages.forEach((stage, i) => {
    const quest = storyQuest(realm, i);
    assert.equal(quest.detectorId, abilities[stage.ability].detectorId);
    assert.equal(quest.trackingCapability, 'interactive');
    assert.equal(quest.target, stage.targetActions); assert.ok(quest.target >= 1 && quest.target <= 5);
  });
});
check('Story storage and reset leave HEP, Explore, history and voice keys untouched', () => {
  const other = new Map([['hep', 'plan'], ['progress', 'sessions'], ['explore', 'quest'], ['voice', 'off']]);
  const data = new Map(other);
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  storage.beginStory(); assert.equal(storage.readStory().prologueSeen, true);
  assert.throws(() => storage.enterStoryRealm('motion-core'));
  assert.throws(() => storage.saveStoryCompletion('motion-core'));
  storage.enterStoryRealm('sleeping-grove'); storage.saveStoryCompletion('sleeping-grove');
  assert.ok(storage.readStory().unlockedRealms.includes('crystal-passage'));
  assert.deepEqual(storage.resetStory(), initialStory()); assert.deepEqual(storage.readStory(), initialStory());
  for (const [key, value] of other) assert.equal(data.get(key), value);
  assert.equal(data.size, other.size + 1);
});
check('Storage failure is surfaced for retry rather than silently claiming success', () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw Error('quota'); } };
  assert.throws(() => storage.saveStoryCompletion('sleeping-grove'), /quota/);
  delete globalThis.localStorage;
});
check('Nova permits authored Story lines and rejects arbitrary narrative', () => {
  for (const line of Object.values(storyLines)) assert.equal(isSpeakableNovaText(line), true);
  assert.equal(isSpeakableNovaText('Invent a treatment plan'), false);
});
console.log(`\n${count} deterministic Story checks passed.`);
