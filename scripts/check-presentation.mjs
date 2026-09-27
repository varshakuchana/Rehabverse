// Exercise visual lifecycle without a GPU, browser, camera or session controller.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const require = (id) => {
  assert.equal(id, 'three');
  return THREE;
};
const source = fs.readFileSync('src/lib/rehabWorld/engine.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(require, module, exports) {${output}\n})`)(require, mod, mod.exports);
const { RehabWorldEngine } = mod.exports;
const engine = Object.create(RehabWorldEngine.prototype);
let applied = 0;
Object.assign(engine, {
  timer: { getElapsed: () => 0 }, experience: 'bridge', activeZone: 0,
  zones: [{ items: [{ pos: new THREE.Vector3() }] }],
  world: new THREE.Group(), core: new THREE.Group(), comets: [], timers: [], sparks: [],
  glowSprite: () => new THREE.Sprite(new THREE.SpriteMaterial()),
  spark: () => {}, setZoneProgress: () => { applied++; },
});
engine.releaseEnergy(.2);
engine.releaseEnergy(.8);
// Late/out-of-order arrivals must never overwrite the adapter's latest progress.
engine.comets[1].onArrive();
engine.comets[0].onArrive();
assert.equal(applied, 0);
let disposed = 0;
for (const comet of engine.comets) comet.sprite.material.addEventListener('dispose', () => { disposed++; });
engine.timers.push({ at: 1, fn: () => { throw Error('stale completion'); } });
const spark = new THREE.Sprite();
engine.sparks.push({ s: spark, life: 1 });
engine.cancelEffects();
assert.equal(disposed, 2);
assert.equal(engine.comets.length, 0);
assert.equal(engine.timers.length, 0);
assert.equal(engine.world.children.length, 0);
assert.equal(spark.visible, false);
assert.equal(engine.sparks[0].life, 0);
engine.cancelEffects();
assert.equal(disposed, 2);
console.log('✓ Delayed effects cannot rewind authoritative restoration');
console.log('✓ Replay cancels and disposes pending effects and callbacks');
console.log('✓ Repeated visual cleanup is safe');
