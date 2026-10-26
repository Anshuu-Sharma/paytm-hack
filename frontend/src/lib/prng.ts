/**
 * Deterministic seeded PRNG (mulberry32). Used instead of Math.random() so
 * particle/filament layouts are stable across renders and SSR, and so the
 * generation stays "pure" for React's render rules.
 */
export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
