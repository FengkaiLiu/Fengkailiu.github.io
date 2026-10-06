// Contact: "Leave me a beat." A 16-step sequencer over the room's 4-bar progression
// (kick, snare, hat, bass, and Rhodes chords that follow the bar), saved into a link you
// can share, and a message form that sends it along (through FormSubmit, a form-to-email
// relay, so it works without the visitor's email app). The beat plays through the room's
// own audio, so the lights, meters and scope all follow it.
import { getMusicBus } from '../audio/bus';
import { getAudio, unlockAudio } from '../audio/context';
import { BARS, createKit, type Kit } from '../audio/kit';
import type { GuestSlot, Player } from '../audio/player';
import { profile } from '../content/profile';

const ROWS = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hat', name: 'Hat' },
  { id: 'bass', name: 'Bass' },
  { id: 'keys', name: 'Keys' },
] as const;
type Row = (typeof ROWS)[number]['id'];
const STEPS = 16;
const SWING = 0.24;
const LOOKAHEAD = 0.12;

// A starter beat so it sounds good on the first press.
const STARTER: Record<Row, number[]> = {
  kick: [0, 7, 10],
  snare: [4, 12],
  hat: [0, 2, 4, 6, 8, 10, 12, 14],
  bass: [0, 8, 14],
  keys: [0, 11],
};

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** "82-" + 20 hex digits: tempo, then the 5 x 16 grid as bits. */
function encode(grid: boolean[][], bpm: number) {
  let hex = '';
  for (const row of grid) for (let i = 0; i < STEPS; i += 4) hex += ((+row[i] << 3) | (+row[i + 1] << 2) | (+row[i + 2] << 1) | +row[i + 3]).toString(16);
  return `${bpm}-${hex}`;
}
function decode(code: string): { grid: boolean[][]; bpm: number } | null {
  const m = code.match(/^(\d{2,3})-([0-9a-f]{20})$/i);
  if (!m) return null;
  const bpm = Math.min(Math.max(Number(m[1]), 60), 120);
  const digits = m[2];
  const grid = ROWS.map((_, r) =>
    Array.from({ length: STEPS }, (_, i) => (parseInt(digits[r * 4 + Math.floor(i / 4)], 16) >> (3 - (i % 4))) & 1).map(Boolean),
  );
  return { grid, bpm };
}

export function mountBeatbox(slot: HTMLElement, player: Player) {
  const shared = decode(new URLSearchParams(location.hash.slice(1)).get('beat') ?? '');
  const grid: boolean[][] = shared?.grid ?? ROWS.map((r) => Array.from({ length: STEPS }, (_, i) => STARTER[r.id].includes(i)));
  let bpm = shared?.bpm ?? 82;

  slot.innerHTML = `
    <div class="beat">
      ${shared ? '<p class="beat__gift">Someone left you a beat. Press play.</p>' : ''}
      <div class="beat__bar">
        <button class="btn beat__play" type="button" data-play aria-pressed="false">Play</button>
        <label class="beat__tempo"><span>Tempo <output data-bpm-out>${bpm}</output></span><input type="range" min="60" max="120" value="${bpm}" data-bpm /></label>
        <button class="beat__tool" type="button" data-surprise>Surprise me</button>
        <button class="beat__tool" type="button" data-clear>Clear</button>
      </div>
      <p class="beat__chords"><span class="beat__chords-label">The grid repeats each bar, over a 4-bar loop:</span>${BARS.map((b, i) => `<span class="beat__chord" data-chord="${i}">${b.name}</span>`).join('')}</p>
      <div class="beat__grid" role="grid" aria-label="Step sequencer: rows are instruments, columns are 16th notes">
        ${ROWS.map(
          (r, ri) => `
          <div class="beat__row" role="row">
            <span class="beat__name" role="rowheader">${r.name}</span>
            ${Array.from(
              { length: STEPS },
              (_, i) =>
                `<button class="beat__step" type="button" role="gridcell" data-r="${ri}" data-i="${i}" aria-pressed="${grid[ri][i]}" aria-label="${r.name}, step ${i + 1}"></button>`,
            ).join('')}
          </div>`,
        ).join('')}
      </div>

      <form class="beat__form" data-form>
        <div class="beat__pair">
          <label class="beat__field"><span>Your name</span><input name="name" autocomplete="name" required /></label>
          <label class="beat__field"><span>Your email</span><input name="email" type="email" autocomplete="email" required placeholder="so I can write back" /></label>
        </div>
        <!-- Honeypot: hidden from people, filled in by spam bots, and then ignored. -->
        <input class="beat__honey" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <label class="beat__field"><span>Message</span><textarea name="message" rows="3" required placeholder="Say hi, ask about a project, or just send the beat."></textarea></label>
        <label class="beat__check"><input type="checkbox" name="withBeat" checked /> Attach my beat (as a link)</label>
        <div class="beat__actions">
          <button class="btn" type="submit" data-send>Send with my beat</button>
          <button class="beat__tool" type="button" data-copy>Copy beat link</button>
          <span class="beat__copied" aria-live="polite" data-copied></span>
        </div>
        <p class="beat__status" aria-live="polite" data-status></p>
      </form>

      <ul class="beat__links">
        <li><button class="beat__linkbtn" type="button" data-email>Email: ${esc(profile.links.email)}</button></li>
        <li><a href="${esc(profile.links.github)}" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="${esc(profile.links.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></li>
        <li><a href="${esc(profile.links.instagram)}" target="_blank" rel="noopener">Instagram</a></li>
      </ul>
    </div>
  `;

  const $ = <T extends Element>(sel: string) => slot.querySelector<T>(sel)!;
  const cells = [...slot.querySelectorAll<HTMLButtonElement>('.beat__step')];
  const cell = (r: number, i: number) => cells[r * STEPS + i];
  const paint = () => cells.forEach((c) => c.setAttribute('aria-pressed', String(grid[+c.dataset.r!][+c.dataset.i!])));

  // Toggle a step; while dragging with the button held, paint the same state across cells.
  let painting: boolean | null = null;
  slot.querySelector('.beat__grid')!.addEventListener('pointerdown', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.beat__step');
    if (!c) return;
    const r = +c.dataset.r!;
    const i = +c.dataset.i!;
    painting = !grid[r][i];
    grid[r][i] = painting;
    paint();
    if (painting) preview(r);
  });
  slot.querySelector('.beat__grid')!.addEventListener('pointerover', (e) => {
    if (painting === null) return;
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.beat__step');
    if (!c || grid[+c.dataset.r!][+c.dataset.i!] === painting) return;
    grid[+c.dataset.r!][+c.dataset.i!] = painting;
    paint();
  });
  window.addEventListener('pointerup', () => (painting = null));
  // Keyboard: Space/Enter toggles (the buttons' own click), arrows move around the grid.
  slot.querySelector('.beat__grid')!.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.beat__step');
    if (!c || (e as MouseEvent).detail !== 0) return; // pointer clicks were handled on pointerdown
    const r = +c.dataset.r!;
    const i = +c.dataset.i!;
    grid[r][i] = !grid[r][i];
    paint();
  });
  slot.querySelector('.beat__grid')!.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    const c = (ke.target as HTMLElement).closest<HTMLButtonElement>('.beat__step');
    if (!c) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const mv = moves[ke.key];
    if (!mv) return;
    ke.preventDefault();
    const r = (+c.dataset.r! + mv[0] + ROWS.length) % ROWS.length;
    const i = (+c.dataset.i! + mv[1] + STEPS) % STEPS;
    cell(r, i).focus();
  });

  $('[data-clear]').addEventListener('click', () => {
    grid.forEach((row) => row.fill(false));
    paint();
  });
  $('[data-surprise]').addEventListener('click', () => {
    // Musical randomness: kicks on strong steps, snares on the backbeat, busy hats, sparse keys.
    const odds: Record<Row, (i: number) => number> = {
      kick: (i) => (i === 0 ? 1 : i % 4 === 0 ? 0.35 : i % 2 === 0 ? 0.2 : 0.08),
      snare: (i) => (i === 4 || i === 12 ? 0.95 : i % 2 ? 0.06 : 0.04),
      hat: (i) => (i % 2 === 0 ? 0.85 : 0.3),
      bass: (i) => (i === 0 ? 1 : i % 4 === 2 ? 0.3 : 0.1),
      keys: (i) => (i === 0 ? 0.9 : i % 4 === 3 ? 0.25 : 0.05),
    };
    ROWS.forEach((r, ri) => grid[ri].forEach((_, i) => (grid[ri][i] = Math.random() < odds[r.id](i))));
    paint();
  });
  const bpmInput = $<HTMLInputElement>('[data-bpm]');
  bpmInput.addEventListener('input', () => {
    bpm = Number(bpmInput.value);
    $('[data-bpm-out]').textContent = String(bpm);
  });

  // ---------- Playback ----------
  let kit: Kit | null = null;
  let timer = 0;
  let step = 0;
  let nextTime = 0;
  let turntable: GuestSlot | null = null;
  const queue: { step: number; time: number }[] = [];

  const hit = (row: Row, t: number, s: number) => {
    if (!kit) return;
    const bar = BARS[Math.floor(s / STEPS) % BARS.length];
    const i = s % STEPS;
    if (row === 'kick') kit.kick(t, i === 0 ? 0.95 : 0.78);
    else if (row === 'snare') kit.snare(t + 0.008, 0.88);
    else if (row === 'hat') kit.hat(t, i % 4 === 0 ? 0.07 : 0.05, i % 4 === 0 ? -0.3 : 0.3);
    else if (row === 'bass') kit.bass(t, bar.bass + (i === 14 ? 7 : 0), (60 / bpm / 4) * 3);
    else bar.chord.forEach((n, k) => kit!.keys(t + k * 0.025, n, (60 / bpm / 4) * (i === 0 ? 12 : 4), i === 0 ? 0.075 : 0.05));
  };
  const preview = (r: number) => {
    if (!kit) return; // only while playing; otherwise the press itself is the feedback
    hit(ROWS[r].id, getAudio().ctx.currentTime, step);
  };
  const tick = () => {
    const { ctx } = getAudio();
    const len = 60 / bpm / 4;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const t = nextTime + (step % 2 === 1 ? len * SWING : 0);
      ROWS.forEach((r, ri) => grid[ri][step % STEPS] && hit(r.id, t, step));
      queue.push({ step, time: t });
      nextTime += len;
      step++;
    }
  };
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const start = async () => {
    await unlockAudio();
    const { ctx } = getAudio();
    kit = createKit(ctx, getMusicBus().input);
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    queue.length = 0;
    tick();
    timer = window.setInterval(tick, 25);
    // Borrow the turntable: the room's music pauses and the dock shows the beat.
    turntable = player.host({ id: 'beat', title: 'Your beat', artist: `${bpm} BPM · 4 bars`, inRoom: true }, () => stop(false));
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.textContent = 'Stop';
    requestAnimationFrame(playhead);
  };
  const stop = (release = true) => {
    window.clearInterval(timer);
    kit?.stop();
    kit = null;
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = 'Play';
    cells.forEach((c) => c.classList.remove('is-now'));
    slot.querySelectorAll('[data-chord]').forEach((c) => c.classList.remove('is-now'));
    if (release) turntable?.end();
    turntable = null;
  };
  playBtn.addEventListener('click', () => (kit ? stop() : void start()));

  // Playhead: the column whose scheduled time has just passed.
  let shownStep = -1;
  const playhead = () => {
    if (!kit) return;
    const now = getAudio().ctx.currentTime;
    while (queue.length > 1 && queue[1].time <= now) queue.shift();
    const s = queue[0]?.time <= now ? queue[0].step : -1;
    if (s !== shownStep && s >= 0) {
      shownStep = s;
      const col = s % STEPS;
      cells.forEach((c) => c.classList.toggle('is-now', +c.dataset.i! === col));
      const barIdx = Math.floor(s / STEPS) % BARS.length;
      slot.querySelectorAll<HTMLElement>('[data-chord]').forEach((c) => c.classList.toggle('is-now', +c.dataset.chord! === barIdx));
    }
    requestAnimationFrame(playhead);
  };

  // ---------- Sharing and sending ----------
  const link = () => `${location.origin}${location.pathname}#beat=${encode(grid, bpm)}`;
  const copied = $<HTMLElement>('[data-copied]');
  $('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link());
      copied.textContent = 'Link copied.';
    } catch {
      copied.textContent = link();
    }
    window.setTimeout(() => (copied.textContent = ''), 3000);
  });
  // Email: copy the address (a mailto: link does nothing for people without a mail app).
  const emailBtn = $<HTMLButtonElement>('[data-email]');
  emailBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(profile.links.email);
      emailBtn.textContent = 'Email address copied';
    } catch {
      emailBtn.textContent = profile.links.email;
    }
    window.setTimeout(() => (emailBtn.textContent = `Email: ${profile.links.email}`), 2500);
  });

  // Send: posted to FormSubmit, which forwards it to the inbox. No account or mail app needed.
  const formEl = $<HTMLFormElement>('[data-form]');
  const status = $<HTMLElement>('[data-status]');
  const sendBtn = $<HTMLButtonElement>('[data-send]');
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(formEl);
    if (form.get('_honey')) return; // a bot filled in the hidden field
    const name = String(form.get('name') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();
    const withBeat = Boolean(form.get('withBeat'));
    sendBtn.disabled = true;
    status.className = 'beat__status';
    status.textContent = 'Sending…';
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${profile.links.email}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name,
          email: String(form.get('email') ?? '').trim(),
          message,
          beat: withBeat ? `${link()} (${bpm} BPM)` : 'none attached',
          _subject: `Portfolio: a note from ${name || 'a visitor'}`,
          _template: 'table',
          _captcha: 'false',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: string | boolean };
      if (!res.ok || String(data.success) !== 'true') throw new Error('not sent');
      status.classList.add('is-ok');
      status.textContent = 'Sent. Thank you, I will write back soon.';
      formEl.reset();
    } catch {
      status.classList.add('is-error');
      status.textContent = `That didn't go through. You can email ${profile.links.email} directly (the Email button below copies it).`;
    } finally {
      sendBtn.disabled = false;
    }
  });

  return {
    /** Whether the page was opened from a shared beat link. */
    shared: Boolean(shared),
  };
}
