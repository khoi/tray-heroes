import { CLASSES } from "./data/classes";
import { MAX_GRADE, grade } from "./data/grades";
import { BASES } from "./data/items";
import { RUNES, runeCost } from "./data/runes";
import { startStage } from "./combat";
import { alchemyValue, createItem, itemLevel, synthFee } from "./loot";
import { rand } from "./rng";
import { CLASS_KEYS, type ClassKey, type Item, type ItemId, type RuneKey, type Slot } from "./schema";
import { inventoryCap, modifiers, partySize } from "./stats";
import { fail, ok, type GameState, type Result } from "./types";

function takeFromInventory(state: GameState, ids: readonly ItemId[]): Result<Item[]> {
  if (new Set(ids).size !== ids.length) return fail("Duplicate items");
  const items: Item[] = [];
  for (const id of ids) {
    const item = state.items[id];
    if (!item || !state.inventory.includes(id)) return fail("Item is not in the inventory");
    if (item.locked) return fail("Item is locked");
    items.push(item);
  }
  return ok(items);
}

function destroy(state: GameState, ids: readonly ItemId[]): void {
  const gone = new Set<number>(ids);
  state.inventory = state.inventory.filter((id) => !gone.has(id));
  for (const id of ids) delete state.items[id];
}

export function equip(state: GameState, cls: ClassKey, id: ItemId): Result {
  const item = state.items[id];
  const at = state.inventory.indexOf(id);
  if (!item || at < 0) return fail("Item is not in the inventory");
  const base = BASES[item.base];
  if (base.cls && base.cls !== cls) return fail(`Only a ${CLASSES[base.cls].name} can use this`);
  const hero = state.heroes[cls];
  if (hero.level < item.level) return fail(`Requires level ${item.level}`);
  const previous = hero.equipment[base.slot];
  hero.equipment[base.slot] = id;
  state.inventory.splice(at, 1, ...(previous === undefined ? [] : [previous]));
  return ok(undefined);
}

export function unequip(state: GameState, cls: ClassKey, slot: Slot): Result {
  const id = state.heroes[cls].equipment[slot];
  if (id === undefined) return fail("Nothing equipped");
  if (state.inventory.length >= inventoryCap(modifiers(state))) return fail("Inventory is full");
  delete state.heroes[cls].equipment[slot];
  state.inventory.push(id);
  return ok(undefined);
}

export function toggleLock(state: GameState, id: ItemId): Result {
  const item = state.items[id];
  if (!item) return fail("Unknown item");
  item.locked = !item.locked;
  return ok(undefined);
}

export function alchemize(state: GameState, ids: readonly ItemId[]): Result<number> {
  if (ids.length === 0) return fail("Nothing selected");
  const taken = takeFromInventory(state, ids);
  if (!taken.ok) return taken;
  const gold = taken.value.reduce((sum, item) => sum + alchemyValue(item), 0);
  destroy(state, ids);
  state.gold += gold;
  return ok(gold);
}

export const SYNTH_INPUTS = 9;

export type SynthOutcome = "upgrade" | "jackpot" | "stay";

export function synthesize(state: GameState, ids: readonly ItemId[]): Result<{ item: Item; outcome: SynthOutcome }> {
  if (ids.length !== SYNTH_INPUTS) return fail(`Needs exactly ${SYNTH_INPUTS} items`);
  const taken = takeFromInventory(state, ids);
  if (!taken.ok) return taken;
  const g = taken.value[0]!.grade;
  if (taken.value.some((item) => item.grade !== g)) return fail("All items must share a grade");
  const synth = grade(g).synth;
  if (!synth) return fail(`${grade(g).name} is the highest grade`);
  const level = itemLevel(taken.value.reduce((sum, item) => sum + item.level, 0) / SYNTH_INPUTS);
  const fee = synthFee(g, level);
  if (state.gold < fee) return fail(`Needs ${fee} gold`);
  state.gold -= fee;
  destroy(state, ids);
  const roll = rand(state);
  const outcome: SynthOutcome = roll < synth.skip ? "jackpot" : roll < synth.skip + synth.stay ? "stay" : "upgrade";
  const target = outcome === "jackpot" ? g + 2 : outcome === "stay" ? g : g + 1;
  const item = createItem(state, level, Math.min(MAX_GRADE, target));
  state.inventory.push(item.id);
  return ok({ item, outcome });
}

export function runeStatus(state: GameState, key: RuneKey): { owned: number; cost: number; maxed: boolean; locked: boolean } {
  const owned = state.runes[key] ?? 0;
  return {
    owned,
    cost: runeCost(key, owned),
    maxed: owned >= RUNES[key].max,
    locked: RUNES[key].requires.some((r) => (state.runes[r] ?? 0) === 0),
  };
}

export function buyRune(state: GameState, key: RuneKey): Result {
  const status = runeStatus(state, key);
  if (status.locked) return fail("Unlock the previous rune first");
  if (status.maxed) return fail("Already at max level");
  if (state.gold < status.cost) return fail("Not enough gold");
  state.gold -= status.cost;
  state.runes[key] = status.owned + 1;
  if (RUNES[key].effect === "partySlot") {
    const recruit = CLASS_KEYS.find((cls) => !state.party.includes(cls));
    if (recruit && state.party.length < partySize(modifiers(state))) setParty(state, [...state.party, recruit]);
  }
  return ok(undefined);
}

export function setParty(state: GameState, party: readonly ClassKey[]): Result {
  if (party.length === 0) return fail("The party needs at least one hero");
  if (new Set(party).size !== party.length) return fail("A hero can only appear once");
  if (party.length > partySize(modifiers(state))) return fail("Not enough party slots");
  state.party = [...party];
  startStage(state, state.stage);
  return ok(undefined);
}

export function travel(state: GameState, stage: number): Result {
  if (stage < 0 || stage > state.unlockedStage) return fail("Stage is locked");
  startStage(state, stage);
  return ok(undefined);
}

export function setAutoAdvance(state: GameState, on: boolean): Result {
  state.autoAdvance = on;
  return ok(undefined);
}
