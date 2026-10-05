import './styles/index.css';
import './styles/site.css';
import { profile } from './content/profile';
import { projects } from './content/projects';
import { placeholder } from './ui/placeholder';
import { initSheen } from './ui/sheen';
import { initLiquidGlass } from './ui/liquidGlass';
import { showGate } from './ui/gate';
import { initWorld } from './scene/world';

// Always start at the top so the sunrise plays from morning.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const world = initWorld();
const app = document.querySelector<HTMLDivElement>('#app')!;

interface Chapter {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
  tags?: readonly string[];
  floor: string;
  needs?: readonly string[];
}

// Chapters not built yet. Each one is replaced by its floor (see ROADMAP.md).
const chapters: Chapter[] = [
  { id: 'about', eyebrow: 'About', title: 'Code on one fader, sound on the other.', text: profile.bio[0], floor: 'Floor 9', needs: ['Mixer channel strip (built in Floor 9)', 'Portrait photo (optional)'] },
  ...projects.map((p) => ({ id: p.id, eyebrow: 'Project', title: p.title, text: p.subtitle, tags: p.tags, floor: 'Floors 10 to 14', needs: p.needs })),
  { id: 'lab', eyebrow: 'Lab', title: 'How this city hears.', text: 'A live map of the audio graph running this page, and an FFT you can play with.', floor: 'Floor 15' },
  { id: 'contact', eyebrow: 'Contact', title: 'Leave me a beat.', text: 'Sequence a 4-bar loop and send it with your message.', floor: 'Floor 16' },
];

app.innerHTML = `
  <header class="hero" id="top">
    <span class="hero__chip liquid liquid--pill" data-liquid-bezel="14">${profile.role}</span>
    <h1 class="hero__name">${profile.name}</h1>
    <p class="hero__tagline">${profile.tagline}</p>
    <div class="hero__dock liquid liquid--pill" data-liquid-bezel="22">
      <a class="btn btn--leaf" href="#about">Explore the city</a>
      <span class="hero__dock-note">Aero Player arrives in Floor 4</span>
    </div>
    <div class="hero__cue" aria-hidden="true"><span></span></div>
  </header>
  <main>
    ${chapters
      .map(
        (c, i) => `
      <section class="chapter" id="${c.id}" data-index="${i}">
        <article class="chapter__card liquid liquid--pad">
          <div class="chapter__meta">
            <span class="eyebrow">${c.eyebrow}</span>
            <span class="chapter__clock" data-clock></span>
          </div>
          <h2 class="chapter__title">${c.title}</h2>
          ${c.text ? `<p class="chapter__text">${c.text}</p>` : ''}
          ${c.tags ? `<div class="chapter__tags">${c.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
          <div class="chapter__slot"></div>
        </article>
      </section>`,
      )
      .join('')}
  </main>
  <footer class="footer">Built from scratch by ${profile.name} · Resonance City</footer>
`;

document.querySelectorAll<HTMLElement>('.chapter').forEach((el, i) => {
  const c = chapters[i];
  el.querySelector('.chapter__slot')!.append(placeholder({ label: `${c.floor}: ${c.title}`, needs: c.needs, tag: c.floor.toUpperCase() }));
});

// Each chapter shows the city's clock at that point in the day.
const clockStops: [number, number][] = [
  [0.2, 7.5], [0.35, 12], [0.6, 15.5], [0.78, 18], [0.9, 19.5], [1.0, 22],
];
const clockAt = (day: number) => {
  for (let i = 1; i < clockStops.length; i++) {
    const [d1, h1] = clockStops[i];
    const [d0, h0] = clockStops[i - 1];
    if (day <= d1) return h0 + ((day - d0) / (d1 - d0)) * (h1 - h0);
  }
  return 22;
};
const updateClocks = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  document.querySelectorAll<HTMLElement>('.chapter').forEach((el) => {
    const progress = Math.min(Math.max((el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2) / max, 0), 1);
    const h = clockAt(0.2 + progress * 0.8);
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60 / 5) * 5;
    el.querySelector('[data-clock]')!.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} in the city`;
  });
};
updateClocks();
window.addEventListener('resize', updateClocks);

initLiquidGlass();
initSheen();

const preloadImages = (urls: string[]) =>
  Promise.all(
    urls.filter(Boolean).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  );

showGate([
  { label: 'Type loaded', run: document.fonts.ready },
  { label: 'Sky compiled', run: world?.ready ?? Promise.resolve() },
  { label: 'Projects gathered', run: preloadImages(projects.map((p) => p.cover)) },
]).then(() => {
  world?.powerOn();
  document.documentElement.classList.add('is-on');
});
