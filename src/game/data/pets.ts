import type { SpriteRef } from "../types";
import type { ModKey } from "./runes";
import type { MonsterKey } from "./world";

export interface PetDef {
  name: string;
  hunt: MonsterKey;
  kills: number;
  bonus: ModKey;
  amount: number;
  sprite: SpriteRef;
}

const c = (index: number): SpriteRef => ({ sheet: "creatures", index });

export const PETS: readonly PetDef[] = [
  { name: "Bat", hunt: "bat", kills: 400, bonus: "xpFind", amount: 0.15, sprite: { sheet: "dungeon", index: 120 } },
  { name: "Blobby", hunt: "mushroom", kills: 400, bonus: "commonChest", amount: 0.15, sprite: c(56) },
  { name: "Tusk", hunt: "troll", kills: 40, bonus: "attackPct", amount: 0.1, sprite: c(14) },
  { name: "Pebble", hunt: "scorpion", kills: 500, bonus: "goldFind", amount: 0.15, sprite: c(57) },
  { name: "Wisp", hunt: "reaper", kills: 60, bonus: "bossChest", amount: 0.15, sprite: c(89) },
  { name: "Grub", hunt: "mummy", kills: 500, bonus: "lifePct", amount: 0.1, sprite: c(141) },
  { name: "Frostbite", hunt: "yeti", kills: 500, bonus: "coldRes", amount: 0.15, sprite: c(49) },
  { name: "Sparky", hunt: "skull", kills: 500, bonus: "critDamage", amount: 0.15, sprite: c(59) },
  { name: "Ember", hunt: "imp", kills: 500, bonus: "fireRes", amount: 0.15, sprite: c(55) },
  { name: "Cinder", hunt: "dragon", kills: 40, bonus: "bossDmg", amount: 0.15, sprite: c(35) },
];
