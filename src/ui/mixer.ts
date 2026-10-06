// About, as a mixer: one channel strip per side of the work (code, sound, visual), each
// with its skills as insert slots, a fader and a level meter that moves with the room's
// music, plus a master strip that carries the stats. Solo a strip to spotlight it.
import { profile } from '../content/profile';
import type { Bands } from '../audio/bus';

interface Strip {
  id: string;
  name: string;
  skills: readonly string[];
  /** Fader position, 0..1: roughly how much of the week goes to it. */
  level: number;
  /** Which band drives its meter, so the strips move differently. */
  band: keyof Bands;
}

const STRIPS: Strip[] = [
  { id: 'code', name: 'Code', skills: profile.skills.code, level: 0.82, band: 'treble' },
  { id: 'sound', name: 'Sound', skills: profile.skills.sound, level: 0.74, band: 'bass' },
  { id: 'visual', name: 'Visual', skills: profile.skills.visual, level: 0.56, band: 'mid' },
];

/** Fader travel to a dB label, like the scale printed beside a real fader. */
const db = (level: number) => {
  const v = 20 * Math.log10(Math.max(level, 0.001) / 0.75);
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
};

export function mountMixer(slot: HTMLElement) {
  slot.innerHTML = `
    <div class="mixer" role="group" aria-label="Skills, as a mixing desk">
      ${STRIPS.map(
        (s) => `
        <section class="strip" data-strip="${s.id}" aria-label="${s.name}">
          <ul class="strip__inserts" aria-label="${s.name} skills">
            ${s.skills.map((k) => `<li class="strip__insert">${k}</li>`).join('')}
          </ul>
          <div class="strip__body">
            <div class="strip__meter" aria-hidden="true"><span data-meter></span></div>
            <div class="strip__fader" aria-hidden="true">
              <span class="strip__cap" style="--level:${s.level}"></span>
            </div>
          </div>
          <p class="strip__db" aria-hidden="true">${db(s.level)} dB</p>
          <button class="strip__solo" type="button" aria-pressed="false" title="Solo ${s.name}">S</button>
          <p class="strip__name">${s.name}</p>
        </section>`,
      ).join('')}
      <section class="strip strip--master" aria-label="Master">
        <dl class="strip__stats">
          ${profile.stats.map((st) => `<div class="strip__stat"><dt>${st.label}</dt><dd>${st.value}</dd></div>`).join('')}
        </dl>
        <div class="strip__body">
          <div class="strip__meter" aria-hidden="true"><span data-meter></span></div>
          <div class="strip__meter" aria-hidden="true"><span data-meter></span></div>
        </div>
        <p class="strip__db" aria-hidden="true">0.0 dB</p>
        <p class="strip__name">${profile.name.split(' ')[0]}</p>
      </section>
    </div>
    <p class="chapter__text mixer__after">${profile.bio[1]}</p>
  `;

  const mixer = slot.querySelector<HTMLElement>('.mixer')!;
  // Solo: one strip in the spotlight, the rest dimmed. Press again to bring them all back.
  mixer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.strip__solo');
    if (!btn) return;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    mixer.querySelectorAll<HTMLButtonElement>('.strip__solo').forEach((b) => b.setAttribute('aria-pressed', String(on && b === btn)));
    mixer.classList.toggle('is-soloed', on);
    mixer.querySelectorAll<HTMLElement>('[data-strip]').forEach((s) => s.classList.toggle('is-solo', on && s.contains(btn)));
  });

  const meters = [...slot.querySelectorAll<HTMLElement>('[data-meter]')];
  const held = new Float32Array(meters.length);
  return {
    /** Feed the room's bands each frame while music plays; meters fall back to rest after. */
    setBands(b: Bands) {
      const values = [...STRIPS.map((s) => b[s.band]), b.level, b.level * 0.94];
      values.forEach((v, i) => {
        // Meter ballistics: up fast, down slow.
        held[i] = v > held[i] ? v : held[i] * 0.94 + v * 0.06;
        meters[i].style.transform = `scaleY(${Math.min(held[i] * 0.8, 1).toFixed(3)})`; // peaks only now and then touch the red
      });
    },
  };
}
