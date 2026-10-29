import type { StatKey } from "./stats";

export const RELIC_COLORS = ["red", "green", "blue"] as const;
export type RelicColor = (typeof RELIC_COLORS)[number];

export const RELIC_POOL: Record<RelicColor, StatKey[]> = {
  red: ["attackPct", "critDamage", "bossDmg", "attackSpeed"],
  green: ["lifePct", "reduction", "regenPct", "allRes"],
  blue: ["goldFind", "xpFind", "cooldown", "critChance"],
};

export const RELIC_ROLL: Partial<Record<StatKey, [number, number]>> = {
  attackPct: [0.04, 0.1],
  critDamage: [0.08, 0.2],
  bossDmg: [0.05, 0.12],
  attackSpeed: [0.02, 0.05],
  lifePct: [0.04, 0.1],
  reduction: [0.01, 0.03],
  regenPct: [0.002, 0.005],
  allRes: [0.03, 0.06],
  goldFind: [0.05, 0.12],
  xpFind: [0.04, 0.1],
  cooldown: [0.02, 0.04],
  critChance: [0.01, 0.03],
};

export const RELIQUARIES: readonly { name: string; slots: readonly RelicColor[]; unlockIntensity: number }[] = [
  { name: "Ember Reliquary", slots: ["red", "green", "blue"], unlockIntensity: 1 },
  { name: "Verdant Reliquary", slots: ["green", "green", "red"], unlockIntensity: 5 },
  { name: "Astral Reliquary", slots: ["blue", "red", "blue"], unlockIntensity: 10 },
];

export const MATCH_BONUS = 1.5;
export const ATTUNE_BASE = 5_000;
export const ATTUNE_GROWTH = 1.6;
