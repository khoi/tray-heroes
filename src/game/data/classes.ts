import type { BaseKey, ClassKey } from "../schema";
import type { SpriteRef } from "../types";

export interface ClassDef {
  name: string;
  role: string;
  sprite: SpriteRef;
  weapon: BaseKey;
  base: { hp: number; atk: number; armor: number; atkSpeed: number; critChance: number; critDamage: number };
  splash: number;
  skill: { name: string; every: number; mult: number; aoe: boolean };
}

export const CLASSES: Record<ClassKey, ClassDef> = {
  knight: {
    name: "Knight",
    role: "Holds the front line",
    sprite: { sheet: "dungeon", index: 97 },
    weapon: "sword",
    base: { hp: 130, atk: 8, armor: 14, atkSpeed: 0.9, critChance: 0.05, critDamage: 0.5 },
    splash: 0,
    skill: { name: "Shield Bash", every: 5, mult: 3, aoe: false },
  },
  ranger: {
    name: "Ranger",
    role: "Fast shots, frequent crits",
    sprite: { sheet: "dungeon", index: 112 },
    weapon: "bow",
    base: { hp: 75, atk: 9, armor: 5, atkSpeed: 1.3, critChance: 0.15, critDamage: 0.8 },
    splash: 0,
    skill: { name: "Volley", every: 4, mult: 1.3, aoe: true },
  },
  mage: {
    name: "Mage",
    role: "Splash damage to the whole wave",
    sprite: { sheet: "dungeon", index: 84 },
    weapon: "staff",
    base: { hp: 65, atk: 14, armor: 3, atkSpeed: 0.7, critChance: 0.06, critDamage: 0.6 },
    splash: 0.35,
    skill: { name: "Meteor", every: 6, mult: 3, aoe: true },
  },
};
