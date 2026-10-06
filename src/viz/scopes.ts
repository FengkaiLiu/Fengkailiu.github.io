// The five visualizers, each drawing one frame of an Analysis onto a 2D canvas.
// Colors follow the room: lamp orange, peach, rose and moonlight blue on night violet.
import { PITCHES, type Analysis } from './analysis';

export interface Scope {
  draw(g: CanvasRenderingContext2D, w: number, h: number, a: Analysis, dpr: number): void;
  /** Called when the canvas is resized or the view is switched to. */
  reset?(): void;
}

const LAMP = '#ff9d4d';
const PEACH = '#ffd59e';
const ROSE = '#ff8fb1';
const MOON = '#a9c4ff';
const INK = 'rgba(255, 246, 236, 0.45)';
const GRID = 'rgba(255, 255, 255, 0.07)';
const BG = '#120d24';

const F_MIN = 30;
const F_MAX = 16000;
const logX = (f: number, w: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
const DB_FLOOR = -95;
const DB_CEIL = -30;
const level = (db: number) => Math.min(Math.max((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR), 0), 1);

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, dpr: number, align: CanvasTextAlign = 'left') {
  g.font = `${10 * dpr}px "JetBrains Mono Variable", monospace`;
  g.fillStyle = INK;
  g.textAlign = align;
  g.fillText(text, x, y);
}

function frequencyGrid(g: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
  g.strokeStyle = GRID;
  g.lineWidth = dpr;
  for (const [f, name] of [[50, '50'], [100, '100'], [500, '500'], [1000, '1k'], [5000, '5k'], [10000, '10k']] as const) {
    const x = logX(f, w);
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
    label(g, name, x + 4 * dpr, h - 6 * dpr, dpr);
  }
}

// ---------- Waveform: a steady oscilloscope, triggered on a rising zero crossing ----------
let waveGain = 0.02;
export const waveform: Scope = {
  draw(g, w, h, a, dpr) {
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = GRID;
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();

    const data = a.wave;
    const span = data.length / 2;
    let start = 0;
    for (let i = 1; i < span; i++) {
      if (data[i - 1] < 0 && data[i] >= 0) {
        start = i;
        break;
      }
    }
    let sq = 0;
    for (let i = start; i < start + span; i++) sq += data[i] * data[i];
    // Auto gain from the average level (not the peaks, which a single drum hit would set),
    // easing so the trace breathes instead of jumping.
    const rms = Math.sqrt(sq / span);
    waveGain += (rms - waveGain) * 0.05;
    const scale = (h * 0.16) / Math.max(waveGain, 0.002);
    const trace = () => {
      g.beginPath();
      for (let i = 0; i < span; i++) {
        const x = (i / (span - 1)) * w;
        const y = h / 2 - data[start + i] * scale;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    };
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255, 157, 77, 0.25)';
    g.lineWidth = 6 * dpr;
    trace();
    g.strokeStyle = PEACH;
    g.lineWidth = 1.6 * dpr;
    trace();
    label(g, 'amplitude over ~21 ms', 8 * dpr, 16 * dpr, dpr);
  },
};

// ---------- Spectrum: log-frequency curve with falling peak markers ----------
const peaks = new Float32Array(160);
export const spectrum: Scope = {
  reset() {
    peaks.fill(0);
  },
  draw(g, w, h, a, dpr) {
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);
    frequencyGrid(g, w, h, dpr);
    const n = peaks.length;
    const top = 18 * dpr;
    const usable = h - top - 18 * dpr;
    const ys: number[] = [];
    for (let k = 0; k < n; k++) {
      // Each point averages the bins in its slice of the log axis.
      const f0 = F_MIN * Math.pow(F_MAX / F_MIN, k / n);
      const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (k + 1) / n);
      const b0 = Math.max(1, Math.floor(f0 / a.binHz));
      const b1 = Math.max(b0 + 1, Math.ceil(f1 / a.binHz));
      let s = 0;
      for (let b = b0; b < b1 && b < a.freq.length; b++) s += a.freq[b];
      const v = level(s / (b1 - b0));
      peaks[k] = Math.max(v, peaks[k] - 0.006);
      ys.push(top + usable * (1 - v));
    }
    const grad = g.createLinearGradient(0, top, 0, h);
    grad.addColorStop(0, 'rgba(255, 213, 158, 0.55)');
    grad.addColorStop(0.6, 'rgba(255, 143, 177, 0.25)');
    grad.addColorStop(1, 'rgba(255, 143, 177, 0)');
    g.beginPath();
    g.moveTo(0, h);
    ys.forEach((y, k) => g.lineTo((k / (n - 1)) * w, y));
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.beginPath();
    ys.forEach((y, k) => (k ? g.lineTo((k / (n - 1)) * w, y) : g.moveTo(0, y)));
    g.strokeStyle = LAMP;
    g.lineWidth = 1.6 * dpr;
    g.stroke();
    g.fillStyle = PEACH;
    for (let k = 0; k < n; k += 2) g.fillRect((k / (n - 1)) * w - dpr, top + usable * (1 - peaks[k]) - dpr, 2 * dpr, 2 * dpr);
    label(g, 'level by frequency (Hz)', 8 * dpr, 14 * dpr, dpr);
  },
};

// ---------- Spectrogram: time scrolls left, frequency up, loudness as color ----------
const ramp = (() => {
  const stops = ['#120d24', '#2c1a5c', '#7a2c8c', '#d84a7a', '#ff9d4d', '#ffd59e', '#fff8e8'].map((hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const k = Math.min(Math.floor(t), stops.length - 2);
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return lut;
})();
let column: ImageData | null = null;
let fresh = true;
export const spectrogram: Scope = {
  reset() {
    fresh = true;
  },
  draw(g, w, h, a, dpr) {
    if (fresh) {
      g.fillStyle = BG;
      g.fillRect(0, 0, w, h);
      fresh = false;
    }
    const step = Math.max(1, Math.round(1.5 * dpr));
    // Scroll what is there, then paint the newest column on the right.
    g.drawImage(g.canvas, step, 0, w - step, h, 0, 0, w - step, h);
    if (!column || column.height !== h || column.width !== step) column = g.createImageData(step, h);
    const px = column.data;
    for (let y = 0; y < h; y++) {
      const f = F_MIN * Math.pow(F_MAX / F_MIN, 1 - y / h);
      const bin = Math.min(Math.round(f / a.binHz), a.freq.length - 1);
      const v = Math.round(Math.pow(level(a.freq[bin]), 1.6) * 255);
      for (let x = 0; x < step; x++) {
        const i = (y * step + x) * 4;
        px[i] = ramp[v * 3];
        px[i + 1] = ramp[v * 3 + 1];
        px[i + 2] = ramp[v * 3 + 2];
        px[i + 3] = 255;
      }
    }
    g.putImageData(column, w - step, 0);
  },
};

// ---------- Vectorscope: left against right, rotated so mono stands upright ----------
let scopeGain = 0.02;
export const vectorscope: Scope = {
  draw(g, w, h, a, dpr) {
    // Fade the last frames instead of clearing: a short phosphor trail.
    g.fillStyle = 'rgba(18, 13, 36, 0.32)';
    g.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.44;
    g.strokeStyle = GRID;
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx, cy + r);
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();

    const L = a.left;
    const R = a.right;
    let lr = 0;
    let ll = 0;
    let rr = 0;
    for (let i = 0; i < L.length; i++) {
      lr += L[i] * R[i];
      ll += L[i] * L[i];
      rr += R[i] * R[i];
    }
    const rms = Math.sqrt((ll + rr) / (2 * L.length));
    scopeGain += (rms - scopeGain) * 0.05;
    const k = (r * 0.3) / Math.max(scopeGain, 0.002); // the average sits at a third of the circle
    g.fillStyle = 'rgba(169, 196, 255, 0.55)';
    for (let i = 0; i < L.length; i += 2) {
      const x = cx + (R[i] - L[i]) * k * 0.7071;
      const y = cy - (L[i] + R[i]) * k * 0.7071;
      g.fillRect(x, y, 1.4 * dpr, 1.4 * dpr);
    }
    label(g, 'L', cx - r * 0.72, cy - r * 0.72, dpr, 'center');
    label(g, 'R', cx + r * 0.72, cy - r * 0.72, dpr, 'center');
    // Correlation: +1 mono, 0 wide, below 0 out of phase.
    const corr = ll && rr ? lr / Math.sqrt(ll * rr) : 1;
    const barW = Math.min(w * 0.3, 180 * dpr);
    const bx = w - barW - 12 * dpr;
    const by = h - 14 * dpr;
    g.fillStyle = 'rgba(255, 255, 255, 0.1)';
    g.fillRect(bx, by, barW, 3 * dpr);
    g.fillStyle = corr < 0 ? ROSE : MOON;
    g.fillRect(bx + ((corr + 1) / 2) * barW - 2 * dpr, by - 3 * dpr, 4 * dpr, 9 * dpr);
    label(g, `correlation ${corr.toFixed(2)}`, bx, by - 8 * dpr, dpr);
  },
};

// ---------- Chromagram: the 12 pitch classes, the detected key's tonic lit ----------
const held = new Float32Array(12);
export const chromagram: Scope = {
  reset() {
    held.fill(0);
  },
  draw(g, w, h, a, dpr) {
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);
    const pad = 12 * dpr;
    const slot = (w - pad * 2) / 12;
    const base = h - 24 * dpr;
    const top = 22 * dpr;
    for (let k = 0; k < 12; k++) {
      held[k] += (a.chroma[k] - held[k]) * 0.18;
      const bh = (base - top) * held[k];
      const x = pad + k * slot + slot * 0.18;
      const bw = slot * 0.64;
      const tonic = a.key?.tonic === k;
      const grad = g.createLinearGradient(0, base, 0, base - bh);
      grad.addColorStop(0, tonic ? LAMP : 'rgba(255, 143, 177, 0.55)');
      grad.addColorStop(1, tonic ? PEACH : 'rgba(255, 213, 158, 0.8)');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x, base - bh, bw, Math.max(bh, 2 * dpr), 3 * dpr);
      g.fill();
      label(g, PITCHES[k], x + bw / 2, h - 8 * dpr, dpr, 'center');
    }
    label(g, 'energy per pitch class', 8 * dpr, 14 * dpr, dpr);
  },
};
