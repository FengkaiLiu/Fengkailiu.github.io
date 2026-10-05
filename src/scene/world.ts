// Full-screen WebGL world behind the page. Falls back to the CSS sky in base.css without WebGL.
// Plain WebGL on purpose: Three.js is ~130 KB gzipped and only needed later by the 3D chapters.
import fragmentShader from './world.frag.glsl?raw';

const vertexShader = /* glsl */ `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export interface World {
  /** Resolves after the shader compiles and the first frame is drawn. */
  ready: Promise<void>;
  /** Sunrise: animates from pre-dawn into the scroll-driven day. */
  powerOn(): void;
  /** Feed analyser bands, each 0..1 (wired in Floor 6). */
  setAudio(bass: number, mid: number, treble: number, level: number): void;
}

// The background is soft, so it renders below native resolution to save GPU.
const RENDER_SCALE = 0.7;
const MAX_DPR = 1.5;
// Time of day at the top of the page (morning) and at the bottom (night).
const DAY_START = 0.2;
const DAY_END = 1.0;
const SUNRISE_MS = 3200;

export function initWorld(): World | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) return null;
  gl.useProgram(program);

  // One oversized triangle covers the screen with no diagonal seam.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    time: loc('uTime'),
    res: loc('uRes'),
    pointer: loc('uPointer'),
    day: loc('uDay'),
    lift: loc('uLift'),
    spin: loc('uSpin'),
    audio: loc('uAudio'),
  };

  document.body.prepend(canvas);

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, MAX_DPR) * RENDER_SCALE;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);

  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = 1 - e.clientY / window.innerHeight;
    },
    { passive: true },
  );

  // Dev helper: /?day=0.8 previews any time of day.
  const debugDay = import.meta.env.DEV ? new URLSearchParams(location.search).get('day') : null;

  const scrollProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const audio = [0, 0, 0, 0];
  let time = 0;
  let spin = 0;
  let day = 0;
  let lift = 0;
  let bootStart = -1; // timestamp of powerOn, -1 while the gate is up
  let last = performance.now();
  let running = true;
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));
  let firstFrame = true;

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const motion = reducedMotion.matches ? 0.15 : 1;

    time += dt * motion;
    spin += dt * motion * (0.7 + audio[0] * 4);

    const ease = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;

    // Day follows scroll through a slow exponential ease, so a flick of the wheel
    // glides through the sky instead of jumping. Sunrise blends in after power-on.
    const boot = bootStart < 0 ? 0 : easeInOut(Math.min((now - bootStart) / SUNRISE_MS, 1));
    const scrolled = DAY_START + (DAY_END - DAY_START) * scrollProgress();
    const dayTarget = debugDay !== null ? Number(debugDay) : scrolled * boot;
    if (debugDay !== null) day = dayTarget;
    else day += (dayTarget - day) * (1 - Math.exp(-dt * (bootStart < 0 || boot >= 1 ? 1.6 : 8)));
    lift += (window.scrollY / window.innerHeight - lift) * (1 - Math.exp(-dt * 2.5));

    gl.uniform1f(u.time, time);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.day, day);
    gl.uniform1f(u.lift, lift);
    gl.uniform1f(u.spin, spin);
    gl.uniform4f(u.audio, audio[0], audio[1], audio[2], audio[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('is-ready');
      resolveReady();
    }
    requestAnimationFrame(frame);
  };

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });
  requestAnimationFrame(frame);

  return {
    ready,
    powerOn() {
      if (bootStart < 0) bootStart = performance.now();
    },
    setAudio(bass, mid, treble, level) {
      audio[0] = bass;
      audio[1] = mid;
      audio[2] = treble;
      audio[3] = level;
    },
  };
}

function easeInOut(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}
