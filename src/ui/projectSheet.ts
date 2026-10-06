// The project sheet: a liquid glass panel that rises from the bottom with a project's full
// liner notes (cover, write-up, media still to come, links), and steps to the previous or
// next track without closing. A modal <dialog>, so focus, Escape and the backdrop behave.
import type { Project } from '../content/projects';
import { placeholder } from './placeholder';
import type { SmoothScroll } from './scroll';

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const arrow = '<svg class="sheet__ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7" /></svg>';

export interface SheetTrack {
  project: Project;
  /** "A3" */
  track: string;
}

export function mountProjectSheet(tracks: SheetTrack[], scroll: SmoothScroll) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet liquid liquid--pad';
  dialog.dataset.liquidBezel = '26';
  dialog.setAttribute('aria-labelledby', 'sheet-title');
  dialog.innerHTML = `
    <div class="sheet__scroll" data-lenis-prevent>
      <header class="sheet__head">
        <span class="chapter__track" data-track></span>
        <button class="sheet__close" type="button" aria-label="Close" data-close>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div data-body></div>
    </div>
    <nav class="sheet__nav" aria-label="Other projects">
      <button class="sheet__step" type="button" data-step="-1"></button>
      <button class="sheet__step sheet__step--next" type="button" data-step="1"></button>
    </nav>
  `;
  document.body.append(dialog);

  const body = dialog.querySelector<HTMLElement>('[data-body]')!;
  const scroller = dialog.querySelector<HTMLElement>('.sheet__scroll')!;
  const [prevBtn, nextBtn] = [...dialog.querySelectorAll<HTMLButtonElement>('[data-step]')];
  let index = 0;

  const render = () => {
    const { project: p, track } = tracks[index];
    dialog.querySelector('[data-track]')!.textContent = track;
    const links = [
      p.links.demo && `<a class="btn" href="${esc(p.links.demo)}" target="_blank" rel="noopener">Live demo ${arrow}</a>`,
      p.links.github && `<a class="btn btn--ghost" href="${esc(p.links.github)}" target="_blank" rel="noopener">Source on GitHub ${arrow}</a>`,
    ].filter(Boolean);
    body.innerHTML = `
      <h2 class="sheet__title" id="sheet-title">${esc(p.title)}</h2>
      <p class="sheet__subtitle">${esc(p.subtitle)}</p>
      <div class="chapter__tags">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      ${p.cover ? `<figure class="sheet__cover"><img src="${esc(p.cover)}" alt="${esc(p.title)} cover" loading="lazy" /></figure>` : ''}
      ${p.sections
        .map(
          (s) => `
        <section class="sheet__section">
          <h3>${esc(s.heading)}</h3>
          ${s.text ? `<p>${esc(s.text)}</p>` : ''}
          ${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        </section>`,
        )
        .join('')}
      <div data-media></div>
      ${links.length ? `<div class="sheet__links">${links.join('')}</div>` : ''}
    `;
    if (p.needs?.length) {
      body
        .querySelector('[data-media]')!
        .append(placeholder({ label: p.placeholder ? `${p.title}: everything` : `${p.title}: media`, needs: p.needs, tag: `FLOOR ${11 + Math.min(index, 3)}` }));
    }
    const prev = tracks[index - 1];
    const next = tracks[index + 1];
    prevBtn.hidden = !prev;
    nextBtn.hidden = !next;
    if (prev) prevBtn.innerHTML = `<span aria-hidden="true">←</span> <span class="sheet__step-no">${prev.track}</span> ${esc(prev.project.title)}`;
    if (next) nextBtn.innerHTML = `<span class="sheet__step-no">${next.track}</span> ${esc(next.project.title)} <span aria-hidden="true">→</span>`;
    prevBtn.setAttribute('aria-label', prev ? `Previous: ${prev.project.title}` : '');
    nextBtn.setAttribute('aria-label', next ? `Next: ${next.project.title}` : '');
    scroller.scrollTop = 0;
  };

  const open = (id: string) => {
    const i = tracks.findIndex((t) => t.project.id === id);
    if (i < 0) return;
    index = i;
    render();
    scroll.stop(); // the page (and the camera) stay put while the sheet is open
    dialog.showModal();
    document.documentElement.classList.add('has-sheet');
  };
  const close = () => {
    dialog.classList.add('is-closing');
    window.setTimeout(() => {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, 260);
  };
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-sheet');
    scroll.start();
    // Land on the chapter of the project you ended on, and hand focus back to its button.
    const el = document.getElementById(tracks[index].project.id);
    if (el) scroll.to(el, { instant: true });
    el?.querySelector<HTMLElement>('[data-sheet]')?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Escape: close with the animation
    close();
  });
  dialog.addEventListener('click', (e) => {
    // A click on the backdrop (outside the panel's box) closes it.
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside || (e.target as HTMLElement).closest('[data-close]')) close();
  });
  for (const btn of [prevBtn, nextBtn]) {
    btn.addEventListener('click', () => {
      index = Math.max(0, Math.min(tracks.length - 1, index + Number(btn.dataset.step)));
      render();
    });
  }
  // Left and right arrows step through the projects too.
  dialog.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowRight' && tracks[index + 1]) nextBtn.click();
    if (e.key === 'ArrowLeft' && tracks[index - 1]) prevBtn.click();
  });

  return { open };
}
