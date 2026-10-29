import { describe, expect, it } from "vitest";
import { alchemize, buyRune, equip, synthesize, toggleLock, travel } from "./actions";
import { step } from "./combat";
import { STAGE_COUNT } from "./data/world";
import { advance, applyOffline, newGame } from "./game";
import { alchemyValue, createItem, openChest } from "./loot";
import { parseSave, serialize } from "./save";
import type { ItemId } from "./schema";
import { STEP_MS } from "./tuning";
import type { GameEvent, GameState } from "./types";

function run(state: GameState, ms: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < ms; t += STEP_MS) step(state, events);
  return events;
}

function stock(state: GameState, count: number, grade: number, level = 1): ItemId[] {
  const ids = Array.from({ length: count }, () => createItem(state, level, grade).id);
  state.inventory.push(...ids);
  return ids;
}

describe("synthesis", () => {
  it("turns nine items of one grade into one item of a higher or equal grade", () => {
    const state = newGame(1, 0);
    const ids = stock(state, 9, 0);
    const result = synthesize(state, ids);
    expect(result.ok).toBe(true);
    expect(state.inventory).toHaveLength(1);
    if (result.ok) expect(result.value.item.grade).toBeGreaterThanOrEqual(1);
  });

  it("guarantees a Rare from 81 Commons", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = newGame(seed, 0);
      state.gold = 1_000_000;
      stock(state, 81, 0);
      for (let pass = 0; pass < 2; pass++) {
        for (let g = 0; g < 2; g++) {
          const pool = state.inventory.filter((id) => state.items[id]!.grade === g);
          while (pool.length >= 9) synthesize(state, pool.splice(0, 9));
        }
      }
      expect(state.inventory.some((id) => state.items[id]!.grade >= 2)).toBe(true);
    }
  });

  it("rejects mixed grades, locked items and the wrong count", () => {
    const state = newGame(1, 0);
    const mixed = [...stock(state, 8, 0), ...stock(state, 1, 1)];
    expect(synthesize(state, mixed).ok).toBe(false);
    const same = stock(state, 9, 0);
    toggleLock(state, same[0]!);
    expect(synthesize(state, same).ok).toBe(false);
    expect(synthesize(state, same.slice(1)).ok).toBe(false);
    expect(state.inventory).toHaveLength(18);
  });
});

describe("alchemy", () => {
  it("converts unlocked items into their gold value", () => {
    const state = newGame(1, 0);
    const ids = stock(state, 3, 2, 20);
    const expected = ids.reduce((sum, id) => sum + alchemyValue(state.items[id]!), 0);
    expect(alchemize(state, ids)).toEqual({ ok: true, value: expected });
    expect(state.gold).toBe(expected);
    expect(state.inventory).toHaveLength(0);
    expect(ids.every((id) => state.items[id] === undefined)).toBe(true);
  });

  it("refuses locked items", () => {
    const state = newGame(1, 0);
    const [id] = stock(state, 1, 0);
    toggleLock(state, id!);
    expect(alchemize(state, [id!]).ok).toBe(false);
    expect(state.gold).toBe(0);
  });
});

describe("runes", () => {
  it("charges gold, enforces prerequisites and recruits a hero with a party slot", () => {
    const state = newGame(1, 0);
    expect(buyRune(state, "might").ok).toBe(false);
    state.gold = 1_000;
    expect(buyRune(state, "fellowship1").ok).toBe(false);
    expect(buyRune(state, "might").ok).toBe(true);
    expect(state.gold).toBe(960);
    expect(buyRune(state, "fellowship1").ok).toBe(true);
    expect(state.party).toEqual(["knight", "ranger"]);
    expect(buyRune(state, "fellowship1").ok).toBe(false);
  });
});

describe("equipment", () => {
  it("swaps the previous item back into the inventory and enforces class and level", () => {
    const state = newGame(1, 0);
    const oldSword = state.heroes.knight.equipment.weapon;
    const sword = createItem(state, 1, 3, "sword");
    const bow = createItem(state, 1, 3, "bow");
    const highHelm = createItem(state, 50, 0, "helmet");
    state.inventory.push(sword.id, bow.id, highHelm.id);
    expect(equip(state, "knight", bow.id).ok).toBe(false);
    expect(equip(state, "knight", highHelm.id).ok).toBe(false);
    expect(equip(state, "knight", sword.id).ok).toBe(true);
    expect(state.heroes.knight.equipment.weapon).toBe(sword.id);
    expect(state.inventory).toContain(oldSword);
  });
});

describe("chests", () => {
  it("drops common chests no faster than the minimum interval", () => {
    const state = newGame(3, 0);
    state.chests = [];
    const minutes = 30;
    run(state, minutes * 60_000);
    const common = state.chests.filter((c) => c.kind === "common").length;
    expect(common).toBeGreaterThan(0);
    expect(common).toBeLessThanOrEqual(Math.ceil((minutes * 60) / 45));
  });

  it("opens into inventory and refuses when the inventory is full", () => {
    const state = newGame(1, 0);
    const opened = openChest(state, []);
    expect(opened.ok && opened.value.length).toBe(1);
    stock(state, 24 - state.inventory.length, 0);
    expect(openChest(state, []).ok).toBe(false);
    expect(state.chests).toHaveLength(1);
  });
});

describe("combat", () => {
  it("clears the first stage with the starting knight", () => {
    const state = newGame(1, 0);
    const events = run(state, 3 * 60_000);
    expect(events.some((e) => e.type === "stageCleared" && e.stage === 0)).toBe(true);
    expect(state.unlockedStage).toBeGreaterThan(0);
  });

  it("loses at the final stage and steps back one stage", () => {
    const state = newGame(1, 0);
    state.unlockedStage = STAGE_COUNT - 1;
    expect(travel(state, STAGE_COUNT - 1).ok).toBe(true);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60_000 && state.stage === STAGE_COUNT - 1; t += STEP_MS) step(state, events);
    expect(events.some((e) => e.type === "defeated")).toBe(true);
    expect(state.stage).toBe(STAGE_COUNT - 2);
  });

  it("refuses travel to a locked stage", () => {
    const state = newGame(1, 0);
    expect(travel(state, 5).ok).toBe(false);
    expect(state.stage).toBe(0);
  });
});

describe("offline progress", () => {
  it("credits nothing without the Repose rune", () => {
    const state = newGame(1, 0);
    state.rates.gold = 10;
    expect(applyOffline(state, 3_600_000).gold).toBe(0);
  });

  it("credits the online rate up to the offline cap", () => {
    const state = newGame(1, 0);
    state.runes.repose = 1;
    state.rates.gold = 10;
    const report = applyOffline(state, 5 * 3_600_000);
    expect(report.creditedMs).toBe(2 * 3_600_000);
    expect(state.gold).toBe(10 * 2 * 3_600);
  });

  it("steps the simulation for short gaps and switches to offline rewards for long ones", () => {
    const state = newGame(1, 0);
    state.runes.repose = 1;
    const clock = { last: 0, acc: 0 };
    expect(advance(state, clock, 5_050, [])).toBeNull();
    expect(state.time).toBe(5_000);
    const report = advance(state, clock, 5_050 + 3_600_000, []);
    expect(report?.creditedMs).toBe(3_600_000);
    expect(state.time).toBe(5_000);
  });
});

describe("saves", () => {
  it("round-trips progress", () => {
    const state = newGame(1, 0);
    run(state, 60_000);
    const parsed = parseSave(serialize(state, 123));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { battle: _a, ...before } = state;
    const { battle: _b, ...after } = parsed.value;
    expect(after).toEqual({ ...before, savedAt: 123 });
  });

  it("rejects corrupt or inconsistent saves", () => {
    expect(parseSave("{nope").ok).toBe(false);
    expect(parseSave(JSON.stringify({ version: 2 })).ok).toBe(false);
    const state = newGame(1, 0);
    state.inventory.push(999 as ItemId);
    expect(parseSave(serialize(state, 0)).ok).toBe(false);
  });
});
