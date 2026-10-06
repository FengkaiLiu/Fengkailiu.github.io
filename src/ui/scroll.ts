// Smooth scrolling (Lenis): the wheel and trackpad glide instead of stepping, so the
// camera, which follows the scroll position, glides with them. Touch keeps the native
// feel. With reduced motion, scrolling stays native and jumps are instant.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export interface SmoothScroll {
  /** Glide to an element (centered in the view) or to the top. */
  to(target: HTMLElement | 'top', opts?: { instant?: boolean }): void;
  stop(): void;
  start(): void;
}

export function createSmoothScroll(): SmoothScroll {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = reduced
    ? null
    : new Lenis({
        lerp: 0.085,
        smoothWheel: true,
        autoRaf: true,
        // Let inner scrollers (the scope's tab row, the Spotify embed) keep their own scrolling.
        allowNestedScroll: true,
      });

  const centerOffset = (el: HTMLElement) => -(window.innerHeight - el.offsetHeight) / 2;

  return {
    to(target, opts = {}) {
      const instant = opts.instant || reduced;
      if (lenis) {
        if (target === 'top') lenis.scrollTo(0, { immediate: instant, duration: 1.6, force: true });
        else lenis.scrollTo(target, { offset: centerOffset(target), immediate: instant, duration: 1.6, force: true });
        return;
      }
      if (target === 'top') window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
      else target.scrollIntoView({ block: 'center', behavior: instant ? 'auto' : 'smooth' });
    },
    stop() {
      lenis?.stop();
    },
    start() {
      lenis?.start();
    },
  };
}
