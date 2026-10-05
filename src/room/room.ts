// The 3D bedroom behind the page: renderer, lights, post-processing, and the
// scroll-driven camera that glides from object to object.
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
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
import { buildRoom } from './props';
import { DEFAULT_FRAME, shots, type Shot } from './shots';

export interface Room {
  /** Resolves when textures are loaded and the first frame is drawn. */
  ready: Promise<void>;
  /** Flip the lamp on: lights fade up, the record starts spinning. */
  lightsOn(): void;
  /** Feed analyser bands, each 0..1 (wired in Floor 6). */
  setAudio(bass: number, mid: number, treble: number, level: number): void;
  setRain(on: boolean): void;
}

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
  const maxDpr = Math.min(window.devicePixelRatio, MAX_DPR);
  let dpr = maxDpr;
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
  scene.background = new Color('#130f26');

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
  scene.add(hemi, moon, lampSpot, lampSpot.target, lampFill, fairyFill, posterLight, screenGlow);

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
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    // Portrait screens see less sideways; widen the lens so the room still fits.
    camera.fov = camera.aspect < 1 ? 42 : 34;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ---------- Scroll-driven camera ----------
  const vec = (v: [number, number, number]) => new Vector3(...v);
  const keyframes = sections.map((s) => {
    const shot: Shot = shots[s.shot] ?? shots.hero;
    return { el: s.el, pos: vec(shot.pos), target: vec(shot.target), frame: shot.frame ?? DEFAULT_FRAME };
  });

  const desired = { pos: new Vector3(), target: new Vector3(), frame: DEFAULT_FRAME };
  // On portrait screens, back the camera away from its subject so the shot still fits.
  const portraitPullback = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect >= 1) return;
    const k = Math.min(0.85 / aspect, 1.9);
    desired.pos.sub(desired.target).multiplyScalar(k).add(desired.target);
  };
  // Dev helper: /?shot=sonare frames one shot without scrolling.
  const debugShot = import.meta.env.DEV ? new URLSearchParams(location.search).get('shot') : null;
  const sampleScroll = () => {
    if (debugShot && shots[debugShot]) {
      const s = shots[debugShot];
      desired.pos.set(...s.pos);
      desired.target.set(...s.target);
      desired.frame = s.frame ?? DEFAULT_FRAME;
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
  // Every couple of seconds, measure the frame rate. Too slow: render fewer pixels,
  // and as a last resort drop bloom. Lots of headroom: step back up. This keeps the
  // room smooth on weak laptops and sharp on strong ones.
  const fpsMeter = import.meta.env.DEV && new URLSearchParams(location.search).has('fps') ? createFpsMeter() : null;
  const gov = { frames: 0, time: 0, startAt: 0, cooldownUntil: 0 };
  // Cheapest visual losses first; resolution (which blurs text) drops last.
  const tiers = [
    { dpr: maxDpr, msaa: 4, bloom: true },
    { dpr: Math.min(maxDpr, 1.25), msaa: 4, bloom: true },
    { dpr: Math.min(maxDpr, 1.25), msaa: 0, bloom: true },
    { dpr: Math.min(maxDpr, 1.0), msaa: 0, bloom: true },
    { dpr: Math.min(maxDpr, 1.0), msaa: 0, bloom: false },
    { dpr: MIN_DPR, msaa: 0, bloom: false },
  ];
  let tier = 0;
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
    if (Math.abs(t.dpr - dpr) > 0.01) {
      dpr = t.dpr;
      renderer.setPixelRatio(dpr);
      composer.setPixelRatio(dpr);
      resize();
    }
  };
  const governQuality = (now: number, dt: number) => {
    if (!gov.startAt) gov.startAt = now + 2500; // ignore the shader-compile hitch at startup
    if (now < gov.startAt) return;
    gov.frames++;
    gov.time += dt;
    if (gov.time < 2) return;
    const fps = gov.frames / gov.time;
    gov.frames = 0;
    gov.time = 0;
    if (fps < 45 && tier < tiers.length - 1) {
      applyTier(tier + 1);
      gov.cooldownUntil = now + 8000;
    } else if (fps > 58 && now > gov.cooldownUntil && tier > 0) {
      applyTier(tier - 1);
      gov.cooldownUntil = now + 4000;
    }
    fpsMeter?.update(fps, dpr, bloom.enabled, tier);
  };

  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    // Lights fade up after the switch.
    const lit = lightsStart === -1 ? 0 : easeInOut(Math.min((now - lightsStart) / LIGHTS_ON_MS, 1));
    hemi.intensity = 0.42 + lit * 0.25;
    lampSpot.intensity = lit * 3.6;
    lampFill.intensity = lit * 2.2;
    fairyFill.intensity = lit * 3.4;
    posterLight.intensity = lit * 2.6;
    screenGlow.intensity = lit * 1.1;
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
    if (w > 820) camera.setViewOffset(w, h, -frame * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);

    room.tick(now, dt, audio);
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

  return {
    ready: Promise.all([room.ready, firstFrame]).then(() => undefined),
    lightsOn() {
      if (lightsStart === -1) lightsStart = performance.now();
    },
    setRain(on) {
      room.setRain(on);
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
