// Visible stand-in for content that does not exist yet.
// In dev, every placeholder is also listed in the console so nothing gets forgotten.

export interface PlaceholderOptions {
  label: string;
  needs?: readonly string[];
  /** Fixed aspect ratio, e.g. '16 / 9'. */
  ratio?: string;
  /** Short tag shown in the corner. Defaults to 'NEEDS'. */
  tag?: string;
}

const registry: PlaceholderOptions[] = [];
let reportQueued = false;

export function placeholder(opts: PlaceholderOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ph';
  el.dataset.placeholder = opts.label;
  if (opts.ratio) {
    el.dataset.ratio = '';
    el.style.setProperty('--ph-ratio', opts.ratio);
  }

  const tag = document.createElement('span');
  tag.className = 'ph__tag';
  tag.textContent = opts.tag ?? 'NEEDS';

  const label = document.createElement('div');
  label.className = 'ph__label';
  label.textContent = opts.label;

  el.append(tag, label);

  if (opts.needs?.length) {
    const list = document.createElement('ul');
    list.className = 'ph__needs';
    for (const need of opts.needs) {
      const li = document.createElement('li');
      li.textContent = need;
      list.append(li);
    }
    el.append(list);
  }

  if (import.meta.env.DEV) {
    registry.push(opts);
    queueReport();
  }
  return el;
}

function queueReport() {
  if (reportQueued) return;
  reportQueued = true;
  setTimeout(() => {
    reportQueued = false;
    console.groupCollapsed(`%c${registry.length} placeholders on this page`, 'color:#18c6e6;font-weight:bold');
    console.table(registry.map((p) => ({ label: p.label, needs: p.needs?.join('; ') ?? '' })));
    console.groupEnd();
  }, 500);
}
