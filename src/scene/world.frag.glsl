// Liquid Aero background: sky + sea at the top of the page, diving underwater as you scroll.
// uAudio is wired in Floor 6 (x = bass, y = mid, z = treble, w = overall level).

precision highp float;

uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer; // 0..1, y up
uniform float uScroll; // 0..1 page progress
uniform vec4 uAudio;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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

// y: 0 at the horizon, 1 at the top of the frame
vec3 skyGradient(float y) {
  vec3 horizon = vec3(0.86, 0.97, 1.0);
  vec3 mid = vec3(0.24, 0.66, 0.96);
  vec3 top = vec3(0.03, 0.33, 0.76);
  vec3 c = mix(horizon, mid, smoothstep(0.0, 0.35, y));
  return mix(c, top, smoothstep(0.35, 1.0, y));
}

// Glossy Aero bubbles drifting upward. Returns brightness to add.
float bubbles(vec2 p, float t, float density, float speed) {
  float acc = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float scale = 5.0 + float(layer) * 4.0;
    vec2 q = p * scale + vec2(float(layer) * 7.3, -t * speed * (1.0 + float(layer) * 0.5));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id);
    if (h > density) {
      vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.5;
      off.x += sin(t * 0.8 + h * 20.0) * 0.08; // wobble
      float r = 0.1 + hash(id + 1.7) * 0.16;
      float d = length(f - off);
      float rim = smoothstep(r, r - 0.025, d) * smoothstep(r - 0.07, r - 0.02, d);
      float body = smoothstep(r, 0.0, d) * 0.12;
      float spec = smoothstep(r * 0.32, 0.0, length(f - off - vec2(-r * 0.4, r * 0.42)));
      acc += (rim * 0.55 + body + spec * 0.9) * (1.0 - float(layer) * 0.35);
    }
  }
  return acc;
}

vec3 surfaceScene(vec2 uv, vec2 p, float aspect, float horizon, vec2 ptr, float t) {
  float level = uAudio.w;
  vec3 col;

  vec2 sun = vec2(0.26 * aspect, horizon + 0.5) + (ptr - vec2(0.0, 0.5)) * vec2(0.05, 0.03);

  if (uv.y >= horizon) {
    // ---- Sky ----
    float sy = (uv.y - horizon) / 0.7;
    col = skyGradient(sy);

    float sd = length(p - sun);
    col += vec3(1.0, 0.96, 0.82) * (exp(-sd * 4.5) * 0.45 + exp(-sd * 24.0) * 0.9) * (1.0 + level * 0.8);

    vec2 cp = vec2(p.x * 1.3 + t * 0.012, sy * 3.0);
    float c = fbm(cp + fbm(cp * 0.7 + vec2(t * 0.02, 0.0)) * 0.7);
    float mask = smoothstep(0.45, 0.8, c) * smoothstep(0.0, 0.22, sy) * (1.0 - 0.55 * smoothstep(0.7, 1.1, sy));
    vec3 cloud = mix(vec3(0.74, 0.86, 0.98), vec3(1.0), smoothstep(0.5, 0.95, c + 0.25 - sd * 0.15));
    col = mix(col, cloud, mask * 0.85);

    col += bubbles(p + vec2(0.0, -horizon), t, 0.93, 0.05) * 0.35;
  } else {
    // ---- Sea ----
    float wy = horizon - uv.y;
    float persp = 1.0 / (wy + 0.035);
    vec2 wp = vec2(p.x * persp * 0.45, persp * 0.7);
    float w = fbm(wp * vec2(0.9, 1.5) + vec2(t * 0.03, -t * 0.35));

    vec3 shallow = vec3(0.08, 0.78, 0.9);
    vec3 deepSea = vec3(0.01, 0.4, 0.62);
    vec3 base = mix(shallow, deepSea, smoothstep(0.0, 0.32, wy));

    vec3 refl = skyGradient(clamp(wy * 1.6 + (w - 0.5) * 0.25, 0.0, 1.0));
    float fresnel = exp(-wy * 7.0) * 0.75;
    col = mix(base, refl, fresnel);
    col += (w - 0.5) * 0.12;

    float glint = pow(noise(wp * vec2(5.0, 9.0) + vec2(0.0, -t * 0.9)), 9.0);
    glint *= exp(-abs(p.x - sun.x) * (2.2 + wy * 4.0)) * smoothstep(0.0, 0.015, wy);
    col += vec3(1.0, 0.97, 0.88) * glint * (3.0 + level * 3.0);

    // Pointer ripples, flattened into perspective
    float d = length((p - ptr) * vec2(1.0, 2.6));
    col += sin(d * 60.0 - t * 5.0) * exp(-d * 8.0) * 0.06 * (1.0 + uAudio.x * 2.0);
  }

  // Bright haze line where sky meets sea
  col += vec3(0.95, 1.0, 1.0) * exp(-abs(uv.y - horizon) * 70.0) * 0.4;
  return col;
}

vec3 underwaterScene(vec2 uv, vec2 p, float t, float deep) {
  vec3 top = vec3(0.1, 0.7, 0.86);
  vec3 bot = mix(vec3(0.01, 0.2, 0.4), vec3(0.0, 0.05, 0.15), deep);
  top = mix(top, vec3(0.03, 0.36, 0.56), deep);
  vec3 col = mix(bot, top, pow(uv.y, 1.3));

  // God rays slanting down from the surface
  float rx = p.x + (1.0 - uv.y) * 0.3;
  float rays = smoothstep(0.55, 0.95, noise(vec2(rx * 5.0, t * 0.12))) * 0.6
             + smoothstep(0.6, 1.0, noise(vec2(rx * 11.0 + 4.0, t * 0.2))) * 0.4;
  col += vec3(0.55, 0.95, 1.0) * rays * pow(uv.y, 1.5) * (0.32 - deep * 0.18) * (1.0 + uAudio.y);

  // Caustic shimmer near the surface
  float ca = fbm(p * 5.0 + vec2(t * 0.15, t * 0.1));
  float caust = pow(1.0 - abs(sin(ca * 12.0)), 10.0);
  col += vec3(0.7, 1.0, 1.0) * caust * smoothstep(0.45, 1.0, uv.y) * 0.18 * (1.0 - deep);

  // Rising bubbles, more of them deeper down, pulsing with bass
  col += vec3(0.8, 0.97, 1.0) * bubbles(p, t, 0.86, 0.12) * (0.42 + uAudio.x * 0.5);

  // Drifting particles (marine snow)
  vec2 sp = p * 40.0 + vec2(t * 0.3, t * 0.6);
  float snow = step(0.985, hash(floor(sp))) * smoothstep(0.22, 0.0, length(fract(sp) - 0.5)) * 0.3;
  col += snow * (0.4 + deep);

  return col;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  vec2 ptr = vec2((uPointer.x - 0.5) * aspect, uPointer.y);
  float t = uTime;

  float dive = smoothstep(0.0, 0.32, uScroll);
  float deep = smoothstep(0.3, 1.0, uScroll);
  float horizon = mix(0.3, 1.08, dive);
  float under = smoothstep(0.7, 1.0, dive);

  vec3 col = vec3(0.0);
  if (under < 1.0) col = surfaceScene(uv, p, aspect, horizon, ptr, t);
  if (under > 0.0) col = mix(col, underwaterScene(uv, p, t, deep), under);

  // Soft vignette + dither to avoid gradient banding
  col *= 1.0 - 0.18 * pow(length(uv - 0.5) * 1.2, 2.0);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
