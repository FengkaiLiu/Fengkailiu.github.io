// Slides a bottom-bar pill out of the row (or back in): its width eases to zero while it
// fades, and the neighbours close the gap. Used while a Spotify song plays, when the room
// cannot control or hear it, so volume and scope have nothing to do.

const MS = 450;

export function stepAside(el: HTMLElement, away: boolean) {
  if (el.classList.contains('is-away') === away) return;
  el.inert = away; // out of the tab order while it's gone
  window.clearTimeout(Number(el.dataset.asideTimer ?? 0));
  if (away) {
    // From its natural width to zero; remember the width for the way back.
    const width = el.getBoundingClientRect().width;
    el.dataset.asideWidth = String(width);
    el.style.width = `${width}px`;
    void el.offsetWidth; // commit the start width before animating
    el.classList.add('is-away');
    el.style.width = '0px';
  } else {
    // Grow back to the width it had; fade and padding ease in alongside.
    el.classList.remove('is-away');
    el.style.width = `${el.dataset.asideWidth ?? el.scrollWidth}px`;
    // Back to auto once it has grown, so it can still resize with its content.
    el.dataset.asideTimer = String(window.setTimeout(() => (el.style.width = ''), MS));
  }
}
