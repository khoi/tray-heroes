import { describe, expect, it } from "vitest";
import { buyRune, enterPlague, equip, learnSkill, placeRelic, recruit, resetRunes, setParty, skillPoints, toggleLock, travel, unequip } from "./actions";
import { startBattle, step } from "./combat";
import { alchemize, attune, corrode, craft, socket, synthesize, unsocket } from "./cube";
import { CLASS_KEYS } from "./data/classes";
import { RUNES, RUNE_KEYS } from "./data/runes";
import { SKILLS, SKILL_KEYS, classSkills } from "./data/skills";
import { PLAGUE_UNLOCK_STAGE, STAGE_COUNT } from "./data/world";
import { advance, applyOffline, newGame } from "./game";
import { alchemyValue, createItem, createRelic, openChest } from "./loot";
import { SANDBOX_GOLD, sandboxGame } from "./sandbox";
import { parseSave, serialize } from "./save";
import type { ItemId } from "./schema";
import { heroStats, itemStats, modifiers } from "./stats";
import { STEP_MS } from "./tuning";
import type { GameEvent, GameState } from "./types";

function run(state: GameState, ms: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < ms; t += STEP_MS) step(state, events);
  return events;
}

function game(seed = 1): GameState {
  const state = newGame(seed, 0);
  state.heroes.knight.level = 4;
  return state;
}

function stock(state: GameState, count: number, grade: number, level = 1): ItemId[] {
  const ids = Array.from({ length: count }, () => createItem(state, level, grade).id);
  state.inventory.push(...ids);
  return ids;
}

describe("data", () => {
  it("links every rune to existing prerequisites", () => {
    for (const key of RUNE_KEYS) for (const req of RUNES[key].requires) expect(RUNE_KEYS).toContain(req);
  });

  it("gives every class six actives and sixteen passives across eight tiers", () => {
    for (const cls of CLASS_KEYS) {
      const keys = classSkills(cls);
      expect(keys.filter((k) => SKILLS[k].kind === "active")).toHaveLength(6);
      expect(keys.filter((k) => SKILLS[k].kind === "passive")).toHaveLength(16);
      expect(new Set(keys.map((k) => SKILLS[k].tier)).size).toBe(8);
    }
    expect(SKILL_KEYS).toHaveLength(132);
  });
});

describe("synthesis", () => {
  it("turns nine items of one grade into one item of a higher grade", () => {
    const state = game();
    const result = synthesize(state, stock(state, 9, 0));
    expect(result.ok && result.value.item.grade).toBeGreaterThanOrEqual(1);
    expect(state.inventory).toHaveLength(1);
  });

  it("guarantees a Rare from 81 Commons", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = game(seed);
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

  it("rejects mixed grades, locked items, the wrong count and an output level above the inputs", () => {
    const state = game();
    expect(synthesize(state, [...stock(state, 8, 0), ...stock(state, 1, 1)]).ok).toBe(false);
    const same = stock(state, 9, 0, 10);
    expect(synthesize(state, same, 20).ok).toBe(false);
    toggleLock(state, same[0]!);
    expect(synthesize(state, same).ok).toBe(false);
    expect(synthesize(state, same.slice(1)).ok).toBe(false);
    expect(state.inventory).toHaveLength(18);
  });

  it("stays closed until a hero reaches level 4", () => {
    const state = newGame(1, 0);
    expect(synthesize(state, stock(state, 9, 0)).ok).toBe(false);
  });
});

describe("alchemy", () => {
  it("converts unlocked items into gold and arcane dust", () => {
    const state = game();
    const ids = stock(state, 3, 2, 20);
    const gold = ids.reduce((sum, id) => sum + alchemyValue(state.items[id]!), 0);
    const result = alchemize(state, ids);
    expect(result).toEqual({ ok: true, value: { gold, dust: 12 } });
    expect(state.gold).toBe(gold);
    expect(state.materials.dust).toBe(12);
    expect(state.cube.xp).toBeGreaterThan(0);
  });

  it("refuses locked items", () => {
    const state = game();
    const [id] = stock(state, 1, 0);
    toggleLock(state, id!);
    expect(alchemize(state, [id!]).ok).toBe(false);
  });
});

describe("sockets and crafting", () => {
  it("adds a gem's stat to the item and charges a fee to remove it", () => {
    const state = game();
    state.cube.level = 10;
    state.materials.ruby3 = 1;
    state.gold = 1_000;
    const [id] = stock(state, 1, 2);
    expect(socket(state, id!, "decoration", 0, "ruby3").ok).toBe(true);
    expect(state.materials.ruby3).toBe(0);
    expect(itemStats(state.items[id!]!).attackPct).toBeCloseTo(0.08 + (state.items[id!]!.affixes.find((a) => a.stat === "attackPct")?.value ?? 0));
    expect(unsocket(state, id!, "decoration", 0).ok).toBe(true);
    expect(state.items[id!]!.sockets.decoration[0]).toBeNull();
    expect(state.gold).toBe(1_000 - 400);
  });

  it("updates hero stats after an equipped item is unequipped, socketed and re-equipped", () => {
    const state = game();
    state.cube.level = 10;
    state.materials.ruby3 = 1;
    const helm = createItem(state, 1, 2, "helmet");
    state.inventory.push(helm.id);
    equip(state, "knight", helm.id);
    const before = heroStats(state, "knight", modifiers(state)).attack;
    unequip(state, "knight", "helmet");
    socket(state, helm.id, "decoration", 0, "ruby3");
    equip(state, "knight", helm.id);
    expect(heroStats(state, "knight", modifiers(state)).attack).toBeGreaterThan(before);
  });

  it("refuses to craft into a full bag without spending anything", () => {
    const state = game();
    state.cube.level = 5;
    state.gold = 1_000;
    state.materials.dust = 50;
    stock(state, 24, 0);
    expect(craft(state, "helmet", 1, 1).ok).toBe(false);
    expect(state.gold).toBe(1_000);
    expect(state.materials.dust).toBe(50);
    expect(state.inventory).toHaveLength(24);
  });

  it("refuses sockets before the Cube level that unlocks them", () => {
    const state = game();
    state.materials.ruby1 = 1;
    const [id] = stock(state, 1, 2);
    expect(socket(state, id!, "decoration", 0, "ruby1").ok).toBe(false);
    expect(state.materials.ruby1).toBe(1);
  });

  it("crafts an item for gold and dust within the tier's grades", () => {
    const state = game();
    state.cube.level = 5;
    state.gold = 1_000;
    state.materials.dust = 50;
    const result = craft(state, "helmet", 1, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.base).toBe("helmet");
    expect(result.value.grade).toBeGreaterThanOrEqual(1);
    expect(result.value.grade).toBeLessThanOrEqual(4);
    expect(state.gold).toBe(800);
    expect(state.materials.dust).toBe(40);
    expect(craft(state, "helmet", 2, 1).ok).toBe(false);
  });
});

describe("heroes, skills and runes", () => {
  it("recruits a hero for gold without deploying it, and deploys only into a free party slot", () => {
    const state = game();
    state.gold = 10_000;
    expect(recruit(state, "ranger").ok).toBe(true);
    expect(state.heroes.ranger.unlocked).toBe(true);
    expect(state.gold).toBe(10_000 - 150);
    expect(setParty(state, ["knight", "ranger"]).ok).toBe(false);
    expect(buyRune(state, "command1").ok).toBe(true);
    expect(state.party).toEqual(["knight"]);
    expect(setParty(state, ["knight", "ranger"]).ok).toBe(true);
    expect(setParty(state, ["ranger", "knight"]).ok).toBe(true);
  });

  it("delays deploying a new hero for a minute after a swap", () => {
    const state = sandboxGame(1, 0);
    expect(setParty(state, ["knight", "ranger", "priest"]).ok).toBe(true);
    expect(setParty(state, ["knight", "ranger", "slayer"]).ok).toBe(false);
    run(state, 61_000);
    expect(setParty(state, ["knight", "ranger", "slayer"]).ok).toBe(true);
  });

  it("refunds every rune when the tree is reset", () => {
    const state = game();
    state.gold = 100_000;
    buyRune(state, "might");
    buyRune(state, "might");
    buyRune(state, "vigor");
    const spent = 100_000 - state.gold;
    expect(resetRunes(state)).toEqual({ ok: true, value: spent });
    expect(state.gold).toBe(100_000);
  });

  it("gates skill tiers by points spent", () => {
    const state = game();
    state.heroes.knight.level = 15;
    expect(skillPoints(state, "knight").free).toBe(14);
    expect(learnSkill(state, "knight", "warCry").ok).toBe(false);
    for (let i = 0; i < 9; i++) learnSkill(state, "knight", i < 4 ? "shieldBash" : "toughness");
    expect(learnSkill(state, "knight", "warCry").ok).toBe(true);
    expect(learnSkill(state, "ranger", "volley").ok).toBe(false);
    expect(learnSkill(state, "knight", "volley").ok).toBe(false);
  });

  it("casts the slotted skill every fifth attack and stuns the target", () => {
    const state = game();
    const events = run(state, 30_000);
    const bash = events.filter((e) => e.type === "attack" && e.skill === "shieldBash");
    expect(bash.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "status" && e.status === "stun")).toBe(true);
  });
});

describe("damage", () => {
  it("lowers resistances by the difficulty penalty", () => {
    const state = game();
    const mods = modifiers(state);
    expect(heroStats(state, "knight", mods, {}, 0).res.fire).toBeCloseTo(0);
    expect(heroStats(state, "knight", mods, {}, 0.6).res.fire).toBeCloseTo(-0.6);
    expect(heroStats(state, "knight", mods, { fireRes: 2 }, 0).res.fire).toBeCloseTo(0.75);
  });
});

describe("equipment", () => {
  it("swaps the previous item back and enforces class, level and recruitment", () => {
    const state = game();
    const old = state.heroes.knight.equipment.mainWeapon;
    const sword = createItem(state, 1, 3, "sword");
    const bow = createItem(state, 1, 3, "bow");
    const high = createItem(state, 50, 0, "helmet");
    state.inventory.push(sword.id, bow.id, high.id);
    expect(equip(state, "knight", bow.id).ok).toBe(false);
    expect(equip(state, "ranger", bow.id).ok).toBe(false);
    expect(equip(state, "knight", high.id).ok).toBe(false);
    expect(equip(state, "knight", sword.id).ok).toBe(true);
    expect(state.inventory).toContain(old);
  });
});

describe("chests", () => {
  it("drops common chests no faster than the minimum interval", () => {
    const state = game(3);
    state.chests = [];
    run(state, 30 * 60_000);
    const common = state.chests.filter((c) => c.kind === "common").length;
    expect(common).toBeGreaterThan(0);
    expect(common).toBeLessThanOrEqual(40);
  });

  it("opens into the bag with materials and refuses when the bag is full", () => {
    const state = game();
    const events: GameEvent[] = [];
    expect(openChest(state, events).ok).toBe(true);
    expect(state.materials.dust).toBe(1);
    stock(state, 24 - state.inventory.length, 0);
    expect(openChest(state, []).ok).toBe(false);
  });

  it("keeps the Soulstone when act chest storage is full", () => {
    const state = game();
    const blade = createItem(state, 1, 9, "sword");
    blade.affixes = [{ stat: "attack", value: 1e7 }];
    state.inventory.push(blade.id);
    equip(state, "knight", blade.id);
    state.materials.soul0 = 1;
    state.chests = Array.from({ length: 10 }, () => ({ kind: "act" as const, level: 8, cap: 6, difficulty: 0, plague: false }));
    state.unlockedStage = 9;
    state.autoAdvance = false;
    travel(state, 9);
    const events = run(state, 40_000);
    expect(events.some((e) => e.type === "stageCleared")).toBe(true);
    expect(state.materials.soul0).toBe(1);
    expect(state.chests.filter((c) => c.kind === "act")).toHaveLength(10);
  });

  it("needs a Soulstone to claim an act boss chest", () => {
    for (const souls of [0, 1]) {
      const state = game();
      const blade = createItem(state, 1, 9, "sword");
      blade.affixes = [{ stat: "attack", value: 1e7 }];
      state.inventory.push(blade.id);
      equip(state, "knight", blade.id);
      state.materials.soul0 = souls;
      state.chests = [];
      state.unlockedStage = 9;
      state.autoAdvance = false;
      travel(state, 9);
      const events = run(state, 40_000);
      expect(events.some((e) => e.type === "stageCleared")).toBe(true);
      expect(state.chests.some((c) => c.kind === "act")).toBe(souls === 1);
      expect(state.materials.soul0).toBe(0);
    }
  });
});

describe("combat", () => {
  it("clears the first stage with the starting knight", () => {
    const state = game();
    const events = run(state, 3 * 60_000);
    expect(events.some((e) => e.type === "stageCleared")).toBe(true);
    expect(state.unlockedStage).toBeGreaterThan(0);
  });

  it("loses at the final stage and steps back one stage", () => {
    const state = game();
    state.unlockedStage = STAGE_COUNT - 1;
    travel(state, STAGE_COUNT - 1);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60_000 && state.location.kind === "stage" && state.location.index === STAGE_COUNT - 1; t += STEP_MS) step(state, events);
    expect(events.some((e) => e.type === "defeated")).toBe(true);
    expect(state.location).toEqual({ kind: "stage", index: STAGE_COUNT - 2 });
  });

  it("refuses travel to a locked stage", () => {
    const state = game();
    expect(travel(state, 5).ok).toBe(false);
  });
});

describe("plaguelands and relics", () => {
  it("opens after Nightmare 1-10, drains contamination and sends heroes back when it runs out", () => {
    const state = game();
    expect(enterPlague(state, 1, false).ok).toBe(false);
    state.unlockedStage = PLAGUE_UNLOCK_STAGE + 1;
    startBattle(state, { kind: "stage", index: 5 });
    state.plague.contamination = 31;
    expect(enterPlague(state, 2, false).ok).toBe(false);
    expect(enterPlague(state, 1, false).ok).toBe(true);
    const events = run(state, 70_000);
    expect(events.some((e) => e.type === "notice")).toBe(true);
    expect(state.location).toEqual({ kind: "stage", index: 5 });
    expect(enterPlague(state, 1, false).ok).toBe(false);
  });

  it("applies a placed relic's new stats immediately after attunement", () => {
    const state = game();
    state.plague.best = 1;
    state.gold = 1e9;
    const relic = createRelic(state, 3, "red");
    placeRelic(state, 0, 0, relic.id);
    const total = () => relic.stats.reduce((sum, a) => sum + a.value, 0);
    const modsTotal = () => {
      const mods = modifiers(state);
      return relic.stats.reduce((sum, a) => sum + mods[a.stat], 0);
    };
    expect(modsTotal()).toBeCloseTo(total() * 1.5);
    for (let i = 0; i < 5; i++) {
      expect(attune(state, relic.id).ok).toBe(true);
      expect(modsTotal()).toBeCloseTo(total() * 1.5);
    }
  });

  it("corrodes items into contamination", () => {
    const state = game();
    state.unlockedStage = PLAGUE_UNLOCK_STAGE + 1;
    state.plague.contamination = 0;
    expect(corrode(state, stock(state, 3, 1))).toEqual({ ok: true, value: 12 });
    expect(state.plague.contamination).toBe(12);
  });

  it("adds placed relic stats to the whole party, more in a matching slot", () => {
    const state = game();
    const relic = createRelic(state, 0, "red");
    expect(placeRelic(state, 0, 0, relic.id).ok).toBe(false);
    state.plague.best = 1;
    const base = modifiers(state);
    expect(placeRelic(state, 0, 0, relic.id).ok).toBe(true);
    const affix = relic.stats[0]!;
    expect(modifiers(state)[affix.stat] - base[affix.stat]).toBeCloseTo(affix.value * 1.5);
    expect(placeRelic(state, 0, 1, relic.id).ok).toBe(true);
    expect(modifiers(state)[affix.stat] - base[affix.stat]).toBeCloseTo(affix.value);
    expect(placeRelic(state, 1, 0, relic.id).ok).toBe(false);
  });
});

describe("offline progress", () => {
  it("credits nothing without the Repose rune", () => {
    const state = game();
    state.rates.gold = 10;
    expect(applyOffline(state, 3_600_000).gold).toBe(0);
  });

  it("credits the online rate up to the offline cap", () => {
    const state = game();
    state.runes.repose = 1;
    state.rates.gold = 10;
    expect(applyOffline(state, 5 * 3_600_000).creditedMs).toBe(2 * 3_600_000);
    expect(state.gold).toBe(10 * 2 * 3_600);
  });

  it("records the XP heroes actually earn, including the over-level penalty", () => {
    const state = game();
    state.heroes.knight.level = 60;
    run(state, 5 * 60_000);
    const before = state.heroes.knight.xp;
    run(state, 3 * 60_000);
    const earned = (state.heroes.knight.xp - before) / 180;
    expect(state.rates.xp).toBeGreaterThan(earned * 0.5);
    expect(state.rates.xp).toBeLessThan(earned * 1.5);
  });

  it("steps the simulation for short gaps and switches to offline rewards for long ones", () => {
    const state = game();
    state.runes.repose = 1;
    const clock = { last: 0, acc: 0 };
    expect(advance(state, clock, 5_050, [])).toBeNull();
    expect(state.time).toBe(5_000);
    expect(advance(state, clock, 5_050 + 3_600_000, [])?.creditedMs).toBe(3_600_000);
  });
});

describe("saves", () => {
  it("round-trips progress", () => {
    const state = sandboxGame(1, 0);
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
    expect(parseSave(JSON.stringify({ version: 3 })).ok).toBe(false);
    const state = game();
    state.inventory.push(999 as ItemId);
    expect(parseSave(serialize(state, 0)).ok).toBe(false);
  });

  it("migrates a version 1 save, keeping heroes and items and refunding runes", () => {
    const v1 = {
      version: 1,
      savedAt: 5,
      rng: 9,
      time: 100,
      gold: 1_000,
      items: { "7": { id: 7, base: "sword", grade: 3, level: 20, affixes: [{ stat: "atkPct", value: 0.05 }, { stat: "regen", value: 0.025 * 22 * Math.pow(1.075, 19) * 1.45 }], locked: true } },
      inventory: [],
      nextItemId: 8,
      heroes: { knight: { level: 30, xp: 5, equipment: { weapon: 7 } }, ranger: { level: 12, xp: 0, equipment: {} }, mage: { level: 1, xp: 0, equipment: {} } },
      party: ["knight", "ranger"],
      runes: { might: 2 },
      kills: { goblin: 3 },
      chests: [{ kind: "boss", level: 40 }],
      unlockedStage: 44,
      stage: 40,
      autoAdvance: true,
      rates: { gold: 1, xp: 2, windowGold: 0, windowXp: 0, windowStart: 0 },
    };
    const parsed = parseSave(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = parsed.value;
    expect(s.gold).toBe(1_000 + 40 + 57);
    expect(s.heroes.knight.level).toBe(30);
    expect(s.heroes.ranger.unlocked).toBe(true);
    expect(s.heroes.priest.unlocked).toBe(false);
    expect(s.heroes.knight.equipment.mainWeapon).toBe(7);
    expect(s.items[7]!.affixes[0]).toEqual({ stat: "attackPct", value: 0.05 });
    expect(s.items[7]!.affixes[1]!.stat).toBe("regenPct");
    expect(s.items[7]!.affixes[1]!.value).toBeCloseTo(0.006 * 1.45);
    expect(s.location).toEqual({ kind: "stage", index: 40 });
    expect(s.chests[0]!.difficulty).toBe(1);
  });

  it("rejects saves that break the game's invariants", () => {
    const base = () => JSON.parse(serialize(sandboxGame(1, 0), 0));
    const variants: [string, (save: Record<string, any>) => void][] = [
      ["short reliquary", (s) => (s.reliquary = [])],
      ["stage out of range", (s) => (s.location = { kind: "stage", index: 999 })],
      ["item in two places", (s) => s.stash.push(s.heroes.knight.equipment.mainWeapon)],
      ["foreign skill", (s) => (s.heroes.knight.skills.volley = 1)],
      ["slotted passive", (s) => ((s.heroes.knight.skills.toughness = 1), s.heroes.knight.slotted.push("toughness"))],
      ["weapon on wrong class", (s) => (s.heroes.ranger.equipment.mainWeapon = s.heroes.knight.equipment.mainWeapon)],
    ];
    for (const [, mutate] of variants) {
      const save = base();
      mutate(save);
      expect(parseSave(JSON.stringify(save)).ok).toBe(false);
    }
    expect(parseSave(JSON.stringify(base())).ok).toBe(true);
  });

  it("starts the sandbox with every hero and a fortune", () => {
    const state = sandboxGame(1, 0);
    expect(state.gold).toBe(SANDBOX_GOLD);
    expect(state.party).toHaveLength(3);
    expect(CLASS_KEYS.every((c) => state.heroes[c].unlocked)).toBe(true);
    expect(parseSave(serialize(state, 0)).ok).toBe(true);
  });
});
