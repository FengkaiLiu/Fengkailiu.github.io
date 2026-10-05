// Procedural textures for the room: no image files needed except the project covers.
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, ShaderMaterial, TextureLoader, type Texture } from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Laptop screen: a code editor that keeps typing. The CS part of the room. */
export function codeScreen() {
  const { c, ctx } = canvas(1024, 640);
  const texture = toTexture(c);
  const lines: [string, string][][] = [
    [['#7f8bb3', '// fengkai.ts']],
    [['#c792ea', 'const '], ['#ffcb6b', 'me'], ['#89ddff', ' = {']],
    [['#f07178', '  major'], ['#89ddff', ': ['], ['#c3e88d', "'CS'"], ['#89ddff', ', '], ['#c3e88d', "'Music Tech'"], ['#89ddff', '],']],
    [['#f07178', '  loves'], ['#89ddff', ': ['], ['#c3e88d', "'DSP'"], ['#89ddff', ', '], ['#c3e88d', "'XR'"], ['#89ddff', ', '], ['#c3e88d', "'lofi'"], ['#89ddff', '],']],
    [['#f07178', '  status'], ['#89ddff', ': '], ['#c3e88d', "'building at 2am'"], ['#89ddff', ','],],
    [['#89ddff', '};']],
    [['#7f8bb3', '']],
    [['#c792ea', 'const '], ['#ffcb6b', 'fft'], ['#89ddff', ' = '], ['#82aaff', 'ctx.createAnalyser'], ['#89ddff', '();']],
    [['#ffcb6b', 'fft'], ['#89ddff', '.fftSize = '], ['#f78c6c', '2048'], ['#89ddff', ';']],
    [['#82aaff', 'requestAnimationFrame'], ['#89ddff', '(() => '], ['#82aaff', 'vibe'], ['#89ddff', '(fft));']],
  ];
  const total = lines.reduce((n, l) => n + l.reduce((m, [, s]) => m + s.length, 0), 0);
  let typed = Math.floor(total * 0.6); // start mid-thought so the screen reads at a glance
  let lastStep = 0;

  const draw = (now: number) => {
    ctx.fillStyle = '#141526';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1d1f36';
    ctx.fillRect(0, 0, c.width, 44);
    for (const [i, col] of ['#ff6b81', '#ffd166', '#6ee7a8'].entries()) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(28 + i * 26, 22, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '600 30px "JetBrains Mono Variable", monospace';
    let budget = typed;
    let cursor = { x: 40, y: 100 };
    lines.forEach((line, li) => {
      let x = 40;
      const y = 100 + li * 50;
      ctx.fillStyle = '#4b4f74';
      ctx.fillText(String(li + 1).padStart(2, ' '), 0, y);
      for (const [color, text] of line) {
        const shown = text.slice(0, Math.max(0, budget));
        budget -= text.length;
        ctx.fillStyle = color;
        ctx.fillText(shown, x + 30, y);
        x += ctx.measureText(shown).width;
        if (shown.length) cursor = { x: x + 30, y };
      }
    });
    if (Math.floor(now / 500) % 2 === 0) {
      ctx.fillStyle = '#ffcb6b';
      ctx.fillRect(cursor.x + 2, cursor.y - 26, 14, 32);
    }
    texture.needsUpdate = true;
  };

  return {
    texture,
    tick(now: number) {
      if (now - lastStep < 70) return;
      lastStep = now;
      typed = typed >= total + 40 ? 0 : typed + 1; // pause, then retype
      draw(now);
    },
  };
}

/** MIDI keyboard keys, seen from above. */
export function keysTexture() {
  const { c, ctx } = canvas(1024, 160);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, c.width, c.height);
  const white = 25;
  const kw = c.width / white;
  ctx.strokeStyle = '#b9b2a6';
  ctx.lineWidth = 3;
  for (let i = 0; i <= white; i++) {
    ctx.beginPath();
    ctx.moveTo(i * kw, 0);
    ctx.lineTo(i * kw, c.height);
    ctx.stroke();
  }
  ctx.fillStyle = '#1b1a24';
  for (let i = 0; i < white - 1; i++) {
    if ([2, 6].includes(i % 7)) continue;
    ctx.fillRect(i * kw + kw * 0.65, 0, kw * 0.7, c.height * 0.6);
  }
  return toTexture(c);
}

/** Record label: hand-lettered side A. */
export function vinylLabel() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#111014';
  ctx.fillRect(0, 0, 512, 512);
  for (let r = 250; r > 120; r -= 6) {
    ctx.strokeStyle = r % 12 ? '#1d1b23' : '#16141b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff8fb1';
  ctx.beginPath();
  ctx.arc(256, 256, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1830';
  ctx.textAlign = 'center';
  ctx.font = '700 44px "Caveat Variable", cursive';
  ctx.fillText('fengkai', 256, 236);
  ctx.font = '600 30px "Caveat Variable", cursive';
  ctx.fillText('side A', 256, 290);
  ctx.beginPath();
  ctx.arc(256, 256, 8, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

/** Warm wooden floor planks. */
export function floorTexture() {
  const { c, ctx } = canvas(512, 512);
  const plank = 64;
  for (let i = 0; i < 512 / plank; i++) {
    const tone = 0.85 + Math.random() * 0.2;
    ctx.fillStyle = `rgb(${Math.round(120 * tone)}, ${Math.round(78 * tone)}, ${Math.round(60 * tone)})`;
    ctx.fillRect(0, i * plank, 512, plank);
    ctx.fillStyle = 'rgba(40, 20, 15, 0.5)';
    ctx.fillRect(0, i * plank, 512, 3);
    const seam = Math.random() * 512;
    ctx.fillRect(seam, i * plank, 3, plank);
    for (let g = 0; g < 6; g++) {
      ctx.strokeStyle = `rgba(60, 35, 25, ${0.08 + Math.random() * 0.08})`;
      ctx.beginPath();
      const y = i * plank + 8 + Math.random() * (plank - 16);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 4, 340, y - 4, 512, y + 2);
      ctx.stroke();
    }
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

const loader = new TextureLoader();
export function loadImage(url: string): Promise<Texture> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 4;
        resolve(t);
      },
      undefined,
      () => resolve(placeholderPoster()),
    );
  });
}

function placeholderPoster() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#3a2f5c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#ffd59e';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.fillStyle = '#ffd59e';
  ctx.textAlign = 'center';
  ctx.font = '700 40px "Caveat Variable", cursive';
  ctx.fillText('your poster', 128, 120);
  ctx.fillText('here', 128, 165);
  return toTexture(c);
}
export { placeholderPoster };

/** The view outside: a rainy night city, with drops running down the glass. */
export function windowMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRain: { value: 1 },
      uSkyTop: { value: new Color('#0b0b24') },
      uSkyLow: { value: new Color('#3b2457') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uRain; // 0 clear night, 1 rain
      uniform vec3 uSkyTop;
      uniform vec3 uSkyLow;
      varying vec2 vUv;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

      void main() {
        vec2 uv = vUv;
        float t = uTime;

        // Drops on the glass bend the view behind them.
        vec2 g = uv * vec2(14.0, 9.0);
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float h = hash(id);
        float slide = fract(t * (0.03 + h * 0.05) + h);
        vec2 dropPos = vec2((hash(id + 2.0) - 0.5) * 0.6, 0.4 - slide * 0.8);
        float drop = uRain * step(0.6, h) * smoothstep(0.12, 0.06, length((f - dropPos) * vec2(1.0, 0.8)));
        vec2 bent = uv + (f - dropPos) * drop * 0.04;

        // Sky, moon, city.
        vec3 col = mix(uSkyLow, uSkyTop, smoothstep(0.1, 1.0, bent.y));
        vec2 moon = vec2(0.78, 0.8);
        float md = length((bent - moon) * vec2(1.4, 1.0));
        col += vec3(0.9, 0.9, 1.0) * smoothstep(0.075, 0.065, md);
        col += vec3(0.5, 0.45, 0.9) * exp(-md * 6.0) * 0.5;

        for (int layer = 0; layer < 3; layer++) {
          float fl = float(layer);
          float cx = bent.x * (6.0 + fl * 5.0) + fl * 3.7;
          float cid = floor(cx);
          float height = 0.18 + hash(vec2(cid, fl)) * (0.32 - fl * 0.07);
          if (bent.y < height) {
            vec3 b = mix(vec3(0.09, 0.06, 0.18), vec3(0.03, 0.02, 0.08), fl / 2.0);
            vec2 w = vec2(fract(cx) * 4.0, bent.y * (40.0 + fl * 20.0));
            float lit = step(0.72, hash(floor(w) + cid * 7.0 + fl)) * step(0.3, fract(w.x)) * step(0.35, fract(w.y));
            vec3 warm = mix(vec3(1.0, 0.7, 0.35), vec3(1.0, 0.45, 0.7), hash(floor(w) + 3.0));
            col = b + warm * lit * (0.9 - fl * 0.2);
          }
        }

        // Falling rain streaks.
        vec2 r = vec2(uv.x * 90.0 + uv.y * 6.0, uv.y * 2.5 + t * 2.2);
        float rid = floor(r.x);
        float streak = step(0.8, hash(vec2(rid, 1.0))) * smoothstep(0.08, 0.0, abs(fract(r.x) - 0.5) - 0.02)
                     * smoothstep(0.7, 1.0, fract(r.y + hash(vec2(rid, 2.0))));
        col += vec3(0.6, 0.65, 0.9) * streak * 0.25 * uRain;

        // Drop highlights.
        col += vec3(0.8, 0.85, 1.0) * drop * 0.18;
        col *= 1.15;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
