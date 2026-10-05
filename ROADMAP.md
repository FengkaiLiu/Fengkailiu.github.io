# Resonance City: Build Roadmap

**Concept.** A solarpunk city that runs on sound, seen through Frutiger Aero glass.
Scrolling moves through one day in the city, from dawn to an aurora night. The world
itself is the visualizer: the skyline is a live spectrum analyzer, the turbines spin
with the bass, the night aurora becomes a spectrogram, and circuit-board roots under
the grass carry pulses of data (the CS layer).

Built floor by floor. **One floor = one commit** on the `redesign` branch.
The live site stays on `main` until Floor 19.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
```

`legacy/index.html` is the old site, kept only for reference.

Dev helpers (dev server only):
- `/styleguide.html` shows every design-system piece.
- `/?nogate` skips the startup gate.
- `/?day=0.8` previews any time of day (0 pre-dawn, 0.35 noon, 0.78 golden hour, 1 night).

## Floors

| # | Floor | Status |
|---|---|---|
| 0 | Scaffold: Vite + TS, content migrated, Pages workflow | ✅ |
| 1 | Design system: tokens, rounded Nunito type, liquid glass, buttons, placeholders | ✅ |
| 2 | Resonance City background: day cycle driven by scroll | ✅ |
| 3 | Startup gate (power orb, load progress, chime, sunrise) + shared AudioContext | ✅ |
| 3b | Audio engine: shared analyser bus, band extraction (bass / mid / treble / level) | ⬜ |
| 4 | Aero Player: liquid glass capsule, playlist, transport | ⬜ |
| 5 | Visualizers: waveform, spectrum, spectrogram, vectorscope, chromagram, BPM/key | ⬜ |
| 6 | Audio-reactive world: skyline = spectrum, turbines = bass, aurora = spectrogram, traces = treble | ⬜ |
| 7 | Smooth scroll (Lenis + GSAP), nav | ⬜ |
| 8 | Hero interaction: touch the city to play notes | ⬜ |
| 9 | About: mixer channel strip | ⬜ |
| 10 | Project chapter engine: pinned scroll chapters + expandable liquid glass sheet | ⬜ |
| 11 | Chapter: VR Music Room | ⬜ |
| 12 | Chapter: Sonare of the Lake | ⬜ |
| 13 | Chapter: RoomLink-ChillZone | ⬜ |
| 14 | Chapter: Hot Footer | ⬜ |
| 15 | Lab (CS showcase): live audio graph + FFT explainer | ⬜ |
| 16 | Contact: step sequencer with shareable loops | ⬜ |
| 17 | Extras: command palette, spectrogram easter egg | ⬜ |
| 18 | Polish: performance, mobile, reduced motion, accessibility, font subsetting | ⬜ |
| 19 | Launch: merge to main, Pages source = GitHub Actions | ⬜ |

## Assets Fengkai needs to make

Until these exist, the site shows visible placeholders (dashed boxes with a yellow tag).
In dev, the browser console lists every placeholder on the page.

- [ ] **Music tracks** for the Aero Player (WAV or high-bitrate MP3/OGG, put in `public/audio/`)
- [ ] **Spectrogram easter-egg track** (a track with an image hidden in its spectrum)
- [ ] **VR Music Room**: room model `.glb` or a 10 to 20 s screen recording, plus headset screenshots
- [ ] **Sonare of the Lake**: chorus screen recording, one boat `.glb`
- [ ] **RoomLink-ChillZone**: 360° equirectangular panorama
- [ ] **Hot Footer**: Unity WebGL build or gameplay GIF
- [ ] **Project 5**: all content
- [ ] **Portrait / photos** for About (optional)

## Browser notes

Liquid glass refraction needs SVG backdrop filters, which only Chromium supports
(Chrome, Edge, Opera, Arc). Safari and Firefox get a frosted-glass fallback.

## Deploying (Floor 19)

1. Merge `redesign` into `main`.
2. GitHub repo Settings > Pages > Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
