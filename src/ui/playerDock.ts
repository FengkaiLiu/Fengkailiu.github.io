// The bottom bar: the record player's remote, then volume, rain and record crackle pills.
// While music plays it also pumps the analyser bands into the 3D room every frame. A guest
// in the Spotify embed is out of the analyser's reach, so it gets a beat-shaped pulse instead.
import { getMusicBus, type Bands } from '../audio/bus';
import { setMasterVolume } from '../audio/context';
import { stepAside } from './stepAside';
import { tr } from '../i18n';
import { outsideGuest, type Player, type PlayerState } from '../audio/player';

const BARS = 18;

export function mountPlayerDock(
  player: Player,
  onBands: (b: Bands, playing: boolean, spectrum: Float32Array) => void,
  opts: { canSkip: boolean; onRain(on: boolean): void; onCrackle(on: boolean): void },
) {
  const bar = document.createElement('div');
  bar.className = 'dockbar';
  bar.setAttribute('role', 'region'); // a landmark, so screen readers can jump to the player
  bar.setAttribute('aria-label', tr('Room controls: music, volume, rain, record crackle and scope', '房间控制：音乐、音量、雨声、唱片底噪和示波器'));
  const dock = document.createElement('div');
  dock.className = 'player liquid liquid--pill';
  dock.dataset.liquidBezel = '18';
  dock.setAttribute('role', 'region');
  dock.setAttribute('aria-label', tr('Music player', '音乐播放器'));
  dock.innerHTML = `
    <span class="player__disc" aria-hidden="true"></span>
    <span class="player__meta">
      <span class="player__title" data-title></span>
      <span class="player__artist" data-artist></span>
    </span>
    <canvas class="player__bars" width="${BARS * 6}" height="28" aria-hidden="true"></canvas>
    <span class="player__time" data-time></span>
    <span class="player__controls">
      <button class="player__btn" type="button" data-prev aria-label="${tr('Previous track', '上一首')}">${icon('prev')}</button>
      <button class="player__btn player__btn--main" type="button" data-toggle aria-label="${tr('Play', '播放')}">${icon('play')}</button>
      <button class="player__btn" type="button" data-next aria-label="${tr('Next track', '下一首')}">${icon('next')}</button>
    </span>
  `;

  // Volume: the master gain, so it covers the music, the rain and the room's sounds.
  // (A Spotify preview plays in Spotify's own frame; its volume is set inside the embed.)
  const vol = document.createElement('div');
  vol.className = 'pill pill--volume liquid liquid--pill';
  vol.dataset.liquidBezel = '18';
  vol.innerHTML = `
    <button class="player__btn" type="button" data-mute aria-label="${tr('Mute', '静音')}" title="${tr('Mute', '静音')}"></button>
    <input class="pill__slider" type="range" min="0" max="1" step="0.01" aria-label="${tr('Volume', '音量')}" data-volume />
  `;

  const rain = document.createElement('button');
  rain.type = 'button';
  rain.className = 'pill pill--rain liquid liquid--pill';
  rain.dataset.liquidBezel = '18';
  rain.setAttribute('aria-pressed', 'true');
  rain.title = tr('Rain on the window, and its sound if audio is on', '窗上的雨，开着声音时还有雨声');
  rain.innerHTML = `${icon('rain')}<span class="pill__label" data-rain-label>${tr('Rain on', '雨：开')}</span>`;

  // Record crackle: the vinyl noise under everything. With rain off, crackle off and the
  // volume muted, the page is silent.
  const crackle = document.createElement('button');
  crackle.type = 'button';
  crackle.className = 'pill pill--rain pill--crackle liquid liquid--pill';
  crackle.dataset.liquidBezel = '18';
  crackle.setAttribute('aria-pressed', 'true');
  crackle.title = tr('The record crackle under the room', '房间里的黑胶底噪');
  crackle.innerHTML = `${icon('vinyl')}<span class="pill__label" data-crackle-label>${tr('Crackle on', '底噪：开')}</span>`;

  bar.append(dock, vol, rain, crackle);
  document.body.append(bar);

  const $ = <T extends Element>(sel: string) => dock.querySelector<T>(sel)!;
  const toggleBtn = $<HTMLButtonElement>('[data-toggle]');
  const canvas = $<HTMLCanvasElement>('.player__bars');
  const g = canvas.getContext('2d')!;
  toggleBtn.addEventListener('click', () => void player.toggle());
  $('[data-prev]').addEventListener('click', () => void player.prev());
  $('[data-next]').addEventListener('click', () => void player.next());
  rain.addEventListener('click', () => {
    const on = rain.getAttribute('aria-pressed') !== 'true';
    rain.setAttribute('aria-pressed', String(on));
    rain.querySelector('[data-rain-label]')!.textContent = on ? tr('Rain on', '雨：开') : tr('Rain off', '雨：关');
    opts.onRain(on);
  });
  crackle.addEventListener('click', () => {
    const on = crackle.getAttribute('aria-pressed') !== 'true';
    crackle.setAttribute('aria-pressed', String(on));
    crackle.querySelector('[data-crackle-label]')!.textContent = on ? tr('Crackle on', '底噪：开') : tr('Crackle off', '底噪：关');
    opts.onCrackle(on);
  });

  const slider = vol.querySelector<HTMLInputElement>('[data-volume]')!;
  const muteBtn = vol.querySelector<HTMLButtonElement>('[data-mute]')!;
  let volume = 0.9;
  let lastHeard = 0.9;
  try {
    const saved = Number(localStorage.getItem('room-volume'));
    if (localStorage.getItem('room-volume') !== null && saved >= 0 && saved <= 1) volume = saved;
  } catch {}
  const setVolume = (v: number) => {
    volume = v;
    if (v > 0) lastHeard = v;
    setMasterVolume(v * v); // squared: the slider feels even to the ear
    slider.value = String(v);
    slider.style.setProperty('--fill', `${v * 100}%`);
    muteBtn.innerHTML = icon(v === 0 ? 'muted' : v < 0.5 ? 'low' : 'loud');
    muteBtn.setAttribute('aria-label', v === 0 ? tr('Unmute', '取消静音') : tr('Mute', '静音'));
    try {
      localStorage.setItem('room-volume', String(v));
    } catch {}
  };
  slider.addEventListener('input', () => setVolume(Number(slider.value)));
  muteBtn.addEventListener('click', () => setVolume(volume === 0 ? lastHeard : 0));
  setVolume(volume);
  // Skip buttons only make sense once there is more than one track to skip to.
  if (!opts.canSkip) dock.querySelectorAll<HTMLElement>('[data-prev], [data-next]').forEach((b) => (b.hidden = true));

  const render = (s: PlayerState) => {
    dock.classList.toggle('is-playing', s.playing);
    $('[data-title]').textContent = s.track.title;
    $('[data-artist]').textContent = outsideGuest(s.guest) ? `${s.track.artist} · ${tr('via Spotify', '来自 Spotify')}` : s.track.artist;
    dock.classList.toggle('is-guest', Boolean(s.guest));
    // Spotify sets its own volume inside its frame, so the slider steps aside while it plays.
    stepAside(vol, outsideGuest(s.guest));
    $('[data-time]').textContent = s.time === null ? (s.playing ? tr('live', '实时') : '') : `${fmt(s.time)}${s.duration ? ` / ${fmt(s.duration)}` : ''}`;
    toggleBtn.innerHTML = icon(s.playing ? 'pause' : 'play');
    toggleBtn.setAttribute('aria-label', s.playing ? tr('Pause', '暂停') : tr('Play', '播放'));
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
    if (outsideGuest(guest)) {
      const b = pulse(now / 1000);
      fakeSpectrum(now / 1000);
      onBands(b, playing, spectrum);
      fakeBars(now / 1000);
    } else {
      const b = bus.read(dt);
      bus.spectrumInto(spectrum);
      onBands(b, playing, spectrum);
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
  /** The room's spectrum (fairy lights, laptop): real from the bus, or this stand-in for a guest. */
  const spectrum = new Float32Array(34);
  function fakeSpectrum(t: number) {
    const kick = Math.exp(-(((t * 100) / 60) % 1) * 5);
    const n = spectrum.length;
    for (let i = 0; i < n; i++) {
      const wobble = 0.5 + 0.5 * Math.sin(t * (1.7 + i * 0.29) + i * 2.3);
      spectrum[i] = Math.min(1, (1 - i / (n * 1.5)) * (0.2 + 0.35 * wobble + (i < 8 ? 0.45 : 0.1) * kick));
    }
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
    /** The bottom bar, so other pills (the scope) can join the row. */
    bar,
    show() {
      bar.classList.add('is-shown');
    },
  };
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function icon(name: 'play' | 'pause' | 'prev' | 'next' | 'rain' | 'vinyl' | 'muted' | 'low' | 'loud') {
  const paths = {
    play: '<path d="M8 5.5v13l11-6.5z" />',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" />',
    prev: '<path d="M18 6v12l-8.5-6zM6 6h2v12H6z" />',
    next: '<path d="M6 6v12l8.5-6zM16 6h2v12h-2z" />',
    muted: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path class="icon-line" d="M15.5 9.5l5 5M20.5 9.5l-5 5" />',
    low: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path class="icon-line" d="M15.5 9a4 4 0 0 1 0 6" />',
    loud: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path class="icon-line" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />',
    vinyl: '<circle cx="12" cy="12" r="8.5" /><circle class="player__vinyl-label" cx="12" cy="12" r="2.6" /><path class="player__drops" d="M18.5 4.5l1.2-1.2M20.2 7.6l1.4-.4M16 2.6l.3-1.4" />',
    rain: '<path d="M7 15.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.45 1.47A3.75 3.75 0 0 1 17.25 15.5z" /><path class="player__drops" d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5" />',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
