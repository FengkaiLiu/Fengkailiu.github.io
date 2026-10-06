// The 3D bedroom behind the page: renderer, lights, post-processing, and the
// scroll-driven camera that glides from object to object.
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  SpotLight,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildRoom, type HotspotId } from './props';
import { buildMoods, MOODS, type MoodId } from './moods';
import { DEFAULT_FRAME, shots, type Shot } from './shots';

export interface Room {
  /** Resolves when textures are loaded and the first frame is drawn. */
  ready: Promise<void>;
  /** Flip the lamp on: lights fade up. */
  lightsOn(): void;
  /** Feed analyser bands, each 0..1. */
  setAudio(bass: number, mid: number, treble: number, level: number): void;
  /** Log-spaced spectrum, 0..1 per band (the fairy lights and the laptop's FFT). */
  setSpectrum(bands: Float32Array): void;
  setRain(on: boolean): void;
  setPlaying(on: boolean): void;
  setLabel(texture: Texture | null): void;
  /** Turn the record player's corner into a song's scene, or null for the plain room. */
  setMood(id: MoodId | null): void;
  /** Clicks on the room's objects: a key (with its note), the cat, the lamp, the record. */
  onInteract(fn: (hit: RoomHit) => void): void;
  /** Hovering an object (or null), with the pointer position, for hints. */
  onHover(fn: (id: HotspotId | null, x: number, y: number) => void): void;
  /** Switch the desk lamp; returns whether it is now on. */
  toggleLamp(): boolean;
  petCat(): void;
  pressKey(midi: number): void;
}

export interface RoomHit {
  id: HotspotId;
  /** For the keyboard: the MIDI note under the pointer. */
  note?: number;
}

/** True when the pointer is over open room, not over page content or controls. */
const overRoom = (target: EventTarget | null) =>
  target instanceof Element && !target.closest('a, button, input, label, iframe, h1, h2, h3, p, li, .chapter__card, .liquid, .dockbar, .scope, .tracknav, .gate');

const MAX_DPR = 1.75;
const MIN_DPR = 0.8;
const LIGHTS_ON_MS = 2400;

// Film grain + vignette: the lofi finish.
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * 0.045;
      c.rgb *= mix(0.62, 1.0, smoothstep(1.0, 0.3, length(vUv - 0.5) * 1.3));
      gl_FragColor = c;
    }
  `,
};

export function initRoom(sections: { el: HTMLElement; shot: string }[], covers: Record<string, string>): Room | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  // Quality tiers, cheapest visual losses first. Each caps the total pixels rendered, so a
  // big window renders at a lower density instead of choking the GPU; small windows stay crisp.
  // fx: how fancy the HTML glass over the canvas may be (it re-blurs every frame).
  const tiers = [
    { megapixels: 3.2, msaa: 4, bloom: true, fx: 'full' },
    { megapixels: 2.2, msaa: 4, bloom: true, fx: 'full' },
    { megapixels: 1.6, msaa: 0, bloom: true, fx: 'lite' },
    { megapixels: 1.15, msaa: 0, bloom: true, fx: 'lite' },
    { megapixels: 0.85, msaa: 0, bloom: false, fx: 'min' },
    { megapixels: 0.6, msaa: 0, bloom: false, fx: 'min' },
  ] as const;
  let tier = 0;
  const dprFor = (t: number) => {
    const cssPixels = window.innerWidth * window.innerHeight;
    const budget = Math.sqrt((tiers[t].megapixels * 1e6) / cssPixels);
    return Math.max(Math.min(window.devicePixelRatio, MAX_DPR, budget), MIN_DPR);
  };
  let dpr = dprFor(tier);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  // Nothing that casts a meaningful shadow moves, so the shadow map is drawn once, not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const canvas = renderer.domElement;
  canvas.className = 'room-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const scene = new Scene();
  const moods = buildMoods();
  scene.background = moods.backdrop; // the moonlit void, blended toward the playing song's sky
  scene.add(moods.root);
  // Dev helper: /?mood=neon (or meadow, teto) shows a song scene without playing anything.
  const debugMood = import.meta.env.DEV ? (new URLSearchParams(location.search).get('mood') as MoodId | null) : null;
  if (debugMood && MOODS.includes(debugMood)) moods.set(debugMood, true);

  const camera = new PerspectiveCamera(34, 1, 0.1, 100);

  // ---------- Lights ----------
  const hemi = new HemisphereLight('#6a5aa8', '#1d1530', 0.5);
  const moon = new DirectionalLight('#8aa4ff', 0.9);
  moon.position.set(0.8, 5.5, -9);
  const lampSpot = new SpotLight('#ffb56b', 0, 9, 1.05, 0.85, 1.6);
  lampSpot.position.set(1.68, 2.08, -3.2);
  lampSpot.target.position.set(0.9, 1.4, -3.0);
  lampSpot.castShadow = true;
  lampSpot.shadow.mapSize.set(1024, 1024);
  lampSpot.shadow.bias = -0.0006;
  lampSpot.shadow.radius = 6;
  const lampFill = new PointLight('#ff9f5a', 0, 9, 1.6);
  lampFill.position.set(1.6, 2.3, -2.9);
  const fairyFill = new PointLight('#ff8fc0', 0, 9, 1.4);
  fairyFill.position.set(-2.3, 3.9, -2.9);
  const posterLight = new PointLight('#ffc6a0', 0, 4.5, 1.5);
  posterLight.position.set(-2.9, 3.9, 1.1);
  const screenGlow = new PointLight('#8fd8ff', 0, 2.6, 2);
  screenGlow.position.set(0.8, 1.85, -3.05);
  // A song scene's own light by the turntable, dark until a scene plays.
  const moodLight = new PointLight('#ffffff', 0, 6, 1.3);
  moodLight.position.set(-2.1, 1.75, -2.85);
  scene.add(hemi, moon, lampSpot, lampSpot.target, lampFill, fairyFill, posterLight, screenGlow, moodLight);
  const base = { sky: hemi.color.clone(), ground: hemi.groundColor.clone(), fill: fairyFill.color.clone(), moon: moon.color.clone(), poster: posterLight.color.clone() };

  const room = buildRoom(covers);
  scene.add(room.root);

  // ---------- Post-processing ----------
  const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.7, 0.42, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  composer.addPass(grain);
  composer.setPixelRatio(dpr);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    dpr = dprFor(tier);
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    // Portrait screens see less sideways; widen the lens so the room still fits.
    camera.fov = camera.aspect < 1 ? 42 : 34;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', () => {
    // A new window size means a new pixel count: tiers that failed before may fit now.
    failed.clear();
    resize();
  });

  // ---------- Scroll-driven camera ----------
  const vec = (v: [number, number, number]) => new Vector3(...v);
  const keyframes = sections.map((s) => {
    const shot: Shot = shots[s.shot] ?? shots.hero;
    return { el: s.el, shot: s.shot, pos: vec(shot.pos), target: vec(shot.target), frame: shot.frame ?? DEFAULT_FRAME };
  });

  const desired = { pos: new Vector3(), target: new Vector3(), frame: DEFAULT_FRAME };
  // Fit the shot to the screen shape: portrait screens back away so the room still fits,
  // extra-wide screens push in a little so the room fills the width.
  const portraitPullback = () => {
    const aspect = window.innerWidth / window.innerHeight;
    let k = 1;
    if (aspect < 1) k = Math.min(0.85 / aspect, 1.9);
    else {
      // Only wide establishing shots push in; close-ups (a few meters away) keep their framing.
      const far = smoothstep(Math.min(Math.max((desired.pos.distanceTo(desired.target) - 4) / 5, 0), 1));
      k = 1 - (1 - Math.max(Math.min(1.78 / aspect, 1), 0.84)) * far;
    }
    if (k !== 1) desired.pos.sub(desired.target).multiplyScalar(k).add(desired.target);
  };
  // Dev helper: /?shot=sonare frames one shot without scrolling.
  const debugShot = import.meta.env.DEV ? new URLSearchParams(location.search).get('shot') : null;
  const sampleScroll = () => {
    if (debugShot && shots[debugShot]) {
      const s = shots[debugShot];
      desired.pos.set(...s.pos);
      desired.target.set(...s.target);
      desired.frame = s.frame ?? DEFAULT_FRAME;
      room.setFocus(debugShot);
      portraitPullback();
      return;
    }
    const mid = window.scrollY + window.innerHeight / 2;
    const centers = keyframes.map((k) => k.el.offsetTop + k.el.offsetHeight / 2);
    let i = 0;
    while (i < keyframes.length - 2 && mid > centers[i + 1]) i++;
    const a = keyframes[i];
    const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
    const raw = (mid - centers[i]) / Math.max(centers[i + 1] - centers[i], 1);
    // Hold on each shot for a while, then glide: the camera rests while you read.
    const t = smoothstep(Math.min(Math.max((raw - 0.3) / 0.4, 0), 1));
    desired.pos.lerpVectors(a.pos, b.pos, t);
    desired.pos.y += Math.sin(t * Math.PI) * 0.45; // a gentle dolly arc between shots
    desired.target.lerpVectors(a.target, b.target, t);
    desired.frame = a.frame + (b.frame - a.frame) * t;
    // The project being read lights up; it hands over as the camera passes halfway.
    room.setFocus((t < 0.5 ? a : b).shot);
    portraitPullback();
  };
  sampleScroll();
  const basePos = desired.pos.clone();
  camera.position.copy(basePos);
  const lookAt = desired.target.clone();
  let frame = desired.frame;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    },
    { passive: true },
  );

  // ---------- Loop ----------
  const audio = [0, 0, 0, 0];
  let breathe = 0;
  let lampOn = true;
  let lampLevel = 1;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const debugLit = import.meta.env.DEV && new URLSearchParams(location.search).has('lit');
  let lightsStart = debugLit ? -LIGHTS_ON_MS : -1;
  let last = performance.now();
  let running = true;
  let resolveFirst!: () => void;
  const firstFrame = new Promise<void>((r) => (resolveFirst = r));
  let drawn = false;

  const right = new Vector3();
  const up = new Vector3();

  // ---------- Adaptive quality ----------
  // Measure the frame rate every second. Too slow: drop a tier (two if far too slow).
  // A tier that failed is never retried until the window is resized, so quality settles
  // instead of bouncing up and down (each switch reallocates buffers and hitches).
  const fpsMeter = import.meta.env.DEV && new URLSearchParams(location.search).has('fps') ? createFpsMeter() : null;
  const gov = { frames: 0, time: 0, startAt: 0, goodStreak: 0 };
  const failed = new Set<number>();
  const applyTier = (next: number) => {
    tier = next;
    const t = tiers[tier];
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples !== t.msaa) {
        rt.samples = t.msaa;
        rt.dispose(); // re-created with the new sample count on next use
      }
    }
    bloom.enabled = t.bloom;
    document.documentElement.dataset.fx = t.fx;
    resize();
  };
  document.documentElement.dataset.fx = tiers[tier].fx;
  const governQuality = (now: number, dt: number) => {
    if (!gov.startAt) gov.startAt = now + 2000; // ignore the shader-compile hitch at startup
    if (now < gov.startAt || document.hidden) return;
    gov.frames++;
    gov.time += dt;
    if (gov.time < 1) return;
    const fps = gov.frames / gov.time;
    gov.frames = 0;
    gov.time = 0;
    if (fps < 50 && tier < tiers.length - 1) {
      failed.add(tier);
      applyTier(Math.min(tier + (fps < 32 ? 2 : 1), tiers.length - 1));
      gov.goodStreak = 0;
    } else if (fps > 57) {
      // Climb only after sustained headroom, and never back into a tier that failed.
      gov.goodStreak++;
      if (gov.goodStreak >= 5 && tier > 0 && !failed.has(tier - 1)) {
        applyTier(tier - 1);
        gov.goodStreak = 0;
      }
    } else {
      gov.goodStreak = 0;
    }
    fpsMeter?.update(fps, dpr, bloom.enabled, tier);
  };

  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    // Lights fade up after the switch.
    const lit = lightsStart === -1 ? 0 : easeInOut(Math.min((now - lightsStart) / LIGHTS_ON_MS, 1));
    // While a song scene plays, the lights drift toward its cover's colors.
    const moodWeight = moods.tick(now, dt, audio);
    const dim = 1 - moods.dim();
    // The lamp breathes with the music: a slow follower of its loudness.
    breathe += (audio[3] - breathe) * (1 - Math.exp(-dt * 1.6));
    const lampBreath = 1 + breathe * 0.22;
    hemi.intensity = 0.42 + lit * 0.25 + Math.min(moodWeight, 1) * 0.15;
    lampLevel += ((lampOn ? 1 : 0) - lampLevel) * (1 - Math.exp(-dt * (lampOn ? 9 : 14)));
    lampSpot.intensity = lit * 3.6 * dim * lampBreath * lampLevel;
    lampFill.intensity = lit * 2.2 * dim * lampBreath * lampLevel;
    room.setLamp(lampLevel);
    fairyFill.intensity = lit * 3.4;
    posterLight.intensity = lit * 2.6 * (0.4 + 0.6 * dim);
    screenGlow.intensity = lit * 1.1;
    moods.mix('sky', base.sky, hemi.color);
    moods.mix('ground', base.ground, hemi.groundColor);
    moods.mix('fill', base.fill, fairyFill.color);
    moods.mix('moon', base.moon, moon.color);
    moods.mix('fill', base.poster, posterLight.color);
    moodLight.intensity = moods.light(now, moodLight.color) * (2.4 + audio[0] * 2 * moods.pulse()) * Math.max(lit, 0.4);
    room.setGlow(lit);

    // Camera eases toward the scroll target; the pointer adds a small parallax.
    sampleScroll();
    const k = debugLit ? 1 : 1 - Math.exp(-dt * (reducedMotion.matches ? 10 : 2.6));
    basePos.lerp(desired.pos, k);
    lookAt.lerp(desired.target, k);
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
    camera.position.copy(basePos);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(right, pointer.x * 0.12).addScaledVector(up, -pointer.y * 0.08);
    camera.lookAt(lookAt);

    // Frame the subject off-center on wide screens so the text card fits beside it.
    frame += (desired.frame - frame) * k;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The wider the screen, the less the room needs shifting to clear the (left-pinned) text.
    const wideFrame = Math.max(frame - 0.19 * Math.max(w / h - 1.25, 0), 0);
    if (w > 820) camera.setViewOffset(w, h, -wideFrame * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);

    room.tick(now, dt, audio, camera.position, moods.tint, breathe);
    grain.uniforms.uTime.value = now / 1000;
    composer.render(dt);
    governQuality(now, dt);

    if (!drawn) {
      drawn = true;
      canvas.classList.add('is-ready');
      resolveFirst();
    }
    requestAnimationFrame(loop);
  };

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  });
  requestAnimationFrame(loop);

  // ---------- Clicking things in the room ----------
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const owner = new Map<object, HotspotId>();
  for (const h of room.hotspots) for (const o of h.objects) o.traverse((c) => owner.set(c, h.id));
  const interactFns: ((hit: RoomHit) => void)[] = [];
  const hoverFns: ((id: HotspotId | null, x: number, y: number) => void)[] = [];
  /** The object under a screen point, if the first solid thing there is a hotspot. */
  const pick = (x: number, y: number): RoomHit | null => {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObject(room.root, true)) {
      const o = hit.object as { isMesh?: boolean; visible: boolean };
      if (!o.isMesh || !o.visible) continue; // dust, motes and hidden things don't block
      let node: typeof hit.object | null = hit.object;
      while (node && !owner.has(node)) node = node.parent;
      const id = node ? owner.get(node)! : null;
      if (!id) return null; // something solid is in front
      if (id === 'keys') {
        const note = hit.uv ? room.noteAt(hit.uv.x, hit.uv.y) : null;
        return note === null ? null : { id, note };
      }
      return { id };
    }
    return null;
  };
  let hovered: HotspotId | null = null;
  let down: { hit: RoomHit; x: number; y: number; at: number } | null = null;
  let lastNote: number | null = null;
  let pendingMove: PointerEvent | null = null;
  window.addEventListener(
    'pointermove',
    (e) => {
      pendingMove = e;
    },
    { passive: true },
  );
  // Hover (and dragging across the keys) is resolved at most once per frame.
  const hoverLoop = () => {
    const e = pendingMove;
    pendingMove = null;
    if (e && lightsStart !== -1) {
      const hit = overRoom(e.target) ? pick(e.clientX, e.clientY) : null;
      const id = hit?.id ?? null;
      if (id !== hovered) {
        hovered = id;
        document.body.style.cursor = id ? 'pointer' : '';
      }
      for (const fn of hoverFns) fn(id, e.clientX, e.clientY);
      // Glissando: holding the pointer down and sliding plays each new key.
      if (down?.hit.id === 'keys' && hit?.id === 'keys' && hit.note !== lastNote) {
        lastNote = hit.note ?? null;
        for (const fn of interactFns) fn(hit);
      }
    }
    requestAnimationFrame(hoverLoop);
  };
  requestAnimationFrame(hoverLoop);
  window.addEventListener('pointerdown', (e) => {
    if (lightsStart === -1 || e.button !== 0 || !overRoom(e.target)) return;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) return;
    down = { hit, x: e.clientX, y: e.clientY, at: performance.now() };
    // Keys sound on press, like a real keyboard; the rest act on release (a tap, not a drag).
    if (hit.id === 'keys') {
      lastNote = hit.note ?? null;
      for (const fn of interactFns) fn(hit);
    }
  });
  window.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    lastNote = null;
    if (!d || d.hit.id === 'keys') return;
    const still = Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && performance.now() - d.at < 600;
    if (still && pick(e.clientX, e.clientY)?.id === d.hit.id) for (const fn of interactFns) fn(d.hit);
  });

  return {
    ready: Promise.all([room.ready, firstFrame]).then(() => undefined),
    lightsOn() {
      if (lightsStart === -1) lightsStart = performance.now();
    },
    setRain(on) {
      room.setRain(on);
    },
    setPlaying(on) {
      room.setPlaying(on);
    },
    setLabel(texture) {
      room.setLabel(texture);
    },
    setMood(id) {
      moods.set(id);
    },
    onInteract(fn) {
      interactFns.push(fn);
    },
    onHover(fn) {
      hoverFns.push(fn);
    },
    toggleLamp() {
      lampOn = !lampOn;
      return lampOn;
    },
    petCat() {
      room.petCat(performance.now());
    },
    pressKey(midi) {
      room.pressKey(midi, performance.now());
    },
    setSpectrum(bands) {
      room.setSpectrum(bands);
    },
    setAudio(bass, mid, treble, level) {
      audio[0] = bass;
      audio[1] = mid;
      audio[2] = treble;
      audio[3] = level;
    },
  };
}

function smoothstep(x: number) {
  return x * x * (3 - 2 * x);
}

function easeInOut(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Dev-only readout (/?fps) to see what the quality governor is doing. */
function createFpsMeter() {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:999;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.6);color:#ffd59e;font:12px/1.4 monospace;pointer-events:none';
  document.body.append(el);
  return {
    update(fps: number, dpr: number, bloom: boolean, tier: number) {
      el.textContent = `${fps.toFixed(0)} fps · tier ${tier} · dpr ${dpr.toFixed(2)} · bloom ${bloom ? 'on' : 'off'}`;
    },
  };
}
