import type { RuneKey } from "../schema";

export const MOD_KEYS = [
  "atkPct",
  "hpPct",
  "armorPct",
  "critChance",
  "critDamage",
  "gold",
  "xp",
  "commonChest",
  "bossChest",
  "chestInterval",
  "inventory",
  "partySlot",
  "autoOpen",
  "offlineHours",
  "fewerWaves",
] as const;

export type ModKey = (typeof MOD_KEYS)[number];

export interface RuneDef {
  name: string;
  effect: ModKey;
  per: number;
  max: number;
  cost: number;
  growth: number;
  requires: RuneKey[];
  x: number;
  y: number;
}

export const RUNES: Record<RuneKey, RuneDef> = {
  might: { name: "Might", effect: "atkPct", per: 0.1, max: 50, cost: 40, growth: 1.42, requires: [], x: 0, y: -1 },
  vigor: { name: "Vigor", effect: "hpPct", per: 0.1, max: 50, cost: 40, growth: 1.42, requires: [], x: -1, y: 0 },
  greed: { name: "Greed", effect: "gold", per: 0.1, max: 50, cost: 60, growth: 1.42, requires: [], x: 1, y: 0 },
  wisdom: { name: "Wisdom", effect: "xp", per: 0.1, max: 50, cost: 60, growth: 1.42, requires: [], x: 0, y: 1 },
  precision: { name: "Precision", effect: "critChance", per: 0.01, max: 15, cost: 300, growth: 1.6, requires: ["might"], x: 0.7, y: -2 },
  ferocity: { name: "Ferocity", effect: "critDamage", per: 0.1, max: 15, cost: 500, growth: 1.6, requires: ["precision"], x: 1.4, y: -3 },
  fellowship1: { name: "Fellowship", effect: "partySlot", per: 1, max: 1, cost: 250, growth: 1, requires: ["might"], x: -0.7, y: -2 },
  fellowship2: { name: "Fellowship II", effect: "partySlot", per: 1, max: 1, cost: 12_000, growth: 1, requires: ["fellowship1"], x: -1.4, y: -3 },
  bulwark: { name: "Bulwark", effect: "armorPct", per: 0.1, max: 40, cost: 150, growth: 1.45, requires: ["vigor"], x: -2, y: 0.7 },
  repose: { name: "Repose", effect: "offlineHours", per: 2, max: 1, cost: 100, growth: 1, requires: ["vigor"], x: -2, y: -0.7 },
  longRepose: { name: "Long Repose", effect: "offlineHours", per: 1, max: 6, cost: 3_000, growth: 1.8, requires: ["repose"], x: -3, y: -1.4 },
  fortune: { name: "Fortune", effect: "commonChest", per: 0.15, max: 10, cost: 200, growth: 1.5, requires: ["greed"], x: 2, y: -0.7 },
  treasure: { name: "Treasure Sense", effect: "bossChest", per: 0.1, max: 10, cost: 1_500, growth: 1.5, requires: ["fortune"], x: 3, y: -1.4 },
  haste: { name: "Haste", effect: "chestInterval", per: 3_000, max: 8, cost: 800, growth: 1.6, requires: ["greed"], x: 2, y: 0.7 },
  mainspring: { name: "Mainspring", effect: "autoOpen", per: 1, max: 1, cost: 1_200, growth: 1, requires: ["haste"], x: 3, y: 1.4 },
  satchel: { name: "Satchel", effect: "inventory", per: 6, max: 8, cost: 150, growth: 1.7, requires: ["wisdom"], x: 0.7, y: 2 },
  brevity: { name: "Brevity", effect: "fewerWaves", per: 1, max: 2, cost: 250_000, growth: 6, requires: ["satchel"], x: 1.4, y: 3 },
};

export function runeCost(key: RuneKey, owned: number): number {
  const r = RUNES[key];
  return Math.round(r.cost * Math.pow(r.growth, owned));
}
