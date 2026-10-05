import './styles/index.css';
import './styles/site.css';
import { profile } from './content/profile';
import { projects } from './content/projects';
import { placeholder } from './ui/placeholder';
import { initSheen } from './ui/sheen';
import { initSky } from './scene/sky';

initSky();

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="hero container" id="hero">
    <span class="eyebrow">${profile.role}</span>
    <h1 class="hero__name text-shadow">${profile.name}</h1>
    <p class="hero__tagline">${profile.tagline}</p>
  </header>
  <main class="container stubs" id="stubs"></main>
`;

// Sections not built yet. Each stub is replaced by its floor (see ROADMAP.md).
const stubs: { floor: string; label: string; needs?: readonly string[] }[] = [
  { floor: 'Floor 4', label: 'Aero Player', needs: ['Your tracks in public/audio/ (a generated demo loop is used until then)'] },
  { floor: 'Floor 8', label: 'Hero ripple instrument' },
  { floor: 'Floor 9', label: 'About: mixer channel strip', needs: ['Portrait photo (optional)'] },
  ...projects.map((p) => ({ floor: 'Floors 10 to 14', label: `Chapter: ${p.title}`, needs: p.needs })),
  { floor: 'Floor 15', label: 'CS showcase: audio graph + FFT explainer' },
  { floor: 'Floor 16', label: 'Contact: step sequencer' },
];

const stubRoot = document.getElementById('stubs')!;
for (const s of stubs) {
  stubRoot.append(placeholder({ label: s.label, needs: s.needs, tag: s.floor.toUpperCase() }));
}

initSheen();
