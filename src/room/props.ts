// Builds the bedroom out of rounded primitives. Units are roughly meters.
// Back wall at z = -4, left wall at x = -4, floor at y = 0.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { codeScreen, floorTexture, keysTexture, loadImage, placeholderPoster, vinylLabel, windowMaterial } from './textures';

const std = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function shadowed<T extends Object3D>(o: T, cast = true): T {
  o.traverse((c) => {
    if ((c as Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = true;
    }
  });
  return o;
}

function box(w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, r = 0.03) {
  const radius = Math.min(r, w / 2, h / 2, d / 2);
  const geo = radius > 0.001 ? new RoundedBoxGeometry(w, h, d, 3, radius) : new BoxGeometry(w, h, d);
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  return shadowed(m);
}

function cyl(rTop: number, rBottom: number, h: number, mat: Material | Material[], x: number, y: number, z: number, seg = 28) {
  const m = new Mesh(new CylinderGeometry(rTop, rBottom, h, seg), mat);
  m.position.set(x, y, z);
  return shadowed(m);
}

export interface RoomProps {
  root: Group;
  /** Fades the room's own light sources (0 off, 1 on). */
  setGlow(level: number): void;
  /** Rain on the window: eases toward on (1) or off (0). */
  setRain(on: boolean): void;
  tick(now: number, dt: number, audio: number[]): void;
  /** Named spots the camera can visit. */
  anchors: Record<string, Vector3>;
  ready: Promise<void>;
}

export function buildRoom(covers: Record<string, string>): RoomProps {
  const root = new Group();
  const anchors: Record<string, Vector3> = {};
  const glowMats: { mat: MeshStandardMaterial | MeshBasicMaterial; base: Color; max: number }[] = [];
  const addGlow = (mat: MeshStandardMaterial | MeshBasicMaterial, max: number) => {
    const base = 'emissive' in mat ? mat.emissive.clone() : mat.color.clone();
    glowMats.push({ mat, base, max });
  };

  // ---------- Shell ----------
  const floor = box(8, 0.2, 8, std('#ffffff', { map: floorTexture(), roughness: 0.7 }), 0, -0.1, 0, 0.02);
  floor.castShadow = false;
  const wallMat = std('#57457d');
  const backWall = box(8.2, 5, 0.2, wallMat, 0, 2.5, -4.1, 0.02);
  const leftWall = box(0.2, 5, 8.2, wallMat, -4.1, 2.5, 0, 0.02);
  backWall.castShadow = leftWall.castShadow = false;
  const trim = std('#2c2244');
  root.add(floor, backWall, leftWall, box(8, 0.14, 0.05, trim, 0, 0.07, -3.98, 0.01), box(0.05, 0.14, 8, trim, -3.98, 0.07, 0, 0.01));

  const rug = cyl(1.75, 1.75, 0.02, std('#b8648c'), 0.6, 0.01, 0.3, 64);
  const rugInner = cyl(1.35, 1.35, 0.022, std('#d98aa8'), 0.6, 0.012, 0.3, 64);
  root.add(rug, rugInner);

  // ---------- Window with the rainy city ----------
  const win = windowMaterial();
  const glass = new Mesh(new PlaneGeometry(2.4, 1.6), win);
  glass.position.set(0.8, 2.95, -3.985);
  root.add(glass);
  const frame = std('#e9e0f2');
  root.add(
    box(2.6, 0.1, 0.12, frame, 0.8, 3.8, -3.95),
    box(2.6, 0.1, 0.12, frame, 0.8, 2.1, -3.95),
    box(0.1, 1.8, 0.12, frame, -0.45, 2.95, -3.95),
    box(0.1, 1.8, 0.12, frame, 2.05, 2.95, -3.95),
    box(0.05, 1.6, 0.06, frame, 0.8, 2.95, -3.95),
    box(2.4, 0.05, 0.06, frame, 0.8, 2.95, -3.95),
    box(2.9, 0.07, 0.32, frame, 0.8, 2.04, -3.84),
  );
  const curtainMat = std('#c47a9a', { side: DoubleSide, roughness: 1 });
  for (const side of [-1, 1]) {
    const geo = new PlaneGeometry(0.75, 2.5, 24, 1);
    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.04);
    geo.computeVertexNormals();
    const curtain = shadowed(new Mesh(geo, curtainMat));
    curtain.position.set(0.8 + side * 1.55, 2.8, -3.86);
    root.add(curtain);
  }
  anchors.window = new Vector3(0.8, 2.95, -3.9);

  // Sill plant
  root.add(cyl(0.09, 0.07, 0.14, std('#e6d3c0'), 1.75, 2.14, -3.82));
  for (let i = 0; i < 6; i++) {
    const leaf = shadowed(new Mesh(new SphereGeometry(0.06, 12, 8), std('#5fae6e')));
    leaf.scale.set(0.5, 1.6, 0.5);
    leaf.position.set(1.75 + Math.cos(i) * 0.05, 2.3, -3.82 + Math.sin(i) * 0.05);
    leaf.rotation.z = Math.cos(i * 2) * 0.5;
    leaf.rotation.x = Math.sin(i * 2) * 0.5;
    root.add(leaf);
  }

  // ---------- Desk ----------
  const wood = std('#9a6a52', { roughness: 0.7 });
  const deskY = 1.5;
  root.add(box(3.1, 0.1, 1.2, wood, 0.8, deskY - 0.05, -3.35, 0.03));
  for (const [x, z] of [[-0.6, -3.85], [2.2, -3.85], [-0.6, -2.85], [2.2, -2.85]]) {
    root.add(box(0.08, deskY - 0.1, 0.08, wood, x, (deskY - 0.1) / 2, z, 0.02));
  }

  // Laptop (screen shows code: the CS corner)
  const screen = codeScreen();
  const shell = std('#8f8aa6', { roughness: 0.45, metalness: 0.3 });
  root.add(box(0.9, 0.035, 0.6, shell, 0.8, deskY + 0.018, -3.15, 0.015));
  const lid = new Group();
  lid.position.set(0.8, deskY + 0.035, -3.45);
  lid.rotation.x = -0.32;
  const lidBody = box(0.9, 0.6, 0.025, shell, 0, 0.3, 0, 0.015);
  const screenMat = new MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: screen.texture, emissiveIntensity: 0.05 });
  addGlow(screenMat, 1.25);
  const display = new Mesh(new PlaneGeometry(0.84, 0.53), screenMat);
  display.position.set(0, 0.3, 0.014);
  lid.add(lidBody, display);
  root.add(lid);
  anchors.laptop = new Vector3(0.8, deskY + 0.3, -3.4);

  // MIDI keyboard
  const kb = new Group();
  kb.position.set(-0.15, deskY + 0.03, -3.05);
  kb.rotation.y = 0.12;
  kb.add(box(1.0, 0.06, 0.32, std('#2b2836'), 0, 0, 0, 0.015));
  const keys = new Mesh(new PlaneGeometry(0.94, 0.17), std('#ffffff', { map: keysTexture(), roughness: 0.5 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.032, 0.06);
  kb.add(keys);
  for (let i = 0; i < 4; i++) kb.add(cyl(0.022, 0.022, 0.03, std('#ffb35c'), -0.38 + i * 0.09, 0.04, -0.09, 16));
  shadowed(kb);
  root.add(kb);
  anchors.keyboard = new Vector3(-0.15, deskY + 0.1, -3.1);

  // Speakers: woofers pulse with the bass (Floor 6)
  const woofers: Mesh[] = [];
  for (const x of [-0.55, 2.15]) {
    root.add(box(0.34, 0.5, 0.32, std('#efe3d2'), x, deskY + 0.25, -3.55, 0.03));
    const ring = cyl(0.11, 0.11, 0.02, std('#2b2836'), x, deskY + 0.2, -3.385);
    ring.rotation.x = Math.PI / 2;
    const cone = cyl(0.085, 0.085, 0.02, std('#4a4458'), x, deskY + 0.2, -3.375);
    cone.rotation.x = Math.PI / 2;
    const tweeter = cyl(0.04, 0.04, 0.02, std('#2b2836'), x, deskY + 0.39, -3.385);
    tweeter.rotation.x = Math.PI / 2;
    woofers.push(cone);
    root.add(ring, cone, tweeter);
  }
  anchors.speakers = new Vector3(-0.55, deskY + 0.3, -3.5);

  // Mug
  root.add(cyl(0.07, 0.065, 0.13, std('#ff8fb1'), 1.5, deskY + 0.065, -2.95));
  const handle = shadowed(new Mesh(new TorusGeometry(0.04, 0.012, 8, 16), std('#ff8fb1')));
  handle.position.set(1.575, deskY + 0.07, -2.95);
  root.add(handle);

  // Desk lamp: the warm key light of the whole room
  const lampMat = std('#f2c14e', { roughness: 0.4 });
  root.add(cyl(0.12, 0.13, 0.04, lampMat, 1.95, deskY + 0.02, -3.3));
  const arm = cyl(0.015, 0.015, 0.7, lampMat, 1.9, deskY + 0.33, -3.25, 10);
  arm.rotation.z = 0.25;
  root.add(arm);
  const shade = shadowed(new Mesh(new ConeGeometry(0.17, 0.24, 28, 1, true), std('#f2c14e', { side: DoubleSide, roughness: 0.4 })), false);
  shade.position.set(1.72, deskY + 0.66, -3.2);
  shade.rotation.z = -0.5;
  root.add(shade);
  const bulbMat = new MeshBasicMaterial({ color: new Color('#ffd59e') });
  addGlow(bulbMat, 3.2);
  const bulb = new Mesh(new SphereGeometry(0.055, 16, 12), bulbMat);
  bulb.position.set(1.68, deskY + 0.58, -3.2);
  root.add(bulb);
  anchors.lamp = bulb.position.clone();

  // Floor plant beside the desk
  root.add(cyl(0.26, 0.2, 0.5, std('#e7d8c9'), 3.15, 0.25, -3.4));
  for (let i = 0; i < 9; i++) {
    const leaf = shadowed(new Mesh(new SphereGeometry(0.12, 12, 8), std(i % 2 ? '#4e9a5f' : '#62b571')));
    const a = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.45, 1.9, 0.25);
    leaf.position.set(3.15 + Math.cos(a) * 0.16, 0.85 + (i % 3) * 0.12, -3.4 + Math.sin(a) * 0.16);
    leaf.rotation.set(Math.sin(a) * 0.6, a, -Math.cos(a) * 0.6);
    root.add(leaf);
  }

  // Pouf seat
  root.add(cyl(0.34, 0.36, 0.42, std('#8a6cc4', { roughness: 1 }), 0.8, 0.21, -2.25, 32));

  // ---------- Shelf on the back wall: project objects ----------
  const shelfY = 2.75;
  root.add(box(1.9, 0.06, 0.36, wood, -2.6, shelfY, -3.82, 0.015));
  root.add(box(1.9, 0.06, 0.36, wood, -2.6, shelfY - 0.62, -3.82, 0.015));
  const bookColors = ['#ffb35c', '#7fb8ff', '#ff8fb1', '#6ee7a8', '#c792ea'];
  bookColors.forEach((c, i) => {
    const h = 0.3 + (i % 3) * 0.05;
    root.add(box(0.08, h, 0.24, std(c), -3.42 + i * 0.09, shelfY + 0.03 + h / 2, -3.82, 0.01));
  });

  // VR headset (VR Music Room)
  const vr = new Group();
  vr.position.set(-2.55, shelfY + 0.12, -3.8);
  vr.rotation.y = 0.35;
  vr.add(box(0.34, 0.17, 0.18, std('#f2f0f8', { roughness: 0.5 }), 0, 0, 0, 0.05));
  vr.add(box(0.3, 0.12, 0.02, std('#1b1a2a', { roughness: 0.2, metalness: 0.4 }), 0, 0, 0.09, 0.01));
  const strap = new Mesh(new TorusGeometry(0.16, 0.02, 8, 24, Math.PI), std('#3a3450'));
  strap.rotation.x = Math.PI / 2;
  strap.position.z = -0.06;
  vr.add(strap);
  root.add(shadowed(vr));
  anchors.vrmusicroom = vr.position.clone();

  // Paper boat in Miku teal (Sonare of the Lake)
  const boat = new Group();
  boat.position.set(-1.95, shelfY + 0.07, -3.8);
  boat.rotation.y = -0.5;
  boat.add(box(0.32, 0.07, 0.12, std('#39c5bb'), 0, 0, 0, 0.03));
  boat.add(cyl(0.006, 0.006, 0.26, std('#f2f0f8'), 0, 0.15, 0, 8));
  const sailShape = new Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0.13, 0);
  sailShape.lineTo(0, 0.2);
  const sail = new Mesh(new ShapeGeometry(sailShape), std('#ffffff', { side: DoubleSide }));
  sail.position.set(0.005, 0.05, 0);
  boat.add(sail);
  root.add(shadowed(boat));
  anchors.sonare = boat.position.clone();

  // Handheld console (Hot Footer) on the lower shelf
  const handheld = new Group();
  handheld.position.set(-2.4, shelfY - 0.47, -3.8);
  handheld.rotation.x = -0.15;
  handheld.add(box(0.3, 0.19, 0.045, std('#ff6b81', { roughness: 0.5 }), 0, 0, 0, 0.03));
  const handheldScreen = new MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 0.05 });
  addGlow(handheldScreen, 0.9);
  const hs = new Mesh(new PlaneGeometry(0.15, 0.11), handheldScreen);
  hs.position.z = 0.024;
  handheld.add(hs);
  handheld.add(cyl(0.018, 0.018, 0.01, std('#2b2836'), 0.11, -0.02, 0.025, 12).rotateX(Math.PI / 2));
  handheld.add(cyl(0.018, 0.018, 0.01, std('#2b2836'), -0.11, -0.02, 0.025, 12).rotateX(Math.PI / 2));
  root.add(shadowed(handheld));
  anchors.hotfooter = handheld.position.clone();

  // Little cactus on the lower shelf
  root.add(cyl(0.05, 0.04, 0.07, std('#e6d3c0'), -3.2, shelfY - 0.55, -3.8));
  const cactus = shadowed(new Mesh(new SphereGeometry(0.045, 12, 10), std('#6ab47b')));
  cactus.scale.set(1, 1.6, 1);
  cactus.position.set(-3.2, shelfY - 0.45, -3.8);
  root.add(cactus);

  // ---------- Record player on a cabinet ----------
  root.add(box(1.0, 0.8, 0.6, std('#7c4f3f'), -2.6, 0.4, -3.6, 0.03));
  ['#ffb35c', '#7fb8ff', '#ff8fb1', '#c792ea'].forEach((c, i) => {
    root.add(box(0.03, 0.42, 0.42, std(c), -2.95 + i * 0.07, 0.42, -3.55, 0.005));
  });
  root.add(box(0.72, 0.1, 0.52, std('#b07a5c', { roughness: 0.6 }), -2.6, 0.85, -3.6, 0.02));
  root.add(cyl(0.22, 0.22, 0.025, std('#c9c6d6', { metalness: 0.6, roughness: 0.3 }), -2.68, 0.915, -3.6, 48));
  const label = vinylLabel();
  const vinylSide = std('#111014', { roughness: 0.3 });
  const vinyl = cyl(0.21, 0.21, 0.012, [vinylSide, std('#ffffff', { map: label, roughness: 0.35 }), vinylSide], -2.68, 0.935, -3.6, 48);
  root.add(vinyl);
  const tonearm = box(0.28, 0.015, 0.025, std('#e0dce8', { metalness: 0.6, roughness: 0.3 }), -2.42, 0.96, -3.48, 0.006);
  tonearm.rotation.y = 0.5;
  root.add(tonearm, cyl(0.03, 0.03, 0.05, std('#e0dce8', { metalness: 0.6 }), -2.32, 0.93, -3.42, 16));
  anchors.record = new Vector3(-2.65, 0.95, -3.6);

  // ---------- Bed with a sleeping cat ----------
  root.add(box(2.0, 0.35, 3.2, wood, -2.95, 0.22, 0.9, 0.04));
  root.add(box(2.0, 0.95, 0.1, wood, -2.95, 0.7, -0.72, 0.04));
  root.add(box(1.9, 0.26, 3.05, std('#efe8f5', { roughness: 1 }), -2.95, 0.52, 0.95, 0.08));
  root.add(box(1.96, 0.12, 2.1, std('#9a8ae6', { roughness: 1 }), -2.92, 0.68, 1.45, 0.06));
  root.add(box(0.75, 0.18, 0.45, std('#f6efe6', { roughness: 1 }), -3.4, 0.76, -0.35, 0.09));
  root.add(box(0.75, 0.18, 0.45, std('#ffc2d4', { roughness: 1 }), -2.5, 0.76, -0.35, 0.09));

  const cat = new Group();
  cat.position.set(-2.55, 0.86, 1.55);
  cat.rotation.y = 0.6;
  const fur = std('#e89a5c', { roughness: 1 });
  const body = new Mesh(new SphereGeometry(0.2, 24, 16), fur);
  body.scale.set(1.5, 0.75, 1.05);
  const head = new Mesh(new SphereGeometry(0.13, 20, 14), fur);
  head.position.set(0.3, 0.02, 0.05);
  const earL = new Mesh(new ConeGeometry(0.045, 0.08, 10), fur);
  earL.position.set(0.32, 0.13, 0.11);
  const earR = earL.clone();
  earR.position.z = -0.01;
  const tail = new Mesh(new TorusGeometry(0.22, 0.035, 8, 24, Math.PI * 0.9), fur);
  tail.rotation.set(Math.PI / 2, 0, 1.2);
  tail.position.set(-0.05, -0.08, 0);
  cat.add(body, head, earL, earR, tail);
  root.add(shadowed(cat));

  // ---------- Posters: project covers on the left wall ----------
  const posterMats: Record<string, MeshStandardMaterial> = {};
  const posterSpots: [string, number, number, number, number][] = [
    // id, z, y, width, height
    ['vrmusicroom', -0.15, 3.05, 1.05, 0.72],
    ['sonare', 1.1, 3.25, 1.05, 0.72],
    ['roomlink', 2.35, 3.0, 1.05, 0.72],
  ];
  for (const [id, z, y, w, h] of posterSpots) {
    const mat = std('#ffffff', { roughness: 0.6, map: placeholderPoster() });
    posterMats[id] = mat;
    const poster = new Mesh(new PlaneGeometry(w, h), mat);
    poster.rotation.y = Math.PI / 2;
    poster.position.set(-3.97, y, z);
    poster.receiveShadow = true;
    root.add(box(0.03, h + 0.08, w + 0.08, std('#f6efe6'), -3.99, y, z, 0.01), poster);
    anchors[`poster-${id}`] = new Vector3(-3.95, y, z);
  }
  // Empty frame waiting for Project 5, on the back wall
  const p5 = new Mesh(new PlaneGeometry(0.7, 0.95), std('#ffffff', { map: placeholderPoster() }));
  p5.position.set(3.05, 3.0, -3.97);
  root.add(box(0.78, 1.03, 0.03, std('#f6efe6'), 3.05, 3.0, -3.99, 0.01), p5);
  anchors.project5 = p5.position.clone();

  const coverLoads = Object.entries(covers).map(async ([id, url]) => {
    const tex = await loadImage(url);
    if (id === 'hotfooter') {
      handheldScreen.emissiveMap = tex;
      handheldScreen.needsUpdate = true;
      return;
    }
    const mat = posterMats[id];
    if (!mat) return;
    fitCover(tex, 1.05 / 0.72);
    mat.map = tex;
    mat.needsUpdate = true;
  });

  // ---------- Fairy lights along the top of both walls ----------
  const bulbs: MeshBasicMaterial[] = [];
  const strand = (from: Vector3, to: Vector3, count: number) => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const p = from.clone().lerp(to, t);
      p.y -= Math.sin(t * Math.PI * 3) ** 2 * 0.22; // three gentle sags
      pts.push(p);
    }
    const curve = new CatmullRomCurve3(pts);
    root.add(new Mesh(new TubeGeometry(curve, 120, 0.006, 6), std('#1f1a2c')));
    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({ color: new Color(i % 3 === 0 ? '#ff9ec0' : '#ffcf85') });
      addGlow(mat, 2.6);
      bulbs.push(mat);
      const b = new Mesh(new SphereGeometry(0.035, 10, 8), mat);
      b.position.copy(curve.getPoint((i + 0.5) / count));
      b.position.y -= 0.03;
      root.add(b);
    }
  };
  strand(new Vector3(-3.92, 4.55, -3.92), new Vector3(3.9, 4.55, -3.92), 34);
  strand(new Vector3(-3.92, 4.55, -3.92), new Vector3(-3.92, 4.55, 3.9), 34);

  // ---------- Dust floating in the lamp light ----------
  const dustCount = 260;
  const dustGeo = new BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -1 + Math.random() * 4;
    dustPos[i * 3 + 1] = 0.5 + Math.random() * 3.5;
    dustPos[i * 3 + 2] = -3.8 + Math.random() * 3;
  }
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  const dustMat = new PointsMaterial({ color: '#ffd59e', size: 0.03, map: dotTexture(), alphaTest: 0.01, transparent: true, opacity: 0.0, depthWrite: false, blending: AdditiveBlending });
  root.add(new Points(dustGeo, dustMat));

  let glow = 0;
  let rain = 1;
  let rainTarget = 1;
  return {
    root,
    anchors,
    ready: Promise.all(coverLoads).then(() => undefined),
    setRain(on) {
      rainTarget = on ? 1 : 0;
    },
    setGlow(level) {
      glow = level;
      for (const g of glowMats) {
        const k = 0.04 + level * g.max;
        if (g.mat instanceof MeshStandardMaterial) g.mat.emissiveIntensity = k;
        else g.mat.color.copy(g.base).multiplyScalar(k);
      }
      dustMat.opacity = level * 0.55;
    },
    tick(now, dt, audio) {
      screen.tick(now);
      win.uniforms.uTime.value = now / 1000;
      rain += (rainTarget - rain) * (1 - Math.exp(-dt * 0.8));
      win.uniforms.uRain.value = rain;
      vinyl.rotation.y -= dt * 3.5 * glow; // 33 rpm, give or take
      body.scale.y = 0.75 + Math.sin(now / 900) * 0.025;
      const kick = 1 + audio[0] * 0.25;
      for (const w of woofers) w.scale.set(kick, 1, kick);
      bulbs.forEach((b, i) => {
        const twinkle = 0.85 + 0.15 * Math.sin(now / 600 + i * 1.7);
        const base = i % 3 === 0 ? '#ff9ec0' : '#ffcf85';
        b.color.set(base).multiplyScalar((0.04 + glow * 2.6) * twinkle);
      });
      const pos = dustGeo.attributes.position as BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let y = pos.getY(i) + dt * 0.03;
        if (y > 4) y = 0.5;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(now / 2000 + i) * dt * 0.02);
      }
      pos.needsUpdate = true;
    },
  };
}

/** Crop a texture like CSS object-fit: cover for a plane of the given aspect. */
function fitCover(tex: Texture, planeAspect: number) {
  const img = tex.image as { width: number; height: number } | undefined;
  if (!img?.width) return;
  const aspect = img.width / img.height;
  if (aspect > planeAspect) {
    tex.repeat.set(planeAspect / aspect, 1);
    tex.offset.set((1 - tex.repeat.x) / 2, 0);
  } else {
    tex.repeat.set(1, aspect / planeAspect);
    tex.offset.set(0, (1 - tex.repeat.y) / 2);
  }
}

/** Soft round sprite so dust motes are circles, not squares. */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}
