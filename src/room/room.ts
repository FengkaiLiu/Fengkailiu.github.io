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

/** The final pass (tone mapping and sRGB) with the lofi finish, film grain and a vignette,
 * folded in: one fewer full-screen read and write per frame than a separate grain pass. */
function grainOutputPass() {
  const pass = new OutputPass();
  pass.uniforms.uTime = { value: 0 };
  pass.material.fragmentShader = pass.material.fragmentShader
    .replace(
      'varying vec2 vUv;',
      /* glsl */ `varying vec2 vUv;
      uniform float uTime;
      float grainHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`,
    )
    .replace(
      /}\s*$/,
      /* glsl */ `
      gl_FragColor.rgb += (grainHash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * 0.045;
      gl_FragColor.rgb *= mix(0.62, 1.0, smoothstep(1.0, 0.3, length(vUv - 0.5) * 1.3));
    }`,
    );
  return pass;
}

export function initRoom(
  sections: { el: HTMLElement; shot: string }[],
  covers: Record<string, string>,
  /** Recordings to show on a project's poster while its chapter is in focus. */
  videos: Record<string, HTMLVideoElement> = {},
  shelfBoat?: string,
): Room | null {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
    { megapixels: 3.2, msaa: 4, bloom: true, bloomScale: 1, fx: 'full' },
    { megapixels: 2.2, msaa: 4, bloom: true, bloomScale: 1, fx: 'full' },
    { megapixels: 1.6, msaa: 0, bloom: true, bloomScale: 0.5, fx: 'lite' },
    { megapixels: 1.15, msaa: 0, bloom: true, bloomScale: 0.5, fx: 'lite' },
    { megapixels: 0.85, msaa: 0, bloom: false, bloomScale: 0.5, fx: 'min' },
    { megapixels: 0.6, msaa: 0, bloom: false, bloomScale: 0.5, fx: 'min' },
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

  const room = buildRoom(covers, videos, shelfBoat);
  scene.add(room.root);

  // ---------- Post-processing ----------
  const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const BLOOM_STRENGTH = 0.7;
  const bloom = new UnrealBloomPass(new Vector2(1, 1), BLOOM_STRENGTH, 0.42, 0.9);
  // Bright things fade out of the glow at the screen's border. The blur repeats edge pixels,
  // so the lamp crossing the edge (scrolling toward the laptop) flared into a big smear.
  bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
    /}\s*$/,
    /* glsl */ `
      vec2 edge = smoothstep(0.0, 0.06, vUv) * smoothstep(1.0, 0.94, vUv);
      gl_FragColor.rgb *= edge.x * edge.y;
    }`,
  );
  // The glow eases in and out when a tier turns it on or off, instead of popping.
  let bloomLevel = 1;
  // Bloom blurs at half the render size; cheaper tiers blur at a quarter (a soft glow hides it).
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(w * tiers[tier].bloomScale, h * tiers[tier].bloomScale);
  composer.addPass(bloom);
  const grain = grainOutputPass();
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
    if (!reducedMotion.matches) desired.pos.y += Math.sin(t * Math.PI) * 0.45; // a gentle dolly arc between shots
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
  const debugLit = import.meta.env.DEV && new URLSearchParams(location.search).has('lit');
  let lightsStart = debugLit ? -LIGHTS_ON_MS : -1;
  let last = performance.now();
  let running = true;
  let resolveFirst!: () => void;
  const firstFrame = new Promise<void>((r) => (resolveFirst = r));
  let drawn = false;
  // Compile every shader the room will ever need (song scenes, posters playing video) before
  // the gate opens. Each one compiled mid-scroll froze the page for up to a second on some GPUs.
  let warming = true;
  const warm = Promise.all([room.ready, firstFrame])
    .then(async () => {
      // Programs depend on where they draw: the composer's buffer, not the screen.
      renderer.setRenderTarget(composer.readBuffer);
      const done = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(null);
      await done;
      // A shader's first draw still stalls on some drivers (ANGLE on Direct3D), so draw
      // everything once offscreen, hidden and out-of-view things included.
      const restore: (() => void)[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          o.visible = true;
          restore.push(() => (o.visible = false));
        }
        if (o.frustumCulled) {
          o.frustumCulled = false;
          restore.push(() => (o.frustumCulled = true));
        }
      });
      renderer.setRenderTarget(composer.readBuffer);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      for (const undo of restore) undo();
      pickStartTier();
    })
    .catch(() => {})
    .finally(() => (warming = false));

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
    document.documentElement.dataset.fx = t.fx;
    resize();
  };
  document.documentElement.dataset.fx = tiers[tier].fx;
  // Dev helper: /?tier=3 locks a quality tier (the governor and the start-up timing stand down).
  const benchTier = import.meta.env.DEV ? new URLSearchParams(location.search).get('tier') : null;
  if (benchTier !== null) applyTier(Number(benchTier));

  // Where to start: the tier this GPU settled on last visit, or else a quick timing behind the
  // gate. Starting at the top made weak GPUs crawl for seconds before the governor caught up.
  const gpuName = (() => {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  })();
  const TIER_KEY = 'room-tier';
  const rememberTier = () => {
    try {
      localStorage.setItem(TIER_KEY, JSON.stringify({ gpu: gpuName, tier }));
    } catch {
      // storage blocked: just measure again next time
    }
  };
  const rememberedTier = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(TIER_KEY) ?? 'null') as { gpu: string; tier: number } | null;
      return saved?.gpu === gpuName && tiers[saved.tier] ? saved.tier : null;
    } catch {
      return null;
    }
  };
  /** GPU time of one frame: draw, then read a pixel back, which waits for the GPU to finish. */
  const frameMs = () => {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    const times: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      composer.render(0);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
    }
    times.shift(); // the first draw at a new size also allocates its buffers
    return times.sort((a, b) => a - b)[1];
  };
  const pickStartTier = () => {
    if (benchTier !== null) return;
    const saved = rememberedTier();
    if (saved !== null) {
      applyTier(saved);
      return;
    }
    // Timed at tier 2; each step up costs roughly 1.5x, each step down saves about 0.7x.
    // The room may take about 9 ms of the frame, leaving room for the page drawn over it.
    applyTier(2);
    const ms = frameMs();
    const budget = 9;
    const start = ms < budget * 0.4 ? 0 : ms < budget * 0.65 ? 1 : ms < budget ? 2 : ms < budget * 1.4 ? 3 : ms < budget * 1.9 ? 4 : 5;
    applyTier(start);
    rememberTier();
  };
  const governQuality = (now: number, dt: number) => {
    if (benchTier !== null) return;
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
      rememberTier();
      gov.goodStreak = 0;
    } else if (fps > 57) {
      // Climb only after sustained headroom, and never back into a tier that failed.
      gov.goodStreak++;
      if (gov.goodStreak >= 5 && tier > 0 && !failed.has(tier - 1)) {
        applyTier(tier - 1);
        rememberTier();
        gov.goodStreak = 0;
      }
    } else {
      gov.goodStreak = 0;
    }
    fpsMeter?.update(fps, dpr, bloom.enabled, tier);
  };

  // ---------- Resting ----------
  // While nothing moves (no input for a moment, the camera settled, no music), the room draws
  // at 30 fps instead of every display refresh. Dust, rain and grain still drift, for half the
  // GPU work and battery on any device; the next input brings back the full rate at once.
  const REST_AFTER = 2500;
  const REST_FRAME = 1000 / 30;
  let lastInput = performance.now();
  let lastDrawn = 0;
  let playing = false;
  let settled = false;
  const wake = () => (lastInput = performance.now());
  for (const type of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'touchmove', 'scroll', 'resize']) {
    window.addEventListener(type, wake, { passive: true });
  }

  const loop = (now: number) => {
    if (!running) return;
    const resting = settled && !playing && drawn && !warming && now - lastInput > REST_AFTER;
    if (resting && now - lastDrawn < REST_FRAME - 4) {
      requestAnimationFrame(loop);
      return;
    }
    lastDrawn = now;
    // The game console covers the room with a dark backdrop: hold the last frame and give
    // the GPU to the game. (The governor skips these frames too, so it isn't fooled.)
    if (document.documentElement.classList.contains('has-console')) {
      last = now;
      requestAnimationFrame(loop);
      return;
    }
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
    if (!reducedMotion.matches) camera.position.addScaledVector(right, pointer.x * 0.12).addScaledVector(up, -pointer.y * 0.08);
    camera.lookAt(lookAt);
    settled = basePos.distanceToSquared(desired.pos) < 1e-6 && lookAt.distanceToSquared(desired.target) < 1e-6 && (lit === 1 || lit === 0);

    // Frame the subject off-center on wide screens so the text card fits beside it.
    frame += (desired.frame - frame) * k;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The wider the screen, the less the room needs shifting to clear the (left-pinned) text.
    const wideFrame = Math.max(frame - 0.19 * Math.max(w / h - 1.25, 0), 0);
    if (w > 820) camera.setViewOffset(w, h, -wideFrame * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);

    room.tick(now, dt, audio, camera.position, moods.tint, breathe);
    bloomLevel += ((tiers[tier].bloom ? 1 : 0) - bloomLevel) * (1 - Math.exp(-dt * 6));
    bloom.strength = BLOOM_STRENGTH * bloomLevel;
    bloom.enabled = tiers[tier].bloom || bloomLevel > 0.01;
    grain.uniforms.uTime.value = now / 1000;
    // While shaders warm up (behind the gate), hold the first frame: drawing now would wait on them.
    if (!warming || !drawn) composer.render(dt);
    // Resting frames are slow on purpose: the governor sits them out.
    if (resting) gov.frames = gov.time = 0;
    else if (!warming) governQuality(now, dt);

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
    for (const hit of raycaster.intersectObjects([room.root, room.pickRoot], true)) {
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
  let hoverFrame = 0;
  // Hover (and dragging across the keys) is resolved at most once per frame, and only when the
  // pointer actually moved.
  window.addEventListener(
    'pointermove',
    (e) => {
      pendingMove = e;
      hoverFrame ||= requestAnimationFrame(hover);
    },
    { passive: true },
  );
  const hover = () => {
    hoverFrame = 0;
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
  };
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
    ready: warm.then(() => undefined),
    lightsOn() {
      if (lightsStart === -1) lightsStart = performance.now();
    },
    setRain(on) {
      room.setRain(on);
    },
    setPlaying(on) {
      playing = on;
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
