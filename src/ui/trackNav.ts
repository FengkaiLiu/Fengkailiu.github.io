// Navigation as a record's track list: a glass pill in the top corner shows the track
// you are on ("A3 · Sonare of the Lake") with a thin progress line, and opens the full
// list, Side A and Side B, to jump anywhere.
import type { SmoothScroll } from './scroll';

export interface NavTrack {
  id: string;
  track: string;
  title: string;
}

export function mountTrackNav(tracks: NavTrack[], scroll: SmoothScroll) {
  const nav = document.createElement('nav');
  nav.className = 'tracknav';
  nav.setAttribute('aria-label', 'Chapters');
  const sides = ['A', 'B'].map((side) => ({ side, items: tracks.filter((t) => t.track.startsWith(side)) })).filter((s) => s.items.length);
  nav.innerHTML = `
    <button class="tracknav__pill liquid liquid--pill" type="button" data-liquid-bezel="16" aria-expanded="false" aria-controls="tracknav-list">
      <span class="tracknav__now"><span class="tracknav__no" data-no>♪</span><span class="tracknav__title" data-title>Track list</span></span>
      <svg class="tracknav__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      <span class="tracknav__progress" aria-hidden="true"><span data-progress></span></span>
    </button>
    <div class="tracknav__list liquid liquid--pad" id="tracknav-list" hidden>
      <a class="tracknav__item tracknav__item--top" href="#top" data-go="top"><span class="tracknav__no">↑</span>Back to the room</a>
      ${sides
        .map(
          (s) => `
        <p class="tracknav__side">Side ${s.side}</p>
        <ol class="tracknav__tracks">
          ${s.items.map((t) => `<li><a class="tracknav__item" href="#${t.id}" data-go="${t.id}"><span class="tracknav__no">${t.track}</span>${t.title}</a></li>`).join('')}
        </ol>`,
        )
        .join('')}
    </div>
  `;
  document.body.append(nav);

  const pill = nav.querySelector<HTMLButtonElement>('.tracknav__pill')!;
  const list = nav.querySelector<HTMLElement>('.tracknav__list')!;
  const no = nav.querySelector<HTMLElement>('[data-no]')!;
  const title = nav.querySelector<HTMLElement>('[data-title]')!;
  const progress = nav.querySelector<HTMLElement>('[data-progress]')!;

  const setOpen = (open: boolean) => {
    list.hidden = !open;
    pill.setAttribute('aria-expanded', String(open));
    if (open) list.querySelector<HTMLElement>('[aria-current="true"], .tracknav__item')?.focus({ preventScroll: true });
  };
  pill.addEventListener('click', () => setOpen(list.hidden));
  list.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-go]');
    if (!link) return;
    e.preventDefault();
    const id = link.dataset.go!;
    const el = id === 'top' ? null : document.getElementById(id);
    if (id === 'top') scroll.to('top');
    else if (el) scroll.to(el);
    setOpen(false);
    // Hand focus back to the pill, without the keyboard ring after a mouse click.
    pill.focus({ preventScroll: true, focusVisible: (e as PointerEvent).detail === 0 } as FocusOptions);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) {
      setOpen(false);
      pill.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!list.hidden && !nav.contains(e.target as Node)) setOpen(false);
  });

  // The current track: whichever chapter holds the middle of the screen.
  const sections = tracks.map((t) => ({ t, el: document.getElementById(t.id)! })).filter((s) => s.el);
  let current: NavTrack | null | undefined;
  const update = () => {
    const mid = window.innerHeight / 2;
    let found: NavTrack | null = null;
    for (const s of sections) {
      const r = s.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) found = s.t;
    }
    if (found !== current) {
      current = found;
      no.textContent = found ? found.track : '♪';
      title.textContent = found ? found.title : 'Track list';
      list.querySelectorAll<HTMLElement>('[data-go]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.go === found?.id)));
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  return {
    show() {
      nav.classList.add('is-shown');
    },
  };
}
