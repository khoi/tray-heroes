import { CLASSES } from "./data/classes";
import { grade } from "./data/grades";
import { BASES, UNIQUES, type UniqueFlag } from "./data/items";
import { material } from "./data/materials";
import { PETS } from "./data/pets";
import { MATCH_BONUS, RELIQUARIES } from "./data/relics";
import { RUNE_KEYS, RUNES, UTILITY_KEYS, type ModKey } from "./data/runes";
import { SKILLS } from "./data/skills";
import { DAMAGE_TYPES, DMG_KEY, RES_KEY, STAT_KEYS, addStats, type DamageType, type StatBlock } from "./data/stats";
import type { ClassKey, Item, Save } from "./schema";
import { BASE_INVENTORY, GEAR_BASE, GEAR_GROWTH, HERO_GROWTH, STASH_PAGE } from "./tuning";

export type Modifiers = Record<ModKey, number>;

const modsCache = new WeakMap<Save, { key: string; mods: Modifiers }>();
const modsKeys = new WeakMap<Modifiers, string>();

export function modifiers(state: Save): Modifiers {
  const pets = PETS.map((pet) => ((state.kills[pet.hunt] ?? 0) >= pet.kills ? 1 : 0)).join("");
  const key = `${JSON.stringify(state.runes)}|${pets}|${JSON.stringify(state.reliquary)}|${state.plague.best}`;
  const hit = modsCache.get(state);
  if (hit && hit.key === key) return hit.mods;
  const mods = computeModifiers(state);
  modsCache.set(state, { key, mods });
  modsKeys.set(mods, key);
  return mods;
}

function computeModifiers(state: Save): Modifiers {
  const mods = Object.fromEntries([...STAT_KEYS, ...UTILITY_KEYS].map((k) => [k, 0])) as Modifiers;
  for (const key of RUNE_KEYS) {
    const owned = state.runes[key] ?? 0;
    if (owned > 0) mods[RUNES[key].effect] += owned * RUNES[key].per;
  }
  for (const pet of PETS) {
    if ((state.kills[pet.hunt] ?? 0) >= pet.kills) mods[pet.bonus] += pet.amount;
  }
  state.reliquary.forEach((slots, r) => {
    const def = RELIQUARIES[r];
    if (!def || state.plague.best < def.unlockIntensity) return;
    slots.forEach((id, s) => {
      const relic = id === null ? undefined : state.relics[id];
      if (!relic) return;
      const scale = def.slots[s] === relic.color ? MATCH_BONUS : 1;
      for (const affix of relic.stats) mods[affix.stat] += affix.value * scale;
    });
  });
  return mods;
}

export const partySize = (mods: Modifiers) => Math.min(3, 1 + mods.partySlot);
export const skillSlots = (mods: Modifiers) => 1 + mods.skillSlot;
export const inventoryCap = (mods: Modifiers) => BASE_INVENTORY + mods.inventory;
export const stashCap = (mods: Modifiers) => STASH_PAGE * (1 + mods.stash);

export function itemMain(item: Item): Partial<Record<"life" | "attack" | "armor", number>> {
  const scale = Math.pow(GEAR_GROWTH, item.level - 1) * grade(item.grade).power;
  const out: Partial<Record<"life" | "attack" | "armor", number>> = {};
  for (const [stat, weight] of Object.entries(BASES[item.base].main) as ["life" | "attack" | "armor", number][]) {
    out[stat] = weight * GEAR_BASE[stat] * scale;
  }
  return out;
}

const itemCache = new WeakMap<Item, { key: string; stats: StatBlock }>();

export function itemStats(item: Item): StatBlock {
  const key = `${item.grade}|${item.level}|${item.unique}|${JSON.stringify(item.affixes)}|${JSON.stringify(item.sockets)}`;
  const hit = itemCache.get(item);
  if (hit && hit.key === key) return hit.stats;
  const stats = computeItemStats(item);
  itemCache.set(item, { key, stats });
  return stats;
}

function computeItemStats(item: Item): StatBlock {
  const out: StatBlock = { ...itemMain(item) };
  addStats(out, BASES[item.base].implicit, 1 + 0.1 * item.grade);
  for (const affix of item.affixes) addStats(out, { [affix.stat]: affix.value });
  if (item.unique) addStats(out, UNIQUES[item.unique].stats);
  for (const gem of item.sockets.decoration) {
    if (!gem) continue;
    const info = material(gem);
    if (info.kind === "gem") addStats(out, { [info.stat]: info.value });
  }
  for (const part of item.sockets.engraving) {
    if (!part) continue;
    const info = material(part);
    if (info.kind === "part") addStats(out, info.stats);
  }
  for (const affix of item.sockets.inscription) if (affix) addStats(out, { [affix.stat]: affix.value });
  return out;
}

export function heroTotals(state: Save, cls: ClassKey, mods: Modifiers, extra: StatBlock = {}): { stats: StatBlock; flags: Set<UniqueFlag> } {
  const def = CLASSES[cls];
  const hero = state.heroes[cls];
  const growth = Math.pow(HERO_GROWTH, hero.level - 1);
  const { life, attack, armor, attackSpeed: _speed, ...rest } = def.base;
  const stats: StatBlock = { ...rest, life: life * growth, attack: attack * growth, armor: armor * growth };
  const flags = new Set<UniqueFlag>();
  for (const id of Object.values(hero.equipment)) {
    const item = state.items[id];
    if (!item) continue;
    addStats(stats, itemStats(item));
    const flag = item.unique ? (UNIQUES[item.unique] as { flag?: UniqueFlag }).flag : undefined;
    if (flag) flags.add(flag);
  }
  for (const [key, level] of Object.entries(hero.skills) as [keyof typeof SKILLS, number][]) {
    const skill = SKILLS[key];
    if (skill.kind === "passive") addStats(stats, skill.stats, level);
  }
  for (const key of STAT_KEYS) if (mods[key]) addStats(stats, { [key]: mods[key] });
  addStats(stats, extra);
  return { stats, flags };
}

export interface HeroStats {
  maxLife: number;
  attack: number;
  interval: number;
  critChance: number;
  critMult: number;
  armor: number;
  armorCap: number;
  block: number;
  dodge: number;
  reduction: number;
  absorb: number;
  leech: number;
  regenPct: number;
  maxRes: number;
  res: Record<Exclude<DamageType, "physical">, number>;
  dmg: Record<DamageType, number>;
  area: number;
  cooldown: number;
  healPower: number;
  statusChance: number;
  moveSpeed: number;
  bossDmg: number;
  goldFind: number;
  xpFind: number;
  flags: Set<UniqueFlag>;
}

const heroCache = new WeakMap<Save, Map<string, HeroStats>>();

function itemSig(item: Item | undefined): string {
  if (!item) return "-";
  const s = item.sockets;
  return `${item.id}:${item.grade}:${item.level}:${item.unique}:${item.affixes.map((a) => a.value).join("/")}:${s.decoration.join("/")}:${s.engraving.join("/")}:${s.inscription.map((a) => a?.value ?? "").join("/")}`;
}

export function heroStats(state: Save, cls: ClassKey, mods: Modifiers, extra: StatBlock = {}, penalty = 0): HeroStats {
  const hero = state.heroes[cls];
  const modsKey = modsKeys.get(mods);
  const key =
    modsKey === undefined
      ? null
      : `${cls}|${penalty}|${hero.level}|${Object.values(hero.equipment).map((id) => itemSig(state.items[id])).join(",")}|${JSON.stringify(hero.skills)}|${JSON.stringify(extra)}|${modsKey}`;
  let cache = heroCache.get(state);
  if (!cache) heroCache.set(state, (cache = new Map()));
  const hit = key === null ? undefined : cache.get(key);
  if (hit) return hit;
  const stats = computeHeroStats(state, cls, mods, extra, penalty);
  if (key !== null) {
    if (cache.size > 256) cache.clear();
    cache.set(key, stats);
  }
  return stats;
}

function computeHeroStats(state: Save, cls: ClassKey, mods: Modifiers, extra: StatBlock, penalty: number): HeroStats {
  const { stats: s, flags } = heroTotals(state, cls, mods, extra);
  const v = (k: keyof StatBlock) => s[k] ?? 0;
  const maxRes = 0.75 + v("maxRes");
  const res = Object.fromEntries(
    (Object.entries(RES_KEY) as [Exclude<DamageType, "physical">, keyof StatBlock][]).map(([type, key]) => [type, Math.min(maxRes, v(key) + v("allRes") - penalty)]),
  ) as HeroStats["res"];
  const dmg = Object.fromEntries(DAMAGE_TYPES.map((t) => [t, 1 + v(DMG_KEY[t])])) as HeroStats["dmg"];
  return {
    maxLife: v("life") * (1 + v("lifePct")),
    attack: v("attack") * (1 + v("attackPct")),
    interval: 1 / (CLASSES[cls].base.attackSpeed * (1 + v("attackSpeed"))),
    critChance: Math.min(1, v("critChance")),
    critMult: 1 + v("critDamage"),
    armor: v("armor") * (1 + v("armorPct")),
    armorCap: CLASSES[cls].armorCap,
    block: Math.min(0.75, v("block")),
    dodge: Math.min(0.75, v("dodge")),
    reduction: Math.min(0.75, v("reduction")),
    absorb: v("absorb"),
    leech: v("leech"),
    regenPct: v("regenPct"),
    maxRes,
    res,
    dmg,
    area: v("area"),
    cooldown: Math.min(0.5, v("cooldown")),
    healPower: v("healPower"),
    statusChance: v("statusChance"),
    moveSpeed: v("moveSpeed"),
    bossDmg: v("bossDmg"),
    goldFind: v("goldFind"),
    xpFind: v("xpFind"),
    flags,
  };
}

export function dps(stats: HeroStats, cls: ClassKey): number {
  return (stats.attack * stats.dmg[CLASSES[cls].damage] * (1 + stats.critChance * (stats.critMult - 1))) / stats.interval;
}

export function power(stats: HeroStats, cls: ClassKey): number {
  const ehp = stats.maxLife / Math.max(0.1, (1 - stats.reduction) * (1 - stats.dodge) * (1 - stats.block * 0.5));
  return Math.sqrt(dps(stats, cls) * ehp);
}
