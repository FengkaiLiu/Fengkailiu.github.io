// Moves the specular highlight on .glass surfaces to follow the pointer.
// One delegated listener for the whole page; only the hovered panel is updated.

export function initSheen() {
  if (matchMedia('(hover: none)').matches) return;

  let frame = 0;
  let lastEvent: PointerEvent | null = null;

  window.addEventListener(
    'pointermove',
    (e) => {
      lastEvent = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const target = (lastEvent?.target as Element | null)?.closest<HTMLElement>('.glass');
        if (!target || !lastEvent) return;
        const r = target.getBoundingClientRect();
        target.style.setProperty('--mx', `${lastEvent.clientX - r.left}px`);
        target.style.setProperty('--my', `${lastEvent.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}
