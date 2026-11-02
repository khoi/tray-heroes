import type { PartKey } from "./materials";
import type { DamageType, StatusKind } from "./stats";

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
export type MonsterKey = (typeof MONSTER_KEYS)[number];

export interface MonsterDef {
  name: string;
  hp: number;
  dmg: number;
  interval: number;
  type: DamageType;
  status: StatusKind | null;
  part: PartKey;
  ranged: boolean;
}

const m = (name: string, hp: number, dmg: number, interval: number, type: DamageType, status: StatusKind | null, part: PartKey, ranged = false): MonsterDef => ({
  name,
  hp,
  dmg,
  interval,
  type,
  status,
  part,
  ranged,
});

export const MONSTERS: Record<MonsterKey, MonsterDef> = {
  goblin: m("Goblin", 1, 1, 1.4, "physical", null, "wildFang"),
  mushroom: m("Bog Slug", 1.3, 0.7, 1.6, "chaos", "poison", "bogGel"),
  snake: m("Marsh Toad", 0.8, 1.2, 1.2, "chaos", "poison", "bogGel"),
  wolf: m("Grey Wolf", 1.1, 1.1, 1.1, "physical", "bleed", "wildFang"),
  bat: m("Carrion Crow", 0.7, 0.9, 0.9, "physical", null, "wildFang"),
  orc: m("Orc Brute", 1.2, 1.2, 1.5, "physical", "stun", "titanHeart"),
  troll: m("Elder Bear", 1.3, 1.1, 1.8, "physical", "stun", "titanHeart"),
  skeleton: m("Bone Duelist", 0.9, 1.1, 1.3, "physical", null, "boneShard"),
  zombie: m("Zombie", 1.4, 0.9, 1.7, "chaos", "poison", "graveDust"),
  scorpion: m("Bone Archer", 1, 1.2, 1.2, "physical", null, "boneShard", true),
  cobra: m("Plague Rat", 0.8, 1.3, 1.1, "chaos", "poison", "graveDust"),
  mummy: m("Ghoul", 1.2, 1, 1.4, "physical", "bleed", "graveDust"),
  reaper: m("Necromancer", 1.1, 1.3, 1.4, "chaos", null, "graveDust", true),
  vampire: m("Brood Mother", 1.3, 1.2, 1.5, "chaos", "poison", "titanHeart"),
  yeti: m("Frost Mantis", 1.4, 1, 1.6, "cold", "chill", "frostCore"),
  frost: m("Storm Wasp", 0.9, 1.2, 1.2, "lightning", "shock", "stormGland"),
  flame: m("Ember Raptor", 0.9, 1.3, 1.2, "fire", "ignite", "demonHorn"),
  imp: m("Cinder Beetle", 0.8, 1.1, 0.9, "fire", "ignite", "demonHorn"),
  skull: m("Thunder Millipede", 1, 1.2, 1.3, "lightning", "shock", "stormGland"),
  demon: m("Flame Warlord", 1.2, 1.3, 1.5, "fire", "ignite", "demonHorn"),
  dragon: m("Ember Tyrant", 1.4, 1.3, 1.6, "fire", "ignite", "titanHeart"),
};

export type Theme = "forest" | "crypt" | "lair" | "plague";

export interface ActDef {
  name: string;
  theme: Theme;
  pool: MonsterKey[];
  stageBoss: MonsterKey;
  actBoss: MonsterKey;
}

export const ACTS: readonly ActDef[] = [
  { name: "Greenwood", theme: "forest", pool: ["goblin", "mushroom", "snake", "wolf", "bat"], stageBoss: "orc", actBoss: "troll" },
  { name: "Sunken Crypt", theme: "crypt", pool: ["skeleton", "zombie", "scorpion", "cobra", "mummy"], stageBoss: "reaper", actBoss: "vampire" },
  { name: "Dragon's Lair", theme: "lair", pool: ["yeti", "frost", "flame", "imp", "skull"], stageBoss: "demon", actBoss: "dragon" },
];

export const DIFFICULTIES = ["Normal", "Nightmare", "Hell", "Torment"] as const;
export const RES_PENALTY = [0, 0.2, 0.4, 0.6] as const;

export const STAGES_PER_ACT = 10;
export const STAGES_PER_DIFFICULTY = ACTS.length * STAGES_PER_ACT;
export const STAGE_COUNT = DIFFICULTIES.length * STAGES_PER_DIFFICULTY;

export const PLAGUE_UNLOCK_STAGE = STAGES_PER_DIFFICULTY + STAGES_PER_ACT - 1;
export const PLAGUE_MIN_CONTAMINATION = 30;
export const PLAGUE_MAX_CONTAMINATION = 100;
export const PLAGUE_DRAIN_PER_S = 0.5;
export const PLAGUE_REFILL_PER_S = 1 / 30;
export const PLAGUE_SOUL_INTENSITY = 6;
export const PLAGUE_MAX_INTENSITY = 20;

export type Location = { kind: "stage"; index: number } | { kind: "plague"; intensity: number; boss: boolean };

export interface AreaInfo {
  location: Location;
  name: string;
  label: string;
  theme: Theme;
  level: number;
  difficulty: number;
  act: number;
  pool: MonsterKey[];
  stageBoss: MonsterKey;
  actBoss: MonsterKey;
  isActBoss: boolean;
  resPenalty: number;
  power: number;
  waves: number;
  plague: boolean;
}

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

const ALL_POOL = ACTS.flatMap((a) => a.pool);

export function areaInfo(location: Location): AreaInfo {
  if (location.kind === "plague") {
    const t = location.intensity;
    const act = ACTS[t % ACTS.length]!;
    return {
      location,
      name: location.boss ? "Contaminated Lair" : "Plaguelands",
      label: `Intensity ${t}`,
      theme: "plague",
      level: Math.min(100, 50 + t * 3),
      difficulty: Math.min(3, 1 + Math.floor(t / 6)),
      act: t % ACTS.length,
      pool: ALL_POOL,
      stageBoss: act.stageBoss,
      actBoss: act.actBoss,
      isActBoss: location.boss,
      resPenalty: Math.min(0.75, 0.3 + t * 0.02),
      power: 1 + t * 0.12,
      waves: location.boss ? 3 : 6,
      plague: true,
    };
  }
  const info = stageInfo(location.index);
  const act = ACTS[info.act]!;
  return {
    location,
    name: act.name,
    label: info.label,
    theme: act.theme,
    level: info.level,
    difficulty: info.difficulty,
    act: info.act,
    pool: act.pool,
    stageBoss: act.stageBoss,
    actBoss: act.actBoss,
    isActBoss: info.isActBoss,
    resPenalty: RES_PENALTY[info.difficulty] ?? 0,
    power: 1,
    waves: info.isActBoss ? 3 : 4 + Math.floor(info.num / 2),
    plague: false,
  };
}
