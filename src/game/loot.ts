import { GRADES, MAX_GRADE, UNIQUE_MIN_GRADE, grade } from "./data/grades";
import { AFFIXES, AFFIX_POOL, BASES, BASE_KEYS, UNIQUES, UNIQUE_KEYS, type BaseKey } from "./data/items";
import { GEMS, gemKey, type GemKind, type MaterialKey, type PartKey } from "./data/materials";
import { RELIC_COLORS, RELIC_POOL, RELIC_ROLL, type RelicColor } from "./data/relics";
import type { StatKey } from "./data/stats";
import { pick, rand, weighted } from "./rng";
import type { Affix, Chest, ChestKind, Item, ItemId, Relic, RelicId, Save } from "./schema";
import { inventoryCap, modifiers } from "./stats";
import { CHEST_RULES, GEAR_BASE, GEAR_GROWTH, GOLD_GROWTH } from "./tuning";
import { fail, ok, type GameEvent, type Result } from "./types";

export function itemLevel(monsterLevel: number): number {
  return Math.max(1, Math.floor(monsterLevel / 5) * 5);
}

export function rollGrade(state: Save, chest: ChestKind, cap: number): number {
  return weighted(
    state,
    GRADES.map((g, i) => [i, i <= cap ? g.weights[chest] : 0] as const),
  );
}

export function rollAffix(state: Save, stat: StatKey, level: number, gradeIndex: number, power = 1): Affix {
  const def = AFFIXES[stat] ?? { min: 0.02, max: 0.05 };
  const roll = (def.min + rand(state) * (def.max - def.min)) * power * (1 + 0.15 * gradeIndex);
  const value = def.unit ? roll * GEAR_BASE[def.unit] * Math.pow(GEAR_GROWTH, level - 1) : roll;
  return { stat, value };
}

function rollAffixes(state: Save, base: BaseKey, level: number, g: number): Affix[] {
  const pool = [...AFFIX_POOL[BASES[base].slot]];
  const out: Affix[] = [];
  for (let i = 0; i < grade(g).affixes && pool.length > 0; i++) {
    const [stat] = pool.splice(Math.floor(rand(state) * pool.length), 1);
    if (stat) out.push(rollAffix(state, stat, level, g));
  }
  return out;
}

export function createItem(state: Save, level: number, gradeIndex: number, base: BaseKey = pick(state, BASE_KEYS)): Item {
  const g = Math.min(MAX_GRADE, Math.max(0, gradeIndex));
  const uniques = UNIQUE_KEYS.filter((k) => UNIQUES[k].base === base);
  const unique = g >= UNIQUE_MIN_GRADE && uniques.length > 0 && rand(state) < 0.25 ? pick(state, uniques) : null;
  const [deco, engr, insc] = grade(g).sockets;
  const id = state.nextItemId++ as ItemId;
  const item: Item = {
    id,
    base,
    grade: g,
    level,
    affixes: rollAffixes(state, base, level, g),
    unique,
    sockets: { decoration: Array(deco).fill(null), engraving: Array(engr).fill(null), inscription: Array(insc).fill(null) },
    locked: false,
  };
  state.items[id] = item;
  return item;
}

export function rerollAffixes(state: Save, item: Item): void {
  item.affixes = rollAffixes(state, item.base, item.level, item.grade);
}

export function createRelic(state: Save, gradeIndex: number, color: RelicColor = pick(state, RELIC_COLORS)): Relic {
  const id = state.nextItemId++ as RelicId;
  const relic: Relic = { id, color, grade: gradeIndex, stats: rollRelicStats(state, color, gradeIndex), attunements: 0 };
  state.relics[id] = relic;
  return relic;
}

export function rollRelicStats(state: Save, color: RelicColor, gradeIndex: number): Affix[] {
  const pool = [...RELIC_POOL[color]];
  const count = Math.min(3, 1 + Math.floor(gradeIndex / 3));
  const out: Affix[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const [stat] = pool.splice(Math.floor(rand(state) * pool.length), 1);
    if (!stat) continue;
    const [min, max] = RELIC_ROLL[stat] ?? [0.02, 0.05];
    out.push({ stat, value: (min + rand(state) * (max - min)) * (1 + 0.2 * gradeIndex) });
  }
  return out;
}

export function alchemyValue(item: Item): number {
  return Math.round((grade(item.grade).alchemy * Math.pow(GOLD_GROWTH, item.level - 1)) / 2);
}

export function synthFee(gradeIndex: number, level: number): number {
  const synth = grade(gradeIndex).synth;
  return synth ? Math.round((synth.fee * Math.pow(GOLD_GROWTH, level - 1)) / 4) : 0;
}

export function itemName(item: Item): string {
  return item.unique ? UNIQUES[item.unique].name : `${grade(item.grade).name} ${BASES[item.base].name}`;
}

export function addMaterial(state: Save, key: MaterialKey, amount: number, events?: GameEvent[]): void {
  state.materials[key] = (state.materials[key] ?? 0) + amount;
  events?.push({ type: "material", key, amount });
}

export function takeMaterial(state: Save, key: MaterialKey, amount = 1): boolean {
  const have = state.materials[key] ?? 0;
  if (have < amount) return false;
  state.materials[key] = have - amount;
  return true;
}

function chestMaterials(state: Save, chest: Chest, events: GameEvent[]): void {
  const mods = modifiers(state);
  const find = 1 + mods.materialDrop;
  const gemTier = 1 + Math.min(2, Math.floor(chest.level / 35) + (chest.kind === "act" ? 1 : 0));
  const gemChance = { common: 0.3, boss: 0.6, act: 1 }[chest.kind] * find;
  if (rand(state) < gemChance) addMaterial(state, gemKey(pick(state, Object.keys(GEMS) as GemKind[]), gemTier), 1, events);
  const scrollChance = { common: 0.05, boss: 0.25, act: 0.5 }[chest.kind] * find;
  if (rand(state) < scrollChance) addMaterial(state, `scroll${Math.min(3, gemTier)}` as MaterialKey, 1, events);
  const soulChance = { common: 0.02, boss: 0.2, act: 0.35 }[chest.kind] * (1 + mods.soulDrop);
  if (rand(state) < soulChance) {
    const soul = chest.plague || chest.difficulty >= 4 ? "soulPlague" : (`soul${chest.difficulty}` as MaterialKey);
    if (!chest.plague || chest.kind !== "common") addMaterial(state, soul, 1, events);
  }
  if (chest.plague && chest.kind !== "common" && rand(state) < (chest.kind === "act" ? 1 : 0.15)) createRelic(state, rollGrade(state, chest.kind, chest.cap));
  addMaterial(state, "dust", chest.kind === "common" ? 1 : chest.kind === "boss" ? 3 : 8);
}

export function openChest(state: Save, events: GameEvent[], kind?: ChestKind): Result<Item[]> {
  const at = kind ? state.chests.findIndex((c) => c.kind === kind) : 0;
  const chest = state.chests[at];
  if (!chest) return fail("No chest to open");
  const count = CHEST_RULES[chest.kind].items;
  if (state.inventory.length + count > inventoryCap(modifiers(state))) return fail("Inventory is full");
  state.chests.splice(at, 1);
  const level = chest.plague ? Math.max(itemLevel(chest.level), 90) : itemLevel(chest.level);
  const items = Array.from({ length: count }, () => createItem(state, Math.min(100, level), rollGrade(state, chest.kind, chest.cap)));
  state.inventory.push(...items.map((i) => i.id));
  chestMaterials(state, chest, events);
  events.push({ type: "opened", items: items.map((i) => i.id) });
  return ok(items);
}

export function dropPart(state: Save, part: PartKey, events: GameEvent[]): void {
  addMaterial(state, part, 1, events);
}
