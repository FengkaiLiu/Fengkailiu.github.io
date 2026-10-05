import './styles/index.css';
import './styles/site.css';
import { profile } from './content/profile';
import { projects } from './content/projects';
import { placeholder } from './ui/placeholder';
import { initSheen } from './ui/sheen';
import { initLiquidGlass } from './ui/liquidGlass';
import { showGate } from './ui/gate';
import { initRoom } from './room/room';
import { playLightsOnChord, startAmbience, type Ambience } from './audio/lofi';
import { createPlayer } from './audio/player';
import { tracks } from './content/tracks';
import { mountPlayerDock } from './ui/playerDock';

// Always start at the top so the first shot is the whole room.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const app = document.querySelector<HTMLDivElement>('#app')!;

interface Chapter {
  id: string;
  shot: string;
  track: string;
  title: string;
  text?: string;
  tags?: readonly string[];
  floor: string;
  needs?: readonly string[];
}

// Chapters read like a record's track list. Each one is replaced by its floor (see ROADMAP.md).
const chapters: Chapter[] = [
  { id: 'about', shot: 'about', track: 'A1', title: 'Code on one screen, sound on the other.', text: profile.bio[0], floor: 'Floor 9', needs: ['About content on the laptop screen (Floor 9)', 'Portrait photo (optional)'] },
  ...projects.map((p, i) => ({ id: p.id, shot: p.id, track: `A${i + 2}`, title: p.title, text: p.subtitle, tags: p.tags, floor: 'Floors 10 to 14', needs: p.needs })),
  { id: 'lab', shot: 'lab', track: 'B1', title: 'How this room hears.', text: 'A live map of the audio graph running this page, and an FFT you can play with.', floor: 'Floor 15' },
  { id: 'contact', shot: 'contact', track: 'B2', title: 'Leave me a beat.', text: 'Sequence a 4-bar loop and send it with your message.', floor: 'Floor 16' },
];

app.innerHTML = `
  <header class="hero" id="top" data-shot="hero">
    <span class="hero__chip liquid liquid--pill" data-liquid-bezel="14">${profile.role}</span>
    <h1 class="hero__name">${profile.name}</h1>
    <p class="hero__tagline">beats to code &amp; compose to</p>
    <p class="hero__sub">${profile.tagline}</p>
    <div class="hero__dock liquid liquid--pill" data-liquid-bezel="22">
      <a class="btn" href="#about" data-look>Look around <svg class="btn__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></a>
      <button class="dock-toggle" type="button" data-rain aria-pressed="true" title="Rain on the window, and its sound if audio is on">
        <span class="dock-toggle__dot"></span><span data-rain-label>Rain on</span>
      </button>
    </div>
    <div class="hero__cue" aria-hidden="true"><span></span></div>
  </header>
  <main>
    ${chapters
      .map(
        (c) => `
      <section class="chapter" id="${c.id}" data-shot="${c.shot}">
        <article class="chapter__card liquid liquid--pad">
          <span class="chapter__track">${c.track}</span>
          <h2 class="chapter__title">${c.title}</h2>
          ${c.text ? `<p class="chapter__text">${c.text}</p>` : ''}
          ${c.tags ? `<div class="chapter__tags">${c.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
          <div class="chapter__slot"></div>
        </article>
      </section>`,
      )
      .join('')}
  </main>
  <footer class="footer">Built from scratch by ${profile.name} · lights off at your own risk</footer>
`;

document.querySelectorAll<HTMLElement>('.chapter').forEach((el, i) => {
  const c = chapters[i];
  el.querySelector('.chapter__slot')!.append(placeholder({ label: `${c.floor}: ${c.title}`, needs: c.needs, tag: c.floor.toUpperCase() }));
});

const sections = [...document.querySelectorAll<HTMLElement>('[data-shot]')].map((el) => ({ el, shot: el.dataset.shot! }));
const covers: Record<string, string> = Object.fromEntries(projects.filter((p) => p.cover).map((p) => [p.id, p.cover]));
const room = initRoom(sections, covers);

initSheen();

let ambience: Ambience | null = null;
let raining = true;
const rainBtn = document.querySelector<HTMLButtonElement>('[data-rain]')!;
rainBtn.addEventListener('click', () => {
  raining = !raining;
  room?.setRain(raining);
  ambience?.setRain(raining);
  rainBtn.setAttribute("aria-pressed", String(raining));
});

const player = createPlayer(tracks);
const dock = mountPlayerDock(player, (b, playing) => {
  room?.setAudio(b.bass, b.mid, b.treble, b.level);
  room?.setPlaying(playing);
});
initLiquidGlass();

// "Look around" glides to the first chapter; the camera follows the scroll on its own.
document.querySelector<HTMLAnchorElement>('[data-look]')!.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

showGate(
  [
    { label: 'Fonts unpacked', run: document.fonts.ready },
    { label: 'Room assembled', run: room?.ready ?? Promise.resolve() },
  ],
  {
    eyebrow: 'Portfolio · CS + Music Technology',
    title: "Fengkai's Room",
    hint: 'best with headphones',
    ready: 'Ready. Turn on the lamp',
  },
).then(({ sound }) => {
  room?.lightsOn();
  document.documentElement.classList.add('is-on');
  window.setTimeout(() => dock.show(), 2600);
  if (sound) {
    playLightsOnChord();
    ambience = startAmbience();
  }
});

// Dev helper: /?nogate&lit&at=sonare jumps straight to a chapter with the lights on.
if (import.meta.env.DEV) {
  const at = new URLSearchParams(location.search).get('at');
  if (at) setTimeout(() => document.getElementById(at)?.scrollIntoView({ block: 'center' }), 50);
  // /?play starts the music right away (headless needs --autoplay-policy=no-user-gesture-required).
  if (new URLSearchParams(location.search).has('play')) setTimeout(() => void player.play(), 800);
}
