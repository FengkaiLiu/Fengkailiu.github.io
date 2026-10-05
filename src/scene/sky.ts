// Full-screen WebGL background. Falls back to the CSS sky in base.css if WebGL is unavailable.
// Plain WebGL on purpose: Three.js is ~130 KB gzipped and only needed later by the 3D chapters.
import fragmentShader from './sky.frag.glsl?raw';

const vertexShader = /* glsl */ `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export interface Sky {
  /** Feed analyser bands, each 0..1 (wired in Floor 6). */
  setAudio(bass: number, mid: number, treble: number, level: number): void;
  /** Override scroll progress (0..1), e.g. for a pinned section. Pass null to follow the page. */
  setScrollOverride(value: number | null): void;
}

// The background is soft, so it renders below native resolution to save GPU.
const RENDER_SCALE = 0.7;
const MAX_DPR = 1.5;

export function initSky(): Sky | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) return null;
  gl.useProgram(program);

  // One oversized triangle covers the screen with no diagonal seam.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {
    time: gl.getUniformLocation(program, 'uTime'),
    res: gl.getUniformLocation(program, 'uRes'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    scroll: gl.getUniformLocation(program, 'uScroll'),
    audio: gl.getUniformLocation(program, 'uAudio'),
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

  // Pointer and scroll ease toward their targets every frame so motion feels liquid.
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = 1 - e.clientY / window.innerHeight;
    },
    { passive: true },
  );

  let scrollOverride: number | null = null;
  if (import.meta.env.DEV) {
    // Dev helper: /?scroll=0.8 previews a depth without scrolling.
    const debug = new URLSearchParams(location.search).get('scroll');
    if (debug !== null) scrollOverride = Number(debug);
  }

  const pageProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? window.scrollY / max : 0;
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const audio = [0, 0, 0, 0];
  let time = 0;
  let scroll = 0;
  let last = performance.now();
  let running = true;
  let firstFrame = true;

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    time += dt * (reducedMotion.matches ? 0.15 : 1);
    const ease = 1 - Math.exp(-dt * 4);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    scroll += ((scrollOverride ?? pageProgress()) - scroll) * (1 - Math.exp(-dt * 6));

    gl.uniform1f(u.time, time);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.scroll, scroll);
    gl.uniform4f(u.audio, audio[0], audio[1], audio[2], audio[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('is-ready');
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
    setAudio(bass, mid, treble, level) {
      audio[0] = bass;
      audio[1] = mid;
      audio[2] = treble;
      audio[3] = level;
    },
    setScrollOverride(value) {
      scrollOverride = value;
    },
  };
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
