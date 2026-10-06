// A small glass tag that follows the pointer over things you can click in the room, so
// people find them. Mouse only: touch has no hover, and tapping just works.
import type { HotspotId } from '../room/props';

const HINTS: Record<HotspotId, string> = {
  keys: 'Play a note · drag for a run',
  cat: 'Pet the cat',
  lamp: 'Lamp on / off',
  record: 'Play / pause',
  handheld: 'Play Hot Footer',
};

export function mountRoomHints() {
  const tag = document.createElement('div');
  tag.className = 'roomhint';
  tag.setAttribute('aria-hidden', 'true');
  document.body.append(tag);
  let showTimer = 0;
  let current: HotspotId | null = null;
  return (id: HotspotId | null, x: number, y: number) => {
    if (matchMedia('(pointer: coarse)').matches) return;
    tag.style.transform = `translate(${x + 16}px, ${y + 18}px)`;
    if (id === current) return;
    current = id;
    window.clearTimeout(showTimer);
    if (!id) {
      tag.classList.remove('is-shown');
      return;
    }
    tag.textContent = HINTS[id];
    // A short delay, so sweeping across the room doesn't flash tags.
    showTimer = window.setTimeout(() => tag.classList.add('is-shown'), 220);
  };
}
