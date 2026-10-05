// "Liner notes": three recommended songs. The chapter card shows a stack of sleeves; opening
// the crate shows each pick's cover, note and credits, and plays it in a Spotify embed. The
// record player in the room follows along: the label shows the cover, the arm drops on play.
import { records, spotifyUri, type RecordPick } from '../content/records';
import { placeholder } from './placeholder';

export interface CrateHooks {
  /** A pick was selected (cover image loaded, or null while there is none) or the crate closed. */
  onRecord(pick: RecordPick | null, cover: HTMLImageElement | null): void;
  /** Spotify started or stopped playing. */
  onPlaying(playing: boolean): void;
}

interface SpotifyController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  addListener(event: 'playback_update', fn: (e: { data: { isPaused: boolean } }) => void): void;
}
interface SpotifyApi {
  createController(el: HTMLElement, opts: { uri: string; width: string; height: number }, cb: (c: SpotifyController) => void): void;
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyApi) => void;
  }
}

let apiPromise: Promise<SpotifyApi> | null = null;
function spotifyApi() {
  apiPromise ??= new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    document.head.append(s);
  });
  return apiPromise;
}

// Cover art straight from Spotify (oEmbed), unless the pick sets its own image.
const coverCache = new Map<string, Promise<HTMLImageElement | null>>();
function coverFor(pick: RecordPick) {
  if (!coverCache.has(pick.id)) {
    coverCache.set(
      pick.id,
      (async () => {
        let url = pick.cover;
        if (!url && pick.spotify) {
          try {
            const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(pick.spotify)}`);
            url = (await res.json()).thumbnail_url;
          } catch {
            return null;
          }
        }
        if (!url) return null;
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url!;
        });
      })(),
    );
  }
  return coverCache.get(pick.id)!;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export function mountCrate(slot: HTMLElement, hooks: CrateHooks) {
  // ---------- Collapsed: a fanned stack of sleeves on the chapter card ----------
  slot.innerHTML = `
    <div class="sleeves" aria-hidden="true">
      ${records.map((r, i) => `<span class="sleeve" style="--tint:${r.tint};--i:${i}" data-sleeve="${r.id}"></span>`).join('')}
    </div>
    <button class="btn" type="button" data-open-crate>Open the crate</button>
  `;
  const opener = slot.querySelector<HTMLButtonElement>('[data-open-crate]')!;

  // ---------- Expanded sheet ----------
  const sheet = document.createElement('div');
  sheet.className = 'crate';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Liner notes: songs I recommend');
  sheet.innerHTML = `
    <div class="crate__scrim" data-close></div>
    <div class="crate__panel liquid" data-liquid-bezel="26">
      <header class="crate__head">
        <span class="chapter__track">LINER NOTES</span>
        <button class="crate__close" type="button" data-close aria-label="Close">×</button>
      </header>
      <div class="crate__shelf" role="tablist" aria-label="Records">
        ${records
          .map(
            (r) => `
          <button class="crate__pick" type="button" role="tab" data-pick="${r.id}" style="--tint:${r.tint}">
            <span class="crate__thumb" data-thumb></span>
            <span class="crate__pick-text"><b>${esc(r.title)}</b><span>${esc(r.artist)}</span></span>
          </button>`,
          )
          .join('')}
      </div>
      <div class="crate__detail" role="tabpanel">
        <div class="crate__cover" data-cover></div>
        <div class="crate__info">
          <h3 class="crate__title" data-title></h3>
          <p class="crate__meta" data-meta></p>
          <p class="crate__note" data-note></p>
          <ul class="crate__credits" data-credits></ul>
          <div class="crate__embed" data-embed><div data-embed-host></div></div>
          <div class="crate__missing" data-missing></div>
          <a class="crate__link" data-link target="_blank" rel="noopener">Open in Spotify ↗</a>
        </div>
      </div>
    </div>
  `;
  document.body.append(sheet);

  const $ = <T extends Element>(sel: string) => sheet.querySelector<T>(sel)!;
  const embedBox = $<HTMLElement>('[data-embed]');
  const missing = $<HTMLElement>('[data-missing]');
  const link = $<HTMLAnchorElement>('[data-link]');
  let controller: SpotifyController | null = null;
  let controllerReady: Promise<SpotifyController> | null = null;
  let current: RecordPick | null = null;
  let playing = false;

  const setPlaying = (on: boolean) => {
    if (on === playing) return;
    playing = on;
    hooks.onPlaying(on);
  };

  const ensureController = (uri: string) => {
    controllerReady ??= spotifyApi().then(
      (api) =>
        new Promise<SpotifyController>((resolve) => {
          api.createController($<HTMLElement>('[data-embed-host]'), { uri, width: '100%', height: 152 }, (c) => {
            c.addListener('playback_update', (e) => setPlaying(!e.data.isPaused));
            controller = c;
            resolve(c);
          });
        }),
    );
    return controllerReady;
  };

  const select = async (pick: RecordPick) => {
    current = pick;
    sheet.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pick === pick.id)));
    $('[data-title]').textContent = pick.title;
    $('[data-meta]').textContent = [pick.artist, pick.album, pick.year].filter(Boolean).join(' · ');
    $('[data-note]').textContent = pick.note;
    $('[data-credits]').innerHTML = pick.credits.map((c) => `<li>${esc(c)}</li>`).join('');
    const cover = $<HTMLElement>('[data-cover]');
    cover.style.setProperty('--tint', pick.tint);
    cover.style.backgroundImage = '';

    const uri = spotifyUri(pick.spotify);
    embedBox.hidden = !uri;
    link.hidden = !uri;
    missing.replaceChildren();
    if (uri) {
      link.href = pick.spotify!;
      setPlaying(false);
      if (controller) controller.loadUri(uri);
      else void ensureController(uri);
    } else {
      controller?.pause();
      missing.append(placeholder({ label: `Liner notes: ${pick.title}`, needs: ['Spotify share link for this song', 'Your note and the credits (src/content/records.ts)'] }));
    }

    hooks.onRecord(pick, null);
    const img = await coverFor(pick);
    if (current !== pick || !img) return;
    cover.style.backgroundImage = `url("${img.src}")`;
    hooks.onRecord(pick, img);
  };

  // Thumbnails fill in as their covers arrive.
  const loadThumbs = () =>
    records.forEach(async (r) => {
      const img = await coverFor(r);
      if (!img) return;
      const url = `url("${img.src}")`;
      sheet.querySelector<HTMLElement>(`[data-pick="${r.id}"] [data-thumb]`)!.style.backgroundImage = url;
      slot.querySelector<HTMLElement>(`[data-sleeve="${r.id}"]`)!.style.backgroundImage = url;
    });
  loadThumbs();

  const open = () => {
    sheet.hidden = false;
    document.documentElement.classList.add('is-sheet');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    void select(current ?? records[0]);
    $<HTMLButtonElement>('.crate__close').focus();
  };
  const close = () => {
    controller?.pause();
    setPlaying(false);
    hooks.onRecord(null, null);
    sheet.classList.remove('is-open');
    document.documentElement.classList.remove('is-sheet');
    window.setTimeout(() => (sheet.hidden = true), 450);
    opener.focus();
  };

  opener.addEventListener('click', open);
  // Dev helper: /?crate opens the sheet on load.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('crate')) setTimeout(open, 1500);
  sheet.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]')) close();
    const pick = t.closest<HTMLElement>('[data-pick]');
    if (pick) void select(records.find((r) => r.id === pick.dataset.pick)!);
  });
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    /** The house player started: stop Spotify so two songs never overlap. */
    pause() {
      controller?.pause();
    },
  };
}
