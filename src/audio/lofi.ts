// Room sound: an electric-piano chord when the lamp turns on, then a quiet bed of rain
// and vinyl crackle that can be toggled. The crackle is synthesized; the rain is a real
// recording (raining.mp3), fetched only once the room starts making sound.
import { getAudio, makeReverb } from './context';
import rainUrl from './raining.mp3?url';

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
  notes.forEach((note, i) => rhodesNote(ctx, out, note, now + i * 0.045, 4.2, note < 50 ? 0.16 : 0.1));
}

/** One electric-piano note: a fundamental, a soft bell partial, and a slow detune drift for tape feel. */
export function rhodesNote(ctx: BaseAudioContext, dest: AudioNode, midi: number, t: number, dur: number, vel: number) {
  const f = midiToHz(midi);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(vel, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  amp.connect(dest);
  for (const [ratio, gain] of [[1, 1], [2, 0.25], [4.01, 0.06]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = f * ratio;
    osc.detune.setValueAtTime(-6, t);
    osc.detune.linearRampToValueAtTime(4, t + Math.min(dur, 3));
    g.gain.value = gain;
    osc.connect(g).connect(amp);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }
}

// The rain recording, ready to loop: brought to the level the room's rain has always had,
// its few loudest drops rounded off so they don't clip, and its end crossfaded into its
// start so a 12 s clip repeats without a seam.
const RAIN_RMS = 0.035;
const RAIN_KNEE = 0.4; // above this a drop is softly limited, never past 1
const RAIN_XFADE = 1.5; // seconds

async function rainLoop(ctx: BaseAudioContext) {
  const raw = await ctx.decodeAudioData(await (await fetch(rainUrl)).arrayBuffer());
  const fade = Math.min(Math.floor(RAIN_XFADE * raw.sampleRate), Math.floor(raw.length / 3));
  const len = raw.length - fade;
  let sq = 0;
  for (let ch = 0; ch < raw.numberOfChannels; ch++) for (const v of raw.getChannelData(ch)) sq += v * v;
  const gain = RAIN_RMS / Math.max(Math.sqrt(sq / (raw.length * raw.numberOfChannels)), 1e-6);
  const limit = (x: number) => {
    const a = Math.abs(x * gain);
    const y = a < RAIN_KNEE ? a : RAIN_KNEE + (1 - RAIN_KNEE) * Math.tanh((a - RAIN_KNEE) / (1 - RAIN_KNEE));
    return Math.sign(x) * y;
  };
  const out = ctx.createBuffer(raw.numberOfChannels, len, raw.sampleRate);
  for (let ch = 0; ch < raw.numberOfChannels; ch++) {
    const src = raw.getChannelData(ch);
    const d = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Equal-power crossfade: rain is noise, so the two halves add as power, not amplitude.
      const v = i < fade ? src[i] * Math.sin((i / fade) * Math.PI * 0.5) + src[len + i] * Math.cos((i / fade) * Math.PI * 0.5) : src[i];
      d[i] = limit(v);
    }
  }
  return out;
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

function loop(ctx: AudioContext, buffer: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

export interface Ambience {
  rain: boolean;
  crackle: boolean;
  setRain(on: boolean): void;
  setCrackle(on: boolean): void;
  /** Hush everything for a while (the game console), keeping the rain and crackle settings. */
  setPaused(paused: boolean): void;
  paused: boolean;
}

/** Vinyl crackle and rain against the window, each switchable, on one bus that can pause. */
export function startAmbience(opts: { rain?: boolean; crackle?: boolean } = {}): Ambience {
  const { ctx, master: out } = getAudio();
  const master = ctx.createGain(); // the ambience bus: pausing fades this, not the settings
  master.connect(out);
  const ramp = (param: AudioParam, to: number, seconds: number) => {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + seconds);
  };

  const crackleHp = ctx.createBiquadFilter();
  crackleHp.type = 'highpass';
  crackleHp.frequency.value = 900;
  const crackleGain = ctx.createGain();
  crackleGain.gain.setValueAtTime(0, ctx.currentTime);
  loop(ctx, crackleBuffer(ctx, 5)).connect(crackleHp).connect(crackleGain).connect(master);

  const rainBus = ctx.createGain();
  rainBus.gain.value = 0;
  rainBus.connect(master);

  // The recording joins the bus once it has loaded; the bus's fade-in covers the wait.
  rainLoop(ctx)
    .then((buffer) => loop(ctx, buffer).connect(rainBus))
    .catch((err) => console.warn('[ambience] rain recording unavailable', err));

  const amb: Ambience = {
    rain: false,
    crackle: false,
    paused: false,
    setRain(on) {
      amb.rain = on;
      ramp(rainBus.gain, on ? 1 : 0, on ? 2.5 : 1.2);
    },
    setCrackle(on) {
      amb.crackle = on;
      ramp(crackleGain.gain, on ? 0.18 : 0, on ? 2 : 0.6);
    },
    setPaused(paused) {
      amb.paused = paused;
      ramp(master.gain, paused ? 0 : 1, paused ? 0.4 : 1.2);
    },
  };
  amb.setRain(opts.rain ?? true);
  amb.setCrackle(opts.crackle ?? true);
  return amb;
}
