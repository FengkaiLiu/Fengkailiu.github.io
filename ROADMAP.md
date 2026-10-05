# Liquid Aero Portfolio: Build Roadmap

Frutiger Aero mood (sky, water, glass, bubbles, optimism) rebuilt with modern tech
(WebGL shaders, real-time audio analysis, scroll-driven storytelling).

Built floor by floor. **One floor = one commit** on the `redesign` branch.
The live site stays on `main` until Floor 19.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
```

`legacy/index.html` is the old site, kept only for reference.

Dev helpers: `/styleguide.html` shows every design-system piece. `/?scroll=0.8` previews the background at a given scroll depth.

## Floors

| # | Floor | Status |
|---|---|---|
| 0 | Scaffold: Vite + TS, content migrated, Pages workflow | ✅ |
| 1 | Design system: tokens, fonts, glass, buttons, placeholder component | ✅ |
| 2 | Sky + water shader background (scroll dives underwater) | ✅ |
| 3 | Audio engine: shared AudioContext + analyser, Enter gate, startup chime | ⬜ |
| 4 | Aero Player: glass capsule, playlist, transport | ⬜ |
| 5 | Visualizers: waveform, spectrum, spectrogram, vectorscope, chromagram, BPM/key | ⬜ |
| 6 | Audio-reactive wiring: sky, water, bubbles respond to music | ⬜ |
| 7 | Smooth scroll (Lenis + GSAP), section skeleton, nav | ⬜ |
| 8 | Hero: name over water, ripple instrument | ⬜ |
| 9 | About: mixer channel strip | ⬜ |
| 10 | Project chapter engine: pinned scroll chapters + expandable glass sheet | ⬜ |
| 11 | Chapter: VR Music Room | ⬜ |
| 12 | Chapter: Sonare of the Lake | ⬜ |
| 13 | Chapter: RoomLink-ChillZone | ⬜ |
| 14 | Chapter: Hot Footer | ⬜ |
| 15 | CS showcase: live audio graph + FFT explainer | ⬜ |
| 16 | Contact: step sequencer with shareable loops | ⬜ |
| 17 | Extras: command palette, day/night sky, spectrogram easter egg | ⬜ |
| 18 | Polish: performance, mobile, reduced motion, accessibility | ⬜ |
| 19 | Launch: merge to main, Pages source = GitHub Actions | ⬜ |

## Assets Fengkai needs to make

Until these exist, the site shows visible placeholders (dashed glass boxes labeled `NEEDS:`).
Search the code for `needs` / `placeholder` to find every one.

- [ ] **Music tracks** for the Aero Player (WAV or high-bitrate MP3/OGG, put in `public/audio/`)
- [ ] **Spectrogram easter-egg track** (a track with an image hidden in its spectrum)
- [ ] **VR Music Room**: room model `.glb` or a 10 to 20 s screen recording, plus headset screenshots
- [ ] **Sonare of the Lake**: chorus screen recording, one boat `.glb`
- [ ] **RoomLink-ChillZone**: 360° equirectangular panorama
- [ ] **Hot Footer**: Unity WebGL build or gameplay GIF
- [ ] **Project 5**: all content
- [ ] **Portrait / photos** for About (the old `PWpage1-3.jpg` are used until replaced)

## Deploying (Floor 19)

1. Merge `redesign` into `main`.
2. GitHub repo Settings > Pages > Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
