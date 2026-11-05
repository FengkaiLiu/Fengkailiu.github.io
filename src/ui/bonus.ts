// Bonus tracks (A7): the smaller projects. The chapter card lists them like a short track
// list; any row (or "Open all") brings up one page with every project as a row that opens in
// place. Songs play on the room's turntable, so the room reacts to them like any record.
import type { SideProject } from '../content/sideProjects';
import type { Player, GuestSlot } from '../audio/player';
import type { SmoothScroll } from './scroll';
import { getAudio, unlockAudio } from '../audio/context';
import { getMusicBus } from '../audio/bus';
import { tr } from '../i18n';

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const arrow = '<svg class="sheet__ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7" /></svg>';
const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>';
const no = (i: number) => String(i + 1).padStart(2, '0');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A sound board: one row per family of sounds, one column per level, plus a longer sample. */
const board = (p: SideProject) => {
  const b = p.board!;
  const cell = (ref: string, label: string, name: string) =>
    `<button class="bonus__cell" type="button" data-song="${ref}" aria-label="${tr('Play', '播放')}: ${esc(name)}"><span class="bonus__cell-icon" data-icon>${playIcon}</span><span>${esc(label)}</span></button>`;
  return `
    <figure class="bonus__board">
      <div class="bonus__board-grid" role="group" aria-label="${esc(b.caption)}">
        ${b.sets
          .map(
            (s, r) => `
          <div class="bonus__board-row">
            <span class="bonus__board-name">${esc(s.name)}${s.note ? `<span>${esc(s.note)}</span>` : ''}</span>
            ${b.levels.map((lvl, c) => (s.sounds[c] ? cell(`${p.id}:b${r}.${c}`, lvl, `${s.name} · ${lvl}`) : '<span></span>')).join('')}
            ${s.sample ? cell(`${p.id}:b${r}.s`, tr('Sample', '示例'), `${s.name} · ${tr('Sample', '示例')}`) : ''}
          </div>`,
          )
          .join('')}
      </div>
      <figcaption>${esc(b.caption)}</figcaption>
    </figure>`;
};

const row = (p: SideProject, i: number) => `
  <details class="bonus__item" id="bonus-${p.id}" data-bonus-item="${p.id}">
    <summary class="bonus__summary">
      <span class="bonus__no">${no(i)}</span>
      <span class="bonus__name">
        <span class="bonus__title">${esc(p.title)}</span>
        <span class="bonus__blurb">${esc(p.blurb)}</span>
      </span>
      <span class="bonus__kind">${esc(p.kind)}${p.year ? ` · ${esc(p.year)}` : ''}</span>
      <svg class="bonus__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </summary>
    <div class="bonus__body">
      ${p.course ? `<p class="bonus__course">${tr('Made for', '出自')}:${esc(p.course)}</p>` : ''}
      ${p.tags?.length ? `<div class="chapter__tags">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${
        p.placeholder
          ? `<p class="bonus__soon">${tr('The write-up, recordings and files for this one are on their way.', '这个项目的介绍、录音和文件还在整理中，很快就到。')}</p>`
          : ''
      }
      ${p.text ? `<p>${esc(p.text)}</p>` : ''}
      ${p.bullets?.length ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${
        p.audio?.length
          ? `<ol class="bonus__songs">${p.audio
              .map(
                (a, ai) => `
            <li class="bonus__song">
              <button class="bonus__play" type="button" data-song="${p.id}:${ai}" aria-label="${tr('Play', '播放')}: ${esc(a.title)}">${playIcon}</button>
              <span class="bonus__song-title">${esc(a.title)}</span>
              <span class="bonus__song-time" data-song-time="${p.id}:${ai}"></span>
              ${
                a.markers?.length
                  ? `<div class="bonus__marks" role="group" aria-label="${tr('Jump to a section', '跳到某一段')}">${a.markers
                      .map((m) => `<button class="bonus__mark" type="button" data-seek="${p.id}:${ai}:${m.at}"><span>${clock(m.at)}</span> ${esc(m.label)}</button>`)
                      .join('')}</div>`
                  : ''
              }
            </li>`,
              )
              .join('')}</ol>`
          : ''
      }
      ${p.board ? board(p) : ''}
      ${
        p.media?.length
          ? `<div class="sheet__media-grid bonus__media">${p.media
              .map((m) =>
                m.type === 'slot' || !m.src
                  ? `<div class="bonus__slot" role="img" aria-label="${esc(m.alt)}"><span>${esc(m.alt)}</span></div>`
                  : m.type === 'video'
                    ? `<video src="${esc(m.src)}" muted loop playsinline controls preload="metadata" aria-label="${esc(m.alt)}"></video>`
                    : `<img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy" />`,
              )
              .join('')}</div>`
          : ''
      }
      ${
        p.links?.length
          ? `<div class="bonus__links">${p.links
              .map((l) => `<a class="chapter__link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ${arrow}</a>`)
              .join('')}</div>`
          : ''
      }
    </div>
  </details>`;

export function mountBonus(slot: HTMLElement, items: SideProject[], track: string, player: Player, scroll: SmoothScroll) {
  // ---------- The chapter card: a short track list, folded ----------
  slot.classList.add('bonus');
  slot.innerHTML = `
    <ol class="bonus__list">
      ${items
        .map(
          (p, i) => `
        <li><button class="bonus__row" type="button" data-bonus-open="${p.id}">
          <span class="bonus__no">${no(i)}</span>
          <span class="bonus__title">${esc(p.title)}</span>
          <span class="bonus__kind">${esc(p.kind)}</span>
        </button></li>`,
        )
        .join('')}
    </ol>
    <div class="chapter__actions">
      <button class="btn" type="button" data-bonus-open>${tr('Open all', '全部展开')}</button>
    </div>
  `;

  // ---------- The page: every project as a row that opens in place ----------
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet sheet--bonus liquid liquid--pad';
  dialog.dataset.liquidBezel = '26';
  dialog.setAttribute('aria-labelledby', 'bonus-title');
  dialog.innerHTML = `
    <div class="sheet__scroll" data-lenis-prevent>
      <header class="sheet__head">
        <span class="chapter__track">${track}</span>
        <button class="sheet__close" type="button" aria-label="${tr('Close', '关闭')}" data-close>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <h2 class="sheet__title" id="bonus-title">${tr('Bonus tracks', '附赠曲目')}</h2>
      <p class="sheet__subtitle">${tr('Smaller things, made along the way. Open any of them.', '一路上做的小东西，点开任意一个看看。')}</p>
      <div class="bonus__items">${items.map(row).join('')}</div>
    </div>
  `;
  document.body.append(dialog);
  const scroller = dialog.querySelector<HTMLElement>('.sheet__scroll')!;

  const open = (id?: string) => {
    dialog.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => (d.open = d.dataset.bonusItem === id));
    scroller.scrollTop = 0;
    scroll.stop(); // the page (and the camera) stay put while the sheet is open
    dialog.showModal();
    document.documentElement.classList.add('has-sheet');
    const item = id ? dialog.querySelector<HTMLElement>(`#bonus-${id}`) : null;
    if (item) requestAnimationFrame(() => item.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }));
  };
  const close = () => {
    dialog.classList.add('is-closing');
    window.setTimeout(() => {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, 260);
  };
  let opener: HTMLElement | null = null;
  slot.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-bonus-open]');
    if (!btn) return;
    opener = btn;
    open(btn.dataset.bonusOpen || undefined);
  });
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('video').forEach((v) => v.pause());
    document.documentElement.classList.remove('has-sheet');
    scroll.start();
    opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Escape: close with the animation
    close();
  });
  dialog.addEventListener('click', (e) => {
    // The panel's content fills the dialog, so only a backdrop click lands on the dialog itself.
    // (Not a coordinate test: a button pressed with Enter or Space clicks at 0, 0.)
    if (e.target === dialog || (e.target as HTMLElement).closest('[data-close]')) close();
  });
  // Videos play only while their row is open.
  dialog.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    if (!(d instanceof HTMLDetailsElement)) return;
    d.querySelectorAll('video').forEach((v) => (d.open && !reducedMotion() ? void v.play().catch(() => {}) : v.pause()));
  }, true);

  // ---------- Songs on the turntable ----------
  // One element for every song, wired into the music bus once, the first time one plays.
  let el: HTMLAudioElement | null = null;
  let current = ''; // "projectId:index" of the song on the turntable
  let turntable: GuestSlot | null = null;
  const audio = () => {
    if (el) return el;
    el = new Audio();
    el.preload = 'auto';
    getAudio().ctx.createMediaElementSource(el).connect(getMusicBus().input);
    el.addEventListener('timeupdate', () => {
      if (!el || !current) return;
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      turntable?.progress(el.currentTime, d);
      const out = dialog.querySelector(`[data-song-time="${current}"]`);
      if (out) out.textContent = d ? `${clock(el.currentTime)} / ${clock(d)}` : clock(el.currentTime);
      // Light the section the song is in now.
      const marks = [...dialog.querySelectorAll<HTMLElement>(`[data-seek^="${current}:"]`)];
      const now = marks.filter((m) => Number(m.dataset.seek!.split(':')[2]) <= el!.currentTime).pop();
      marks.forEach((m) => m.classList.toggle('is-current', m === now));
    });
    el.addEventListener('ended', () => {
      turntable?.end();
      stop();
    });
    return el;
  };
  /** "id:2" is a song in the list; "id:b1.0" is a board cell (row 1, level 0) and "id:b1.s" that row's sample. */
  const song = (ref: string): { title: string; src: string } | undefined => {
    const [id, i] = ref.split(':');
    const p = items.find((x) => x.id === id);
    if (!i.startsWith('b')) return p?.audio?.[Number(i)];
    const [r, c] = i.slice(1).split('.');
    const set = p?.board?.sets[Number(r)];
    if (!set || !p?.board) return undefined;
    if (c === 's') return set.sample ? { title: `${set.name} · ${tr('Sample', '示例')}`, src: set.sample } : undefined;
    const src = set.sounds[Number(c)];
    return src ? { title: `${set.name} · ${p.board.levels[Number(c)]}`, src } : undefined;
  };
  const mark = () =>
    dialog.querySelectorAll<HTMLButtonElement>('[data-song]').forEach((b) => {
      const on = b.dataset.song === current && Boolean(el && !el.paused);
      (b.querySelector('[data-icon]') ?? b).innerHTML = on ? pauseIcon : playIcon;
      b.classList.toggle('is-playing', on);
      const s = song(b.dataset.song!);
      b.setAttribute('aria-label', `${on ? tr('Pause', '暂停') : tr('Play', '播放')}: ${s?.title ?? ''}`);
    });
  // The room took the turntable back (or the song ended): stop, and keep the place.
  const stop = () => {
    el?.pause();
    turntable = null;
    mark();
  };
  /** Puts a song on the turntable (or keeps it there), from `at` seconds if given. */
  const start = async (ref: string, at?: number) => {
    const s = song(ref);
    if (!s) return;
    await unlockAudio();
    const a = audio();
    if (ref !== current) {
      a.src = s.src;
      current = ref;
    }
    if (at !== undefined) a.currentTime = at;
    if (!a.paused && turntable) return; // already playing: the jump is enough
    const owner = items.find((p) => p.id === ref.split(':')[0]);
    turntable = player.host({ id: `bonus-${ref}`, title: s.title, artist: `${tr('Fengkai Liu', '刘丰恺')} · ${owner?.kind ?? ''}`, inRoom: true }, stop);
    await a.play().catch(() => turntable?.end());
    mark();
  };
  dialog.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const seek = t.closest<HTMLElement>('[data-seek]')?.dataset.seek;
    if (seek) {
      const [id, i, at] = seek.split(':');
      void start(`${id}:${i}`, Number(at));
      return;
    }
    const ref = t.closest<HTMLElement>('[data-song]')?.dataset.song;
    if (!ref) return;
    if (ref === current && el && !el.paused) player.pause(); // hands the turntable back; the guest's stop() pauses the song
    else void start(ref);
  });

  return { open };
}
