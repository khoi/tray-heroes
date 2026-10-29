import type { BaseKey, ClassKey, Slot, StatKey } from "../schema";
import type { SpriteRef } from "../types";

export interface BaseDef {
  name: string;
  slot: Slot;
  cls: ClassKey | null;
  main: Partial<Record<"hp" | "atk" | "armor", number>>;
  sprites: SpriteRef[];
}

export const BASES: Record<BaseKey, BaseDef> = {
  sword: {
    name: "Sword",
    slot: "weapon",
    cls: "knight",
    main: { atk: 1 },
    sprites: [
      { sheet: "dungeon", index: 104 },
      { sheet: "dungeon", index: 104 },
      { sheet: "dungeon", index: 106 },
      { sheet: "dungeon", index: 106 },
      { sheet: "dungeon", index: 107 },
    ],
  },
  bow: { name: "Bow", slot: "weapon", cls: "ranger", main: { atk: 1 }, sprites: [{ sheet: "town", index: 118 }] },
  staff: {
    name: "Staff",
    slot: "weapon",
    cls: "mage",
    main: { atk: 1.15 },
    sprites: [
      { sheet: "dungeon", index: 129 },
      { sheet: "dungeon", index: 129 },
      { sheet: "dungeon", index: 129 },
      { sheet: "dungeon", index: 130 },
    ],
  },
  helmet: { name: "Helm", slot: "helmet", cls: null, main: { hp: 0.6, armor: 0.5 }, sprites: [{ sheet: "custom", name: "helmet" }] },
  armor: { name: "Cuirass", slot: "armor", cls: null, main: { hp: 1, armor: 1 }, sprites: [{ sheet: "custom", name: "armor" }] },
  boots: { name: "Boots", slot: "boots", cls: null, main: { hp: 0.4, armor: 0.4 }, sprites: [{ sheet: "custom", name: "boots" }] },
  ring: { name: "Ring", slot: "ring", cls: null, main: { atk: 0.35 }, sprites: [{ sheet: "dungeon", index: 101 }] },
  amulet: { name: "Amulet", slot: "amulet", cls: null, main: { hp: 0.5, atk: 0.15 }, sprites: [{ sheet: "custom", name: "amulet" }] },
};

export interface AffixDef {
  label: string;
  min: number;
  max: number;
  scales: boolean;
  percent: boolean;
}

export const AFFIXES: Record<StatKey, AffixDef> = {
  hp: { label: "Life", min: 0.3, max: 0.6, scales: true, percent: false },
  atk: { label: "Attack", min: 0.15, max: 0.3, scales: true, percent: false },
  armor: { label: "Armor", min: 0.3, max: 0.6, scales: true, percent: false },
  regen: { label: "Life regen /s", min: 0.01, max: 0.025, scales: true, percent: false },
  hpPct: { label: "Life", min: 0.04, max: 0.1, scales: false, percent: true },
  atkPct: { label: "Attack", min: 0.04, max: 0.1, scales: false, percent: true },
  atkSpeed: { label: "Attack speed", min: 0.03, max: 0.08, scales: false, percent: true },
  critChance: { label: "Crit chance", min: 0.02, max: 0.05, scales: false, percent: true },
  critDamage: { label: "Crit damage", min: 0.08, max: 0.2, scales: false, percent: true },
};

export const AFFIX_POOL: Record<Slot, StatKey[]> = {
  weapon: ["atk", "atkPct", "atkSpeed", "critChance", "critDamage"],
  helmet: ["hp", "armor", "hpPct", "regen", "critChance"],
  armor: ["hp", "armor", "hpPct", "regen"],
  boots: ["hp", "armor", "atkSpeed", "regen"],
  ring: ["atk", "atkPct", "critChance", "critDamage", "atkSpeed"],
  amulet: ["hp", "atk", "hpPct", "atkPct", "critDamage", "regen"],
};
