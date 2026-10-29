import { grantXp, newBattle, step, startStage } from "./combat";
import { createItem } from "./loot";
import { CLASS_KEYS, type Hero, type Save } from "./schema";
import { modifiers } from "./stats";
import { MAX_CATCHUP_MS, STEP_MS } from "./tuning";
import type { GameEvent, GameState } from "./types";

export function newGame(seed: number, now: number): GameState {
  const save: Save = {
    version: 1,
    savedAt: now,
    rng: seed | 0,
    time: 0,
    gold: 0,
    items: {},
    inventory: [],
    nextItemId: 1,
    heroes: Object.fromEntries(CLASS_KEYS.map((cls) => [cls, { level: 1, xp: 0, equipment: {} } satisfies Hero])) as Save["heroes"],
    party: ["knight"],
    runes: {},
    kills: {},
    chests: [
      { kind: "common", level: 1 },
      { kind: "common", level: 1 },
    ],
    chestReadyAt: { common: 0, boss: 0, act: 0 },
    autoOpenAt: 0,
    unlockedStage: 0,
    stage: 0,
    autoAdvance: true,
    rates: { gold: 0, xp: 0, windowGold: 0, windowXp: 0, windowStart: 0 },
  };
  for (const cls of CLASS_KEYS) {
    const weapon = createItem(save, 1, 0, cls === "knight" ? "sword" : cls === "ranger" ? "bow" : "staff");
    save.heroes[cls].equipment.weapon = weapon.id;
  }
  return { ...save, battle: newBattle(save, 0, 100) };
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
  startStage(state, state.stage);
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
