// A small radix-2 Cooley-Tukey FFT, written out for the Lab's playground (the room itself
// uses the browser's AnalyserNode). In place, iterative: bit-reverse the order, then
// log2(N) stages of butterflies, each combining pairs of half-size transforms.

/** Magnitudes of the first N/2 bins of the real signal `x` (length a power of two). */
export function fftMagnitudes(x: Float32Array): Float32Array {
  const n = x.length;
  const re = Float32Array.from(x);
  const im = new Float32Array(n);

  // Bit-reversal permutation: the butterflies below expect this order.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterflies: at each stage, blocks double in size.
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }

  const mags = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) mags[k] = (Math.hypot(re[k], im[k]) * 2) / n;
  return mags;
}

/** Hann window: tapers the ends to zero so a tone that doesn't fit the frame leaks less. */
export function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}
