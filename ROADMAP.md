# Fengkai's Room: Build Roadmap

**Concept.** A cozy lofi bedroom at night, "beats to code & compose to". The page is a
3D room rendered live (Three.js); scrolling glides the camera from object to object,
Apple-style, and each chapter is something in the room: the laptop (About, it types
real code), shelf objects and wall posters (projects), the MIDI keyboard and speakers
(Lab), and the rainy window (Contact). The record player becomes the music player,
the speakers pulse with the bass, and chapters are labeled like tracks on a record.

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
- `/?lit` turns the lights on instantly and snaps the camera (no easing).
- `/?shot=sonare` frames one camera shot without scrolling (see `src/room/shots.ts`).
- `/?at=lab` scrolls to a chapter.
- `/?fps` shows the frame rate and what the adaptive quality governor is doing.
- `/?nogate&game` opens the Lava Rising console; `game=level2` (or `level3`, `secret`) starts on that level.
- `/?nogate&notes=hotfooter` opens a project's liner notes; `&part=3` scrolls to that part of the walkthrough.
- `/?play` starts the music on load; `/?shot=record` frames the turntable; `/?crate` opens the Liner notes crate; `/?mood=neon` (or `meadow`, `teto`) shows a song scene; `/?scope=spectrum` (or `wave`, `spectrogram`, `stereo`, `chroma`) opens the Scope.

## Floors

| # | Floor | Status |
|---|---|---|
| 0 | Scaffold: Vite + TS, content migrated, Pages workflow | ✅ |
| 1 | Design system: tokens, rounded Nunito type, liquid glass, buttons, placeholders | ✅ |
| 2 | 3D lofi room: props, lights, bloom + grain, scroll-driven camera shots | ✅ |
| 3 | Startup gate (lamp switch, load progress) + lights-on chord, rain and vinyl ambience | ✅ |
| 3b | Audio engine: shared analyser bus, band extraction (bass / mid / treble / level) | ✅ |
| 4 | Record player as the music player: glass dock, tonearm + spinning vinyl, playlist, synthesized demo loop | ✅ |
| 5 | Visualizers: waveform, spectrum, spectrogram, vectorscope, chromagram, BPM/key (Scope panel on the bottom bar) | ✅ |
| 6 | Audio-reactive room: speakers pump, fairy lights = spectrum, laptop shows live FFT, lamp breathes | ✅ |
| 7 | Smooth scroll (Lenis), track list nav with progress | ✅ |
| 8 | Room interactions: play the keyboard (click or drag), pet the cat, switch the lamp, tap the record player; pointer hints | ✅ |
| 9 | About: mixing desk (Code, Sound, Visual strips with skill inserts, live meters, solo; master strip with stats) | ✅ |
| 10 | Project chapter engine: pinned scroll chapters + liner-notes sheet (cover, write-up, links, prev/next) | ✅ |
| 11 | Chapter: VR Music Room (dev recordings in the sheet, card preview and on its poster; presentation photos with a lightbox) | ✅ |
| 12 | Chapter: Sonare of the Lake (gameplay video in the sheet, card and poster; screenshots; 3D viewer of all six boats; the real Miku boat on the shelf) | ✅ |
| 13 | Chapter: RoomLink-ChillZone (intro video on the card, poster and liner notes; Visit in VRChat link) | ✅ |
| 14 | Chapter: Hot Footer, playable: the real levels ported to the browser on a console overlay (open from the card or the shelf handheld) | ✅ |
| 14c | Hot Footer, under the hood: four pieces of my C# (ground check, jump tuning, camera follow, soundtrack gate) with live diagrams, plus the commit timeline | ✅ |
| 14a | Chapter A6: my_KWS (Project 5): edge keyword spotting write-up, demo video on the card and back-wall frame, the live Hugging Face demo embedded on request | ✅ |
| 14b | Liner notes (B1): card expands into an album stack; a Spotify embed plays each pick as a preview and borrows the turntable; each song turns the corner into its cover (neon flowers, meadow, Kasane Teto) | ✅ |
| 15 | Lab (CS showcase): live diagram of the page's audio graph + FFT playground (hand-written radix-2 FFT, windowing, play in the room) | ✅ |
| 16 | Contact: 16-step sequencer over the 4-bar progression, shareable beat links, message form (FormSubmit, no mail app needed) | ✅ |
| 17 | Extras: command palette, spectrogram easter egg | ⬜ |
| 18 | Polish: Latin-only fonts, re-encoded videos and JPG covers (18a); room pauses under the game console; reduced motion stills the camera arc, parallax, dust and twinkle; axe-clean (WCAG A/AA), skip link, landmarks; favicon; phone layout fixes | ✅ |
| 19 | Launch: merge to main, Pages source = GitHub Actions | ⬜ |

## Assets Fengkai needs to make

Until these exist, the site shows visible placeholders (dashed boxes with a yellow tag).
In dev, the browser console lists every placeholder on the page.

- [ ] **Music tracks** for the record player: put MP3/OGG files in `public/audio/` and list them in `src/content/tracks.ts` (the synthesized demo loop plays until then)
- [x] **Liner notes picks** (3 songs): Spotify link, artist name and your note for each (optional credits), in `src/content/records.ts`
- [ ] **Kasane Teto model** (optional): `public/models/teto.glb` replaces the built-in low-poly one in the Machine Love scene (auto-sized to 0.5 m, first animation loops)
- [ ] **Spectrogram easter-egg track** (a track with an image hidden in its spectrum)
- [x] **VR Music Room**: 2 dev recordings + 3 presentation photos in `public/vrmusicroom/` (full-size originals kept in `media-src/`, not published)
- [x] **Sonare of the Lake**: gameplay video, 2 screenshots and the 6 boat models in `public/sonareofthelake/` (PNG originals in `media-src/`)
- [x] **Hot Footer**: 3 in-game screenshots as `public/hotfooter/shot-1.jpg`, `shot-2.jpg`, `shot-3.jpg` (the game itself is generated by `node scripts/export-hotfooter.mjs`)
- [x] **Project 5** (my_KWS): write-up from the repo README, demo video, cover from the repo's demo screenshot, in `public/kws/`
- [ ] **Portrait / photos** for About (optional)
- [x] **Poster art** for Project 5: the live demo's screenshot
- [ ] **Optional `.glb` models** to swap in for the procedural props (headset, boat, handheld, your own synth)

## Browser notes

Liquid glass refraction needs SVG backdrop filters, which only Chromium supports
(Chrome, Edge, Opera, Arc). Safari and Firefox get a frosted-glass fallback.

## Deploying (Floor 19)

1. Merge `redesign` into `main`.
2. GitHub repo Settings > Pages > Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
