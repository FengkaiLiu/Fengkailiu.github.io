// The site speaks English or Simplified Chinese. English unless the address says ?lang=zh:
// the switch and the links you send carry it, so nothing is stored and a plain visit is
// always English. Every module builds its text when it mounts, so switching reloads the
// page in the other language. Text lives next to its English as tr('English', '中文').

export type Lang = 'en' | 'zh';

// An earlier version remembered the choice here; forget it, so it can't keep a visitor in Chinese.
try {
  localStorage.removeItem('room-lang');
} catch {}

export const lang: Lang = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : 'en';
export const isZh = lang === 'zh';

/** The English or the Chinese, whichever the page speaks. Works for strings and lists alike. */
export const tr = <T>(en: T, zh: T): T => (isZh ? zh : en);

/** For toLocaleDateString and friends. */
export const locale = tr('en-US', 'zh-CN');

/** This page in the other language: same chapter, same shared beat, other words. */
export function hrefFor(l: Lang) {
  const url = new URL(location.href);
  url.searchParams.set('lang', l);
  return `${url.pathname}${url.search}${url.hash}`;
}

document.documentElement.lang = tr('en', 'zh-CN');

/** A small glass switch in the top-left corner, there from the gate on. */
export function mountLangSwitch() {
  const nav = document.createElement('nav');
  nav.className = 'langswitch liquid liquid--pill';
  nav.dataset.liquidBezel = '14';
  nav.setAttribute('aria-label', tr('Language', '语言'));
  nav.innerHTML = (
    [
      ['en', 'en', 'EN', 'English'],
      ['zh', 'zh-CN', '中文', '简体中文'],
    ] as const
  )
    .map(
      ([l, code, label, name]) =>
        `<a class="langswitch__opt" href="${hrefFor(l)}" lang="${code}" hreflang="${code}" title="${name}"${l === lang ? ' aria-current="true"' : ''}>${label}</a>`,
    )
    .join('');
  document.body.append(nav);
}
