import type { Rng } from "./types.ts";

/** RNG kriptografis untuk server. Dadu tidak bisa ditebak klien. */
export const cryptoRng: Rng = {
  int(min: number, max: number): number {
    const range = max - min + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    let x: number;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return min + (x % range);
  },
};

/** RNG dengan seed (mulberry32) untuk tes dan replay. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(min: number, max: number): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return min + Math.floor(r * (max - min + 1));
    },
  };
}

/** RNG dengan urutan angka tetap, untuk tes skenario tertentu. */
export function scriptedRng(values: number[], fallback: Rng = seededRng(1)): Rng {
  const queue = [...values];
  return {
    int(min: number, max: number): number {
      if (queue.length === 0) return fallback.int(min, max);
      const v = queue.shift()!;
      if (v < min || v > max) throw new Error(`nilai skrip ${v} di luar ${min}..${max}`);
      return v;
    },
  };
}
