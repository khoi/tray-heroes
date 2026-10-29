import { z } from "zod";
import { gradeCap, grade } from "./data/grades";
import { CLASS_KEYS, type ClassKey } from "./data/classes";
import { starterSkill } from "./data/skills";
import type { StatKey } from "./data/stats";
import { PLAGUE_MAX_CONTAMINATION } from "./data/world";
import { blankHero } from "./game";
import type { Affix, BaseKey, Hero, Item, ItemId, Save, Slot } from "./schema";

const V1 = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  rng: z.number(),
  time: z.number(),
  gold: z.number(),
  items: z.record(z.string(), z.object({ id: z.number(), base: z.string(), grade: z.number(), level: z.number(), affixes: z.array(z.object({ stat: z.string(), value: z.number() })), locked: z.boolean() })),
  inventory: z.array(z.number()),
  nextItemId: z.number(),
  heroes: z.record(z.string(), z.object({ level: z.number(), xp: z.number(), equipment: z.record(z.string(), z.number()) })),
  party: z.array(z.string()),
  runes: z.record(z.string(), z.number()),
  kills: z.record(z.string(), z.number()),
  chests: z.array(z.object({ kind: z.enum(["common", "boss", "act"]), level: z.number() })),
  unlockedStage: z.number(),
  stage: z.number(),
  autoAdvance: z.boolean(),
  rates: z.object({ gold: z.number(), xp: z.number(), windowGold: z.number(), windowXp: z.number(), windowStart: z.number() }),
});

const V1_RUNES: Record<string, [cost: number, growth: number]> = {
  might: [40, 1.42],
  vigor: [40, 1.42],
  greed: [60, 1.42],
  wisdom: [60, 1.42],
  precision: [300, 1.6],
  ferocity: [500, 1.6],
  fellowship1: [250, 1],
  fellowship2: [12_000, 1],
  bulwark: [150, 1.45],
  repose: [100, 1],
  longRepose: [3_000, 1.8],
  fortune: [200, 1.5],
  treasure: [1_500, 1.5],
  haste: [800, 1.6],
  mainspring: [1_200, 1],
  satchel: [150, 1.7],
  brevity: [250_000, 6],
};

const V1_STATS: Record<string, StatKey> = {
  hp: "life",
  atk: "attack",
  armor: "armor",
  hpPct: "lifePct",
  atkPct: "attackPct",
  atkSpeed: "attackSpeed",
  critChance: "critChance",
  critDamage: "critDamage",
};

const V1_SLOTS: Record<string, Slot> = { weapon: "mainWeapon", helmet: "helmet", armor: "armor", boots: "boots", ring: "ring", amulet: "amulet" };

function regenPct(value: number, level: number, gradeIndex: number): number {
  const scale = 1 + 0.15 * gradeIndex;
  const roll = value / (22 * Math.pow(1.075, level - 1) * scale);
  const quality = Math.min(1, Math.max(0, (roll - 0.01) / 0.015));
  return (0.002 + quality * 0.004) * scale;
}

const difficultyOf = (level: number) => (level < 25 ? 0 : level < 48 ? 1 : level < 72 ? 2 : 3);

export function migrateV1(json: unknown): Save | null {
  const parsed = V1.safeParse(json);
  if (!parsed.success) return null;
  const v1 = parsed.data;
  const items: Record<string, Item> = {};
  for (const [key, old] of Object.entries(v1.items)) {
    const [deco, engr, insc] = grade(old.grade).sockets;
    items[key] = {
      id: old.id as ItemId,
      base: old.base as BaseKey,
      grade: old.grade,
      level: old.level,
      affixes: old.affixes.flatMap((a): Affix[] => {
        if (a.stat === "regen") return [{ stat: "regenPct", value: regenPct(a.value, old.level, old.grade) }];
        return V1_STATS[a.stat] ? [{ stat: V1_STATS[a.stat]!, value: a.value }] : [];
      }),
      unique: null,
      sockets: { decoration: Array(deco).fill(null), engraving: Array(engr).fill(null), inscription: Array(insc).fill(null) },
      locked: old.locked,
    };
  }
  const heroes = Object.fromEntries(
    CLASS_KEYS.map((cls): [ClassKey, Hero] => {
      const old = v1.heroes[cls];
      if (!old) return [cls, blankHero(false)];
      const equipment: Hero["equipment"] = {};
      for (const [slot, id] of Object.entries(old.equipment)) {
        const next = V1_SLOTS[slot];
        if (next && items[id]) equipment[next] = id as ItemId;
      }
      const starter = starterSkill(cls);
      return [cls, { unlocked: true, level: old.level, xp: old.xp, equipment, skills: { [starter]: 1 }, slotted: [starter] }];
    }),
  ) as Record<ClassKey, Hero>;
  const refund = Object.entries(v1.runes).reduce((sum, [key, owned]) => {
    const [cost, growth] = V1_RUNES[key] ?? [0, 1];
    let spent = 0;
    for (let i = 0; i < owned; i++) spent += Math.round(cost * Math.pow(growth, i));
    return sum + spent;
  }, 0);
  return {
    version: 2,
    savedAt: v1.savedAt,
    rng: v1.rng | 0,
    time: v1.time,
    gold: v1.gold + refund,
    items,
    inventory: v1.inventory.filter((id) => items[id]) as ItemId[],
    stash: [],
    nextItemId: v1.nextItemId,
    materials: {},
    heroes,
    party: [v1.party.find((c): c is ClassKey => (CLASS_KEYS as readonly string[]).includes(c)) ?? "knight"],
    deployReadyAt: 0,
    runes: {},
    kills: v1.kills as Save["kills"],
    chests: v1.chests.map((c) => ({ kind: c.kind, level: c.level, cap: gradeCap(difficultyOf(c.level), 0), difficulty: difficultyOf(c.level), plague: false })),
    chestReadyAt: { common: 0, boss: 0, act: 0 },
    autoOpenAt: 0,
    unlockedStage: v1.unlockedStage,
    location: { kind: "stage", index: v1.stage },
    lastStage: v1.stage,
    autoAdvance: v1.autoAdvance,
    cube: { level: 1, xp: 0 },
    plague: { contamination: PLAGUE_MAX_CONTAMINATION, best: 0, intensity: 1 },
    relics: {},
    reliquary: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    rates: v1.rates,
  };
}
