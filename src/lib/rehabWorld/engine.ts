import * as THREE from "three";

/*
  Teammate floating-island renderer, adapted as a presentation-only layer.
  IslandPresentation supplies authoritative restoration and decorative phase energy.
  This class does not detect movement, count reps, persist activity or finish sessions.
*/

export type PoseLandmark = { x: number; y: number; z?: number; visibility?: number };

type Item = {
  apply: (k: number) => void;
  pos: THREE.Vector3;
  k: number;
  from: number;
  to: number;
  start: number;
};

type Zone = {
  key: string;
  center: THREE.Vector3;
  items: Item[];
  figure: THREE.Vector3;
  core: THREE.Vector3;
};

type Comet = {
  sprite: THREE.Sprite;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  onArrive: () => void;
};

type Spark = { s: THREE.Sprite; life: number; v: THREE.Vector3 };

export const ZONE_KEYS = ["bridge", "lanterns", "grove", "meadow", "mill"] as const;

/** Each exercise gets its own way of changing the world. */
export type Experience = "bridge" | "lanterns" | "windmill";

const ZONE = { bridge: 0, lanterns: 1, grove: 2, meadow: 3, mill: 4 } as const;

type SkyLantern = {
  g: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  base: THREE.Vector3;
  released: boolean;
  y: number;
  alt: number;
  drift: THREE.Vector3;
  phase: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (u: number) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);

const POSE_EDGES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];
const POSE_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export class RehabWorldEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private timer = new THREE.Timer();
  private world = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private grassMat: THREE.MeshStandardMaterial;
  private cloudMat: THREE.MeshStandardMaterial;
  private glowTex: THREE.Texture;
  private whiteGlowTex: THREE.Texture;
  private zones: Zone[] = [];
  private spinners: { obj: THREE.Object3D; item: Item; axis: "y" | "z"; speed: number }[] = [];
  private sparks: Spark[] = [];
  private comets: Comet[] = [];
  private clouds: { g: THREE.Group; a: number; r: number; y: number }[] = [];
  private raf = 0;
  private disposed = false;
  private paused = false;
  private storyAbility: "lumen-rise" | "aether-wing" | "terra-pulse" | null = null;
  private storyScene = "";
  private storyCelebrated = false;
  private storyRestoration = 0;
  private storyFinale = false;
  private storyShards: THREE.Mesh[] = [];
  private storyCrystals: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; glow: THREE.Sprite }[] = [];
  private storyGate: THREE.Mesh | null = null;
  private waves: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number }[] = [];
  private reduceMotion: boolean;
  private seed = 7;

  // camera
  private camT = new THREE.Vector3(3, -1, 0);
  private camGT = new THREE.Vector3(3, -1, 0);
  private camA = 0.5;
  private camGA = 0.45;
  private camR = 30;
  private camGR = 30;
  private camH = 12;
  private camGH = 12;
  private orbit = true;
  private aspectF = 1;

  // Presentation state only; never used to count or save movements.
  private activeZone = 0;
  private experience: Experience = "bridge";
  private accent = new THREE.Color("#F2C14E");
  private skyLanterns: SkyLantern[] = [];
  private wind: { s: THREE.Sprite; x: number; y: number; z: number; speed: number }[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private millBlades: THREE.Object3D | null = null;
  private energy = 0;
  private energyTarget = 0;
  private ready = false;
  private vit = 0;
  private vitTarget = 0;

  // energy core
  private core = new THREE.Group();
  private coreMat: THREE.MeshStandardMaterial;
  private coreMesh: THREE.Mesh;
  private coreGlow: THREE.Sprite;
  private orbiters: THREE.Sprite[] = [];

  // light figure + ring
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

  constructor(private canvas: HTMLCanvasElement) {
    this.reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3140, 1.5);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
    this.sun.position.set(10, 18, 8);
    this.scene.add(this.hemi, this.sun, this.world);

    this.glowTex = this.makeGlow();
    this.whiteGlowTex = this.makeGlow(true);
    this.grassMat = this.mat("#6d7563");
    this.cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1, transparent: true, opacity: 0.3 });

    this.island(0, 0, 8);
    this.island(14.6, 0, 3.2);
    this.buildZones();
    this.buildScenery();

    // energy core
    this.coreMat = new THREE.MeshStandardMaterial({ color: "#8f8aa8", flatShading: true, roughness: 0.3, emissive: "#000000" });
    this.coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), this.coreMat);
    this.coreGlow = this.glowSprite();
    this.core.add(this.coreMesh, this.coreGlow);
    for (let i = 0; i < 6; i++) {
      const s = this.glowSprite();
      s.scale.set(0.35, 0.35, 1);
      this.orbiters.push(s);
      this.core.add(s);
    }
    this.world.add(this.core);

    // light figure
    this.figLinePos = new Float32Array(POSE_EDGES.length * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(this.figLinePos, 3));
    this.figLines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ color: "#FFE6A0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.figLines.frustumCulled = false;
    this.figure.add(this.figLines);
    for (let i = 0; i < POSE_JOINTS.length; i++) {
      const s = this.glowSprite(true);
      s.visible = false;
      this.figJoints.push(s);
      this.figure.add(s);
    }
    for (let i = 0; i < POSE_EDGES.length * 3; i++) {
      const s = this.glowSprite(true);
      s.visible = false;
      this.figBones.push(s);
      this.figure.add(s);
    }
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#FFE6A0", transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.18, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.world.add(this.figure, this.ring);

    this.setActiveZone(0);
    this.resize();
    this.loop();
  }

  /* ---------------- public API ---------------- */

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.aspectF = w / h < 1 ? 1.7 : 1;
  }

  setActiveZone(i: number) {
    this.activeZone = ((i % this.zones.length) + this.zones.length) % this.zones.length;
    const z = this.zones[this.activeZone];
    this.core.position.copy(z.core);
    this.figure.position.copy(z.figure);
    this.ring.position.set(z.figure.x, 0.03, z.figure.z);
  }

  /** Session view: camera frames the figure, the core and the zone being restored. */
  focusSession() {
    if (this.experience === "windmill") {
      // frame the windmill and the meadow together
      this.camGT.set(-0.6, 0, -1.4);
      this.camGR = 19;
      this.camGH = 8;
      this.orbit = false;
      this.camGA = 0.25;
      this.normalizeAngle();
      return;
    }
    const z = this.zones[this.activeZone];
    this.camGT.copy(z.figure).lerp(z.center, 0.5);
    this.camGR = 14;
    this.camGH = 6.5;
    this.orbit = false;
    this.camGA = 0.35;
    this.normalizeAngle();
  }

  /** Fly the camera to one zone (used when hovering quest stops). */
  focusZone(i: number) {
    const z = this.zones[((i % this.zones.length) + this.zones.length) % this.zones.length];
    this.camGT.copy(z.center);
    this.camGR = 15;
    this.camGH = 7.5;
    this.orbit = false;
    this.camGA = 0.45;
    this.normalizeAngle();
  }

  /** Hide the energy core, light figure and ring when the world is just a backdrop. */
  showSessionElements(v: boolean) {
    this.core.visible = v;
    this.figure.visible = v;
    this.ring.visible = v;
  }

  overview() {
    this.camGT.set(3, -1, 0);
    this.camGR = 30;
    this.camGH = 12;
    this.orbit = true;
  }

  setEnergy(e: number) {
    this.energyTarget = clamp01(e);
  }

  setReady(r: boolean) {
    this.ready = r;
  }

  setLandmarks(lm: PoseLandmark[] | null) {
    this.landmarks = lm;
    this.landmarksAt = performance.now();
  }

  /** 0..1 restoration of a zone, animated. */
  setZoneProgress(i: number, p: number) {
    if (this.storyAbility && i === this.activeZone) this.storyRestoration = clamp01(p);
    const z = this.zones[((i % this.zones.length) + this.zones.length) % this.zones.length];
    const n = Math.floor(clamp01(p) * z.items.length + 1e-6);
    const t = this.timer.getElapsed();
    z.items.forEach((it, j) => {
      const want = j < n ? 1 : 0;
      if (it.to !== want) {
        it.to = want;
        it.from = it.k;
        it.start = t;
      }
    });
    this.updateVitality();
  }

  /** Energy leaves the core, flies to the next unrestored piece, and restores it on arrival. */
  releaseEnergy(targetProgress: number, onArrive?: () => void) {
    const now = this.timer.getElapsed();
    if (this.storyAbility) this.motionWave();
    if (this.experience === "lanterns") {
      const l = this.skyLanterns.find((x) => !x.released);
      if (l) {
        l.released = true;
        l.alt = 3.6 + this.rnd() * 4.5;
        l.drift.set(0.12 + this.rnd() * 0.3, 0, -0.05 - this.rnd() * 0.2);
        this.spark(l.g.position.clone(), 10);
      }
      this.setZoneProgress(ZONE.lanterns, targetProgress);
      this.timers.push({ at: now + 0.7, fn: () => onArrive?.() });
      this.energy = 0;
      return;
    }
    if (this.experience === "windmill") {
      this.setZoneProgress(ZONE.meadow, targetProgress);
      this.spark(this.zones[ZONE.meadow].center, 16);
      this.spark(this.zones[ZONE.mill].center.clone().add(new THREE.Vector3(0, 2, 0)), 10);
      this.timers.push({ at: now + 0.5, fn: () => onArrive?.() });
      return;
    }
    const z = this.zones[this.activeZone];
    const n = Math.floor(clamp01(targetProgress) * z.items.length + 1e-6);
    const target = z.items[Math.max(0, Math.min(z.items.length - 1, n - 1))];
    const sprite = this.glowSprite();
    sprite.material.opacity = 1;
    sprite.scale.set(1.3, 1.3, 1);
    this.world.add(sprite);
    const from = this.storyAbility ? this.zones[this.activeZone].figure.clone() : this.core.position.clone();
    if (this.storyAbility) from.y += this.storyAbility === "terra-pulse" ? .1 : 1.7;
    // Use the already-rendered wrist position solely as the visual effect origin.
    // It never changes whether the shared movement engine recognized an action.
    if (this.storyAbility && this.storyAbility !== "terra-pulse" && this.landmarks && performance.now() - this.landmarksAt < 700) {
      const wrist = [15, 16].map(index => this.figJoints[POSE_JOINTS.indexOf(index)]).find(joint => joint?.visible);
      if (wrist) from.copy(this.world.worldToLocal(wrist.getWorldPosition(new THREE.Vector3())));
    }
    this.comets.push({
      sprite,
      from,
      to: target.pos.clone().add(new THREE.Vector3(0, 0.6, 0)),
      t: 0,
      onArrive: () => {
        // The adapter already applied authoritative progress; arrival only adds particles.
        this.spark(target.pos, 12);
        onArrive?.();
      },
    });
    this.energy = 0;
  }

  /** Switch which exercise experience the world is playing. */
  setExperience(exp: Experience, accentHex: string) {
    this.experience = exp;
    this.accent.set(accentHex);
    this.setActiveZone(exp === "bridge" ? ZONE.bridge : exp === "lanterns" ? ZONE.lanterns : ZONE.mill);
    this.core.visible = exp === "bridge";

    if (exp === "lanterns" && !this.skyLanterns.length) this.buildSkyLanterns();
    this.skyLanterns.forEach((l) => (l.g.visible = exp === "lanterns"));

    if (exp === "windmill") {
      if (!this.wind.length) this.buildWind();
      this.setZoneProgress(ZONE.mill, 1);
    }
    this.wind.forEach((w) => (w.s.visible = exp === "windmill"));

    // the light figure takes the exercise's colour
    const figCol = this.accent.clone().lerp(new THREE.Color("#ffffff"), 0.25);
    (this.figLines.material as THREE.LineBasicMaterial).color.copy(figCol);
    [...this.figJoints, ...this.figBones].forEach((sp) => sp.material.color.copy(figCol));
    this.focusSession();
  }

  /** Jump the current experience's progress (e.g. after a reset). */
  setProgressInstant(p: number) {
    if (this.experience === "bridge") this.setZoneProgress(ZONE.bridge, p);
    else if (this.experience === "lanterns") {
      this.setZoneProgress(ZONE.lanterns, p);
      const n = Math.round(p * this.skyLanterns.length);
      this.skyLanterns.forEach((l, i) => {
        if (i >= n && l.released) { l.released = false; l.y = 0.3; l.base.copy(this.lanternHome(i)); }
      });
    } else this.setZoneProgress(ZONE.meadow, p);
  }

  /** Continuous restoration while holding (windmill: the meadow blooms as you hold). */
  setHoldProgress(p: number) {
    if (this.experience === "windmill") this.setZoneProgress(ZONE.meadow, p);
  }

  zoneCount() {
    return this.zones.length;
  }

  private lanternHome(i: number) {
    // two loose rows beside the figure, on the side facing the camera
    const f = this.zones[ZONE.lanterns].figure;
    const col = Math.floor(i / 2), row = i % 2;
    return new THREE.Vector3(f.x - 1.4 - col * 0.72, 0, f.z - 0.9 + row * 0.95 + col * 0.12);
  }

  private buildSkyLanterns() {
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: "#F7D7A8", flatShading: true, roughness: 0.6, emissive: "#000000" });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.56, 6), mat);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 6), this.mat("#8A5A3C"));
      rim.position.y = 0.3;
      const glow = this.glowSprite();
      g.add(body, rim, glow);
      this.world.add(g);
      const base = this.lanternHome(i);
      this.skyLanterns.push({ g, mat, glow, base, released: false, y: 0.3, alt: 0, drift: new THREE.Vector3(), phase: this.rnd() * 6 });
    }
  }

  private buildWind() {
    for (let i = 0; i < 28; i++) {
      const s = this.glowSprite(true);
      s.material.color.set("#DDF3FF");
      this.world.add(s);
      this.wind.push({ s, x: -10 + this.rnd() * 22, y: 0.8 + this.rnd() * 4.5, z: -7 + this.rnd() * 10, speed: 0.6 + this.rnd() * 0.8 });
    }
  }

  private updateSkyLanterns(dt: number, t: number) {
    if (this.experience !== "lanterns") return;
    const next = this.skyLanterns.find((l) => !l.released);
    for (const l of this.skyLanterns) {
      let glow: number;
      if (!l.released) {
        const active = l === next;
        const targetY = active ? 0.3 + this.energy * 1.7 : 0.3;
        l.y += (targetY - l.y) * (1 - Math.exp(-dt * 5));
        glow = active ? 0.25 + 0.75 * this.energy : 0.12;
        l.g.position.set(l.base.x, l.y, l.base.z);
      } else {
        l.y += (l.alt - l.y) * (1 - Math.exp(-dt * 0.45));
        l.base.addScaledVector(l.drift, dt);
        glow = 1;
        const sway = this.reduceMotion ? 0 : 1;
        l.g.position.set(l.base.x + Math.sin(t * 0.7 + l.phase) * 0.25 * sway, l.y + Math.sin(t * 1.1 + l.phase) * 0.15 * sway, l.base.z);
      }
      l.mat.emissive.setRGB(1 * glow, 0.5 * glow, 0.22 * glow);
      const gs = 0.5 + 1.6 * glow;
      l.glow.scale.set(gs, gs, 1);
      l.glow.material.opacity = 0.2 + 0.75 * glow;
    }
  }

  private updateWind(dt: number) {
    if (this.experience !== "windmill") return;
    const e = this.energy;
    for (const w of this.wind) {
      w.x += dt * w.speed * (0.4 + e * 9);
      if (w.x > 12) w.x = -10;
      w.s.position.set(w.x, w.y, w.z);
      w.s.scale.set(0.9 + e * 1.8, 0.05, 1);
      w.s.material.opacity = e * 0.55;
    }
  }

  /** Story uses the same island, camera and particle pool. No recognition lives here. */
  setStoryAbility(ability: "lumen-rise" | "aether-wing" | "terra-pulse", zone: number, finale: boolean) {
    const key = `${ability}:${zone}:${finale}`;
    if (this.storyScene === key) return;
    this.storyScene = key;
    this.storyAbility = ability;
    this.storyFinale = finale;
    if (finale && !this.storyShards.length) {
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), new THREE.MeshStandardMaterial({ color: ["#F2C14E", "#B69CFF", "#91D5A0"][i], emissive: ["#554211", "#302151", "#173b26"][i], roughness: .25, flatShading: true }));
        this.storyShards.push(shard);
        this.core.add(shard);
      }
    }
    this.accent.set(ability === "lumen-rise" ? "#F2C14E" : ability === "aether-wing" ? "#B69CFF" : "#91D5A0");
    this.setActiveZone(zone);
    if (!finale && !this.storyCrystals.length) this.buildStoryStructures(zone);
    this.showSessionElements(true);
    this.core.scale.setScalar(finale ? 2.5 : 1);
    this.focusZone(zone);
    this.camGT.copy(this.zones[this.activeZone].figure).lerp(this.zones[this.activeZone].center, .5);
    if (finale) { this.camGR = 18; this.camGH = 8; }
    (this.figLines.material as THREE.LineBasicMaterial).color.copy(this.accent);
    [...this.figJoints, ...this.figBones].forEach(sprite => sprite.material.color.copy(this.accent));
  }

  private buildStoryStructures(zone: number) {
    const center = this.zones[this.activeZone].center;
    const count = zone === 2 ? 5 : zone === 0 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const theta = count === 2 ? i * Math.PI : i * Math.PI * 2 / count;
      const x = center.x + Math.cos(theta) * (count === 2 ? 1.5 : 2);
      const z = center.z + Math.sin(theta) * 1.3;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.3, .45, .75, 6), this.mat("#625d76"));
      pedestal.position.set(x, .375, z);
      const material = new THREE.MeshStandardMaterial({ color: "#55506d", emissive: "#000000", flatShading: true, roughness: .3 });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.38, 0), material);
      mesh.scale.y = 1.5;
      mesh.position.set(x, 1.2, z);
      const glow = this.glowSprite();
      glow.position.copy(mesh.position);
      this.world.add(pedestal, mesh, glow);
      this.storyCrystals.push({ mesh, material, glow });
    }
    if (zone === 0) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.7, .35, .5), this.mat("#8b7caa"));
      lintel.position.set(center.x, 3.2, center.z);
      this.world.add(lintel);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(.35, 3.2, .5), this.mat("#70667e"));
        pillar.position.set(center.x + side * 1.7, 1.6, center.z);
        this.world.add(pillar);
      }
      this.storyGate = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.8), new THREE.MeshBasicMaterial({ color: "#b69cff", transparent: true, opacity: .55, side: THREE.DoubleSide }));
      this.storyGate.position.set(center.x, 1.6, center.z);
      this.world.add(this.storyGate);
    }
  }

  private updateStoryStructures(t: number) {
    const progress = this.storyRestoration;
    const lit = this.activeZone === 0 ? Math.floor(Math.min(1, progress * 2) * 2) : Math.floor(progress * this.storyCrystals.length + 1e-6);
    this.storyCrystals.forEach(({ mesh, material, glow }, index) => {
      const on = index < lit;
      material.color.set(on ? "#ffe5a0" : "#55506d");
      material.emissive.set(on ? "#806322" : "#000000");
      glow.material.opacity = on ? .8 : .08;
      glow.scale.setScalar(on ? 2.2 : .6);
      mesh.rotation.y = t * .25;
    });
    if (this.storyGate) {
      this.storyGate.scale.x = Math.max(.001, 1 - Math.max(0, progress - .5) * 2);
      this.storyGate.visible = progress < .999;
    }
  }

  private motionWave() {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.8, .9, 48), new THREE.MeshBasicMaterial({ color: this.accent, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.copy(this.zones[this.activeZone].figure);
    if (this.storyAbility === "terra-pulse") {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = .15;
    } else mesh.position.y += 1.5;
    this.world.add(mesh);
    this.waves.push({ mesh, age: 0 });
  }

  celebrateStory(finale = true) {
    if (this.storyCelebrated) return;
    this.storyCelebrated = true;
    this.releaseEnergy(1);
    this.zones.forEach((zone, index) => {
      if (finale || index === this.activeZone) {
        this.setZoneProgress(index, 1);
        this.spark(zone.center, 12);
      }
    });
    if (finale) { this.core.scale.setScalar(3); this.overview(); }
  }

  /** Cancel in-flight visual work before replay; callbacks must not restore old progress. */
  cancelEffects() {
    for (const comet of this.comets) {
      this.world.remove(comet.sprite);
      comet.sprite.material.dispose();
    }
    this.comets = [];
    for (const wave of this.waves) {
      this.world.remove(wave.mesh);
      wave.mesh.geometry.dispose();
      wave.mesh.material.dispose();
    }
    this.waves = [];
    this.timers = [];
    for (const spark of this.sparks) { spark.life = 0; spark.s.visible = false; }
  }

  setPaused(paused: boolean) {
    if (this.paused === paused || this.disposed) return;
    this.paused = paused;
    if (paused) cancelAnimationFrame(this.raf);
    else this.loop();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelEffects();
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
    this.timer.dispose();
    this.renderer.dispose();
  }

  /* ---------------- building ---------------- */

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private mat(hex: string) {
    return new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 1, metalness: 0 });
  }

  private makeGlow(white = false) {
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
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: white ? this.whiteGlowTex : this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    );
    s.scale.set(0.001, 0.001, 1);
    return s;
  }

  private addItem(zone: Zone, pos: THREE.Vector3, apply: (k: number) => void) {
    const it: Item = { apply, pos, k: 0, from: 0, to: 0, start: -1 };
    apply(0);
    zone.items.push(it);
    return it;
  }

  private newZone(key: string, x: number, z: number, figure: [number, number]) {
    const center = new THREE.Vector3(x, 0, z);
    const fig = new THREE.Vector3(figure[0], 0, figure[1]);
    const core = fig.clone().lerp(center, 0.45);
    core.y = 2.1;
    const zone: Zone = { key, center, items: [], figure: fig, core };
    this.zones.push(zone);
    return zone;
  }

  private island(x: number, z: number, r: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.97, 0.4, 11), this.grassMat);
    grass.position.y = -0.2;
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.9, 1, 11), this.mat("#6b4f3a"));
    dirt.position.y = -0.9;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 0.95, 9), this.mat("#5a5563"));
    rock.rotation.x = Math.PI;
    rock.position.y = -1.4 - r * 0.475;
    g.add(grass, dirt, rock);
    this.world.add(g);
  }

  private buildZones() {
    const grey = () => new THREE.Color("#8a8f88");

    // Bridge (east) + islet crystal
    const bridge = this.newZone("bridge", 10.6, 0, [5.4, 2.6]);
    for (const [x, z] of [[8.1, 0.9], [8.1, -0.9], [11.4, 0.9], [11.4, -0.9]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), this.mat("#5b4636"));
      p.position.set(x, 0.3, z);
      this.world.add(p);
    }
    for (let i = 0; i < 9; i++) {
      const x = 8.3 + i * 0.36;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 1.7), this.mat("#9a7048"));
      m.position.set(x, -0.08, 0);
      this.world.add(m);
      this.addItem(bridge, new THREE.Vector3(x, 0, 0), (k) => {
        m.visible = k > 0.02;
        m.scale.set(1, 1, Math.max(0.001, k));
        m.position.y = -0.08 + (1 - clamp01(k)) * 1.4;
      });
    }
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), this.mat("#8d8898"));
    ped.position.set(14.6, 0.4, 0);
    this.world.add(ped);
    const cm = new THREE.MeshStandardMaterial({ color: "#6d6a80", flatShading: true, roughness: 0.35, emissive: "#000000" });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), cm);
    crystal.position.set(14.6, 1.5, 0);
    const cg = this.glowSprite();
    cg.position.copy(crystal.position);
    this.world.add(crystal, cg);
    const cOn = new THREE.Color("#FFE59A"), cOff = new THREE.Color("#6d6a80");
    const ci = this.addItem(bridge, new THREE.Vector3(14.6, 1, 0), (k) => {
      const c = clamp01(k);
      cm.emissive.setRGB(0.95 * c, 0.8 * c, 0.35 * c);
      cm.color.copy(cOff).lerp(cOn, c);
      const s = Math.max(0.001, 3.4 * k);
      cg.scale.set(s, s, 1);
      cg.material.opacity = 0.85 * c;
      crystal.position.y = 1.5 + 0.25 * c;
      cg.position.y = crystal.position.y;
    });
    this.spinners.push({ obj: crystal, item: ci, axis: "y", speed: 0.8 });

    // Lanterns (north-west)
    const lz = this.newZone("lanterns", -3.8, -3.2, [-1.2, 0.8]);
    for (const [x, z] of [[-1.2, -1.8], [-2.4, -3.0], [-3.8, -3.8], [-5.2, -3.9], [-6.2, -2.6]]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), this.mat("#3d3a45"));
      post.position.y = 0.7;
      const hm = new THREE.MeshStandardMaterial({ color: "#5b5566", flatShading: true, roughness: 0.8, emissive: "#000000" });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), hm);
      head.position.y = 1.58;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 4), this.mat("#3d3a45"));
      cap.position.y = 1.9;
      cap.rotation.y = Math.PI / 4;
      const glow = this.glowSprite();
      glow.position.y = 1.58;
      g.add(post, head, cap, glow);
      this.world.add(g);
      const lit = new THREE.Color("#FFE08A"), dark = new THREE.Color("#5b5566");
      this.addItem(lz, new THREE.Vector3(x, 1.2, z), (k) => {
        const c = clamp01(k);
        hm.emissive.setRGB(0.95 * c, 0.72 * c, 0.28 * c);
        hm.color.copy(dark).lerp(lit, c);
        const s = Math.max(0.001, 2.4 * k);
        glow.scale.set(s, s, 1);
        glow.material.opacity = 0.9 * c;
      });
    }

    // Grove (south)
    const gz = this.newZone("grove", 0, 4.6, [3.2, 2.2]);
    for (const [x, z, s] of [[-1.6, 3.9, 1], [0.2, 5.8, 1.2], [1.8, 4.2, 0.9], [-0.4, 3.4, 0.8], [-2.4, 5.4, 1.1], [1.2, 6.6, 0.85], [2.9, 5.6, 1.05]]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = this.rnd() * 6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.1 * s, 6), this.mat("#6b4a32"));
      trunk.position.y = 0.55 * s;
      const fm = this.mat("#8a8f88");
      const leaves = new THREE.Group();
      leaves.position.y = 1.05 * s;
      const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.6 * s, 7), fm);
      f1.position.y = 0.45 * s;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.2 * s, 7), fm);
      f2.position.y = 1.15 * s;
      leaves.add(f1, f2);
      g.add(trunk, leaves);
      this.world.add(g);
      const green = new THREE.Color(["#4f8a52", "#5e9a5a", "#3f7a4a", "#6aa25e"][Math.floor(this.rnd() * 4)]);
      const gr = grey();
      this.addItem(gz, new THREE.Vector3(x, 1, z), (k) => {
        const c = clamp01(k);
        leaves.scale.setScalar(Math.max(0.05, 0.28 + 0.72 * k));
        fm.color.copy(gr).lerp(green, c);
        g.rotation.z = (1 - c) * 0.22;
      });
    }

    // Meadow (west)
    const mz = this.newZone("meadow", -5.2, 1, [-2.2, 2.8]);
    const fc = ["#F2C14E", "#E08DB4", "#F4F1F8", "#B58BD6", "#F28C6B"];
    for (let i = 0; i < 13; i++) {
      const a = this.rnd() * Math.PI * 2, d = 0.3 + this.rnd() * 1.7;
      const x = -5.2 + Math.cos(a) * d, z = 1 + Math.sin(a) * d;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), this.mat("#56784c"));
      const hm = this.mat("#6d6a70");
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), hm);
      g.add(stem, head);
      this.world.add(g);
      const col = new THREE.Color(fc[i % fc.length]), dim = new THREE.Color("#6d6a70");
      this.addItem(mz, new THREE.Vector3(x, 0.3, z), (k) => {
        const c = clamp01(k);
        head.scale.setScalar(Math.max(0.05, 0.35 + 0.8 * k));
        hm.color.copy(dim).lerp(col, c);
        stem.scale.y = 0.45 + 0.55 * c;
        stem.position.y = 0.25 * stem.scale.y;
        head.position.y = 0.5 * stem.scale.y + 0.05;
      });
    }

    // Windmill (north-east)
    const wz = this.newZone("mill", 3.6, -4.3, [1.2, -0.6]);
    const g = new THREE.Group();
    g.position.set(3.6, 0, -4.3);
    this.world.add(g);
    const tm = this.mat("#8a8f88");
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 2.6, 8), tm);
    const rm = this.mat("#77767d");
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1, 8), rm);
    const blades = new THREE.Group();
    blades.position.z = 0.85;
    const bm = this.mat("#8a8f88");
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI) / 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.5, 0.05), bm);
      b.position.y = 0.85;
      arm.add(b);
      blades.add(arm);
    }
    g.add(tower, roof, blades);
    const cream = new THREE.Color("#EDE6D6"), heather = new THREE.Color("#9C5A8E"), bladeCol = new THREE.Color("#F3EEE2");
    const gr = grey();
    this.addItem(wz, new THREE.Vector3(3.6, 1, -4.3), (k) => {
      const c = clamp01(k), sy = 0.55 + 0.45 * c;
      tm.color.copy(gr).lerp(cream, c);
      tower.scale.y = sy;
      tower.position.y = 1.3 * sy;
      roof.position.y = 2.6 * sy + 0.5;
      blades.position.y = 2.6 * sy - 0.15;
    });
    this.addItem(wz, new THREE.Vector3(3.6, 3, -4.3), (k) => {
      const c = clamp01(k);
      roof.scale.setScalar(Math.max(0.05, 0.45 + 0.55 * k));
      rm.color.copy(gr).lerp(heather, c);
      roof.rotation.z = (1 - c) * 0.45;
    });
    const bi = this.addItem(wz, new THREE.Vector3(3.6, 2.4, -3.4), (k) => {
      blades.visible = k > 0.02;
      blades.scale.setScalar(Math.max(0.001, k));
      bm.color.copy(gr).lerp(bladeCol, clamp01(k));
    });
    this.spinners.push({ obj: blades, item: bi, axis: "z", speed: 1.3 });
    this.millBlades = blades;
  }

  private buildScenery() {
    const sm = this.mat("#b9b3a6");
    for (const [x, z] of [[8, 0], [-3.8, -3.2], [0, 4.2], [-4.6, 1], [3.4, -3.6]]) {
      const d = Math.hypot(x, z), n = Math.floor(d / 1.1);
      for (let i = 1; i < n; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.08, 7), sm);
        s.position.set((x * i) / n + (this.rnd() - 0.5) * 0.2, 0.02, (z * i) / n + (this.rnd() - 0.5) * 0.2);
        this.world.add(s);
      }
    }
    const rk = this.mat("#8d8898");
    for (let i = 0; i < 9; i++) {
      const a = this.rnd() * 6.28, d = 5.5 + this.rnd() * 1.8;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.zones.some((zn) => Math.hypot(zn.figure.x - x, zn.figure.z - z) < 2.2)) continue;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + this.rnd() * 0.35, 0), rk);
      r.position.set(x, 0.1, z);
      r.rotation.set(this.rnd() * 3, this.rnd() * 3, 0);
      this.world.add(r);
    }
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), this.cloudMat);
        p.position.set(j * 1.2 - 1.2, j === 1 ? 0.35 : 0, 0);
        p.scale.set(j === 1 ? 2.6 : 2, 1.2, 1.5);
        g.add(p);
      }
      this.scene.add(g);
      // far enough out that no cloud ever drifts between the camera and the island
      this.clouds.push({ g, a: (i / 6) * Math.PI * 2, r: 42 + this.rnd() * 8, y: 2 + this.rnd() * 8 });
    }
    for (let i = 0; i < 60; i++) {
      const s = this.glowSprite();
      s.visible = false;
      this.world.add(s);
      this.sparks.push({ s, life: 0, v: new THREE.Vector3() });
    }
  }

  private spark(at: THREE.Vector3, count: number) {
    for (let n = 0; n < (this.reduceMotion ? 3 : count); n++) {
      const p = this.sparks.find((s) => s.life <= 0);
      if (!p) return;
      p.life = 1;
      p.s.visible = true;
      p.s.position.set(at.x + (Math.random() - 0.5) * 1.6, at.y + 0.3 + Math.random() * 0.6, at.z + (Math.random() - 0.5) * 1.6);
      p.v.set((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8);
    }
  }

  private updateVitality() {
    let sum = 0, n = 0;
    for (const z of this.zones) for (const it of z.items) { sum += it.to; n++; }
    this.vitTarget = n ? sum / n : 0;
  }

  private normalizeAngle() {
    const TAU = Math.PI * 2;
    this.camA = this.camGA + ((((this.camA - this.camGA + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  }

  /* ---------------- frame loop ---------------- */

  private updateFigure(dt: number) {
    const fresh = this.landmarks && performance.now() - this.landmarksAt < 700;
    const target = fresh ? (this.ready ? 1 : 0.55) : 0;
    this.figOpacity += (target - this.figOpacity) * (1 - Math.exp(-dt * 5));
    (this.figLines.material as THREE.LineBasicMaterial).opacity = this.figOpacity * 0.95;

    // ring: pulses while waiting, steady gold once the body is ready
    const t = this.timer.getElapsed();
    this.ringMat.opacity = this.ready ? 0.75 : 0.3 + 0.25 * Math.sin(t * 3);
    if (this.ready) this.ringMat.color.copy(this.accent);
    else this.ringMat.color.set("#CFE3FF");
    const rs = this.ready ? 1 : 1 + 0.08 * Math.sin(t * 3);
    this.ring.scale.set(rs, rs, 1);

    if (!fresh || !this.landmarks) {
      this.figJoints.forEach((s) => (s.visible = false));
      this.figBones.forEach((s) => (s.visible = false));
      return;
    }
    const lm = this.landmarks;
    const vis = (i: number) => lm[i] && (lm[i].visibility ?? 1) > 0.5;

    // scale so the body is ~2.3 world units tall, feet on the ground
    let top = 1, bottom = 0;
    for (const i of POSE_JOINTS) if (vis(i)) { top = Math.min(top, lm[i].y); bottom = Math.max(bottom, lm[i].y); }
    const span = Math.max(0.25, bottom - top);
    const scale = 3.1 / Math.max(span, 0.6);
    let cx = 0, cn = 0;
    for (const i of [11, 12, 23, 24]) if (vis(i)) { cx += lm[i].x; cn++; }
    cx = cn ? cx / cn : 0.5;
    const P = (i: number, out: THREE.Vector3) => out.set(-(lm[i].x - cx) * scale, (bottom - lm[i].y) * scale + 0.05, 0);

    const a = new THREE.Vector3(), b = new THREE.Vector3();
    POSE_EDGES.forEach(([i, j], k) => {
      const o = k * 6;
      const ok = vis(i) && vis(j);
      if (ok) {
        P(i, a); P(j, b);
        this.figLinePos.set([a.x, a.y, a.z, b.x, b.y, b.z], o);
      } else this.figLinePos.fill(0, o, o + 6);
      for (let m = 0; m < 3; m++) {
        const s = this.figBones[k * 3 + m];
        s.visible = ok;
        if (!ok) continue;
        s.position.copy(a).lerp(b, (m + 1) / 4);
        const sc = 0.32 * (0.6 + 0.4 * this.figOpacity);
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

    // billboard the figure toward the camera (yaw only)
    const dx = this.camera.position.x - this.figure.position.x;
    const dz = this.camera.position.z - this.figure.position.z;
    this.figure.rotation.y = Math.atan2(dx, dz);
  }

  private updateCore(dt: number, t: number) {
    const rise = this.energyTarget > this.energy ? 6 : 2.5;
    this.energy += (this.energyTarget - this.energy) * (1 - Math.exp(-dt * rise));
    const e = this.storyFinale ? Math.max(this.energy, this.storyRestoration) : this.energy;
    if (this.storyFinale) {
      this.coreMesh.visible = this.storyRestoration >= .99;
      this.storyShards.forEach((shard, i) => {
        const angle = i * Math.PI * 2 / 3 + t * .15;
        const radius = .15 + (1 - this.storyRestoration) * .9;
        shard.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        shard.rotation.y = t * .3 + i;
        shard.visible = this.storyRestoration < .99;
      });
    }
    const base = this.zones[this.activeZone].core;
    this.core.position.y = base.y + (this.reduceMotion ? 0 : Math.sin(t * 1.4) * 0.12) + e * 0.35;
    this.coreMesh.rotation.y += dt * (0.4 + e * 5);
    this.coreMesh.rotation.x += dt * (0.2 + e * 2);
    this.coreMesh.scale.setScalar(0.85 + e * 0.55 + (e > 0.9 ? Math.sin(t * 20) * 0.04 : 0));
    this.coreMat.emissive.setRGB(0.25 + 0.75 * e, 0.2 + 0.6 * e, 0.3 * e + 0.1);
    this.coreMat.color.set("#8f8aa8").lerp(new THREE.Color("#FFE59A"), e);
    const gs = 1.2 + e * 3.2;
    this.coreGlow.scale.set(gs, gs, 1);
    this.coreGlow.material.opacity = 0.25 + 0.7 * e;
    this.orbiters.forEach((s, i) => {
      const a = t * (1.2 + e * 5) + (i / this.orbiters.length) * Math.PI * 2;
      const r = 1.4 - e * 0.9;
      s.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.25, Math.sin(a) * r);
      s.material.opacity = 0.15 + 0.8 * e;
    });
  }

  private loop = () => {
    if (this.disposed || this.paused) return;
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    const t = this.timer.getElapsed();

    this.vit += (this.vitTarget - this.vit) * (1 - Math.exp(-dt * 1.5));
    this.hemi.intensity = 1.4 + 1.6 * this.vit;
    this.sun.intensity = 1.1 + 2.6 * this.vit;
    this.grassMat.color.set("#6d7563").lerp(new THREE.Color("#6aa35a"), this.vit);
    this.cloudMat.opacity = 0.25 + 0.55 * this.vit;
    this.world.position.y = this.reduceMotion ? 0 : Math.sin(t * 0.6) * 0.1;
    this.canvas.style.setProperty("--vit", this.vit.toFixed(3));

    for (const z of this.zones)
      for (const it of z.items) {
        if (it.start < 0) continue;
        const u = Math.min(1, (t - it.start) / 0.9);
        it.k = it.to === 1 ? it.from + (1 - it.from) * easeOutBack(u) : it.from * (1 - u);
        it.apply(it.k);
        if (u >= 1) { it.start = -1; it.k = it.to; it.apply(it.k); }
      }
    for (const sp of this.spinners) {
      if (sp.item.k <= 0.95) continue;
      const boost = this.experience === "windmill" && sp.obj === this.millBlades ? 0.25 + this.energy * 8 : 1;
      sp.obj.rotation[sp.axis] += dt * sp.speed * boost;
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (t >= this.timers[i].at) { const fn = this.timers[i].fn; this.timers.splice(i, 1); fn(); }
    }

    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.t += dt / 0.7;
      const u = Math.min(1, c.t);
      const p = c.from.clone().lerp(c.to, u);
      p.y += Math.sin(u * Math.PI) * 2.2;
      c.sprite.position.copy(p);
      if (u >= 1) {
        this.world.remove(c.sprite);
        c.sprite.material.dispose();
        this.comets.splice(i, 1);
        c.onArrive();
      }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      wave.age += dt;
      wave.mesh.scale.setScalar(1 + wave.age * 5);
      if (this.storyAbility === "lumen-rise") wave.mesh.position.y += dt * 2;
      if (this.storyAbility === "aether-wing") wave.mesh.scale.x *= 1.8;
      wave.mesh.material.opacity = Math.max(0, 1 - wave.age / 1.3);
      if (wave.age >= 1.3) {
        this.world.remove(wave.mesh); wave.mesh.geometry.dispose(); wave.mesh.material.dispose(); this.waves.splice(i, 1);
      }
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.75;
      p.s.position.addScaledVector(p.v, dt);
      const sc = 0.3 + (1 - p.life) * 0.35;
      p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = Math.max(0, p.life) * 0.95;
      if (p.life <= 0) p.s.visible = false;
    }
    for (const c of this.clouds) {
      if (!this.reduceMotion) c.a += dt * 0.015;
      c.g.position.set(Math.cos(c.a) * c.r + 3, c.y, Math.sin(c.a) * c.r);
    }

    if (this.storyAbility) this.updateStoryStructures(t);
    this.updateCore(dt, t);
    this.updateSkyLanterns(dt, t);
    this.updateWind(dt);
    this.updateFigure(dt);

    const f = 1 - Math.exp(-dt * 1.6);
    this.camT.lerp(this.camGT, f);
    this.camR += (this.camGR * this.aspectF - this.camR) * f;
    this.camH += (this.camGH - this.camH) * f;
    if (this.orbit) { if (!this.reduceMotion) this.camA += dt * 0.04; }
    else this.camA += (this.camGA + (this.reduceMotion ? 0 : Math.sin(t * 0.15) * 0.1) - this.camA) * f;
    this.camera.position.set(this.camT.x + Math.sin(this.camA) * this.camR, this.camT.y + this.camH, this.camT.z + Math.cos(this.camA) * this.camR);
    this.camera.lookAt(this.camT.x, this.camT.y + 0.9, this.camT.z);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };
}
