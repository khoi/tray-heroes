import type { StatKey } from "./stats";

export const UTILITY_KEYS = [
  "commonChest",
  "bossChest",
  "chestInterval",
  "inventory",
  "stash",
  "partySlot",
  "skillSlot",
  "autoOpenCommon",
  "autoOpenBoss",
  "autoOpenAct",
  "autoOpenSpeed",
  "offlineHours",
  "fewerWaves",
  "alchemyGold",
  "materialDrop",
  "soulDrop",
  "cubeXp",
] as const;

export type UtilityKey = (typeof UTILITY_KEYS)[number];
export type ModKey = StatKey | UtilityKey;

export type Branch = "heroes" | "gold" | "wisdom" | "storage" | "treasure" | "combat";

export const BRANCHES: Record<Branch, { name: string; angle: number }> = {
  heroes: { name: "Heroes", angle: 90 },
  wisdom: { name: "Wisdom", angle: 150 },
  gold: { name: "Gold", angle: 210 },
  storage: { name: "Storage", angle: 270 },
  treasure: { name: "Treasure", angle: 330 },
  combat: { name: "Combat", angle: 30 },
};

export interface RuneDef {
  name: string;
  branch: Branch;
  depth: number;
  side: -1 | 0 | 1;
  effect: ModKey;
  per: number;
  max: number;
  cost: number;
  growth: number;
  requires: RuneKey[];
}

const r = (name: string, branch: Branch, depth: number, side: -1 | 0 | 1, effect: ModKey, per: number, max: number, cost: number, growth: number, requires: string[]) =>
  ({ name, branch, depth, side, effect, per, max, cost, growth, requires }) as Omit<RuneDef, "requires"> & { requires: string[] };

const DEFS = {
  command1: r("Command I", "heroes", 1, 0, "partySlot", 1, 1, 1_000, 1, []),
  drill: r("Drill", "heroes", 2, -1, "xpFind", 0.04, 10, 600, 1.45, ["command1"]),
  awakening1: r("Awakening I", "heroes", 2, 0, "skillSlot", 1, 1, 50_000, 1, ["command1"]),
  fortitude: r("Fortitude", "heroes", 2, 1, "lifePct", 0.05, 25, 400, 1.42, ["command1"]),
  command2: r("Command II", "heroes", 3, 0, "partySlot", 1, 1, 150_000, 1, ["awakening1"]),
  tactics: r("Tactics", "heroes", 3, -1, "cooldown", 0.02, 10, 25_000, 1.5, ["awakening1"]),
  rally: r("Rally", "heroes", 3, 1, "moveSpeed", 0.04, 10, 15_000, 1.45, ["awakening1"]),
  awakening2: r("Awakening II", "heroes", 4, 0, "skillSlot", 1, 1, 5_000_000, 1, ["command2"]),
  legend: r("Legend", "heroes", 5, 0, "attackPct", 0.05, 20, 2_000_000, 1.5, ["awakening2"]),

  wisdom: r("Wisdom", "wisdom", 1, 0, "xpFind", 0.05, 25, 60, 1.42, []),
  repose: r("Repose", "wisdom", 2, -1, "offlineHours", 2, 1, 100, 1, ["wisdom"]),
  study: r("Study", "wisdom", 2, 0, "xpFind", 0.06, 20, 5_000, 1.45, ["wisdom"]),
  cubeLore: r("Cube Lore", "wisdom", 2, 1, "cubeXp", 0.1, 10, 2_000, 1.5, ["wisdom"]),
  longRepose: r("Long Repose", "wisdom", 3, -1, "offlineHours", 1, 6, 3_000, 1.8, ["repose"]),
  scholar: r("Scholar", "wisdom", 3, 0, "xpFind", 0.08, 15, 250_000, 1.5, ["study"]),
  artisan: r("Artisan", "wisdom", 3, 1, "cubeXp", 0.15, 10, 80_000, 1.6, ["cubeLore"]),

  greed: r("Greed", "gold", 1, 0, "goldFind", 0.05, 25, 60, 1.42, []),
  alchemist: r("Alchemist", "gold", 2, -1, "alchemyGold", 0.1, 15, 800, 1.5, ["greed"]),
  prosperity: r("Prosperity", "gold", 2, 0, "goldFind", 0.06, 20, 5_000, 1.45, ["greed"]),
  midas: r("Midas", "gold", 3, 0, "goldFind", 0.08, 15, 250_000, 1.5, ["prosperity"]),
  transmuter: r("Transmuter", "gold", 3, -1, "alchemyGold", 0.15, 10, 60_000, 1.6, ["alchemist"]),
  hoarder: r("Hoarder", "gold", 4, 0, "goldFind", 0.1, 10, 8_000_000, 1.6, ["midas"]),

  expansion1: r("Expansion I", "storage", 1, 0, "inventory", 6, 4, 150, 1.8, []),
  mainspring1: r("Mainspring I", "storage", 2, -1, "autoOpenCommon", 1, 1, 1_200, 1, ["expansion1"]),
  vault1: r("Vault I", "storage", 2, 1, "stash", 1, 1, 5_000, 1, ["expansion1"]),
  expansion2: r("Expansion II", "storage", 2, 0, "inventory", 6, 4, 20_000, 1.8, ["expansion1"]),
  lubrication: r("Lubrication", "storage", 3, -1, "autoOpenSpeed", 1, 5, 5_000, 1.7, ["mainspring1"]),
  mainspring2: r("Mainspring II", "storage", 3, 0, "autoOpenBoss", 1, 1, 100_000, 1, ["mainspring1", "expansion2"]),
  vault2: r("Vault II", "storage", 3, 1, "stash", 1, 1, 250_000, 1, ["vault1"]),
  expansion3: r("Expansion III", "storage", 4, 1, "inventory", 6, 4, 1_000_000, 1.8, ["expansion2"]),
  mainspring3: r("Mainspring III", "storage", 4, 0, "autoOpenAct", 1, 1, 1_000_000, 1, ["mainspring2"]),
  vault3: r("Vault III", "storage", 5, 1, "stash", 1, 1, 50_000_000, 1, ["vault2", "expansion3"]),

  exploration: r("Exploration", "treasure", 1, 0, "commonChest", 0.2, 5, 500, 1.6, []),
  haste: r("Haste", "treasure", 2, -1, "chestInterval", 3_000, 8, 800, 1.6, ["exploration"]),
  treasureSense: r("Treasure Sense", "treasure", 2, 0, "bossChest", 0.1, 10, 1_500, 1.5, ["exploration"]),
  scavenger: r("Scavenger", "treasure", 2, 1, "materialDrop", 0.1, 10, 2_000, 1.5, ["exploration"]),
  soulseeker: r("Soulseeker", "treasure", 3, 1, "soulDrop", 0.15, 10, 40_000, 1.55, ["scavenger"]),
  bounty: r("Bounty", "treasure", 3, 0, "bossChest", 0.15, 10, 120_000, 1.55, ["treasureSense"]),
  brevity: r("Brevity", "treasure", 4, 0, "fewerWaves", 1, 2, 20_000_000, 6, ["bounty", "haste"]),

  might: r("Might", "combat", 1, 0, "attackPct", 0.1, 50, 40, 1.42, []),
  vigor: r("Vigor", "combat", 2, -1, "lifePct", 0.1, 50, 40, 1.42, ["might"]),
  precision: r("Precision", "combat", 2, 0, "critChance", 0.01, 15, 300, 1.6, ["might"]),
  swiftness: r("Swiftness", "combat", 2, 1, "attackSpeed", 0.02, 10, 1_000, 1.6, ["might"]),
  bulwark: r("Bulwark", "combat", 3, -1, "armorPct", 0.1, 40, 150, 1.45, ["vigor"]),
  ferocity: r("Ferocity", "combat", 3, 0, "critDamage", 0.1, 15, 500, 1.6, ["precision"]),
  evasion: r("Evasion", "combat", 3, 1, "dodge", 0.01, 10, 8_000, 1.6, ["swiftness"]),
  warding: r("Warding", "combat", 4, -1, "allRes", 0.02, 15, 20_000, 1.55, ["bulwark"]),
  vengeance: r("Vengeance", "combat", 4, 0, "bossDmg", 0.05, 15, 30_000, 1.55, ["ferocity"]),
  aegis: r("Aegis", "combat", 4, 1, "block", 0.01, 10, 30_000, 1.6, ["evasion"]),
  sanguine: r("Sanguine", "combat", 5, 0, "leech", 0.005, 6, 500_000, 1.8, ["vengeance"]),
  elementalist: r("Elementalist", "combat", 5, -1, "maxRes", 0.01, 5, 2_000_000, 2, ["warding"]),
};

export type RuneKey = keyof typeof DEFS;
export const RUNES = DEFS as Record<RuneKey, RuneDef>;
export const RUNE_KEYS = Object.keys(RUNES) as RuneKey[];

export function runeCost(key: RuneKey, owned: number): number {
  const rune = RUNES[key];
  return Math.round(rune.cost * Math.pow(rune.growth, owned));
}

export function runeSpent(key: RuneKey, owned: number): number {
  let total = 0;
  for (let i = 0; i < owned; i++) total += runeCost(key, i);
  return total;
}

export function runePosition(key: RuneKey): { x: number; y: number } {
  const rune = RUNES[key];
  const angle = (BRANCHES[rune.branch].angle * Math.PI) / 180;
  const radius = rune.depth * 1.15 + 0.35;
  const spread = rune.side * 0.85;
  return {
    x: Math.cos(angle) * radius - Math.sin(angle) * spread,
    y: -Math.sin(angle) * radius - Math.cos(angle) * spread,
  };
}
