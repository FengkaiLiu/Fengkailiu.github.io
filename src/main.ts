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
      <a class="btn" href="#about">Look around</a>
      <button class="dock-toggle" type="button" data-ambience hidden aria-pressed="true">
        <span class="dock-toggle__dot"></span><span data-ambience-label>Rain on</span>
      </button>
      <span class="hero__dock-note">Record player arrives in Floor 4</span>
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

initLiquidGlass();
initSheen();

let ambience: Ambience | null = null;
const ambienceBtn = document.querySelector<HTMLButtonElement>('[data-ambience]')!;
const ambienceLabel = ambienceBtn.querySelector<HTMLSpanElement>('[data-ambience-label]')!;
ambienceBtn.addEventListener('click', () => {
  if (!ambience) return;
  ambience.setEnabled(!ambience.enabled);
  ambienceBtn.setAttribute('aria-pressed', String(ambience.enabled));
  ambienceLabel.textContent = ambience.enabled ? 'Rain on' : 'Rain off';
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
  if (sound) {
    playLightsOnChord();
    ambience = startAmbience();
    ambienceBtn.hidden = false;
  }
});

// Dev helper: /?nogate&lit&at=sonare jumps straight to a chapter with the lights on.
if (import.meta.env.DEV) {
  const at = new URLSearchParams(location.search).get('at');
  if (at) setTimeout(() => document.getElementById(at)?.scrollIntoView({ block: 'center' }), 50);
}
