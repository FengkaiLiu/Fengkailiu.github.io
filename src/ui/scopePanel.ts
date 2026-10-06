// The scope: a glass panel above the bottom bar with five live visualizers of whatever the
// room is playing, plus running tempo and key estimates. Opened from a "Scope" pill.
import { getMusicBus } from '../audio/bus';
import type { Player } from '../audio/player';
import { createAnalysis, type Analysis } from '../viz/analysis';
import { chromagram, spectrogram, spectrum, vectorscope, waveform, type Scope } from '../viz/scopes';

const VIEWS: { id: string; name: string; scope: Scope; about: string }[] = [
  { id: 'wave', name: 'Wave', scope: waveform, about: 'The raw signal: air pressure over a few milliseconds.' },
  { id: 'spectrum', name: 'Spectrum', scope: spectrum, about: 'An FFT splits the sound into frequencies; bass on the left, air on the right.' },
  { id: 'spectrogram', name: 'Spectrogram', scope: spectrogram, about: 'The spectrum over time: each column is one frame, brighter is louder.' },
  { id: 'stereo', name: 'Stereo', scope: vectorscope, about: 'Left against right. A vertical line is mono; a cloud is wide stereo.' },
  { id: 'chroma', name: 'Chroma', scope: chromagram, about: 'Energy folded into the 12 notes of the octave; the key is guessed from it.' },
];

export function mountScopePanel(player: Player, bar: HTMLElement) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'pill pill--scope liquid liquid--pill';
  pill.dataset.liquidBezel = '18';
  pill.setAttribute('aria-expanded', 'false');
  pill.setAttribute('aria-controls', 'scope-panel');
  pill.title = 'See the music: waveform, spectrum, stereo, chroma';
  pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-line" d="M3 12h2.5l2-6 3 12 3-15 3 15 2-6H21" /></svg><span class="pill__label">Scope</span>`;
  bar.append(pill);

  const panel = document.createElement('section');
  panel.className = 'scope liquid liquid--pad';
  panel.id = 'scope-panel';
  panel.setAttribute('aria-label', 'Audio visualizers');
  panel.hidden = true;
  panel.innerHTML = `
    <div class="scope__head">
      <div class="scope__tabs" role="tablist" aria-label="Visualizer">
        ${VIEWS.map((v, i) => `<button class="scope__tab" type="button" role="tab" data-view="${v.id}" aria-selected="${i === 0}">${v.name}</button>`).join('')}
      </div>
      <p class="scope__readout" aria-live="polite"><span data-bpm>BPM ·</span><span data-key>Key ·</span></p>
    </div>
    <div class="scope__stage">
      <canvas class="scope__canvas" aria-hidden="true"></canvas>
      <p class="scope__note" data-note></p>
    </div>
    <p class="scope__about" data-about></p>
  `;
  document.body.append(panel);

  const $ = <T extends Element>(sel: string) => panel.querySelector<T>(sel)!;
  const canvas = $<HTMLCanvasElement>('canvas');
  const g = canvas.getContext('2d')!;
  const note = $<HTMLElement>('[data-note]');
  let view = VIEWS[0];
  let analysis: Analysis | null = null; // created on first use, so the AudioContext waits for a gesture
  let open = false;
  let dpr = 1;

  const select = (id: string) => {
    view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    panel.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view.id)));
    $('[data-about]').textContent = view.about;
    g.fillStyle = '#120d24';
    g.fillRect(0, 0, canvas.width, canvas.height);
    view.scope.reset?.();
  };
  panel.querySelector('[role="tablist"]')!.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-view]')?.dataset.view;
    if (id) select(id);
  });
  // Arrow keys move between tabs.
  panel.querySelector('[role="tablist"]')!.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'ArrowRight' && ke.key !== 'ArrowLeft') return;
    const i = VIEWS.indexOf(view);
    const next = VIEWS[(i + (ke.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length];
    select(next.id);
    panel.querySelector<HTMLElement>(`[data-view="${next.id}"]`)!.focus();
  });

  const fit = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      select(view.id);
    }
  };
  new ResizeObserver(fit).observe(canvas);

  const setOpen = (on: boolean) => {
    open = on;
    panel.hidden = !on;
    pill.setAttribute('aria-expanded', String(on));
    pill.classList.toggle('is-active', on);
    if (on) {
      fit();
      select(view.id);
      wake();
    }
  };
  pill.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  // The analysis keeps listening while music plays (so tempo and key are ready when you
  // open it); drawing only happens while the panel is open.
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    const s = player.state();
    const hearing = s.playing && !s.guest;
    analysis ??= createAnalysis(getMusicBus());
    analysis.update(dt, hearing);
    if (open) {
      view.scope.draw(g, canvas.width, canvas.height, analysis, dpr);
      $('[data-bpm]').textContent = `BPM ${analysis.bpm ?? (hearing ? 'listening…' : '·')}`;
      $('[data-key]').textContent = `Key ${analysis.key?.name ?? (hearing ? 'listening…' : '·')}`;
      note.textContent = s.guest
        ? 'Spotify plays in its own frame, so the room cannot hear it. Play room tone to see the music here.'
        : s.playing
          ? ''
          : 'Press play to see the music.';
    }
    raf = open || s.playing ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  player.onChange((s) => {
    // A different song: start the estimates over.
    if (s.guest) analysis?.reset();
    if (s.playing || open) wake();
  });
  select(view.id);

  // Dev helper: /?scope=spectrum opens the panel on that view.
  const devView = import.meta.env.DEV ? new URLSearchParams(location.search).get('scope') : null;
  if (devView !== null) {
    setOpen(true);
    select(devView);
  }
}
