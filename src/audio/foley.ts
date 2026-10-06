// Little room sounds, synthesized on the spot: the cat's purr and the lamp's switch.
import { getAudio } from './context';

let noise: AudioBuffer | null = null;
const noiseBuffer = (ctx: AudioContext) => {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  // Brown-ish noise: soft and low, like breath rather than hiss.
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return noise;
};

/** About two seconds of purring: low breathy noise fluttering at ~26 Hz, in two breaths. */
export function purr() {
  const { ctx, master } = getAudio();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  // The flutter: a fast tremolo from an oscillator driving the gain.
  const flutter = ctx.createGain();
  flutter.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(26, t);
  lfo.frequency.linearRampToValueAtTime(23, t + 2.2);
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(flutter.gain);
  // Two breaths: in (louder), out, in again.
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.5, t + 0.25);
  env.gain.linearRampToValueAtTime(0.22, t + 0.9);
  env.gain.linearRampToValueAtTime(0.42, t + 1.25);
  env.gain.linearRampToValueAtTime(0.0001, t + 2.2);
  src.connect(lp).connect(flutter).connect(env).connect(master);
  src.start(t);
  lfo.start(t);
  src.stop(t + 2.3);
  lfo.stop(t + 2.3);
}

/** A small switch: a sharp tick, then a softer one as it seats. */
export function lampClick() {
  const { ctx, master } = getAudio();
  const t = ctx.currentTime;
  for (const [at, vel, freq] of [[0, 0.35, 3200], [0.035, 0.15, 2100]] as const) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 4, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.03);
    src.connect(bp).connect(g).connect(master);
    src.start(t + at, Math.random());
    src.stop(t + at + 0.05);
  }
}
