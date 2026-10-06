// Liquid glass: real refraction of whatever sits behind an element.
//
// For each `.liquid` element we generate a displacement map from a physical model
// (a squircle-profiled glass bezel refracting light by Snell's law), wrap it in an SVG
// filter, and apply it with `backdrop-filter: url(#id)`. Only Chromium supports SVG
// backdrop filters; other browsers keep the frosted fallback from glass.css.
//
// Technique adapted from https://kube.io/blog/liquid-glass-css-svg/

const SVG_NS = 'http://www.w3.org/2000/svg';
const LUT_SIZE = 128;
const IOR = 1.5; // refractive index of glass

interface Entry {
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  displace: SVGFEDisplacementMapElement;
  w: number;
  h: number;
  /** Bumped per rebuild, so a slow encode can't overwrite a newer one. */
  gen: number;
  url?: string;
}

const entries = new WeakMap<HTMLElement, Entry>();
let defs: SVGDefsElement | null = null;
let counter = 0;

export const liquidSupported = (() => {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => /Chromium/i.test(b.brand));
})();

/** Upgrades every `.liquid` element under `root`, and keeps maps in sync with size changes. */
export function initLiquidGlass(root: ParentNode = document) {
  if (!liquidSupported) return;
  const els = root.querySelectorAll<HTMLElement>('.liquid');
  els.forEach(upgrade);
}

const resizeObserver = liquidSupported
  ? new ResizeObserver((records) => {
      for (const r of records) scheduleRebuild(r.target as HTMLElement);
    })
  : null;

const pending = new Set<HTMLElement>();
let pendingTimer = 0;
function scheduleRebuild(el: HTMLElement) {
  pending.add(el);
  clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => {
    pending.forEach(rebuild);
    pending.clear();
  }, 120);
}

function upgrade(el: HTMLElement) {
  if (entries.has(el)) return;
  if (!defs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.append(defs);
    document.body.append(svg);
  }

  const id = `liquid-${++counter}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', el.dataset.liquidBlur ?? '1.2');
  blur.setAttribute('result', 'blurred');

  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');

  const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displace.setAttribute('in', 'blurred');
  displace.setAttribute('in2', 'map');
  displace.setAttribute('xChannelSelector', 'R');
  displace.setAttribute('yChannelSelector', 'G');
  displace.setAttribute('result', 'refracted');

  const saturate = document.createElementNS(SVG_NS, 'feColorMatrix');
  saturate.setAttribute('in', 'refracted');
  saturate.setAttribute('type', 'saturate');
  saturate.setAttribute('values', '1.5');

  filter.append(blur, image, displace, saturate);
  defs!.append(filter);

  entries.set(el, { filter, image, displace, w: 0, h: 0, gen: 0 });
  rebuild(el);
  resizeObserver!.observe(el);
  el.classList.add('liquid--live');
}

// On lower quality tiers glass.css swaps the refraction for a plain blur, so maps aren't
// built then; elements that changed size meanwhile catch up when the tier climbs back.
const stale = new Set<HTMLElement>();
const fxFull = () => (document.documentElement.dataset.fx ?? 'full') === 'full';
if (liquidSupported) {
  new MutationObserver(() => {
    if (!fxFull()) return;
    stale.forEach(rebuild);
    stale.clear();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-fx'] });
}

function rebuild(el: HTMLElement) {
  const entry = entries.get(el);
  if (!entry) return;
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (w < 2 || h < 2 || (w === entry.w && h === entry.h)) return;
  if (!fxFull()) {
    stale.add(el);
    return;
  }
  entry.w = w;
  entry.h = h;

  const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
  const bezel = Math.min(Number(el.dataset.liquidBezel ?? 28), w / 2, h / 2);
  const depth = Number(el.dataset.liquidDepth ?? 1); // optical strength multiplier
  const canvas = displacementMap(w, h, radius, bezel);
  // Encoded off the main thread; a newer size that lands first wins.
  const gen = ++entry.gen;
  canvas.toBlob((blob) => {
    if (!blob || gen !== entry.gen) return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    entry.url = URL.createObjectURL(blob);
    entry.filter.setAttribute('width', String(w));
    entry.filter.setAttribute('height', String(h));
    entry.image.setAttribute('width', String(w));
    entry.image.setAttribute('height', String(h));
    entry.image.setAttribute('href', entry.url);
    entry.displace.setAttribute('scale', String(bezel * 0.5 * depth * 2));
    el.style.setProperty('backdrop-filter', `url(#${entry.filter.id})`);
    el.style.setProperty('-webkit-backdrop-filter', `url(#${entry.filter.id})`);
  });
}

/** Pixel shift along the bezel (0 = outer edge, 1 = inner edge), from Snell's law. */
const lut = (() => {
  // Squircle height profile: smooth like Apple's glass, flat in the middle.
  const height = (x: number) => Math.pow(1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 4), 0.25);
  const out = new Float32Array(LUT_SIZE);
  const d = 1e-3;
  for (let i = 0; i < LUT_SIZE; i++) {
    const x = i / (LUT_SIZE - 1);
    const slope = (height(x + d) - height(x - d)) / (2 * d);
    const incidence = Math.atan(slope); // light arrives perpendicular to the page
    const refracted = Math.asin(Math.sin(incidence) / IOR);
    out[i] = height(x) * Math.tan(incidence - refracted);
  }
  const max = Math.max(...out) || 1;
  for (let i = 0; i < LUT_SIZE; i++) out[i] /= max;
  return out;
})();

/** The map is drawn at half size (feImage stretches it back); the shift varies smoothly, so
 * this looks the same and costs a quarter of the work. */
const MAP_SCALE = 0.5;

function displacementMap(w: number, h: number, radius: number, bezel: number) {
  const mw = Math.max(2, Math.ceil(w * MAP_SCALE));
  const mh = Math.max(2, Math.ceil(h * MAP_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(mw, mh);
  const data = img.data;

  const hw = w / 2;
  const hh = h / 2;
  const r = Math.max(radius, 0.001);

  for (let my = 0; my < mh; my++) {
    for (let mx = 0; mx < mw; mx++) {
      // Signed distance to a rounded rectangle (in full-size pixels), plus its outward normal.
      const px = ((mx + 0.5) / mw) * w - hw;
      const py = ((my + 0.5) / mh) * h - hh;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      let dist: number;
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        dist = len - r;
        nx = qx / len;
        ny = qy / len;
      } else if (qx > qy) {
        dist = qx - r;
        nx = 1;
        ny = 0;
      } else {
        dist = qy - r;
        nx = 0;
        ny = 1;
      }
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;

      const inside = -dist; // distance from the edge, inward
      let mag = 0;
      if (inside >= 0 && inside < bezel) {
        mag = lut[Math.min(LUT_SIZE - 1, Math.floor((inside / bezel) * (LUT_SIZE - 1)))];
      }
      // Sample inward from the edge, so the rim visibly bends what is behind it.
      const i = (my * mw + mx) * 4;
      data[i] = 128 - nx * mag * 127;
      data[i + 1] = 128 - ny * mag * 127;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
