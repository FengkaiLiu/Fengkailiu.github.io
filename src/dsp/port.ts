// A line-for-line JavaScript port of Fengkai's dsp.h (Digital Signal Processing and Analysis,
// Northeastern), so the bonus track's diagrams and "Listen" buttons run the same math as the C.
// Names, constants and quirks follow the C; the error codes are dropped (inputs here are always
// in range). Float32 where the C uses float, plain numbers where it uses double.

export const SR = 44100;
export type FadeType = 'linear' | 'equalloud' | 'sshape';

// ---------- Levels ----------
export const ampTodB = (amp: number) => (amp === 0 ? -130 : 20 * Math.log10(Math.abs(amp)));
export const dBToAmp = (dB: number) => Math.min(Math.max(10 ** (dB / 20), 0), 1);

export function reverse(i: Float32Array) {
  const o = new Float32Array(i.length);
  let left = 0;
  let right = i.length - 1;
  while (left <= right) {
    const a = i[left];
    const b = i[right];
    o[left] = b;
    o[right] = a;
    left++;
    right--;
  }
  return o;
}

export function gainChange(i: Float32Array, dBChange: number) {
  const g = 10 ** (dBChange / 20);
  return i.map((v) => v * g);
}

export function normalize(i: Float32Array, dBThreshold: number) {
  let max = 0;
  for (const v of i) if (Math.abs(v) > max) max = Math.abs(v);
  if (max <= 1e-8) return new Float32Array(i);
  const k = 10 ** (dBThreshold / 20) / max;
  return i.map((v) => v * k);
}

// ---------- Fades ----------
export function shapeIn(time: number, type: FadeType) {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  if (type === 'equalloud') return Math.sin(0.5 * Math.PI * time);
  if (type === 'sshape') return time * time * (3 - 2 * time);
  return time;
}

export function fadeIn(i: Float32Array, ms: number, type: FadeType) {
  const o = new Float32Array(i);
  const n = Math.min(Math.floor((ms * SR) / 1000), i.length);
  for (let k = 0; k < n; k++) o[k] = i[k] * shapeIn((k + 1) / n, type);
  return o;
}

export function fadeOut(i: Float32Array, ms: number, type: FadeType) {
  const o = new Float32Array(i);
  const n = Math.min(Math.floor((ms * SR) / 1000), i.length);
  const unChange = i.length - n;
  for (let k = 0; k < n; k++) o[unChange + k] = i[unChange + k] * (1 - shapeIn((k + 1) / n, type));
  return o;
}

// ---------- Oscillators ----------
const TWO_PI = 2 * Math.PI;

export function simpleSine(n: number, freq: number, amp: number) {
  const o = new Float32Array(n);
  const inc = (TWO_PI * freq) / SR;
  let phase = 0;
  for (let k = 0; k < n; k++) {
    o[k] = amp * Math.sin(phase);
    phase += inc;
    if (phase >= TWO_PI) phase -= TWO_PI;
  }
  return o;
}

export function simpleSquare(n: number, freq: number, amp: number) {
  const o = new Float32Array(n);
  const inc = (TWO_PI * freq) / SR;
  let phase = 0;
  for (let k = 0; k < n; k++) {
    o[k] = phase < Math.PI ? amp : -amp;
    phase += inc;
    if (phase >= TWO_PI) phase -= TWO_PI;
  }
  return o;
}

export function simpleTriangle(n: number, freq: number, amp: number) {
  const o = new Float32Array(n);
  const inc = freq / SR;
  let phase = 0;
  for (let k = 0; k < n; k++) {
    o[k] = amp * (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
    phase += inc;
    if (phase >= 1) phase -= 1;
  }
  return o;
}

/** Odd harmonics up to Nyquist: 1/n for the square, ±1/n² for the triangle. Returns how many were summed. */
export function additive(n: number, freq: number, gainDB: number, wave: 'square' | 'triangle') {
  const o = new Float32Array(n);
  const amp = dBToAmp(gainDB);
  let odd = 1;
  let sign = 1;
  let count = 0;
  while (freq * odd < SR / 2) {
    const inc = (TWO_PI * freq * odd) / SR;
    const c = wave === 'square' ? (4 / Math.PI) * (1 / odd) : (8 / (Math.PI * Math.PI)) * (sign / (odd * odd));
    let phase = 0;
    for (let k = 0; k < n; k++) {
      o[k] += amp * c * Math.sin(phase);
      phase += inc;
      if (phase >= TWO_PI) phase -= TWO_PI;
    }
    odd += 2;
    sign = -sign;
    count++;
  }
  return { out: o, harmonics: count, last: freq * (odd - 2) };
}

export function rampSine(n: number, f0: number, f1: number, gainDB: number) {
  const o = new Float32Array(n);
  const amp = dBToAmp(gainDB);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const f = f0 + (k / n) * (f1 - f0);
    o[k] = amp * Math.sin(phase);
    phase += (TWO_PI * f) / SR;
    if (phase >= TWO_PI) phase -= TWO_PI;
  }
  return o;
}

// ---------- Modulation ----------
/** Returns the output and the gain curve, so the diagram can draw the LFO itself. */
export function tremolo(i: Float32Array, startRate: number, endRate: number, depth: number) {
  const o = new Float32Array(i.length);
  const gains = new Float32Array(i.length);
  const d = Math.min(Math.max(depth, 0), 100) * 0.01;
  const alpha = (endRate - startRate) / Math.max(i.length - 1, 1);
  let phase = 0;
  for (let k = 0; k < i.length; k++) {
    const lfo = Math.min(Math.max(startRate + alpha * k, 0), 20);
    const mod = (Math.sin(phase) + 1) * 0.5;
    const g = 1 - d * mod;
    gains[k] = g;
    o[k] = i[k] * g;
    phase += (TWO_PI * lfo) / SR;
    if (phase >= TWO_PI) phase -= TWO_PI * Math.floor(phase / TWO_PI);
  }
  return { out: o, gains };
}

export function ampModulation(i: Float32Array, modFreq: number, modAmp: number) {
  const m = Math.min(Math.max(modAmp, 0), 1);
  const inc = (TWO_PI * modFreq) / SR;
  let phase = 0;
  return i.map((v) => {
    const env = 1 + m * Math.sin(phase);
    phase += inc;
    if (phase >= TWO_PI) phase -= TWO_PI * Math.floor(phase / TWO_PI);
    return v * env;
  });
}

export function ringModulation(i: Float32Array, modFreq: number, modAmp: number) {
  const m = Math.min(Math.max(modAmp, 0), 1);
  const inc = (TWO_PI * modFreq) / SR;
  let phase = 0;
  return i.map((v) => {
    const env = Math.cos(phase);
    phase += inc;
    if (phase >= TWO_PI) phase -= TWO_PI * Math.floor(phase / TWO_PI);
    return v * (m * env);
  });
}

/** The flanger's delay in ms for an LFO phase 0..1 (a triangle), as in dsp_flanger. */
export const flangerDelay = (p: number, depth: number) => {
  const minDelay = 1;
  const finalDelay = minDelay + Math.min(Math.max(depth, 0), 100) * 0.01 * 4;
  const lfo = 1 - 2 * Math.abs((p - Math.floor(p)) - 0.5);
  return minDelay + (finalDelay - minDelay) * lfo;
};

export function flanger(i: Float32Array, rate: number, depth: number, mix: number) {
  const o = new Float32Array(i.length);
  const wet = Math.min(Math.max(mix, 0), 100) * 0.01;
  const dry = 1 - wet;
  const inc = Math.min(Math.max(rate, 0), 20) / SR;
  let phase = 0;
  for (let k = 0; k < i.length; k++) {
    const delaySample = flangerDelay(phase, depth) * SR * 0.001;
    const read = k - delaySample;
    let w = 0;
    if (read > 0) {
      const i0 = Math.floor(read);
      const t = read - i0;
      const s0 = i0 >= 0 && i0 < i.length ? i[i0] : 0;
      const s1 = i0 + 1 < i.length ? i[i0 + 1] : s0;
      w = s0 + (s1 - s0) * t; // lerp
    }
    o[k] = dry * i[k] + wet * w;
    phase += inc;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return o;
}

// ---------- FIR ----------
const sinc = (v: number) => (Math.abs(v) < 1e-5 ? 1 : Math.sin(Math.PI * v) / (Math.PI * v));
export const blackman = (i: number, M: number) => (M <= 1 ? 1 : 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (M - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (M - 1)));

/** general_fir: windowed sinc, normalized to unity DC, spectrally inverted for the high-pass, then x0.707. */
export function generalFir(M: number, cutoff: number, hpf: boolean) {
  const c = new Float64Array(M);
  const half = (M - 1) / 2;
  const fc = cutoff / SR;
  for (let i = 0; i < M; i++) c[i] = 2 * fc * sinc(2 * fc * (i - half)) * blackman(i, M);
  let sum = 0;
  for (const v of c) sum += v;
  if (Math.abs(sum) > 1e-12) for (let i = 0; i < M; i++) c[i] /= sum;
  if (hpf) {
    for (let i = 0; i < M; i++) c[i] = -c[i];
    c[half] += 1;
  }
  for (let i = 0; i < M; i++) c[i] *= 0.707;
  return c;
}

export function convolve(i: Float32Array, h: Float64Array) {
  const o = new Float32Array(i.length);
  for (let n = 0; n < i.length; n++) {
    let acc = 0;
    const kMax = Math.min(h.length - 1, n);
    for (let k = 0; k <= kMax; k++) acc += i[n - k] * h[k];
    o[n] = acc;
  }
  return o;
}

const pow2 = (i: number) => {
  let p = 1;
  while (p < i) p <<= 1;
  return p;
};

/** In-place radix-2 FFT (inverse divides by N, like JUCE's). */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n);
}

/**
 * generateBandstopIR_IFFT. `centred: false` is dsp.h as written: the inverse FFT of a zero-phase
 * spectrum peaks at sample 0, where the Blackman window is zero, so the window removes the heart
 * of the filter. `centred: true` rotates the response to the middle of the taps first.
 */
export function bandstopIR(firSize: number, lo: number, hi: number, centred: boolean) {
  const N = centred ? pow2(firSize * 2) : pow2(firSize);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let k = 0; k <= N / 2; k++) {
    const f = (k * SR) / N;
    const m = f >= lo && f <= hi ? 0 : 1;
    re[k] = m;
    if (k > 0 && k < N - k) re[N - k] = m;
  }
  fft(re, im, true);
  const half = (firSize - 1) / 2;
  const ir = new Float64Array(firSize);
  for (let n = 0; n < firSize; n++) ir[n] = (centred ? re[(n - half + N) % N] : re[n] / N) * blackman(n, firSize);
  let sum = 0;
  for (const v of ir) sum += v;
  if (Math.abs(sum) > 0) for (let n = 0; n < firSize; n++) ir[n] /= sum;
  return ir;
}

// ---------- Biquad ----------
export function biquadCoeffs(cutoff: number, Q: number, hpf: boolean) {
  const K = Math.tan((2 * Math.PI * cutoff) / SR / 2);
  const W = K * K;
  const alpha = 1 + K / Q + W;
  const a1 = (2 * (W - 1)) / alpha;
  const a2 = (1 - K / Q + W) / alpha;
  const [b0, b1] = hpf ? [1 / alpha, -2 / alpha] : [W / alpha, (2 * W) / alpha];
  return { b0, b1, b2: b0, a1, a2 };
}

export function biquad(i: Float32Array, cutoff: number, Q: number, hpf: boolean) {
  const { b0, b1, b2, a1, a2 } = biquadCoeffs(cutoff, Q, hpf);
  const o = new Float32Array(i.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let n = 0; n < i.length; n++) {
    const x = i[n];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    o[n] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return o;
}

// ---------- Analysis helpers for the diagrams ----------
/** |H(f)| in dB of an FIR at frequency f. */
export function firResponse(h: Float64Array, f: number) {
  const w = (2 * Math.PI * f) / SR;
  let re = 0;
  let im = 0;
  for (let n = 0; n < h.length; n++) {
    re += h[n] * Math.cos(w * n);
    im -= h[n] * Math.sin(w * n);
  }
  return 20 * Math.log10(Math.hypot(re, im) + 1e-12);
}

/** |H(f)| in dB of a biquad, straight from its coefficients. */
export function biquadResponse(c: ReturnType<typeof biquadCoeffs>, f: number) {
  const w = (2 * Math.PI * f) / SR;
  const cr = (b: number, a1: number, a2: number) => [b + a1 * Math.cos(w) + a2 * Math.cos(2 * w), -(a1 * Math.sin(w) + a2 * Math.sin(2 * w))];
  const [nr, ni] = cr(c.b0, c.b1, c.b2);
  const [dr, di] = cr(1, c.a1, c.a2);
  return 20 * Math.log10(Math.hypot(nr, ni) / Math.hypot(dr, di) + 1e-12);
}

/** Magnitude spectrum in dB (Hann window), bins 0..N/2. */
export function spectrum(x: Float32Array, N: number, offset = 0) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let n = 0; n < N; n++) re[n] = (x[offset + n] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)));
  fft(re, im);
  const out = new Float32Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) out[k] = 20 * Math.log10((Math.hypot(re[k], im[k]) * 4) / N + 1e-9);
  return out;
}
