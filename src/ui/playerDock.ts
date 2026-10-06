// The record player's remote: a liquid glass capsule docked at the bottom of the page.
// While music plays it also pumps the analyser bands into the 3D room every frame. A guest
// in the Spotify embed is out of the analyser's reach, so it gets a beat-shaped pulse instead.
import { getMusicBus, type Bands } from '../audio/bus';
import type { Player, PlayerState } from '../audio/player';

const BARS = 18;

export function mountPlayerDock(player: Player, onBands: (b: Bands, playing: boolean) => void, opts: { canSkip: boolean }) {
  const dock = document.createElement('div');
  dock.className = 'player liquid liquid--pill';
  dock.dataset.liquidBezel = '18';
  dock.setAttribute('role', 'region');
  dock.setAttribute('aria-label', 'Music player');
  dock.innerHTML = `
    <span class="player__disc" aria-hidden="true"></span>
    <span class="player__meta">
      <span class="player__title" data-title></span>
      <span class="player__artist" data-artist></span>
    </span>
    <canvas class="player__bars" width="${BARS * 6}" height="28" aria-hidden="true"></canvas>
    <span class="player__time" data-time></span>
    <span class="player__controls">
      <button class="player__btn" type="button" data-prev aria-label="Previous track">${icon('prev')}</button>
      <button class="player__btn player__btn--main" type="button" data-toggle aria-label="Play">${icon('play')}</button>
      <button class="player__btn" type="button" data-next aria-label="Next track">${icon('next')}</button>
    </span>
  `;
  document.body.append(dock);

  const $ = <T extends Element>(sel: string) => dock.querySelector<T>(sel)!;
  const toggleBtn = $<HTMLButtonElement>('[data-toggle]');
  const canvas = $<HTMLCanvasElement>('.player__bars');
  const g = canvas.getContext('2d')!;
  toggleBtn.addEventListener('click', () => void player.toggle());
  $('[data-prev]').addEventListener('click', () => void player.prev());
  $('[data-next]').addEventListener('click', () => void player.next());
  // Skip buttons only make sense once there is more than one track to skip to.
  if (!opts.canSkip) dock.querySelectorAll<HTMLElement>('[data-prev], [data-next]').forEach((b) => (b.hidden = true));

  const render = (s: PlayerState) => {
    dock.classList.toggle('is-playing', s.playing);
    $('[data-title]').textContent = s.track.title;
    $('[data-artist]').textContent = s.guest ? `${s.track.artist} · via Spotify` : s.track.artist;
    dock.classList.toggle('is-guest', Boolean(s.guest));
    $('[data-time]').textContent = s.time === null ? (s.playing ? 'live' : '') : `${fmt(s.time)}${s.duration ? ` / ${fmt(s.duration)}` : ''}`;
    toggleBtn.innerHTML = icon(s.playing ? 'pause' : 'play');
    toggleBtn.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
  };
  player.onChange(render);
  render(player.state());

  // Analyser loop: runs while playing, then a moment longer so the bars fall to rest.
  let raf = 0;
  let last = performance.now();
  let quietFor = 0;
  const freq = new Uint8Array(BARS);
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const bus = getMusicBus();
    const { playing, guest } = player.state();
    if (guest) {
      onBands(pulse(now / 1000), playing);
      fakeBars(now / 1000);
    } else {
      onBands(bus.read(dt), playing);
      readBars(bus.analyser);
    }
    paintBars();
    quietFor = playing ? 0 : quietFor + dt;
    raf = quietFor < 1.5 ? requestAnimationFrame(frame) : 0;
  };
  player.onChange((s) => {
    if (s.playing && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  // Roughly 100 BPM: a kick-like swell each beat, with the mids breathing every bar.
  const pulsed: Bands = { bass: 0, mid: 0, treble: 0, level: 0 };
  function pulse(t: number): Bands {
    const beat = (t * 100) / 60;
    const kick = Math.exp(-(beat % 1) * 5);
    pulsed.bass = 0.25 + 0.6 * kick;
    pulsed.mid = 0.35 + 0.15 * Math.sin((beat / 4) * Math.PI * 2) + 0.1 * kick;
    pulsed.treble = 0.25 + 0.15 * Math.exp(-((beat + 0.5) % 1) * 7);
    pulsed.level = 0.45 + 0.3 * kick;
    return pulsed;
  }
  function fakeBars(t: number) {
    const kick = Math.exp(-(((t * 100) / 60) % 1) * 5);
    for (let i = 0; i < BARS; i++) {
      const tilt = 1 - i / (BARS * 1.4); // falls toward the treble, like a real mix
      const wobble = 0.5 + 0.5 * Math.sin(t * (2.1 + i * 0.37) + i * 1.7);
      freq[i] = 255 * Math.min(1, tilt * (0.3 + 0.35 * wobble + (i < 5 ? 0.4 * kick : 0.12 * kick)));
    }
  }

  const full = new Uint8Array(1024);
  function readBars(analyser: AnalyserNode) {
    analyser.getByteFrequencyData(full);
    // Log-spaced bins so the bars read like a real spectrum, not all treble.
    for (let i = 0; i < BARS; i++) {
      const a = Math.floor(2 * Math.pow(400 / 2, i / BARS));
      const b = Math.max(a + 1, Math.floor(2 * Math.pow(400 / 2, (i + 1) / BARS)));
      let s = 0;
      for (let k = a; k < b; k++) s += full[k];
      freq[i] = s / (b - a);
    }
  }
  function paintBars() {
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(2, (freq[i] / 255) * canvas.height);
      const grad = g.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, '#ff9d4d');
      grad.addColorStop(1, '#ffd59e');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(i * 6 + 1, canvas.height - h, 4, h, 2);
      g.fill();
    }
  }

  return {
    show() {
      dock.classList.add('is-shown');
    },
  };
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function icon(name: 'play' | 'pause' | 'prev' | 'next') {
  const paths = {
    play: '<path d="M8 5.5v13l11-6.5z" />',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" />',
    prev: '<path d="M18 6v12l-8.5-6zM6 6h2v12H6z" />',
    next: '<path d="M6 6v12l8.5-6zM16 6h2v12h-2z" />',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
