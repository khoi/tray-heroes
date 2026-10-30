export const STEP_MS = 100;
export const MAX_CATCHUP_MS = 10 * 60_000;
export const MAX_LEVEL = 100;

export const HERO_GROWTH = 1.07;
export const GEAR_GROWTH = 1.075;
export const MONSTER_GROWTH = 1.135;
export const GOLD_GROWTH = 1.095;
export const XP_GROWTH = 1.1;

export const MONSTER_BASE = { hp: 26, dmg: 5 };
export const KILL_BASE = { gold: 2, xp: 4 };
export const BOSS_MULT = {
  stage: { hp: 6, dmg: 1.6, gold: 6, xp: 6 },
  act: { hp: 14, dmg: 2.2, gold: 30, xp: 25 },
};

export const GEAR_BASE = { life: 22, attack: 5, armor: 6 };
export const ARMOR_K = 5;
export const BLOCK_FACTOR = 0.5;
export const LIFE_CAP_HIT = 0.5;

export const WALK_SECONDS = 1.6;
export const WALK_REGEN_PER_S = 0.04;
export const CLEARED_SECONDS = 1.2;
export const DEFEATED_SECONDS = 2.5;
export const REVIVE_SECONDS = 10;
export const DEPLOY_COOLDOWN_MS = 60_000;
export const MONSTER_STATUS_CHANCE = 0.25;
export const CHAIN_LIGHTNING_CHANCE = 0.2;

export const CHEST_RULES = {
  common: { chance: 0.12, intervalMs: 45_000, cap: 30, items: 1 },
  boss: { chance: 0.45, intervalMs: 90_000, cap: 20, items: 2 },
  act: { chance: 1, intervalMs: 600_000, cap: 10, items: 3 },
} as const;
export const AUTO_OPEN_MS = 8_000;
export const PART_DROP_CHANCE = 0.03;

export const BASE_INVENTORY = 24;
export const STASH_PAGE = 30;

export const CUBE_MAX_LEVEL = 30;
export const CUBE_FEATURES = {
  alchemy: 1,
  synthesis: 1,
  craft: 5,
  decoration: 8,
  removal: 10,
  offering: 10,
  engraving: 15,
  inscription: 25,
} as const;
export type CubeFeature = keyof typeof CUBE_FEATURES;
export const CUBE_UNLOCK_HERO_LEVEL = 4;

export function cubeXpToNext(level: number): number {
  return Math.round(40 * Math.pow(1.3, level - 1));
}

export function xpToNext(level: number): number {
  return Math.round(30 * Math.pow(XP_GROWTH, level - 1) * level);
}

export function levelPenalty(heroLevel: number, monsterLevel: number): number {
  const over = heroLevel - monsterLevel - 5;
  return over <= 0 ? 1 : Math.max(0.1, 1 - 0.15 * over);
}
