// The room's lofi instrument kit, synthesized in Web Audio: kick, snare, hats, a round
// bass and Rhodes chords, all through one lofi chain (low-pass, gentle saturation, a
// little room). Shared by the demo loop and the Contact chapter's sequencer.
import { makeReverb } from './context';
import { rhodesNote } from './lofi';

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// One chord per bar. Rootless upper voicings keep it soft; the bass carries the root.
export const BARS = [
  { name: 'Fmaj7', bass: 41, chord: [57, 60, 64, 67] }, // A C E G
  { name: 'Em7', bass: 40, chord: [55, 59, 62, 64] }, // G B D E
  { name: 'Dm9', bass: 38, chord: [53, 57, 60, 64] }, // F A C E
  { name: 'Cmaj9', bass: 36, chord: [52, 55, 59, 62] }, // E G B D
];

export interface Kit {
  kick(t: number, vel: number): void;
  snare(t: number, vel: number): void;
  hat(t: number, vel: number, pan?: number, decay?: number, freq?: number): void;
  bass(t: number, midi: number, dur: number): void;
  /** Rhodes notes into the keys bus (with its tremolo). */
  keys(t: number, midi: number, dur: number, vel: number): void;
  /** Fade out and release everything. */
  stop(): void;
}

export function createKit(ctx: AudioContext, dest: AudioNode): Kit {
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
  const keysBus = ctx.createGain();
  keysBus.connect(out);
  const trem = ctx.createOscillator();
  const tremDepth = ctx.createGain();
  trem.frequency.value = 4.5;
  tremDepth.gain.value = 0.15;
  trem.connect(tremDepth).connect(keysBus.gain);
  trem.start();

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noiseHit = (t: number, filter: BiquadFilterType, freq: number, q: number, vel: number, decay: number, pan = 0) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(f).connect(g).connect(p).connect(out);
    } else src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  };

  return {
    kick(t, vel) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.52);
    },
    snare(t, vel) {
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
    },
    hat(t, vel, pan = 0, decay = 0.04, freq = 7500) {
      noiseHit(t, 'highpass', freq, 0.5, vel, decay, pan);
    },
    bass(t, midi, dur) {
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
    },
    keys(t, midi, dur, vel) {
      rhodesNote(ctx, keysBus, midi, t, dur, vel);
    },
    stop() {
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
