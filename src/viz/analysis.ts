// Music analysis on the room's audio bus, one frame at a time: the raw spectrum and
// waveforms for the scopes, a chromagram (how much of each of the 12 pitch classes is
// sounding), and running estimates of tempo and key.
//
// Tempo: spectral flux (how much the spectrum rises frame to frame) marks note onsets;
// the onset strength is resampled to 100 Hz and autocorrelated over the last 8 s, and the
// lag with the strongest repetition (plus its double, which favors the felt beat over
// subdivisions) wins, steadied by a median of the last few estimates. Key: the chromagram is averaged over ~10 s and correlated with the
// Krumhansl-Kessler major and minor profiles in all 12 keys.
import type { MusicBus } from '../audio/bus';

export const PITCHES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const ONSET_HZ = 100;
const ONSET_SECONDS = 8;
const MIN_BPM = 60;
const MAX_BPM = 180;

export interface Analysis {
  /** dB per bin, from the main analyser. */
  freq: Float32Array<ArrayBuffer>;
  wave: Float32Array<ArrayBuffer>;
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  /** This frame's chroma, 0..1 (loudest pitch class = 1). */
  chroma: Float32Array<ArrayBuffer>;
  /** Hz per frequency bin. */
  binHz: number;
  bpm: number | null;
  key: { tonic: number; minor: boolean; name: string } | null;
  /** Read the analysers and advance the estimates. `listening` false pauses the history. */
  update(dt: number, listening: boolean): void;
  reset(): void;
}

export function createAnalysis(bus: MusicBus): Analysis {
  const an = bus.analyser;
  const bins = an.frequencyBinCount;
  const binHz = an.context.sampleRate / an.fftSize;
  const freq = new Float32Array(bins);
  const wave = new Float32Array(an.fftSize);
  const left = new Float32Array(bus.left.fftSize);
  const right = new Float32Array(bus.right.fftSize);
  const chroma = new Float32Array(12);
  const fineBins = bus.fine.frequencyBinCount;
  const fineHz = bus.fine.context.sampleRate / bus.fine.fftSize;
  const fineFreq = new Float32Array(fineBins);

  // Which pitch class each fine bin belongs to, for the musical range (about A1 to D♯7).
  const pitchOf = new Int8Array(fineBins).fill(-1);
  for (let i = 1; i < fineBins; i++) {
    const f = i * fineHz;
    if (f < 55 || f > 2500) continue; // from A1, so bass roots count
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    pitchOf[i] = ((midi % 12) + 12) % 12;
  }
  const fluxTo = Math.min(Math.round(8000 / binHz), bins - 1);
  const prevMag = new Float32Array(bins);

  // Onset strength history, resampled to a steady 100 Hz grid.
  const onsetLen = ONSET_HZ * ONSET_SECONDS;
  const onset = new Float32Array(onsetLen);
  let onsetFill = 0;
  let onsetClock = 0;
  let lastFlux = 0;
  const keyAcc = new Float32Array(12);
  let keyTime = 0;
  let sinceEstimate = 0;
  const recentBpm: number[] = [];

  const out: Analysis = {
    freq,
    wave,
    left,
    right,
    chroma,
    binHz,
    bpm: null,
    key: null,
    update(dt, listening) {
      an.getFloatFrequencyData(freq);
      an.getFloatTimeDomainData(wave);
      bus.left.getFloatTimeDomainData(left);
      bus.right.getFloatTimeDomainData(right);
      if (!listening || dt <= 0) return;

      // Flux (onsets) from the main spectrum, chroma from the fine one; linear magnitudes.
      let flux = 0;
      for (let i = 1; i <= fluxTo; i++) {
        const mag = Math.pow(10, freq[i] / 20);
        const rise = mag - prevMag[i];
        if (rise > 0) flux += rise;
        prevMag[i] = mag;
      }
      bus.fine.getFloatFrequencyData(fineFreq);
      chroma.fill(0);
      for (let i = 1; i < fineBins; i++) {
        const pc = pitchOf[i];
        if (pc >= 0) chroma[pc] += Math.pow(10, fineFreq[i] / 20);
      }
      let peak = 0;
      for (let k = 0; k < 12; k++) peak = Math.max(peak, chroma[k]);
      if (peak > 1e-9) for (let k = 0; k < 12; k++) chroma[k] /= peak;

      // Key: a leaky average of the chroma (weighted by loudness, so silence adds nothing).
      const decay = Math.exp(-dt / 10);
      const loud = Math.min(peak * 50, 1);
      for (let k = 0; k < 12; k++) keyAcc[k] = keyAcc[k] * decay + chroma[k] * dt * loud;
      keyTime = keyTime * decay + dt * loud;

      // Fill the 100 Hz onset grid up to now, interpolating between frames.
      onsetClock += dt * ONSET_HZ;
      const steps = Math.floor(onsetClock);
      onsetClock -= steps;
      for (let s = 1; s <= steps; s++) {
        onset.copyWithin(0, 1);
        onset[onsetLen - 1] = lastFlux + ((flux - lastFlux) * s) / steps;
      }
      lastFlux = flux;
      onsetFill = Math.min(onsetFill + steps, onsetLen);

      sinceEstimate += dt;
      if (sinceEstimate > 0.5) {
        sinceEstimate = 0;
        estimateTempo();
        estimateKey();
      }
    },
    reset() {
      onset.fill(0);
      onsetFill = 0;
      keyAcc.fill(0);
      keyTime = 0;
      recentBpm.length = 0;
      out.bpm = null;
      out.key = null;
    },
  };

  const env = new Float32Array(onsetLen);
  function estimateTempo() {
    if (onsetFill < ONSET_HZ * 5) return; // needs a few seconds of history
    // Remove the local average and keep only the rises: clean onset pulses.
    const start = onsetLen - onsetFill;
    const win = 10;
    let mean = 0;
    for (let i = start; i < onsetLen; i++) mean += onset[i];
    mean /= onsetFill;
    if (mean < 1e-6) return;
    for (let i = start; i < onsetLen; i++) {
      let local = 0;
      let n = 0;
      for (let j = Math.max(start, i - win); j <= Math.min(onsetLen - 1, i + win); j++) {
        local += onset[j];
        n++;
      }
      env[i] = Math.max(onset[i] - local / n, 0);
    }
    const ac = (lag: number) => {
      let s = 0;
      for (let i = start + lag; i < onsetLen; i++) s += env[i] * env[i - lag];
      return s / (onsetFill - lag);
    };
    const minLag = Math.floor((60 * ONSET_HZ) / MAX_BPM);
    const maxLag = Math.ceil((60 * ONSET_HZ) / MIN_BPM);
    let best = 0;
    let bestLag = 0;
    const scores = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      const bpm = (60 * ONSET_HZ) / lag;
      // The double lag backs up the beat; a gentle prior leans toward 70 to 140 BPM.
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 95) / 1.1, 2));
      scores[lag] = (ac(lag) + 0.5 * ac(Math.min(lag * 2, onsetFill - 1))) * prior;
      if (lag <= maxLag && scores[lag] > best) {
        best = scores[lag];
        bestLag = lag;
      }
    }
    if (!bestLag) return;
    // Parabolic peak interpolation for a fractional lag.
    const a = scores[bestLag - 1] ?? 0;
    const b = scores[bestLag];
    const c = scores[bestLag + 1] ?? 0;
    const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
    const bpm = (60 * ONSET_HZ) / (bestLag + Math.max(-0.5, Math.min(0.5, shift)));
    // Median of recent estimates keeps the readout steady.
    recentBpm.push(bpm);
    if (recentBpm.length > 11) recentBpm.shift();
    const sorted = [...recentBpm].sort((x, y) => x - y);
    out.bpm = Math.round(sorted[Math.floor(sorted.length / 2)]);
  }

  function estimateKey() {
    if (keyTime < 4) return;
    const corr = (profile: number[], tonic: number) => {
      let mx = 0;
      let my = 0;
      for (let k = 0; k < 12; k++) {
        mx += keyAcc[(k + tonic) % 12];
        my += profile[k];
      }
      mx /= 12;
      my /= 12;
      let num = 0;
      let dx = 0;
      let dy = 0;
      for (let k = 0; k < 12; k++) {
        const x = keyAcc[(k + tonic) % 12] - mx;
        const y = profile[k] - my;
        num += x * y;
        dx += x * x;
        dy += y * y;
      }
      return num / Math.sqrt(dx * dy || 1);
    };
    let best = -Infinity;
    let key: Analysis['key'] = null;
    for (let t = 0; t < 12; t++) {
      for (const minor of [false, true]) {
        const r = corr(minor ? MINOR : MAJOR, t);
        if (r > best) {
          best = r;
          key = { tonic: t, minor, name: `${PITCHES[t]} ${minor ? 'minor' : 'major'}` };
        }
      }
    }
    if (best < 0.5 || !key) return;
    // Close relatives (C major and A minor, say) share most notes; only switch when the new
    // key clearly wins, so the readout doesn't flicker between them.
    const current = out.key;
    if (current && current.name !== key.name && best - corr(current.minor ? MINOR : MAJOR, current.tonic) < 0.05) return;
    out.key = key;
  }

  return out;
}
