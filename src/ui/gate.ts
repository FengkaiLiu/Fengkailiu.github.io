// Startup gate: loads everything behind a glossy power orb, then the click
// unlocks audio, plays the chime, and the world rises into morning.
import { unlockAudio } from '../audio/context';
import { playStartupChime } from '../audio/chime';

export interface GateTask {
  label: string;
  run: Promise<unknown>;
}

const RING = 2 * Math.PI * 54;
const MIN_LOAD_MS = 1400; // long enough to see the ring fill, short enough not to annoy

export function showGate(tasks: GateTask[]): Promise<{ sound: boolean }> {
  document.documentElement.classList.add('is-gated');

  const gate = document.createElement('div');
  gate.className = 'gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-label', 'Start the portfolio');
  gate.innerHTML = `
    <div class="gate__inner">
      <span class="eyebrow gate__eyebrow">Fengkai Liu · Portfolio</span>
      <h1 class="gate__title">Resonance City</h1>
      <button class="orb" type="button" disabled aria-label="Power on">
        <svg class="orb__ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="orb__track" cx="60" cy="60" r="54" />
          <circle class="orb__progress" cx="60" cy="60" r="54" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" />
        </svg>
        <span class="orb__ball">
          <svg class="orb__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
        </span>
      </button>
      <p class="gate__status" aria-live="polite">Starting up</p>
      <p class="gate__hint">Best with sound on</p>
      <button class="gate__silent" type="button" disabled>Enter without sound</button>
    </div>
  `;
  document.body.append(gate);

  const orb = gate.querySelector<HTMLButtonElement>('.orb')!;
  const silent = gate.querySelector<HTMLButtonElement>('.gate__silent')!;
  const progressEl = gate.querySelector<SVGCircleElement>('.orb__progress')!;
  const status = gate.querySelector<HTMLParagraphElement>('.gate__status')!;

  // Displayed progress eases toward real progress so the ring fills smoothly.
  let done = 0;
  let shown = 0;
  const total = tasks.length + 1; // +1 for the minimum display time
  let raf = 0;
  const animate = () => {
    shown += (done / total - shown) * 0.12;
    progressEl.style.strokeDashoffset = String(RING * (1 - shown));
    if (shown < 0.999) raf = requestAnimationFrame(animate);
    else progressEl.style.strokeDashoffset = '0';
  };
  raf = requestAnimationFrame(animate);

  const all = tasks.map((task) =>
    task.run
      .catch((err) => console.warn(`[gate] ${task.label} failed`, err))
      .then(() => {
        done++;
        status.textContent = task.label;
      }),
  );
  all.push(new Promise<void>((r) => setTimeout(r, MIN_LOAD_MS)).then(() => void done++));

  Promise.all(all).then(() => {
    done = total;
    status.textContent = 'Ready. Press to power on';
    orb.disabled = false;
    silent.disabled = false;
    gate.classList.add('is-ready');
    orb.focus({ preventScroll: true });
  });

  return new Promise((resolve) => {
    const enter = async (sound: boolean) => {
      orb.disabled = true;
      silent.disabled = true;
      cancelAnimationFrame(raf);
      if (sound) {
        try {
          await unlockAudio();
          playStartupChime();
        } catch (err) {
          console.warn('[gate] audio unavailable', err);
        }
      }
      gate.classList.add('is-leaving');
      document.documentElement.classList.remove('is-gated');
      resolve({ sound });
      setTimeout(() => gate.remove(), 1600);
    };
    orb.addEventListener('click', () => enter(true));
    silent.addEventListener('click', () => enter(false));
    // Dev helper: /?nogate enters silently as soon as loading finishes.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('nogate')) {
      Promise.all(all).then(() => enter(false));
    }
  });
}
