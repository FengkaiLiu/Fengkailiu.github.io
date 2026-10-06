// The Lab: "How this room hears". Two views in the chapter card:
//   Signal graph: the page's real Web Audio graph as a diagram; nodes light up and
//     connections flow while sound passes through them.
//   FFT playground: pick a waveform and a pitch, see the samples and the spectrum from a
//     hand-written FFT; a window switch shows leakage, and the tone can play in the room.
import { getMusicBus } from '../audio/bus';
import { getAudio, unlockAudio } from '../audio/context';
import { fftMagnitudes, hann } from '../viz/fft';

export interface LabState {
  /** The room's own music is playing (demo loop or a track). */
  music: boolean;
  /** A Spotify pick is playing in its own frame. */
  guest: boolean;
  /** Rain and vinyl crackle are running (entered with sound). */
  ambience: boolean;
  /** When a desk key was last played (performance.now()). */
  keysAt: number;
}

type NodeId = 'demo' | 'keys' | 'tone' | 'amb' | 'spotify' | 'lofi' | 'bus' | 'analyser' | 'master' | 'speakers' | 'room';
interface GNode {
  id: NodeId;
  x: number;
  y: number;
  w: number;
  title: string;
  sub: string;
  /** Not part of the audio graph (data taps, Spotify's own frame): drawn dashed. */
  outside?: boolean;
}
const H = 36;
const NODES: GNode[] = [
  { id: 'demo', x: 8, y: 20, w: 128, title: 'Demo loop', sub: 'drums · bass · Rhodes' },
  { id: 'keys', x: 8, y: 80, w: 128, title: 'Your keys', sub: 'the desk keyboard' },
  { id: 'tone', x: 8, y: 140, w: 128, title: 'Lab tone', sub: 'the FFT playground' },
  { id: 'amb', x: 8, y: 212, w: 128, title: 'Rain + vinyl', sub: 'ambience' },
  { id: 'spotify', x: 8, y: 272, w: 128, title: 'Spotify', sub: 'plays in its own frame', outside: true },
  { id: 'lofi', x: 166, y: 20, w: 120, title: 'Lofi chain', sub: 'lowpass · tanh · reverb' },
  { id: 'bus', x: 296, y: 84, w: 126, title: 'Music bus', sub: 'gain' },
  { id: 'analyser', x: 296, y: 160, w: 126, title: 'Analyser', sub: 'FFT, 2048 points' },
  { id: 'room', x: 470, y: 50, w: 162, title: 'The room', sub: 'lights · laptop · scope', outside: true },
  { id: 'master', x: 470, y: 160, w: 162, title: 'Master', sub: 'volume' },
  { id: 'speakers', x: 470, y: 250, w: 162, title: 'Speakers', sub: 'your device' },
];
type Edge = { from: NodeId; to: NodeId; d: string; data?: boolean };
const EDGES: Edge[] = [
  { from: 'demo', to: 'lofi', d: 'M136 38 H166' },
  { from: 'lofi', to: 'bus', d: 'M286 38 C320 38 344 50 359 84' },
  { from: 'keys', to: 'bus', d: 'M136 98 H296' },
  { from: 'tone', to: 'bus', d: 'M136 158 C220 158 250 112 296 110' },
  { from: 'bus', to: 'analyser', d: 'M359 120 V160' },
  { from: 'analyser', to: 'master', d: 'M422 178 H470' },
  { from: 'analyser', to: 'room', d: 'M422 168 C446 160 446 70 470 68', data: true },
  { from: 'master', to: 'speakers', d: 'M551 196 V250' },
  { from: 'amb', to: 'master', d: 'M136 230 C300 230 380 192 470 188' },
  { from: 'spotify', to: 'speakers', d: 'M136 290 C300 290 380 270 470 268', data: true },
];

const WAVES = [
  { id: 'sine', name: 'Sine' },
  { id: 'pair', name: 'Two sines' },
  { id: 'square', name: 'Square' },
  { id: 'saw', name: 'Saw' },
] as const;
type Wave = (typeof WAVES)[number]['id'];

const N = 256;
const RATE = 8000; // the playground's own sample rate: 31.25 Hz per bin
const SHOW_BINS = 64; // up to 2 kHz
const HANN = hann(N);

export function mountLab(slot: HTMLElement, state: () => LabState) {
  slot.innerHTML = `
    <div class="lab">
      <div class="lab__tabs" role="tablist" aria-label="Lab view">
        <button class="lab__tab" type="button" role="tab" aria-selected="true" data-view="graph">Signal graph</button>
        <button class="lab__tab" type="button" role="tab" aria-selected="false" data-view="fft">FFT playground</button>
      </div>

      <div class="lab__view" data-panel="graph">
        <svg class="graph" viewBox="0 0 640 316" role="img" aria-label="Diagram of this page's audio graph: sources flow into a music bus, through an analyser and the master volume to the speakers; the analyser also feeds the room's visuals.">
          ${EDGES.map((e, i) => `<path class="graph__edge${e.data ? ' graph__edge--data' : ''}" d="${e.d}" data-edge="${i}" />`).join('')}
          ${NODES.map(
            (n) => `
            <g class="graph__node${n.outside ? ' graph__node--outside' : ''}" data-node="${n.id}" transform="translate(${n.x} ${n.y})">
              <rect width="${n.w}" height="${H}" rx="9" />
              <text x="10" y="15" class="graph__title">${n.title}</text>
              <text x="10" y="28" class="graph__sub" data-sub="${n.id}">${n.sub}</text>
            </g>`,
          ).join('')}
        </svg>
        <p class="lab__caption">Live: a node glows while sound passes through it. Solid lines carry audio; dashed ones carry data (the analyser's numbers feed the room's lights and meters) or, for Spotify, sound the page can't touch.</p>
      </div>

      <div class="lab__view" data-panel="fft" hidden>
        <div class="fft">
          <div class="fft__controls">
            <div class="fft__waves" role="radiogroup" aria-label="Waveform">
              ${WAVES.map((w, i) => `<button class="fft__wave" type="button" role="radio" aria-checked="${i === 0}" data-wave="${w.id}">${w.name}</button>`).join('')}
            </div>
            <label class="fft__freq">
              <span>Pitch <output data-freq-out></output></span>
              <input type="range" min="0" max="1" step="0.001" value="0.42" data-freq />
            </label>
            <div class="fft__toggles">
              <button class="fft__toggle" type="button" aria-pressed="false" data-window>Hann window</button>
              <button class="fft__toggle" type="button" aria-pressed="false" data-listen>Play it in the room</button>
            </div>
          </div>
          <div class="fft__plots">
            <figure><canvas data-wave-canvas></canvas><figcaption>256 samples in time</figcaption></figure>
            <figure><canvas data-spec-canvas></canvas><figcaption>FFT magnitude per bin (31.25 Hz each)</figcaption></figure>
          </div>
          <p class="fft__readout" aria-live="polite" data-readout></p>
          <p class="lab__caption">Any sound is a sum of sine waves; the FFT finds how much of each. A pure sine lands in one bin, a square adds odd harmonics, a saw every harmonic. When the pitch falls between bins, energy smears into neighbours (leakage); the Hann window tapers the frame's edges to tame it. This one is a 40-line radix-2 Cooley-Tukey FFT in TypeScript: bit-reverse, then 8 stages of butterflies.</p>
        </div>
      </div>
    </div>
  `;

  const $ = <T extends Element>(sel: string) => slot.querySelector<T>(sel)!;
  let view: 'graph' | 'fft' = 'graph';
  slot.querySelector('.lab__tabs')!.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-view]')?.dataset.view as typeof view | undefined;
    if (!v) return;
    view = v;
    slot.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
    slot.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== v));
    if (v === 'fft') drawFft();
  });

  // ---------- Signal graph ----------
  const nodeEls = new Map(NODES.map((n) => [n.id, slot.querySelector<SVGGElement>(`[data-node="${n.id}"]`)!]));
  const edgeEls = EDGES.map((_, i) => slot.querySelector<SVGPathElement>(`[data-edge="${i}"]`)!);
  const subEls = new Map(NODES.map((n) => [n.id, slot.querySelector<SVGTextElement>(`[data-sub="${n.id}"]`)!]));
  const wave = new Float32Array(2048);
  let lastSubs = 0;
  const updateGraph = (now: number) => {
    const s = state();
    const keys = now - s.keysAt < 1800;
    const live: Record<NodeId, boolean> = {
      demo: s.music,
      lofi: s.music,
      keys,
      tone: toneOn,
      amb: s.ambience,
      spotify: s.guest,
      bus: s.music || keys || toneOn,
      analyser: s.music || keys || toneOn,
      room: s.music || keys || toneOn || s.guest,
      master: s.music || keys || toneOn || s.ambience,
      speakers: s.music || keys || toneOn || s.ambience || s.guest,
    };
    for (const [id, el] of nodeEls) el.classList.toggle('is-live', live[id]);
    EDGES.forEach((e, i) => edgeEls[i].classList.toggle('is-live', live[e.from] && live[e.to]));
    // Live readouts, a few times a second.
    if (now - lastSubs > 250) {
      lastSubs = now;
      const bus = getMusicBus();
      bus.analyser.getFloatTimeDomainData(wave);
      let sq = 0;
      for (let i = 0; i < wave.length; i++) sq += wave[i] * wave[i];
      const rms = Math.sqrt(sq / wave.length);
      subEls.get('bus')!.textContent = rms > 1e-4 ? `gain · ${(20 * Math.log10(rms)).toFixed(0)} dBFS` : 'gain · silent';
      const hz = bus.analyser.context.sampleRate / bus.analyser.fftSize;
      subEls.get('analyser')!.textContent = `FFT · ${hz.toFixed(1)} Hz bins`;
      const vol = getAudio().master.gain.value;
      subEls.get('master')!.textContent = `volume · ${Math.round(Math.sqrt(vol) * 100)}%`;
    }
  };

  // ---------- FFT playground ----------
  let waveform: Wave = 'sine';
  let windowed = false;
  const freqInput = $<HTMLInputElement>('[data-freq]');
  // Log-scaled slider, 55 Hz (A1) to 1760 Hz (A6).
  const freqOf = () => 55 * Math.pow(32, Number(freqInput.value));
  const waveCanvas = $<HTMLCanvasElement>('[data-wave-canvas]');
  const specCanvas = $<HTMLCanvasElement>('[data-spec-canvas]');
  const samples = new Float32Array(N);

  const synth = (f: number) => {
    for (let i = 0; i < N; i++) {
      const ph = (f * i) / RATE;
      const p = ph - Math.floor(ph);
      let v = 0;
      if (waveform === 'sine') v = Math.sin(2 * Math.PI * ph);
      else if (waveform === 'pair') v = 0.6 * Math.sin(2 * Math.PI * ph) + 0.4 * Math.sin(2 * Math.PI * ph * 2.5);
      else if (waveform === 'square') v = p < 0.5 ? 0.8 : -0.8;
      else v = 2 * p - 1;
      samples[i] = v * (windowed ? HANN[i] : 1);
    }
  };

  const fit = (c: HTMLCanvasElement) => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (w && h && (c.width !== w || c.height !== h)) {
      c.width = w;
      c.height = h;
    }
    return { g: c.getContext('2d')!, w: c.width, h: c.height, dpr };
  };

  const drawFft = () => {
    const f = freqOf();
    $('[data-freq-out]').textContent = `${Math.round(f)} Hz`;
    synth(f);
    const mags = fftMagnitudes(samples);

    // Samples: dots on stems, so it reads as discrete numbers, not a smooth line.
    {
      const { g, w, h, dpr } = fit(waveCanvas);
      g.fillStyle = '#120d24';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      g.lineWidth = dpr;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
      const shown = 96; // the first 96 samples, so the wave's shape is legible
      for (let i = 0; i < shown; i++) {
        const x = ((i + 0.5) / shown) * w;
        const y = h / 2 - samples[i] * h * 0.4;
        g.strokeStyle = 'rgba(255, 157, 77, 0.35)';
        g.beginPath();
        g.moveTo(x, h / 2);
        g.lineTo(x, y);
        g.stroke();
        g.fillStyle = '#ffd59e';
        g.fillRect(x - 1.5 * dpr, y - 1.5 * dpr, 3 * dpr, 3 * dpr);
      }
    }
    // Spectrum: one bar per bin, the strongest labelled.
    let peak = 1;
    {
      const { g, w, h, dpr } = fit(specCanvas);
      g.fillStyle = '#120d24';
      g.fillRect(0, 0, w, h);
      let max = 0;
      for (let k = 1; k < SHOW_BINS; k++) if (mags[k] > max) [max, peak] = [mags[k], k];
      const slot = w / SHOW_BINS;
      for (let k = 0; k < SHOW_BINS; k++) {
        const v = Math.min(mags[k] / 0.85, 1);
        const bh = Math.max(dpr, v * (h - 16 * dpr));
        g.fillStyle = k === peak ? '#ff9d4d' : 'rgba(255, 143, 177, 0.7)';
        g.fillRect(k * slot + slot * 0.15, h - bh, slot * 0.7, bh);
      }
      g.fillStyle = 'rgba(255, 246, 236, 0.45)';
      g.font = `${10 * dpr}px "JetBrains Mono Variable", monospace`;
      for (const [k, t] of [[16, '500'], [32, '1k'], [48, '1.5k']] as const) g.fillText(t, k * slot, 12 * dpr);
    }
    const leak = mags.reduce((s, m, k) => (Math.abs(k - peak) > 1 ? s + m : s), 0) / Math.max(mags[peak], 1e-6);
    $('[data-readout]').textContent = `Strongest: bin ${peak} · ${Math.round(peak * (RATE / N))} Hz. Spread outside it: ${(leak * 100).toFixed(0)}% of the peak.`;
    retune();
  };

  slot.querySelector('.fft__waves')!.addEventListener('click', (e) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>('[data-wave]')?.dataset.wave as Wave | undefined;
    if (!w) return;
    waveform = w;
    slot.querySelectorAll<HTMLElement>('[data-wave]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.wave === w)));
    drawFft();
    if (toneOn) startTone(); // new waveform, new oscillators
  });
  freqInput.addEventListener('input', drawFft);
  const windowBtn = $<HTMLButtonElement>('[data-window]');
  windowBtn.addEventListener('click', () => {
    windowed = !windowed;
    windowBtn.setAttribute('aria-pressed', String(windowed));
    drawFft();
  });

  // "Play it in the room": the same tone, quietly, into the music bus.
  let toneOn = false;
  let oscs: OscillatorNode[] = [];
  let toneGain: GainNode | null = null;
  const stopTone = () => {
    const { ctx } = getAudio();
    toneGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    const old = oscs;
    window.setTimeout(() => old.forEach((o) => o.stop()), 300);
    oscs = [];
    toneGain = null;
  };
  const startTone = () => {
    stopTone();
    const { ctx } = getAudio();
    toneGain = ctx.createGain();
    toneGain.gain.value = 0;
    toneGain.gain.setTargetAtTime(waveform === 'sine' || waveform === 'pair' ? 0.09 : 0.045, ctx.currentTime, 0.05);
    toneGain.connect(getMusicBus().input);
    const parts: [OscillatorType, number, number][] =
      waveform === 'pair' ? [['sine', 1, 0.6], ['sine', 2.5, 0.4]] : [[waveform === 'saw' ? 'sawtooth' : waveform === 'square' ? 'square' : 'sine', 1, 1]];
    oscs = parts.map(([type, mult, amp]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freqOf() * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(toneGain!);
      o.start();
      (o as OscillatorNode & { mult: number }).mult = mult;
      return o;
    });
  };
  const retune = () => {
    if (!toneOn) return;
    const { ctx } = getAudio();
    for (const o of oscs) o.frequency.setTargetAtTime(freqOf() * (o as OscillatorNode & { mult: number }).mult, ctx.currentTime, 0.02);
  };
  const listenBtn = $<HTMLButtonElement>('[data-listen]');
  listenBtn.addEventListener('click', async () => {
    toneOn = !toneOn;
    listenBtn.setAttribute('aria-pressed', String(toneOn));
    if (toneOn) {
      await unlockAudio();
      startTone();
    } else stopTone();
  });

  // Only animate while the Lab is on screen; stop the tone when you scroll away.
  let visible = false;
  let raf = 0;
  const loop = (now: number) => {
    if (view === 'graph') updateGraph(now);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
    if (!visible && toneOn) listenBtn.click();
  }).observe(slot);
  drawFft();
}
