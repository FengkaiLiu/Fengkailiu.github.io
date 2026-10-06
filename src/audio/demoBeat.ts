// A lofi loop synthesized live in Web Audio: swung drums, a round bass, and a
// Fmaj7 / Em7 / Dm9 / Cmaj9 Rhodes progression. Stands in until real tracks exist.
import { BARS, createKit } from './kit';

const BPM = 78;
const STEP = 60 / BPM / 4; // one 16th note
const SWING = 0.28; // late offbeats, the lazy lofi pocket
const LOOKAHEAD = 0.15;

const PENTA = [65, 67, 69, 72, 74, 77]; // F major pentatonic, for the little melody

export interface DemoBeat {
  stop(): void;
}

export function startDemoBeat(ctx: AudioContext, dest: AudioNode): DemoBeat {
  const kit = createKit(ctx, dest);

  const human = () => (Math.random() - 0.5) * 0.012;
  let step = 0;
  let nextTime = ctx.currentTime + 0.08;

  const schedule = (s: number, t: number) => {
    const barIndex = Math.floor(s / 16) % BARS.length;
    const bar = BARS[barIndex];
    const i = s % 16;
    const even = barIndex % 2 === 0;

    if (i === 0 || (even ? i === 7 || i === 10 : i === 10 || i === 11)) kit.kick(t + human(), i === 0 ? 0.95 : 0.75);
    if (i === 4 || i === 12) kit.snare(t + 0.01 + human(), 0.9);
    // Hats sway a little left and right, for width.
    if (i % 2 === 0) kit.hat(t + human(), i % 4 === 0 ? 0.07 : 0.045, i % 4 === 0 ? -0.3 : 0.3);
    else if (Math.random() < 0.18) kit.hat(t + human(), 0.025, 0.45, 0.03, 8000); // ghost hats

    if (i === 0) bar.chord.forEach((n, k) => kit.keys(t + k * 0.03, n, STEP * 15, 0.075));
    if (i === 11 && !even) bar.chord.slice(2).forEach((n, k) => kit.keys(t + k * 0.02, n, STEP * 4, 0.04));

    if (i === 0) kit.bass(t, bar.bass, STEP * 6);
    if (i === 8) kit.bass(t, bar.bass, STEP * 5);
    if (i === 14) kit.bass(t, bar.bass + (Math.random() < 0.5 ? 7 : 12), STEP * 2);

    if (i % 2 === 0 && i !== 0 && Math.random() < 0.13) {
      kit.keys(t, PENTA[Math.floor(Math.random() * PENTA.length)], STEP * 6, 0.05);
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
      kit.stop();
    },
  };
}
