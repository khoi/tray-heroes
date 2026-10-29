import { MAX_GRADE, grade } from "./data/grades";
import { AFFIX_POOL, BASES, BASE_KEYS, type BaseKey } from "./data/items";
import { material, type GemKey, type MaterialKey, type PartKey } from "./data/materials";
import { ATTUNE_BASE, ATTUNE_GROWTH } from "./data/relics";
import { PLAGUE_MAX_CONTAMINATION, PLAGUE_UNLOCK_STAGE, stageInfo } from "./data/world";
import { addMaterial, alchemyValue, createItem, itemLevel, rerollAffixes, rollAffix, rollRelicStats, synthFee, takeMaterial } from "./loot";
import { pick, rand, weighted } from "./rng";
import type { Item, ItemId, RelicId, Save } from "./schema";
import { inventoryCap, modifiers } from "./stats";
import { CUBE_FEATURES, CUBE_MAX_LEVEL, CUBE_UNLOCK_HERO_LEVEL, cubeXpToNext, type CubeFeature } from "./tuning";
import { fail, ok, type Result } from "./types";

export const SYNTH_INPUTS = 9;
export type SynthOutcome = "upgrade" | "jackpot" | "stay";
export type SocketKind = "decoration" | "engraving" | "inscription";

export const CRAFT_TIERS = 8;
const CRAFT_ODDS: readonly number[][] = [
  [0, 50, 40, 8, 2, 0, 0],
  [0, 42, 42, 12, 3.5, 0.5, 0],
  [0, 34, 44, 15, 6, 1, 0],
  [0, 26, 46, 18, 8.5, 1.5, 0],
  [0, 18, 47, 21, 11.5, 2.4, 0.1],
  [0, 10, 48, 24, 14.5, 3.3, 0.2],
  [0, 4, 48, 27, 17, 3.8, 0.2],
  [0, 0, 48, 30, 18, 3.8, 0.2],
];

export function craftOdds(tier: number): readonly number[] {
  return CRAFT_ODDS[Math.min(CRAFT_TIERS, Math.max(1, tier)) - 1]!;
}

export function craftCost(tier: number): { gold: number; dust: number } {
  return { gold: Math.round(200 * Math.pow(3, tier - 1)), dust: 10 * Math.pow(2, tier - 1) };
}

export const craftTierUnlocked = (state: Save, tier: number) => state.cube.level >= CUBE_FEATURES.craft + (tier - 1) * 3;

export function cubeUnlocked(state: Save): boolean {
  return Object.values(state.heroes).some((h) => h.unlocked && h.level >= CUBE_UNLOCK_HERO_LEVEL);
}

export function featureUnlocked(state: Save, feature: CubeFeature): boolean {
  return cubeUnlocked(state) && state.cube.level >= CUBE_FEATURES[feature];
}

function needFeature(state: Save, feature: CubeFeature): Result<true> {
  if (!cubeUnlocked(state)) return fail(`The Cube opens when a hero reaches level ${CUBE_UNLOCK_HERO_LEVEL}`);
  if (state.cube.level < CUBE_FEATURES[feature]) return fail(`Needs Cube level ${CUBE_FEATURES[feature]}`);
  return ok(true);
}

export function gainCubeXp(state: Save, amount: number): void {
  state.cube.xp += amount * (1 + modifiers(state).cubeXp);
  while (state.cube.level < CUBE_MAX_LEVEL && state.cube.xp >= cubeXpToNext(state.cube.level)) {
    state.cube.xp -= cubeXpToNext(state.cube.level);
    state.cube.level++;
  }
  if (state.cube.level >= CUBE_MAX_LEVEL) state.cube.xp = 0;
}

function bagItems(state: Save, ids: readonly ItemId[]): Result<Item[]> {
  if (new Set(ids).size !== ids.length) return fail("Duplicate items");
  const items: Item[] = [];
  for (const id of ids) {
    const item = state.items[id];
    if (!item || !state.inventory.includes(id)) return fail("Item is not in the bag");
    if (item.locked) return fail("Item is locked");
    items.push(item);
  }
  return ok(items);
}

function bagItem(state: Save, id: ItemId): Result<Item> {
  const item = state.items[id];
  if (!item || !state.inventory.includes(id)) return fail("Item is not in the bag");
  return ok(item);
}

function destroy(state: Save, ids: readonly ItemId[]): void {
  const gone = new Set<number>(ids);
  state.inventory = state.inventory.filter((id) => !gone.has(id));
  for (const id of ids) delete state.items[id];
}

export function alchemize(state: Save, ids: readonly ItemId[]): Result<{ gold: number; dust: number }> {
  const gate = needFeature(state, "alchemy");
  if (!gate.ok) return gate;
  if (ids.length === 0) return fail("Nothing selected");
  const taken = bagItems(state, ids);
  if (!taken.ok) return taken;
  const gold = Math.round(taken.value.reduce((sum, item) => sum + alchemyValue(item), 0) * (1 + modifiers(state).alchemyGold));
  const dust = taken.value.reduce((sum, item) => sum + grade(item.grade).dust, 0);
  destroy(state, ids);
  state.gold += gold;
  addMaterial(state, "dust", dust);
  gainCubeXp(state, taken.value.reduce((sum, item) => sum + item.grade + 1, 0));
  return ok({ gold, dust });
}

export function synthesize(state: Save, ids: readonly ItemId[], level?: number): Result<{ item: Item; outcome: SynthOutcome }> {
  const gate = needFeature(state, "synthesis");
  if (!gate.ok) return gate;
  if (ids.length !== SYNTH_INPUTS) return fail(`Needs exactly ${SYNTH_INPUTS} items`);
  const taken = bagItems(state, ids);
  if (!taken.ok) return taken;
  const g = taken.value[0]!.grade;
  if (taken.value.some((item) => item.grade !== g)) return fail("All items must share a grade");
  const synth = grade(g).synth;
  if (!synth) return fail(`${grade(g).name} is the highest grade`);
  const maxLevel = Math.max(...taken.value.map((i) => i.level));
  const outLevel = level === undefined ? itemLevel(taken.value.reduce((sum, i) => sum + i.level, 0) / SYNTH_INPUTS) : itemLevel(level);
  if (outLevel > maxLevel) return fail(`Output level can't exceed ${maxLevel}`);
  const fee = synthFee(g, outLevel);
  if (state.gold < fee) return fail(`Needs ${fee} gold`);
  state.gold -= fee;
  destroy(state, ids);
  const roll = rand(state);
  const outcome: SynthOutcome = roll < synth.skip ? "jackpot" : roll < synth.skip + synth.stay ? "stay" : "upgrade";
  const item = createItem(state, outLevel, Math.min(MAX_GRADE, outcome === "jackpot" ? g + 2 : outcome === "stay" ? g : g + 1));
  state.inventory.push(item.id);
  gainCubeXp(state, 5 * (g + 1));
  return ok({ item, outcome });
}

export function maxCraftLevel(state: Save): number {
  return itemLevel(stageInfo(state.unlockedStage).level);
}

export function craft(state: Save, base: BaseKey | null, tier: number, level: number): Result<Item> {
  const gate = needFeature(state, "craft");
  if (!gate.ok) return gate;
  if (tier < 1 || tier > CRAFT_TIERS || !craftTierUnlocked(state, tier)) return fail(`Tier ${tier} needs a higher Cube level`);
  if (level > maxCraftLevel(state)) return fail(`Can't craft above level ${maxCraftLevel(state)}`);
  if (state.inventory.length >= inventoryCap(modifiers(state))) return fail("Bag is full");
  const cost = craftCost(tier);
  if (state.gold < cost.gold) return fail(`Needs ${cost.gold} gold`);
  if ((state.materials.dust ?? 0) < cost.dust) return fail(`Needs ${cost.dust} Arcane Dust`);
  state.gold -= cost.gold;
  takeMaterial(state, "dust", cost.dust);
  const g = weighted(
    state,
    craftOdds(tier).map((w, i) => [i, w] as const),
  );
  const item = createItem(state, itemLevel(level), g, base ?? pick(state, BASE_KEYS));
  state.inventory.push(item.id);
  gainCubeXp(state, 10 * tier);
  return ok(item);
}

export function socket(state: Save, id: ItemId, kind: SocketKind, index: number, key: MaterialKey): Result<Item> {
  const gate = needFeature(state, kind);
  if (!gate.ok) return gate;
  const found = bagItem(state, id);
  if (!found.ok) return found;
  const item = found.value;
  const slots = item.sockets[kind];
  if (index < 0 || index >= slots.length) return fail("No such socket");
  if (slots[index] !== null) return fail("Socket is already filled");
  const info = material(key);
  const expected = kind === "decoration" ? "gem" : kind === "engraving" ? "part" : "scroll";
  if (info.kind !== expected) return fail(`${info.name} doesn't fit a ${kind} socket`);
  if (!takeMaterial(state, key)) return fail(`No ${info.name} left`);
  if (kind === "decoration") item.sockets.decoration[index] = key as GemKey;
  else if (kind === "engraving") item.sockets.engraving[index] = key as PartKey;
  else if (info.kind === "scroll") item.sockets.inscription[index] = rollAffix(state, pick(state, AFFIX_POOL[BASES[item.base].slot]), item.level, item.grade, 0.6 + 0.4 * info.tier);
  gainCubeXp(state, 5);
  return ok(item);
}

export function removalFee(item: Item, kind: SocketKind): number {
  const mult = kind === "decoration" ? 1 : kind === "engraving" ? 2 : 4;
  return Math.min(50_000, 100 * Math.pow(2, item.grade)) * mult;
}

export function unsocket(state: Save, id: ItemId, kind: SocketKind, index: number): Result<Item> {
  const gate = needFeature(state, "removal");
  if (!gate.ok) return gate;
  const found = bagItem(state, id);
  if (!found.ok) return found;
  const item = found.value;
  if ((item.sockets[kind][index] ?? null) === null) return fail("Socket is empty");
  const fee = removalFee(item, kind);
  if (state.gold < fee) return fail(`Needs ${fee} gold`);
  state.gold -= fee;
  item.sockets[kind][index] = null;
  return ok(item);
}

export function offeringFee(item: Item): number {
  return alchemyValue(item) * 2;
}

export function offer(state: Save, id: ItemId): Result<Item> {
  const gate = needFeature(state, "offering");
  if (!gate.ok) return gate;
  const found = bagItem(state, id);
  if (!found.ok) return found;
  const item = found.value;
  if (item.grade < 3) return fail("Only Legendary or better items can be offered");
  const fee = offeringFee(item);
  if (state.gold < fee) return fail(`Needs ${fee} gold`);
  state.gold -= fee;
  rerollAffixes(state, item);
  gainCubeXp(state, 8);
  return ok(item);
}

export const plagueUnlocked = (state: Save) => state.unlockedStage > PLAGUE_UNLOCK_STAGE;

export function corrode(state: Save, ids: readonly ItemId[]): Result<number> {
  if (!plagueUnlocked(state)) return fail("Corrosion opens with the Plaguelands");
  if (ids.length === 0) return fail("Nothing selected");
  const taken = bagItems(state, ids);
  if (!taken.ok) return taken;
  const gained = taken.value.reduce((sum, item) => sum + (item.grade + 1) * 2, 0);
  destroy(state, ids);
  state.plague.contamination = Math.min(PLAGUE_MAX_CONTAMINATION, state.plague.contamination + gained);
  return ok(gained);
}

export const relicsUnlocked = (state: Save) => state.plague.best >= 1;

export function attuneCost(attunements: number): number {
  return Math.round(ATTUNE_BASE * Math.pow(ATTUNE_GROWTH, attunements));
}

export function attune(state: Save, id: RelicId): Result<number> {
  if (!relicsUnlocked(state)) return fail("Clear the Plaguelands once to unlock relics");
  const relic = state.relics[id];
  if (!relic) return fail("Unknown relic");
  const cost = attuneCost(relic.attunements);
  if (state.gold < cost) return fail(`Needs ${cost} gold`);
  state.gold -= cost;
  relic.attunements++;
  relic.stats = rollRelicStats(state, relic.color, relic.grade);
  return ok(cost);
}
