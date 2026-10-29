import { CLASSES, CLASS_KEYS } from "./data/classes";
import { starterSkill } from "./data/skills";
import { PLAGUE_MAX_CONTAMINATION, PLAGUE_REFILL_PER_S } from "./data/world";
import { grantXp, newBattle, startBattle, step } from "./combat";
import { createItem } from "./loot";
import type { ClassKey, Hero, Save } from "./schema";
import { modifiers } from "./stats";
import { MAX_CATCHUP_MS, STEP_MS } from "./tuning";
import type { GameEvent, GameState } from "./types";

export function blankHero(unlocked: boolean): Hero {
  return { unlocked, level: 1, xp: 0, equipment: {}, skills: {}, slotted: [] };
}

export function newGame(seed: number, now: number): GameState {
  const save: Save = {
    version: 2,
    savedAt: now,
    rng: seed | 0,
    time: 0,
    gold: 0,
    items: {},
    inventory: [],
    stash: [],
    nextItemId: 1,
    materials: {},
    heroes: Object.fromEntries(CLASS_KEYS.map((cls) => [cls, blankHero(cls === "knight")])) as Record<ClassKey, Hero>,
    party: ["knight"],
    deployReadyAt: 0,
    runes: {},
    kills: {},
    chests: [
      { kind: "common", level: 1, cap: 6, difficulty: 0, plague: false },
      { kind: "common", level: 1, cap: 6, difficulty: 0, plague: false },
    ],
    chestReadyAt: { common: 0, boss: 0, act: 0 },
    autoOpenAt: 0,
    unlockedStage: 0,
    location: { kind: "stage", index: 0 },
    lastStage: 0,
    autoAdvance: true,
    cube: { level: 1, xp: 0 },
    plague: { contamination: PLAGUE_MAX_CONTAMINATION, best: 0, intensity: 1 },
    relics: {},
    reliquary: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    rates: { gold: 0, xp: 0, windowGold: 0, windowXp: 0, windowStart: 0 },
  };
  const knight = save.heroes.knight;
  knight.equipment.mainWeapon = createItem(save, 1, 0, CLASSES.knight.main).id;
  knight.skills[starterSkill("knight")] = 1;
  knight.slotted = [starterSkill("knight")];
  return { ...save, battle: newBattle(save, save.location, 100) };
}

export interface OfflineReport {
  elapsedMs: number;
  creditedMs: number;
  gold: number;
  xp: number;
  levels: number;
}

export function applyOffline(state: GameState, elapsedMs: number): OfflineReport {
  const hours = modifiers(state).offlineHours;
  const creditedMs = Math.min(elapsedMs, hours * 3_600_000);
  const gold = (state.rates.gold * creditedMs) / 1000;
  const xp = (state.rates.xp * creditedMs) / 1000;
  const events: GameEvent[] = [];
  state.gold += gold;
  for (const cls of state.party) grantXp(state, cls, xp, events);
  state.plague.contamination = Math.min(PLAGUE_MAX_CONTAMINATION, state.plague.contamination + (PLAGUE_REFILL_PER_S * elapsedMs) / 1000);
  startBattle(state, state.location.kind === "plague" ? { kind: "stage", index: state.lastStage } : state.location);
  return { elapsedMs, creditedMs, gold, xp, levels: events.length };
}

export interface Clock {
  last: number;
  acc: number;
}

export function advance(state: GameState, clock: Clock, now: number, events: GameEvent[]): OfflineReport | null {
  const delta = Math.max(0, now - clock.last);
  clock.last = now;
  if (delta > MAX_CATCHUP_MS) {
    clock.acc = 0;
    return applyOffline(state, delta);
  }
  clock.acc += delta;
  while (clock.acc >= STEP_MS) {
    step(state, events);
    clock.acc -= STEP_MS;
  }
  return null;
}
