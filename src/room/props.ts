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
  VideoTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
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
import type { SceneTint } from './moods';
import { codeScreen, floorTexture, keysTexture, laptopDeckGlow, laptopDeckTexture, loadImage, placeholderPoster, vinylLabel, windowMaterial } from './textures';

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

export type HotspotId = 'keys' | 'cat' | 'lamp' | 'record';

export interface RoomProps {
  root: Group;
  /** Things you can click, each with the meshes a raycast should test. */
  hotspots: { id: HotspotId; objects: Object3D[] }[];
  /** The note under a point on the keyboard (uv of a raycast hit), or null. */
  noteAt(u: number, v: number): number | null;
  pressKey(midi: number, now: number): void;
  /** The cat nuzzles and a few hearts float up. */
  petCat(now: number): void;
  /** The desk lamp's own glow, 0 off to 1 on (the room dims its lights to match). */
  setLamp(level: number): void;
  /** Fades the room's own light sources (0 off, 1 on). */
  setGlow(level: number): void;
  /** Rain on the window: eases toward on (1) or off (0). */
  setRain(on: boolean): void;
  /** Music state: moves the tonearm and spins the record. */
  setPlaying(on: boolean): void;
  /** Light up the project on screen (its frame and the wall behind it); null for none. */
  setFocus(id: string | null): void;
  /** Show a song cover on the record label; null restores the house label. */
  setLabel(texture: Texture | null): void;
  /** `eye` is the camera position: the laptop only types while it is close enough to read. */
  tick(now: number, dt: number, audio: number[], eye: Vector3, tint?: SceneTint, breathe?: number): void;
  /** Log-spaced spectrum, 0..1 per band: the fairy lights and the laptop's live FFT. */
  setSpectrum(bands: Float32Array): void;
  /** Named spots the camera can visit. */
  anchors: Record<string, Vector3>;
  ready: Promise<void>;
}

// Tonearm yaw (radians): resting beside the platter, and with the needle on the outer grooves.
const LAPTOP = new Vector3(0.8, 1.8, -3.4);
const ARM_PARKED = Math.PI / 2;
const ARM_PLAYING = 0.75;

export function buildRoom(covers: Record<string, string>, videos: Record<string, HTMLVideoElement> = {}): RoomProps {
  const root = new Group();
  const anchors: Record<string, Vector3> = {};
  const glowMats: { mat: MeshStandardMaterial | MeshBasicMaterial; base: Color; max: number }[] = [];
  const addGlow = (mat: MeshStandardMaterial | MeshBasicMaterial, max: number) => {
    const base = 'emissive' in mat ? mat.emissive.clone() : mat.color.clone();
    glowMats.push({ mat, base, max });
  };
  // Projects that light up while their section is on screen: a warm frame, a glow on the
  // wall behind, and the picture itself a touch brighter.
  const focusables: Record<string, { level: number; halo: MeshBasicMaterial; frame?: MeshStandardMaterial; picture?: MeshStandardMaterial }> = {};
  const haloTex = haloTexture();
  const addFocus = (id: string, w: number, h: number, at: Vector3, facing: 'left' | 'back', frame?: MeshStandardMaterial, picture?: MeshStandardMaterial) => {
    const halo = new MeshBasicMaterial({ map: haloTex, color: '#ffb873', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const plane = new Mesh(new PlaneGeometry(w * 1.9 + 0.5, h * 1.9 + 0.5), halo);
    plane.position.copy(at);
    if (facing === 'left') plane.rotation.y = Math.PI / 2;
    plane.renderOrder = -1;
    root.add(plane);
    if (frame) frame.setValues({ emissive: '#ffc890', emissiveIntensity: 0 });
    if (picture) picture.setValues({ emissive: '#ffffff', emissiveIntensity: 0 });
    focusables[id] = { level: 0, halo, frame, picture };
  };
  let focusId: string | null = null;
  const posterVideo: Record<string, VideoTexture> = {};
  const coverMaps: Record<string, Texture | null> = {};

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
  // Keyboard deck: keys, trackpad, and a faint warm backlight.
  const deck = new Mesh(
    new PlaneGeometry(0.86, 0.56),
    new MeshStandardMaterial({ map: laptopDeckTexture(), roughness: 0.55, metalness: 0.2, emissive: '#ffb56b', emissiveMap: laptopDeckGlow(), emissiveIntensity: 0.05 }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0.8, deskY + 0.0365, -3.15);
  deck.receiveShadow = true;
  addGlow(deck.material as MeshStandardMaterial, 0.35);
  root.add(deck);
  const lid = new Group();
  lid.position.set(0.8, deskY + 0.035, -3.45);
  lid.rotation.x = -0.32;
  const lidBody = box(0.9, 0.6, 0.025, shell, 0, 0.3, 0, 0.015);
  // Unlit material: the screen shows its pixels as-is, unaffected by the lamp or shading.
  const screenMat = new MeshBasicMaterial({ map: screen.texture, color: new Color('#ffffff') });
  addGlow(screenMat, 0.84); // kept under the bloom threshold so the code stays crisp
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
  const keyTex = keysTexture();
  const keys = new Mesh(new PlaneGeometry(0.94, 0.17), std('#ffffff', { map: keyTex.texture, roughness: 0.5 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.032, 0.06);
  kb.add(keys);
  for (let i = 0; i < 4; i++) kb.add(cyl(0.022, 0.022, 0.03, std('#ffb35c'), -0.38 + i * 0.09, 0.04, -0.09, 16));
  shadowed(kb);
  root.add(kb);
  anchors.keyboard = new Vector3(-0.15, deskY + 0.1, -3.1);

  // Speakers: woofers pump with the bass, tweeters flutter with the treble
  const woofers: Mesh[] = [];
  const tweeters: Mesh[] = [];
  for (const x of [-0.55, 2.15]) {
    root.add(box(0.34, 0.5, 0.32, std('#efe3d2'), x, deskY + 0.25, -3.55, 0.03));
    const ring = cyl(0.11, 0.11, 0.02, std('#2b2836'), x, deskY + 0.2, -3.385);
    ring.rotation.x = Math.PI / 2;
    const cone = cyl(0.085, 0.085, 0.02, std('#4a4458'), x, deskY + 0.2, -3.375);
    cone.rotation.x = Math.PI / 2;
    const tweeter = cyl(0.04, 0.04, 0.02, std('#2b2836'), x, deskY + 0.39, -3.385);
    tweeter.rotation.x = Math.PI / 2;
    woofers.push(cone);
    tweeters.push(tweeter);
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
  const lampBase = cyl(0.12, 0.13, 0.04, lampMat, 1.95, deskY + 0.02, -3.3);
  root.add(lampBase);
  const arm = cyl(0.015, 0.015, 0.7, lampMat, 1.9, deskY + 0.33, -3.25, 10);
  arm.rotation.z = 0.25;
  root.add(arm);
  const shade = shadowed(new Mesh(new ConeGeometry(0.17, 0.24, 28, 1, true), std('#f2c14e', { side: DoubleSide, roughness: 0.4 })), false);
  shade.position.set(1.72, deskY + 0.66, -3.2);
  shade.rotation.z = -0.5;
  root.add(shade);
  const bulbMat = new MeshBasicMaterial({ color: new Color('#ffd59e') });
  addGlow(bulbMat, 2.6);
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
  // A pastel landscape handheld, propped on a little stand, with a cartridge beside it.
  const handheld = new Group();
  handheld.position.set(-2.4, shelfY - 0.475, -3.78);
  handheld.rotation.set(-0.18, 0.18, 0);
  const plastic = std('#ff8fa3', { roughness: 0.45 });
  const dark = std('#26232f', { roughness: 0.6 });
  handheld.add(box(0.38, 0.2, 0.045, plastic, 0, 0, 0, 0.045));
  // Grips: slightly fatter ends, like a real console.
  handheld.add(box(0.07, 0.18, 0.055, plastic, -0.16, -0.004, -0.003, 0.03));
  handheld.add(box(0.07, 0.18, 0.055, plastic, 0.16, -0.004, -0.003, 0.03));
  // Screen in a dark bezel.
  handheld.add(box(0.21, 0.135, 0.008, dark, 0, 0.012, 0.022, 0.012));
  const handheldScreen = new MeshBasicMaterial({ color: new Color('#ffffff') });
  addGlow(handheldScreen, 0.8);
  const hs = new Mesh(new PlaneGeometry(0.184, 0.104), handheldScreen);
  hs.position.set(0, 0.014, 0.0265);
  handheld.add(hs);
  // D-pad
  handheld.add(box(0.052, 0.017, 0.012, dark, -0.15, 0.012, 0.027, 0.004));
  handheld.add(box(0.017, 0.052, 0.012, dark, -0.15, 0.012, 0.027, 0.004));
  // A / B buttons on a diagonal
  const btn = (color: string, x: number, y: number) =>
    cyl(0.0125, 0.0125, 0.012, std(color, { roughness: 0.35 }), x, y, 0.027, 16).rotateX(Math.PI / 2);
  handheld.add(btn('#ffd166', 0.165, 0.03), btn('#7fb8ff', 0.135, 0.002));
  // Start / select pills and a speaker grille
  handheld.add(box(0.026, 0.008, 0.006, dark, -0.02, -0.078, 0.024, 0.004));
  handheld.add(box(0.026, 0.008, 0.006, dark, 0.02, -0.078, 0.024, 0.004));
  for (let i = 0; i < 6; i++) {
    handheld.add(cyl(0.0035, 0.0035, 0.004, dark, 0.135 + (i % 3) * 0.012, -0.055 - Math.floor(i / 3) * 0.012, 0.024, 8).rotateX(Math.PI / 2));
  }
  // Shoulder buttons
  handheld.add(box(0.07, 0.014, 0.03, std('#e8738a'), -0.14, 0.1, -0.004, 0.006));
  handheld.add(box(0.07, 0.014, 0.03, std('#e8738a'), 0.14, 0.1, -0.004, 0.006));
  root.add(shadowed(handheld));
  addFocus('hotfooter', 0.5, 0.3, new Vector3(-2.4, shelfY - 0.46, -3.995), 'back');
  // Clear acrylic stand behind it
  const stand = box(0.14, 0.12, 0.012, std('#ffffff', { transparent: true, opacity: 0.25, roughness: 0.1 }), -2.4, shelfY - 0.54, -3.83, 0.004);
  stand.rotation.x = 0.45;
  root.add(stand);
  // Game cartridge lying beside it
  const cart = new Group();
  cart.position.set(-2.12, shelfY - 0.583, -3.74);
  cart.rotation.y = -0.4;
  cart.add(box(0.07, 0.012, 0.08, std('#3a3450'), 0, 0, 0, 0.004));
  cart.add(box(0.05, 0.002, 0.045, std('#ffd166'), 0, 0.007, 0.008, 0.001));
  root.add(shadowed(cart));
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
  const labelMat = std('#ffffff', { map: label, roughness: 0.35 });
  const vinylSide = std('#111014', { roughness: 0.3 });
  const vinyl = cyl(0.21, 0.21, 0.012, [vinylSide, labelMat, vinylSide], -2.68, 0.935, -3.6, 48);
  root.add(vinyl);
  // Tonearm pivots from its base: parked off the record, swung over the grooves while playing.
  const armMetal = std('#e0dce8', { metalness: 0.6, roughness: 0.3 });
  const tonearm = new Group();
  tonearm.position.set(-2.3, 0.965, -3.78);
  tonearm.add(box(0.32, 0.014, 0.022, armMetal, -0.16, 0, 0, 0.006));
  tonearm.add(box(0.045, 0.02, 0.035, std('#2b2836'), -0.32, -0.008, 0, 0.005)); // headshell
  tonearm.rotation.y = ARM_PARKED;
  root.add(tonearm, cyl(0.03, 0.03, 0.05, armMetal, -2.3, 0.93, -3.78, 16));
  // Arm rest post, where the headshell sits when parked
  root.add(cyl(0.012, 0.012, 0.04, armMetal, -2.3, 0.92, -3.46, 10));
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
  // Hearts that float up when the cat is petted.
  const heartMat = new SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, opacity: 0 });
  const hearts = Array.from({ length: 4 }, () => {
    const s = new Sprite(heartMat.clone());
    s.scale.setScalar(0.09);
    s.visible = false;
    root.add(s);
    return { s, born: -1e9, dx: 0 };
  });
  let pettedAt = -1e9;

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
    const frameMat = std('#f6efe6');
    root.add(box(0.03, h + 0.08, w + 0.08, frameMat, -3.99, y, z, 0.01), poster);
    addFocus(id, w, h, new Vector3(-3.996, y, z), 'left', frameMat, mat);
    anchors[`poster-${id}`] = new Vector3(-3.95, y, z);
  }
  // Empty frame waiting for Project 5, on the back wall
  const p5Mat = std('#ffffff', { map: placeholderPoster() });
  const p5 = new Mesh(new PlaneGeometry(0.7, 0.95), p5Mat);
  p5.position.set(3.05, 3.0, -3.97);
  const p5Frame = std('#f6efe6');
  root.add(box(0.78, 1.03, 0.03, p5Frame, 3.05, 3.0, -3.99, 0.01), p5);
  addFocus('project5', 0.7, 0.95, new Vector3(3.05, 3.0, -3.996), 'back', p5Frame, p5Mat);
  anchors.project5 = p5.position.clone();

  const coverLoads = Object.entries(covers).map(async ([id, url]) => {
    const tex = await loadImage(url);
    if (id === 'hotfooter') {
      fitCover(tex, 0.184 / 0.104);
      handheldScreen.map = tex;
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
  const PER_STRAND = 34;
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
  // Both strands start in the corner, so with music the bass glows there and the treble
  // runs out toward the far ends, mirrored along the two walls.
  strand(new Vector3(-3.92, 4.55, -3.92), new Vector3(3.9, 4.55, -3.92), PER_STRAND);
  strand(new Vector3(-3.92, 4.55, -3.92), new Vector3(-3.92, 4.55, 3.9), PER_STRAND);
  const bulbLevel = new Float32Array(PER_STRAND);
  let bulbGain = 0.7; // running loudest band, so the strand spans dark to bright for any mix
  let spectrum: Float32Array | null = null;
  const peak = new Color('#fff1dc');

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

  // ---------- Motes drifting in the night outside the diorama ----------
  // Fills the empty side of wide screens. Only spots in front of the open sides are kept,
  // since anything behind the two walls would never be seen.
  const voidCount = 240;
  const voidGeo = new BufferGeometry();
  const voidPos = new Float32Array(voidCount * 3);
  for (let i = 0; i < voidCount; ) {
    const x = -14 + Math.random() * 24;
    const y = -2 + Math.random() * 9;
    const z = -8 + Math.random() * 22;
    const inside = Math.abs(x) < 4.4 && Math.abs(z) < 4.4 && y > -0.3 && y < 5.2;
    const hidden = x < -4.2 && z < 4.2;
    if (inside || hidden || z < -4.4) continue;
    voidPos.set([x, y, z], i * 3);
    i++;
  }
  voidGeo.setAttribute('position', new BufferAttribute(voidPos, 3));
  const voidMat = new PointsMaterial({ color: '#b9b4ff', size: 0.07, map: dotTexture(), alphaTest: 0.01, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending });
  const voidPoints = new Points(voidGeo, voidMat);
  root.add(voidPoints);

  // Invisible, slightly generous hit shapes, so small things are easy to click from afar.
  const hitMat = new MeshBasicMaterial({ visible: false });
  const catHit = new Mesh(new SphereGeometry(0.34, 12, 8), hitMat);
  catHit.position.set(cat.position.x + 0.08, cat.position.y + 0.02, cat.position.z);
  const lampHit = new Mesh(new BoxGeometry(0.5, 0.8, 0.45), hitMat);
  lampHit.position.set(1.82, deskY + 0.38, -3.22);
  const recordHit = new Mesh(new BoxGeometry(0.76, 0.16, 0.56), hitMat);
  recordHit.position.set(-2.6, 0.9, -3.6);
  root.add(catHit, lampHit, recordHit);

  let glow = 0;
  let lamp = 1;
  let rain = 1;
  let rainTarget = 1;
  let playing = false;
  let music = 0; // eases to 1 while something plays: how much the room follows the audio
  let spin = 0;
  let screenDrawn = false;
  return {
    root,
    anchors,
    hotspots: [
      { id: 'keys', objects: [keys] },
      { id: 'cat', objects: [cat, catHit] },
      { id: 'lamp', objects: [shade, bulb, arm, lampBase, lampHit] },
      { id: 'record', objects: [vinyl, tonearm, recordHit] },
    ],
    noteAt: keyTex.noteAt,
    pressKey: keyTex.press,
    petCat(now) {
      pettedAt = now;
      hearts.forEach((h, i) => {
        h.born = now + i * 220;
        h.dx = (i - 1.5) * 0.06;
      });
    },
    setLamp(level) {
      lamp = level;
    },
    ready: Promise.all(coverLoads).then(() => undefined),
    setRain(on) {
      rainTarget = on ? 1 : 0;
    },
    setPlaying(on) {
      playing = on;
    },
    setSpectrum(bands) {
      spectrum = bands;
    },
    setFocus(id) {
      if (id === focusId) return;
      // A focused project with a recording plays it on its poster; leaving restores the cover.
      if (focusId && posterVideo[focusId]) {
        const mat = posterMats[focusId];
        const cover = coverMaps[focusId];
        if (mat && cover !== undefined) {
          mat.map = cover;
          mat.needsUpdate = true;
        }
      }
      focusId = id;
      const video = id ? videos[id] : undefined;
      const mat = id ? posterMats[id] : undefined;
      if (id && video && mat) {
        coverMaps[id] ??= mat.map;
        posterVideo[id] ??= videoTexture(video, 1.05 / 0.72);
        mat.map = posterVideo[id];
        mat.needsUpdate = true;
      }
    },
    setLabel(texture) {
      labelMat.map = texture ?? label;
      labelMat.needsUpdate = true;
    },
    setGlow(level) {
      glow = level;
      for (const g of glowMats) {
        const k = 0.04 + level * g.max;
        if (g.mat instanceof MeshStandardMaterial) g.mat.emissiveIntensity = k;
        else g.mat.color.copy(g.base).multiplyScalar(k);
      }
      dustMat.opacity = level * 0.55;
      voidMat.opacity = 0.3 + level * 0.25;
    },
    tick(now, dt, audio, eye, tint, breathe = 0) {
      music += ((playing ? 1 : 0) - music) * (1 - Math.exp(-dt * 2));
      // Fairy bulbs follow their band: quick to light, slow to fade, like a VU meter.
      let loudest = 0;
      if (spectrum && playing) for (let k = 0; k < PER_STRAND; k++) loudest = Math.max(loudest, spectrum[k]);
      bulbGain += (Math.max(loudest, 0.08) - bulbGain) * (1 - Math.exp(-dt * (loudest > bulbGain ? 6 : 0.8)));
      for (let k = 0; k < PER_STRAND; k++) {
        const target = spectrum && playing ? Math.pow(Math.min(spectrum[k] / bulbGain, 1), 2.2) : 0; // capped: never past full
        const rate = target > bulbLevel[k] ? 18 : 3.5;
        bulbLevel[k] += (target - bulbLevel[k]) * (1 - Math.exp(-dt * rate));
      }
      // Each typed character re-uploads a 1600x1000 texture; skip it when nobody can read it.
      if (!screenDrawn || eye.distanceToSquared(LAPTOP) < 3.2 * 3.2) {
        screen.tick(now, spectrum, music);
        screenDrawn = true;
      }
      win.uniforms.uTime.value = now / 1000;
      for (const [id, f] of Object.entries(focusables)) {
        const target = id === focusId ? 1 : 0;
        if (f.level === target) continue;
        f.level += (target - f.level) * (1 - Math.exp(-dt * 4));
        if (Math.abs(f.level - target) < 0.002) f.level = target;
        const k = f.level * f.level * (3 - 2 * f.level);
        f.halo.opacity = k * 0.6 * (0.4 + 0.6 * glow);
        if (f.frame) f.frame.emissiveIntensity = k * 0.55;
        if (f.picture) {
          if (f.picture.emissiveMap !== f.picture.map) {
            f.picture.emissiveMap = f.picture.map; // follows the cover once it loads
            f.picture.needsUpdate = true;
          }
          f.picture.emissiveIntensity = k * 0.22;
        }
      }
      rain += (rainTarget - rain) * (1 - Math.exp(-dt * 0.8));
      win.uniforms.uRain.value = rain;
      // The arm swings over first; the platter spins up once the needle is down.
      const armTarget = playing ? ARM_PLAYING : ARM_PARKED;
      tonearm.rotation.y += (armTarget - tonearm.rotation.y) * (1 - Math.exp(-dt * 3));
      const needleDown = playing && Math.abs(tonearm.rotation.y - ARM_PLAYING) < 0.05;
      spin += ((needleDown ? 3.5 : 0) - spin) * (1 - Math.exp(-dt * (needleDown ? 2 : 1.2))); // 33 rpm, give or take
      vinyl.rotation.y -= dt * spin;
      body.scale.y = 0.75 + Math.sin(now / 900) * 0.025 + Math.sin(Math.max(0, 1 - (now - pettedAt) / 1400) * Math.PI) * 0.06;
      const kick = 1 + audio[0] * 0.25;
      for (const w of woofers) w.scale.set(kick, 1, kick);
      const flutter = 1 + audio[2] * 0.3;
      for (const t of tweeters) t.scale.set(flutter, 1, flutter);
      // The lamp's bulb breathes with the lamp light (see room.ts), and goes dark when switched off.
      bulbMat.color.multiplyScalar((1 + breathe * 0.35) * (0.06 + 0.94 * lamp));
      keyTex.tick(now);
      // Petting: the cat stretches up into your hand, then settles; hearts drift up and fade.
      const pet = Math.max(0, 1 - (now - pettedAt) / 1400);
      head.position.y = 0.02 + Math.sin(pet * Math.PI) * 0.035;
      head.rotation.z = Math.sin(pet * Math.PI * 3) * 0.12 * pet;
      tail.rotation.z = 1.2 + Math.sin(now / 160) * 0.25 * pet;
      for (const h of hearts) {
        const age = (now - h.born) / 1400;
        h.s.visible = age >= 0 && age < 1;
        if (!h.s.visible) continue;
        h.s.position.set(cat.position.x + 0.3 + h.dx, cat.position.y + 0.2 + age * 0.45, cat.position.z + Math.sin(age * 6 + h.dx * 40) * 0.03);
        (h.s.material as SpriteMaterial).opacity = Math.sin(age * Math.PI) * 0.9;
      }
      bulbs.forEach((b, i) => {
        const twinkle = 0.85 + 0.15 * Math.sin(now / 600 + i * 1.7);
        b.color.set(i % 3 === 0 ? '#ff9ec0' : '#ffcf85');
        tint?.bulb(i, now, b.color);
        // With music, brightness follows the bulb's band and the loudest ones blush to white.
        const lvl = bulbLevel[i % PER_STRAND];
        b.color.lerp(peak, Math.max(lvl - 0.6, 0) * 0.6 * music);
        const level = twinkle + (0.12 + lvl * 1.1 - twinkle) * music;
        b.color.multiplyScalar((0.04 + glow * 2.6) * level);
      });
      const pos = dustGeo.attributes.position as BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let y = pos.getY(i) + dt * 0.03;
        if (y > 4) y = 0.5;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(now / 2000 + i) * dt * 0.02);
      }
      pos.needsUpdate = true;
      // The whole cloud sways slowly; cheaper than moving every mote.
      const sway = Math.sin(now / 9000);
      voidPoints.position.set(sway * 0.4, Math.sin(now / 6000) * 0.25, 0);
      voidPoints.rotation.y = sway * 0.015;
      voidMat.color.set('#b9b4ff');
      tint?.motes(voidMat.color);
    },
  };
}

/** A video as a texture, cropped like object-fit: cover once its size is known. */
function videoTexture(video: HTMLVideoElement, planeAspect: number) {
  const tex = new VideoTexture(video);
  tex.colorSpace = SRGBColorSpace;
  const fit = () => {
    if (!video.videoWidth) return;
    const aspect = video.videoWidth / video.videoHeight;
    if (aspect > planeAspect) {
      tex.repeat.set(planeAspect / aspect, 1);
      tex.offset.set((1 - tex.repeat.x) / 2, 0);
    } else {
      tex.repeat.set(1, aspect / planeAspect);
      tex.offset.set(0, (1 - tex.repeat.y) / 2);
    }
  };
  fit();
  video.addEventListener('loadedmetadata', fit);
  return tex;
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

/** A little pink heart for the cat. */
function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ff8fb1';
  g.shadowColor = 'rgba(255, 143, 177, 0.9)';
  g.shadowBlur = 8;
  // Drawn at 70% around the center so its glow fades out well inside the texture's edge.
  g.translate(32, 32);
  g.scale(0.7, 0.7);
  g.translate(-32, -32);
  g.beginPath();
  g.moveTo(32, 52);
  g.bezierCurveTo(6, 34, 10, 10, 32, 22);
  g.bezierCurveTo(54, 10, 58, 34, 32, 52);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A soft rounded-rectangle glow, like light spilling onto the wall around a frame. */
function haloTexture() {
  // Computed per pixel: full under the frame, then a long smooth falloff that reaches exactly
  // zero before the texture's border, so the plane's square edge can never show.
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const core = 0.13; // radius of the bright core, as a fraction of the texture
  const fade = 0.35; // falloff distance; core + fade < 0.5 keeps the border at zero
  const round = core; // fully rounded: an oval of light, stretched to the frame's shape
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Distance outside a rounded square centered in the texture.
      const qx = Math.abs((x + 0.5) / N - 0.5) - (core - round);
      const qy = Math.abs((y + 0.5) / N - 0.5) - (core - round);
      const d = Math.max(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - round, 0);
      const t = Math.min(d / fade, 1);
      const a = (Math.exp(-4 * t * t) - Math.exp(-4)) / (1 - Math.exp(-4)); // gaussian, pinned to zero at the end
      // A hair of noise breaks up 8-bit banding in the faint outer ring.
      const v = Math.max(0, Math.min(255, a * 255 + (Math.random() - 0.5) * 2 * (a > 0 ? 1 : 0)));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
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
