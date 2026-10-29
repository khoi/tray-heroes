import type { SpriteRef } from "../types";
import type { StatBlock, StatKey } from "./stats";

const d = (index: number): SpriteRef => ({ sheet: "dungeon", index });

export const GEMS = {
  ruby: { name: "Ruby", stat: "attackPct", values: [0.03, 0.05, 0.08], sprite: d(115) },
  garnet: { name: "Garnet", stat: "leech", values: [0.005, 0.008, 0.012], sprite: d(127) },
  emerald: { name: "Emerald", stat: "attackSpeed", values: [0.02, 0.035, 0.05], sprite: d(114) },
  topaz: { name: "Topaz", stat: "critChance", values: [0.015, 0.025, 0.04], sprite: d(129) },
  amethyst: { name: "Amethyst", stat: "critDamage", values: [0.06, 0.1, 0.16], sprite: d(126) },
  sapphire: { name: "Sapphire", stat: "lifePct", values: [0.03, 0.05, 0.08], sprite: d(116) },
  diamond: { name: "Diamond", stat: "allRes", values: [0.03, 0.05, 0.08], sprite: d(113) },
  onyx: { name: "Onyx", stat: "armorPct", values: [0.04, 0.07, 0.11], sprite: d(102) },
} as const satisfies Record<string, { name: string; stat: StatKey; values: readonly [number, number, number]; sprite: SpriteRef }>;

export type GemKind = keyof typeof GEMS;
export const GEM_TIERS = ["Chipped", "Polished", "Perfect"] as const;

export const PARTS = {
  wildFang: { name: "Wild Fang", act: 0, stats: { attackPct: 0.04, critChance: 0.01 } },
  bogGel: { name: "Bog Gel", act: 0, stats: { lifePct: 0.04, regenPct: 0.003 } },
  boneShard: { name: "Bone Shard", act: 1, stats: { armorPct: 0.06, block: 0.02 } },
  graveDust: { name: "Grave Dust", act: 1, stats: { chaosRes: 0.06, chaosDmg: 0.05 } },
  demonHorn: { name: "Demon Horn", act: 2, stats: { fireDmg: 0.06, fireRes: 0.06 } },
  frostCore: { name: "Frost Core", act: 2, stats: { coldDmg: 0.06, coldRes: 0.06 } },
  stormGland: { name: "Storm Gland", act: -1, stats: { lightningDmg: 0.06, lightningRes: 0.06 } },
  titanHeart: { name: "Titan Heart", act: -2, stats: { lifePct: 0.08, reduction: 0.02 } },
} as const satisfies Record<string, { name: string; act: number; stats: StatBlock }>;

export type PartKey = keyof typeof PARTS;

export type GemKey = `${GemKind}${1 | 2 | 3}`;
export type ScrollKey = "scroll1" | "scroll2" | "scroll3";
export type SoulKey = "soul0" | "soul1" | "soul2" | "soul3" | "soulPlague";
export type MaterialKey = GemKey | PartKey | ScrollKey | SoulKey | "dust";

export const GEM_KEYS = (Object.keys(GEMS) as GemKind[]).flatMap((g) => [`${g}1`, `${g}2`, `${g}3`] as GemKey[]);

export const MATERIAL_KEYS: MaterialKey[] = [
  ...GEM_KEYS,
  ...(Object.keys(PARTS) as PartKey[]),
  "scroll1",
  "scroll2",
  "scroll3",
  "soul0",
  "soul1",
  "soul2",
  "soul3",
  "soulPlague",
  "dust",
];

export type MaterialInfo =
  | { kind: "gem"; name: string; sprite: SpriteRef; stat: StatKey; value: number; tier: number }
  | { kind: "part"; name: string; sprite: SpriteRef; stats: StatBlock }
  | { kind: "scroll"; name: string; sprite: SpriteRef; tier: number }
  | { kind: "soul"; name: string; sprite: SpriteRef; difficulty: number }
  | { kind: "dust"; name: string; sprite: SpriteRef };

const SOUL_NAMES = ["Soulstone", "Nightmare Soulstone", "Hell Soulstone", "Torment Soulstone"];

export function material(key: MaterialKey): MaterialInfo {
  if (key === "dust") return { kind: "dust", name: "Arcane Dust", sprite: d(42) };
  if (key === "soulPlague") return { kind: "soul", name: "Contaminated Soulstone", sprite: d(102), difficulty: 4 };
  if (key.startsWith("soul")) {
    const difficulty = Number(key.slice(4));
    return { kind: "soul", name: SOUL_NAMES[difficulty]!, sprite: d(102), difficulty };
  }
  if (key.startsWith("scroll")) {
    const tier = Number(key.slice(6));
    return { kind: "scroll", name: `${["Faded", "Inked", "Gilded"][tier - 1]} Scroll`, sprite: d(66), tier };
  }
  if (key in PARTS) {
    const part = PARTS[key as PartKey];
    return { kind: "part", name: part.name, sprite: d(42), stats: part.stats };
  }
  const gem = GEMS[key.slice(0, -1) as GemKind];
  const tier = Number(key.slice(-1));
  return { kind: "gem", name: `${GEM_TIERS[tier - 1]} ${gem.name}`, sprite: gem.sprite, stat: gem.stat, value: gem.values[tier - 1]!, tier };
}

export function gemKey(kind: GemKind, tier: number): GemKey {
  return `${kind}${Math.min(3, Math.max(1, tier))}` as GemKey;
}
