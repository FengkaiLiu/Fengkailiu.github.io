// Room sound, all synthesized: an electric-piano chord when the lamp turns on,
// then a quiet bed of rain and vinyl crackle that can be toggled.
import { getAudio, makeReverb } from './context';

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Fmaj9 voiced like a Rhodes, strummed, slightly detuned, through tape-ish warmth. */
export function playLightsOnChord() {
  const { ctx, master } = getAudio();
  const now = ctx.currentTime + 0.05;

  const out = ctx.createGain();
  out.gain.value = 0.5;
  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 2200;
  warmth.Q.value = 0.4;
  const reverb = makeReverb(ctx, 2.4, 2.5);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  out.connect(warmth).connect(master);
  warmth.connect(reverb).connect(wet).connect(master);

  // Gentle tremolo, the Rhodes signature.
  const trem = ctx.createOscillator();
  const tremDepth = ctx.createGain();
  trem.frequency.value = 4.2;
  tremDepth.gain.value = 0.18;
  trem.connect(tremDepth).connect(out.gain);
  trem.start(now);
  trem.stop(now + 5);

  const notes = [41, 53, 57, 60, 64, 67]; // F2 F3 A3 C4 E4 G4
  notes.forEach((note, i) => {
    const t = now + i * 0.045;
    const f = midiToHz(note);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(note < 50 ? 0.16 : 0.1, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    amp.connect(out);
    // Fundamental, a soft bell partial, and a slow wobble of detune for tape feel.
    for (const [ratio, gain] of [[1, 1], [2, 0.25], [4.01, 0.06]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = f * ratio;
      osc.detune.setValueAtTime(-6, t);
      osc.detune.linearRampToValueAtTime(4, t + 3);
      g.gain.value = gain;
      osc.connect(g).connect(amp);
      osc.start(t);
      osc.stop(t + 4.3);
    }
  });
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let brown = 0;
    for (let i = 0; i < d.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
      d[i] = brown * 3.5 + (Math.random() * 2 - 1) * 0.15;
    }
  }
  return buffer;
}

function crackleBuffer(ctx: BaseAudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (Math.random() < 0.0009) {
      const amp = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? -1 : 1);
      const len = 8 + Math.floor(Math.random() * 30);
      for (let j = 0; j < len && i + j < d.length; j++) d[i + j] += amp * Math.exp(-j / 4);
    }
    d[i] += (Math.random() * 2 - 1) * 0.004; // surface hiss
  }
  return buffer;
}

export interface Ambience {
  enabled: boolean;
  setEnabled(on: boolean): void;
}

/** Rain against the window + record crackle. Starts faded in, quietly. */
export function startAmbience(): Ambience {
  const { ctx, master } = getAudio();
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(master);

  const rain = ctx.createBufferSource();
  rain.buffer = noiseBuffer(ctx, 4);
  rain.loop = true;
  const rainLp = ctx.createBiquadFilter();
  rainLp.type = 'lowpass';
  rainLp.frequency.value = 1400;
  const rainHp = ctx.createBiquadFilter();
  rainHp.type = 'highpass';
  rainHp.frequency.value = 250;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.22;
  rain.connect(rainHp).connect(rainLp).connect(rainGain).connect(bus);

  const crackle = ctx.createBufferSource();
  crackle.buffer = crackleBuffer(ctx, 5);
  crackle.loop = true;
  const crackleHp = ctx.createBiquadFilter();
  crackleHp.type = 'highpass';
  crackleHp.frequency.value = 900;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.35;
  crackle.connect(crackleHp).connect(crackleGain).connect(bus);

  rain.start();
  crackle.start();

  const amb: Ambience = {
    enabled: false,
    setEnabled(on) {
      amb.enabled = on;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(on ? 0.5 : 0, t + (on ? 3 : 0.6));
    },
  };
  amb.setEnabled(true);
  return amb;
}
