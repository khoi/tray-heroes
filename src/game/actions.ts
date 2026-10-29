import { CLASSES } from "./data/classes";
import { BASES, type Slot } from "./data/items";
import { RELIQUARIES } from "./data/relics";
import { RUNES, RUNE_KEYS, runeCost, runeSpent, type RuneKey } from "./data/runes";
import { SKILLS, TIER_POINTS, classSkills, maxLevel, starterSkill, type SkillKey } from "./data/skills";
import { PLAGUE_MAX_INTENSITY, PLAGUE_MIN_CONTAMINATION, PLAGUE_SOUL_INTENSITY } from "./data/world";
import { startBattle } from "./combat";
import { plagueUnlocked, relicsUnlocked } from "./cube";
import { createItem, takeMaterial } from "./loot";
import type { ClassKey, ItemId, RelicId } from "./schema";
import { inventoryCap, modifiers, partySize, skillSlots, stashCap } from "./stats";
import { DEPLOY_COOLDOWN_MS } from "./tuning";
import { fail, ok, type GameState, type Result } from "./types";

const done = ok(undefined);

export function equip(state: GameState, cls: ClassKey, id: ItemId): Result {
  const item = state.items[id];
  const at = state.inventory.indexOf(id);
  if (!item || at < 0) return fail("Item is not in the bag");
  const base = BASES[item.base];
  if (base.cls && base.cls !== cls) return fail(`Only a ${CLASSES[base.cls].name} can use this`);
  const hero = state.heroes[cls];
  if (!hero.unlocked) return fail("Recruit this hero first");
  if (hero.level < item.level) return fail(`Requires level ${item.level}`);
  const previous = hero.equipment[base.slot];
  hero.equipment[base.slot] = id;
  state.inventory.splice(at, 1, ...(previous === undefined ? [] : [previous]));
  return done;
}

export function unequip(state: GameState, cls: ClassKey, slot: Slot): Result {
  const id = state.heroes[cls].equipment[slot];
  if (id === undefined) return fail("Nothing equipped");
  if (state.inventory.length >= inventoryCap(modifiers(state))) return fail("Bag is full");
  delete state.heroes[cls].equipment[slot];
  state.inventory.push(id);
  return done;
}

export function toggleLock(state: GameState, id: ItemId): Result {
  const item = state.items[id];
  if (!item) return fail("Unknown item");
  item.locked = !item.locked;
  return done;
}

export function sortInventory(state: GameState): Result {
  state.inventory.sort((a, b) => state.items[b]!.grade - state.items[a]!.grade || state.items[b]!.level - state.items[a]!.level);
  return done;
}

export function stashItem(state: GameState, id: ItemId): Result {
  const at = state.inventory.indexOf(id);
  if (at < 0) return fail("Item is not in the bag");
  if (state.stash.length >= stashCap(modifiers(state))) return fail("Stash is full");
  state.inventory.splice(at, 1);
  state.stash.push(id);
  return done;
}

export function unstashItem(state: GameState, id: ItemId): Result {
  const at = state.stash.indexOf(id);
  if (at < 0) return fail("Item is not in the stash");
  if (state.inventory.length >= inventoryCap(modifiers(state))) return fail("Bag is full");
  state.stash.splice(at, 1);
  state.inventory.push(id);
  return done;
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
  const effect = RUNES[key].effect;
  if (effect === "partySlot") {
    const recruit = state.party.length < partySize(modifiers(state)) ? (Object.keys(state.heroes) as ClassKey[]).find((c) => state.heroes[c].unlocked && !state.party.includes(c)) : undefined;
    if (recruit) setParty(state, [...state.party, recruit]);
  }
  if (effect === "skillSlot") for (const cls of Object.keys(state.heroes) as ClassKey[]) autoSlot(state, cls);
  return done;
}

export function resetRunes(state: GameState): Result<number> {
  const refund = RUNE_KEYS.reduce((sum, key) => sum + runeSpent(key, state.runes[key] ?? 0), 0);
  if (refund === 0) return fail("No runes to reset");
  state.gold += refund;
  state.runes = {};
  const size = partySize(modifiers(state));
  if (state.party.length > size) state.party = state.party.slice(0, size);
  for (const cls of Object.keys(state.heroes) as ClassKey[]) {
    const hero = state.heroes[cls];
    hero.slotted = hero.slotted.slice(0, skillSlots(modifiers(state)));
  }
  startBattle(state, state.location);
  return ok(refund);
}

export function recruit(state: GameState, cls: ClassKey): Result {
  const hero = state.heroes[cls];
  if (hero.unlocked) return fail("Already recruited");
  const cost = CLASSES[cls].unlockCost;
  if (state.gold < cost) return fail(`Needs ${cost} gold`);
  state.gold -= cost;
  hero.unlocked = true;
  const weapon = createItem(state, 1, 0, CLASSES[cls].main);
  hero.equipment.mainWeapon = weapon.id;
  const starter = starterSkill(cls);
  hero.skills[starter] = 1;
  hero.slotted = [starter];
  if (state.party.length < partySize(modifiers(state))) setParty(state, [...state.party, cls]);
  return done;
}

export function setParty(state: GameState, party: readonly ClassKey[]): Result {
  if (party.length === 0) return fail("The party needs at least one hero");
  if (new Set(party).size !== party.length) return fail("A hero can only appear once");
  if (party.length > partySize(modifiers(state))) return fail("Not enough party slots");
  if (party.some((cls) => !state.heroes[cls].unlocked)) return fail("Recruit the hero first");
  const joining = party.some((cls) => !state.party.includes(cls));
  if (joining && state.time < state.deployReadyAt) return fail(`Deploying again in ${Math.ceil((state.deployReadyAt - state.time) / 1000)}s`);
  if (joining) state.deployReadyAt = state.time + DEPLOY_COOLDOWN_MS;
  state.party = [...party];
  startBattle(state, state.location);
  return done;
}

export function skillPoints(state: GameState, cls: ClassKey): { total: number; spent: number; free: number } {
  const hero = state.heroes[cls];
  const spent = Object.values(hero.skills).reduce((sum, level) => sum + level, 0);
  return { total: hero.level, spent, free: hero.level - spent };
}

export function skillTierOpen(state: GameState, cls: ClassKey, tier: number): boolean {
  return skillPoints(state, cls).spent >= tier * TIER_POINTS;
}

export function learnSkill(state: GameState, cls: ClassKey, key: SkillKey): Result {
  const def = SKILLS[key];
  if (def.cls !== cls) return fail("That skill belongs to another class");
  const hero = state.heroes[cls];
  if (!hero.unlocked) return fail("Recruit this hero first");
  const level = hero.skills[key] ?? 0;
  if (level >= maxLevel(key)) return fail("Already at max level");
  if (skillPoints(state, cls).free <= 0) return fail("No skill points left");
  if (!skillTierOpen(state, cls, def.tier)) return fail(`Spend ${def.tier * TIER_POINTS} points to open this tier`);
  hero.skills[key] = level + 1;
  autoSlot(state, cls);
  return done;
}

export function resetSkills(state: GameState, cls: ClassKey): Result {
  const hero = state.heroes[cls];
  const starter = starterSkill(cls);
  hero.skills = { [starter]: 1 };
  hero.slotted = [starter];
  return done;
}

function autoSlot(state: GameState, cls: ClassKey): void {
  const hero = state.heroes[cls];
  const slots = skillSlots(modifiers(state));
  hero.slotted = hero.slotted.filter((k) => hero.skills[k]).slice(0, slots);
  for (const key of classSkills(cls)) {
    if (hero.slotted.length >= slots) break;
    if (SKILLS[key].kind === "active" && hero.skills[key] && !hero.slotted.includes(key)) hero.slotted.push(key);
  }
}

export function slotSkill(state: GameState, cls: ClassKey, key: SkillKey, index: number): Result {
  const hero = state.heroes[cls];
  if (SKILLS[key].kind !== "active") return fail("Only active skills can be slotted");
  if (!hero.skills[key]) return fail("Learn the skill first");
  const slots = skillSlots(modifiers(state));
  if (index < 0 || index >= slots) return fail("No such skill slot");
  const next = hero.slotted.filter((k) => k !== key);
  next.splice(Math.min(index, next.length), 0, key);
  hero.slotted = next.slice(0, slots);
  startBattle(state, state.location);
  return done;
}

export function travel(state: GameState, stage: number): Result {
  if (stage < 0 || stage > state.unlockedStage) return fail("Stage is locked");
  startBattle(state, { kind: "stage", index: stage });
  return done;
}

export function setAutoAdvance(state: GameState, on: boolean): Result {
  state.autoAdvance = on;
  return done;
}

export function enterPlague(state: GameState, intensity: number, boss: boolean): Result {
  if (!plagueUnlocked(state)) return fail("Clear Nightmare 1-10 to open the Plaguelands");
  if (intensity < 1 || intensity > Math.min(PLAGUE_MAX_INTENSITY, state.plague.best + 1)) return fail("Clear the previous intensity first");
  if (state.plague.contamination < PLAGUE_MIN_CONTAMINATION) return fail(`Needs ${PLAGUE_MIN_CONTAMINATION} contamination to enter`);
  if (boss) {
    if (intensity < PLAGUE_SOUL_INTENSITY) return fail(`Contaminated bosses appear from intensity ${PLAGUE_SOUL_INTENSITY}`);
    if (!takeMaterial(state, "soulPlague")) return fail("Needs a Contaminated Soulstone");
  }
  state.plague.intensity = intensity;
  startBattle(state, { kind: "plague", intensity, boss });
  return done;
}

export function leavePlague(state: GameState): Result {
  if (state.location.kind !== "plague") return fail("Not in the Plaguelands");
  startBattle(state, { kind: "stage", index: state.lastStage });
  return done;
}

export function placeRelic(state: GameState, reliquary: number, slot: number, id: RelicId | null): Result {
  if (!relicsUnlocked(state)) return fail("Clear the Plaguelands once to unlock relics");
  const def = RELIQUARIES[reliquary];
  if (!def || slot < 0 || slot >= def.slots.length) return fail("No such relic slot");
  if (state.plague.best < def.unlockIntensity) return fail(`Clear intensity ${def.unlockIntensity} to open ${def.name}`);
  if (id !== null && !state.relics[id]) return fail("Unknown relic");
  for (const row of state.reliquary) for (let i = 0; i < row.length; i++) if (id !== null && row[i] === id) row[i] = null;
  state.reliquary[reliquary]![slot] = id;
  return done;
}
