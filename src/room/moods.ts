// Song scenes: while a Liner notes pick plays, the corner around the record player turns
// into its cover. Props grow in around the cabinet, and the lights, sky, fairy lights and
// motes drift toward the cover's colors; it all eases back when the song stops.
//   neon:   SadSvit, "Твій промінь": rainbow neon flowers on black, the player outlined in neon
//   meadow: Porter Robinson, "Look at the Sky": tall green grass and white flowers, a green-white sky
//   teto:   Jamie Paige, "Machine Love": a tiny Kasane Teto on the cabinet, red against green
import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type MoodId = 'neon' | 'meadow' | 'teto';
export const MOODS: MoodId[] = ['neon', 'meadow', 'teto'];

/** How a scene recolors things the room owns (fairy bulbs, motes). */
export interface SceneTint {
  bulb(i: number, now: number, c: Color): void;
  motes(c: Color): void;
}

interface Palette {
  sky: Color;
  ground: Color;
  fill: Color;
  moon: Color;
  /** How much the warm lamp dims (0 none, 1 off). */
  dim: number;
  /** The scene light near the turntable cycles through these on the beat. */
  light: Color[];
  /** How strong that light gets, and how much of it swells on the kick. */
  lightGain: number;
  pulse: number;
  motes: Color;
  bulbs: Color[];
}

const c = (hex: string) => new Color(hex);
const palettes: Record<MoodId, Palette> = {
  neon: {
    sky: c('#3a2a55'),
    ground: c('#05040a'),
    fill: c('#ff4a7a'),
    moon: c('#4a5cff'),
    dim: 0.7,
    light: [c('#ff3048'), c('#3a6bff'), c('#ffd23a'), c('#3aff7a')],
    lightGain: 0.22,
    pulse: 0.5,
    motes: c('#ffe27a'),
    bulbs: [c('#ff3048'), c('#ffd23a'), c('#3aff7a'), c('#3a6bff')],
  },
  meadow: {
    sky: c('#e8f7dc'),
    ground: c('#2e6b2a'),
    fill: c('#f4ffe9'),
    moon: c('#e6ffd8'),
    dim: 0.15,
    light: [c('#d4f7bc'), c('#ffffff')],
    lightGain: 0.3,
    pulse: 0.1, // a calm field: barely breathes with the beat
    motes: c('#ffffff'),
    bulbs: [c('#ffffff'), c('#dfffc9'), c('#fff6a8')],
  },
  teto: {
    sky: c('#ff6a70'),
    ground: c('#2c5a1c'),
    fill: c('#ff3048'),
    moon: c('#7fe06a'),
    dim: 0.3,
    light: [c('#ff2b3b'), c('#5fd04a')],
    lightGain: 0.5,
    pulse: 1,
    motes: c('#ff9a9a'),
    bulbs: [c('#ff3048'), c('#7fe06a')],
  },
};

// The record player's footprint (see props.ts): cabinet centered at (-2.6, 0.4, -3.6).
const DECK = new Vector3(-2.65, 0.95, -3.6);
const EYE = new Vector3(-1.55, 1.85, -2.35); // the "record" shot's camera, for facing props toward it

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const easeOutBack = (x: number) => {
  const k = 1.70158;
  return x <= 0 ? 0 : 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};
const smooth = (x: number) => x * x * (3 - 2 * x);

/** A tiny seeded random so every visit grows the same garden. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

interface Scene {
  root: Group;
  /** `w` 0..1 is how far the scene has grown in. */
  update(w: number, now: number, audio: number[]): void;
}

export interface Moods {
  root: Group;
  backdrop: CanvasTexture;
  /** `snap` skips the fade (dev previews). */
  set(id: MoodId | null, snap?: boolean): void;
  /** Advance the fades. Returns the total weight (0 when no scene shows). */
  tick(now: number, dt: number, audio: number[]): number;
  /** `out` = `base` drifted toward the active scenes' color for this slot. */
  mix(slot: 'sky' | 'ground' | 'fill' | 'moon', base: Color, out: Color): Color;
  /** Total lamp dimming, 0..1. */
  dim(): number;
  /** The scene light's color this frame; returns its strength. */
  light(now: number, out: Color): number;
  /** How much the scene light should swell on the kick, 0..1. */
  pulse(): number;
  tint: SceneTint;
}

export function buildMoods(): Moods {
  const root = new Group();
  const scenes: Record<MoodId, Scene> = { neon: neonScene(), meadow: meadowScene(), teto: tetoScene() };
  for (const id of MOODS) {
    scenes[id].root.visible = false;
    root.add(scenes[id].root);
  }
  const weight: Record<MoodId, number> = { neon: 0, meadow: 0, teto: 0 };
  let active: MoodId | null = null;

  const backdrop = createBackdrop();
  const lastPainted: Record<MoodId, number> = { neon: -1, meadow: -1, teto: -1 };

  const beatBlend = (cols: Color[], now: number, out: Color) => {
    if (cols.length === 1) return out.copy(cols[0]);
    const beats = (now / 1000) * (100 / 60);
    const pos = (beats / 2) % cols.length; // a new color every two beats
    const i = Math.floor(pos);
    return out.copy(cols[i]).lerp(cols[(i + 1) % cols.length], smooth(clamp01((pos - i - 0.7) / 0.3)));
  };
  const tmp = new Color();

  return {
    root,
    backdrop: backdrop.texture,
    set(id, snap = false) {
      active = id;
      if (snap) for (const m of MOODS) weight[m] = m === id ? 1 : 0;
    },
    tick(now, dt, audio) {
      let total = 0;
      for (const id of MOODS) {
        // Grow in over ~2.5 s, wilt away a little faster.
        const target = active === id ? 1 : 0;
        const rate = target ? 0.45 : 0.7;
        weight[id] = target > weight[id] ? Math.min(weight[id] + dt * rate, 1) : Math.max(weight[id] - dt * rate, 0);
        const scene = scenes[id];
        scene.root.visible = weight[id] > 0.001;
        if (scene.root.visible) scene.update(weight[id], now, audio);
        total += weight[id];
      }
      if (MOODS.some((id) => Math.abs(weight[id] - lastPainted[id]) > 0.01 || (weight[id] === 0) !== (lastPainted[id] === 0))) {
        backdrop.paint(weight);
        for (const id of MOODS) lastPainted[id] = weight[id];
      }
      return total;
    },
    mix(slot, base, out) {
      out.copy(base);
      for (const id of MOODS) if (weight[id] > 0) out.lerp(palettes[id][slot], smooth(weight[id]));
      return out;
    },
    dim() {
      let d = 0;
      for (const id of MOODS) d += smooth(weight[id]) * palettes[id].dim;
      return Math.min(d, 1);
    },
    light(now, out) {
      let strength = 0;
      let gain = 0;
      out.setRGB(0, 0, 0);
      for (const id of MOODS) {
        if (!weight[id]) continue;
        const w = smooth(weight[id]);
        out.add(beatBlend(palettes[id].light, now, tmp).multiplyScalar(w));
        strength += w;
        gain += w * palettes[id].lightGain;
      }
      if (strength > 0) out.multiplyScalar(1 / strength);
      return gain;
    },
    pulse() {
      let p = 0;
      let total = 0;
      for (const id of MOODS) {
        p += weight[id] * palettes[id].pulse;
        total += weight[id];
      }
      return total > 0 ? p / total : 1;
    },
    tint: {
      bulb(i, now, col) {
        for (const id of MOODS) {
          if (!weight[id]) continue;
          const bulbs = palettes[id].bulbs;
          // Neon chases its colors along the strand; the others just alternate.
          const shift = id === 'neon' ? Math.floor(now / 350) : 0;
          col.lerp(bulbs[(i + shift) % bulbs.length], smooth(weight[id]));
        }
      },
      motes(col) {
        for (const id of MOODS) if (weight[id]) col.lerp(palettes[id].motes, smooth(weight[id]));
      },
    },
  };
}

// ---------------------------------------------------------------------------------------
// Neon: glowing outline flowers like the cover's daisy, and the player traced in light.

const glowMat = () =>
  new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });

/** Paint each vertex by its distance from `center`: yellow heart, green, orange, red, then pink or blue tips. */
function paintRadial(geo: BufferGeometry, center: Vector3, reach: number, tip: Color) {
  const stops = [c('#fff36a'), c('#a8ff5a'), c('#ffad3a'), c('#ff3a5a'), tip];
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const out = new Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const t = clamp01(p.distanceTo(center) / reach) * (stops.length - 1);
    const k = Math.min(Math.floor(t), stops.length - 2);
    out.copy(stops[k]).lerp(stops[k + 1], t - k).multiplyScalar(1.1); // just over 1: a soft bloom
    colors.set([out.r, out.g, out.b], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

function paintSolid(geo: BufferGeometry, col: Color) {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([col.r, col.g, col.b], i * 3);
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

function neonFlower(height: number, size: number, petals: number, tip: Color, lean: number, rand: () => number) {
  const flower = new Group();
  // Stem: a soft S-curve up to the head.
  const top = new Vector3(lean * 0.6, height, lean * 0.2);
  const stemCurve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(lean * 0.1, height * 0.4, 0), new Vector3(lean * 0.45, height * 0.8, lean * 0.1), top]);
  const stem = paintSolid(new TubeGeometry(stemCurve, 40, 0.004, 5), c('#5aff8a').multiplyScalar(1.3));

  // Petal outlines, built in the head's own plane, then turned to face the camera.
  const parts: BufferGeometry[] = [];
  const r0 = size * 0.22;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + rand() * 0.2;
    const len = size * (0.8 + rand() * 0.3);
    const wid = size * 0.24;
    const pts: Vector3[] = [];
    for (let k = 0; k < 18; k++) {
      const u = (k / 18) * Math.PI * 2;
      const along = r0 + (len * (1 - Math.cos(u))) / 2;
      const across = (wid * Math.sin(u)) / 2;
      pts.push(new Vector3(Math.cos(a) * along - Math.sin(a) * across, Math.sin(a) * along + Math.cos(a) * across, Math.sin(u / 2) * size * 0.08));
    }
    parts.push(new TubeGeometry(new CatmullRomCurve3(pts, true), 36, 0.0032, 4, true));
  }
  parts.push(new TorusGeometry(r0, 0.004, 4, 24));
  const disc = new CircleGeometry(r0 * 0.9, 20);
  parts.push(disc);
  const head = paintRadial(mergeGeometries(parts.map((g) => g.toNonIndexed())), new Vector3(), r0 + size * 1.1, tip);
  const headMesh = new Mesh(head, glowMat());
  headMesh.position.copy(top);
  flower.add(new Mesh(stem, glowMat()), headMesh);
  return { flower, head: headMesh };
}

/** Turns box edges into thin glowing rods (lines would be 1 px wide). */
function neonEdges(w: number, h: number, d: number, at: Vector3, rod = 0.0045) {
  const edges = new EdgesGeometry(new BoxGeometry(w, h, d));
  const pos = edges.attributes.position;
  const parts: BufferGeometry[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i).add(at);
    b.fromBufferAttribute(pos, i + 1).add(at);
    const len = a.distanceTo(b);
    const g = new CylinderGeometry(rod, rod, len, 5, 1, true);
    const dir = b.clone().sub(a).normalize();
    g.applyQuaternion(new Quaternion().setFromUnitVectors(up, dir));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts);
}

/** Rainbow by angle around the turntable, like light sweeping round the outline. */
function paintHue(geo: BufferGeometry, center: Vector3) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new Color();
  for (let i = 0; i < pos.count; i++) {
    const ang = Math.atan2(pos.getZ(i) - center.z, pos.getX(i) - center.x);
    col.setHSL((ang / (Math.PI * 2) + 1) % 1, 1, 0.55).multiplyScalar(1.5);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

function neonScene(): Scene {
  const root = new Group();
  const rand = rng(7);
  const tips = [c('#ff6ad5'), c('#6a8bff'), c('#ff6ad5'), c('#5ad8ff')];
  // Around the cabinet: tall stems either side, more peeking over it from behind.
  const spots: [number, number, number, number, number][] = [
    // x, z, height, head size, lean
    [-3.42, -3.55, 1.05, 0.13, 0.08],
    [-3.3, -3.15, 0.82, 0.1, 0.12],
    [-3.62, -3.25, 1.28, 0.15, 0.1],
    [-1.95, -3.7, 1.15, 0.13, -0.08],
    [-1.85, -3.35, 0.9, 0.1, -0.12],
    [-2.95, -3.93, 1.32, 0.12, 0.05],
    [-2.35, -3.94, 1.22, 0.11, -0.05],
  ];
  const flowers = spots.map(([x, z, h, size, lean], i) => {
    const { flower, head } = neonFlower(h, size, 12 + (i % 3), tips[i % tips.length], lean, rand);
    flower.position.set(x, 0, z);
    head.lookAt(EYE);
    root.add(flower);
    return { flower, delay: i * 0.08, sway: rand() * 6 };
  });

  // The record player traced in neon: cabinet, plinth and platter rim.
  const outline = mergeGeometries([neonEdges(1.02, 0.82, 0.62, new Vector3(-2.6, 0.4, -3.6)), neonEdges(0.74, 0.11, 0.54, new Vector3(-2.6, 0.85, -3.6))]);
  const rim = new TorusGeometry(0.222, 0.004, 4, 64);
  rim.rotateX(Math.PI / 2);
  rim.translate(-2.68, 0.93, -3.6);
  const traced = new Mesh(paintHue(mergeGeometries([outline, rim.toNonIndexed()]), DECK), glowMat());
  root.add(traced);

  const mats = new Set<Material>();
  root.traverse((o) => (o as Mesh).isMesh && mats.add((o as Mesh).material as Material));

  return {
    root,
    update(w, now, audio) {
      const beat = 0.28 + audio[0] * 0.17; // glow, with a gentle pulse on the kick
      for (const m of mats) (m as MeshBasicMaterial).opacity = smooth(clamp01(w * 1.4)) * beat;
      for (const f of flowers) {
        const s = easeOutBack(clamp01((w - f.delay) * 1.6));
        f.flower.scale.setScalar(Math.max(s, 0.0001));
        f.flower.rotation.z = Math.sin(now / 1400 + f.sway) * 0.03;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------
// Meadow: the cover's field of grass and white flowers, growing up around the cabinet.

function meadowScene(): Scene {
  const root = new Group();
  const rand = rng(11);
  const dummy = new Object3D();

  // Grass blades rise from the floor tall enough to frame the deck, plus short tufts on the cabinet.
  const blade = new ConeGeometry(0.011, 1, 3);
  blade.translate(0, 0.5, 0);
  const blades: { x: number; y: number; z: number; h: number; yaw: number; tilt: number; delay: number }[] = [];
  const greens = ['#2f8a2c', '#4fa64a', '#6dbb5f', '#3a9a3e', '#7cc46a'].map(c);
  const underCabinet = (x: number, z: number) => x > -3.12 && x < -2.08 && z < -3.28;
  while (blades.length < 700) {
    const x = -3.95 + rand() * 2.25;
    const z = -3.95 + rand() * 1.3;
    if (underCabinet(x, z)) continue;
    const near = Math.hypot(x - DECK.x, (z - DECK.z) * 1.4);
    if (near > 1.25) continue;
    blades.push({ x, y: 0, z, h: 0.55 + rand() * 0.55, yaw: rand() * Math.PI, tilt: (rand() - 0.5) * 0.5, delay: near * 0.35 });
  }
  // Tufts along the cabinet top's free edges.
  for (let i = 0; i < 110; i++) {
    const side = rand();
    const x = side < 0.4 ? -3.08 + rand() * 0.11 : side < 0.8 ? -2.23 + rand() * 0.11 : -3.08 + rand() * 0.96;
    const z = side < 0.8 ? -3.9 + rand() * 0.58 : -3.34 + rand() * 0.03;
    blades.push({ x, y: 0.8, z, h: 0.06 + rand() * 0.12, yaw: rand() * Math.PI, tilt: (rand() - 0.5) * 0.6, delay: 0.1 + rand() * 0.3 });
  }
  const grass = new InstancedMesh(blade, new MeshStandardMaterial({ roughness: 0.9 }), blades.length);
  grass.instanceMatrix.setUsage(DynamicDrawUsage);
  blades.forEach((_, i) => grass.setColorAt(i, greens[i % greens.length]));
  root.add(grass);

  // White flowers (a few yellow, like the cover's dandelions) on thin stems.
  const petals: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const p = new SphereGeometry(0.02, 6, 4);
    p.scale(1, 0.35, 0.55);
    p.translate(0.022, 0, 0);
    p.rotateY((i / 5) * Math.PI * 2);
    petals.push(paintSolid(p.toNonIndexed(), c('#ffffff')));
  }
  const heart = new SphereGeometry(0.011, 6, 4);
  heart.translate(0, 0.006, 0);
  petals.push(paintSolid(heart.toNonIndexed(), c('#ffd84a')));
  const headGeo = mergeGeometries(petals);
  const flowerSpots: { x: number; y: number; z: number; h: number; tilt: number; delay: number }[] = [];
  while (flowerSpots.length < 70) {
    const x = -3.95 + rand() * 2.25;
    const z = -3.95 + rand() * 1.3;
    if (underCabinet(x, z)) continue;
    const near = Math.hypot(x - DECK.x, (z - DECK.z) * 1.4);
    if (near > 1.15) continue;
    flowerSpots.push({ x, y: 0, z, h: 0.6 + rand() * 0.5, tilt: (rand() - 0.5) * 0.7, delay: 0.25 + near * 0.35 });
  }
  for (let i = 0; i < 18; i++) {
    const onLeft = i % 2 === 0;
    flowerSpots.push({ x: onLeft ? -3.03 + rand() * 0.06 : -2.18 + rand() * 0.06, y: 0.8, z: -3.85 + rand() * 0.5, h: 0.06 + rand() * 0.1, tilt: (rand() - 0.5) * 0.8, delay: 0.3 + rand() * 0.3 });
  }
  const heads = new InstancedMesh(headGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.03 }), flowerSpots.length);
  const stemGeo = new CylinderGeometry(0.0035, 0.005, 1, 4, 1, true);
  stemGeo.translate(0, 0.5, 0);
  const stems = new InstancedMesh(stemGeo, new MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.9 }), flowerSpots.length);
  heads.instanceMatrix.setUsage(DynamicDrawUsage);
  stems.instanceMatrix.setUsage(DynamicDrawUsage);
  const yellow = c('#ffe066');
  const white = c('#ffffff');
  flowerSpots.forEach((_, i) => heads.setColorAt(i, i % 6 === 0 ? yellow : white));
  root.add(stems, heads);

  const tip = new Vector3();
  let lastW = -1;
  return {
    root,
    update(w, now) {
      const breeze = Math.sin(now / 1800) * 0.04;
      // Matrices only need rewriting while growing, plus a slow breeze sway.
      if (Math.abs(w - lastW) < 0.0005 && Math.floor(now / 50) % 2) return;
      lastW = w;
      blades.forEach((b, i) => {
        const s = smooth(clamp01((w - b.delay * 0.6) * 2));
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(b.tilt + breeze * (b.y ? 0.3 : 1), b.yaw, 0);
        dummy.scale.set(1, Math.max(b.h * s, 0.0001), 1);
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
      });
      grass.instanceMatrix.needsUpdate = true;
      flowerSpots.forEach((f, i) => {
        const s = smooth(clamp01((w - f.delay * 0.6) * 2));
        const h = Math.max(f.h * s, 0.0001);
        dummy.position.set(f.x, f.y, f.z);
        dummy.rotation.set(f.tilt * 0.3 + breeze, 0, f.tilt * 0.3);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        tip.set(0, 1, 0).applyMatrix4(dummy.matrix);
        dummy.position.copy(tip);
        dummy.rotation.set(f.tilt * 0.3 + breeze - 0.35, f.tilt * 4, 0);
        dummy.scale.setScalar(Math.max(easeOutBack(clamp01((w - f.delay) * 2.2)), 0.0001));
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      });
      stems.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------------------
// Teto: a chibi Kasane Teto (red twin drills, ahoge, grey uniform with a red tie, and her
// baguette) standing on the cabinet's front corner, bobbing to the song.

function tetoScene(): Scene {
  const root = new Group();
  const teto = new Group();
  const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
    new MeshStandardMaterial({ color, roughness: 0.75, ...extra });
  const hair = mat('#d93a52', { roughness: 0.55 });
  const skin = mat('#ffe3d6');
  const uniform = mat('#4a4856');
  const dark = mat('#26232e');
  const red = mat('#e0303f', { emissive: '#e0303f', emissiveIntensity: 0.15 });
  const add = (geo: BufferGeometry, m: Material, x: number, y: number, z: number) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    teto.add(mesh);
    return mesh;
  };

  // Legs and boots
  for (const sx of [-1, 1]) {
    add(new CylinderGeometry(0.016, 0.014, 0.1, 8), dark, sx * 0.028, 0.05, 0);
    add(new SphereGeometry(0.02, 8, 6), dark, sx * 0.028, 0.008, 0.008).scale.set(1, 0.6, 1.4);
  }
  // Skirt, with a red hem
  add(new CylinderGeometry(0.05, 0.085, 0.1, 10), uniform, 0, 0.14, 0);
  add(new TorusGeometry(0.084, 0.007, 4, 20), red, 0, 0.092, 0).rotation.x = Math.PI / 2;
  // Torso and the red necktie
  add(new CylinderGeometry(0.046, 0.05, 0.08, 10), uniform, 0, 0.23, 0);
  add(new ConeGeometry(0.014, 0.05, 4), red, 0, 0.235, 0.046).rotation.x = Math.PI;
  add(new BoxGeometry(0.03, 0.014, 0.012), red, 0, 0.262, 0.046);
  // Arms: one at her side, one hugging the baguette
  const armL = add(new CylinderGeometry(0.014, 0.012, 0.1, 8), uniform, -0.058, 0.22, 0);
  armL.rotation.z = -0.25;
  add(new SphereGeometry(0.014, 8, 6), skin, -0.07, 0.17, 0);
  const armR = add(new CylinderGeometry(0.014, 0.012, 0.1, 8), uniform, 0.056, 0.225, 0.02);
  armR.rotation.set(-0.9, 0, 0.35);
  add(new SphereGeometry(0.014, 8, 6), skin, 0.05, 0.2, 0.06);
  const bread = add(new CylinderGeometry(0.016, 0.016, 0.2, 10), mat('#d9a05b', { roughness: 0.9 }), 0.062, 0.24, 0.045);
  bread.rotation.set(0.25, 0, -0.55);
  for (let i = -1; i <= 1; i++) {
    const cut = new Mesh(new BoxGeometry(0.02, 0.004, 0.006), mat('#f2d39a'));
    cut.position.set(0, i * 0.05, 0.015);
    cut.rotation.z = 0.5;
    bread.add(cut);
  }

  // Head
  const headY = 0.36;
  add(new SphereGeometry(0.085, 20, 16), skin, 0, headY, 0);
  // Hair: a cap over the top and a shell over the back, leaving the face clear
  add(new SphereGeometry(0.092, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hair, 0, headY + 0.004, 0);
  add(new SphereGeometry(0.091, 20, 12, Math.PI, Math.PI, 0, Math.PI * 0.8), hair, 0, headY, -0.004);
  // Bangs: a fringe of short spikes over the forehead
  for (let i = -3; i <= 3; i++) {
    const spike = add(new ConeGeometry(0.018, 0.05, 4), hair, i * 0.019, headY + 0.045 - Math.abs(i) * 0.004, 0.07 - Math.abs(i) * 0.006);
    spike.rotation.set(Math.PI - 0.5, 0, i * 0.15);
  }
  // Side locks framing the face
  for (const sx of [-1, 1]) {
    const lock = add(new ConeGeometry(0.016, 0.09, 5), hair, sx * 0.07, headY - 0.03, 0.04);
    lock.rotation.set(Math.PI, 0, sx * -0.12);
  }
  // Her twin drills: stacked tapering coils hanging beside the head
  for (const sx of [-1, 1]) {
    const drill = new Group();
    drill.position.set(sx * 0.098, headY + 0.03, -0.012);
    drill.rotation.z = sx * 0.18;
    const coils = [0.034, 0.03, 0.026, 0.021, 0.015];
    coils.forEach((r, i) => {
      const seg = new Mesh(new CylinderGeometry(r, r * 0.55, 0.04, 10), hair);
      seg.position.y = -0.03 - i * 0.034;
      seg.castShadow = true;
      drill.add(seg);
    });
    const point = new Mesh(new ConeGeometry(0.009, 0.03, 8), hair);
    point.position.y = -0.03 - coils.length * 0.034 + 0.005;
    point.rotation.x = Math.PI;
    drill.add(point);
    teto.add(drill);
  }
  // Ahoge: the curl standing up off the top
  const ahoge = new CatmullRomCurve3([new Vector3(0, headY + 0.088, 0), new Vector3(0.01, headY + 0.13, 0.01), new Vector3(0.035, headY + 0.145, 0), new Vector3(0.04, headY + 0.125, -0.005)]);
  teto.add(new Mesh(new TubeGeometry(ahoge, 16, 0.0045, 5), hair));
  // Face: big red eyes with a highlight, a little smile and blush
  for (const sx of [-1, 1]) {
    add(new SphereGeometry(0.016, 12, 10), mat('#b0213a', { roughness: 0.3, emissive: '#5a0a18', emissiveIntensity: 0.4 }), sx * 0.032, headY - 0.008, 0.074).scale.set(0.8, 1.15, 0.45);
    add(new SphereGeometry(0.0035, 8, 6), new MeshBasicMaterial({ color: '#c8b8bc' }), sx * 0.027, headY + 0.002, 0.081);
    add(new CircleGeometry(0.012, 12), new MeshBasicMaterial({ color: '#ff9aa8', transparent: true, opacity: 0.6 }), sx * 0.052, headY - 0.03, 0.068).rotation.y = sx * 0.6;
  }
  add(new TorusGeometry(0.01, 0.0022, 4, 12, Math.PI), dark, 0, headY - 0.04, 0.079).rotation.z = Math.PI;

  // Standing on the cabinet's front right corner, turned toward the camera
  root.position.set(-2.16, 0.8, -3.37);
  root.lookAt(EYE.x, 0.8, EYE.z);
  const holder = new Group(); // whichever Teto is in use: this one, or a custom model
  holder.add(teto);
  root.add(holder);

  // A custom model replaces the built-in one, loaded the first time the song plays. It is
  // fitted to the same spot and height; its first animation loops. Opt-in: set CUSTOM_TETO to
  // 'models/teto.glb' once the file is in public/, so visitors never request a missing file.
  const CUSTOM_TETO: string | null = null;
  let tried = false;
  let mixer: AnimationMixer | null = null;
  const tryCustom = async () => {
    tried = true;
    if (!CUSTOM_TETO) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${CUSTOM_TETO}`);
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('html')) return; // no file: keep the built-in Teto
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().parseAsync(await res.arrayBuffer(), '');
      const model = gltf.scene;
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const fit = TETO_HEIGHT / Math.max(size.y, 1e-6);
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      model.traverse((o) => {
        if ((o as Mesh).isMesh) o.castShadow = true;
      });
      if (gltf.animations.length) {
        mixer = new AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
      }
      holder.clear();
      holder.add(model);
    } catch (err) {
      console.warn('Custom Teto model could not load; using the built-in one.', err);
    }
  };
  let last = 0;

  return {
    root,
    update(w, now, audio) {
      if (!tried) void tryCustom();
      mixer?.update(last ? Math.min((now - last) / 1000, 0.1) : 0);
      last = now;
      const pop = easeOutBack(clamp01(w * 1.5));
      holder.scale.setScalar(Math.max(pop, 0.0001));
      // Bob on the beat, sway a little, and turn to look around.
      const beats = (now / 1000) * (100 / 60);
      const hop = Math.abs(Math.sin(beats * Math.PI)) * (0.008 + audio[0] * 0.012);
      holder.position.y = hop;
      holder.rotation.z = Math.sin(beats * Math.PI * 0.5) * 0.06;
      holder.rotation.y = Math.sin(now / 2600) * 0.25;
    },
  };
}

/** Meters, feet to the top of the ahoge: what a custom model gets scaled to. */
const TETO_HEIGHT = 0.5;

// ---------------------------------------------------------------------------------------
// The sky outside: the room's moonlit void, blended with each scene's own backdrop.

function createBackdrop() {
  const W = 512;
  const H = 256;
  const canvas = (draw: (g: CanvasRenderingContext2D) => void) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    draw(cv.getContext('2d')!);
    return cv;
  };
  const glow = (g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, fade: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, fade);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  };
  const specks = (g: CanvasRenderingContext2D, n: number, color: string, seed: number, size = 1.4) => {
    const rand = rng(seed);
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(rand() * W, rand() * H, size * (0.5 + rand()), 0, Math.PI * 2);
      g.fill();
    }
  };

  const base = canvas((g) => {
    g.fillStyle = '#100c21';
    g.fillRect(0, 0, W, H);
    glow(g, 70, 90, 230, 'rgba(78, 82, 160, 0.55)', 'rgba(16, 12, 33, 0)'); // moon haze, upper left
    glow(g, 40, 230, 160, 'rgba(120, 60, 130, 0.35)', 'rgba(16, 12, 33, 0)'); // plum glow, lower left
    glow(g, 330, 120, 260, 'rgba(50, 36, 92, 0.45)', 'rgba(16, 12, 33, 0)'); // behind the room
  });
  const scenes: Record<MoodId, HTMLCanvasElement> = {
    // Near black with soft rainbow neon blooms, like the cover.
    neon: canvas((g) => {
      g.fillStyle = '#050407';
      g.fillRect(0, 0, W, H);
      const t = 'rgba(5, 4, 7, 0)';
      glow(g, 90, 70, 150, 'rgba(255, 60, 90, 0.3)', t);
      glow(g, 250, 40, 140, 'rgba(255, 210, 60, 0.22)', t);
      glow(g, 420, 140, 170, 'rgba(60, 255, 130, 0.2)', t);
      glow(g, 70, 210, 150, 'rgba(70, 110, 255, 0.3)', t);
      specks(g, 60, 'rgba(255, 240, 180, 0.5)', 3, 1);
    }),
    // Bright green field fading up into a white sky, scattered with white blossoms.
    meadow: canvas((g) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#e9f6df');
      grad.addColorStop(0.45, '#8cc47e');
      grad.addColorStop(1, '#2f7a2f');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      glow(g, 110, 60, 220, 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0)');
      specks(g, 220, 'rgba(255, 255, 255, 0.8)', 5, 1.6);
      specks(g, 30, 'rgba(255, 224, 90, 0.85)', 9, 1.4);
    }),
    // Red on the left, leafy green on the right, as split as the cover.
    teto: canvas((g) => {
      g.fillStyle = '#1e0b10';
      g.fillRect(0, 0, W, H);
      glow(g, 60, 120, 300, 'rgba(225, 40, 55, 0.85)', 'rgba(30, 11, 16, 0)');
      glow(g, 470, 110, 300, 'rgba(70, 150, 45, 0.8)', 'rgba(30, 11, 16, 0)');
      glow(g, 260, 40, 140, 'rgba(255, 240, 200, 0.25)', 'rgba(30, 11, 16, 0)');
      specks(g, 50, 'rgba(255, 255, 255, 0.55)', 13, 1.2);
    }),
  };

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d')!;
  const texture = new CanvasTexture(out);
  texture.colorSpace = SRGBColorSpace;
  const paint = (weights: Record<MoodId, number>) => {
    g.globalAlpha = 1;
    g.drawImage(base, 0, 0);
    for (const id of MOODS) {
      if (!weights[id]) continue;
      g.globalAlpha = smooth(weights[id]);
      g.drawImage(scenes[id], 0, 0);
    }
    texture.needsUpdate = true;
  };
  paint({ neon: 0, meadow: 0, teto: 0 });
  return { texture, paint };
}
