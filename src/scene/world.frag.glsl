// Resonance City: a solarpunk landscape seen through Frutiger Aero glass.
//
// uDay drives one full day as the page scrolls:
//   0.00 pre-dawn (startup gate)   0.14 dawn   0.35 noon   0.60 afternoon
//   0.78 golden hour               0.90 dusk   1.00 night (aurora)
// uAudio (Floor 6): x = bass, y = mid, z = treble, w = level. Bass spins the turbines,
// mid lifts the skyline (a live spectrum later), treble brightens the circuit pulses.

precision highp float;

uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer; // 0..1, y up
uniform float uDay;
uniform float uLift;   // scroll distance in viewport heights, eased
uniform float uSpin;   // turbine rotation, integrated on the CPU so bass can speed it up
uniform vec4 uAudio;

varying vec2 vUv;

#define PI 3.14159265

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), f);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Seven-stop keyframe through the day.
vec3 dayKey(float d, vec3 k0, vec3 k1, vec3 k2, vec3 k3, vec3 k4, vec3 k5, vec3 k6) {
  vec3 c = k0;
  c = mix(c, k1, smoothstep(0.0, 0.14, d));
  c = mix(c, k2, smoothstep(0.14, 0.35, d));
  c = mix(c, k3, smoothstep(0.35, 0.6, d));
  c = mix(c, k4, smoothstep(0.6, 0.78, d));
  c = mix(c, k5, smoothstep(0.78, 0.9, d));
  c = mix(c, k6, smoothstep(0.9, 1.0, d));
  return c;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Glossy Aero bubbles drifting upward.
float bubbles(vec2 p, float t, float density) {
  float acc = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 q = p * (4.0 + fl * 3.5) + vec2(fl * 7.3, -t * (0.05 + fl * 0.03));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id);
    if (h > density) {
      vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.5;
      off.x += sin(t * 0.7 + h * 20.0) * 0.08;
      float r = 0.1 + hash(id + 1.7) * 0.15;
      float d = length(f - off);
      float rim = smoothstep(r, r - 0.025, d) * smoothstep(r - 0.07, r - 0.02, d);
      float spec = smoothstep(r * 0.3, 0.0, length(f - off - vec2(-r * 0.4, r * 0.42)));
      acc += (rim * 0.5 + smoothstep(r, 0.0, d) * 0.1 + spec * 0.8) * (1.0 - fl * 0.35);
    }
  }
  return acc;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float t = uTime;
  float d = clamp(uDay, 0.0, 1.0);
  float px = 1.6 / uRes.y; // antialias width
  float lift = min(uLift, 2.5);
  vec2 sway = (uPointer - 0.5) * vec2(0.03, 0.01); // pointer parallax

  // ---------- Palette for this moment of the day ----------
  vec3 skyTop = dayKey(d,
    vec3(0.04, 0.10, 0.27), vec3(0.20, 0.42, 0.80), vec3(0.03, 0.39, 0.84), vec3(0.08, 0.46, 0.86),
    vec3(0.22, 0.36, 0.70), vec3(0.15, 0.14, 0.40), vec3(0.01, 0.03, 0.11));
  vec3 skyHor = dayKey(d,
    vec3(0.28, 0.34, 0.58), vec3(1.00, 0.80, 0.66), vec3(0.80, 0.94, 1.00), vec3(0.88, 0.97, 1.00),
    vec3(1.00, 0.80, 0.50), vec3(1.00, 0.55, 0.45), vec3(0.05, 0.14, 0.28));
  vec3 sunCol = dayKey(d,
    vec3(1.0, 0.6, 0.5), vec3(1.0, 0.82, 0.6), vec3(1.0, 0.98, 0.9), vec3(1.0, 0.96, 0.86),
    vec3(1.0, 0.78, 0.42), vec3(1.0, 0.5, 0.32), vec3(0.6, 0.7, 1.0));
  float light = dayKey(d,
    vec3(0.28), vec3(0.72), vec3(1.0), vec3(1.0), vec3(0.88), vec3(0.55), vec3(0.2)).x;
  float night = smoothstep(0.84, 0.98, d) + (1.0 - smoothstep(0.02, 0.12, d)) * 0.7;

  float horizon = 0.44 - lift * 0.05;

  // ---------- Sky ----------
  float sy = clamp((uv.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 col = mix(skyHor, skyTop, pow(sy, 0.6));

  // Sun travels right to left across the day.
  float arc = clamp((d - 0.04) / 0.84, 0.0, 1.0);
  vec2 sun = vec2(mix(0.42, -0.42, arc) * aspect, horizon - 0.1 + sin(arc * PI) * 0.62) + sway * 2.0;
  float sunUp = smoothstep(horizon - 0.06, horizon + 0.04, sun.y) * (1.0 - smoothstep(0.86, 0.95, d));
  float sd = length(p - sun);
  col += sunCol * (exp(-sd * 3.5) * 0.4 + exp(-sd * 9.0) * 0.35) * sunUp * (1.0 + uAudio.w * 0.6);
  col = mix(col, vec3(1.0, 0.99, 0.95), smoothstep(0.052, 0.042, sd) * sunUp);
  col += skyHor * exp(-abs(uv.y - horizon) * 14.0) * 0.25 * sunUp; // horizon bloom

  // Stars and moon at night.
  vec2 sp = floor(p * 160.0);
  float star = step(0.996, hash(sp)) * (0.6 + 0.4 * sin(t * 2.0 + hash(sp + 1.0) * 30.0));
  col += star * night * smoothstep(horizon + 0.1, 0.9, uv.y);
  vec2 moon = vec2(0.3 * aspect, 0.8);
  float md = length(p - moon);
  float moonDisc = smoothstep(0.038, 0.032, md) * (1.0 - smoothstep(0.03, 0.036, length(p - moon - vec2(0.016, 0.01))));
  col += (vec3(0.9, 0.95, 1.0) * moonDisc + vec3(0.4, 0.55, 1.0) * exp(-md * 10.0) * 0.25) * smoothstep(0.88, 0.97, d);

  // Aurora curtains: the night sky becomes a spectrogram in Floor 6.
  if (d > 0.82) {
    float a = smoothstep(0.86, 1.0, d);
    vec3 aur = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float band = 0.66 + fi * 0.07 + 0.06 * sin(p.x * (1.2 + fi * 0.4) + t * 0.12 + fi * 2.0) + (fbm(vec2(p.x * 1.5 + fi, t * 0.05)) - 0.5) * 0.12;
      float curtain = exp(-pow((uv.y - band) * (14.0 - fi * 3.0), 2.0)) * smoothstep(band - 0.12, band, uv.y + 0.02);
      float streak = 0.55 + 0.45 * noise(vec2(p.x * 26.0 + fi * 10.0, t * 0.3));
      vec3 hue = mix(vec3(0.2, 1.0, 0.6), vec3(0.3, 0.7, 1.0), fi * 0.5);
      hue = mix(hue, vec3(0.75, 0.4, 1.0), smoothstep(0.75, 0.9, uv.y) * 0.6);
      aur += hue * curtain * streak;
    }
    col += aur * a * 0.32 * (1.0 + uAudio.y);
  }

  // Puffy cumulus.
  vec2 cp = vec2(p.x * 1.7 + t * 0.012 + sway.x, uv.y * 4.2);
  float c = fbm(cp + fbm(cp * 0.8 + vec2(t * 0.012, 0.0)) * 0.6);
  float cmask = smoothstep(0.46, 0.72, c) * smoothstep(horizon + 0.04, horizon + 0.24, uv.y) * smoothstep(1.08, 0.72, uv.y);
  vec3 cloudLit = mix(vec3(1.0), sunCol, 0.35) * mix(0.25, 1.0, light);
  vec3 cloudShade = mix(skyTop, skyHor, 0.55) * mix(0.5, 0.92, light);
  col = mix(col, mix(cloudShade, cloudLit, smoothstep(0.48, 0.9, c)), cmask * (0.9 - night * 0.6));

  // Lens flare ghosts along the sun axis (very Aero).
  vec2 axis = vec2(0.0, 0.5) - sun;
  for (int i = 1; i <= 3; i++) {
    float k = float(i) * 0.38;
    float g = length(p - (sun + axis * k));
    float r = 0.02 + float(i) * 0.018;
    col += sunCol * smoothstep(r, r * 0.6, g) * 0.06 * sunUp * light;
  }

  // ---------- Landscape, far to near ----------
  vec3 haze = mix(skyHor, skyTop, 0.15);

  // Warm light at dawn and golden hour tints everything the sun touches.
  vec3 sunTint = mix(vec3(1.0), sunCol, 0.45);

  // Far hills: two hazy ridges, blue-green, fading into the horizon.
  float farY2 = horizon + 0.02 + (noise1(p.x * 1.4 + 9.0 + sway.x * 2.0) * 0.7 + noise1(p.x * 4.0 + 1.0) * 0.3) * 0.09;
  vec3 ridge2 = mix(haze, vec3(0.42, 0.68, 0.78) * light * sunTint, 0.38);
  col = mix(col, ridge2, smoothstep(farY2 + px, farY2 - px, uv.y));
  float farY = horizon + (noise1(p.x * 2.2 + 3.0 + sway.x * 4.0) * 0.6 + noise1(p.x * 6.0) * 0.4) * 0.07;
  vec3 ridge1 = mix(haze, vec3(0.3, 0.66, 0.52) * light * sunTint, 0.55);
  ridge1 = mix(ridge1, haze, smoothstep(farY - 0.08, farY, uv.y) * 0.25); // lighter at the crest
  col = mix(col, ridge1, smoothstep(farY + px, farY - px, uv.y));

  // Skyline: glass towers with roof gardens and balcony greenery.
  // Heights become a live spectrum analyzer in Floor 6.
  float base = horizon - 0.015 - lift * 0.08;
  float cx = (p.x + sway.x * 1.5) * 9.0;
  float cid = floor(cx);
  float cf = fract(cx);
  float ch = hash(vec2(cid, 3.0));
  if (ch > 0.3) {
    float w = 0.3 + 0.36 * hash(vec2(cid, 5.0));
    float th = 0.05 + ch * ch * 0.18 + 0.006 * sin(t * 0.8 + cid) + uAudio.y * 0.05 * hash(vec2(cid, 8.0));
    float dx = (cf - 0.5) / (w * 0.5);
    float r = w * 0.5 / 9.0 * mix(0.35, 1.0, hash(vec2(cid, 6.0))); // some domes, some soft corners
    float edge = max(abs(dx) - (1.0 - r * 9.0 / (w * 0.5)), 0.0) / (r * 9.0 / (w * 0.5));
    float top = base + th - r * (1.0 - sqrt(max(1.0 - edge * edge, 0.0)));
    float inX = smoothstep(1.0, 1.0 - 0.08 / w, abs(dx));
    float inY = smoothstep(top + px, top - px, uv.y);
    if (inX * inY > 0.0) {
      float v = clamp((uv.y - base) / th, 0.0, 1.0);
      // Glass reflects the sky (lighter low, deeper high) and lets some of it through.
      vec3 refl = mix(skyHor, skyTop, 0.25 + v * 0.6) * vec3(0.85, 0.97, 1.05);
      vec3 glass = mix(col, refl, 0.7) * mix(0.35, 1.05, light);
      glass += vec3(1.0) * smoothstep(0.16, 0.0, abs(dx + 0.5)) * 0.32 * light;  // vertical gloss stripe
      glass += vec3(1.0) * smoothstep(0.75, 1.0, abs(dx)) * 0.12;               // rim light
      glass -= vec3(0.06) * step(0.85, fract(uv.y * 70.0)) * light;               // floor lines
      // Balcony gardens: green tufts along the floors.
      vec2 bal = vec2(floor(cf * 5.0), floor(uv.y * 70.0));
      float garden = step(0.7, hash(bal + cid * 3.1)) * step(fract(uv.y * 70.0), 0.4);
      glass = mix(glass, vec3(0.35, 0.78, 0.3) * mix(0.25, 1.0, light) * sunTint, garden * 0.85);
      // Roof garden.
      glass = mix(glass, vec3(0.38, 0.82, 0.32) * mix(0.25, 1.0, light) * sunTint, smoothstep(top - 0.016, top - 0.01, uv.y));
      // Lit windows at night.
      vec2 win = floor(vec2(cf * 7.0, uv.y * 110.0));
      float lit = step(0.78, hash(win + cid)) * step(0.3, fract(uv.y * 110.0)) * night;
      glass += vec3(1.0, 0.8, 0.45) * lit * 0.7;
      glass = mix(glass, haze, 0.2 * light);
      col = mix(col, glass, inX * inY);
    }
  }

  // Mid hill
  float midY = horizon - 0.07 + sin(p.x * 2.2 + 1.0 + sway.x * 6.0) * 0.035 + sin(p.x * 5.1 + 2.0) * 0.012 - lift * 0.14;
  float midMask = smoothstep(midY + px, midY - px, uv.y);
  vec3 midCol = mix(vec3(0.45, 0.82, 0.3), vec3(0.2, 0.55, 0.2), smoothstep(midY, midY - 0.2, uv.y));
  midCol = midCol * mix(0.22, 1.0, light) * sunTint + skyHor * 0.12 * (1.0 - light * 0.5);
  midCol += vec3(1.0) * exp(-(midY - uv.y) * 60.0) * 0.18 * light; // glossy rim
  col = mix(col, midCol, midMask);

  // Wind turbines on the mid hill. Bass spins them faster.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float tx = (-0.36 + fi * 0.27 + (fi == 2.0 ? 0.12 : 0.0)) * aspect;
    float ground = horizon - 0.07 + sin(tx * 2.2 + 1.0 + sway.x * 6.0) * 0.035 + sin(tx * 5.1 + 2.0) * 0.012 - lift * 0.14;
    float scale = 1.0 - fi * 0.12;
    vec2 hub = vec2(tx + sway.x * 2.0, ground + 0.17 * scale);
    float dist = sdSegment(p, vec2(hub.x, ground - 0.01), hub) - 0.0032 * scale;
    float ang = uSpin * (1.0 + fi * 0.15) + fi * 2.0;
    for (int b = 0; b < 3; b++) {
      float a = ang + float(b) * 2.0944;
      vec2 tip = hub + vec2(cos(a), sin(a)) * 0.085 * scale;
      vec2 q = p - hub;
      float along = clamp(dot(q, tip - hub) / dot(tip - hub, tip - hub), 0.0, 1.0);
      dist = min(dist, sdSegment(p, hub, tip) - 0.0055 * scale * (1.0 - along * 0.75));
    }
    dist = min(dist, length(p - hub) - 0.007 * scale);
    vec3 turbine = vec3(0.97, 0.99, 1.0) * mix(0.3, 1.0, light);
    col = mix(col, turbine, smoothstep(px, -px, dist));
  }

  // Foreground hill with circuit-board roots under the grass (the CS layer).
  float fgY = 0.19 + sin(p.x * 1.4 - 0.7 + sway.x * 10.0) * 0.06 + sin(p.x * 3.3) * 0.015 - lift * 0.3;
  float fgMask = smoothstep(fgY + px, fgY - px, uv.y);
  if (fgMask > 0.0) {
    vec3 fg = mix(vec3(0.36, 0.78, 0.22), vec3(0.1, 0.42, 0.14), smoothstep(fgY, fgY - 0.35, uv.y));
    fg = fg * mix(0.18, 1.0, light) * sunTint;
    fg += vec3(1.0) * exp(-(fgY - uv.y) * 45.0) * 0.22 * light;                 // glossy rim
    fg += vec3(1.0) * smoothstep(0.3, 0.0, length((p - vec2(sun.x * 0.4, fgY - 0.05)) * vec2(0.5, 3.0))) * 0.08 * light; // broad sheen

    vec2 q = vec2(p.x + sway.x * 10.0, uv.y + lift * 0.3) * 24.0;
    vec2 id = floor(q);
    vec2 f = fract(q);
    float h = hash(id);
    float lineW = 0.07;
    float trace = 0.0;
    float pulse = 0.0;
    float ph = fract(t * (0.25 + hash(id + 9.0) * 0.4) + hash(id + 4.0));
    if (h < 0.34) {
      trace = smoothstep(lineW, lineW * 0.4, abs(f.y - 0.5));
      pulse = trace * smoothstep(0.18, 0.0, abs(f.x - ph));
    } else if (h < 0.58) {
      trace = smoothstep(lineW, lineW * 0.4, abs(f.x - 0.5));
      pulse = trace * smoothstep(0.18, 0.0, abs(f.y - ph));
    }
    float node = step(0.88, h) * smoothstep(0.2, 0.12, length(f - 0.5));
    float depthFade = smoothstep(fgY - 0.015, fgY - 0.06, uv.y);
    float glow = mix(0.12, 0.8, night);
    vec3 traceCol = mix(vec3(0.75, 1.0, 0.55), vec3(0.3, 1.0, 0.9), night);
    fg += traceCol * (trace * 0.35 + node * 0.6) * glow * depthFade;
    fg += vec3(0.6, 1.0, 1.0) * pulse * (0.5 + night + uAudio.z * 2.0) * depthFade;

    // Bioluminescent flora at night.
    vec2 fq = floor(vec2(p.x * 60.0, uv.y * 60.0));
    vec2 fqf = fract(vec2(p.x * 60.0, uv.y * 60.0)) - 0.5;
    float bloom = step(0.97, hash(fq + 2.0)) * smoothstep(0.35, 0.05, length(fqf)) * (0.6 + 0.4 * sin(t * 1.5 + hash(fq) * 20.0));
    fg += vec3(0.4, 1.0, 0.7) * bloom * night * 0.6;

    col = mix(col, fg, fgMask);
  }

  // Floating Aero bubbles / pollen.
  col += vec3(0.95, 1.0, 1.0) * bubbles(p + sway, t, 0.92) * mix(0.25, 0.4, light);

  // Vignette + dither against banding.
  col *= 1.0 - 0.2 * pow(length(uv - 0.5) * 1.15, 2.0);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
