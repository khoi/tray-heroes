import type { ModKey } from "./runes";
import type { MonsterKey } from "./world";

export interface PetDef {
  name: string;
  hunt: MonsterKey;
  kills: number;
  bonus: ModKey;
  amount: number;
}

export const PETS: readonly PetDef[] = [
  { name: "Corvo", hunt: "bat", kills: 400, bonus: "xpFind", amount: 0.15 },
  { name: "Blobby", hunt: "mushroom", kills: 400, bonus: "commonChest", amount: 0.15 },
  { name: "Cubby", hunt: "troll", kills: 40, bonus: "attackPct", amount: 0.1 },
  { name: "Hoot", hunt: "scorpion", kills: 500, bonus: "goldFind", amount: 0.15 },
  { name: "Wisp", hunt: "reaper", kills: 60, bonus: "bossChest", amount: 0.15 },
  { name: "Grub", hunt: "mummy", kills: 500, bonus: "lifePct", amount: 0.1 },
  { name: "Frostbite", hunt: "yeti", kills: 500, bonus: "coldRes", amount: 0.15 },
  { name: "Sparky", hunt: "skull", kills: 500, bonus: "critDamage", amount: 0.15 },
  { name: "Ember", hunt: "imp", kills: 500, bonus: "fireRes", amount: 0.15 },
  { name: "Cinder", hunt: "dragon", kills: 40, bonus: "bossDmg", amount: 0.15 },
];
