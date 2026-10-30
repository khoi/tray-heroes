import type { SkillKey } from "./data/skills";
import type { DamageType, StatBlock, StatusKind } from "./data/stats";
import type { ChestKind, ClassKey, ItemId, MonsterKey, Save } from "./schema";
import type { Location } from "./data/world";

export type SpriteRef =
  | { sheet: "dungeon" | "town" | "creatures"; index: number }
  | { sheet: "custom"; name: CustomSprite };

export type CustomSprite = "helmet" | "armor" | "boots" | "amulet" | "coin";

export type BossRank = "none" | "stage" | "act";

export interface Status {
  kind: StatusKind;
  remaining: number;
  dps: number;
  acc: number;
  tick: number;
}

export interface HeroUnit {
  id: number;
  cls: ClassKey;
  hp: number;
  cooldown: number;
  attacks: number;
  reviveIn: number;
  skillReady: Partial<Record<SkillKey, number>>;
  statuses: Status[];
  taunt: number;
  phoenix: boolean;
}

export interface MonsterUnit {
  id: number;
  kind: MonsterKey;
  rank: BossRank;
  level: number;
  hp: number;
  maxHp: number;
  dmg: number;
  cooldown: number;
  attacks: number;
  statuses: Status[];
}

export interface Buff {
  target: number | "party";
  stats: StatBlock;
  remaining: number;
}

export interface Trap {
  from: number;
  remaining: number;
  amount: number;
  type: DamageType;
  target: "front" | "all";
  status: StatusKind | null;
  chance: number;
}

export type Phase =
  | { kind: "advancing"; remaining: number }
  | { kind: "fighting" }
  | { kind: "cleared"; remaining: number }
  | { kind: "defeated"; remaining: number };

export interface Battle {
  location: Location;
  wave: number;
  waves: number;
  phase: Phase;
  heroes: HeroUnit[];
  monsters: MonsterUnit[];
  buffs: Buff[];
  traps: Trap[];
  nextId: number;
}

export interface GameState extends Save {
  battle: Battle;
}

export type HitOutcome = "hit" | "crit" | "blocked" | "dodged";

export type GameEvent =
  | { type: "attack"; from: number; to: number; amount: number; outcome: HitOutcome; damage: DamageType; skill: SkillKey | null; splash: boolean }
  | { type: "hurt"; from: number; to: number; amount: number; outcome: HitOutcome; damage: DamageType; heavy: boolean }
  | { type: "dot"; to: number; amount: number; status: StatusKind }
  | { type: "status"; to: number; status: StatusKind }
  | { type: "heal"; from: number; to: number; amount: number }
  | { type: "buff"; from: number; skill: SkillKey }
  | { type: "trap"; from: number; skill: SkillKey }
  | { type: "revive"; from: number; to: number }
  | { type: "kill"; id: number; gold: number }
  | { type: "heroDown"; id: number }
  | { type: "waveStart"; wave: number }
  | { type: "stageCleared"; location: Location }
  | { type: "defeated"; location: Location }
  | { type: "chest"; kind: ChestKind }
  | { type: "material"; key: string; amount: number }
  | { type: "levelUp"; cls: ClassKey; level: number }
  | { type: "opened"; items: ItemId[] }
  | { type: "notice"; text: string };

export type Result<T = void> = { ok: true; value: T } | { ok: false; reason: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (reason: string): Result<never> => ({ ok: false, reason });
