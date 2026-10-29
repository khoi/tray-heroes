import { GRADES, MAX_GRADE, grade } from "./data/grades";
import { AFFIXES, AFFIX_POOL, BASES } from "./data/items";
import { pick, rand, weighted } from "./rng";
import { BASE_KEYS, type BaseKey, type ChestKind, type Item, type ItemId, type Save, type StatKey } from "./schema";
import { inventoryCap, modifiers } from "./stats";
import { CHEST_RULES, GEAR_BASE, GEAR_GROWTH, GOLD_GROWTH } from "./tuning";
import { fail, ok, type GameEvent, type Result } from "./types";

export function itemLevel(monsterLevel: number): number {
  return Math.max(1, Math.floor(monsterLevel / 5) * 5);
}

export function rollGrade(state: Save, chest: ChestKind): number {
  return weighted(
    state,
    GRADES.map((g, i) => [i, g.weights[chest]] as const),
  );
}

function rollAffix(state: Save, stat: StatKey, level: number, gradeIndex: number): number {
  const def = AFFIXES[stat];
  const roll = def.min + rand(state) * (def.max - def.min);
  if (!def.scales) return roll * (1 + 0.15 * gradeIndex);
  const unit = stat === "regen" ? GEAR_BASE.hp : GEAR_BASE[stat as "hp" | "atk" | "armor"];
  return roll * unit * Math.pow(GEAR_GROWTH, level - 1) * (1 + 0.15 * gradeIndex);
}

export function createItem(state: Save, level: number, gradeIndex: number, base: BaseKey = pick(state, BASE_KEYS)): Item {
  const g = Math.min(MAX_GRADE, gradeIndex);
  const pool = [...AFFIX_POOL[BASES[base].slot]];
  const affixes = [];
  for (let i = 0; i < grade(g).affixes && pool.length > 0; i++) {
    const at = Math.floor(rand(state) * pool.length);
    const [stat] = pool.splice(at, 1);
    if (stat) affixes.push({ stat, value: rollAffix(state, stat, level, g) });
  }
  const id = state.nextItemId++ as ItemId;
  const item: Item = { id, base, grade: g, level, affixes, locked: false };
  state.items[id] = item;
  return item;
}

export function alchemyValue(item: Item): number {
  return Math.round((grade(item.grade).alchemy * Math.pow(GOLD_GROWTH, item.level - 1)) / 2);
}

export function synthFee(gradeIndex: number, level: number): number {
  const synth = grade(gradeIndex).synth;
  return synth ? Math.round((synth.fee * Math.pow(GOLD_GROWTH, level - 1)) / 4) : 0;
}

export function itemName(item: Item): string {
  return `${grade(item.grade).name} ${BASES[item.base].name}`;
}

export function openChest(state: Save, events: GameEvent[], kind?: ChestKind): Result<Item[]> {
  const at = kind ? state.chests.findIndex((c) => c.kind === kind) : 0;
  const chest = state.chests[at];
  if (!chest) return fail("No chest to open");
  const count = CHEST_RULES[chest.kind].items;
  if (state.inventory.length + count > inventoryCap(modifiers(state))) return fail("Inventory is full");
  state.chests.splice(at, 1);
  const items = Array.from({ length: count }, () => createItem(state, itemLevel(chest.level), rollGrade(state, chest.kind)));
  state.inventory.push(...items.map((i) => i.id));
  events.push({ type: "opened", items: items.map((i) => i.id) });
  return ok(items);
}
