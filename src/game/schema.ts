import { z } from "zod";

export const CLASS_KEYS = ["knight", "ranger", "mage"] as const;
export const SLOTS = ["weapon", "helmet", "armor", "boots", "ring", "amulet"] as const;
export const BASE_KEYS = ["sword", "bow", "staff", "helmet", "armor", "boots", "ring", "amulet"] as const;
export const STAT_KEYS = [
  "hp",
  "atk",
  "armor",
  "regen",
  "hpPct",
  "atkPct",
  "atkSpeed",
  "critChance",
  "critDamage",
] as const;
export const CHEST_KINDS = ["common", "boss", "act"] as const;
export const RUNE_KEYS = [
  "might",
  "vigor",
  "bulwark",
  "precision",
  "ferocity",
  "greed",
  "wisdom",
  "fortune",
  "treasure",
  "haste",
  "satchel",
  "fellowship1",
  "fellowship2",
  "mainspring",
  "repose",
  "longRepose",
  "brevity",
] as const;
export const MONSTER_KEYS = [
  "goblin",
  "mushroom",
  "snake",
  "wolf",
  "bat",
  "orc",
  "troll",
  "skeleton",
  "zombie",
  "scorpion",
  "cobra",
  "mummy",
  "reaper",
  "vampire",
  "yeti",
  "frost",
  "flame",
  "imp",
  "skull",
  "demon",
  "dragon",
] as const;

export const ClassKey = z.enum(CLASS_KEYS);
export const Slot = z.enum(SLOTS);
export const BaseKey = z.enum(BASE_KEYS);
export const StatKey = z.enum(STAT_KEYS);
export const ChestKind = z.enum(CHEST_KINDS);
export const RuneKey = z.enum(RUNE_KEYS);
export const MonsterKey = z.enum(MONSTER_KEYS);
export const ItemId = z.number().int().nonnegative().brand<"ItemId">();

export const Affix = z.object({ stat: StatKey, value: z.number() });

export const Item = z.object({
  id: ItemId,
  base: BaseKey,
  grade: z.number().int().min(0),
  level: z.number().int().min(1),
  affixes: z.array(Affix),
  locked: z.boolean(),
});

export const Hero = z.object({
  level: z.number().int().min(1),
  xp: z.number().nonnegative(),
  equipment: z.partialRecord(Slot, ItemId),
});

export const Chest = z.object({ kind: ChestKind, level: z.number().int().min(1) });

export const Save = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  rng: z.number().int(),
  time: z.number(),
  gold: z.number().nonnegative(),
  items: z.record(z.string(), Item),
  inventory: z.array(ItemId),
  nextItemId: z.number().int().nonnegative(),
  heroes: z.record(ClassKey, Hero),
  party: z.array(ClassKey).min(1),
  runes: z.partialRecord(RuneKey, z.number().int().min(1)),
  kills: z.partialRecord(MonsterKey, z.number().int().min(0)),
  chests: z.array(Chest),
  chestReadyAt: z.object({ common: z.number(), boss: z.number(), act: z.number() }),
  autoOpenAt: z.number(),
  unlockedStage: z.number().int().min(0),
  stage: z.number().int().min(0),
  autoAdvance: z.boolean(),
  rates: z.object({ gold: z.number(), xp: z.number(), windowGold: z.number(), windowXp: z.number(), windowStart: z.number() }),
});

export type ClassKey = z.infer<typeof ClassKey>;
export type Slot = z.infer<typeof Slot>;
export type BaseKey = z.infer<typeof BaseKey>;
export type StatKey = z.infer<typeof StatKey>;
export type ChestKind = z.infer<typeof ChestKind>;
export type RuneKey = z.infer<typeof RuneKey>;
export type MonsterKey = z.infer<typeof MonsterKey>;
export type ItemId = z.infer<typeof ItemId>;
export type Affix = z.infer<typeof Affix>;
export type Item = z.infer<typeof Item>;
export type Hero = z.infer<typeof Hero>;
export type Chest = z.infer<typeof Chest>;
export type Save = z.infer<typeof Save>;
