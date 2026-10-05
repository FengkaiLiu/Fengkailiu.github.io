// A lofi loop synthesized live in Web Audio: swung drums, a round bass, and a
// Fmaj7 / Em7 / Dm9 / Cmaj9 Rhodes progression. Stands in until real tracks exist.
import { makeReverb } from './context';
import { rhodesNote } from './lofi';

const BPM = 78;
const STEP = 60 / BPM / 4; // one 16th note
const SWING = 0.28; // late offbeats, the lazy lofi pocket
const LOOKAHEAD = 0.15;

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// One chord per bar. Rootless upper voicings keep it soft; the bass carries the root.
const BARS = [
  { bass: 41, chord: [57, 60, 64, 67] }, // Fmaj7(9): A C E G
  { bass: 40, chord: [55, 59, 62, 64] }, // Em7: G B D E
  { bass: 38, chord: [53, 57, 60, 64] }, // Dm9: F A C E
  { bass: 36, chord: [52, 55, 59, 62] }, // Cmaj9: E G B D
];
const PENTA = [65, 67, 69, 72, 74, 77]; // F major pentatonic, for the little melody

export interface DemoBeat {
  stop(): void;
}

export function startDemoBeat(ctx: AudioContext, dest: AudioNode): DemoBeat {
  // Lofi chain: low-pass, gentle saturation, a little room.
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.6);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3600;
  lp.Q.value = 0.5;
  const sat = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  sat.curve = curve;
  out.connect(lp).connect(sat).connect(dest);
  const verb = makeReverb(ctx, 1.8, 3);
  const verbSend = ctx.createGain();
  verbSend.gain.value = 0.22;
  lp.connect(verbSend).connect(verb).connect(dest);

  // Keys get their own tremolo, the Rhodes signature.
  const keys = ctx.createGain();
  keys.connect(out);
  const trem = ctx.createOscillator();
  const tremDepth = ctx.createGain();
  trem.frequency.value = 4.5;
  tremDepth.gain.value = 0.15;
  trem.connect(tremDepth).connect(keys.gain);
  trem.start();

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noiseHit = (t: number, filter: BiquadFilterType, freq: number, q: number, vel: number, decay: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  };

  const kick = (t: number, vel: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.52);
  };

  const snare = (t: number, vel: number) => {
    noiseHit(t, 'bandpass', 1900, 0.7, vel * 0.45, 0.22);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 185;
    g.gain.setValueAtTime(vel * 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.1);
  };

  const bass = (t: number, midi: number, dur: number) => {
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = midiToHz(midi);
    f.type = 'lowpass';
    f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const human = () => (Math.random() - 0.5) * 0.012;
  let step = 0;
  let nextTime = ctx.currentTime + 0.08;

  const schedule = (s: number, t: number) => {
    const barIndex = Math.floor(s / 16) % BARS.length;
    const bar = BARS[barIndex];
    const i = s % 16;
    const even = barIndex % 2 === 0;

    if (i === 0 || (even ? i === 7 || i === 10 : i === 10 || i === 11)) kick(t + human(), i === 0 ? 0.95 : 0.75);
    if (i === 4 || i === 12) snare(t + 0.01 + human(), 0.9);
    if (i % 2 === 0) noiseHit(t + human(), 'highpass', 7500, 0.5, i % 4 === 0 ? 0.07 : 0.045, 0.04);
    else if (Math.random() < 0.18) noiseHit(t + human(), 'highpass', 8000, 0.5, 0.025, 0.03); // ghost hats

    if (i === 0) bar.chord.forEach((n, k) => rhodesNote(ctx, keys, n, t + k * 0.03, STEP * 15, 0.075));
    if (i === 11 && !even) bar.chord.slice(2).forEach((n, k) => rhodesNote(ctx, keys, n, t + k * 0.02, STEP * 4, 0.04));

    if (i === 0) bass(t, bar.bass, STEP * 6);
    if (i === 8) bass(t, bar.bass, STEP * 5);
    if (i === 14) bass(t, bar.bass + (Math.random() < 0.5 ? 7 : 12), STEP * 2);

    if (i % 2 === 0 && i !== 0 && Math.random() < 0.13) {
      rhodesNote(ctx, keys, PENTA[Math.floor(Math.random() * PENTA.length)], t, STEP * 6, 0.05);
    }
  };

  const tick = () => {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      schedule(step, nextTime + (step % 2 === 1 ? STEP * SWING : 0));
      nextTime += STEP;
      step++;
    }
  };
  tick();
  const timer = window.setInterval(tick, 25);

  return {
    stop() {
      window.clearInterval(timer);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.4);
      window.setTimeout(() => {
        trem.stop();
        out.disconnect();
        verb.disconnect();
      }, 2500);
    },
  };
}
