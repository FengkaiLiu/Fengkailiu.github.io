// The Lab: "How this room hears". Two views in the chapter card:
//   Signal graph: the page's real Web Audio graph as a diagram; nodes light up and
//     connections flow while sound passes through them.
//   FFT playground: pick a waveform and a pitch, see the samples and the spectrum from a
//     hand-written FFT; a window switch shows leakage, and the tone can play in the room.
import { getMusicBus } from '../audio/bus';
import { getAudio, unlockAudio } from '../audio/context';
import { fftMagnitudes, hann } from '../viz/fft';
import { tr } from '../i18n';

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
  { id: 'demo', x: 8, y: 20, w: 128, title: tr('Demo loop', '演示循环'), sub: tr('drums · bass · Rhodes', '鼓 · 贝斯 · Rhodes') },
  { id: 'keys', x: 8, y: 80, w: 128, title: tr('Your keys', '你弹的键'), sub: tr('the desk keyboard', '桌上的键盘') },
  { id: 'tone', x: 8, y: 140, w: 128, title: tr('Lab tone', '实验音'), sub: tr('the FFT playground', 'FFT 试验台') },
  { id: 'amb', x: 8, y: 212, w: 128, title: tr('Rain + vinyl', '雨声 + 黑胶'), sub: tr('ambience', '环境音') },
  { id: 'spotify', x: 8, y: 272, w: 128, title: 'Spotify', sub: tr('plays in its own frame', '在独立的 iframe 里播放'), outside: true },
  { id: 'lofi', x: 166, y: 20, w: 120, title: tr('Lofi chain', 'Lofi 效果链'), sub: tr('lowpass · tanh · reverb', '低通 · tanh · 混响') },
  { id: 'bus', x: 296, y: 84, w: 126, title: tr('Music bus', '音乐总线'), sub: tr('gain', '增益') },
  { id: 'analyser', x: 296, y: 160, w: 126, title: tr('Analyser', '分析器'), sub: tr('FFT, 2048 points', 'FFT，2048 点') },
  { id: 'room', x: 470, y: 50, w: 162, title: tr('The room', '房间'), sub: tr('lights · laptop · scope', '灯光 · 笔记本 · 示波器'), outside: true },
  { id: 'master', x: 470, y: 160, w: 162, title: tr('Master', '主输出'), sub: tr('volume', '音量') },
  { id: 'speakers', x: 470, y: 250, w: 162, title: tr('Speakers', '扬声器'), sub: tr('your device', '你的设备') },
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
  { id: 'sine', name: tr('Sine', '正弦波') },
  { id: 'pair', name: tr('Two sines', '双正弦') },
  { id: 'square', name: tr('Square', '方波') },
  { id: 'saw', name: tr('Saw', '锯齿波') },
] as const;
type Wave = (typeof WAVES)[number]['id'];

const N = 256;
const RATE = 8000; // the playground's own sample rate: 31.25 Hz per bin
const SHOW_BINS = 64; // up to 2 kHz
const HANN = hann(N);

export function mountLab(slot: HTMLElement, state: () => LabState) {
  slot.innerHTML = `
    <div class="lab">
      <div class="lab__tabs" role="tablist" aria-label="${tr('Lab view', '实验室视图')}">
        <button class="lab__tab" type="button" role="tab" aria-selected="true" data-view="graph">${tr('Signal graph', '信号图')}</button>
        <button class="lab__tab" type="button" role="tab" aria-selected="false" data-view="fft">${tr('FFT playground', 'FFT 试验台')}</button>
      </div>

      <div class="lab__view" data-panel="graph">
        <svg class="graph" viewBox="0 0 640 316" role="img" aria-label="${tr(
          "Diagram of this page's audio graph: sources flow into a music bus, through an analyser and the master volume to the speakers; the analyser also feeds the room's visuals.",
          '这个页面的音频图示意：各个声源汇入音乐总线，经过分析器和主音量送到扬声器；分析器同时驱动房间里的视觉效果。',
        )}">
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
        <p class="lab__caption">${tr(
          "Live: a node glows while sound passes through it. Solid lines carry audio; dashed ones carry data (the analyser's numbers feed the room's lights and meters) or, for Spotify, sound the page can't touch.",
          '实时：声音流经某个节点时，节点会亮起。实线传递音频；虚线传递数据（分析器的数值驱动房间的灯光和电平表），Spotify 那条则是页面碰不到的声音。',
        )}</p>
      </div>

      <div class="lab__view" data-panel="fft" hidden>
        <div class="fft">
          <div class="fft__controls">
            <div class="fft__waves" role="radiogroup" aria-label="${tr('Waveform', '波形')}">
              ${WAVES.map((w, i) => `<button class="fft__wave" type="button" role="radio" aria-checked="${i === 0}" data-wave="${w.id}">${w.name}</button>`).join('')}
            </div>
            <label class="fft__freq">
              <span>${tr('Pitch', '音高')} <output data-freq-out></output></span>
              <input type="range" min="0" max="1" step="0.001" value="0.42" data-freq />
            </label>
            <div class="fft__toggles">
              <button class="fft__toggle" type="button" aria-pressed="false" data-window>${tr('Hann window', '汉宁窗')}</button>
              <button class="fft__toggle" type="button" aria-pressed="false" data-listen>${tr('Play it in the room', '在房间里播放')}</button>
            </div>
          </div>
          <div class="fft__plots">
            <figure><canvas data-wave-canvas></canvas><figcaption>${tr('256 samples in time', '时域上的 256 个采样')}</figcaption></figure>
            <figure><canvas data-spec-canvas></canvas><figcaption>${tr('FFT magnitude per bin (31.25 Hz each)', '每个频点的 FFT 幅度（每格 31.25 Hz）')}</figcaption></figure>
          </div>
          <p class="fft__readout" aria-live="polite" data-readout></p>
          <p class="lab__caption">${tr(
            "Any sound is a sum of sine waves; the FFT finds how much of each. A pure sine lands in one bin, a square adds odd harmonics, a saw every harmonic. When the pitch falls between bins, energy smears into neighbours (leakage); the Hann window tapers the frame's edges to tame it. This one is a 40-line radix-2 Cooley-Tukey FFT in TypeScript: bit-reverse, then 8 stages of butterflies.",
            '任何声音都可以拆成正弦波的叠加，FFT 算出每个频率各占多少。纯正弦波只落在一个频点上，方波会加上奇次谐波，锯齿波则包含所有谐波。音高落在两个频点之间时，能量会扩散到相邻频点（频谱泄漏）；汉宁窗把每一帧的两端逐渐压低来抑制它。这里用的是一个 40 行的 TypeScript radix-2 Cooley-Tukey FFT：先做位反转，再做 8 级蝶形运算。',
          )}</p>
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
      subEls.get('bus')!.textContent = rms > 1e-4 ? `${tr('gain', '增益')} · ${(20 * Math.log10(rms)).toFixed(0)} dBFS` : tr('gain · silent', '增益 · 无声');
      const hz = bus.analyser.context.sampleRate / bus.analyser.fftSize;
      subEls.get('analyser')!.textContent = tr(`FFT · ${hz.toFixed(1)} Hz bins`, `FFT · 每格 ${hz.toFixed(1)} Hz`);
      const vol = getAudio().master.gain.value;
      subEls.get('master')!.textContent = `${tr('volume', '音量')} · ${Math.round(Math.sqrt(vol) * 100)}%`;
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
    const peakHz = Math.round(peak * (RATE / N));
    const spread = (leak * 100).toFixed(0);
    $('[data-readout]').textContent = tr(
      `Strongest: bin ${peak} · ${peakHz} Hz. Spread outside it: ${spread}% of the peak.`,
      `最强：第 ${peak} 个频点 · ${peakHz} Hz。泄漏到其他频点的能量：峰值的 ${spread}%。`,
    );
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
