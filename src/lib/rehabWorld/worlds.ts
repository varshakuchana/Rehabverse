import * as THREE from "three";
import type { PoseLandmark } from "./engine";

/*
  Exercise worlds. Each exercise gets its own place, and the movement maps
  onto something in that place:

    well   (squat / sit to stand)  the bucket drops as you lower and rises as you stand;
                                   each rep waters one garden bed
    flock  (arm raise)             a bird's wings rise with your arms; each rep it takes
                                   off and joins the flock over the sea
    cairn  (balance hold)          a stone settles onto the cairn only while you hold still
    orbit  (ankle circles, and any follow-along exercise)
                                   each movement sends a moon into orbit around a small planet

  The engine owns renderer, camera, light, sparks and the user's light figure.
  A world builder owns its scene objects and decides how energy/holds look.
*/

export type WorldKind = "well" | "flock" | "cairn" | "orbit";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (u: number) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
const smooth = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-dt * rate));

const POSE_EDGES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];
const POSE_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

type Item = { apply: (k: number) => void; pos: THREE.Vector3; k: number; from: number; to: number; start: number };

type Ctx = {
  root: THREE.Group;
  scene: THREE.Scene;
  count: number;
  reduceMotion: boolean;
  mat: (hex: string, extra?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  glow: (white?: boolean) => THREE.Sprite;
  rnd: () => number;
  addItem: (pos: THREE.Vector3, apply?: (k: number) => void) => Item;
  spark: (at: THREE.Vector3, n: number, color?: string) => void;
  later: (delay: number, fn: () => void) => void;
  now: () => number;
};

type Live = { energy: number; hold: number; vit: number; ready: boolean };

type Built = {
  figure: THREE.Vector3 | null;
  camTarget: THREE.Vector3;
  camOffset: THREE.Vector3;
  update: (dt: number, t: number, s: Live) => void;
  release: (index: number, done: () => void) => void;
  reset: (restored: number) => void;
  pulse?: () => void;
};

/* ======================================================================
   WELL: squat. Draw water, grow the garden.
   ====================================================================== */
function buildWell(c: Ctx): Built {
  const { root, mat } = c;

  // meadow ground + distant hills
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(11, 10.5, 0.6, 14), mat("#6E8F4E"));
  ground.position.set(2, -0.3, 0);
  root.add(ground);
  const path = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 10), mat("#B59A72"));
  path.scale.set(1.4, 1, 0.8);
  path.position.set(-0.4, 0.01, 1.1);
  root.add(path);
  for (const [x, z, s, col] of [[-14, -34, 9, "#5C7D48"], [6, -40, 12, "#4E6E42"], [22, -32, 8, "#678A4D"], [-4, -46, 13, "#476540"]] as const) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(s, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(col));
    h.scale.y = 0.28;
    h.position.set(x, -0.3, z);
    root.add(h);
  }
  for (const [x, z] of [[-5.5, -3.5], [-6.5, 0.5], [8.8, -3.2]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6), mat("#6B4A32"));
    trunk.position.set(x, 0.7, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat("#4F7A45"));
    crown.position.set(x, 2.1, z);
    root.add(trunk, crown);
  }

  // the well
  const well = new THREE.Group();
  well.position.set(0, 0, 0);
  root.add(well);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 0.95, 12, 1, true), mat("#9A948A", { side: THREE.DoubleSide }));
  wall.position.y = 0.47;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.12, 5, 12), mat("#AAA398"));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.95;
  const waterIn = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12), mat("#2E5E7A", { emissive: "#0B2233" }));
  waterIn.rotation.x = -Math.PI / 2;
  waterIn.position.y = 0.25;
  const postMat = mat("#7A5334");
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.16), postMat);
  postL.position.set(-0.95, 1.25, 0);
  const postR = postL.clone();
  postR.position.x = 0.95;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.95, 4), mat("#8E3F2F"));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.95;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 8), mat("#5B3E27"));
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 2.25;
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), mat("#5B3E27"));
  crank.position.set(1.1, 2.05, 0);
  well.add(wall, lip, waterIn, postL, postR, roof, axle, crank);

  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), mat("#D9C6A0"));
  const bucket = new THREE.Group();
  const bucketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.21, 0.36, 9), mat("#8A5A3C"));
  const bucketBand = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 4, 12), mat("#444"));
  bucketBand.rotation.x = Math.PI / 2;
  bucketBand.position.y = 0.1;
  const bucketWater = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10), mat("#58A8D8", { emissive: "#1B4F70" }));
  bucketWater.rotation.x = -Math.PI / 2;
  bucketWater.position.y = 0.15;
  bucketWater.visible = false;
  bucket.add(bucketBody, bucketBand, bucketWater);
  well.add(rope, bucket);
  const TOP = 1.75, BOTTOM = 0.35;
  let bucketY = TOP;

  // garden beds
  const plantKinds = [
    { flower: "#F5C542", center: "#6B4226", tall: 1.1 },
    { flower: "#E4513A", center: "#E4513A", tall: 0.7 },
    { flower: "#9C7BD6", center: "#9C7BD6", tall: 0.8 },
    { flower: "#7FB65A", center: "#5E9A45", tall: 0.45 },
    { flower: "#F08A3C", center: "#4E8A3A", tall: 0.5 },
  ];
  const cols = Math.ceil(c.count / 2);
  const bedW = Math.min(0.95, 5.2 / cols);
  for (let i = 0; i < c.count; i++) {
    const col = Math.floor(i / 2), row = i % 2;
    const x = 2.1 + col * bedW * 1.12, z = -0.7 + row * 1.25;
    const soilMat = mat("#A58866");
    const soil = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.18, 0.9), soilMat);
    soil.position.set(x, 0.09, z);
    root.add(soil);
    const kind = plantKinds[i % plantKinds.length];
    const plant = new THREE.Group();
    plant.position.set(x, 0.18, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, kind.tall, 5), mat("#4E8A3A"));
    stem.position.y = kind.tall / 2;
    const leafMat = mat("#5FA046");
    const leafA = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), leafMat);
    leafA.scale.set(1.4, 0.35, 0.7);
    leafA.position.set(0.12, kind.tall * 0.4, 0);
    const leafB = leafA.clone();
    leafB.position.x = -0.12;
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(kind.tall > 0.9 ? 0.22 : 0.16, 0), mat(kind.flower));
    bloom.position.y = kind.tall + 0.05;
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(kind.center));
    heart.position.set(0, kind.tall + 0.06, 0.15);
    heart.visible = kind.tall > 0.9;
    plant.add(stem, leafA, leafB, bloom, heart);
    root.add(plant);
    const dry = new THREE.Color("#A58866"), wet = new THREE.Color("#5A3E2B");
    c.addItem(new THREE.Vector3(x, 0.2, z), (k) => {
      soilMat.color.copy(dry).lerp(wet, clamp01(k * 1.5));
      plant.visible = k > 0.02;
      plant.scale.setScalar(Math.max(0.001, k) * 1.35);
    });
  }

  // flying water
  const drops: { s: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t: number; delay: number }[] = [];
  const pending: { idx: number; done: () => void; t: number }[] = [];

  return {
    figure: new THREE.Vector3(-2.1, 0, 0.9),
    camTarget: new THREE.Vector3(1.6, 0.9, 0.3),
    camOffset: new THREE.Vector3(0.6, 4.2, 11.5),
    update(dt, t, s) {
      // the bucket follows the user's hips: lower = deeper into the well
      const target = TOP - s.energy * (TOP - BOTTOM);
      bucketY = smooth(bucketY, target, s.energy > 0 ? 8 : 3, dt);
      bucket.position.set(0, bucketY - 0.2, 0);
      bucket.rotation.z = c.reduceMotion ? 0 : Math.sin(t * 2.2) * 0.04;
      const len = 2.25 - bucketY;
      rope.scale.y = Math.max(0.01, len);
      rope.position.set(0, 2.25 - len / 2, 0);
      axle.rotation.x = -bucketY * 3;
      crank.position.set(1.1, 2.25 + Math.cos(bucketY * 3) * 0.2, Math.sin(bucketY * 3) * 0.2);
      bucketWater.visible = s.energy > 0.55 || pending.length > 0;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (d.delay > 0) { d.delay -= dt; continue; }
        d.t += dt / 0.75;
        const u = Math.min(1, d.t);
        d.s.visible = true;
        d.s.position.copy(d.from).lerp(d.to, u);
        d.s.position.y += Math.sin(u * Math.PI) * 1.8;
        if (u >= 1) { root.remove(d.s); d.s.material.dispose(); drops.splice(i, 1); }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { const p = pending[i]; pending.splice(i, 1); p.done(); }
      }
    },
    release(idx, done) {
      const it = targetOf(idx);
      for (let k = 0; k < 7; k++) {
        const s = c.glow(true);
        s.material.color.set("#7CC8F2");
        s.material.opacity = 0.95;
        s.scale.set(0.34, 0.34, 1);
        s.visible = false;
        root.add(s);
        drops.push({ s, from: new THREE.Vector3(0.3, TOP, 0.2), to: it.clone().add(new THREE.Vector3((c.rnd() - 0.5) * 0.4, 0.2, (c.rnd() - 0.5) * 0.3)), t: 0, delay: k * 0.05 });
      }
      pending.push({ idx, done, t: 0.8 });
    },
    reset() { bucketY = TOP; },
  };

  function targetOf(idx: number) {
    const col = Math.floor(idx / 2), row = idx % 2;
    return new THREE.Vector3(2.1 + col * bedW * 1.12, 0.3, -0.7 + row * 1.25);
  }
}

/* ======================================================================
   FLOCK: arm raise. Wings follow your arms, birds join the flock.
   ====================================================================== */
function buildFlock(c: Ctx): Built {
  const { root, mat } = c;

  // cliff top and face
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.2, 0.5, 11), mat("#6F9A55"));
  top.position.set(-1.5, -0.25, 0);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 4.8, 9, 11), mat("#8C7F73"));
  face.position.set(-1.5, -5, 0);
  root.add(top, face);
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + c.rnd() * 0.5, 0), mat("#9A8E82"));
    const a = c.rnd() * Math.PI * 2;
    r.position.set(-1.5 + Math.cos(a) * 5.3, 0.1, Math.sin(a) * 5.3);
    root.add(r);
  }

  // sea
  const seaGeo = new THREE.PlaneGeometry(120, 120, 40, 40);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = mat("#2F6F8F", { flatShading: true, roughness: 0.4, metalness: 0.1 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(10, -7.5, -10);
  root.add(sea);
  const basePos = (seaGeo.attributes.position.array as Float32Array).slice();

  // tree on the cliff
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 7), mat("#6B4A32"));
  trunk.position.set(-4.3, 1.3, -1.8);
  root.add(trunk);
  for (const [x, y, z, s] of [[-4.3, 3, -1.8, 1.3], [-3.5, 2.6, -1.4, 0.9], [-5, 2.5, -2.2, 0.95]]) {
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat("#4E7F48"));
    cr.position.set(x, y, z);
    root.add(cr);
  }

  // perch rock beside the figure
  const perch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mat("#A09486"));
  perch.scale.y = 0.7;
  perch.position.set(0.6, 0.25, 1.2);
  root.add(perch);
  const perchTop = new THREE.Vector3(0.6, 0.62, 1.2);

  // sun on the horizon
  const sun = c.glow();
  sun.material.color.set("#FFC89A");
  root.add(sun);

  type Bird = {
    g: THREE.Group; wl: THREE.Group; wr: THREE.Group;
    state: "hidden" | "perch" | "launch" | "fly";
    t: number; from: THREE.Vector3; orbitR: number; orbitH: number; angle: number; speed: number; phase: number;
  };
  const birds: Bird[] = [];
  const colours = ["#F4F1EA", "#E9E4DA", "#FFB199", "#F4F1EA", "#D9E2E8"];
  for (let i = 0; i < c.count; i++) {
    const g = new THREE.Group();
    const bm = mat(colours[i % colours.length]);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 6), bm);
    body.rotation.z = -Math.PI / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), bm);
    head.position.set(0.34, 0.06, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), mat("#F2A33A"));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.48, 0.05, 0);
    const wingGeo = new THREE.BoxGeometry(0.34, 0.02, 0.62);
    wingGeo.translate(0, 0, 0.31);
    const wl = new THREE.Group(), wr = new THREE.Group();
    wl.add(new THREE.Mesh(wingGeo, bm));
    const wrMesh = new THREE.Mesh(wingGeo, bm);
    wrMesh.rotation.y = Math.PI;
    wr.add(wrMesh);
    g.add(body, head, beak, wl, wr);
    g.visible = false;
    g.scale.setScalar(1.5);
    root.add(g);
    birds.push({ g, wl, wr, state: "hidden", t: 0, from: new THREE.Vector3(), orbitR: 2.4 + c.rnd() * 2.4, orbitH: 3.2 + c.rnd() * 1.8, angle: c.rnd() * 6, speed: 0.35 + c.rnd() * 0.25, phase: c.rnd() * 6 });
    c.addItem(perchTop.clone());
  }
  const FLOCK_C = new THREE.Vector3(4.5, 0, -6);
  let wingLift = 0;

  function perchNext(from: number) {
    const b = birds.find((x, i) => i >= from && x.state === "hidden");
    if (b) { b.state = "perch"; b.g.visible = true; b.t = 0; }
  }
  perchNext(0);

  function setWings(b: Bird, angle: number) {
    b.wl.rotation.x = -angle;
    b.wr.rotation.x = angle;
  }

  return {
    figure: new THREE.Vector3(-1.4, 0, 0.9),
    camTarget: new THREE.Vector3(1.6, 1.6, -0.5),
    camOffset: new THREE.Vector3(1.2, 3.4, 12),
    update(dt, t, s) {
      // gentle sea
      const arr = seaGeo.attributes.position.array as Float32Array;
      if (!c.reduceMotion) {
        for (let i = 0; i < arr.length; i += 3) arr[i + 1] = basePos[i + 1] + Math.sin(basePos[i] * 0.25 + t * 0.9) * 0.18 + Math.cos(basePos[i + 2] * 0.3 + t * 0.7) * 0.14;
        seaGeo.attributes.position.needsUpdate = true;
      }
      seaMat.color.set("#2F4F7F").lerp(new THREE.Color("#3C8FB0"), s.vit);
      sun.position.set(14, -6 + s.vit * 7, -30);
      const ss = 7 + s.vit * 6;
      sun.scale.set(ss, ss, 1);
      sun.material.opacity = 0.6 + 0.35 * s.vit;

      wingLift = smooth(wingLift, s.energy, 9, dt);
      for (const b of birds) {
        if (b.state === "perch") {
          b.t = Math.min(1, b.t + dt * 2);
          b.g.position.copy(perchTop);
          b.g.rotation.set(0, -0.6, 0);
          b.g.scale.setScalar(Math.max(0.001, easeOutBack(b.t)) * 1.5);
          // wings mirror the user's arms: down at rest, up as they raise
          setWings(b, -0.15 + wingLift * 1.35);
        } else if (b.state === "launch") {
          b.t += dt / 1.4;
          const u = Math.min(1, b.t);
          const end = new THREE.Vector3(FLOCK_C.x + Math.cos(b.angle) * b.orbitR, b.orbitH, FLOCK_C.z + Math.sin(b.angle) * b.orbitR);
          const p = b.from.clone().lerp(end, u);
          p.y += Math.sin(u * Math.PI) * 1.2;
          const dir = end.clone().sub(b.from);
          b.g.position.copy(p);
          b.g.rotation.set(0, -Math.atan2(dir.z, dir.x), -0.25);
          setWings(b, Math.sin(t * 16) * 0.9);
          if (u >= 1) b.state = "fly";
        } else if (b.state === "fly") {
          b.angle += dt * b.speed;
          const x = FLOCK_C.x + Math.cos(b.angle) * b.orbitR;
          const z = FLOCK_C.z + Math.sin(b.angle) * b.orbitR;
          b.g.position.set(x, b.orbitH + Math.sin(t * 0.8 + b.phase) * 0.35, z);
          b.g.rotation.set(0, -b.angle - Math.PI / 2 + Math.PI, 0.35);
          setWings(b, c.reduceMotion ? 0.3 : Math.sin(t * 7 + b.phase) * 0.7);
        }
      }
    },
    release(idx, done) {
      const b = birds[idx];
      if (!b) { done(); return; }
      b.state = "launch";
      b.t = 0;
      b.from.copy(perchTop);
      c.spark(perchTop, 10, "#FFD0B8");
      c.later(0.9, () => perchNext(idx + 1));
      c.later(1.2, done);
    },
    reset(restored) {
      birds.forEach((b, i) => {
        if (i < restored) { b.state = "fly"; b.g.visible = true; b.g.scale.setScalar(1.5); }
        else { b.state = "hidden"; b.g.visible = false; }
      });
      perchNext(restored);
    },
  };
}

/* ======================================================================
   CAIRN: balance. Hold still and the stone settles.
   ====================================================================== */
function buildCairn(c: Ctx): Built {
  const { root, mat } = c;

  // lake
  const lakeMat = mat("#1F4A5A", { transparent: true, opacity: 0.92, roughness: 0.25, metalness: 0.2, emissive: "#06161C" });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(60, 40), lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = -0.08;
  root.add(lake);

  // shore: grass for the user, a flat rock platform for the cairn
  const shore = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.3, 12), mat("#5E8250"));
  shore.position.set(-2.2, 0, 1);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.35, 9), mat("#8E8C88"));
  platform.position.set(1.7, 0, 0);
  root.add(shore, platform);
  for (let i = 0; i < 7; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + c.rnd() * 0.3, 0), mat("#7D7B78"));
    const a = c.rnd() * Math.PI * 2;
    r.position.set(1.7 + Math.cos(a) * 2.2, 0.05, Math.sin(a) * 2.2);
    root.add(r);
  }
  // reeds
  for (let i = 0; i < 14; i++) {
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.8 + c.rnd() * 0.6, 4), mat("#6E8C4A"));
    reed.position.set(-4.6 + c.rnd() * 1.6, 0.4, 2.2 + c.rnd() * 1.4);
    reed.rotation.z = (c.rnd() - 0.5) * 0.3;
    root.add(reed);
  }
  // mountains with snow
  for (const [x, z, h, r] of [[-20, -52, 10, 10], [-4, -60, 13, 12], [14, -54, 9, 9], [30, -62, 12, 11]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat("#4A5670"));
    m.position.set(x, h / 2 - 0.1, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 6), mat("#E8EEF4"));
    cap.position.set(x, h - h * 0.16 - 0.1, z);
    root.add(m, cap);
  }
  const moon = c.glow();
  moon.material.color.set("#DDEFFF");
  moon.position.set(10, 12, -50);
  moon.scale.set(5, 5, 1);
  root.add(moon);

  // the cairn: two base stones, then one stone per hold
  const stoneCols = ["#9A958D", "#B5AFA5", "#8C8780", "#C2BCB1", "#A7A197"];
  let stackY = 0.18;
  const base = [[1.05, 0.42], [0.85, 0.36]];
  for (const [r, h] of base) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat("#8A857E"));
    s.scale.set(1, h / r, 1);
    s.position.set(1.7, stackY + h, 0);
    stackY += h * 2 * 0.92;
    root.add(s);
  }
  type Stone = { m: THREE.Mesh; rest: number; state: "wait" | "hover" | "land" | "placed"; y: number; t: number; wob: number };
  const stones: Stone[] = [];
  for (let i = 0; i < c.count; i++) {
    const r = Math.max(0.28, 0.7 - i * (0.36 / Math.max(1, c.count)));
    const h = r * 0.42;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(stoneCols[i % stoneCols.length], { emissive: "#000000" }));
    m.scale.set(1, 0.42, 1);
    m.visible = false;
    root.add(m);
    const rest = stackY + h;
    stackY += h * 2 * 0.9;
    stones.push({ m, rest, state: "wait", y: rest + 2.4, t: 0, wob: 0 });
    c.addItem(new THREE.Vector3(1.7, rest, 0));
  }

  // ripples on the water
  const ripples: { m: THREE.Mesh; t: number; speed: number }[] = [];
  function ripple(x: number, z: number, speed = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: "#CFEFFF", transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -0.05, z);
    root.add(m);
    ripples.push({ m, t: 0, speed });
  }
  let rippleClock = 0;

  // fireflies appear as the evening calms
  const flies: { s: THREE.Sprite; a: number; r: number; y: number; sp: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const s = c.glow(true);
    s.material.color.set("#FFF3B0");
    root.add(s);
    flies.push({ s, a: c.rnd() * 6.28, r: 2 + c.rnd() * 4, y: 0.6 + c.rnd() * 2, sp: 0.2 + c.rnd() * 0.3 });
  }

  function current() { return stones.find((s) => s.state === "wait" || s.state === "hover"); }

  return {
    figure: new THREE.Vector3(-2.2, 0.15, 1),
    camTarget: new THREE.Vector3(0.1, 1.3, 0.2),
    camOffset: new THREE.Vector3(0.4, 3.2, 10.5),
    update(dt, t, s) {
      const cur = current();
      for (const st of stones) {
        if (st === cur) {
          st.state = "hover";
          st.m.visible = true;
          // settles as the hold fills; lifts and sways when the user steps out
          const target = st.rest + 0.12 + (1 - s.hold) * 2.2 + (s.energy > 0 ? 0 : 0.4);
          st.y = smooth(st.y, target, s.energy > 0 ? 2.5 : 1.5, dt);
          st.wob = smooth(st.wob, s.energy > 0 ? 0.03 : 0.22, 2, dt);
          st.m.position.set(1.7 + (c.reduceMotion ? 0 : Math.sin(t * 2.3) * st.wob * 0.6), st.y, 0);
          st.m.rotation.set(c.reduceMotion ? 0 : Math.sin(t * 1.7) * st.wob, t * 0.2, c.reduceMotion ? 0 : Math.cos(t * 2.1) * st.wob);
          (st.m.material as THREE.MeshStandardMaterial).emissive.setRGB(0.25 * s.energy, 0.45 * s.energy, 0.5 * s.energy);
        } else if (st.state === "land") {
          st.t = Math.min(1, st.t + dt / 0.35);
          st.m.position.set(1.7, st.y + (st.rest - st.y) * st.t, 0);
          st.m.rotation.set(0, st.m.rotation.y, 0);
          if (st.t >= 1) { st.state = "placed"; st.m.position.y = st.rest; }
        } else if (st.state === "placed") {
          (st.m.material as THREE.MeshStandardMaterial).emissive.setRGB(0.05, 0.09, 0.1);
        }
      }
      // restless water while not holding, calm while balancing
      rippleClock += dt;
      if (rippleClock > (s.energy > 0 ? 2.6 : 0.9)) {
        rippleClock = 0;
        ripple(-0.5 + c.rnd() * 5, -1.5 + c.rnd() * 4, 0.7);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.t += dt * r.speed;
        const sc = 0.3 + r.t * 3;
        r.m.scale.set(sc, sc, 1);
        (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.45 * (1 - r.t / 1.6));
        if (r.t > 1.6) { root.remove(r.m); r.m.geometry.dispose(); (r.m.material as THREE.Material).dispose(); ripples.splice(i, 1); }
      }
      lakeMat.color.set("#16323F").lerp(new THREE.Color("#2E6F82"), s.vit);
      moon.material.opacity = 0.5 + 0.4 * s.vit;
      flies.forEach((f, i) => {
        f.a += dt * f.sp;
        const show = i / flies.length < s.vit + s.energy * 0.2;
        f.s.position.set(0.5 + Math.cos(f.a) * f.r, f.y + Math.sin(t * 1.3 + i) * 0.3, Math.sin(f.a) * f.r * 0.6);
        f.s.scale.set(0.3, 0.3, 1);
        f.s.material.opacity = show ? 0.5 + 0.4 * Math.sin(t * 3 + i) : 0;
      });
    },
    release(idx, done) {
      const st = stones[idx];
      if (!st) { done(); return; }
      st.state = "land";
      st.t = 0;
      c.later(0.35, () => {
        ripple(1.7, 0, 0.9);
        c.later(0.25, () => ripple(1.7, 0, 0.9));
        c.spark(new THREE.Vector3(1.7, st.rest, 0), 12, "#CFEFFF");
        done();
      });
    },
    reset(restored) {
      stones.forEach((st, i) => {
        if (i < restored) { st.state = "placed"; st.m.visible = true; st.m.position.set(1.7, st.rest, 0); }
        else { st.state = "wait"; st.m.visible = false; st.y = st.rest + 2.4; }
      });
    },
  };
}

/* ======================================================================
   ORBIT: ankle circles and follow-along exercises. Moons take their orbits.
   ====================================================================== */
function buildOrbit(c: Ctx): Built {
  const { root, mat } = c;
  const P = new THREE.Vector3(1.2, 1.2, -1);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 700; i++) {
    const u = c.rnd() * 2 - 1, a = c.rnd() * Math.PI * 2, r = 50 + c.rnd() * 20;
    const s = Math.sqrt(1 - u * u);
    pts.push(Math.cos(a) * s * r, u * r * 0.6 + 8, Math.sin(a) * s * r - 20);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.25, transparent: true, opacity: 0.8 }));
  root.add(stars);

  // nebula glows
  const nebulae: THREE.Sprite[] = [];
  for (const [x, y, z, s, col] of [[-12, 8, -30, 22, "#7A5CFF"], [14, 3, -28, 18, "#FF6FB5"], [2, 14, -35, 26, "#4FC3F7"]] as const) {
    const n = c.glow(true);
    n.material.color.set(col);
    n.position.set(x, y, z);
    n.scale.set(s, s, 1);
    root.add(n);
    nebulae.push(n);
  }

  // the planet
  const planetMat = mat("#5B6BB5", { emissive: "#10143A" });
  const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), planetMat);
  planet.position.copy(P);
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.7, 48), new THREE.MeshBasicMaterial({ color: "#C8B8FF", transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ringMesh.position.copy(P);
  ringMesh.rotation.set(Math.PI / 2 - 0.35, 0.2, 0);
  const halo = c.glow(true);
  halo.material.color.set("#9F8CFF");
  halo.position.copy(P);
  halo.scale.set(7, 7, 1);
  halo.material.opacity = 0.35;
  root.add(planet, ringMesh, halo);

  type Moon = { m: THREE.Mesh; path: THREE.Line; r: number; tilt: number; a: number; sp: number; state: "home" | "launch" | "orbit"; t: number };
  const moons: Moon[] = [];
  const mc = ["#FFD59E", "#9EE7FF", "#FFB3D1", "#C9FFB0", "#E0D0FF", "#FFE8A3"];
  for (let i = 0; i < c.count; i++) {
    const r = 3.1 + i * (4.2 / Math.max(1, c.count));
    const tilt = (c.rnd() - 0.5) * 0.5;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + c.rnd() * 0.1, 0), mat(mc[i % mc.length], { emissive: mc[i % mc.length], emissiveIntensity: 0.4 }));
    m.visible = false;
    const curve = new THREE.EllipseCurve(0, 0, r, r * 0.55, 0, Math.PI * 2);
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80).map((p) => new THREE.Vector3(p.x, 0, p.y)));
    const path = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: mc[i % mc.length], transparent: true, opacity: 0 }));
    path.position.copy(P);
    path.rotation.z = tilt;
    root.add(m, path);
    moons.push({ m, path, r, tilt, a: c.rnd() * 6.28, sp: 0.5 - i * 0.03, state: "home", t: 0 });
    c.addItem(P.clone());
  }
  let pulse = 0;

  const orbitPos = (mo: Moon, a: number, scale = 1) => {
    const v = new THREE.Vector3(Math.cos(a) * mo.r * scale, 0, Math.sin(a) * mo.r * 0.55 * scale);
    v.applyAxisAngle(new THREE.Vector3(0, 0, 1), mo.tilt);
    return v.add(P);
  };

  return {
    figure: null,
    camTarget: new THREE.Vector3(1.8, 1.4, -1),
    camOffset: new THREE.Vector3(0.5, 4.2, 14),
    update(dt, t, s) {
      planet.rotation.y += dt * 0.15;
      stars.rotation.y += dt * 0.004;
      planetMat.emissive.set("#10143A").lerp(new THREE.Color("#3B2F8F"), s.vit);
      nebulae.forEach((n, i) => (n.material.opacity = 0.12 + 0.35 * s.vit + 0.05 * Math.sin(t * 0.5 + i)));
      pulse = Math.max(0, pulse - dt * 1.5);
      const hs = 7 + pulse * 3;
      halo.scale.set(hs, hs, 1);
      halo.material.opacity = 0.3 + pulse * 0.4 + s.energy * 0.3;
      for (const mo of moons) {
        if (mo.state === "launch") {
          mo.t = Math.min(1, mo.t + dt / 1.3);
          mo.a += dt * (mo.sp + (1 - mo.t) * 3);
          mo.m.position.copy(orbitPos(mo, mo.a, 0.45 + 0.55 * mo.t));
          (mo.path.material as THREE.LineBasicMaterial).opacity = 0.4 * mo.t;
          if (mo.t >= 1) mo.state = "orbit";
        } else if (mo.state === "orbit") {
          mo.a += dt * mo.sp;
          mo.m.position.copy(orbitPos(mo, mo.a));
        }
        mo.m.rotation.y += dt;
      }
    },
    release(idx, done) {
      const mo = moons[idx];
      pulse = 1;
      if (!mo) { done(); return; }
      mo.state = "launch";
      mo.t = 0;
      mo.m.visible = true;
      c.spark(P.clone().add(new THREE.Vector3(0, 1.6, 0)), 12, "#E0D4FF");
      c.later(1.2, done);
    },
    pulse() { pulse = 1; },
    reset(restored) {
      moons.forEach((mo, i) => {
        const on = i < restored;
        mo.state = on ? "orbit" : "home";
        mo.m.visible = on;
        (mo.path.material as THREE.LineBasicMaterial).opacity = on ? 0.4 : 0;
      });
    },
  };
}

const BUILDERS: Record<WorldKind, (c: Ctx) => Built> = { well: buildWell, flock: buildFlock, cairn: buildCairn, orbit: buildOrbit };

/* ======================================================================
   Engine
   ====================================================================== */
export class SessionWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  private timer = new THREE.Timer();
  private root = new THREE.Group();
  private hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3140, 1.4);
  private sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
  private glowTex: THREE.Texture;
  private whiteGlowTex: THREE.Texture;
  private items: Item[] = [];
  private lastIndex = -1;
  private sparks: { s: THREE.Sprite; life: number; v: THREE.Vector3 }[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private built: Built;
  private raf = 0;
  private disposed = false;
  private paused = false;
  private reduceMotion: boolean;
  private seed = 11;
  private aspectF = 1;

  private energy = 0;
  private energyTarget = 0;
  private hold = 0;
  private ready = false;
  private vit = 0;

  private figure = new THREE.Group();
  private figLines: THREE.LineSegments;
  private figLinePos: Float32Array;
  private figJoints: THREE.Sprite[] = [];
  private figBones: THREE.Sprite[] = [];
  private figOpacity = 0;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private landmarks: PoseLandmark[] | null = null;
  private landmarksAt = 0;
  private accent: THREE.Color;

  constructor(private canvas: HTMLCanvasElement, kind: WorldKind, count: number, accentHex: string) {
    this.reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.accent = new THREE.Color(accentHex);
    this.sun.position.set(8, 16, 10);
    this.scene.add(this.hemi, this.sun, this.root);
    this.glowTex = this.makeGlow(false);
    this.whiteGlowTex = this.makeGlow(true);

    const ctx: Ctx = {
      root: this.root,
      scene: this.scene,
      count: Math.max(3, Math.min(12, Math.round(count))),
      reduceMotion: this.reduceMotion,
      mat: (hex, extra) => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 1, metalness: 0, ...extra }),
      glow: (white) => this.glowSprite(white),
      rnd: () => this.rnd(),
      addItem: (pos, apply) => {
        const it: Item = { apply: apply ?? (() => {}), pos, k: 0, from: 0, to: 0, start: -1 };
        it.apply(0);
        this.items.push(it);
        return it;
      },
      spark: (at, n, color) => this.spark(at, n, color),
      later: (delay, fn) => this.timers.push({ at: this.timer.getElapsed() + delay, fn }),
      now: () => this.timer.getElapsed(),
    };
    this.built = BUILDERS[kind](ctx);

    // sparks
    for (let i = 0; i < 70; i++) {
      const s = this.glowSprite(true);
      s.visible = false;
      this.root.add(s);
      this.sparks.push({ s, life: 0, v: new THREE.Vector3() });
    }

    // light figure + standing ring
    this.figLinePos = new Float32Array(POSE_EDGES.length * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(this.figLinePos, 3));
    const figCol = this.accent.clone().lerp(new THREE.Color("#ffffff"), 0.25);
    this.figLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: figCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.figLines.frustumCulled = false;
    this.figure.add(this.figLines);
    for (let i = 0; i < POSE_JOINTS.length + POSE_EDGES.length * 3; i++) {
      const s = this.glowSprite(true);
      s.material.color.copy(figCol);
      s.visible = false;
      (i < POSE_JOINTS.length ? this.figJoints : this.figBones).push(s);
      this.figure.add(s);
    }
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#CFE3FF", transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.18, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    const fp = this.built.figure;
    this.figure.visible = this.ring.visible = !!fp;
    if (fp) {
      this.figure.position.copy(fp);
      this.ring.position.set(fp.x, fp.y + 0.03, fp.z);
    }
    this.root.add(this.figure, this.ring);

    this.resize();
    this.loop();
  }

  /* ---------- public ---------- */

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.aspectF = w / h < 1.2 ? 1.45 : 1;
  }
  setEnergy(e: number) { this.energyTarget = clamp01(e); }
  setHold(p: number) { this.hold = clamp01(p); }
  setReady(r: boolean) { this.ready = r; }
  setLandmarks(lm: PoseLandmark[] | null) { this.landmarks = lm; this.landmarksAt = performance.now(); }

  /** A rep (or finished hold) happened; progress is the new completed fraction. */
  completeRep(progress: number, onDone?: () => void) {
    const n = Math.floor(clamp01(progress) * this.items.length + 1e-6);
    const idx = n - 1;
    if (idx > this.lastIndex && idx >= 0) {
      this.lastIndex = idx;
      this.built.release(idx, () => {
        this.animateItem(idx, 1);
        onDone?.();
      });
    } else {
      this.built.pulse?.();
      const fp = this.built.figure;
      if (fp) this.spark(fp.clone().add(new THREE.Vector3(0, 1.6, 0)), 8);
      onDone?.();
    }
    this.energy = 0;
  }

  /** Jump to a progress value (e.g. after "start over"). */
  setProgressInstant(progress: number) {
    const n = Math.floor(clamp01(progress) * this.items.length + 1e-6);
    this.items.forEach((it, j) => this.animateItem(j, j < n ? 1 : 0));
    this.lastIndex = n - 1;
    this.built.reset(n);
  }

  /** Stop rendering while the tab is hidden; resume where it left off. */
  setPaused(paused: boolean) {
    if (this.disposed || paused === this.paused) return;
    this.paused = paused;
    if (paused) cancelAnimationFrame(this.raf);
    else { this.timer.update(); this.raf = requestAnimationFrame(this.loop); }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.glowTex.dispose();
    this.whiteGlowTex.dispose();
    this.renderer.dispose();
  }

  /* ---------- internals ---------- */

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private makeGlow(white: boolean) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, white ? "rgba(255,255,255,1)" : "rgba(255,244,200,1)");
    r.addColorStop(0.35, white ? "rgba(255,255,255,.5)" : "rgba(255,212,110,.55)");
    r.addColorStop(1, white ? "rgba(255,255,255,0)" : "rgba(255,200,90,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private glowSprite(white = false) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: white ? this.whiteGlowTex : this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    return s;
  }

  private spark(at: THREE.Vector3, count: number, color = "#FFE6A0") {
    for (let n = 0; n < (this.reduceMotion ? 3 : count); n++) {
      const p = this.sparks.find((s) => s.life <= 0);
      if (!p) return;
      p.life = 1;
      p.s.visible = true;
      p.s.material.color.set(color);
      p.s.position.set(at.x + (Math.random() - 0.5) * 1.4, at.y + Math.random() * 0.5, at.z + (Math.random() - 0.5) * 1.4);
      p.v.set((Math.random() - 0.5) * 0.8, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8);
    }
  }

  private animateItem(j: number, to: number) {
    const it = this.items[j];
    if (!it || it.to === to) return;
    it.to = to;
    it.from = it.k;
    it.start = this.timer.getElapsed();
  }

  private updateFigure(dt: number) {
    const fresh = this.landmarks && performance.now() - this.landmarksAt < 700;
    const target = fresh ? (this.ready ? 1 : 0.55) : 0;
    this.figOpacity = smooth(this.figOpacity, target, 5, dt);
    (this.figLines.material as THREE.LineBasicMaterial).opacity = this.figOpacity * 0.95;
    const t = this.timer.getElapsed();
    this.ringMat.opacity = this.ready ? 0.75 : 0.3 + 0.25 * Math.sin(t * 3);
    if (this.ready) this.ringMat.color.copy(this.accent);
    else this.ringMat.color.set("#CFE3FF");
    const rs = this.ready ? 1 : 1 + 0.08 * Math.sin(t * 3);
    this.ring.scale.set(rs, rs, 1);

    if (!fresh || !this.landmarks || !this.built.figure) {
      this.figJoints.forEach((s) => (s.visible = false));
      this.figBones.forEach((s) => (s.visible = false));
      return;
    }
    const lm = this.landmarks;
    const vis = (i: number) => lm[i] && (lm[i].visibility ?? 1) > 0.5;
    let top = 1, bottom = 0;
    for (const i of POSE_JOINTS) if (vis(i)) { top = Math.min(top, lm[i].y); bottom = Math.max(bottom, lm[i].y); }
    const scale = 2.9 / Math.max(bottom - top, 0.6);
    let cx = 0, cn = 0;
    for (const i of [11, 12, 23, 24]) if (vis(i)) { cx += lm[i].x; cn++; }
    cx = cn ? cx / cn : 0.5;
    const P = (i: number, out: THREE.Vector3) => out.set(-(lm[i].x - cx) * scale, (bottom - lm[i].y) * scale + 0.05, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    POSE_EDGES.forEach(([i, j], k) => {
      const o = k * 6;
      const ok = vis(i) && vis(j);
      if (ok) { P(i, a); P(j, b); this.figLinePos.set([a.x, a.y, a.z, b.x, b.y, b.z], o); }
      else this.figLinePos.fill(0, o, o + 6);
      for (let m = 0; m < 3; m++) {
        const s = this.figBones[k * 3 + m];
        s.visible = ok;
        if (!ok) continue;
        s.position.copy(a).lerp(b, (m + 1) / 4);
        const sc = 0.3 * (0.6 + 0.4 * this.figOpacity);
        s.scale.set(sc, sc, 1);
        s.material.opacity = this.figOpacity * 0.6;
      }
    });
    this.figLines.geometry.attributes.position.needsUpdate = true;
    POSE_JOINTS.forEach((i, k) => {
      const s = this.figJoints[k];
      s.visible = !!vis(i);
      if (!s.visible) return;
      P(i, s.position);
      const sc = (i === 0 ? 1.0 : 0.5) * (0.6 + 0.4 * this.figOpacity);
      s.scale.set(sc, sc, 1);
      s.material.opacity = this.figOpacity;
    });
    const dx = this.camera.position.x - this.figure.position.x;
    const dz = this.camera.position.z - this.figure.position.z;
    this.figure.rotation.y = Math.atan2(dx, dz);
  }

  private loop = () => {
    if (this.disposed || this.paused) return;
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    const t = this.timer.getElapsed();

    this.energy = smooth(this.energy, this.energyTarget, this.energyTarget > this.energy ? 7 : 3, dt);
    const restored = this.items.reduce((s, it) => s + it.to, 0) / Math.max(1, this.items.length);
    this.vit = smooth(this.vit, restored, 1.2, dt);
    this.hemi.intensity = 1.2 + 1.5 * this.vit;
    this.sun.intensity = 0.9 + 2.2 * this.vit;

    for (const it of this.items) {
      if (it.start < 0) continue;
      const u = Math.min(1, (t - it.start) / 0.9);
      it.k = it.to === 1 ? it.from + (1 - it.from) * easeOutBack(u) : it.from * (1 - u);
      it.apply(it.k);
      if (u >= 1) { it.start = -1; it.k = it.to; it.apply(it.k); }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (t >= this.timers[i].at) { const fn = this.timers[i].fn; this.timers.splice(i, 1); fn(); }
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.8;
      p.s.position.addScaledVector(p.v, dt);
      const sc = 0.28 + (1 - p.life) * 0.3;
      p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = Math.max(0, p.life) * 0.95;
      if (p.life <= 0) p.s.visible = false;
    }

    this.built.update(dt, t, { energy: this.energy, hold: this.hold, vit: this.vit, ready: this.ready });
    this.updateFigure(dt);

    // camera: framed per world, with a slow breathing drift
    const off = this.built.camOffset.clone().multiplyScalar(this.aspectF);
    if (!this.reduceMotion) off.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.12) * 0.05);
    this.camera.position.copy(this.built.camTarget).add(off);
    this.camera.lookAt(this.built.camTarget);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };
}
