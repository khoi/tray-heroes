import { CLASSES } from "./data/classes";
import { grade } from "./data/grades";
import { BASES } from "./data/items";
import { PETS } from "./data/pets";
import { MOD_KEYS, RUNES, type ModKey } from "./data/runes";
import { CLASS_KEYS, RUNE_KEYS, type ClassKey, type Item, type Save } from "./schema";
import { BASE_INVENTORY, GEAR_BASE, GEAR_GROWTH, HERO_GROWTH } from "./tuning";

export type Modifiers = Record<ModKey, number>;

export function modifiers(state: Save): Modifiers {
  const mods = Object.fromEntries(MOD_KEYS.map((k) => [k, 0])) as Modifiers;
  for (const key of RUNE_KEYS) {
    const owned = state.runes[key] ?? 0;
    if (owned > 0) mods[RUNES[key].effect] += owned * RUNES[key].per;
  }
  for (const pet of PETS) {
    if ((state.kills[pet.hunt] ?? 0) >= pet.kills) mods[pet.bonus] += pet.amount;
  }
  return mods;
}

export function partySize(mods: Modifiers): number {
  return Math.min(CLASS_KEYS.length, 1 + mods.partySlot);
}

export function inventoryCap(mods: Modifiers): number {
  return BASE_INVENTORY + mods.inventory;
}

export function itemMain(item: Item): Partial<Record<"hp" | "atk" | "armor", number>> {
  const scale = Math.pow(GEAR_GROWTH, item.level - 1) * grade(item.grade).power;
  const out: Partial<Record<"hp" | "atk" | "armor", number>> = {};
  for (const [stat, weight] of Object.entries(BASES[item.base].main) as ["hp" | "atk" | "armor", number][]) {
    out[stat] = weight * GEAR_BASE[stat] * scale;
  }
  return out;
}

export interface HeroStats {
  maxHp: number;
  atk: number;
  armor: number;
  regen: number;
  interval: number;
  critChance: number;
  critDamage: number;
}

export function heroStats(state: Save, cls: ClassKey, mods: Modifiers): HeroStats {
  const def = CLASSES[cls];
  const hero = state.heroes[cls];
  const growth = Math.pow(HERO_GROWTH, hero.level - 1);
  const sum = { hp: def.base.hp * growth, atk: def.base.atk * growth, armor: def.base.armor * growth, regen: 0, hpPct: 0, atkPct: 0, atkSpeed: 0, critChance: 0, critDamage: 0 };
  for (const id of Object.values(hero.equipment)) {
    const item = state.items[id];
    if (!item) continue;
    for (const [stat, value] of Object.entries(itemMain(item)) as ["hp" | "atk" | "armor", number][]) sum[stat] += value;
    for (const affix of item.affixes) sum[affix.stat] += affix.value;
  }
  return {
    maxHp: sum.hp * (1 + sum.hpPct + mods.hpPct),
    atk: sum.atk * (1 + sum.atkPct + mods.atkPct),
    armor: sum.armor * (1 + mods.armorPct),
    regen: sum.regen,
    interval: 1 / (def.base.atkSpeed * (1 + sum.atkSpeed)),
    critChance: Math.min(1, def.base.critChance + sum.critChance + mods.critChance),
    critDamage: def.base.critDamage + sum.critDamage + mods.critDamage,
  };
}

export function dps(stats: HeroStats): number {
  return (stats.atk * (1 + stats.critChance * stats.critDamage)) / stats.interval;
}
