import './styles/index.css';
import './styles/site.css';
import { profile } from './content/profile';
import { projects } from './content/projects';
import { placeholder } from './ui/placeholder';
import { initSheen } from './ui/sheen';
import { initLiquidGlass } from './ui/liquidGlass';
import { showGate } from './ui/gate';
import { initRoom } from './room/room';
import { playLightsOnChord, rhodesNote, startAmbience, type Ambience } from './audio/lofi';
import { lampClick, purr } from './audio/foley';
import { getAudio, unlockAudio } from './audio/context';
import { getMusicBus } from './audio/bus';
import { mountRoomHints } from './ui/roomHints';
import { createPlayer, outsideGuest } from './audio/player';
import { tracks } from './content/tracks';
import { mountPlayerDock } from './ui/playerDock';
import { mountCrate } from './ui/crate';
import { mountMixer } from './ui/mixer';
import { mountProjectSheet } from './ui/projectSheet';
import { mountGameConsole } from './ui/gameConsole';
import { mountLab } from './ui/lab';
import { mountBeatbox } from './ui/beatbox';
import { mountScopePanel } from './ui/scopePanel';
import { createSmoothScroll } from './ui/scroll';
import { mountTrackNav } from './ui/trackNav';
import { coverLabel } from './room/textures';
import { mountLangSwitch, tr } from './i18n';

document.title = tr('Fengkai Liu · CS + Music Technology', '刘丰恺 Fengkai Liu · 计算机科学 + 音乐科技');
document.querySelector('meta[name="description"]')?.setAttribute(
  'content',
  tr(
    'Portfolio of Fengkai Liu, a Computer Science and Music Technology student building audio, XR, and interactive web experiences.',
    '刘丰恺（Fengkai Liu）的作品集。计算机科学与音乐科技专业学生，做音频、XR 和交互式网页体验。',
  ),
);

// Always start at the top so the first shot is the whole room.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const scroll = createSmoothScroll();
scroll.stop(); // the gate holds the page until the lamp is on

const app = document.querySelector<HTMLDivElement>('#app')!;

interface Chapter {
  id: string;
  shot: string;
  track: string;
  title: string;
  /** Short name for the track list nav. */
  nav: string;
  text?: string;
  tags?: readonly string[];
  floor?: string;
  needs?: readonly string[];
  /** Built content instead of a placeholder. */
  custom?: 'crate' | 'mixer' | 'project' | 'lab' | 'beat';
}

// Chapters read like a record's track list. Each one is replaced by its floor (see ROADMAP.md).
const chapters: Chapter[] = [
  { id: 'about', shot: 'about', track: 'A1', nav: tr('About', '关于我'), title: tr('Code on one screen, sound on the other.', '一块屏幕写代码，另一块做声音。'), text: profile.bio[0], custom: 'mixer' },
  ...projects.map((p, i) => ({ id: p.id, shot: p.id, track: `A${i + 2}`, nav: p.title, title: p.title, text: p.subtitle, tags: p.tags, custom: 'project' as const })),
  {
    id: 'records',
    shot: 'record',
    track: 'B1',
    nav: tr('Liner notes', '唱片内页'),
    title: tr('Liner notes.', '唱片内页。'),
    text: tr('3 records I keep coming back to. Flip through the crate and put one on the turntable.', '三张我反复在听的唱片。翻一翻唱片箱，挑一张放上唱机。'),
    custom: 'crate',
  },
  {
    id: 'lab',
    shot: 'lab',
    track: 'B2',
    nav: tr('The Lab', '实验室'),
    title: tr('How this room hears.', '这个房间如何「听」声音。'),
    text: tr('A live map of the audio graph running this page, and an FFT you can play with.', '这个页面正在运行的音频图的实时示意，还有一个可以上手玩的 FFT。'),
    custom: 'lab',
  },
  {
    id: 'contact',
    shot: 'contact',
    track: 'B3',
    nav: tr('Contact', '联系我'),
    title: tr('Leave me a beat.', '给我留一段节拍。'),
    text: tr('Sequence a 4-bar loop and send it with your message.', '编一段 4 小节的循环，和留言一起发给我。'),
    custom: 'beat',
  },
];

app.innerHTML = `
  <a class="skip-link" href="#about">${tr('Skip to the content', '跳到正文')}</a>
  <header class="hero" id="top" data-shot="hero">
    <span class="hero__chip liquid liquid--pill" data-liquid-bezel="14">${profile.role}</span>
    <h1 class="hero__name">${profile.name}</h1>
    <p class="hero__tagline">${tr('beats to code &amp; compose to', '陪你写代码、写歌的节拍')}</p>
    <p class="hero__sub">${profile.tagline}</p>
    <div class="hero__dock liquid liquid--pill" data-liquid-bezel="22">
      <a class="btn" href="#about" data-look>${tr('Look around', '四处看看')} <svg class="btn__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></a>
    </div>
    <div class="hero__cue" aria-hidden="true"><span></span></div>
  </header>
  <main>
    ${chapters
      .map(
        (c) => `
      <section class="chapter${c.custom === 'project' ? ' chapter--pinned' : ''}" id="${c.id}" data-shot="${c.shot}">
        <div class="chapter__pin">
        <article class="chapter__card liquid liquid--pad">
          <span class="chapter__track">${c.track}</span>
          <h2 class="chapter__title">${c.title}</h2>
          ${c.text ? `<p class="chapter__text">${c.text}</p>` : ''}
          ${c.tags ? `<div class="chapter__tags">${c.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
          <div class="chapter__slot"></div>
        </article>
        </div>
      </section>`,
      )
      .join('')}
  </main>
  <footer class="footer">${tr(`Built from scratch by ${profile.name} · lights off at your own risk`, `由${profile.name}（${profile.nameLatin}）从零搭建 · 关灯后果自负`)}</footer>
`;
mountLangSwitch();

document.querySelectorAll<HTMLElement>('.chapter').forEach((el, i) => {
  const c = chapters[i];
  if (c.custom || !c.floor) return;
  el.querySelector('.chapter__slot')!.append(placeholder({ label: `${c.floor}: ${c.title}`, needs: c.needs, tag: c.floor.toUpperCase() }));
});

// Project chapters: a button that opens the full liner notes, plus the project's links.
const extArrow = '<svg class="btn__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7" /></svg>';
projects.forEach((p) => {
  const slot = document.querySelector<HTMLElement>(`#${p.id} .chapter__slot`)!;
  slot.classList.add('chapter__actions');
  slot.innerHTML = `
    ${p.game ? `<button class="btn btn--play" type="button" data-game>${tr('Play it', '玩一下')} <svg class="btn__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" /></svg></button>` : ''}
    <button class="${p.game ? 'btn btn--ghost' : 'btn'}" type="button" data-sheet="${p.id}">${p.placeholder ? 'What it needs' : tr('Liner notes', '项目详情')}</button>
    ${p.links.demo ? `<a class="chapter__link" href="${p.links.demo}" target="_blank" rel="noopener">${p.links.demoLabel ?? tr('Live demo', '在线演示')} ${extArrow}</a>` : ''}
    ${p.links.github ? `<a class="chapter__link" href="${p.links.github}" target="_blank" rel="noopener">GitHub ${extArrow}</a>` : ''}
  `;
});

// Projects with a recording get a small muted preview in their card, playing only while
// the chapter is on screen. The same element also plays on the project's poster in the room.
const previews: Record<string, HTMLVideoElement> = {};
const still = matchMedia('(prefers-reduced-motion: reduce)');
projects.forEach((p) => {
  const clip = p.media?.flatMap((g) => g.items).find((m) => m.type === 'video');
  if (!clip) return;
  const video = document.createElement('video');
  video.className = 'chapter__preview';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  video.dataset.src = clip.src;
  document.querySelector(`#${p.id} .chapter__slot`)!.before(video);
  previews[p.id] = video;
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (!video.src) video.src = video.dataset.src!; // load on first approach
        if (!still.matches) void video.play().catch(() => {});
      } else video.pause();
    },
    { threshold: 0.25 },
  ).observe(video);
});

const sections = [...document.querySelectorAll<HTMLElement>('[data-shot]')].map((el) => ({ el, shot: el.dataset.shot! }));
const covers: Record<string, string> = Object.fromEntries(projects.filter((p) => p.cover).map((p) => [p.id, p.cover]));
const room = initRoom(sections, covers, previews, projects.find((p) => p.id === 'sonare')?.models?.items[0]?.src);

initSheen();

let ambience: Ambience | null = null;
// The visitor's ambience settings, kept even before sound starts (the ambience picks them up).
let rainOn = true;
let crackleOn = true;

const mixer = mountMixer(document.querySelector<HTMLElement>('#about .chapter__slot')!);
const player = createPlayer(tracks);
const dock = mountPlayerDock(
  player,
  (b, playing, spectrum) => {
    room?.setAudio(b.bass, b.mid, b.treble, b.level);
    mixer.setBands(b);
    room?.setSpectrum(spectrum);
    room?.setPlaying(playing);
  },
  {
    canSkip: tracks.length > 1,
    // Rain lives on the dock so it can be switched off from anywhere on the page.
    onRain(on) {
      rainOn = on;
      room?.setRain(on);
      ambience?.setRain(on);
    },
    onCrackle(on) {
      crackleOn = on;
      ambience?.setCrackle(on);
    },
  },
);

// Liner notes picks borrow the same turntable, with the song's cover on the label.
let label: ReturnType<typeof coverLabel> | null = null;
mountCrate(document.querySelector<HTMLElement>('#records .chapter__slot')!, player, {
  setLabel(tint, cover) {
    label?.dispose();
    label = coverLabel(tint, cover ?? undefined);
    room?.setLabel(label);
  },
  clearLabel() {
    if (!label) return;
    label.dispose();
    label = null;
    room?.setLabel(null);
  },
  setMood(mood) {
    room?.setMood(mood ?? null);
  },
});
mountScopePanel(player, dock.bar);
const nav = mountTrackNav(
  chapters.map((c) => ({ id: c.id, track: c.track, title: c.nav })),
  scroll,
);
const sheet = mountProjectSheet(
  projects.map((p, i) => ({ project: p, track: `A${i + 2}` })),
  scroll,
);
document.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-sheet]')?.dataset.sheet;
  if (id) sheet.open(id);
});
// Hot Footer: the shelf's handheld, life-size and playable.
// While Hot Footer plays, the room goes quiet: its music, the rain and the crackle pause,
// and come back as they were when the console closes.
let musicBeforeGame = false;
const gameConsole = mountGameConsole(player, scroll, {
  pause() {
    const s = player.state();
    musicBeforeGame = s.playing && !s.guest; // the room's own record, not a borrowed one
    ambience?.setPaused(true);
  },
  resume() {
    ambience?.setPaused(false);
    if (musicBeforeGame && !player.state().playing) void player.play();
    musicBeforeGame = false;
  },
});
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-game]')) return;
  document.querySelector<HTMLDialogElement>('dialog.sheet[open]')?.close(); // the liner notes step aside
  gameConsole.open();
});
initLiquidGlass();

const beatbox = mountBeatbox(document.querySelector<HTMLElement>('#contact .chapter__slot')!, player);

// The Lab's live diagram needs to know what is sounding right now.
let keysAt = -1e9;
mountLab(document.querySelector<HTMLElement>('#lab .chapter__slot')!, () => {
  const s = player.state();
  return { music: s.playing && !outsideGuest(s.guest), guest: s.playing && outsideGuest(s.guest), ambience: Boolean(ambience), keysAt };
});

// Things to play with in the room: the keys, the cat, the lamp and the record player.
if (room) {
  room.onHover(mountRoomHints());
  let purring = 0;
  room.onInteract(async (hit) => {
    // Visuals first, so a press feels instant; sound follows once audio is unlocked
    // (a click is a gesture, so this works even after entering silently).
    if (hit.id === 'keys' && hit.note !== undefined) {
      room.pressKey(hit.note);
      keysAt = performance.now();
      await unlockAudio();
      const { ctx } = getAudio();
      // Into the music bus, so the scope and the room hear your playing too.
      rhodesNote(ctx, getMusicBus().input, hit.note, ctx.currentTime, 1.8, 0.12);
    } else if (hit.id === 'cat') {
      if (performance.now() < purring) return; // let one purr finish
      purring = performance.now() + 2000;
      room.petCat();
      await unlockAudio();
      purr();
    } else if (hit.id === 'lamp') {
      room.toggleLamp();
      await unlockAudio();
      lampClick();
    } else if (hit.id === 'record') {
      void player.toggle();
    } else if (hit.id === 'handheld') {
      gameConsole.open();
    }
  });
}

// "Look around" glides to the first chapter; the camera follows the scroll on its own.
document.querySelector<HTMLAnchorElement>('[data-look]')!.addEventListener('click', (e) => {
  e.preventDefault();
  const about = document.getElementById('about');
  if (about) scroll.to(about);
});

showGate(
  [
    { label: tr('Fonts unpacked', '字体已就位'), run: document.fonts.ready },
    { label: tr('Room assembled', '房间已布置好'), run: room?.ready ?? Promise.resolve() },
  ],
  {
    eyebrow: tr('Portfolio · CS + Music Technology', '作品集 · 计算机科学 + 音乐科技'),
    title: tr("Fengkai's Room", '丰恺的房间'),
    hint: tr('best with headphones', '戴上耳机效果更好'),
    ready: tr('Ready. Turn on the lamp', '准备好了，打开台灯吧'),
  },
).then(({ sound }) => {
  room?.lightsOn();
  document.documentElement.classList.add('is-on');
  scroll.start();
  // Dev helper: /?nogate&lit&at=sonare jumps straight to a chapter once the gate opens.
  const at = import.meta.env.DEV ? new URLSearchParams(location.search).get('at') : null;
  const atEl = at ? document.getElementById(at) : null;
  if (atEl) requestAnimationFrame(() => scroll.to(atEl, { instant: true }));
  // Dev helper: /?nogate&game opens the console (game=level2 starts on that level).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('game')) gameConsole.open();
  // Dev helper: /?nogate&notes=hotfooter opens that project's liner notes.
  const notes = import.meta.env.DEV ? new URLSearchParams(location.search).get('notes') : null;
  if (notes) sheet.open(notes);
  // ...and &part=3 scrolls it to that part of the Hot Footer walkthrough.
  const part = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('part')) : 0;
  if (part) setTimeout(() => document.querySelectorAll('.deep__part')[part - 1]?.scrollIntoView({ block: 'start' }), 1500);
  // Opened from a shared beat link: glide down to it once the lamp is on.
  const contact = document.getElementById('contact');
  if (beatbox.shared && contact && !atEl) window.setTimeout(() => scroll.to(contact), 1400);
  window.setTimeout(() => {
    dock.show();
    nav.show();
  }, 2600);
  if (sound) {
    playLightsOnChord();
    ambience = startAmbience({ rain: rainOn, crackle: crackleOn });
    // The record drops in once the lights-on chord has rung out.
    window.setTimeout(() => {
      if (!player.state().playing) void player.play();
    }, 1800);
  }
});

if (import.meta.env.DEV) {
  // Test hook for headless checks of the room's sound state.
  (window as unknown as { __room: unknown }).__room = { player, ambience: () => ambience };
  // /?play starts the music right away (headless needs --autoplay-policy=no-user-gesture-required).
  if (new URLSearchParams(location.search).has('play')) setTimeout(() => void player.play(), 800);
}
