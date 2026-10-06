// The handheld from the shelf, life-size: a pastel console overlay that plays Lava Rising
// (Hot Footer). Its D-pad and buttons work by touch, the keyboard works too. The game's
// soundtrack borrows the turntable and plays through the music bus, so the room lights and
// speakers dance to it. The game code and assets load only when the console first opens.
import { getAudio, unlockAudio } from '../audio/context';
import { getMusicBus } from '../audio/bus';
import type { Player, GuestSlot } from '../audio/player';
import type { SmoothScroll } from './scroll';
import type { Button, LavaRising } from '../games/lavaRising';

export interface GameConsole {
  open(): void;
}

export function mountGameConsole(player: Player, scroll: SmoothScroll): GameConsole {
  const dialog = document.createElement('dialog');
  dialog.className = 'console';
  dialog.setAttribute('aria-label', 'Lava Rising, playable');
  dialog.innerHTML = `
    <div class="console__body">
      <button class="console__close" type="button" aria-label="Close the game" data-close>&times;</button>
      <div class="console__shoulder console__shoulder--l" aria-hidden="true"></div>
      <div class="console__shoulder console__shoulder--r" aria-hidden="true"></div>
      <div class="console__left">
        <div class="console__dpad" role="group" aria-label="Move">
          <button type="button" class="console__dir console__dir--up" data-btn="jump" aria-label="Jump"></button>
          <button type="button" class="console__dir console__dir--left" data-btn="left" aria-label="Left"></button>
          <span class="console__dir console__dir--mid" aria-hidden="true"></span>
          <button type="button" class="console__dir console__dir--right" data-btn="right" aria-label="Right"></button>
          <span class="console__dir console__dir--down" aria-hidden="true"></span>
        </div>
      </div>
      <div class="console__screen">
        <canvas class="console__canvas" tabindex="-1"></canvas>
        <p class="console__loading" data-loading>Inserting cartridge…</p>
      </div>
      <div class="console__right">
        <div class="console__ab">
          <button type="button" class="console__btn console__btn--b" data-btn="run" aria-label="B: hold to run"><span>B</span></button>
          <button type="button" class="console__btn console__btn--a" data-btn="jump" aria-label="A: jump"><span>A</span></button>
        </div>
        <div class="console__grille" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="console__pills">
        <button type="button" class="console__pill" data-mute aria-pressed="false"><span>Sound</span></button>
        <button type="button" class="console__pill" data-btn="start"><span>Start</span></button>
      </div>
      <p class="console__brand" aria-hidden="true">HOT FOOTER</p>
    </div>
    <p class="console__help">
      <kbd>←</kbd><kbd>→</kbd> move · <kbd>Shift</kbd> or <b>B</b> run · <kbd>Space</kbd> or <b>A</b> jump, again in the air, and off walls ·
      climb to the door, don't touch the lava · <kbd>Esc</kbd> to close
    </p>
  `;
  document.body.append(dialog);

  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas')!;
  const loading = dialog.querySelector<HTMLElement>('[data-loading]')!;
  const muteBtn = dialog.querySelector<HTMLButtonElement>('[data-mute]')!;
  let game: LavaRising | null = null;
  let slot: GuestSlot | null = null;
  let muted = false;
  let opening: Promise<void> | null = null;

  const setMuted = (m: boolean) => {
    muted = m;
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.querySelector('span')!.textContent = m ? 'Muted' : 'Sound';
    game?.setMuted(m);
  };
  muteBtn.addEventListener('click', () => setMuted(!muted));

  // Touch and mouse on the console's own buttons. Pointer capture keeps a held button held
  // even if the thumb slides a little.
  dialog.querySelectorAll<HTMLButtonElement>('[data-btn]').forEach((el) => {
    const b = el.dataset.btn as Button;
    const set = (down: boolean) => {
      el.classList.toggle('is-down', down);
      game?.press(b, down);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      set(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(ev, () => set(false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const close = () => dialog.close();
  dialog.querySelector('[data-close]')!.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // the dimmed backdrop
  });
  dialog.addEventListener('close', () => {
    game?.dispose();
    game = null;
    opening = null;
    slot?.end();
    slot = null;
    document.documentElement.classList.remove('has-console');
    scroll.start();
  });

  return {
    open() {
      if (dialog.open) return;
      dialog.showModal();
      canvas.focus({ preventScroll: true }); // so Space and Enter go to the game, not a button
      document.documentElement.classList.add('has-console');
      scroll.stop();
      loading.hidden = false;
      opening ??= (async () => {
        // Audio unlocks from the click that opened the console; never let a slow resume hold up the game.
        await Promise.race([unlockAudio().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
        const [{ mountLavaRising }] = await Promise.all([import('../games/lavaRising')]);
        if (!dialog.open) return;
        const { ctx } = getAudio();
        // The game takes the turntable: the room's own music pauses, and the dock shows it.
        slot = player.host({ id: 'lava-rising', title: 'Lava Rising', artist: 'Hot Footer soundtrack · Fengkai Liu', inRoom: true }, () => setMuted(true));
        const startLevel = import.meta.env.DEV ? (new URLSearchParams(location.search).get('game') ?? undefined) : undefined;
        const g = await mountLavaRising(canvas, { ctx, output: getMusicBus().input, startLevel });
        if (!dialog.open) {
          g.dispose();
          return;
        }
        game = g;
        game.setMuted(muted);
        loading.hidden = true;
      })().catch((err) => {
        console.error('[lava rising]', err);
        loading.textContent = "The cartridge didn't load. Try again in a moment.";
      });
    },
  };
}
