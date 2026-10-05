// "Liner notes": three recommended songs inside the chapter card. The card expands in place
// into an album stack; arrows flip between sleeves. "Spin it" plays the song's official 30 s
// preview through the room's turntable, so the arm drops, the label shows the cover, and the
// speakers react, then the room goes quiet again.
import { records, resolvePick, type ResolvedPick } from '../content/records';
import type { Player } from '../audio/player';
import { placeholder } from './placeholder';

export interface CrateHooks {
  /** Show this cover on the turntable label, or null to restore the house label. */
  setLabel(tint: string, cover: HTMLImageElement | null): void;
  clearLabel(): void;
}

const SPIN_SECONDS = 30;
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const images = new Map<string, Promise<HTMLImageElement | null>>();
const loadImage = (url: string) => {
  if (!images.has(url)) {
    images.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Apple's artwork CDN allows it; needed to draw it onto the 3D label
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  }
  return images.get(url)!;
};

export function mountCrate(slot: HTMLElement, player: Player, hooks: CrateHooks) {
  slot.innerHTML = `
    <div class="crate">
      <div class="sleeves" aria-hidden="true">
        ${records.map((r, i) => `<span class="sleeve" style="--tint:${r.tint};--i:${i}" data-sleeve="${r.id}"></span>`).join('')}
      </div>
      <button class="btn crate__toggle" type="button" aria-expanded="false" aria-controls="crate-body">Open the crate</button>
      <div class="crate__body" id="crate-body" inert>
        <div class="crate__inner">
          <div class="crate__stack" role="group" aria-roledescription="carousel" aria-label="Recommended records">
            <div class="crate__deck">
              ${records
                .map(
                  (r, i) => `
                <div class="album" data-album="${r.id}" style="--tint:${r.tint}" aria-hidden="${i !== 0}">
                  <span class="album__disc"></span>
                  <span class="album__cover" data-cover></span>
                </div>`,
                )
                .join('')}
            </div>
          </div>
          <div class="crate__nav">
            <button class="crate__arrow" type="button" data-step="-1" aria-label="Previous record">‹</button>
            <p class="crate__count" aria-live="polite" data-count></p>
            <button class="crate__arrow" type="button" data-step="1" aria-label="Next record">›</button>
          </div>
          <div class="crate__info">
            <h3 class="crate__title" data-title></h3>
            <p class="crate__meta" data-meta></p>
            <p class="crate__note" data-note></p>
            <ul class="crate__credits" data-credits></ul>
          </div>
          <div class="crate__actions">
            <button class="btn crate__spin" type="button" data-spin>Spin it · ${SPIN_SECONDS}s</button>
            <a class="crate__link" data-link target="_blank" rel="noopener">Full song ↗</a>
          </div>
          <div data-missing></div>
        </div>
      </div>
    </div>
  `;

  const $ = <T extends Element>(sel: string) => slot.querySelector<T>(sel)!;
  const card = slot.closest<HTMLElement>('.chapter__card')!;
  const toggle = $<HTMLButtonElement>('.crate__toggle');
  const body = $<HTMLElement>('.crate__body');
  const spinBtn = $<HTMLButtonElement>('[data-spin]');
  const link = $<HTMLAnchorElement>('[data-link]');
  const albums = [...slot.querySelectorAll<HTMLElement>('[data-album]')];
  let index = 0;
  let resolved: ResolvedPick | null = null;

  // Covers fill in on the sleeves and albums as Apple answers.
  records.forEach(async (r) => {
    const info = await resolvePick(r);
    if (!info.cover) return;
    const url = `url("${info.cover}")`;
    slot.querySelector<HTMLElement>(`[data-sleeve="${r.id}"]`)!.style.backgroundImage = url;
    slot.querySelector<HTMLElement>(`[data-album="${r.id}"] [data-cover]`)!.style.backgroundImage = url;
  });

  const spinningHere = () => {
    const s = player.state();
    return s.playing && s.guest?.id === records[index].id;
  };

  const render = async () => {
    // Stack order: the current record in front, the next ones peeking out behind it.
    albums.forEach((el, i) => {
      const pos = (i - index + records.length) % records.length;
      el.dataset.pos = String(pos);
      el.setAttribute('aria-hidden', String(pos !== 0));
    });
    $('[data-count]').textContent = `${index + 1} / ${records.length}`;
    const pick = records[index];
    const info = await resolvePick(pick);
    if (records[index] !== pick) return; // flipped again while loading
    resolved = info;
    $('[data-title]').textContent = info.title;
    $('[data-meta]').textContent = `${info.artist} · ${info.album} · ${info.year}`;
    $('[data-note]').textContent = pick.note;
    $('[data-credits]').innerHTML = info.credits.map((c) => `<li>${esc(c)}</li>`).join('');
    spinBtn.disabled = !info.preview;
    link.hidden = !info.link;
    if (info.link) link.href = info.link;
    const missing = $<HTMLElement>('[data-missing]');
    missing.replaceChildren();
    if (info.missing) missing.append(placeholder({ label: `Liner notes pick ${index + 1}`, needs: ['Apple Music link for this song (src/content/records.ts)', 'Your note on why you love it'] }));
    syncSpin();
  };

  const syncSpin = () => {
    const on = spinningHere();
    spinBtn.textContent = on ? 'Stop' : `Spin it · ${SPIN_SECONDS}s`;
    albums.forEach((el, i) => el.classList.toggle('is-spinning', on && i === index));
  };

  const step = (dir: number) => {
    index = (index + dir + records.length) % records.length;
    void render();
  };

  const setOpen = (open: boolean) => {
    card.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close the crate' : 'Open the crate';
    body.inert = !open;
    if (open) void render();
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  slot.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));
  body.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'ArrowLeft') step(-1);
    if (ke.key === 'ArrowRight') step(1);
  });

  spinBtn.addEventListener('click', async () => {
    if (spinningHere()) return player.pause();
    const info = resolved;
    if (!info?.preview) return;
    const img = info.cover ? await loadImage(info.cover) : null;
    hooks.setLabel(info.pick.tint, img);
    await player.spin({ id: info.pick.id, title: info.title, artist: info.artist, src: info.preview }, SPIN_SECONDS);
  });

  // When the clip ends (or anything else takes over), the turntable gets its house label back.
  player.onChange((s) => {
    if (!s.guest) hooks.clearLabel();
    syncSpin();
  });

  // Dev helper: /?crate opens the crate on load.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('crate')) setOpen(true);
}
