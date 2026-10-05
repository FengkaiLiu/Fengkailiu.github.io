// The one AudioContext for the whole site. Browsers only allow audio after a user
// gesture, so it is created and resumed from the startup gate's click.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function getAudio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  return { ctx, master: master! };
}

export async function unlockAudio() {
  const { ctx } = getAudio();
  if (ctx.state !== 'running') await ctx.resume();
}

/** Synthesized reverb impulse: decaying stereo noise. No sample files needed. */
export function makeReverb(ctx: BaseAudioContext, seconds = 2.8, decay = 3): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buffer;
  return conv;
}
