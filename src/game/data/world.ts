import type { MonsterKey } from "../schema";
import type { SpriteRef } from "../types";

export interface MonsterDef {
  name: string;
  sprite: SpriteRef;
  hp: number;
  dmg: number;
  interval: number;
}

const c = (index: number): SpriteRef => ({ sheet: "creatures", index });

export const MONSTERS: Record<MonsterKey, MonsterDef> = {
  goblin: { name: "Goblin", sprite: c(10), hp: 1, dmg: 1, interval: 1.4 },
  mushroom: { name: "Bog Slime", sprite: c(13), hp: 1.3, dmg: 0.7, interval: 1.6 },
  snake: { name: "Slugling", sprite: c(40), hp: 0.8, dmg: 1.2, interval: 1.2 },
  wolf: { name: "Orc Warrior", sprite: c(23), hp: 1.1, dmg: 1.1, interval: 1.1 },
  bat: { name: "Bat", sprite: { sheet: "dungeon", index: 120 }, hp: 0.7, dmg: 0.9, interval: 0.9 },
  orc: { name: "Masked Orc", sprite: c(11), hp: 1.2, dmg: 1.2, interval: 1.5 },
  troll: { name: "Ogre Chief", sprite: c(42), hp: 1.3, dmg: 1.1, interval: 1.8 },
  skeleton: { name: "Skeleton", sprite: c(1), hp: 0.9, dmg: 1.1, interval: 1.3 },
  zombie: { name: "Zombie", sprite: c(0), hp: 1.4, dmg: 0.9, interval: 1.7 },
  scorpion: { name: "Mud Golem", sprite: c(145), hp: 1, dmg: 1.2, interval: 1.2 },
  cobra: { name: "Sand Slug", sprite: c(41), hp: 0.8, dmg: 1.3, interval: 1.1 },
  mummy: { name: "Ghoul", sprite: c(95), hp: 1.2, dmg: 1, interval: 1.4 },
  reaper: { name: "Necromancer", sprite: c(4), hp: 1.1, dmg: 1.3, interval: 1.4 },
  vampire: { name: "Plague Giant", sprite: c(2), hp: 1.3, dmg: 1.2, interval: 1.5 },
  yeti: { name: "Frost Ghoul", sprite: c(43), hp: 1.4, dmg: 1, interval: 1.6 },
  frost: { name: "Fallen Angel", sprite: c(49), hp: 0.9, dmg: 1.2, interval: 1.2 },
  flame: { name: "Chort", sprite: c(45), hp: 0.9, dmg: 1.3, interval: 1.2 },
  imp: { name: "Imp", sprite: c(39), hp: 0.8, dmg: 1.1, interval: 0.9 },
  skull: { name: "Wogol", sprite: c(3), hp: 1, dmg: 1.2, interval: 1.3 },
  demon: { name: "Orc Shaman", sprite: c(38), hp: 1.2, dmg: 1.3, interval: 1.5 },
  dragon: { name: "Pit Lord", sprite: c(33), hp: 1.4, dmg: 1.3, interval: 1.6 },
};

export type Theme = "forest" | "desert" | "ember";

export interface ActDef {
  name: string;
  theme: Theme;
  pool: MonsterKey[];
  stageBoss: MonsterKey;
  actBoss: MonsterKey;
}

export const ACTS: readonly ActDef[] = [
  { name: "Greenwood", theme: "forest", pool: ["goblin", "mushroom", "snake", "wolf", "bat"], stageBoss: "orc", actBoss: "troll" },
  { name: "Dune Tombs", theme: "desert", pool: ["skeleton", "zombie", "scorpion", "cobra", "mummy"], stageBoss: "reaper", actBoss: "vampire" },
  { name: "Ember Peaks", theme: "ember", pool: ["yeti", "frost", "flame", "imp", "skull"], stageBoss: "demon", actBoss: "dragon" },
];

export const DIFFICULTIES = ["Normal", "Nightmare", "Hell", "Torment"] as const;

export const STAGES_PER_ACT = 10;
export const STAGES_PER_DIFFICULTY = ACTS.length * STAGES_PER_ACT;
export const STAGE_COUNT = DIFFICULTIES.length * STAGES_PER_DIFFICULTY;

export interface StageInfo {
  index: number;
  difficulty: number;
  act: number;
  num: number;
  level: number;
  isActBoss: boolean;
  label: string;
}

export function stageInfo(index: number): StageInfo {
  const difficulty = Math.floor(index / STAGES_PER_DIFFICULTY);
  const act = Math.floor((index % STAGES_PER_DIFFICULTY) / STAGES_PER_ACT);
  const num = index % STAGES_PER_ACT;
  return {
    index,
    difficulty,
    act,
    num,
    level: 1 + Math.round((index * 94) / (STAGE_COUNT - 1)),
    isActBoss: num === STAGES_PER_ACT - 1,
    label: `${act + 1}-${num + 1}`,
  };
}

export function actOf(index: number): ActDef {
  const act = ACTS[stageInfo(index).act];
  if (!act) throw new Error(`no act for stage ${index}`);
  return act;
}
