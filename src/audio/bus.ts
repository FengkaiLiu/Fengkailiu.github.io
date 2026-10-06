// The music bus: everything the player makes flows through one analyser on its way to
// the speakers, so the room and the visualizers all read the same signal.
import { getAudio } from './context';

export interface Bands {
  bass: number;
  mid: number;
  treble: number;
  level: number;
}

export interface MusicBus {
  input: GainNode;
  analyser: AnalyserNode;
  /** Per-channel analysers for stereo views (the vectorscope). */
  left: AnalyserNode;
  right: AnalyserNode;
  /** A long FFT (about 6 Hz bins) for pitch: tells neighbouring notes apart down in the bass. */
  fine: AnalyserNode;
  /** Smoothed 0..1 bands. Call once per frame. */
  read(dt: number): Bands;
}

let bus: MusicBus | null = null;

export function getMusicBus(): MusicBus {
  if (bus) return bus;
  const { ctx, master } = getAudio();
  const input = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;
  input.connect(analyser);
  analyser.connect(master);
  // Side branch: split the channels for stereo analysis. Analysers pass nothing on, so
  // this taps the signal without changing what reaches the speakers.
  const splitter = ctx.createChannelSplitter(2);
  const left = ctx.createAnalyser();
  const right = ctx.createAnalyser();
  left.fftSize = right.fftSize = 2048;
  input.connect(splitter);
  const fine = ctx.createAnalyser();
  fine.fftSize = 8192;
  fine.smoothingTimeConstant = 0.5;
  input.connect(fine);
  splitter.connect(left, 0);
  splitter.connect(right, 1);

  const freq = new Uint8Array(analyser.frequencyBinCount);
  const wave = new Float32Array(analyser.fftSize);
  const hz = ctx.sampleRate / analyser.fftSize;
  const bin = (f: number) => Math.min(Math.round(f / hz), freq.length - 1);
  const ranges = { bass: [bin(30), bin(150)], mid: [bin(150), bin(2000)], treble: [bin(2000), bin(10000)] } as const;
  const avg = ([a, b]: readonly [number, number]) => {
    let s = 0;
    for (let i = a; i <= b; i++) s += freq[i];
    return s / ((b - a + 1) * 255);
  };

  const out: Bands = { bass: 0, mid: 0, treble: 0, level: 0 };
  // Fast attack, slow release: hits pop, then fall gently like a VU needle.
  const follow = (key: keyof Bands, target: number, dt: number) => {
    const rate = target > out[key] ? 30 : 5;
    out[key] += (target - out[key]) * (1 - Math.exp(-dt * rate));
  };

  bus = {
    input,
    analyser,
    left,
    right,
    fine,
    read(dt) {
      analyser.getByteFrequencyData(freq);
      analyser.getFloatTimeDomainData(wave);
      let sq = 0;
      for (let i = 0; i < wave.length; i++) sq += wave[i] * wave[i];
      const rms = Math.sqrt(sq / wave.length);
      // Raw averages sit low; expand them so a normal mix uses most of 0..1.
      follow('bass', Math.min(Math.max(avg(ranges.bass) * 1.6 - 0.25, 0), 1), dt);
      follow('mid', Math.min(Math.max(avg(ranges.mid) * 2.0 - 0.15, 0), 1), dt);
      follow('treble', Math.min(avg(ranges.treble) * 3.0, 1), dt);
      follow('level', Math.min(rms * 4, 1), dt);
      return out;
    },
  };
  return bus;
}
