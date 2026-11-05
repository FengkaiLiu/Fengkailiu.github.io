// dsp.h, routine by routine: each chapter quotes the core lines of one routine from Fengkai's
// C library (Digital Signal Processing and Analysis, Northeastern) next to a live diagram drawn by
// a port of the same math (src/dsp/port.ts). "Listen" runs it on a short sound and plays the
// result on the room's turntable. Mounted into the bonus track on demand; dispose() stops it all.
import * as D from '../dsp/port';
import type { Player, GuestSlot } from '../audio/player';
import { getAudio, unlockAudio } from '../audio/context';
import { getMusicBus } from '../audio/bus';
import { tr } from '../i18n';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A small C highlighter: comments, numbers, keywords, and the library's own calls. */
function highlight(code: string) {
  const re = /(\/\/.*$)|\b(\d+(?:\.\d+)?(?:f|LL)?)\b|\b(float|double|int|short|long|static|const|return|for|while|if|else|switch|case|default|true|false)\b|\b(sin|cos|sinf|cosf|tan|powf|fabsf|fabs|log10f|floorf|lerp|sincFunction|blackManWindow|dsp_shapeIn|std|complex|juce|perform)\b/gm;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 'n' : m[3] ? 'k' : 't';
    out += `<span class="tok-${cls}">${esc(m[0])}</span>`;
    last = m.index! + m[0].length;
  }
  return out + esc(code.slice(last));
}

// ---------- The code, quoted from dsp.h ("// ..." marks lines left out) ----------
const CODE = {
  levels: `return 20.0f * log10f(fabs(amp));        // ampTodB
float ampResult = powf(10.0, dB / 20.0); // dBToAmp

// dsp_normalize
float max = 0.0;
for (int i = 0; i < iNumSamples; ++i){
    float abs = fabsf(iAudioPtr[i]);
    if (abs > max) {
        max = abs;
    }
}
// ...
for (int i = 0; i < iNumSamples; ++i) {
    float outPut = iAudioPtr[i] * (powf(10.0, dBThreshold / 20.0) / max);

    oAudioPtr[i] = outPut;
}`,
  reverse: `int left = 0;
int right = iNumSamples - 1;

while (left <= right) { // use <= instead of < to avoid the middle of the sample value be 0/garbage
    float a = iAudioPtr[left];
    float b = iAudioPtr[right];
    oAudioPtr[left] = b;
    oAudioPtr[right] = a;
    left++;
    right--;
}`,
  fades: `switch (fadeType) {
case FADE_TYPE_LINEAR:
    return time;
case FADE_TYPE_EQUALLOUD:
    return sinf(0.5f * (float)M_PI * time);
case FADE_TYPE_SSHAPE: {
    float timeSquare = time * time;
    return timeSquare * (3.0f - (2.0f * time));
}
// ...
float inverse = 1.0f / (float)sample;

for (int i = 0; i < sample; ++i) {
    float time = (i + 1) * inverse;
    float theType = dsp_shapeIn(time, fadeType);
    oAudioPtr[i] = iAudioPtr[i] * theType;
}`,
  naiveSquare: `const double phaseInc = two_pi * (double)freq / (double)sampleRate;

double phase = 0.0;
for (int i = 0; i < nSamples; ++i) {
    oAudioPtr[i] = (phase < M_PI) ? amp : -amp;
    dsp_Pi_Calculator(&phase, phaseInc, two_pi);
}`,
  naiveTriangle: `const double phaseInc = (double)freq / (double)sampleRate;
double phase = 0.0;

for (int i = 0; i < nSamples; ++i) {
    double triangle = (phase < 0.5) ? ((4.0 * phase) - 1.0) : (3.0 - (4.0 * phase));
    oAudioPtr[i] = (float)((double)amp * triangle);

    phase += phaseInc;
    if (phase >= 1.0) phase -= 1.0;
}`,
  additiveSquare: `int odd = 1;
while ((freq * odd) < (sampleRate / 2.0)) {
    double harmonyIncrease = two_Pi * (freq * odd) / (double)sampleRate;
    double phase = 0.0;
    float coefficient = (4.0f / (float)M_PI) * (1.0f / (float)odd);

    for (int i = 0; i < nSamples; ++i) {
        oAudioPtr[i] += amp * coefficient * sin(phase);
        phase += harmonyIncrease;
        if (phase >= two_Pi) phase -= two_Pi;
    }

    odd += 2;
}`,
  additiveTriangle: `int odd = 1;
int sign = 1;
while ((freq * odd) < (sampleRate / 2.0)) {
    double harmonyIncrease = two_Pi * (freq * odd) / (double)sampleRate;
    double phase = 0.0;
    float coefficient = (8.0f / ((float)M_PI * (float)M_PI)) * (sign / ((float)odd * (float)odd));

    for (int i = 0; i < nSamples; ++i) {
        oAudioPtr[i] += amp * coefficient * sin(phase);
        phase += harmonyIncrease;
        if (phase >= two_Pi) phase -= two_Pi;
    }

    odd += 2;
    sign = -sign;
}`,
  chirp: `for (int i = 0; i < nSamples; ++i) {

    float time = (float)i / (float)nSamples;
    float currentFreq = startingFreq + time * (endingFreq - startingFreq);

    double phaseInc = two_pi * (double)currentFreq / (double)sampleRate;

    oAudioPtr[i] = (float)(amp * sin(phase));
    phase += phaseInc;
    //prevent imprecise
    if (phase >= two_pi)
        phase -= two_pi;
}`,
  tremolo: `const float alpha = (lfoEndRate - lfoStartRate) / (float)denom;

for (int n = 0; n < iNumSamples; ++n) {
    // Current LFO
    float currentLFO = lfoStartRate + alpha * (float)n;
    // ...
    const double phaseInc = two_pi * (double)currentLFO / (double)sampleRate;

    // Make LFO in [0,1]
    const float modValueLFO = (sinf((float)phase) + 1.0f) * 0.5f;

    const float gain = 1.0f - (DepthConvert * modValueLFO);

    oAudioPtr[n] = iAudioPtr[n] * gain;

    phase += phaseInc;
    // ...
}`,
  am: `double phaseInc = (two_pi * (double)modFrequency) / (double)sampleRate;

double phase = 0.0;
for (int n = 0; n < iNumSamples; ++n) {
    float envelop = 1.0f + (modAmplitude * sinf(phase));
    oAudioPtr[n] = iAudioPtr[n] * envelop;

    phase += phaseInc;
    // ...
}`,
  rm: `double phaseInc = (two_pi * (double)modFrequency) / (double)sampleRate;

double phase = 0.0;
for (int n = 0; n < iNumSamples; ++n) {
    float envelop = cosf(phase);
    oAudioPtr[n] = iAudioPtr[n] * (modAmplitude * envelop);

    phase += phaseInc;
    // ...
}`,
  flanger: `double p = phase - (long long)phase;
float lfo = 1.0f - 2.0f * fabsf((float)p - 0.5f);
float delay = minDelay + (finalDelay - minDelay) * lfo;
float delaySample = delay * (float)sampleRate * 0.001f;

float wetPointer = 0.0f;
float readPointer = (float)i - delaySample;
// ...
int index0 = (int)floorf(readPointer);
int index1 = index0 + 1;
float delayTime = readPointer - (float)index0;
// ...
wetPointer = (float)lerp(safe0, safe1, delayTime);
// ...
oAudioPtr[i] = (dryMix * iAudioPtr[i]) + (wetMix * wetPointer);`,
  fir: `//sinc * window
for (int i = 0; i < M; ++i) {
    double x = (double)(i - halfOrder);
    double sincFunc = 2.0 * pfCutOff * sincFunction(2.0 * pfCutOff * x);
    double window = blackManWindow(i, M);
    coeff[i] = sincFunc * window;
}
// ... normalize so the coefficients sum to 1 ...

//Pass Filter switch : lpf -> 0 , hpf -> 1
if (passfilter == 1) {
    for (int i = 0; i < M; ++i)
        coeff[i] = -coeff[i];

    coeff[halfOrder] += 1.0;
}

//reduce clipping
const double overallGain = 0.707;`,
  bandstop: `for (int k = 0; k <= nyquistBin; ++k)
{
    float freqHz = (float)k * (float)sampleRate / (float)fftSize;

    // default = pass
    float binMag = 1.0f;

    // zero out the stopband
    if (freqHz >= lowerHz && freqHz <= upperHz)
        binMag = 0.0f;

    // positive frequency bin
    freqDomain[k] = std::complex<float>(binMag, 0.0f);

    // mirror to negative frequency bin (conjugate symmetry)
    if (k > 0 && k < fftSize - k)
        freqDomain[fftSize - k] = std::complex<float>(binMag, 0.0f);
}

juce::dsp::FFT fft((int)std::log2(fftSize));
fft.perform(freqDomain.data(), timeDomain.data(), true); // true = inverse
// ...
for (int n = 0; n < numTaps; ++n)
{
    double value = 0.0;
    if (n < fftSize)
        value = (double)timeDomain[n].real() * invFftSize;

    double w = blackManWindow(n, numTaps);
    irOut[n] = value * w;
}`,
  biquad: `// 2 * pi * fc / fs
double theta_c = 2.0 * M_PI * cutoffHz / (double)sampleRate;
// tan(theta_c / 2)
double K = tan(theta_c / 2.0);
double W = K * K;
// 1 + K/Q + W
double alpha = 1.0 + (K / Q) + W;
// ...
a1 = 2.0 * (W - 1.0) / alpha;
a2 = (1.0 - (K / Q) + W) / alpha;

if (filterType == DSP_FILTER_LPF) {
    b0 = W / alpha;
    b1 = 2.0 * W / alpha;
    b2 = b0;
}
else {
    b0 = 1.0 / alpha;
    b1 = -2.0 / alpha;
    b2 = b0;
}
// ...
double y_n = (b0 * x_n) + (b1 * xn_1) + (b2 * xn_2) - (a1 * yn_1) - (a2 * yn_2);`,
};

// ---------- Test sounds (2 s at 44.1 kHz, like the C's own sample rate) ----------
const LEN = 2 * D.SR;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const cache: Record<string, Float32Array> = {};
const once = (key: string, make: () => Float32Array) => (cache[key] ??= make());

/** A plucked arpeggio (Karplus-Strong), A minor 7 rising. */
const pluck = () =>
  once('pluck', () => {
    seed = 7;
    const o = new Float32Array(LEN);
    for (const [t, m] of [[0, 57], [0.28, 60], [0.56, 64], [0.84, 67], [1.12, 72]]) {
      const L = Math.round(D.SR / (440 * 2 ** ((m - 69) / 12)));
      const buf = Float32Array.from({ length: L }, rnd);
      let idx = 0;
      for (let k = Math.floor(t * D.SR); k < LEN; k++) {
        const a = buf[idx];
        buf[idx] = 0.996 * 0.5 * (a + buf[(idx + 1) % L]);
        idx = (idx + 1) % L;
        o[k] += a * 0.3;
      }
    }
    return D.normalize(o, -14);
  });

/** A held A major chord of raw sawtooths: plenty of harmonics for filters and modulation. */
const saw = () =>
  once('saw', () => {
    const o = new Float32Array(LEN);
    for (const f of [110, 138.59, 164.81, 220]) {
      let p = 0;
      for (let k = 0; k < LEN; k++) {
        o[k] += 2 * p - 1;
        p += f / D.SR;
        if (p >= 1) p -= 1;
      }
    }
    return D.fadeOut(D.fadeIn(D.normalize(o, -12), 30, 'sshape'), 60, 'sshape');
  });

const noise = () =>
  once('noise', () => {
    seed = 11;
    const o = Float32Array.from({ length: LEN }, rnd);
    return D.fadeOut(D.fadeIn(D.normalize(o, -15), 40, 'sshape'), 80, 'sshape');
  });

const tone = () => once('tone', () => D.fadeOut(D.fadeIn(D.simpleSine(LEN, 440, 0.5), 20, 'sshape'), 60, 'sshape'));

// ---------- Drawing ----------
const C = { in: '#a9c4ff', out: '#ff9d4d', grid: 'rgba(255,255,255,0.08)', axis: 'rgba(255,255,255,0.22)', text: 'rgba(255,255,255,0.62)', dim: 'rgba(255,255,255,0.22)' };
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const label = (g: CanvasRenderingContext2D, s: string, x: number, y: number, align: CanvasTextAlign = 'left', color = C.text) => {
  g.fillStyle = color;
  g.font = '500 10px "JetBrains Mono Variable", ui-monospace, monospace';
  g.textAlign = align;
  g.fillText(s, x, y);
};

const frame = (g: CanvasRenderingContext2D, b: Box, title: string) => {
  g.fillStyle = 'rgba(10,8,24,0.55)';
  g.beginPath();
  g.roundRect(b.x, b.y, b.w, b.h, 8);
  g.fill();
  label(g, title, b.x + 8, b.y + 14);
};

/** A signal as a min/max envelope per pixel, so long buffers draw honestly. */
function wave(g: CanvasRenderingContext2D, b: Box, x: Float32Array, color: string, from = 0, to = x.length, yMax = 1, alpha = 1) {
  const mid = b.y + b.h / 2;
  const k = (b.h / 2 - 8) / yMax;
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = 1.3;
  g.beginPath();
  const span = to - from;
  const cols = Math.max(1, Math.floor(b.w));
  if (span <= cols * 2) {
    for (let i = from; i < to; i++) {
      const px = b.x + ((i - from) / Math.max(span - 1, 1)) * b.w;
      const py = mid - x[i] * k;
      if (i === from) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
  } else {
    for (let c = 0; c < cols; c++) {
      const a = from + Math.floor((c / cols) * span);
      const z = from + Math.floor(((c + 1) / cols) * span);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = a; i < z; i++) {
        if (x[i] < lo) lo = x[i];
        if (x[i] > hi) hi = x[i];
      }
      g.moveTo(b.x + c + 0.5, mid - hi * k);
      g.lineTo(b.x + c + 0.5, mid - lo * k - 0.5);
    }
  }
  g.stroke();
  g.globalAlpha = 1;
}

const hLine = (g: CanvasRenderingContext2D, b: Box, y: number, color = C.axis, dash: number[] = []) => {
  g.strokeStyle = color;
  g.setLineDash(dash);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(b.x, y);
  g.lineTo(b.x + b.w, y);
  g.stroke();
  g.setLineDash([]);
};

const LOG_LO = 20;
const LOG_HI = 20000;
const fx = (b: Box, f: number) => b.x + (Math.log(f / LOG_LO) / Math.log(LOG_HI / LOG_LO)) * b.w;

/** A magnitude response on a log-frequency axis. `db(f)` gives dB at f. */
function response(g: CanvasRenderingContext2D, b: Box, db: (f: number) => number, lo: number, hi: number, color: string, width = 1.8) {
  const y = (v: number) => b.y + 18 + (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (b.h - 26);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  for (let c = 0; c <= b.w; c += 1) {
    const f = LOG_LO * (LOG_HI / LOG_LO) ** (c / b.w);
    const py = y(db(f));
    if (c === 0) g.moveTo(b.x + c, py);
    else g.lineTo(b.x + c, py);
  }
  g.stroke();
  return y;
}

function freqGrid(g: CanvasRenderingContext2D, b: Box, lo: number, hi: number, step: number) {
  const y = (v: number) => b.y + 18 + (1 - (v - lo) / (hi - lo)) * (b.h - 26);
  for (const f of [100, 1000, 10000]) {
    g.strokeStyle = C.grid;
    g.beginPath();
    g.moveTo(fx(b, f), b.y + 18);
    g.lineTo(fx(b, f), b.y + b.h - 8);
    g.stroke();
    label(g, f >= 1000 ? `${f / 1000}k` : String(f), fx(b, f) + 3, b.y + b.h - 10, 'left', C.dim);
  }
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    hLine(g, b, y(v), v === 0 ? C.axis : C.grid);
    label(g, `${v} dB`, b.x + b.w - 4, y(v) - 3, 'right', C.dim);
  }
}

/** A linear-frequency spectrum (dB), 0..fMax Hz. */
function spectrumPlot(g: CanvasRenderingContext2D, b: Box, s: Float32Array, N: number, fMax: number, lo: number, color: string) {
  const bins = Math.floor((fMax / D.SR) * N);
  const y = (v: number) => b.y + 18 + (1 - (Math.max(v, lo) - lo) / -lo) * (b.h - 26);
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  g.beginPath();
  for (let c = 0; c <= b.w; c++) {
    const a = Math.floor((c / b.w) * bins);
    const z = Math.max(a + 1, Math.floor(((c + 1) / b.w) * bins));
    let m = -200;
    for (let k = a; k < z && k < s.length; k++) m = Math.max(m, s[k]);
    if (c === 0) g.moveTo(b.x + c, y(m));
    else g.lineTo(b.x + c, y(m));
  }
  g.stroke();
}

const stems = (g: CanvasRenderingContext2D, b: Box, h: Float64Array, color: string) => {
  let m = 1e-12;
  for (const v of h) m = Math.max(m, Math.abs(v));
  const mid = b.y + b.h / 2 + 6;
  const k = (b.h / 2 - 14) / m;
  hLine(g, b, mid);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1;
  for (let i = 0; i < h.length; i++) {
    const px = b.x + 8 + (i / Math.max(h.length - 1, 1)) * (b.w - 16);
    g.beginPath();
    g.moveTo(px, mid);
    g.lineTo(px, mid - h[i] * k);
    g.stroke();
    if (h.length <= 121) g.fillRect(px - 1.2, mid - h[i] * k - 1.2, 2.4, 2.4);
  }
  return { mid, k: (b.h / 2 - 14), px: (i: number) => b.x + 8 + (i / Math.max(h.length - 1, 1)) * (b.w - 16) };
};

const hz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`);
/** A number with a real minus sign. */
const num = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');
const db = (v: number) => `${v > 0 ? '+' : ''}${num(v)} dB`;

// ---------- Chapters ----------
type Value = number | string;
type Control =
  | { kind: 'range'; key: string; label: string; min: number; max: number; step?: number; log?: boolean; odd?: boolean; fmt: (v: number) => string }
  | { kind: 'choice'; key: string; label: string; options: [string, string][] };

interface Chapter {
  id: string;
  name: string;
  fn: (s: Record<string, Value>) => string;
  blurb: string;
  controls: Control[];
  state: Record<string, Value>;
  code: (s: Record<string, Value>) => string;
  /** Draws both panes; returns the readout. `t` is seconds, for the animated ones. */
  draw: (g: CanvasRenderingContext2D, top: Box, bottom: Box, s: Record<string, Value>, t: number) => string;
  /** What Listen plays, and what Original plays (if there is an input). */
  listen: (s: Record<string, Value>) => Float32Array;
  original?: () => Float32Array;
  animated?: boolean;
}

const n = (s: Record<string, Value>, k: string) => Number(s[k]);

const chapters: Chapter[] = [
  {
    id: 'levels',
    name: tr('Levels', '电平'),
    fn: () => 'ampTodB() · dBToAmp() · dsp_normalize()',
    blurb: tr('Decibels to amplitude and back, then normalizing: find the loudest sample and scale everything so it lands on the target.', '分贝和振幅的互相换算，然后是归一化：找到最响的那个采样，把整段按比例缩放到目标电平。'),
    controls: [{ kind: 'range', key: 'target', label: tr('Target peak', '目标峰值'), min: -30, max: 0, step: 0.5, fmt: (v) => `${v} dB` }],
    state: { target: -3 },
    code: () => CODE.levels,
    draw(g, top, bottom, s) {
      const x = pluck();
      const target = n(s, 'target');
      const y = D.normalize(x, target);
      frame(g, top, tr('input (blue) and normalized (orange)', '输入（蓝）和归一化后（橙）'));
      const amp = D.dBToAmp(target);
      const mid = top.y + top.h / 2;
      const k = top.h / 2 - 8;
      hLine(g, top, mid - amp * k, C.dim, [4, 4]);
      hLine(g, top, mid + amp * k, C.dim, [4, 4]);
      wave(g, top, y, C.out, 0, y.length, 1, 0.85);
      wave(g, top, x, C.in, 0, x.length, 1, 0.9); // on top: it is the smaller of the two
      // The dB curve: 20·log10(amp), with the two peaks on it.
      frame(g, bottom, tr('20 · log10(amp)', '20 · log10(振幅)'));
      const px = (a: number) => bottom.x + 10 + a * (bottom.w - 20);
      const py = (v: number) => bottom.y + 20 + (Math.max(v, -48) / -48) * (bottom.h - 30);
      g.strokeStyle = C.axis;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 1; i <= 200; i++) {
        const a = i / 200;
        if (i === 1) g.moveTo(px(a), py(D.ampTodB(a)));
        else g.lineTo(px(a), py(D.ampTodB(a)));
      }
      g.stroke();
      for (const [a, col] of [[D.dBToAmp(-14), C.in], [amp, C.out]] as const) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(px(a), py(D.ampTodB(a)), 4, 0, Math.PI * 2);
        g.fill();
      }
      const gain = amp / D.dBToAmp(-14);
      return tr(`peak −14.0 dB → ${num(target)} dB: every sample × ${gain.toFixed(2)}`, `峰值 −14.0 dB → ${num(target)} dB：每个采样 × ${gain.toFixed(2)}`);
    },
    listen: (s) => D.normalize(pluck(), Math.min(n(s, 'target'), -1)),
    original: pluck,
  },
  {
    id: 'reverse',
    name: tr('Reverse', '倒放'),
    fn: () => 'dsp_reverse()',
    blurb: tr('Two indices walk in from both ends and swap as they go, until they meet in the middle.', '两个下标从两头往中间走，边走边交换，直到在中间相遇。'),
    controls: [],
    state: {},
    code: () => CODE.reverse,
    draw(g, top, bottom) {
      const x = pluck();
      frame(g, top, tr('input', '输入'));
      wave(g, top, x, C.in);
      frame(g, bottom, tr('output: plucks become swells', '输出：拨弦变成了渐强'));
      wave(g, bottom, D.reverse(x), C.out);
      return tr(`${x.length.toLocaleString()} samples, ${Math.ceil(x.length / 2).toLocaleString()} swaps`, `${x.length.toLocaleString()} 个采样，交换 ${Math.ceil(x.length / 2).toLocaleString()} 次`);
    },
    listen: () => D.reverse(pluck()),
    original: pluck,
  },
  {
    id: 'fades',
    name: tr('Fades', '淡入淡出'),
    fn: () => 'dsp_shapeIn() · dsp_fadeIn() · dsp_fadeOut()',
    blurb: tr('Three fade curves. Equal-loudness follows a quarter sine, so a crossfade keeps the power steady; the S-shape eases in and out.', '三种淡变曲线。等响度用的是四分之一个正弦，交叉淡化时功率保持平稳；S 形则两头都是缓的。'),
    controls: [
      { kind: 'choice', key: 'shape', label: tr('Shape', '形状'), options: [['linear', tr('Linear', '线性')], ['equalloud', tr('Equal loudness', '等响度')], ['sshape', tr('S-shape', 'S 形')]] },
      { kind: 'range', key: 'ms', label: tr('Length', '时长'), min: 50, max: 900, step: 10, fmt: (v) => `${v} ms` },
    ],
    state: { shape: 'equalloud', ms: 600 },
    code: () => CODE.fades,
    draw(g, top, bottom, s) {
      frame(g, top, tr('the three shapes, 0 → 1', '三种曲线，0 → 1'));
      const shapes: D.FadeType[] = ['linear', 'equalloud', 'sshape'];
      for (const sh of shapes) {
        const on = sh === s.shape;
        g.strokeStyle = on ? C.out : C.dim;
        g.lineWidth = on ? 2.4 : 1.3;
        g.beginPath();
        for (let i = 0; i <= 100; i++) {
          const px = top.x + 12 + (i / 100) * (top.w - 24);
          const py = top.y + top.h - 10 - D.shapeIn(i / 100, sh) * (top.h - 30);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.stroke();
      }
      const ms = n(s, 'ms');
      const y = D.fadeOut(D.fadeIn(saw(), ms, s.shape as D.FadeType), ms, s.shape as D.FadeType);
      frame(g, bottom, tr('a chord, faded in and out', '一个和弦，淡入再淡出'));
      wave(g, bottom, saw(), C.in, 0, LEN, 0.6, 0.25);
      wave(g, bottom, y, C.out, 0, LEN, 0.6);
      return tr(`${ms} ms = ${Math.floor((ms * D.SR) / 1000).toLocaleString()} samples at 44.1 kHz`, `${ms} 毫秒 = 44.1 kHz 下的 ${Math.floor((ms * D.SR) / 1000).toLocaleString()} 个采样`);
    },
    listen: (s) => D.fadeOut(D.fadeIn(saw(), n(s, 'ms'), s.shape as D.FadeType), n(s, 'ms'), s.shape as D.FadeType),
    original: saw,
  },
  {
    id: 'osc',
    name: tr('Oscillators', '振荡器'),
    fn: (s) => (s.method === 'additive' ? (s.wave === 'square' ? 'dsp_additiveSquarewave()' : 'dsp_additiveTrianglewave()') : s.wave === 'square' ? 'dsp_simpleSquarewave()' : 'dsp_simpleTrianglewave()'),
    blurb: tr('The same wave two ways. Drawn sample by sample, its sharp corners carry harmonics past Nyquist that fold back as noise; summed from sines, it stops right before Nyquist.', '同一种波形的两种做法。逐个采样直接画出来时，尖角带出的谐波越过奈奎斯特频率，折回来变成杂音；用正弦叠加时，刚好在奈奎斯特频率之前停下。'),
    controls: [
      { kind: 'choice', key: 'wave', label: tr('Wave', '波形'), options: [['square', tr('Square', '方波')], ['triangle', tr('Triangle', '三角波')]] },
      { kind: 'choice', key: 'method', label: tr('Built', '做法'), options: [['naive', tr('Sample by sample', '逐采样')], ['additive', tr('Additive', '加法合成')]] },
      { kind: 'range', key: 'freq', label: tr('Frequency', '频率'), min: 110, max: 3520, log: true, fmt: hz },
    ],
    state: { wave: 'square', method: 'naive', freq: 1245 },
    code: (s) => (s.method === 'additive' ? (s.wave === 'square' ? CODE.additiveSquare : CODE.additiveTriangle) : s.wave === 'square' ? CODE.naiveSquare : CODE.naiveTriangle),
    draw(g, top, bottom, s) {
      const f = n(s, 'freq');
      const N = 8192;
      let x: Float32Array;
      let info = '';
      if (s.method === 'additive') {
        const r = D.additive(N, f, -6, s.wave as 'square' | 'triangle');
        x = r.out;
        info = tr(`${r.harmonics} odd harmonics summed, the last at ${hz(r.last)}, under Nyquist (22.05 kHz)`, `叠加了 ${r.harmonics} 个奇次谐波，最后一个在 ${hz(r.last)}，低于奈奎斯特频率（22.05 kHz）`);
      } else {
        x = s.wave === 'square' ? D.simpleSquare(N, f, 0.5) : D.simpleTriangle(N, f, 0.5);
        info = tr('The lines between the harmonics are aliases: harmonics above 22.05 kHz folded back down', '谐波之间多出来的线就是混叠：高于 22.05 kHz 的谐波折回来了');
      }
      const per = Math.round((3 * D.SR) / f);
      frame(g, top, tr('three periods', '三个周期'));
      wave(g, top, x, C.out, 0, Math.min(per, N), 0.75);
      frame(g, bottom, tr('spectrum, 0 to 22 kHz', '频谱，0 到 22 kHz'));
      // Where the true odd harmonics sit.
      for (let h = 1; h * f < D.SR / 2; h += 2) {
        const px = bottom.x + ((h * f) / (D.SR / 2)) * bottom.w;
        g.strokeStyle = 'rgba(169,196,255,0.18)';
        g.beginPath();
        g.moveTo(px, bottom.y + 18);
        g.lineTo(px, bottom.y + bottom.h - 8);
        g.stroke();
      }
      spectrumPlot(g, bottom, D.spectrum(x, N), N, D.SR / 2, -100, C.out);
      return info;
    },
    listen: (s) => {
      const f = n(s, 'freq');
      const x = s.method === 'additive' ? D.additive(LEN * 0.6, f, -18, s.wave as 'square' | 'triangle').out : s.wave === 'square' ? D.simpleSquare(LEN * 0.6, f, 0.125) : D.simpleTriangle(LEN * 0.6, f, 0.125);
      return D.fadeOut(D.fadeIn(x, 15, 'sshape'), 40, 'sshape');
    },
  },
  {
    id: 'chirp',
    name: tr('Chirp', '扫频'),
    fn: () => 'dsp_rampSinewave()',
    blurb: tr('A sine that glides between two frequencies. The phase step changes every sample, but the phase itself only ever adds up, so the sweep never clicks.', '在两个频率之间滑动的正弦波。相位增量每个采样都在变，但相位本身只累加不重置，所以扫频不会有咔哒声。'),
    controls: [
      { kind: 'range', key: 'f0', label: tr('From', '起始'), min: 50, max: 8000, log: true, fmt: hz },
      { kind: 'range', key: 'f1', label: tr('To', '结束'), min: 50, max: 8000, log: true, fmt: hz },
    ],
    state: { f0: 110, f1: 3520 },
    code: () => CODE.chirp,
    draw(g, top, bottom, s) {
      const f0 = n(s, 'f0');
      const f1 = n(s, 'f1');
      const x = D.rampSine(LEN, f0, f1, -6);
      frame(g, top, tr('spectrogram, 2 s', '声谱图，2 秒'));
      const N = 1024;
      const hop = 512;
      const fTop = Math.min(D.SR / 2, Math.max(f0, f1) * 1.3);
      const frames = Math.floor((LEN - N) / hop);
      const cw = (top.w - 16) / frames;
      const rows = 70;
      for (let fr = 0; fr < frames; fr++) {
        const sp = D.spectrum(x, N, fr * hop);
        for (let r = 0; r < rows; r++) {
          const k0 = Math.floor(((r / rows) * fTop * N) / D.SR);
          const k1 = Math.max(k0 + 1, Math.floor((((r + 1) / rows) * fTop * N) / D.SR));
          let m = -120;
          for (let k = k0; k < k1; k++) m = Math.max(m, sp[k]);
          const v = Math.min(Math.max((m + 70) / 64, 0), 1);
          if (v < 0.04) continue;
          g.fillStyle = `rgba(255,${Math.round(120 + v * 100)},${Math.round(60 + v * 90)},${v})`;
          g.fillRect(top.x + 8 + fr * cw, top.y + top.h - 8 - ((r + 1) / rows) * (top.h - 26), cw + 0.6, (top.h - 26) / rows + 0.6);
        }
      }
      label(g, hz(fTop), top.x + top.w - 6, top.y + 14, 'right', C.dim);
      frame(g, bottom, tr('the middle 12 ms', '中间的 12 毫秒'));
      const at = Math.floor(LEN / 2);
      wave(g, bottom, x, C.out, at, at + Math.round(0.012 * D.SR), 0.6);
      const fm = (f0 + f1) / 2;
      return tr(`f(t) = ${hz(f0)} + (${hz(f1)} − ${hz(f0)}) · t/T · ${hz(fm)} halfway`, `f(t) = ${hz(f0)} + (${hz(f1)} − ${hz(f0)}) · t/T · 中点 ${hz(fm)}`);
    },
    listen: (s) => D.fadeOut(D.fadeIn(D.rampSine(LEN, n(s, 'f0'), n(s, 'f1'), -18), 15, 'sshape'), 40, 'sshape'),
  },
  {
    id: 'tremolo',
    name: tr('Tremolo', '颤音'),
    fn: () => 'dsp_tremolo()',
    blurb: tr("A sine LFO, lifted to 0..1, pulls the gain down by the depth. Its rate glides from start to end across the buffer, so the wobble speeds up (or slows down).", '一个正弦 LFO 被抬到 0 到 1 之间，按深度把增益往下压。它的速率在整段里从起始值滑到结束值，所以抖动会越来越快（或越来越慢）。'),
    controls: [
      { kind: 'range', key: 'r0', label: tr('Start rate', '起始速率'), min: 0.5, max: 20, step: 0.5, fmt: (v) => `${v} Hz` },
      { kind: 'range', key: 'r1', label: tr('End rate', '结束速率'), min: 0.5, max: 20, step: 0.5, fmt: (v) => `${v} Hz` },
      { kind: 'range', key: 'depth', label: tr('Depth', '深度'), min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
    ],
    state: { r0: 2, r1: 14, depth: 85 },
    code: () => CODE.tremolo,
    draw(g, top, bottom, s) {
      const { out, gains } = D.tremolo(saw(), n(s, 'r0'), n(s, 'r1'), n(s, 'depth'));
      frame(g, top, tr('gain, over 2 s', '增益，2 秒内'));
      const gg = Float32Array.from(gains, (v) => v * 2 - 1);
      wave(g, top, gg, C.out);
      frame(g, bottom, tr('a chord through it', '和弦经过颤音'));
      wave(g, bottom, saw(), C.in, 0, LEN, 0.6, 0.2);
      wave(g, bottom, out, C.out, 0, LEN, 0.6);
      return tr(`LFO ${n(s, 'r0')} → ${n(s, 'r1')} Hz; the gain swings between 1 and ${(1 - n(s, 'depth') / 100).toFixed(2)}`, `LFO ${n(s, 'r0')} → ${n(s, 'r1')} Hz；增益在 1 和 ${(1 - n(s, 'depth') / 100).toFixed(2)} 之间摆动`);
    },
    listen: (s) => D.tremolo(saw(), n(s, 'r0'), n(s, 'r1'), n(s, 'depth')).out,
    original: saw,
  },
  {
    id: 'mod',
    name: tr('AM & ring mod', 'AM 与环形调制'),
    fn: (s) => (s.mode === 'am' ? 'dsp_ampModulation()' : 'dsp_ringModulation()'),
    blurb: tr('Multiply by a second wave. AM adds 1 first, so the carrier survives between two sidebands; ring modulation has no offset, so only the sidebands are left.', '乘上第二个波形。AM 先加了 1，所以载波保留下来，两边各多一个边带；环形调制没有这个偏移，只剩下两个边带。'),
    controls: [
      { kind: 'choice', key: 'mode', label: tr('Type', '类型'), options: [['am', 'AM'], ['rm', tr('Ring', '环形')]] },
      { kind: 'range', key: 'fm', label: tr('Modulator', '调制频率'), min: 2, max: 400, log: true, fmt: hz },
      { kind: 'range', key: 'amt', label: tr('Amount', '强度'), min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
    ],
    state: { mode: 'am', fm: 110, amt: 0.8 },
    code: (s) => (s.mode === 'am' ? CODE.am : CODE.rm),
    draw(g, top, bottom, s) {
      const fm = n(s, 'fm');
      const amt = n(s, 'amt');
      const y = s.mode === 'am' ? D.ampModulation(tone(), fm, amt) : D.ringModulation(tone(), fm, amt);
      frame(g, top, tr('a 440 Hz tone, modulated (40 ms)', '440 Hz 的音调制后（40 毫秒）'));
      const at = 4000;
      const len = Math.round(0.04 * D.SR);
      // The modulator's envelope, scaled to the tone's 0.5.
      const env = Float32Array.from({ length: len }, (_, i) => {
        const ph = (2 * Math.PI * fm * (at + i)) / D.SR;
        return 0.5 * (s.mode === 'am' ? 1 + amt * Math.sin(ph) : amt * Math.cos(ph));
      });
      wave(g, top, y, C.out, at, at + len, 1);
      wave(g, top, env, C.in, 0, len, 1, 0.75);
      wave(g, top, env.map((v) => -v), C.in, 0, len, 1, 0.75);
      frame(g, bottom, tr('spectrum, 0 to 1.5 kHz', '频谱，0 到 1.5 kHz'));
      spectrumPlot(g, bottom, D.spectrum(y, 16384, 2000), 16384, 1500, -90, C.out);
      const lo = Math.abs(440 - fm);
      return s.mode === 'am'
        ? tr(`the carrier stays at 440 Hz, with sidebands at ${hz(lo)} and ${hz(440 + fm)}`, `载波留在 440 Hz，边带在 ${hz(lo)} 和 ${hz(440 + fm)}`)
        : tr(`no offset, so the 440 Hz carrier is gone: only ${hz(lo)} and ${hz(440 + fm)} remain`, `没有偏移，所以 440 Hz 的载波消失了：只剩 ${hz(lo)} 和 ${hz(440 + fm)}`);
    },
    listen: (s) => (s.mode === 'am' ? D.ampModulation(tone(), n(s, 'fm'), n(s, 'amt')) : D.ringModulation(tone(), n(s, 'fm'), n(s, 'amt'))),
    original: tone,
  },
  {
    id: 'flanger',
    name: tr('Flanger', '镶边'),
    fn: () => 'dsp_flanger()',
    blurb: tr('A copy delayed by 1 to 5 ms, swept by a triangle LFO and read between samples with a lerp. Mixed with the dry signal, it carves notches that slide up and down.', '把信号复制一份，延迟 1 到 5 毫秒，用三角波 LFO 来回扫，并用线性插值在采样之间读取。和原信号混在一起，就挖出一排上下滑动的陷波。'),
    controls: [
      { kind: 'range', key: 'rate', label: tr('Rate', '速率'), min: 0.05, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)} Hz` },
      { kind: 'range', key: 'depth', label: tr('Depth', '深度'), min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
      { kind: 'range', key: 'mix', label: tr('Mix', '干湿比'), min: 0, max: 100, step: 1, fmt: (v) => `${v}% ${tr('wet', '湿')}` },
    ],
    state: { rate: 0.4, depth: 80, mix: 50 },
    code: () => CODE.flanger,
    animated: true,
    draw(g, top, bottom, s, t) {
      const rate = n(s, 'rate');
      const depth = n(s, 'depth');
      const wet = n(s, 'mix') / 100;
      const p = (t * rate) % 1;
      const d = D.flangerDelay(p, depth);
      frame(g, top, tr('delay, one LFO cycle', '延迟，一个 LFO 周期'));
      const py = (ms: number) => top.y + top.h - 10 - (ms / 5) * (top.h - 30);
      g.strokeStyle = C.out;
      g.lineWidth = 1.8;
      g.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = top.x + 10 + (i / 200) * (top.w - 20);
        if (i === 0) g.moveTo(x, py(D.flangerDelay(i / 200, depth)));
        else g.lineTo(x, py(D.flangerDelay(i / 200, depth)));
      }
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(top.x + 10 + p * (top.w - 20), py(d), 4.5, 0, Math.PI * 2);
      g.fill();
      for (const ms of [1, 5]) label(g, `${ms} ms`, top.x + top.w - 6, py(ms) - 3, 'right', C.dim);
      frame(g, bottom, tr('what it does to each frequency, right now', '此刻它对每个频率的影响'));
      freqGrid(g, bottom, -30, 6, 10);
      const T = d / 1000;
      response(g, bottom, (f) => {
        const w = 2 * Math.PI * f * T;
        return 20 * Math.log10(Math.hypot(1 - wet + wet * Math.cos(w), wet * Math.sin(w)) + 1e-9);
      }, -30, 6, C.out);
      return tr(`delay ${d.toFixed(2)} ms → the first notch at ${hz(1 / (2 * T))}, then every ${hz(1 / T)}`, `延迟 ${d.toFixed(2)} 毫秒 → 第一个陷波在 ${hz(1 / (2 * T))}，之后每隔 ${hz(1 / T)} 一个`);
    },
    listen: (s) => D.flanger(noise(), n(s, 'rate'), n(s, 'depth'), n(s, 'mix')),
    original: noise,
  },
  {
    id: 'fir',
    name: tr('FIR filter', 'FIR 滤波器'),
    fn: () => 'general_fir() · fir_lpf() · fir_hpf()',
    blurb: tr('The ideal low-pass is a sinc that never ends. Cut it to M taps, soften the edges with a Blackman window, and normalize. For the high-pass, flip every sign and add 1 at the center.', '理想低通滤波器是一个无限长的 sinc。截到 M 个系数，用 Blackman 窗把两端收软，再归一化。高通则是把每个系数取反，在中心加 1。'),
    controls: [
      { kind: 'choice', key: 'type', label: tr('Type', '类型'), options: [['lpf', tr('Low-pass', '低通')], ['hpf', tr('High-pass', '高通')]] },
      { kind: 'range', key: 'cut', label: tr('Cutoff', '截止频率'), min: 100, max: 12000, log: true, fmt: hz },
      { kind: 'range', key: 'taps', label: tr('Taps', '系数'), min: 11, max: 301, step: 2, odd: true, fmt: (v) => String(v) },
    ],
    state: { type: 'lpf', cut: 1200, taps: 101 },
    code: () => CODE.fir,
    draw(g, top, bottom, s) {
      const M = n(s, 'taps');
      const h = D.generalFir(M, n(s, 'cut'), s.type === 'hpf');
      frame(g, top, tr(`the ${M} coefficients, with the Blackman window`, `${M} 个系数，以及 Blackman 窗`));
      const st = stems(g, top, h, C.out);
      g.strokeStyle = C.in;
      g.setLineDash([3, 4]);
      g.beginPath();
      for (let i = 0; i < M; i++) {
        const y = st.mid - D.blackman(i, M) * st.k;
        if (i === 0) g.moveTo(st.px(i), y);
        else g.lineTo(st.px(i), y);
      }
      g.stroke();
      g.setLineDash([]);
      frame(g, bottom, tr('magnitude response', '幅频响应'));
      freqGrid(g, bottom, -100, 6, 20);
      const cut = n(s, 'cut');
      g.strokeStyle = C.in;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(fx(bottom, cut), bottom.y + 18);
      g.lineTo(fx(bottom, cut), bottom.y + bottom.h - 8);
      g.stroke();
      g.setLineDash([]);
      response(g, bottom, (f) => D.firResponse(h, f), -100, 6, C.out);
      const probe = s.type === 'hpf' ? cut / 2 : Math.min(cut * 2, 20000);
      return tr(`passband at −3 dB (the ×0.707 headroom) · ${db(D.firResponse(h, probe))} at ${hz(probe)}`, `通带在 −3 dB（×0.707 的余量）· ${hz(probe)} 处 ${db(D.firResponse(h, probe))}`);
    },
    listen: (s) => D.convolve(saw(), D.generalFir(n(s, 'taps'), n(s, 'cut'), s.type === 'hpf')),
    original: saw,
  },
  {
    id: 'bandstop',
    name: tr('Band-stop', '带阻'),
    fn: () => 'generateBandstopIR_IFFT() · fir_bandstop()',
    blurb: tr('Designed in the frequency domain: bins set to 1 for pass and 0 for the stopband, mirrored, inverse-FFT’d to taps, then windowed.', '在频域里设计：通带的频点设为 1，阻带设为 0，镜像到负频率，用逆 FFT 变成系数，再加窗。'),
    controls: [
      { kind: 'range', key: 'lo', label: tr('Stop from', '阻带起点'), min: 100, max: 8000, log: true, fmt: hz },
      { kind: 'range', key: 'hi', label: tr('Stop to', '阻带终点'), min: 200, max: 16000, log: true, fmt: hz },
      { kind: 'range', key: 'taps', label: tr('Taps', '系数'), min: 63, max: 511, step: 2, odd: true, fmt: (v) => String(v) },
      { kind: 'choice', key: 'centred', label: tr('Impulse response', '冲激响应'), options: [['no', tr('As written', '原样')], ['yes', tr('Centered first', '先居中')]] },
    ],
    state: { lo: 800, hi: 2000, taps: 255, centred: 'no' },
    code: () => CODE.bandstop,
    draw(g, top, bottom, s) {
      const lo = Math.min(n(s, 'lo'), n(s, 'hi') - 50);
      const hi = Math.max(n(s, 'hi'), lo + 50);
      const centred = s.centred === 'yes';
      const h = D.bandstopIR(n(s, 'taps'), lo, hi, centred);
      frame(g, top, tr('the taps', '系数'));
      stems(g, top, h, C.out);
      let peak = -200;
      for (let f = 20; f < 20000; f *= 1.02) peak = Math.max(peak, D.firResponse(h, f));
      const top_dB = Math.max(6, Math.ceil((peak + 6) / 10) * 10);
      frame(g, bottom, tr('target (blue) and what the taps do (orange)', '目标（蓝）和系数的实际效果（橙）'));
      freqGrid(g, bottom, -80, top_dB, 20);
      response(g, bottom, (f) => (f >= lo && f <= hi ? -80 : 0), -80, top_dB, C.in, 1.2);
      response(g, bottom, (f) => D.firResponse(h, f), -80, top_dB, C.out);
      const mid = Math.sqrt(lo * hi);
      return centred
        ? tr(`centered before windowing: ${db(D.firResponse(h, mid))} at ${hz(mid)}, 0 dB outside the band`, `加窗之前先居中：${hz(mid)} 处 ${db(D.firResponse(h, mid))}，阻带外 0 dB`)
        : tr(`as written, the response peaks at sample 0, where the Blackman window is 0, so the band is not cut (up to ${db(peak)})`, `按原样，冲激响应的峰值落在第 0 个采样，而 Blackman 窗在那里是 0，所以阻带没有被切掉（最高 ${db(peak)}）`);
    },
    listen: (s) => {
      const lo = Math.min(n(s, 'lo'), n(s, 'hi') - 50);
      return D.convolve(noise(), D.bandstopIR(n(s, 'taps'), lo, Math.max(n(s, 'hi'), lo + 50), s.centred === 'yes'));
    },
    original: noise,
  },
  {
    id: 'biquad',
    name: tr('Biquad', '双二阶'),
    fn: () => 'biquad_filter()',
    blurb: tr('Five coefficients from the bilinear transform, then one difference equation that feeds its own last two outputs back in. Q lifts a resonance at the cutoff.', '用双线性变换算出五个系数，再用一条差分方程，把自己最近两个输出反馈回去。Q 值会在截止频率处抬起一个共振峰。'),
    controls: [
      { kind: 'choice', key: 'type', label: tr('Type', '类型'), options: [['lpf', tr('Low-pass', '低通')], ['hpf', tr('High-pass', '高通')]] },
      { kind: 'range', key: 'cut', label: tr('Cutoff', '截止频率'), min: 60, max: 12000, log: true, fmt: hz },
      { kind: 'range', key: 'q', label: 'Q', min: 0.3, max: 12, log: true, fmt: (v) => v.toFixed(2) },
    ],
    state: { type: 'lpf', cut: 900, q: 4 },
    code: () => CODE.biquad,
    draw(g, top, bottom, s) {
      const c = D.biquadCoeffs(n(s, 'cut'), n(s, 'q'), s.type === 'hpf');
      frame(g, top, tr('magnitude response', '幅频响应'));
      freqGrid(g, top, -60, 24, 12);
      response(g, top, (f) => D.biquadResponse(c, f), -60, 24, C.out);
      // Bottom: the z-plane, poles and zeros.
      const r = Math.min(bottom.h / 2 - 18, bottom.w / 5);
      const cx = bottom.x + 34 + r;
      const cy = bottom.y + bottom.h / 2 + 6;
      frame(g, bottom, tr('z-plane: poles ×, zeros ○', 'z 平面：极点 ×，零点 ○'));
      g.strokeStyle = C.axis;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.moveTo(cx - r - 6, cy);
      g.lineTo(cx + r + 6, cy);
      g.moveTo(cx, cy - r - 6);
      g.lineTo(cx, cy + r + 6);
      g.stroke();
      const zx = s.type === 'hpf' ? 1 : -1;
      g.strokeStyle = C.in;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(cx + zx * r, cy, 5, 0, Math.PI * 2);
      g.stroke();
      label(g, '×2', cx + zx * r, cy + 18, 'center', C.in);
      // z² + a1 z + a2 = 0
      const disc = c.a1 * c.a1 - 4 * c.a2;
      const poles: [number, number][] = disc < 0 ? [[-c.a1 / 2, Math.sqrt(-disc) / 2], [-c.a1 / 2, -Math.sqrt(-disc) / 2]] : [[(-c.a1 + Math.sqrt(disc)) / 2, 0], [(-c.a1 - Math.sqrt(disc)) / 2, 0]];
      g.strokeStyle = C.out;
      g.lineWidth = 2;
      for (const [pr, pi] of poles) {
        const px = cx + pr * r;
        const py = cy - pi * r;
        g.beginPath();
        g.moveTo(px - 5, py - 5);
        g.lineTo(px + 5, py + 5);
        g.moveTo(px + 5, py - 5);
        g.lineTo(px - 5, py + 5);
        g.stroke();
      }
      // Right of it: the impulse response, the feedback ringing out.
      const ir = D.biquad(Float32Array.from({ length: 400 }, (_, i) => (i === 0 ? 1 : 0)), n(s, 'cut'), n(s, 'q'), s.type === 'hpf');
      let m = 1e-9;
      for (const v of ir) m = Math.max(m, Math.abs(v));
      const irBox = { x: cx + r + 36, y: bottom.y + 18, w: bottom.x + bottom.w - (cx + r + 44), h: bottom.h - 24 };
      label(g, tr('impulse response', '冲激响应'), irBox.x + irBox.w, bottom.y + 14, 'right');
      wave(g, irBox, Float32Array.from(ir, (v) => v / m), C.out, 0, 400, 1.1);
      let peak = -200;
      let fp = 20;
      for (let f = 20; f < 20000; f *= 1.01) {
        const v = D.biquadResponse(c, f);
        if (v > peak) (peak = v), (fp = f);
      }
      const radius = Math.sqrt(Math.max(c.a2, 0));
      return tr(`peak ${db(peak)} at ${hz(fp)} · pole radius ${radius.toFixed(3)} (closer to 1 rings longer)`, `峰值 ${db(peak)}，在 ${hz(fp)} · 极点半径 ${radius.toFixed(3)}（越接近 1 余振越长）`);
    },
    listen: (s) => D.biquad(saw(), n(s, 'cut'), n(s, 'q'), s.type === 'hpf'),
    original: saw,
  },
];

// ---------- Mounting ----------
const fromSlider = (c: Extract<Control, { kind: 'range' }>, t: number) => {
  const v = c.log ? c.min * (c.max / c.min) ** t : c.min + t * (c.max - c.min);
  if (c.odd) return Math.round((v - 1) / 2) * 2 + 1;
  const step = c.step ?? 0;
  return step ? Math.round(v / step) * step : Math.round(v);
};
const toSlider = (c: Extract<Control, { kind: 'range' }>, v: number) => (c.log ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min));

export function mountDspLab(host: HTMLElement, player: Player): { dispose(): void } {
  host.innerHTML = `
    <div class="dsp">
      <div class="dsp__tabs" role="tablist" aria-label="${tr('Routines in dsp.h', 'dsp.h 里的函数')}">
        ${chapters.map((c, i) => `<button class="dsp__tab" type="button" role="tab" id="dsp-tab-${c.id}" aria-controls="dsp-panel" data-chapter="${i}"><span>${String(i + 1).padStart(2, '0')}</span> ${esc(c.name)}</button>`).join('')}
      </div>
      <div class="dsp__panel" id="dsp-panel" role="tabpanel">
        <p class="dsp__blurb" data-blurb></p>
        <div class="deep__split">
          <figure class="deep__code"><figcaption data-fn></figcaption><pre><code data-code></code></pre></figure>
          <div class="dsp__viz">
            <canvas class="dsp__canvas" aria-hidden="true"></canvas>
            <p class="dsp__readout" data-readout aria-live="polite"></p>
            <div class="dsp__controls" data-controls></div>
            <div class="dsp__listen">
              <button class="btn" type="button" data-listen="out">${tr('Listen', '试听')}</button>
              <button class="btn btn--ghost" type="button" data-listen="in">${tr('Original', '原声')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  const canvas = host.querySelector<HTMLCanvasElement>('.dsp__canvas')!;
  const g = canvas.getContext('2d')!;
  const $ = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  let index = 0;
  let raf = 0;
  let disposed = false;
  const t0 = performance.now();

  const draw = () => {
    const ch = chapters[index];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const split = Math.round(h * 0.52);
    const readout = ch.draw(g, { x: 0, y: 0, w, h: split - 4 }, { x: 0, y: split + 4, w, h: h - split - 4 }, ch.state, (performance.now() - t0) / 1000);
    $('[data-readout]').textContent = readout;
  };
  const loop = () => {
    if (disposed) return;
    draw();
    raf = requestAnimationFrame(loop);
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderControls = () => {
    const ch = chapters[index];
    $('[data-controls]').innerHTML = ch.controls
      .map((c) =>
        c.kind === 'choice'
          ? `<div class="dsp__control"><span>${esc(c.label)}</span><div class="dsp__choice" role="radiogroup" aria-label="${esc(c.label)}">${c.options
              .map(([v, l]) => `<button type="button" role="radio" aria-checked="${ch.state[c.key] === v}" data-key="${c.key}" data-value="${v}">${esc(l)}</button>`)
              .join('')}</div></div>`
          : `<label class="dsp__control"><span>${esc(c.label)}</span><input type="range" min="0" max="1000" step="1" value="${Math.round(toSlider(c, Number(ch.state[c.key])) * 1000)}" data-key="${c.key}" /><output data-out="${c.key}">${esc(c.fmt(Number(ch.state[c.key])))}</output></label>`,
      )
      .join('');
    $<HTMLButtonElement>('[data-listen="in"]').hidden = !ch.original;
  };

  const show = (i: number) => {
    index = i;
    const ch = chapters[i];
    host.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b) => {
      const on = Number(b.dataset.chapter) === i;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    host.querySelector('#dsp-panel')?.setAttribute('aria-labelledby', `dsp-tab-${ch.id}`);
    $('[data-blurb]').textContent = ch.blurb;
    $('[data-fn]').textContent = `dsp.h · ${ch.fn(ch.state)}`;
    $('[data-code]').innerHTML = highlight(ch.code(ch.state));
    renderControls();
    cancelAnimationFrame(raf);
    if (ch.animated && !reduce) loop();
    else draw();
  };

  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-chapter]');
    if (tab) return show(Number(tab.dataset.chapter));
    const choice = t.closest<HTMLElement>('[data-value]');
    if (choice) {
      const ch = chapters[index];
      ch.state[choice.dataset.key!] = choice.dataset.value!;
      host.querySelectorAll<HTMLElement>(`[data-key="${choice.dataset.key}"][data-value]`).forEach((b) => b.setAttribute('aria-checked', String(b === choice)));
      $('[data-fn]').textContent = `dsp.h · ${ch.fn(ch.state)}`;
      $('[data-code]').innerHTML = highlight(ch.code(ch.state));
      if (!ch.animated || reduce) draw();
      return;
    }
    const listen = t.closest<HTMLElement>('[data-listen]')?.dataset.listen;
    if (listen) void play(listen === 'out');
  });
  host.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const ch = chapters[index];
    const c = ch.controls.find((x) => x.kind === 'range' && x.key === input.dataset.key) as Extract<Control, { kind: 'range' }> | undefined;
    if (!c) return;
    const v = fromSlider(c, Number(input.value) / 1000);
    ch.state[c.key] = v;
    host.querySelector(`[data-out="${c.key}"]`)!.textContent = c.fmt(v);
    if (!ch.animated || reduce) draw();
  });
  // Arrow keys move between the tabs.
  $('.dsp__tabs').addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
    e.preventDefault();
    e.stopPropagation(); // not the sheet behind
    const next = (index + (k === 'ArrowRight' ? 1 : -1) + chapters.length) % chapters.length;
    show(next);
    host.querySelector<HTMLElement>(`[data-chapter="${next}"]`)?.focus();
  });

  // ---------- Listening, on the room's turntable ----------
  let src: AudioBufferSourceNode | null = null;
  let slot: GuestSlot | null = null;
  let playing: 'out' | 'in' | null = null;
  const mark = () =>
    host.querySelectorAll<HTMLButtonElement>('[data-listen]').forEach((b) => {
      const on = b.dataset.listen === playing;
      b.classList.toggle('is-playing', on);
      b.textContent = on ? tr('Stop', '停止') : b.dataset.listen === 'out' ? tr('Listen', '试听') : tr('Original', '原声');
    });
  const stop = () => {
    const s = src;
    src = null;
    playing = null;
    try {
      s?.stop();
    } catch {}
    mark();
  };
  const play = async (processed: boolean) => {
    const which = processed ? 'out' : 'in';
    if (playing === which) {
      // Done listening: stop, and hand the turntable back so the room's music returns.
      const s = slot;
      slot = null;
      stop();
      s?.end();
      return;
    }
    const ch = chapters[index];
    let data = processed ? ch.listen(ch.state) : ch.original?.();
    if (!data) return;
    // Never louder than -6 dBFS, whatever the routine did to the level.
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    if (peak > 0.5) data = data.map((v) => (v * 0.5) / peak);
    await unlockAudio();
    const { ctx } = getAudio();
    const buffer = ctx.createBuffer(1, data.length, D.SR);
    buffer.getChannelData(0).set(data);
    slot = player.host({ id: `dsp-${ch.id}`, title: `${ch.name} · ${processed ? tr('processed', '处理后') : tr('original', '原声')}`, artist: `dsp.h · ${ch.fn(ch.state).split(' · ')[0]}`, inRoom: true }, stop);
    if (src) stop();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(getMusicBus().input);
    const started = ctx.currentTime;
    const tick = window.setInterval(() => slot?.progress(ctx.currentTime - started, buffer.duration), 200);
    node.onended = () => {
      window.clearInterval(tick);
      if (src !== node) return;
      src = null;
      playing = null;
      slot?.end();
      slot = null;
      mark();
    };
    node.start();
    src = node;
    playing = which;
    mark();
  };

  const resize = new ResizeObserver(() => {
    if (!chapters[index].animated || reduce) draw();
  });
  resize.observe(canvas);
  show(0);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      // Closing the walkthrough mid-sound counts as done listening: the room's music returns.
      const s = src ? slot : null;
      slot = null;
      stop();
      s?.end();
    },
  };
}
