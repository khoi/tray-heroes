import type { MonsterKey } from "../schema";
import type { ModKey } from "./runes";
import type { SpriteRef } from "../types";

export type PetBonus = Extract<ModKey, "xp" | "gold" | "commonChest" | "bossChest" | "hpPct" | "atkPct">;

export interface PetDef {
  name: string;
  hunt: MonsterKey;
  kills: number;
  bonus: PetBonus;
  amount: number;
  sprite: SpriteRef;
}

export const PETS: readonly PetDef[] = [
  { name: "Bat", hunt: "bat", kills: 400, bonus: "xp", amount: 0.15, sprite: { sheet: "dungeon", index: 120 } },
  { name: "Blobby", hunt: "mushroom", kills: 400, bonus: "commonChest", amount: 0.15, sprite: { sheet: "creatures", index: 56 } },
  { name: "Pebble", hunt: "scorpion", kills: 500, bonus: "gold", amount: 0.15, sprite: { sheet: "creatures", index: 57 } },
  { name: "Wisp", hunt: "reaper", kills: 60, bonus: "bossChest", amount: 0.15, sprite: { sheet: "creatures", index: 89 } },
  { name: "Frostbite", hunt: "yeti", kills: 500, bonus: "hpPct", amount: 0.15, sprite: { sheet: "creatures", index: 49 } },
  { name: "Ember", hunt: "imp", kills: 500, bonus: "atkPct", amount: 0.15, sprite: { sheet: "creatures", index: 55 } },
];
