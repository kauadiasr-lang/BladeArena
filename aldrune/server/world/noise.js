export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise2D(seed) {
  function hash(x, y) {
    const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return h - Math.floor(h);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = x - x0, yf = y - y0;
    const v00 = hash(x0, y0), v10 = hash(x0 + 1, y0), v01 = hash(x0, y0 + 1), v11 = hash(x0 + 1, y0 + 1);
    const sx = smooth(xf), sy = smooth(yf);
    const top = v00 + sx * (v10 - v00);
    const bottom = v01 + sx * (v11 - v01);
    return top + sy * (bottom - top);
  };
}

export function fbm(noise, x, y, { octaves = 4, persistence = 0.5, scale = 0.05 } = {}) {
  let total = 0, amp = 1, freq = scale, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise(x * freq, y * freq) * amp;
    max += amp;
    amp *= persistence;
    freq *= 2;
  }
  return total / max;
}
