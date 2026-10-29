import type { ChestKind, ClassKey, ItemId, MonsterKey, Save, StatKey } from "./schema";

export type SpriteRef =
  | { sheet: "dungeon" | "town" | "creatures"; index: number }
  | { sheet: "custom"; name: CustomSprite };

export type CustomSprite = "helmet" | "armor" | "boots" | "amulet" | "coin";

export type Stats = Record<StatKey, number>;

export type BossRank = "none" | "stage" | "act";

export interface HeroUnit {
  id: number;
  cls: ClassKey;
  hp: number;
  cooldown: number;
  attacks: number;
  reviveIn: number;
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
}

export type Phase =
  | { kind: "advancing"; remaining: number }
  | { kind: "fighting" }
  | { kind: "cleared"; remaining: number }
  | { kind: "defeated"; remaining: number };

export interface Battle {
  stage: number;
  wave: number;
  waves: number;
  phase: Phase;
  heroes: HeroUnit[];
  monsters: MonsterUnit[];
  nextId: number;
}

export interface GameState extends Save {
  battle: Battle;
}

export type GameEvent =
  | { type: "attack"; from: number; to: number; amount: number; crit: boolean; skill: boolean; splash: boolean }
  | { type: "hurt"; from: number; to: number; amount: number }
  | { type: "kill"; id: number; gold: number }
  | { type: "heroDown"; id: number }
  | { type: "waveStart"; wave: number }
  | { type: "stageCleared"; stage: number }
  | { type: "defeated"; stage: number }
  | { type: "chest"; kind: ChestKind }
  | { type: "levelUp"; cls: ClassKey; level: number }
  | { type: "opened"; items: ItemId[] };

export type Result<T = void> = { ok: true; value: T } | { ok: false; reason: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (reason: string): Result<never> => ({ ok: false, reason });
