// Power-on chime, synthesized live: a rising Cmaj9 arpeggio of FM glass bells over a
// soft pad, through a generated reverb. A nod to the Vista/7 startup sound.
import { getAudio, makeReverb } from './context';

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function playStartupChime() {
  const { ctx, master } = getAudio();
  const now = ctx.currentTime + 0.05;

  const out = ctx.createGain();
  out.gain.value = 0.55;
  const reverb = makeReverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  out.connect(master);
  out.connect(reverb).connect(wet).connect(master);

  // Glass bells: sine carrier with a 3.5:1 modulator, the modulation index decays fast.
  const bells = [60, 64, 67, 71, 74, 79]; // C4 E4 G4 B4 D5 G5
  bells.forEach((note, i) => {
    const t = now + i * 0.11;
    const f = midiToHz(note + 12);
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    const pan = ctx.createStereoPanner();

    carrier.frequency.value = f;
    mod.frequency.value = f * 3.5;
    modGain.gain.setValueAtTime(f * 2.2, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    pan.pan.value = (i / (bells.length - 1)) * 1.2 - 0.6;

    mod.connect(modGain).connect(carrier.frequency);
    carrier.connect(amp).connect(pan).connect(out);
    mod.start(t);
    carrier.start(t);
    mod.stop(t + 2.5);
    carrier.stop(t + 2.5);
  });

  // Warm pad swelling underneath.
  const pad = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, now);
  lp.frequency.exponentialRampToValueAtTime(2400, now + 1.6);
  pad.gain.setValueAtTime(0.0001, now);
  pad.gain.exponentialRampToValueAtTime(0.07, now + 0.9);
  pad.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);
  pad.connect(lp).connect(out);
  for (const note of [48, 55, 64, 71]) {
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToHz(note);
      osc.detune.value = detune;
      osc.connect(pad);
      osc.start(now);
      osc.stop(now + 4.3);
    }
  }
}
