import { z } from "zod";
import { CLASS_KEYS, type ClassKey as ClassKeyT } from "./data/classes";
import { BASE_KEYS, SLOTS, UNIQUE_KEYS, type BaseKey as BaseKeyT, type UniqueKey as UniqueKeyT } from "./data/items";
import { GEM_KEYS, MATERIAL_KEYS, PARTS, type GemKey, type MaterialKey as MaterialKeyT, type PartKey } from "./data/materials";
import { RELIC_COLORS } from "./data/relics";
import { RUNE_KEYS, type RuneKey as RuneKeyT } from "./data/runes";
import { SKILL_KEYS, type SkillKey as SkillKeyT } from "./data/skills";
import { STAT_KEYS, type StatKey as StatKeyT } from "./data/stats";
import { MONSTER_KEYS } from "./data/world";

const enumOf = <T extends string>(keys: readonly T[]) => z.enum(keys as [T, ...T[]]);

export const ClassKey = z.enum(CLASS_KEYS);
export const Slot = z.enum(SLOTS);
export const BaseKey = enumOf<BaseKeyT>(BASE_KEYS);
export const StatKey = enumOf<StatKeyT>(STAT_KEYS);
export const SkillKey = enumOf<SkillKeyT>(SKILL_KEYS);
export const RuneKey = enumOf<RuneKeyT>(RUNE_KEYS);
export const UniqueKey = enumOf<UniqueKeyT>(UNIQUE_KEYS);
export const MaterialKey = enumOf<MaterialKeyT>(MATERIAL_KEYS);
export const GemKeySchema = enumOf<GemKey>(GEM_KEYS);
export const PartKeySchema = enumOf<PartKey>(Object.keys(PARTS) as PartKey[]);
export const ChestKind = z.enum(["common", "boss", "act"]);
export const MonsterKey = z.enum(MONSTER_KEYS);
export const ItemId = z.number().int().nonnegative().brand<"ItemId">();
export const RelicId = z.number().int().nonnegative().brand<"RelicId">();

export const Affix = z.object({ stat: StatKey, value: z.number() });

export const Sockets = z.object({
  decoration: z.array(GemKeySchema.nullable()),
  engraving: z.array(PartKeySchema.nullable()),
  inscription: z.array(Affix.nullable()),
});

export const Item = z.object({
  id: ItemId,
  base: BaseKey,
  grade: z.number().int().min(0).max(9),
  level: z.number().int().min(1),
  affixes: z.array(Affix),
  unique: UniqueKey.nullable(),
  sockets: Sockets,
  locked: z.boolean(),
});

export const Hero = z.object({
  unlocked: z.boolean(),
  level: z.number().int().min(1),
  xp: z.number().nonnegative(),
  equipment: z.partialRecord(Slot, ItemId),
  skills: z.partialRecord(SkillKey, z.number().int().min(1)),
  slotted: z.array(SkillKey),
});

export const Chest = z.object({ kind: ChestKind, level: z.number().int().min(1), cap: z.number().int().min(0).max(9), difficulty: z.number().int().min(0).max(4), plague: z.boolean() });

export const Location = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stage"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("plague"), intensity: z.number().int().min(1), boss: z.boolean() }),
]);

export const Relic = z.object({
  id: RelicId,
  color: z.enum(RELIC_COLORS),
  grade: z.number().int().min(0).max(9),
  stats: z.array(Affix),
  attunements: z.number().int().min(0),
});

export const Save = z.object({
  version: z.literal(2),
  savedAt: z.number(),
  rng: z.number().int(),
  time: z.number(),
  gold: z.number().nonnegative(),
  items: z.record(z.string(), Item),
  inventory: z.array(ItemId),
  stash: z.array(ItemId),
  nextItemId: z.number().int().nonnegative(),
  materials: z.partialRecord(MaterialKey, z.number().int().min(0)),
  heroes: z.record(ClassKey, Hero),
  party: z.array(ClassKey).min(1),
  deployReadyAt: z.number(),
  runes: z.partialRecord(RuneKey, z.number().int().min(1)),
  kills: z.partialRecord(MonsterKey, z.number().int().min(0)),
  chests: z.array(Chest),
  chestReadyAt: z.object({ common: z.number(), boss: z.number(), act: z.number() }),
  autoOpenAt: z.number(),
  unlockedStage: z.number().int().min(0),
  location: Location,
  lastStage: z.number().int().min(0),
  autoAdvance: z.boolean(),
  cube: z.object({ level: z.number().int().min(1), xp: z.number().min(0) }),
  plague: z.object({ contamination: z.number().min(0), best: z.number().int().min(0), intensity: z.number().int().min(1) }),
  relics: z.record(z.string(), Relic),
  reliquary: z.array(z.array(RelicId.nullable())),
  rates: z.object({ gold: z.number(), xp: z.number(), windowGold: z.number(), windowXp: z.number(), windowStart: z.number() }),
});

export type ClassKey = ClassKeyT;
export type Slot = z.infer<typeof Slot>;
export type BaseKey = BaseKeyT;
export type StatKey = StatKeyT;
export type SkillKey = SkillKeyT;
export type RuneKey = RuneKeyT;
export type UniqueKey = UniqueKeyT;
export type MaterialKey = MaterialKeyT;
export type ChestKind = z.infer<typeof ChestKind>;
export type MonsterKey = z.infer<typeof MonsterKey>;
export type ItemId = z.infer<typeof ItemId>;
export type RelicId = z.infer<typeof RelicId>;
export type Affix = z.infer<typeof Affix>;
export type Sockets = z.infer<typeof Sockets>;
export type Item = z.infer<typeof Item>;
export type Hero = z.infer<typeof Hero>;
export type Chest = z.infer<typeof Chest>;
export type Relic = z.infer<typeof Relic>;
export type Location = z.infer<typeof Location>;
export type Save = z.infer<typeof Save>;

export { CLASS_KEYS, SLOTS, BASE_KEYS, RUNE_KEYS, SKILL_KEYS, MONSTER_KEYS, MATERIAL_KEYS };
