// Dev-only living styleguide: every design-system piece on one page.
import './styles/index.css';
import './styleguide.css';
import { placeholder } from './ui/placeholder';
import { initSheen } from './ui/sheen';
import { initLiquidGlass } from './ui/liquidGlass';

const swatches: [string, string][] = [
  ['sky-900', '--sky-900'], ['sky-700', '--sky-700'], ['sky-500', '--sky-500'], ['sky-300', '--sky-300'], ['sky-100', '--sky-100'],
  ['aqua-700', '--aqua-700'], ['aqua-500', '--aqua-500'], ['aqua-300', '--aqua-300'],
  ['leaf-700', '--leaf-700'], ['leaf-500', '--leaf-500'], ['leaf-300', '--leaf-300'],
  ['sun', '--sun'], ['ink-900', '--ink-900'], ['ink-500', '--ink-500'],
];

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="container sg">
    <header class="sg-head">
      <span class="eyebrow">Floor 1 · Design system</span>
      <h1 class="text-shadow" style="font-size:var(--text-h1)">Liquid Aero</h1>
      <p>Tokens live in <code>src/styles/tokens.css</code>. Components in <code>glass.css</code> and <code>placeholder.css</code>.</p>
    </header>

    <section>
      <h2 class="sg-title">Color</h2>
      <div class="sg-swatches">
        ${swatches.map(([name, v]) => `<div class="sg-swatch"><i style="background:var(${v})"></i><span>${name}</span></div>`).join('')}
      </div>
    </section>

    <section>
      <h2 class="sg-title">Type</h2>
      <div class="glass glass--pad sg-type">
        <div style="font-family:var(--font-display);font-size:var(--text-hero);font-weight:800;letter-spacing:-.045em;line-height:.95">Hero</div>
        <h1 style="font-size:var(--text-h1)">Heading one</h1>
        <h2 style="font-size:var(--text-h2)">Heading two, Nunito</h2>
        <h3 style="font-size:var(--text-h3)">Heading three</h3>
        <p>Body text in Nunito. The quick brown fox jumps over the lazy dog, then exports the stems at 48 kHz.</p>
        <p style="font-family:var(--font-mono);font-size:var(--text-small)">mono · 128 BPM · A minor · -14 LUFS · fft.size = 2048</p>
      </div>
    </section>

    <section>
      <h2 class="sg-title">Glass</h2>
      <div class="sg-grid">
        <div class="glass glass--pad"><span class="eyebrow">.glass</span><h3>Light glass</h3><p>Frosted, saturated, with the Aero gloss band and a pointer-tracking sheen.</p></div>
        <div class="glass glass--dark glass--pad"><span class="eyebrow">.glass--dark</span><h3>Dark glass</h3><p>For the underwater sections deeper down the page.</p></div>
        <div class="liquid liquid--pad"><span class="eyebrow">.liquid</span><h3>Liquid glass</h3><p>Clear glass that refracts what is behind it (Chromium). Frosted fallback elsewhere.</p></div>
      </div>
    </section>

    <section>
      <h2 class="sg-title">Buttons</h2>
      <div class="sg-row">
        <button class="btn">Aqua button</button>
        <button class="btn btn--leaf">Leaf button</button>
        <button class="btn btn--glass">Glass button</button>
        <button class="btn btn--icon" aria-label="Play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
        <button class="btn btn--icon btn--glass" aria-label="Pause"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>
      </div>
    </section>

    <section>
      <h2 class="sg-title">Chips</h2>
      <div class="sg-row">
        <span class="chip chip--code">TypeScript</span>
        <span class="chip chip--sound">Max/MSP</span>
        <span class="chip chip--visual">Blender</span>
        <span class="chip">Default</span>
      </div>
    </section>

    <section>
      <h2 class="sg-title">Placeholder</h2>
      <div class="sg-grid" id="ph-demo"></div>
    </section>
  </div>
`;

const phDemo = document.getElementById('ph-demo')!;
phDemo.append(
  placeholder({ label: 'Track: hero theme', needs: ['WAV or 320k MP3 in public/audio/', 'Loopable, about 60 to 90 s'] }),
  placeholder({ label: 'Screen recording', needs: ['16:9, 10 to 20 s'], ratio: '16 / 9', tag: 'VIDEO' }),
);

initSheen();
initLiquidGlass();
