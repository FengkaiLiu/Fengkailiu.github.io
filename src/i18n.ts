// The site speaks English or Simplified Chinese. The language is picked once, before anything
// renders: a ?lang= link wins (and is remembered), then the visitor's last choice, then the
// browser's own language. Every module builds its text when it mounts, so switching reloads
// the page in the other language. Text lives next to its English as tr('English', '中文').

export type Lang = 'en' | 'zh';

const KEY = 'room-lang';
const valid = (v: string | null): v is Lang => v === 'en' || v === 'zh';

function pick(): Lang {
  const fromLink = new URLSearchParams(location.search).get('lang');
  if (valid(fromLink)) {
    try {
      localStorage.setItem(KEY, fromLink);
    } catch {}
    return fromLink;
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (valid(saved)) return saved;
  } catch {}
  return /^zh\b/i.test(navigator.language) ? 'zh' : 'en';
}

export const lang: Lang = pick();
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
