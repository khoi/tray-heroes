export interface Seeded {
  rng: number;
}

export function rand(s: Seeded): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(s: Seeded, list: readonly T[]): T {
  const value = list[Math.floor(rand(s) * list.length)];
  if (value === undefined) throw new Error("pick from empty list");
  return value;
}

export function weighted<T>(s: Seeded, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand(s) * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  const last = entries.at(-1);
  if (!last) throw new Error("weighted pick from empty list");
  return last[0];
}
